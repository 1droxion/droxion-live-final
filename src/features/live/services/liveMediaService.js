function videoConstraints(orientation, facingMode) {
  const portrait = orientation !== 'horizontal';
  return {
    facingMode: { ideal: facingMode === 'environment' ? 'environment' : 'user' },
    width: { ideal: portrait ? 720 : 1280 },
    height: { ideal: portrait ? 1280 : 720 },
    frameRate: { ideal: 30, max: 30 }
  };
}

const audioConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};

function mediaError(message, cause) {
  const error = new Error(message);
  if (cause?.name) error.name = cause.name;
  return error;
}

function normalizeMediaError(error, target = 'camera and microphone') {
  const name = String(error?.name || '');
  const message = String(error?.message || '');
  const lowerMessage = message.toLowerCase();
  const permissionBlocked =
    name === 'NotAllowedError'
    || name === 'PermissionDeniedError'
    || lowerMessage.includes('permission')
    || lowerMessage.includes('not allowed');

  if (permissionBlocked) {
    const blockedBySystem = lowerMessage.includes('system') || lowerMessage.includes('privacy');

    if (target === 'camera' && blockedBySystem) {
      return mediaError(
        'Windows is blocking camera access for Microsoft Edge. Open Windows Settings > Privacy & security > Camera, turn ON Camera access and Let desktop apps access your camera, then return to Droxion and tap Retry camera.',
        error
      );
    }

    if (target === 'microphone' && blockedBySystem) {
      return mediaError(
        'Windows is blocking microphone access. Camera preview can still work, but your LIVE will start without microphone audio until Windows microphone access is enabled.',
        error
      );
    }

    const label = target === 'camera' ? 'Camera' : target === 'microphone' ? 'Microphone' : 'Camera and microphone';
    return mediaError(
      `${label} access is blocked. Click the camera/lock icon in the browser address bar, allow it for Droxion, then tap Retry camera.`,
      error
    );
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return mediaError(
      `Droxion could not find a usable ${target}. Connect or enable the device, then tap Retry camera.`,
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
      `Your ${target} is busy in another app. Close the other camera/microphone app, then tap Retry camera.`,
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
      `${target} access was blocked for security. Open Droxion over HTTPS and allow this device for the site.`,
      error
    );
  }

  if (name === 'AbortError') {
    return mediaError(
      `${target} startup was interrupted. Close other camera/microphone apps and tap Retry camera.`,
      error
    );
  }

  return mediaError(
    message ? `Could not open ${target}: ${message}` : `Could not open ${target}. Check browser and Windows privacy permissions, then try again.`,
    error
  );
}

function hasLiveVideo(stream) {
  return Boolean(stream?.getVideoTracks?.().some(track => track.readyState === 'live'));
}

export function isUsableMediaStream(stream) {
  return hasLiveVideo(stream);
}

export async function requestBroadcastMedia({ orientation = 'vertical', facingMode = 'user' } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera and microphone are not available on this device or browser.');
  }

  let videoStream;
  try {
    // Ask for video separately. A blocked microphone should never prevent the
    // creator from seeing the camera preview or starting a silent LIVE.
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints(orientation, facingMode),
      audio: false
    });
  } catch (error) {
    throw normalizeMediaError(error, 'camera');
  }

  if (!hasLiveVideo(videoStream)) {
    stopMediaStream(videoStream);
    throw new Error('Droxion could not open the camera. Check Windows and browser camera permissions, then retry.');
  }

  let audioStream = null;
  let microphoneWarning = '';

  try {
    audioStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: audioConstraints
    });
  } catch (error) {
    microphoneWarning = normalizeMediaError(error, 'microphone').message;
  }

  const tracks = [
    ...videoStream.getVideoTracks(),
    ...(audioStream?.getAudioTracks?.() || [])
  ];
  const stream = new MediaStream(tracks);

  if (microphoneWarning) {
    try {
      Object.defineProperty(stream, '__droxionMediaWarning', {
        value: microphoneWarning,
        configurable: true
      });
      Object.defineProperty(stream, '__droxionMicrophoneBlocked', {
        value: true,
        configurable: true
      });
    } catch {}
  }

  return stream;
}

export function stopMediaStream(stream) {
  stream?.getTracks?.().forEach(track => {
    try { track.stop(); } catch {}
  });
}
