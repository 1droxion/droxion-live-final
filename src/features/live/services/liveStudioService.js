const GAME_FRAME_RATE = 60;
const FALLBACK_FRAME_MS = 1000 / GAME_FRAME_RATE;

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

const DEFAULT_FACECAM = Object.freeze({ x: 0.735, y: 0.64, size: 0.235 });
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
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  };
}

function outputSize(orientation) {
  return orientation === 'horizontal'
    ? { width: 1280, height: 720 }
    : { width: 720, height: 1280 };
}

export function supportsDisplayCapture() {
  return Boolean(typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia && typeof document !== 'undefined');
}

function stopStream(stream) {
  stream?.getTracks?.().forEach(track => {
    try { track.stop(); } catch {}
  });
}

function createVideoElement(stream) {
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  // Keep the live source technically visible so Chromium does not aggressively
  // deprioritize an off-screen/zero-size video while the creator is playing a game.
  video.style.position = 'fixed';
  video.style.width = '2px';
  video.style.height = '2px';
  video.style.opacity = '0.001';
  video.style.pointerEvents = 'none';
  video.style.left = '0';
  video.style.top = '0';
  video.style.zIndex = '-1';
  document.body.appendChild(video);
  Promise.resolve(video.play?.()).catch(() => {});
  return video;
}

function destroyVideoElement(video) {
  if (!video) return;
  try { video.pause?.(); } catch {}
  try { video.srcObject = null; } catch {}
  try { video.remove(); } catch {}
}

function drawContain(context, video, rect) {
  const sourceWidth = Number(video?.videoWidth || 0);
  const sourceHeight = Number(video?.videoHeight || 0);
  if (!sourceWidth || !sourceHeight || !rect?.width || !rect?.height) return;
  const scale = Math.min(rect.width / sourceWidth, rect.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const x = rect.x + (rect.width - width) / 2;
  const y = rect.y + (rect.height - height) / 2;
  context.drawImage(video, x, y, width, height);
}

function drawCover(context, video, rect) {
  const sourceWidth = Number(video?.videoWidth || 0);
  const sourceHeight = Number(video?.videoHeight || 0);
  if (!sourceWidth || !sourceHeight || !rect?.width || !rect?.height) return;
  const scale = Math.max(rect.width / sourceWidth, rect.height / sourceHeight);
  const cropWidth = rect.width / scale;
  const cropHeight = rect.height / scale;
  const sx = (sourceWidth - cropWidth) / 2;
  const sy = (sourceHeight - cropHeight) / 2;
  context.drawImage(video, sx, sy, cropWidth, cropHeight, rect.x, rect.y, rect.width, rect.height);
}

function roundedRect(context, rect, radius) {
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));
  context.beginPath();
  context.moveTo(rect.x + r, rect.y);
  context.arcTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height, r);
  context.arcTo(rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height, r);
  context.arcTo(rect.x, rect.y + rect.height, rect.x, rect.y, r);
  context.arcTo(rect.x, rect.y, rect.x + rect.width, rect.y, r);
  context.closePath();
}

export function normalizeFacecamPosition(position = DEFAULT_FACECAM, width = 1280, height = 720) {
  const size = clamp(position?.size ?? DEFAULT_FACECAM.size, MIN_FACECAM_SIZE, MAX_FACECAM_SIZE);
  const normalizedHeight = size * (width / height) * 0.75;
  const x = clamp(position?.x ?? DEFAULT_FACECAM.x, 0.012, Math.max(0.012, 0.988 - size));
  const y = clamp(position?.y ?? DEFAULT_FACECAM.y, 0.018, Math.max(0.018, 0.982 - normalizedHeight));
  return { x, y, size };
}

export function getStudioLayoutRects(layout, width, height, facecamPosition = DEFAULT_FACECAM) {
  const horizontal = width >= height;

  if (!horizontal && layout === 'split_50_50') {
    const half = Math.round(height / 2);
    return {
      screen: { x: 0, y: 0, width, height: half },
      camera: { x: 0, y: half, width, height: height - half },
      style: 'split'
    };
  }

  if (!horizontal) {
    const screenHeight = Math.round(height * 0.7);
    return {
      screen: { x: 0, y: 0, width, height: screenHeight },
      camera: { x: 0, y: screenHeight, width, height: height - screenHeight },
      style: 'split'
    };
  }

  const normalized = normalizeFacecamPosition(facecamPosition, width, height);
  const cameraWidth = Math.round(width * normalized.size);
  const cameraHeight = Math.round(cameraWidth * 0.75);
  return {
    screen: { x: 0, y: 0, width, height },
    camera: {
      x: Math.round(width * normalized.x),
      y: Math.round(height * normalized.y),
      width: cameraWidth,
      height: cameraHeight
    },
    style: 'pip'
  };
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

  const connectTrack = (track, gainValue) => {
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const gain = context.createGain();
    gain.gain.value = gainValue;
    source.connect(gain);
    gain.connect(destination);
  };

  connectTrack(micTrack, 1);
  connectTrack(screenTrack, 0.82);
  const mixedTrack = destination.stream.getAudioTracks()[0];
  if (!mixedTrack) {
    try { await context.close(); } catch {}
    return { track: micTrack, context: null };
  }
  return { track: mixedTrack, context };
}

function startFrameDrivenPainter({ screenVideo, cameraVideo, paint }) {
  let disposed = false;
  let screenCallback = 0;
  let cameraCallback = 0;
  let fallbackTimer = 0;
  let lastPaintAt = 0;

  const paintLimited = () => {
    if (disposed) return;
    const now = performance.now();
    if (now - lastPaintAt < 12) return;
    lastPaintAt = now;
    paint();
  };

  const scheduleVideo = (video, kind) => {
    if (!video || typeof video.requestVideoFrameCallback !== 'function') return false;
    const run = () => {
      if (disposed) return;
      paintLimited();
      const id = video.requestVideoFrameCallback(run);
      if (kind === 'screen') screenCallback = id;
      else cameraCallback = id;
    };
    const id = video.requestVideoFrameCallback(run);
    if (kind === 'screen') screenCallback = id;
    else cameraCallback = id;
    return true;
  };

  const screenDriven = scheduleVideo(screenVideo, 'screen');
  const cameraDriven = scheduleVideo(cameraVideo, 'camera');
  if (!screenDriven && !cameraDriven) {
    const loop = () => {
      if (disposed) return;
      paint();
      fallbackTimer = window.setTimeout(loop, FALLBACK_FRAME_MS);
    };
    loop();
  } else {
    paint();
  }

  return () => {
    disposed = true;
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    try { if (screenCallback) screenVideo?.cancelVideoFrameCallback?.(screenCallback); } catch {}
    try { if (cameraCallback) cameraVideo?.cancelVideoFrameCallback?.(cameraCallback); } catch {}
  };
}

export async function createLiveStudioStream({
  mode = LIVE_SOURCE_MODE.SCREEN,
  layout,
  orientation = 'horizontal',
  facingMode = 'user',
  facecamPosition = DEFAULT_FACECAM,
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
  let screenVideo = null;
  let cameraVideo = null;
  let audioContext = null;
  let stopPainter = null;
  let disposed = false;
  let currentLayout = normalizeLayout(layout, orientation);
  let currentFacecam = normalizeFacecamPosition(facecamPosition);
  let cameraVisible = mode === LIVE_SOURCE_MODE.SCREEN_CAMERA;
  let currentFacing = facingMode === 'environment' ? 'environment' : 'user';

  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: GAME_FRAME_RATE, max: GAME_FRAME_RATE },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: true,
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
      systemAudio: 'include'
    });

    const sourceVideoTrack = screenStream.getVideoTracks()[0];
    if (!sourceVideoTrack) throw new Error('No screen or game window was selected.');
    try { sourceVideoTrack.contentHint = 'motion'; } catch {}

    micStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: microphoneConstraints() });
    const mixedAudio = await createMixedAudioTrack(micStream, screenStream);
    audioContext = mixedAudio.context;

    // Screen-only LIVE publishes the browser's native display-capture track
    // directly. There is no canvas/render loop in this path, so a game keeps
    // moving even while the Droxion tab is in the background.
    if (mode === LIVE_SOURCE_MODE.SCREEN) {
      outputStream = new MediaStream([sourceVideoTrack, mixedAudio.track]);
    } else {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: cameraConstraints(orientation, currentFacing),
        audio: false
      });
      screenVideo = createVideoElement(screenStream);
      cameraVideo = createVideoElement(cameraStream);

      const canvas = document.createElement('canvas');
      const size = outputSize(orientation);
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
      if (!context || typeof canvas.captureStream !== 'function') {
        throw new Error('This browser cannot create a LIVE facecam layout.');
      }

      const paint = () => {
        if (disposed) return;
        context.fillStyle = '#050508';
        context.fillRect(0, 0, canvas.width, canvas.height);
        const rects = getStudioLayoutRects(currentLayout, canvas.width, canvas.height, currentFacecam);
        if (rects.style === 'split') {
          context.fillStyle = '#08080d';
          context.fillRect(rects.screen.x, rects.screen.y, rects.screen.width, rects.screen.height);
          drawContain(context, screenVideo, rects.screen);
          if (cameraVisible) drawCover(context, cameraVideo, rects.camera);
        } else {
          drawContain(context, screenVideo, rects.screen);
          if (cameraVisible) {
            const radius = Math.round(Math.min(rects.camera.width, rects.camera.height) * 0.08);
            context.save();
            roundedRect(context, rects.camera, radius);
            context.clip();
            drawCover(context, cameraVideo, rects.camera);
            context.restore();
            context.lineWidth = Math.max(3, Math.round(canvas.width * 0.0035));
            context.strokeStyle = 'rgba(255,255,255,.94)';
            roundedRect(context, rects.camera, radius);
            context.stroke();
          }
        }
      };

      stopPainter = startFrameDrivenPainter({ screenVideo, cameraVideo, paint });
      const canvasStream = canvas.captureStream(GAME_FRAME_RATE);
      const composedVideoTrack = canvasStream.getVideoTracks()[0];
      if (!composedVideoTrack) throw new Error('Droxion could not capture the LIVE Studio layout.');
      try { composedVideoTrack.contentHint = 'motion'; } catch {}
      outputStream = new MediaStream([composedVideoTrack, mixedAudio.track]);
    }

    sourceVideoTrack.addEventListener('ended', () => {
      if (disposed) return;
      try { onScreenEnded?.(); } catch {}
    }, { once: true });

    const controller = {
      stream: outputStream,
      mode,
      orientation,
      getLayout: () => currentLayout,
      setLayout: nextLayout => {
        currentLayout = normalizeLayout(nextLayout, orientation);
        return currentLayout;
      },
      getFacecamPosition: () => ({ ...currentFacecam }),
      setFacecamPosition: next => {
        if (orientation !== 'horizontal') return { ...currentFacecam };
        currentFacecam = normalizeFacecamPosition({ ...currentFacecam, ...(next || {}) });
        return { ...currentFacecam };
      },
      setCameraVisible: visible => {
        cameraVisible = mode === LIVE_SOURCE_MODE.SCREEN_CAMERA && Boolean(visible);
        return cameraVisible;
      },
      getCameraVisible: () => cameraVisible,
      switchCameraFacing: async nextFacing => {
        if (mode !== LIVE_SOURCE_MODE.SCREEN_CAMERA) throw new Error('Facecam is not active for this LIVE source.');
        const normalized = nextFacing === 'environment' ? 'environment' : 'user';
        const replacement = await navigator.mediaDevices.getUserMedia({
          video: cameraConstraints(orientation, normalized),
          audio: false
        });
        const old = cameraStream;
        cameraStream = replacement;
        currentFacing = normalized;
        if (cameraVideo) {
          cameraVideo.srcObject = replacement;
          Promise.resolve(cameraVideo.play?.()).catch(() => {});
        }
        stopStream(old);
        return currentFacing;
      },
      stop: () => {
        if (disposed) return;
        disposed = true;
        try { stopPainter?.(); } catch {}
        destroyVideoElement(screenVideo);
        destroyVideoElement(cameraVideo);
        stopStream(outputStream);
        stopStream(screenStream);
        stopStream(micStream);
        stopStream(cameraStream);
        if (audioContext) Promise.resolve(audioContext.close?.()).catch(() => {});
      }
    };

    return controller;
  } catch (error) {
    disposed = true;
    try { stopPainter?.(); } catch {}
    destroyVideoElement(screenVideo);
    destroyVideoElement(cameraVideo);
    stopStream(outputStream);
    stopStream(screenStream);
    stopStream(micStream);
    stopStream(cameraStream);
    if (audioContext) Promise.resolve(audioContext.close?.()).catch(() => {});
    throw error;
  }
}
