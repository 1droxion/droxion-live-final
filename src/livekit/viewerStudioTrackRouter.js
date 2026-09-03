import { Track } from 'livekit-client';
import { attachRemoteTrack as attachLegacyRemoteTrack, detachRemoteTrack as detachLegacyRemoteTrack } from './livekitRoomLegacy';

const routedElements = new WeakMap();
const viewerStates = new WeakMap();

function publicationName(track) {
  return String(track?.__droxionPublicationName || track?.name || '').toLowerCase();
}

function sourceOf(track) {
  return track?.__droxionSource || track?.source || '';
}

function isVideoElement(element) {
  return String(element?.tagName || '').toLowerCase() === 'video';
}

function isScreenTrack(track) {
  const source = sourceOf(track);
  return source === Track.Source.ScreenShare
    || String(source).toLowerCase().includes('screen')
    || publicationName(track).startsWith('droxion_screen');
}

function isCameraTrack(track) {
  const source = sourceOf(track);
  return source === Track.Source.Camera
    || String(source).toLowerCase().includes('camera')
    || publicationName(track).startsWith('droxion_camera')
    || publicationName(track).startsWith('droxion_facecam');
}

function parseScreenMeta(track) {
  const name = publicationName(track);
  if (!name.startsWith('droxion_screen')) return null;
  const parts = name.split('__');
  const orientation = parts[1] === 'vertical' ? 'vertical' : 'horizontal';
  return {
    orientation,
    layout: orientation === 'vertical' ? 'split_70_30' : 'free_facecam',
    x: 0.735,
    y: 0.64,
    size: 0.235
  };
}

function parseFacecamMeta(track) {
  const name = publicationName(track);
  if (!name.startsWith('droxion_facecam')) return null;
  const parts = name.split('__');
  const orientation = parts[1] === 'vertical' ? 'vertical' : 'horizontal';
  const layout = parts[2] || (orientation === 'vertical' ? 'split_70_30' : 'free_facecam');
  const numbers = String(parts[3] || '').split('-').map(Number);
  const x = Number.isFinite(numbers[0]) ? numbers[0] / 1000 : 0.735;
  const y = Number.isFinite(numbers[1]) ? numbers[1] / 1000 : 0.64;
  const size = Number.isFinite(numbers[2]) ? numbers[2] / 1000 : 0.235;
  return { orientation, layout, x, y, size };
}

function stateFor(mainVideo) {
  let state = viewerStates.get(mainVideo);
  if (!state) {
    state = {
      screenTrack: null,
      cameraTrack: null,
      facecamElement: null,
      meta: null,
      studio: false
    };
    viewerStates.set(mainVideo, state);
  }
  return state;
}

function resetMainVideo(element) {
  if (!element) return;
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

function applyScreenLayout(mainVideo, meta) {
  if (!mainVideo) return;
  const safeMeta = meta || { orientation: 'horizontal', layout: 'free_facecam' };
  resetMainVideo(mainVideo);

  if (safeMeta.orientation === 'vertical') {
    const split = safeMeta.layout === 'split_50_50' ? 50 : 70;
    mainVideo.style.height = `${split}%`;
  }
}

function ensureFacecamElement(mainVideo) {
  const parent = mainVideo?.parentElement;
  if (!parent) return null;
  const state = stateFor(mainVideo);
  if (state.facecamElement?.isConnected) return state.facecamElement;

  const existing = parent.querySelector('.droxionViewerFacecam');
  if (existing) {
    state.facecamElement = existing;
    return existing;
  }

  const video = document.createElement('video');
  video.className = 'droxionViewerFacecam';
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
  const state = stateFor(mainVideo);
  const video = ensureFacecamElement(mainVideo);
  if (!video) return null;

  const safeMeta = meta || state.meta || { orientation: 'horizontal', layout: 'free_facecam', x: 0.735, y: 0.64, size: 0.235 };
  applyScreenLayout(mainVideo, safeMeta);

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
  state.studio = true;
  state.screenTrack = track;
  const screenMeta = parseScreenMeta(track);
  if (screenMeta && !state.meta) state.meta = screenMeta;

  // If camera arrived first and was provisionally attached to the main video,
  // detach it before attaching the real screen track.
  if (state.cameraTrack && routedElements.get(state.cameraTrack) === mainVideo) {
    try { detachLegacyRemoteTrack(state.cameraTrack, mainVideo); } catch {}
  }

  applyScreenLayout(mainVideo, state.meta);
  routedElements.set(track, mainVideo);
  attachLegacyRemoteTrack(track, mainVideo);

  if (state.cameraTrack) {
    const facecam = applyFacecamLayout(mainVideo, state.meta);
    if (facecam) {
      routedElements.set(state.cameraTrack, facecam);
      attachLegacyRemoteTrack(state.cameraTrack, facecam);
    }
  }
}

function attachCamera(track, mainVideo, state) {
  state.cameraTrack = track;
  const explicitMeta = parseFacecamMeta(track);
  if (explicitMeta) {
    state.meta = explicitMeta;
    state.studio = true;
  }

  // Explicit Droxion facecam metadata, or an already-known screen track,
  // means this camera is an overlay/split facecam and must never replace screen.
  if (explicitMeta || state.screenTrack || state.studio) {
    const facecam = applyFacecamLayout(mainVideo, state.meta);
    if (!facecam) return;
    routedElements.set(track, facecam);
    attachLegacyRemoteTrack(track, facecam);
    return;
  }

  // Camera may subscribe a few milliseconds before ScreenShare. Keep it visible
  // for a normal camera-only LIVE, but remember it so ScreenShare can reroute it
  // to the facecam layer if a screen track arrives next.
  resetMainVideo(mainVideo);
  routedElements.set(track, mainVideo);
  attachLegacyRemoteTrack(track, mainVideo);
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

  if (isVideoElement(element)) {
    const state = viewerStates.get(element);
    if (state?.screenTrack === track) state.screenTrack = null;
    if (state?.cameraTrack === track) state.cameraTrack = null;
    if (!state?.cameraTrack && state?.facecamElement) {
      try { state.facecamElement.remove(); } catch {}
      state.facecamElement = null;
    }
    if (!state?.screenTrack && !state?.cameraTrack) {
      state.meta = null;
      state.studio = false;
      resetMainVideo(element);
    }
  } else if (routed?.classList?.contains('droxionViewerFacecam')) {
    try { routed.remove(); } catch {}
  }

  routedElements.delete(track);
}
