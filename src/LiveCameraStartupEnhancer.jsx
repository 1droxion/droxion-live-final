import { useEffect } from 'react';

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

function videoConstraints(nextFacing, horizontal) {
  const dimensions = horizontal
    ? { width: { ideal: 1280 }, height: { ideal: 720 } }
    : { width: { ideal: 720 }, height: { ideal: 1280 } };
  return {
    facingMode: { exact: nextFacing },
    ...dimensions,
    frameRate: { ideal: 30, max: 30 }
  };
}

async function acquireCamera(nextFacing, horizontal) {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: videoConstraints(nextFacing, horizontal),
      audio: false
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: nextFacing },
        ...(horizontal
          ? { width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 720 }, height: { ideal: 1280 } }),
        frameRate: { ideal: 30, max: 30 }
      },
      audio: false
    });
  }
}

const guestSplitCss = `
.liveRoomV4 .liveLocalPreview.mirrored,
.liveRoomV4 .liveGuestSelfVideo.mirrored {
  transform:none!important;
}
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

      // iOS/WKWebView may need several playback attempts while camera capture
      // warms up. Never toggle the user's camera automatically: doing so can
      // race a physical camera switch and leave the preview black.
      [0, 80, 220, 500, 900, 1500].forEach(delay => later(() => tryPlay(video), delay));

      later(() => {
        if (!video.isConnected || video.videoWidth > 0 || video.readyState >= 2) return;
        const stream = video.srcObject;
        if (!stream || stream.active === false) return;
        try {
          video.srcObject = null;
          requestAnimationFrame(() => {
            if (!video.isConnected || disposed) return;
            video.srcObject = stream;
            tryPlay(video);
          });
        } catch {}
      }, 1250);
    };

    const robustFlip = async button => {
      if (switching || !navigator.mediaDevices?.getUserMedia) return;
      const room = button.closest('.liveRoomV4');
      const video = room?.querySelector('video.liveMainVideo.liveLocalPreview, video.liveGuestSelfVideo');
      const stream = video?.srcObject;
      const oldVideoTrack = stream?.getVideoTracks?.()[0];
      if (!video || !stream || !oldVideoTrack) return;

      switching = true;
      button.disabled = true;
      const previousFacing = currentFacing(oldVideoTrack, video);
      const nextFacing = previousFacing === 'user' ? 'environment' : 'user';
      const horizontal = room?.classList?.contains('liveRoom-horizontal');
      const oldEnabled = oldVideoTrack.enabled;

      try {
        // Release the physical camera before asking iOS for the other lens.
        // Keep the same MediaStream object so mic state and React refs survive.
        oldVideoTrack.enabled = false;
        oldVideoTrack.stop();
        stream.removeTrack(oldVideoTrack);
        if (video.srcObject !== stream) video.srcObject = stream;

        let fresh;
        try {
          fresh = await acquireCamera(nextFacing, horizontal);
        } catch (error) {
          fresh = await acquireCamera(previousFacing, horizontal);
          throw Object.assign(error || new Error('Could not switch camera.'), { recoveryStream: fresh });
        }

        const newTrack = fresh.getVideoTracks()[0];
        if (!newTrack) throw new Error('No camera available.');
        newTrack.enabled = true;
        stream.addTrack(newTrack);
        fresh.getTracks().forEach(track => { if (track !== newTrack) track.stop(); });

        await window.__droxionReplacePublishedCamera?.(newTrack);
        video.srcObject = stream;
        tryPlay(video);
        later(() => tryPlay(video), 80);
        later(() => tryPlay(video), 250);
      } catch (error) {
        const recoveryStream = error?.recoveryStream;
        const recoveryTrack = recoveryStream?.getVideoTracks?.()[0];
        if (recoveryTrack) {
          recoveryTrack.enabled = oldEnabled;
          stream.addTrack(recoveryTrack);
          recoveryStream.getTracks().forEach(track => { if (track !== recoveryTrack) track.stop(); });
          try { await window.__droxionReplacePublishedCamera?.(recoveryTrack); } catch {}
          video.srcObject = stream;
          tryPlay(video);
        }
      } finally {
        switching = false;
        button.disabled = false;
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
      document.querySelectorAll('video.liveMainVideo.liveLocalPreview, video.liveGuestSelfVideo').forEach(recover);
    };

    document.addEventListener('click', captureFlip, true);
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      document.removeEventListener('click', captureFlip, true);
      observer.disconnect();
      timers.forEach(id => window.clearTimeout(id));
      timers.clear();
    };
  }, []);

  return <style>{guestSplitCss}</style>;
}
