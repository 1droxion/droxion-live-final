const MAX_EVENTS = 240;
const FRAME_REPORT_INTERVAL_MS = 1500;

function cleanString(value, max = 180) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function diagnosticStore() {
  if (typeof window === 'undefined') return null;
  const current = window.__droxionScreenDiagnostics;
  if (current?.version === 1 && Array.isArray(current.events) && current.latest) return current;
  const store = {
    version: 1,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: [],
    latest: {}
  };
  window.__droxionScreenDiagnostics = store;
  return store;
}

export function mediaTrackSnapshot(track) {
  const mediaTrack = track?.mediaStreamTrack || track || null;
  if (!mediaTrack) return null;
  let settings = {};
  try { settings = mediaTrack.getSettings?.() || {}; } catch {}
  return {
    id: cleanString(mediaTrack.id, 96),
    kind: cleanString(mediaTrack.kind, 24),
    label: cleanString(mediaTrack.label, 120),
    readyState: cleanString(mediaTrack.readyState, 24),
    enabled: mediaTrack.enabled !== false,
    muted: Boolean(mediaTrack.muted),
    width: finiteNumber(settings.width),
    height: finiteNumber(settings.height),
    frameRate: finiteNumber(settings.frameRate),
    displaySurface: cleanString(settings.displaySurface, 40)
  };
}

export function publicationSnapshot(publication) {
  if (!publication) return null;
  return {
    sid: cleanString(publication.trackSid || publication.sid, 96),
    name: cleanString(publication.trackName || publication.name || publication.track?.name, 160),
    source: cleanString(publication.source || publication.track?.source, 48),
    subscribed: publication.isSubscribed !== false,
    muted: Boolean(publication.isMuted)
  };
}

export function recordScreenShareDiagnostic(stage, detail = {}) {
  const store = diagnosticStore();
  const event = {
    at: new Date().toISOString(),
    timestamp: Date.now(),
    stage: cleanString(stage, 80),
    visibility: typeof document === 'undefined' ? '' : cleanString(document.visibilityState, 24),
    ...detail
  };
  if (store) {
    store.events.push(event);
    if (store.events.length > MAX_EVENTS) store.events.splice(0, store.events.length - MAX_EVENTS);
    store.latest[event.stage] = event;
    store.updatedAt = event.at;
  }
  try { window.dispatchEvent(new CustomEvent('droxion:screen-share-diagnostic', { detail: event })); } catch {}
  return event;
}

function decodedFrameCount(video, observedFrames) {
  let qualityFrames = 0;
  try { qualityFrames = finiteNumber(video?.getVideoPlaybackQuality?.()?.totalVideoFrames); } catch {}
  let webkitFrames = 0;
  try { webkitFrames = finiteNumber(video?.webkitDecodedFrameCount); } catch {}
  return Math.max(observedFrames, qualityFrames, webkitFrames);
}

export function startVideoFrameDiagnostics(video, {
  stage = 'screen-frames',
  track = null,
  publication = null
} = {}) {
  if (!video || typeof window === 'undefined') return () => {};

  let stopped = false;
  let callbackId = null;
  let observedFrames = 0;
  let previousFrames = 0;

  const report = () => {
    if (stopped) return;
    const frames = decodedFrameCount(video, observedFrames);
    const delta = Math.max(0, frames - previousFrames);
    previousFrames = frames;
    recordScreenShareDiagnostic(stage, {
      frames,
      delta,
      currentTime: finiteNumber(video.currentTime),
      videoReadyState: finiteNumber(video.readyState),
      paused: Boolean(video.paused),
      videoWidth: finiteNumber(video.videoWidth),
      videoHeight: finiteNumber(video.videoHeight),
      track: mediaTrackSnapshot(track),
      publication: publicationSnapshot(publication)
    });
  };

  if (typeof video.requestVideoFrameCallback === 'function') {
    const onFrame = () => {
      if (stopped) return;
      observedFrames += 1;
      callbackId = video.requestVideoFrameCallback(onFrame);
    };
    callbackId = video.requestVideoFrameCallback(onFrame);
  }

  const timer = window.setInterval(report, FRAME_REPORT_INTERVAL_MS);
  report();

  return () => {
    stopped = true;
    window.clearInterval(timer);
    if (callbackId != null && typeof video.cancelVideoFrameCallback === 'function') {
      try { video.cancelVideoFrameCallback(callbackId); } catch {}
    }
  };
}
