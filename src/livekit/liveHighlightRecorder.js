import { supabase } from '../supabaseClient';
import { highlightCountForLiveDuration } from './liveHighlightPolicy';

const SEGMENT_MS = 30_000;
const DATA_SLICE_MS = 1_000;
const MIN_CLIP_SECONDS = 15;
const MAX_SEGMENTS = 60; // ~30 minutes retained on device.
const CAMERA_REPLACED_EVENT = 'droxion:live-camera-replaced';

function isAppleMobile() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1);
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const mp4Choices = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4'
  ];
  const webmChoices = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ];
  // iOS/WebKit loops and seeks MP4 highlights more reliably than recorded WebM.
  const choices = isAppleMobile() ? [...mp4Choices, ...webmChoices] : [...webmChoices, ...mp4Choices];
  return choices.find(type => MediaRecorder.isTypeSupported?.(type)) || '';
}

function extensionFor(type) {
  return String(type || '').includes('mp4') ? 'mp4' : 'webm';
}

function normalizeFacing(value, fallback = 'user') {
  const facing = String(value || '').toLowerCase();
  if (facing.includes('environment') || facing.includes('rear') || facing.includes('back')) return 'environment';
  if (facing.includes('user') || facing.includes('front')) return 'user';
  return fallback === 'environment' ? 'environment' : 'user';
}

function facingForStream(stream, fallback = 'user') {
  const track = stream?.getVideoTracks?.()[0];
  const settingsFacing = track?.getSettings?.()?.facingMode;
  if (settingsFacing) return normalizeFacing(settingsFacing, fallback);
  return normalizeFacing(track?.label, fallback);
}

function makeRecorder(stream, preferredMimeType) {
  try {
    return preferredMimeType
      ? new MediaRecorder(stream, { mimeType: preferredMimeType, videoBitsPerSecond: 1_500_000 })
      : new MediaRecorder(stream, { videoBitsPerSecond: 1_500_000 });
  } catch {
    try { return new MediaRecorder(stream); } catch { return null; }
  }
}

async function uploadSegment({ creatorId, sessionId, index, segment, title }) {
  if (!segment?.blob?.size || segment.durationSeconds < MIN_CLIP_SECONDS) return null;
  const mimeType = segment.mimeType || segment.blob.type || 'video/webm';
  const ext = extensionFor(mimeType);
  const path = `${creatorId}/${sessionId}/auto-${index + 1}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('droxion-live-clips').upload(path, segment.blob, {
    contentType: mimeType,
    cacheControl: '31536000',
    upsert: false
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.rpc('droxion_publish_live_clip_v2', {
    p_session_id: sessionId,
    p_storage_path: path,
    p_caption: title ? `From LIVE · ${title}` : 'From LIVE on Droxion',
    p_duration_seconds: Math.round(segment.durationSeconds),
    p_highlight_score: Number(segment.score || 0),
    p_source_start_ms: Math.max(0, Math.round(segment.sourceStartMs || 0)),
    p_source_end_ms: Math.max(0, Math.round(segment.sourceEndMs || 0)),
    p_camera_facing: normalizeFacing(segment.cameraFacing, 'user')
  });

  if (error) {
    try { await supabase.storage.from('droxion-live-clips').remove([path]); } catch {}
    throw error;
  }
  return data;
}

export function createLiveHighlightRecorder({ creatorId, sessionId, stream, title = '', cameraFacing = '' }) {
  if (!creatorId || !sessionId || !stream || typeof MediaRecorder === 'undefined') return null;

  const preferredMimeType = pickMimeType();
  const liveStartedAt = Date.now();
  const segments = [];
  let currentStream = stream;
  let currentFacing = normalizeFacing(cameraFacing || facingForStream(stream, 'user'), 'user');
  let currentSegmentFacing = currentFacing;
  let currentRecorder = null;
  let currentChunks = [];
  let currentScore = 0;
  let currentStartedAt = 0;
  let rotateTimer = null;
  let stopped = false;
  let operation = Promise.resolve();

  function saveCurrentSegment() {
    if (!currentChunks.length || !currentStartedAt) return;
    const endedAt = Date.now();
    const durationSeconds = Math.max(0, (endedAt - currentStartedAt) / 1000);
    const mimeType = currentRecorder?.mimeType || preferredMimeType || currentChunks[0]?.type || 'video/webm';
    const blob = new Blob(currentChunks, { type: mimeType });
    if (blob.size && durationSeconds >= MIN_CLIP_SECONDS) {
      segments.push({
        blob,
        mimeType,
        durationSeconds: Math.min(45, durationSeconds),
        score: currentScore,
        cameraFacing: currentSegmentFacing,
        sourceStartMs: currentStartedAt - liveStartedAt,
        sourceEndMs: endedAt - liveStartedAt
      });
      if (segments.length > MAX_SEGMENTS) segments.splice(0, segments.length - MAX_SEGMENTS);
    }
    currentChunks = [];
    currentScore = 0;
    currentStartedAt = 0;
  }

  function startSegment() {
    if (stopped || !currentStream?.active) return false;
    const recorder = makeRecorder(currentStream, preferredMimeType);
    if (!recorder) return false;
    currentRecorder = recorder;
    currentChunks = [];
    currentScore = 0;
    currentStartedAt = Date.now();
    currentSegmentFacing = currentFacing;

    recorder.ondataavailable = event => {
      if (event.data?.size) currentChunks.push(event.data);
    };
    recorder.onerror = event => {
      console.warn('Droxion highlight recorder error', event?.error || event);
    };
    // Frequent chunks are much safer on iOS/WKWebView than waiting for one
    // large final data event when the user exits a LIVE.
    recorder.start(DATA_SLICE_MS);
    rotateTimer = window.setTimeout(() => enqueueRotate(), SEGMENT_MS);
    return true;
  }

  async function stopCurrentSegment({ save = true } = {}) {
    if (rotateTimer) window.clearTimeout(rotateTimer);
    rotateTimer = null;
    const recorder = currentRecorder;
    if (!recorder) return;

    await new Promise(resolve => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve();
      };
      recorder.addEventListener('stop', finish, { once: true });
      try {
        if (recorder.state === 'recording' && typeof recorder.requestData === 'function') recorder.requestData();
      } catch {}
      try {
        if (recorder.state !== 'inactive') recorder.stop();
        else finish();
      } catch {
        finish();
      }
      window.setTimeout(finish, 1800);
    });
    if (save) saveCurrentSegment();
    else {
      currentChunks = [];
      currentScore = 0;
      currentStartedAt = 0;
    }
    currentRecorder = null;
  }

  function enqueue(task) {
    operation = operation.then(task, task);
    return operation;
  }

  function enqueueRotate() {
    if (stopped) return operation;
    return enqueue(async () => {
      if (stopped) return;
      await stopCurrentSegment({ save: true });
      if (!stopped) startSegment();
    });
  }

  async function replaceStream(nextStream, nextFacing = '') {
    if (stopped || !nextStream) return;
    return enqueue(async () => {
      if (stopped) return;
      // Stop the old segment before switching so it remains a valid independent clip.
      await stopCurrentSegment({ save: true });
      currentStream = nextStream;
      currentFacing = normalizeFacing(nextFacing || facingForStream(nextStream, currentFacing), currentFacing);
      if (!stopped) startSegment();
    });
  }

  const handleCameraReplaced = event => {
    const nextVideoTrack = event?.detail?.track;
    if (stopped || !nextVideoTrack) return;
    const audioTracks = (currentStream?.getAudioTracks?.() || []).filter(track => track.readyState !== 'ended');
    const nextStream = new MediaStream([nextVideoTrack, ...audioTracks]);
    const nextFacing = event?.detail?.facingMode || nextVideoTrack.getSettings?.()?.facingMode || '';
    replaceStream(nextStream, nextFacing).catch(error => console.warn('Droxion highlight camera switch failed', error));
  };

  async function finalizeAndPublish() {
    await enqueue(async () => { await stopCurrentSegment({ save: true }); });

    const liveDurationMs = Math.max(0, Date.now() - liveStartedAt);
    const highlightCount = highlightCountForLiveDuration(liveDurationMs);
    const candidates = [...segments]
      .filter(segment => segment.durationSeconds >= MIN_CLIP_SECONDS && segment.blob?.size)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || a.sourceStartMs - b.sourceStartMs)
      .slice(0, highlightCount);

    const results = [];
    for (let index = 0; index < candidates.length; index += 1) {
      try {
        const result = await uploadSegment({ creatorId, sessionId, index, segment: candidates[index], title });
        if (result) results.push(result);
      } catch (error) {
        console.warn('Droxion highlight upload failed', error);
      }
    }
    return results;
  }

  if (typeof window !== 'undefined') window.addEventListener(CAMERA_REPLACED_EVENT, handleCameraReplaced);
  startSegment();

  return {
    markMoment(weight = 1) {
      currentScore += Math.max(0, Number(weight || 0));
    },

    replaceStream,

    async stopAndPublish() {
      if (stopped) return [];
      stopped = true;
      if (typeof window !== 'undefined') window.removeEventListener(CAMERA_REPLACED_EVENT, handleCameraReplaced);

      // Do not hold the creator on the LIVE screen while clips upload. The
      // recorder is flushed immediately and finalization/upload continues in
      // the background while the creator returns to Home/Feed.
      finalizeAndPublish().catch(error => console.warn('Droxion background highlight finalization failed', error));
      return [];
    }
  };
}
