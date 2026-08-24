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
    const timers = new Set();

    const later = (fn, delay) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!disposed) fn();
      }, delay);
      timers.add(id);
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
      let replacementStream = null;
      let replacementTrack = null;

      try {
        // iOS/WKWebView cannot reliably hold front and back cameras together.
        // Release the old lens first, but keep the original MediaStream object
        // so microphone state, recorder state and React refs remain stable.
        oldVideoTrack.enabled = false;
        oldVideoTrack.stop();
        stream.removeTrack(oldVideoTrack);

        replacementStream = await acquireCamera(nextFacing, horizontal);
        replacementTrack = replacementStream.getVideoTracks()[0];
        if (!replacementTrack) throw new Error('No camera available.');
        replacementTrack.enabled = true;
        stream.addTrack(replacementTrack);
        replacementStream.getTracks().forEach(track => {
          if (track !== replacementTrack) track.stop();
        });

        // Restore the local preview before waiting on the network publisher.
        // A slow LiveKit track replacement must never leave the creator black.
        video.classList.toggle('mirrored', nextFacing === 'user');
        video.dataset.droxionFacing = nextFacing;
        forceAttach(video, stream);

        try {
          await window.__droxionReplacePublishedCamera?.(replacementTrack);
        } catch (error) {
          console.warn('Droxion LIVE camera transport switch will retry on publish', error);
        }
      } catch (error) {
        try {
          replacementStream?.getTracks?.().forEach(track => track.stop());
        } catch {}

        // Recover the previous lens so a failed flip never leaves a black LIVE.
        try {
          const recoveryStream = await acquireCamera(previousFacing, horizontal);
          const recoveryTrack = recoveryStream.getVideoTracks()[0];
          if (recoveryTrack) {
            recoveryTrack.enabled = oldEnabled;
            stream.addTrack(recoveryTrack);
            recoveryStream.getTracks().forEach(track => {
              if (track !== recoveryTrack) track.stop();
            });
            video.classList.toggle('mirrored', previousFacing === 'user');
            video.dataset.droxionFacing = previousFacing;
            forceAttach(video, stream);
            try { await window.__droxionReplacePublishedCamera?.(recoveryTrack); } catch {}
          }
        } catch (recoveryError) {
          console.warn('Droxion LIVE camera recovery failed', recoveryError || error);
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
        }
      });
    };

    document.addEventListener('click', captureFlip, true);
    window.addEventListener(CAMERA_REPLACED_EVENT, syncFacingClass);
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      document.removeEventListener('click', captureFlip, true);
      window.removeEventListener(CAMERA_REPLACED_EVENT, syncFacingClass);
      observer.disconnect();
      timers.forEach(id => window.clearTimeout(id));
      timers.clear();
    };
  }, []);

  return <style>{guestSplitCss}</style>;
}
