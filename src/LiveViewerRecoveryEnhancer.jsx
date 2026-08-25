import { useEffect } from 'react';

const FIRST_RETRY_MS = 3500;
const SECOND_RETRY_MS = 8500;

function viewerStillConnecting() {
  const room = document.querySelector('.liveRoomV4');
  if (!room) return false;
  const loading = Array.from(room.querySelectorAll('.liveVideoLoading'))
    .find(node => /connecting live video/i.test(node.textContent || ''));
  return Boolean(loading);
}

function triggerExistingLiveRecovery() {
  // LiveExperienceScale already has a tested background/foreground recovery path
  // that refreshes Realtime, repairs LiveKit state, and replays remote track
  // subscriptions. Reuse that path instead of creating a second transport stack.
  try { window.dispatchEvent(new Event('pagehide')); } catch {}
  window.setTimeout(() => {
    try { window.dispatchEvent(new Event('pageshow')); } catch {}
  }, 40);
}

export default function LiveViewerRecoveryEnhancer() {
  useEffect(() => {
    let firstTimer = null;
    let secondTimer = null;
    let watchedRoom = null;

    const clearTimers = () => {
      window.clearTimeout(firstTimer);
      window.clearTimeout(secondTimer);
      firstTimer = null;
      secondTimer = null;
    };

    const inspect = () => {
      const room = document.querySelector('.liveRoomV4');
      if (!room || !viewerStillConnecting()) {
        watchedRoom = null;
        clearTimers();
        return;
      }
      if (watchedRoom === room && (firstTimer || secondTimer)) return;

      watchedRoom = room;
      clearTimers();
      firstTimer = window.setTimeout(() => {
        firstTimer = null;
        if (watchedRoom === room && viewerStillConnecting()) triggerExistingLiveRecovery();
      }, FIRST_RETRY_MS);
      secondTimer = window.setTimeout(() => {
        secondTimer = null;
        if (watchedRoom === room && viewerStillConnecting()) triggerExistingLiveRecovery();
      }, SECOND_RETRY_MS);
    };

    inspect();
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(inspect, 1200);

    return () => {
      clearTimers();
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return null;
}
