import { useEffect } from 'react';

function tryPlay(video) {
  if (!video) return;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  const playback = video.play?.();
  playback?.catch?.(() => {});
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

      const playAttempts = [0, 80, 220, 500, 900];
      playAttempts.forEach(delay => later(() => tryPlay(video), delay));

      later(() => {
        if (!video.isConnected || video.videoWidth > 0 || video.readyState >= 2) return;
        const room = video.closest('.liveRoomV4');
        const cameraButton = room?.querySelector('.liveHostControlsV4 > button:nth-child(2)');
        if (!cameraButton || cameraButton.disabled) return;

        cameraButton.click();
        later(() => {
          cameraButton.click();
          later(() => tryPlay(video), 100);
          later(() => tryPlay(video), 350);
        }, 180);
      }, 1250);
    };

    const scan = () => {
      document.querySelectorAll('video.liveMainVideo.liveLocalPreview, video.liveGuestSelfVideo').forEach(recover);
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
      timers.forEach(id => window.clearTimeout(id));
      timers.clear();
    };
  }, []);

  return <style>{guestSplitCss}</style>;
}
