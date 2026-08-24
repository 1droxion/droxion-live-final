import { useEffect } from 'react';

const CAMERA_REPLACED_EVENT = 'droxion:live-camera-replaced';

function tryPlay(video) {
  if (!video) return;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  const playback = video.play?.();
  playback?.catch?.(() => {});
}

function normalizeFacing(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('environment') || text.includes('rear') || text.includes('back')) return 'environment';
  return 'user';
}

function currentFacing(track, video) {
  const settings = track?.getSettings?.() || {};
  if (settings.facingMode) return normalizeFacing(settings.facingMode);
  if (track?.label) return normalizeFacing(track.label);
  if (video?.dataset?.droxionFacing) return normalizeFacing(video.dataset.droxionFacing);
  return video?.classList?.contains('mirrored') ? 'user' : 'environment';
}

function videoConstraints(nextFacing, horizontal, exact = true) {
  const dimensions = horizontal
    ? { width: { ideal: 1280 }, height: { ideal: 720 } }
    : { width: { ideal: 720 }, height: { ideal: 1280 } };
  return {
    facingMode: exact ? { exact: nextFacing } : { ideal: nextFacing },
    ...dimensions,
    frameRate: { ideal: 30, max: 30 }
  };
}

async function acquireCamera(nextFacing, horizontal) {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: videoConstraints(nextFacing, horizontal, true),
      audio: false
    });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: videoConstraints(nextFacing, horizontal, false),
        audio: false
      });
    } catch {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
  }
}

function forceAttach(video, stream) {
  if (!video || !stream) return;
  try {
    video.srcObject = null;
    requestAnimationFrame(() => {
      if (!video.isConnected) return;
      video.srcObject = stream;
      tryPlay(video);
      window.setTimeout(() => tryPlay(video), 80);
      window.setTimeout(() => tryPlay(video), 260);
    });
  } catch {
    video.srcObject = stream;
    tryPlay(video);
  }
}

const guestSplitCss = `
.liveRoomV4 .liveStageV4:has(.liveGuestVideo) .liveMainVideo {
  position:absolute!important;
  left:0!important;
  right:0!important;
  top:0!important;
  width:100%!important;
  height:50%!important;
  object-fit:cover!important;
  border-radius:0!important;
}
.liveRoomV4 .liveStageV4:has(.liveGuestVideo) .liveGuestVideo {
  position:absolute!important;
  left:0!important;
  right:0!important;
  top:50%!important;
  bottom:0!important;
  width:100%!important;
  height:50%!important;
  max-width:none!important;
  max-height:none!important;
  object-fit:cover!important;
  border:0!important;
  border-radius:0!important;
  z-index:4!important;
}
.liveRoomV4.liveRoom-horizontal .liveStageV4:has(.liveGuestVideo) .liveMainVideo {
  left:0!important;
  top:0!important;
  width:50%!important;
  height:100%!important;
}
.liveRoomV4.liveRoom-horizontal .liveStageV4:has(.liveGuestVideo) .liveGuestVideo {
  left:50%!important;
  right:0!important;
  top:0!important;
  width:50%!important;
  height:100%!important;
}
`;

export default function LiveCameraStartupEnhancer() {
  useEffect(() => {
    let disposed = false;
    let switching = false;
    let watchdogBusy = false;
    const timers = new Set();

    const later = (fn, delay) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!disposed) fn();
      }, delay);
      timers.add(id);
    };

    const replaceCameraTrack = async ({ video, stream, previousTrack, facing, horizontal, preserveEnabled = true }) => {
      if (!video || !stream || !navigator.mediaDevices?.getUserMedia) return false;
      let fresh = null;
      try {
        fresh = await acquireCamera(facing, horizontal);
        const nextTrack = fresh.getVideoTracks()[0];
        if (!nextTrack) throw new Error('No camera available.');
        nextTrack.enabled = preserveEnabled;

        if (previousTrack) {
          try { previousTrack.enabled = false; } catch {}
          try { previousTrack.stop(); } catch {}
          try { stream.removeTrack(previousTrack); } catch {}
        }

        stream.getVideoTracks().forEach(track => {
          if (track !== nextTrack) {
            try { track.stop(); } catch {}
            try { stream.removeTrack(track); } catch {}
          }
        });
        stream.addTrack(nextTrack);
        fresh.getTracks().forEach(track => { if (track !== nextTrack) track.stop(); });

        video.classList.toggle('mirrored', facing === 'user');
        video.dataset.droxionFacing = facing;
        forceAttach(video, stream);

        try { await window.__droxionReplacePublishedCamera?.(nextTrack); }
        catch (error) { console.warn('Droxion LIVE camera publication recovery queued', error); }

        return true;
      } catch (error) {
        try { fresh?.getTracks?.().forEach(track => track.stop()); } catch {}
        console.warn('Droxion LIVE camera reacquire failed', error);
        return false;
      }
    };

    const recover = video => {
      if (!video || video.dataset.cameraStartupRecovery === 'done') return;
      video.dataset.cameraStartupRecovery = 'done';

      [0, 80, 220, 500, 900, 1500].forEach(delay => later(() => tryPlay(video), delay));

      later(() => {
        if (!video.isConnected || video.videoWidth > 0 || video.readyState >= 2) return;
        const stream = video.srcObject;
        const liveTrack = stream?.getVideoTracks?.().find(track => track.readyState !== 'ended');
        if (!stream || !liveTrack || stream.active === false) return;
        forceAttach(video, stream);
      }, 1250);
    };

    const syncFacingClass = event => {
      const facing = normalizeFacing(event?.detail?.facingMode || event?.detail?.track?.getSettings?.()?.facingMode || event?.detail?.track?.label);
      document.querySelectorAll('video.liveMainVideo.liveLocalPreview, video.liveGuestSelfVideo').forEach(video => {
        video.classList.toggle('mirrored', facing === 'user');
        video.dataset.droxionFacing = facing;
        tryPlay(video);
      });
    };

    const robustFlip = async button => {
      if (switching || !navigator.mediaDevices?.getUserMedia) return;
      const room = button.closest('.liveRoomV4');
      const video = room?.querySelector('video.liveMainVideo.liveLocalPreview, video.liveGuestSelfVideo');
      const stream = video?.srcObject;
      const oldVideoTrack = stream?.getVideoTracks?.().find(track => track.readyState !== 'ended');
      if (!video || !stream || !oldVideoTrack) return;

      switching = true;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      const previousFacing = currentFacing(oldVideoTrack, video);
      const nextFacing = previousFacing === 'user' ? 'environment' : 'user';
      const horizontal = room?.classList?.contains('liveRoom-horizontal');
      const oldEnabled = oldVideoTrack.enabled;

      try {
        // Release the active iPhone lens before opening the other physical lens.
        oldVideoTrack.enabled = false;
        oldVideoTrack.stop();
        stream.removeTrack(oldVideoTrack);

        const switched = await replaceCameraTrack({
          video,
          stream,
          previousTrack: null,
          facing: nextFacing,
          horizontal,
          preserveEnabled: oldEnabled
        });
        if (!switched) {
          await replaceCameraTrack({
            video,
            stream,
            previousTrack: null,
            facing: previousFacing,
            horizontal,
            preserveEnabled: oldEnabled
          });
        }
      } finally {
        switching = false;
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    };

    const captureFlip = event => {
      const button = event.target?.closest?.('.liveHostControlsV4 > button:nth-child(3)');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      robustFlip(button);
    };

    const scan = () => {
      document.querySelectorAll('video.liveMainVideo.liveLocalPreview, video.liveGuestSelfVideo').forEach(video => {
        recover(video);
        const track = video.srcObject?.getVideoTracks?.().find(item => item.readyState !== 'ended');
        if (track) {
          const facing = currentFacing(track, video);
          video.classList.toggle('mirrored', facing === 'user');
          video.dataset.droxionFacing = facing;
        }
      });
    };

    const watchdog = async () => {
      if (disposed || switching || watchdogBusy || !navigator.mediaDevices?.getUserMedia) return;
      const video = document.querySelector('video.liveMainVideo.liveLocalPreview, video.liveGuestSelfVideo');
      if (!video?.isConnected) return;
      const room = video.closest('.liveRoomV4');
      const stream = video.srcObject;
      if (!stream) return;

      const track = stream.getVideoTracks?.().find(item => item.readyState !== 'ended');
      const visuallyHealthy = video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2;
      if (track && visuallyHealthy) {
        tryPlay(video);
        return;
      }

      if (track && !visuallyHealthy) {
        forceAttach(video, stream);
        await new Promise(resolve => window.setTimeout(resolve, 350));
        if (video.videoWidth > 0 && video.videoHeight > 0) return;
      }

      watchdogBusy = true;
      try {
        const facing = currentFacing(track, video);
        const horizontal = room?.classList?.contains('liveRoom-horizontal');
        const enabled = track?.enabled !== false;
        await replaceCameraTrack({
          video,
          stream,
          previousTrack: track,
          facing,
          horizontal,
          preserveEnabled: enabled
        });
      } finally {
        watchdogBusy = false;
      }
    };

    document.addEventListener('click', captureFlip, true);
    window.addEventListener(CAMERA_REPLACED_EVENT, syncFacingClass);
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    const watchdogTimer = window.setInterval(() => { watchdog().catch(() => {}); }, 1500);

    return () => {
      disposed = true;
      document.removeEventListener('click', captureFlip, true);
      window.removeEventListener(CAMERA_REPLACED_EVENT, syncFacingClass);
      observer.disconnect();
      window.clearInterval(watchdogTimer);
      timers.forEach(id => window.clearTimeout(id));
      timers.clear();
    };
  }, []);

  return <style>{guestSplitCss}</style>;
}