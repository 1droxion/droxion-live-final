import { supabase } from '../../../supabaseClient';

const PORN_BLOCK_THRESHOLD = 0.985;
const REQUIRED_CONSECUTIVE_HITS = 2;
const DESKTOP_SAMPLE_MS = 5000;
const MOBILE_SAMPLE_MS = 7000;
const MODEL_START_DELAY_MS = 2500;

function isPhoneLike() {
  if (typeof navigator === 'undefined') return false;
  try {
    const platform = window.Capacitor?.getPlatform?.();
    if (platform === 'ios' || platform === 'android') return true;
  } catch {}
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function videoForTrack(track) {
  const video = document.createElement('video');
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.srcObject = new MediaStream([track]);
  video.play().catch(() => {});
  return video;
}

function stopVideo(video) {
  if (!video) return;
  try { video.pause(); } catch {}
  try { video.srcObject = null; } catch {}
}

function pornProbability(predictions) {
  const porn = (predictions || []).find(item => String(item?.className || '').toLowerCase() === 'porn');
  return Math.max(0, Math.min(1, Number(porn?.probability || 0)));
}

/**
 * Creator-only explicit-content safety sidecar.
 *
 * - It never changes or republishes LiveKit tracks.
 * - It never runs for viewers.
 * - Frames stay on-device; only a confidence number is sent to Droxion after
 *   repeated very-high-confidence explicit pornography detections.
 * - The NSFWJS "Sexy" class is deliberately ignored so normal skin, swimwear,
 *   fitness, fashion, etc. do not terminate a LIVE by themselves.
 */
export function createExplicitLiveContentGuard({ sessionId, stream, onBlocked } = {}) {
  if (!sessionId || !stream || typeof document === 'undefined') return null;

  const videos = (stream.getVideoTracks?.() || [])
    .filter(track => track?.readyState !== 'ended')
    .map(videoForTrack);
  if (!videos.length) return null;

  let stopped = false;
  let blocked = false;
  let model = null;
  let timer = null;
  let consecutiveHits = 0;
  let highestConfidence = 0;

  const intervalMs = isPhoneLike() ? MOBILE_SAMPLE_MS : DESKTOP_SAMPLE_MS;

  function schedule(delay = intervalMs) {
    if (stopped || blocked) return;
    timer = window.setTimeout(() => {
      timer = null;
      check().catch(error => {
        console.warn('Droxion explicit-content safety check failed', error);
        schedule();
      });
    }, delay);
  }

  async function reportAndBlock(confidence) {
    if (stopped || blocked) return;
    const { data, error } = await supabase.rpc('droxion_block_my_live_for_explicit_content', {
      p_session_id: sessionId,
      p_confidence: confidence,
    });
    if (error || data?.blocked !== true) {
      console.warn('Droxion explicit-content block could not be confirmed', error || data);
      consecutiveHits = 0;
      schedule();
      return;
    }

    blocked = true;
    try {
      await onBlocked?.({
        reason: 'explicit_nudity',
        confidence,
        sessionId,
      });
    } catch (error) {
      console.warn('Droxion explicit-content LIVE shutdown callback failed', error);
    }
  }

  async function check() {
    if (stopped || blocked || !model) return;

    let hitThisRound = false;
    let roundConfidence = 0;
    for (const video of videos) {
      if (stopped || blocked) return;
      if (video.readyState < 2 || video.videoWidth < 2 || video.videoHeight < 2) continue;
      const predictions = await model.classify(video, 5);
      const confidence = pornProbability(predictions);
      roundConfidence = Math.max(roundConfidence, confidence);
      if (confidence >= PORN_BLOCK_THRESHOLD) hitThisRound = true;
    }

    highestConfidence = Math.max(highestConfidence, roundConfidence);
    consecutiveHits = hitThisRound ? consecutiveHits + 1 : 0;

    if (consecutiveHits >= REQUIRED_CONSECUTIVE_HITS) {
      await reportAndBlock(Math.max(highestConfidence, roundConfidence));
      return;
    }
    schedule();
  }

  (async () => {
    try {
      // Dynamic import keeps this several-MB ML model out of the initial app
      // startup path. Only an active creator LIVE pays the model load cost.
      const nsfwjs = await import('nsfwjs');
      if (stopped) return;
      model = await nsfwjs.load('MobileNetV2');
      if (stopped) {
        try { model?.dispose?.(); } catch {}
        return;
      }
      schedule(MODEL_START_DELAY_MS);
    } catch (error) {
      console.warn('Droxion explicit-content model could not load', error);
    }
  })();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer) window.clearTimeout(timer);
      timer = null;
      videos.forEach(stopVideo);
      try { model?.dispose?.(); } catch {}
      model = null;
    },
    isBlocked() {
      return blocked;
    },
  };
}
