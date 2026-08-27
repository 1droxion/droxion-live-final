function videoConstraints(orientation, facingMode) {
  const portrait = orientation !== 'horizontal';
  return {
    facingMode: { ideal: facingMode === 'environment' ? 'environment' : 'user' },
    width: { ideal: portrait ? 720 : 1280 },
    height: { ideal: portrait ? 1280 : 720 },
    frameRate: { ideal: 30, max: 30 }
  };
}

export function isUsableMediaStream(stream) {
  if (!stream) return false;
  return stream.getVideoTracks().some(track => track.readyState === 'live')
    && stream.getAudioTracks().some(track => track.readyState === 'live');
}

export async function requestBroadcastMedia({ orientation = 'vertical', facingMode = 'user' } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera and microphone are not available on this device.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: videoConstraints(orientation, facingMode),
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  if (!isUsableMediaStream(stream)) {
    stopMediaStream(stream);
    throw new Error('Droxion could not open both camera and microphone.');
  }

  return stream;
}

export function stopMediaStream(stream) {
  stream?.getTracks?.().forEach(track => {
    try { track.stop(); } catch {}
  });
}
