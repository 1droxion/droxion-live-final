function videoConstraints(orientation, facingMode) {
  const portrait = orientation !== 'horizontal';
  return {
    facingMode: { ideal: facingMode === 'environment' ? 'environment' : 'user' },
    width: { ideal: portrait ? 720 : 1280 },
    height: { ideal: portrait ? 1280 : 720 },
    frameRate: { ideal: 30, max: 30 }
  };
}

function mediaError(message, cause) {
  const error = new Error(message);
  if (cause?.name) error.name = cause.name;
  return error;
}

function normalizeMediaError(error) {
  const name = String(error?.name || '');
  const message = String(error?.message || '');
  const lowerMessage = message.toLowerCase();

  if (
    name === 'NotAllowedError'
    || name === 'PermissionDeniedError'
    || lowerMessage.includes('permission denied')
    || lowerMessage.includes('permission dismissed')
    || lowerMessage.includes('not allowed')
  ) {
    return mediaError(
      'Camera and microphone access is blocked. Click the lock/camera icon in the browser address bar, allow Camera + Microphone for Droxion, then reload this page and tap Retry camera.',
      error
    );
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return mediaError(
      'Droxion could not find both a camera and microphone. Connect or enable them, then tap Retry camera.',
      error
    );
  }

  if (
    name === 'NotReadableError'
    || name === 'TrackStartError'
    || lowerMessage.includes('could not start video source')
    || lowerMessage.includes('device in use')
  ) {
    return mediaError(
      'Your camera or microphone is busy in another app. Close the other camera/microphone app, then tap Retry camera.',
      error
    );
  }

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return mediaError(
      'This camera could not use the requested LIVE quality. Try another camera or reload and retry.',
      error
    );
  }

  if (name === 'SecurityError') {
    return mediaError(
      'The browser blocked camera access for security. Open Droxion over HTTPS and allow Camera + Microphone for this site.',
      error
    );
  }

  if (name === 'AbortError') {
    return mediaError(
      'Camera or microphone startup was interrupted. Close other camera apps and tap Retry camera.',
      error
    );
  }

  return mediaError(
    message ? `Could not open camera and microphone: ${message}` : 'Could not open camera and microphone. Check browser permissions and try again.',
    error
  );
}

export function isUsableMediaStream(stream) {
  if (!stream) return false;
  return stream.getVideoTracks().some(track => track.readyState === 'live')
    && stream.getAudioTracks().some(track => track.readyState === 'live');
}

export async function requestBroadcastMedia({ orientation = 'vertical', facingMode = 'user' } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera and microphone are not available on this device or browser.');
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints(orientation, facingMode),
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  } catch (error) {
    throw normalizeMediaError(error);
  }

  if (!isUsableMediaStream(stream)) {
    stopMediaStream(stream);
    throw new Error('Droxion could not open both camera and microphone. Check that both devices are enabled, then retry.');
  }

  return stream;
}

export function stopMediaStream(stream) {
  stream?.getTracks?.().forEach(track => {
    try { track.stop(); } catch {}
  });
}
