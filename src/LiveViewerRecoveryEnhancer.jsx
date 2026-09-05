import { useEffect } from 'react';

const FIRST_RETRY_MS = 1800;
const SECOND_RETRY_MS = 4200;

function legacyViewerStillConnecting() {
  const room = document.querySelector('.liveRoomV4');
  if (!room) return false;
  const loading = Array.from(room.querySelectorAll('.liveVideoLoading'))
    .find(node => /connecting live video/i.test(node.textContent || ''));
  return Boolean(loading);
}

function triggerLegacyRecovery() {
  try { window.dispatchEvent(new Event('pagehide')); } catch {}
  window.setTimeout(() => {
    try { window.dispatchEvent(new Event('pageshow')); } catch {}
  }, 40);
}

function currentViewer() {
  return document.querySelector('.productionViewerPage');
}

function currentVideoReady(viewer) {
  const video = viewer?.querySelector?.('.productionViewerVideo');
  if (!(video instanceof HTMLVideoElement)) return false;
  return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
}

function ensureGuard(viewer) {
  if (!(viewer instanceof HTMLElement)) return null;
  let guard = viewer.querySelector('.droxionLiveBlankGuard');
  if (!guard) {
    guard = document.createElement('div');
    guard.className = 'droxionLiveBlankGuard';
    guard.innerHTML = '<span class="droxionLiveBlankGuardPulse"></span><strong>Connecting LIVE video…</strong><small>Keeping the stream active while video starts.</small>';
    viewer.appendChild(guard);
  }
  return guard;
}

function recoverCurrentViewer(viewer) {
  if (!(viewer instanceof HTMLElement)) return;
  const video = viewer.querySelector('.productionViewerVideo');
  const audio = viewer.querySelector('audio');
  try {
    if (video instanceof HTMLVideoElement) {
      video.setAttribute('playsinline', '');
      video.autoplay = true;
      video.muted = true;
      Promise.resolve(video.play?.()).catch(() => {});
    }
    if (audio instanceof HTMLAudioElement) {
      audio.setAttribute('playsinline', '');
      audio.autoplay = true;
      Promise.resolve(audio.play?.()).catch(() => {});
    }
  } catch {}
}

function closeEndedViewer() {
  const viewer = currentViewer();
  if (viewer instanceof HTMLElement) {
    const backButton = viewer.querySelector('.productionViewerTop > button');
    if (backButton instanceof HTMLButtonElement) {
      backButton.click();
      return;
    }
  }

  const v2Viewer = document.querySelector('.liveV2ViewerPage');
  if (v2Viewer) {
    const homeLink = v2Viewer.querySelector('.liveV2Header a');
    if (homeLink instanceof HTMLElement) {
      homeLink.click();
      return;
    }
    try { window.location.replace('/'); } catch {}
  }
}

export default function LiveViewerRecoveryEnhancer() {
  useEffect(() => {
    let firstTimer = null;
    let secondTimer = null;
    let watchedNode = null;

    const clearTimers = () => {
      window.clearTimeout(firstTimer);
      window.clearTimeout(secondTimer);
      firstTimer = null;
      secondTimer = null;
    };

    const inspect = () => {
      const viewer = currentViewer();
      if (viewer) {
        const guard = ensureGuard(viewer);
        const ready = currentVideoReady(viewer);
        if (guard) guard.hidden = ready;
        if (ready) {
          clearTimers();
          watchedNode = viewer;
          return;
        }

        recoverCurrentViewer(viewer);
        if (watchedNode !== viewer) {
          clearTimers();
          watchedNode = viewer;
          firstTimer = window.setTimeout(() => {
            firstTimer = null;
            if (currentViewer() === viewer && !currentVideoReady(viewer)) recoverCurrentViewer(viewer);
          }, FIRST_RETRY_MS);
          secondTimer = window.setTimeout(() => {
            secondTimer = null;
            if (currentViewer() === viewer && !currentVideoReady(viewer)) recoverCurrentViewer(viewer);
          }, SECOND_RETRY_MS);
        }
        return;
      }

      const legacy = document.querySelector('.liveRoomV4');
      if (legacy && legacyViewerStillConnecting()) {
        if (watchedNode !== legacy) {
          clearTimers();
          watchedNode = legacy;
          firstTimer = window.setTimeout(() => {
            firstTimer = null;
            if (watchedNode === legacy && legacyViewerStillConnecting()) triggerLegacyRecovery();
          }, 3500);
          secondTimer = window.setTimeout(() => {
            secondTimer = null;
            if (watchedNode === legacy && legacyViewerStillConnecting()) triggerLegacyRecovery();
          }, 8500);
        }
        return;
      }

      watchedNode = null;
      clearTimers();
    };

    inspect();
    window.addEventListener('droxion:live-ended', closeEndedViewer);
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(inspect, 700);

    return () => {
      clearTimers();
      window.clearInterval(interval);
      window.removeEventListener('droxion:live-ended', closeEndedViewer);
      observer.disconnect();
      document.querySelectorAll('.droxionLiveBlankGuard').forEach(node => node.remove());
    };
  }, []);

  return null;
}
