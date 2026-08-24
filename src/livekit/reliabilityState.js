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
