export const LIVE_SOURCE_MODE = Object.freeze({
  CAMERA: 'camera',
  SCREEN: 'screen',
  SCREEN_CAMERA: 'screen_camera'
});

export const LIVE_STUDIO_LAYOUTS = Object.freeze([
  { id: 'free_facecam', label: 'Custom facecam', orientations: ['horizontal'] },
  { id: 'split_70_30', label: '70 / 30 split', orientations: ['vertical'] },
  { id: 'split_50_50', label: '50 / 50 split', orientations: ['vertical'] }
]);

export const DEFAULT_FACECAM_POSITION = Object.freeze({ x: 0.735, y: 0.64, size: 0.235 });
const MIN_FACECAM_SIZE = 0.16;
const MAX_FACECAM_SIZE = 0.38;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function studioLayoutsForOrientation(orientation = 'horizontal') {
  return LIVE_STUDIO_LAYOUTS.filter(item => item.orientations.includes(orientation));
}

export function defaultStudioLayout(orientation = 'horizontal') {
  return orientation === 'vertical' ? 'split_70_30' : 'free_facecam';
}

export function normalizeFacecamPosition(position = DEFAULT_FACECAM_POSITION) {
  const size = clamp(position?.size ?? DEFAULT_FACECAM_POSITION.size, MIN_FACECAM_SIZE, MAX_FACECAM_SIZE);
  const x = clamp(position?.x ?? DEFAULT_FACECAM_POSITION.x, 0.012, Math.max(0.012, 0.988 - size));
  const approximateHeight = size * 0.75;
  const y = clamp(position?.y ?? DEFAULT_FACECAM_POSITION.y, 0.018, Math.max(0.018, 0.982 - approximateHeight));
  return { x, y, size };
}

function normalizeLayout(layout, orientation) {
  const allowed = studioLayoutsForOrientation(orientation);
  return allowed.some(item => item.id === layout) ? layout : defaultStudioLayout(orientation);
}

function cameraConstraints(orientation, facingMode) {
  const portrait = orientation !== 'horizontal';
  return {
    facingMode: { ideal: facingMode === 'environment' ? 'environment' : 'user' },
    width: { ideal: portrait ? 720 : 1280 },
    height: { ideal: portrait ? 1280 : 720 },
    frameRate: { ideal: 30, max: 30 }
  };
}

function microphoneConstraints() {
  return { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
}

export function supportsDisplayCapture() {
  return Boolean(typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia);
}

function stopStream(stream) {
  stream?.getTracks?.().forEach(track => { try { track.stop(); } catch {} });
}

async function createMixedAudioTrack(micStream, screenStream) {
  const micTrack = micStream?.getAudioTracks?.()[0] || null;
  const screenTrack = screenStream?.getAudioTracks?.()[0] || null;
  if (!micTrack) throw new Error('Microphone is required for LIVE.');
  if (!screenTrack) return { track: micTrack, context: null };

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return { track: micTrack, context: null };

  let context;
  try { context = new AudioContextCtor({ latencyHint: 'interactive' }); }
  catch { context = new AudioContextCtor(); }
  try { if (context.state !== 'running') await context.resume(); } catch {}
  const destination = context.createMediaStreamDestination();

  const add = (track, gainValue) => {
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const gain = context.createGain();
    gain.gain.value = gainValue;
    source.connect(gain);
    gain.connect(destination);
  };

  add(micTrack, 1);
  add(screenTrack, 0.82);
  const mixedTrack = destination.stream.getAudioTracks()[0];
  if (!mixedTrack) {
    try { await context.close(); } catch {}
    return { track: micTrack, context: null };
  }
  return { track: mixedTrack, context };
}

export async function createLiveStudioStream({
  mode = LIVE_SOURCE_MODE.SCREEN,
  layout,
  orientation = 'horizontal',
  facingMode = 'user',
  facecamPosition = DEFAULT_FACECAM_POSITION,
  onScreenEnded
} = {}) {
  if (!supportsDisplayCapture()) {
    throw new Error('Screen/Game sharing is available on supported desktop browsers. Mobile screen broadcast will use the native broadcaster.');
  }
  if (![LIVE_SOURCE_MODE.SCREEN, LIVE_SOURCE_MODE.SCREEN_CAMERA].includes(mode)) {
    throw new Error('Invalid LIVE Studio source.');
  }

  let screenStream = null;
  let micStream = null;
  let cameraStream = null;
  let outputStream = null;
  let audioContext = null;
  let disposed = false;
  let currentLayout = normalizeLayout(layout, orientation);
  let currentFacecam = normalizeFacecamPosition(facecamPosition);
  let currentFacing = facingMode === 'environment' ? 'environment' : 'user';
  let cameraVisible = mode === LIVE_SOURCE_MODE.SCREEN_CAMERA;

  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 60, max: 60 },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: true,
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
      systemAudio: 'include',
      monitorTypeSurfaces: 'include'
    });

    const screenTrack = screenStream.getVideoTracks()[0];
    if (!screenTrack) throw new Error('No screen or game window was selected.');
    const displaySurface = String(screenTrack.getSettings?.().displaySurface || '').toLowerCase();
    if (displaySurface === 'browser') {
      stopStream(screenStream);
      throw new Error('Choose Entire Screen or a Window, not a browser tab. A shared tab stays on that one tab when you switch apps.');
    }
    try { screenTrack.contentHint = 'motion'; } catch {}
    try { screenTrack.__droxionSource = 'screen'; } catch {}

    micStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: microphoneConstraints() });
    const mixedAudio = await createMixedAudioTrack(micStream, screenStream);
    audioContext = mixedAudio.context;
    try { mixedAudio.track.__droxionSource = 'audio'; } catch {}

    const tracks = [screenTrack];
    if (mode === LIVE_SOURCE_MODE.SCREEN_CAMERA) {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: cameraConstraints(orientation, currentFacing),
        audio: false
      });
      const cameraTrack = cameraStream.getVideoTracks()[0];
      if (!cameraTrack) throw new Error('Facecam could not be opened.');
      try { cameraTrack.contentHint = 'motion'; } catch {}
      try { cameraTrack.__droxionSource = 'camera'; } catch {}
      tracks.push(cameraTrack);
    }
    tracks.push(mixedAudio.track);
    outputStream = new MediaStream(tracks);

    const studioMeta = {
      mode,
      orientation,
      displaySurface,
      layout: currentLayout,
      facecamPosition: { ...currentFacecam }
    };
    try { outputStream.__droxionStudio = studioMeta; } catch {}

    screenTrack.addEventListener('ended', () => {
      if (disposed) return;
      try { onScreenEnded?.(); } catch {}
    }, { once: true });

    return {
      stream: outputStream,
      mode,
      orientation,
      displaySurface,
      getLayout: () => currentLayout,
      setLayout: nextLayout => {
        currentLayout = normalizeLayout(nextLayout, orientation);
        studioMeta.layout = currentLayout;
        return currentLayout;
      },
      getFacecamPosition: () => ({ ...currentFacecam }),
      setFacecamPosition: next => {
        if (orientation !== 'horizontal') return { ...currentFacecam };
        currentFacecam = normalizeFacecamPosition({ ...currentFacecam, ...(next || {}) });
        studioMeta.facecamPosition = { ...currentFacecam };
        return { ...currentFacecam };
      },
      setCameraVisible: visible => {
        cameraVisible = mode === LIVE_SOURCE_MODE.SCREEN_CAMERA && Boolean(visible);
        const track = cameraStream?.getVideoTracks?.()[0];
        if (track) track.enabled = cameraVisible;
        return cameraVisible;
      },
      getCameraVisible: () => cameraVisible,
      switchCameraFacing: async nextFacing => {
        if (mode !== LIVE_SOURCE_MODE.SCREEN_CAMERA) throw new Error('Facecam is not active for this LIVE source.');
        const normalized = nextFacing === 'environment' ? 'environment' : 'user';
        const replacementStream = await navigator.mediaDevices.getUserMedia({
          video: cameraConstraints(orientation, normalized),
          audio: false
        });
        const replacementTrack = replacementStream.getVideoTracks()[0];
        if (!replacementTrack) {
          stopStream(replacementStream);
          throw new Error('Could not switch facecam.');
        }
        try { replacementTrack.contentHint = 'motion'; } catch {}
        try { replacementTrack.__droxionSource = 'camera'; } catch {}
        const oldTrack = cameraStream?.getVideoTracks?.()[0] || null;
        if (oldTrack && outputStream.getTracks().includes(oldTrack)) outputStream.removeTrack(oldTrack);
        outputStream.addTrack(replacementTrack);
        stopStream(cameraStream);
        cameraStream = replacementStream;
        currentFacing = normalized;
        return currentFacing;
      },
      stop: () => {
        if (disposed) return;
        disposed = true;
        stopStream(outputStream);
        stopStream(screenStream);
        stopStream(micStream);
        stopStream(cameraStream);
        if (audioContext) Promise.resolve(audioContext.close?.()).catch(() => {});
      }
    };
  } catch (error) {
    disposed = true;
    stopStream(outputStream);
    stopStream(screenStream);
    stopStream(micStream);
    stopStream(cameraStream);
    if (audioContext) Promise.resolve(audioContext.close?.()).catch(() => {});
    throw error;
  }
}
