import { useEffect } from 'react';

export default function LiveGuestStageGuard() {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    let stopped = false;
    let timer = null;
    let observer = null;

    const hasRenderableGuestVideo = video => {
      if (!video || video.classList.contains('liveGuestSelfVideo')) return false;
      const stream = video.srcObject;
      const tracks = stream?.getVideoTracks?.() || [];
      const liveTrack = tracks.find(track => track.readyState === 'live' && track.enabled !== false);
      return Boolean(liveTrack && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0);
    };

    const reconcile = () => {
      if (stopped) return;
      const room = document.querySelector('.liveRoomV4');
      const stage = room?.querySelector('.liveStageV4');
      const guestVideo = room?.querySelector('video.liveGuestVideo:not(.liveGuestSelfVideo)');
      if (!room || !stage || !guestVideo) return;

      const ready = hasRenderableGuestVideo(guestVideo);
      room.classList.toggle('liveGuestFramesReady', ready);

      if (!ready) {
        // React may know that a remote track exists before iOS/WebKit has actually
        // rendered a frame. Do not expose a black 50/50 guest panel during that gap.
        stage.classList.remove('liveStage-split');
        guestVideo.style.visibility = 'hidden';
        room.querySelectorAll('.liveGuestMenuButton,.liveGuestMenu').forEach(node => {
          node.style.visibility = 'hidden';
          node.style.pointerEvents = 'none';
        });
        try { guestVideo.play?.().catch?.(() => {}); } catch {}
      } else {
        guestVideo.style.visibility = '';
        room.querySelectorAll('.liveGuestMenuButton,.liveGuestMenu').forEach(node => {
          node.style.visibility = '';
          node.style.pointerEvents = '';
        });
      }
    };

    const schedule = () => {
      reconcile();
      window.clearTimeout(timer);
      timer = window.setTimeout(schedule, 250);
    };

    observer = new MutationObserver(reconcile);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'src']
    });
    document.addEventListener('playing', reconcile, true);
    document.addEventListener('loadeddata', reconcile, true);
    document.addEventListener('canplay', reconcile, true);
    schedule();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      observer?.disconnect();
      document.removeEventListener('playing', reconcile, true);
      document.removeEventListener('loadeddata', reconcile, true);
      document.removeEventListener('canplay', reconcile, true);
    };
  }, []);

  return null;
}
