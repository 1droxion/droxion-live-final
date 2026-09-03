import { Track } from 'livekit-client';
import { attachRemoteTrack as attachLegacyRemoteTrack, detachRemoteTrack as detachLegacyRemoteTrack } from './livekitRoomLegacy';

const routedElements = new WeakMap();

function publicationName(track) {
  return String(track?.__droxionPublicationName || track?.name || '').toLowerCase();
}

function sourceOf(track) {
  return track?.__droxionSource || track?.source || '';
}

function isScreenTrack(track) {
  const source = sourceOf(track);
  return source === Track.Source.ScreenShare || String(source).toLowerCase().includes('screen') || publicationName(track).startsWith('droxion_screen');
}

function parseFacecamMeta(track) {
  const name = publicationName(track);
  if (!name.startsWith('droxion_facecam')) return null;
  const parts = name.split('__');
  const orientation = parts[1] || 'horizontal';
  const layout = parts[2] || (orientation === 'vertical' ? 'split_70_30' : 'free_facecam');
  const numbers = String(parts[3] || '').split('-').map(Number);
  const x = Number.isFinite(numbers[0]) ? numbers[0] / 1000 : 0.735;
  const y = Number.isFinite(numbers[1]) ? numbers[1] / 1000 : 0.64;
  const size = Number.isFinite(numbers[2]) ? numbers[2] / 1000 : 0.235;
  return { orientation, layout, x, y, size };
}

function resetMainVideo(element) {
  if (!element) return;
  element.style.left = '';
  element.style.right = '';
  element.style.top = '';
  element.style.bottom = '';
  element.style.width = '';
  element.style.height = '';
  element.style.transform = '';
  element.style.objectFit = '';
}

function applyScreenLayout(mainVideo, meta) {
  if (!mainVideo || !meta) return;
  mainVideo.style.position = 'absolute';
  mainVideo.style.background = '#000';
  mainVideo.style.objectFit = 'contain';
  mainVideo.style.transform = 'none';

  if (meta.orientation === 'vertical' && meta.layout === 'split_50_50') {
    mainVideo.style.left = '0';
    mainVideo.style.top = '0';
    mainVideo.style.width = '100%';
    mainVideo.style.height = '50%';
    return;
  }
  if (meta.orientation === 'vertical') {
    mainVideo.style.left = '0';
    mainVideo.style.top = '0';
    mainVideo.style.width = '100%';
    mainVideo.style.height = '70%';
    return;
  }

  mainVideo.style.left = '0';
  mainVideo.style.top = '0';
  mainVideo.style.width = '100%';
  mainVideo.style.height = '100%';
}

function createFacecamElement(mainVideo, meta) {
  const parent = mainVideo?.parentElement;
  if (!parent) return null;

  const previous = parent.querySelector('.droxionViewerFacecam');
  if (previous) previous.remove();

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

  if (meta.orientation === 'vertical' && meta.layout === 'split_50_50') {
    video.style.left = '0';
    video.style.top = '50%';
    video.style.width = '100%';
    video.style.height = '50%';
    video.style.borderRadius = '0';
  } else if (meta.orientation === 'vertical') {
    video.style.left = '0';
    video.style.top = '70%';
    video.style.width = '100%';
    video.style.height = '30%';
    video.style.borderRadius = '0';
  } else {
    const size = Math.min(0.38, Math.max(0.16, Number(meta.size) || 0.235));
    const x = Math.min(0.988 - size, Math.max(0.012, Number(meta.x) || 0.735));
    const heightPercent = size * 100 * 0.75;
    const y = Math.min(0.982 - (heightPercent / 100), Math.max(0.018, Number(meta.y) || 0.64));
    video.style.left = `${x * 100}%`;
    video.style.top = `${y * 100}%`;
    video.style.width = `${size * 100}%`;
    video.style.aspectRatio = '4 / 3';
    video.style.height = 'auto';
    video.style.border = '2px solid rgba(255,255,255,.94)';
    video.style.borderRadius = '14px';
    video.style.boxShadow = '0 10px 32px rgba(0,0,0,.38)';
  }

  parent.appendChild(video);
  return video;
}

export function attachStudioAwareRemoteTrack(track, element) {
  if (!track || !element) return;

  const meta = parseFacecamMeta(track);
  if (meta && String(element.tagName || '').toLowerCase() === 'video') {
    const mainVideo = element;
    applyScreenLayout(mainVideo, meta);
    const facecam = createFacecamElement(mainVideo, meta);
    if (!facecam) return;
    routedElements.set(track, facecam);
    attachLegacyRemoteTrack(track, facecam);
    return;
  }

  if (isScreenTrack(track) && String(element.tagName || '').toLowerCase() === 'video') {
    resetMainVideo(element);
    element.style.position = 'absolute';
    element.style.inset = '0';
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.objectFit = 'contain';
    element.style.background = '#000';
    element.style.transform = 'none';
    element.dataset.droxionScreenTrack = 'true';
    routedElements.set(track, element);
    attachLegacyRemoteTrack(track, element);
    return;
  }

  routedElements.set(track, element);
  attachLegacyRemoteTrack(track, element);
}

export function detachStudioAwareRemoteTrack(track, element) {
  if (!track) return;
  const routed = routedElements.get(track) || element || null;
  try { detachLegacyRemoteTrack(track, routed || undefined); } catch {}
  if (routed?.classList?.contains('droxionViewerFacecam')) {
    try { routed.remove(); } catch {}
  }
  routedElements.delete(track);
}
