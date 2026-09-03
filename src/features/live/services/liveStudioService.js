const FRAME_RATE = 30;

export const LIVE_SOURCE_MODE = Object.freeze({
  CAMERA: 'camera',
  SCREEN: 'screen',
  SCREEN_CAMERA: 'screen_camera'
});

export const LIVE_STUDIO_LAYOUTS = Object.freeze([
  { id: 'pip_top_left', label: 'Facecam top left' },
  { id: 'pip_top_right', label: 'Facecam top right' },
  { id: 'pip_bottom_left', label: 'Facecam bottom left' },
  { id: 'pip_bottom_right', label: 'Facecam bottom right' },
  { id: 'split_70_30', label: '70 / 30 split' },
  { id: 'split_50_50', label: '50 / 50 split' }
]);

function cameraConstraints(orientation, facingMode) {
  const portrait = orientation !== 'horizontal';
  return {
    facingMode: { ideal: facingMode === 'environment' ? 'environment' : 'user' },
    width: { ideal: portrait ? 720 : 1280 },
    height: { ideal: portrait ? 1280 : 720 },
    frameRate: { ideal: FRAME_RATE, max: FRAME_RATE }
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

function createVideoElement(stream, muted = true) {
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = muted;
  video.srcObject = stream;
  video.style.position = 'fixed';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  video.style.left = '-9999px';
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

export function getStudioLayoutRects(layout, width, height) {
  const horizontal = width >= height;
  const margin = Math.round(Math.min(width, height) * 0.028);

  if (layout === 'split_70_30') {
    if (horizontal) {
      const screenWidth = Math.round(width * 0.7);
      return {
        screen: { x: 0, y: 0, width: screenWidth, height },
        camera: { x: screenWidth, y: 0, width: width - screenWidth, height },
        style: 'split'
      };
    }
    const screenHeight = Math.round(height * 0.7);
    return {
      screen: { x: 0, y: 0, width, height: screenHeight },
      camera: { x: 0, y: screenHeight, width, height: height - screenHeight },
      style: 'split'
    };
  }

  if (layout === 'split_50_50') {
    if (horizontal) {
      const half = Math.round(width / 2);
      return {
        screen: { x: 0, y: 0, width: half, height },
        camera: { x: half, y: 0, width: width - half, height },
        style: 'split'
      };
    }
    const half = Math.round(height / 2);
    return {
      screen: { x: 0, y: 0, width, height: half },
      camera: { x: 0, y: half, width, height: height - half },
      style: 'split'
    };
  }

  const cameraWidth = Math.round(width * (horizontal ? 0.235 : 0.34));
  const cameraHeight = Math.round(cameraWidth * 0.75);
  const left = layout === 'pip_top_left' || layout === 'pip_bottom_left';
  const top = layout === 'pip_top_left' || layout === 'pip_top_right';
  return {
    screen: { x: 0, y: 0, width, height },
    camera: {
      x: left ? margin : width - cameraWidth - margin,
      y: top ? margin : height - cameraHeight - margin,
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

  const context = new AudioContextCtor();
  try { if (context.state !== 'running') await context.resume(); } catch {}
  const destination = context.createMediaStreamDestination();

  const connectTrack = (track, gainValue) => {
    const sourceStream = new MediaStream([track]);
    const source = context.createMediaStreamSource(sourceStream);
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

export async function createLiveStudioStream({
  mode = LIVE_SOURCE_MODE.SCREEN,
  layout = 'pip_bottom_right',
  orientation = 'horizontal',
  facingMode = 'user',
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
  let animationFrame = 0;
  let disposed = false;
  let currentLayout = LIVE_STUDIO_LAYOUTS.some(item => item.id === layout) ? layout : 'pip_bottom_right';
  let cameraVisible = mode === LIVE_SOURCE_MODE.SCREEN_CAMERA;
  let currentFacing = facingMode === 'environment' ? 'environment' : 'user';

  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: FRAME_RATE, max: FRAME_RATE } },
      audio: true
    });

    micStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: microphoneConstraints()
    });

    if (mode === LIVE_SOURCE_MODE.SCREEN_CAMERA) {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: cameraConstraints(orientation, currentFacing),
        audio: false
      });
    }

    const canvas = document.createElement('canvas');
    const size = outputSize(orientation);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context || typeof canvas.captureStream !== 'function') {
      throw new Error('This browser cannot create a LIVE screen-share stream.');
    }

    screenVideo = createVideoElement(screenStream);
    if (cameraStream) cameraVideo = createVideoElement(cameraStream);

    const paint = () => {
      if (disposed) return;
      context.fillStyle = '#050508';
      context.fillRect(0, 0, canvas.width, canvas.height);

      if (mode === LIVE_SOURCE_MODE.SCREEN) {
        drawContain(context, screenVideo, { x: 0, y: 0, width: canvas.width, height: canvas.height });
      } else {
        const rects = getStudioLayoutRects(currentLayout, canvas.width, canvas.height);
        context.save();
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
            context.lineWidth = Math.max(3, Math.round(canvas.width * 0.004));
            context.strokeStyle = 'rgba(255,255,255,.92)';
            roundedRect(context, rects.camera, radius);
            context.stroke();
          }
        }
        context.restore();
      }

      animationFrame = window.requestAnimationFrame(paint);
    };
    paint();

    const canvasStream = canvas.captureStream(FRAME_RATE);
    const videoTrack = canvasStream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('Droxion could not capture the LIVE Studio canvas.');

    const mixedAudio = await createMixedAudioTrack(micStream, screenStream);
    audioContext = mixedAudio.context;
    outputStream = new MediaStream([videoTrack, mixedAudio.track]);

    const screenTrack = screenStream.getVideoTracks()[0];
    if (screenTrack) {
      screenTrack.addEventListener('ended', () => {
        if (disposed) return;
        try { onScreenEnded?.(); } catch {}
      }, { once: true });
    }

    const controller = {
      stream: outputStream,
      mode,
      getLayout: () => currentLayout,
      setLayout: nextLayout => {
        if (!LIVE_STUDIO_LAYOUTS.some(item => item.id === nextLayout)) return currentLayout;
        currentLayout = nextLayout;
        return currentLayout;
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
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
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
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
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
