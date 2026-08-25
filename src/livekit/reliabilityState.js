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

export function liveSafetyReconcileDelay(
  attempt,
  { baseMs = 60000, maxMs = 300000, jitterRatio = 0.2, random = Math.random } = {}
) {
  const exponential = Math.min(maxMs, baseMs * (2 ** Math.max(0, Number(attempt) || 0)));
  const jitter = Math.max(0, Math.min(1, jitterRatio));
  const factor = (1 - jitter) + (2 * jitter * Math.max(0, Math.min(1, random())));
  return Math.round(exponential * factor);
}

export function markLiveQueueForReconciliation(stream, queue, now = Date.now()) {
  if (!stream?.reconcile || !stream?.nextAuthoritativeAt) return stream;
  stream.reconcile[queue] = true;
  stream.nextAuthoritativeAt[queue] = now;
  stream.safetyAttempt[queue] = 0;
  return stream;
}

export function liveQueueNeedsAuthoritativeRead(stream, queue, now = Date.now()) {
  if (!stream) return true;
  return now >= Number(stream.nextAuthoritativeAt?.[queue] || 0);
}

export function canDecorateLiveRoom(room) {
  return Boolean(room?.isConnected && room?.matches?.('.liveRoomV4'));
}

export function shouldEnterGuestMode({ requestId, status, guestMode, voluntarilyExitedRequestId }) {
  return status === 'accepted'
    && !guestMode
    && String(requestId || '') !== String(voluntarilyExitedRequestId || '');
}

export function liveFeedWindow(rows, visibleCount) {
  return (rows || []).slice(0, Math.max(0, Number(visibleCount) || 0));
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
