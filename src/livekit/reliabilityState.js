export async function retryLiveReconnect({
  delays,
  wait,
  shouldAbort,
  attempt,
  onFailure,
  shouldStop
}) {
  let lastError = null;
  for (const delay of delays) {
    if (shouldAbort()) return { aborted: true };
    await wait(delay);
    if (shouldAbort()) return { aborted: true };

    try {
      return { aborted: false, value: await attempt() };
    } catch (error) {
      lastError = error;
      await onFailure(error);
      if (shouldStop(error)) break;
    }
  }

  throw lastError || new Error('LIVE reconnect failed.');
}

export function captureLiveReadSubscriptionState(stream, queue) {
  return {
    generation: stream.generation,
    ready: stream.ready,
    reconcile: stream.reconcile[queue],
  };
}

export function canCompleteLiveReadReconciliation(stream, snapshot) {
  return Boolean(
    snapshot.ready
    && snapshot.reconcile
    && stream.generation === snapshot.generation
    && stream.ready
  );
}

export function applyMediaEnabledState(mediaStream, { cameraOn, micOn }) {
  mediaStream?.getVideoTracks?.().forEach(track => { track.enabled = Boolean(cameraOn); });
  mediaStream?.getAudioTracks?.().forEach(track => { track.enabled = Boolean(micOn); });
  return mediaStream;
}

export function stableLiveEventId(row) {
  const id = row?.id ?? row?.gift_id ?? row?.chat_id;
  return id == null || id === '' ? null : String(id);
}

export function mergeStableLiveEvents(current, incoming, limit = 200) {
  const merged = new Map();
  for (const row of [...(current || []), ...(incoming || [])]) {
    const id = stableLiveEventId(row);
    if (id) merged.set(id, row);
  }
  return Array.from(merged.values()).slice(-limit);
}

export function liveGiftReconciliationCursor(value, overlapMs = 5000) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? new Date(timestamp - overlapMs).toISOString() : value;
}

export function microphoneStateMatches({ browserTracks, publications, muted }) {
  const liveBrowserTracks = (browserTracks || []).filter(track => track?.readyState !== 'ended');
  const livePublications = (publications || []).filter(publication => publication?.track?.mediaStreamTrack?.readyState !== 'ended');
  const browserMatches = liveBrowserTracks.every(track => track.enabled === !muted);
  if (muted && livePublications.length === 0) return browserMatches;
  return browserMatches
    && livePublications.length === 1
    && Boolean(livePublications[0].isMuted) === Boolean(muted);
}
