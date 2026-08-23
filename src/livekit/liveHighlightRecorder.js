import { supabase } from '../supabaseClient';

const TIMESLICE_MS = 5000;
const CLIP_SECONDS = 30;
const CLIP_CHUNKS = CLIP_SECONDS * 1000 / TIMESLICE_MS;
const MIN_CLIP_SECONDS = 15;

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const choices = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ];
  return choices.find(type => MediaRecorder.isTypeSupported?.(type)) || '';
}

function extensionFor(type) {
  return type.includes('mp4') ? 'mp4' : 'webm';
}

function buildCandidates(chunks) {
  if (!chunks.length) return [];
  const windowSize = Math.min(CLIP_CHUNKS, chunks.length);
  const candidates = [];
  for (let start = 0; start <= chunks.length - windowSize; start += 1) {
    const slice = chunks.slice(start, start + windowSize);
    const score = slice.reduce((sum, item) => sum + Number(item.score || 0), 0);
    candidates.push({ start, end: start + windowSize - 1, score, slice });
  }
  if (!candidates.length) candidates.push({ start: 0, end: chunks.length - 1, score: 0, slice: chunks });
  candidates.sort((a, b) => b.score - a.score || a.start - b.start);

  const picked = [];
  for (const candidate of candidates) {
    if (picked.length >= 2) break;
    const overlaps = picked.some(item => !(candidate.end < item.start - 1 || candidate.start > item.end + 1));
    if (!overlaps) picked.push(candidate);
  }
  if (picked.length < 2 && chunks.length >= Math.ceil(MIN_CLIP_SECONDS * 1000 / TIMESLICE_MS) * 2) {
    const half = Math.floor(chunks.length / 2);
    const fallback = [
      { start: 0, end: Math.min(windowSize - 1, half - 1), slice: chunks.slice(0, Math.min(windowSize, half)), score: 0 },
      { start: half, end: chunks.length - 1, slice: chunks.slice(half, Math.min(chunks.length, half + windowSize)), score: 0 }
    ];
    fallback.forEach(candidate => {
      if (picked.length < 2 && candidate.slice.length >= 3) picked.push(candidate);
    });
  }
  return picked.slice(0, 2);
}

async function uploadCandidate({ creatorId, sessionId, index, candidate, mimeType, title }) {
  const durationSeconds = Math.max(MIN_CLIP_SECONDS, Math.min(45, candidate.slice.length * TIMESLICE_MS / 1000));
  if (candidate.slice.length < Math.ceil(MIN_CLIP_SECONDS * 1000 / TIMESLICE_MS)) return null;
  const blob = new Blob(candidate.slice.map(item => item.blob), { type: mimeType || 'video/webm' });
  if (!blob.size) return null;

  const ext = extensionFor(mimeType || 'video/webm');
  const path = `${creatorId}/${sessionId}/auto-${index + 1}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('droxion-live-clips').upload(path, blob, {
    contentType: mimeType || 'video/webm',
    cacheControl: '31536000',
    upsert: false
  });
  if (uploadError) throw uploadError;

  const sourceStartMs = candidate.start * TIMESLICE_MS;
  const sourceEndMs = sourceStartMs + durationSeconds * 1000;
  const { data, error } = await supabase.rpc('droxion_publish_live_clip', {
    p_session_id: sessionId,
    p_storage_path: path,
    p_caption: title ? `From LIVE · ${title}` : 'From LIVE on Droxion',
    p_duration_seconds: Math.round(durationSeconds),
    p_highlight_score: Number(candidate.score || 0),
    p_source_start_ms: sourceStartMs,
    p_source_end_ms: sourceEndMs
  });
  if (error) {
    await supabase.storage.from('droxion-live-clips').remove([path]).catch(() => {});
    throw error;
  }
  return data;
}

export function createLiveHighlightRecorder({ creatorId, sessionId, stream, title = '' }) {
  if (!creatorId || !sessionId || !stream || typeof MediaRecorder === 'undefined') return null;
  const mimeType = pickMimeType();
  let recorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 }) : new MediaRecorder(stream);
  } catch {
    try { recorder = new MediaRecorder(stream); } catch { return null; }
  }

  const chunks = [];
  let pendingScore = 0;
  let startedAt = Date.now();
  let stopped = false;

  recorder.ondataavailable = event => {
    if (!event.data?.size) return;
    chunks.push({ blob: event.data, score: pendingScore, at: Date.now() });
    pendingScore = 0;
    // Keep at most the last 30 minutes in memory on the client.
    const maxChunks = 30 * 60 * 1000 / TIMESLICE_MS;
    if (chunks.length > maxChunks) chunks.splice(0, chunks.length - maxChunks);
  };

  recorder.start(TIMESLICE_MS);

  return {
    markMoment(weight = 1) {
      pendingScore += Math.max(0, Number(weight || 0));
    },
    async stopAndPublish() {
      if (stopped) return [];
      stopped = true;
      await new Promise(resolve => {
        const finish = () => resolve();
        recorder.addEventListener('stop', finish, { once: true });
        try { recorder.requestData(); } catch {}
        try { recorder.stop(); } catch { resolve(); }
        window.setTimeout(resolve, 1500);
      });

      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      if (elapsedSeconds < MIN_CLIP_SECONDS || chunks.length < 3) return [];
      const candidates = buildCandidates(chunks);
      const results = [];
      for (let index = 0; index < candidates.length; index += 1) {
        try {
          const result = await uploadCandidate({ creatorId, sessionId, index, candidate: candidates[index], mimeType: recorder.mimeType || mimeType, title });
          if (result) results.push(result);
        } catch (error) {
          console.warn('Droxion highlight upload failed', error);
        }
      }
      return results;
    }
  };
}
