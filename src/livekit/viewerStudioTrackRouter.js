import { Track } from 'livekit-client';
import { attachRemoteTrack as attachLegacyRemoteTrack, detachRemoteTrack as detachLegacyRemoteTrack } from './livekitRoomLegacy';
import { remoteTrackMetadata, forgetRemoteTrackMetadata } from './remoteTrackMetadata';

const routedElements = new WeakMap();
const viewerStates = new WeakMap();
const activeMainVideos = new Set();
let closeListenerBound = false;

function publicationName(track) {
  const metadata = remoteTrackMetadata(track);
  return String(metadata?.name || track?.__droxionPublicationName || track?.name || '').toLowerCase();
}

function sourceOf(track) {
  const metadata = remoteTrackMetadata(track);
  return metadata?.source || track?.__droxionSource || track?.source || '';
}

function isVideoElement(element) {
  return String(element?.tagName || '').toLowerCase() === 'video';
}

function isScreenTrack(track) {
  const source = sourceOf(track);
  const sourceText = String(source || '').toLowerCase();
  const name = publicationName(track);
  return source === Track.Source.ScreenShare || sourceText.includes('screen') || name.startsWith('droxion_screen');
}

function isFacecamTrack(track) {
  return publicationName(track).startsWith('droxion_facecam');
}

function isCameraTrack(track) {
  const source = sourceOf(track);
  const sourceText = String(source || '').toLowerCase();
  const name = publicationName(track);
  return source === Track.Source.Camera || sourceText.includes('camera') || name.startsWith('droxion_camera') || name.startsWith('droxion_facecam');
}

function parseScreenMeta(track) {
  const parts = publicationName(track).split('__');
  const orientation = parts[1] === 'vertical' ? 'vertical' : 'horizontal';
  const requestedLayout = parts[2] || '';
  const layout = orientation === 'vertical'
    ? (requestedLayout === 'split_50_50' ? 'split_50_50' : 'split_70_30')
    : 'free_facecam';
  return { orientation, layout, x: 0.735, y: 0.64, size: 0.235 };
}

function parseFacecamMeta(track) {
  const name = publicationName(track);
  if (!name.startsWith('droxion_facecam')) return null;
  const parts = name.split('__');
  const orientation = parts[1] === 'vertical' ? 'vertical' : 'horizontal';
  const layout = orientation === 'vertical'
    ? (parts[2] === 'split_50_50' ? 'split_50_50' : 'split_70_30')
    : 'free_facecam';
  const numbers = String(parts[3] || '').split('-').map(Number);
  return {
    orientation,
    layout,
    x: Number.isFinite(numbers[0]) ? numbers[0] / 1000 : 0.735,
    y: Number.isFinite(numbers[1]) ? numbers[1] / 1000 : 0.64,
    size: Number.isFinite(numbers[2]) ? numbers[2] / 1000 : 0.235
  };
}

function stateFor(mainVideo) {
  let state = viewerStates.get(mainVideo);
  if (!state) {
    state = { screenTrack: null, cameraTrack: null, facecamElement: null, meta: null, studio: false };
    viewerStates.set(mainVideo, state);
  }
  activeMainVideos.add(mainVideo);
  bindCloseListener();
  return state;
}

function resetMainVideo(element) {
  if (!element) return;
  element.dataset.droxionStudioRole = 'main';
  delete element.dataset.droxionOrientation;
  element.style.position = 'absolute';
  element.style.left = '0';
  element.style.right = 'auto';
  element.style.top = '0';
  element.style.bottom = 'auto';
  element.style.width = '100%';
  element.style.height = '100%';
  element.style.transform = 'none';
  element.style.objectFit = 'contain';
  element.style.background = '#000';
}

function clearElement(element) {
  if (!element) return;
  try { element.pause?.(); } catch {}
  try { element.srcObject = null; } catch {}
}

function detachKnownTrack(track) {
  if (!track) return;
  const routed = routedElements.get(track) || null;
  try { detachLegacyRemoteTrack(track, routed || undefined); } catch {}
  routedElements.delete(track);
  forgetRemoteTrackMetadata(track);
}

function resetViewer(mainVideo) {
  if (!mainVideo) return;
  const state = viewerStates.get(mainVideo);
  if (state) {
    detachKnownTrack(state.screenTrack);
    detachKnownTrack(state.cameraTrack);
    clearElement(state.facecamElement);
    try { state.facecamElement?.remove?.(); } catch {}
  }
  clearElement(mainVideo);
  resetMainVideo(mainVideo);
  viewerStates.delete(mainVideo);
  activeMainVideos.delete(mainVideo);
}

function bindCloseListener() {
  if (closeListenerBound || typeof window === 'undefined') return;
  closeListenerBound = true;
  window.addEventListener('droxion:viewer-room-closed', () => {
    Array.from(activeMainVideos).forEach(resetViewer);
  });
}

function applyScreenLayout(mainVideo, meta) {
  if (!mainVideo) return;
  const safeMeta = meta || { orientation: 'horizontal', layout: 'free_facecam' };
  resetMainVideo(mainVideo);
  mainVideo.dataset.droxionOrientation = safeMeta.orientation;
  if (safeMeta.orientation === 'vertical') {
    mainVideo.style.height = `${safeMeta.layout === 'split_50_50' ? 50 : 70}%`;
  }
}

function ensureFacecamElement(mainVideo) {
  const parent = mainVideo?.parentElement;
  if (!parent) return null;
  const state = stateFor(mainVideo);
  if (state.facecamElement?.isConnected) return state.facecamElement;

  const existing = parent.querySelector('.droxionViewerFacecam');
  if (existing) {
    clearElement(existing);
    try { existing.remove(); } catch {}
  }

  const video = document.createElement('video');
  video.className = 'droxionViewerFacecam';
  video.dataset.droxionStudioRole = 'facecam';
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.setAttribute('playsinline', '');
  video.style.position = 'absolute';
  video.style.zIndex = '3';
  video.style.background = '#09090c';
  video.style.objectFit = 'cover';
  video.style.pointerEvents = 'none';
  parent.appendChild(video);
  state.facecamElement = video;
  return video;
}

function applyFacecamLayout(mainVideo, meta) {
  const video = ensureFacecamElement(mainVideo);
  if (!video) return null;
  const safeMeta = meta || { orientation: 'horizontal', layout: 'free_facecam', x: 0.735, y: 0.64, size: 0.235 };
  applyScreenLayout(mainVideo, safeMeta);
  video.dataset.droxionOrientation = safeMeta.orientation;
  video.style.left = '';
  video.style.top = '';
  video.style.width = '';
  video.style.height = '';
  video.style.aspectRatio = '';
  video.style.border = '0';
  video.style.borderRadius = '0';
  video.style.boxShadow = 'none';

  if (safeMeta.orientation === 'vertical') {
    const split = safeMeta.layout === 'split_50_50' ? 50 : 70;
    video.style.left = '0';
    video.style.top = `${split}%`;
    video.style.width = '100%';
    video.style.height = `${100 - split}%`;
  } else {
    const size = Math.min(0.38, Math.max(0.16, Number(safeMeta.size) || 0.235));
    const x = Math.min(0.988 - size, Math.max(0.012, Number(safeMeta.x) || 0.735));
    const heightRatio = size * 0.75;
    const y = Math.min(0.982 - heightRatio, Math.max(0.018, Number(safeMeta.y) || 0.64));
    video.style.left = `${x * 100}%`;
    video.style.top = `${y * 100}%`;
    video.style.width = `${size * 100}%`;
    video.style.height = 'auto';
    video.style.aspectRatio = '4 / 3';
    video.style.border = '2px solid rgba(255,255,255,.94)';
    video.style.borderRadius = '14px';
    video.style.boxShadow = '0 10px 32px rgba(0,0,0,.38)';
  }
  return video;
}

function attachScreen(track, mainVideo, state) {
  if (state.screenTrack && state.screenTrack !== track) detachKnownTrack(state.screenTrack);
  state.studio = true;
  state.screenTrack = track;
  const screenMeta = parseScreenMeta(track);
  state.meta = state.meta
    ? { ...screenMeta, ...state.meta, orientation: screenMeta.orientation, layout: screenMeta.layout }
    : screenMeta;

  // If a camera subscribed first, remove it from the main video before screen attaches.
  if (state.cameraTrack && routedElements.get(state.cameraTrack) === mainVideo) {
    try { detachLegacyRemoteTrack(state.cameraTrack, mainVideo); } catch {}
  }

  applyScreenLayout(mainVideo, state.meta);
  routedElements.set(track, mainVideo);
  attachLegacyRemoteTrack(track, mainVideo);
  mainVideo.muted = true;
  Promise.resolve(mainVideo.play?.()).catch(() => {});

  if (state.cameraTrack && isFacecamTrack(state.cameraTrack)) {
    const facecam = applyFacecamLayout(mainVideo, state.meta);
    if (facecam) {
      routedElements.set(state.cameraTrack, facecam);
      attachLegacyRemoteTrack(state.cameraTrack, facecam);
      Promise.resolve(facecam.play?.()).catch(() => {});
    }
  }
}

function attachCamera(track, mainVideo, state) {
  if (state.cameraTrack && state.cameraTrack !== track) detachKnownTrack(state.cameraTrack);
  state.cameraTrack = track;
  const explicitMeta = parseFacecamMeta(track);

  if (explicitMeta) {
    state.meta = explicitMeta;
    state.studio = true;
    const facecam = applyFacecamLayout(mainVideo, state.meta);
    if (!facecam) return;
    routedElements.set(track, facecam);
    attachLegacyRemoteTrack(track, facecam);
    Promise.resolve(facecam.play?.()).catch(() => {});
    return;
  }

  // Normal camera-only LIVE must start clean even after a Studio LIVE.
  if (!state.screenTrack) {
    state.studio = false;
    state.meta = null;
    clearElement(state.facecamElement);
    try { state.facecamElement?.remove?.(); } catch {}
    state.facecamElement = null;
    resetMainVideo(mainVideo);
    routedElements.set(track, mainVideo);
    attachLegacyRemoteTrack(track, mainVideo);
    mainVideo.muted = true;
    Promise.resolve(mainVideo.play?.()).catch(() => {});
    return;
  }

  // Unknown camera metadata must never replace an already visible screen.
  const facecam = applyFacecamLayout(mainVideo, state.meta);
  if (!facecam) return;
  routedElements.set(track, facecam);
  attachLegacyRemoteTrack(track, facecam);
  Promise.resolve(facecam.play?.()).catch(() => {});
}

export function attachStudioAwareRemoteTrack(track, element) {
  if (!track || !element) return;
  if (!isVideoElement(element)) {
    routedElements.set(track, element);
    attachLegacyRemoteTrack(track, element);
    return;
  }
  const state = stateFor(element);
  if (isScreenTrack(track)) {
    attachScreen(track, element, state);
    return;
  }
  if (isCameraTrack(track)) {
    attachCamera(track, element, state);
    return;
  }
  routedElements.set(track, element);
  attachLegacyRemoteTrack(track, element);
}

export function detachStudioAwareRemoteTrack(track, element) {
  if (!track) return;
  const routed = routedElements.get(track) || element || null;
  try { detachLegacyRemoteTrack(track, routed || undefined); } catch {}

  const mainVideo = isVideoElement(element)
    ? element
    : (routed?.classList?.contains('droxionViewerFacecam') ? routed.parentElement?.querySelector('.productionViewerVideo') : null);

  if (mainVideo) {
    const state = viewerStates.get(mainVideo);
    if (state?.screenTrack === track) state.screenTrack = null;
    if (state?.cameraTrack === track) state.cameraTrack = null;
    if (!state?.cameraTrack && state?.facecamElement) {
      clearElement(state.facecamElement);
      try { state.facecamElement.remove(); } catch {}
      state.facecamElement = null;
    }
    if (!state?.screenTrack && !state?.cameraTrack) resetViewer(mainVideo);
  }

  routedElements.delete(track);
  forgetRemoteTrackMetadata(track);
}

export function resetStudioAwareViewer(element) {
  if (element) resetViewer(element);
  else Array.from(activeMainVideos).forEach(resetViewer);
}
