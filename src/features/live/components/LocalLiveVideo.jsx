import { useEffect, useRef } from 'react';
import { mediaTrackSnapshot, recordScreenShareDiagnostic, startVideoFrameDiagnostics } from '../../../livekit/screenShareDiagnostics';

function attachVideo(video, stream) {
  if (!video) return () => {};

  video.srcObject = stream || null;
  video.style.display = stream ? 'block' : 'none';
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute('playsinline', '');

  if (!stream) return () => {
    video.srcObject = null;
  };

  let stopped = false;
  const videoTrack = stream.getVideoTracks?.()[0] || null;

  const play = () => {
    if (stopped || video.srcObject !== stream) return;
    try {
      const result = video.play?.();
      if (result?.catch) result.catch(() => {});
    } catch {}
  };

  const recoverIfBlank = () => {
    if (stopped || video.srcObject !== stream || videoTrack?.readyState !== 'live') return;
    // WKWebView can keep a live camera track publishing while the local video
    // surface goes black after the LIVE UI changes to fullscreen. Reattaching
    // only this local preview does not replace, stop, or republish the track.
    if (video.videoWidth === 0 || video.readyState < 2) {
      try {
        video.srcObject = null;
        video.srcObject = stream;
      } catch {}
    }
    play();
  };

  video.addEventListener('loadedmetadata', play);
  video.addEventListener('canplay', play);
  videoTrack?.addEventListener?.('unmute', recoverIfBlank);
  const animationFrame = window.requestAnimationFrame(play);
  const recoveryTimer = window.setInterval(recoverIfBlank, 900);

  return () => {
    stopped = true;
    window.cancelAnimationFrame(animationFrame);
    window.clearInterval(recoveryTimer);
    video.removeEventListener('loadedmetadata', play);
    video.removeEventListener('canplay', play);
    videoTrack?.removeEventListener?.('unmute', recoverIfBlank);
    if (video.srcObject === stream) video.srcObject = null;
  };
}

function applyStudioLayout(wrapper, screenVideo, facecamVideo, meta) {
  if (!wrapper || !screenVideo || !meta) return;
  const orientation = String(meta.orientation || 'horizontal');
  const layout = String(meta.layout || (orientation === 'vertical' ? 'split_70_30' : 'free_facecam'));
  const position = meta.facecamPosition || { x: 0.735, y: 0.64, size: 0.235 };

  screenVideo.style.position = 'absolute';
  screenVideo.style.left = '0';
  screenVideo.style.top = '0';
  screenVideo.style.width = '100%';
  screenVideo.style.background = '#000';
  screenVideo.style.objectFit = 'contain';
  screenVideo.style.transform = 'none';

  if (!facecamVideo) {
    screenVideo.style.height = '100%';
    return;
  }

  facecamVideo.style.position = 'absolute';
  facecamVideo.style.zIndex = '5';
  facecamVideo.style.objectFit = 'cover';
  facecamVideo.style.background = '#09090c';

  if (orientation === 'vertical') {
    const split = layout === 'split_50_50' ? 50 : 70;
    screenVideo.style.height = `${split}%`;
    facecamVideo.style.left = '0';
    facecamVideo.style.top = `${split}%`;
    facecamVideo.style.width = '100%';
    facecamVideo.style.height = `${100 - split}%`;
    facecamVideo.style.border = '0';
    facecamVideo.style.borderRadius = '0';
    return;
  }

  screenVideo.style.height = '100%';
  const size = Math.min(0.38, Math.max(0.16, Number(position.size) || 0.235));
  const x = Math.min(0.988 - size, Math.max(0.012, Number(position.x) || 0.735));
  const y = Math.min(0.82, Math.max(0.018, Number(position.y) || 0.64));
  facecamVideo.style.left = `${x * 100}%`;
  facecamVideo.style.top = `${y * 100}%`;
  facecamVideo.style.width = `${size * 100}%`;
  facecamVideo.style.height = 'auto';
  facecamVideo.style.aspectRatio = '4 / 3';
  facecamVideo.style.border = '2px solid rgba(255,255,255,.94)';
  facecamVideo.style.borderRadius = '14px';
  facecamVideo.style.boxShadow = '0 10px 30px rgba(0,0,0,.36)';
}

export default function LocalLiveVideo({ stream }) {
  const wrapperRef = useRef(null);
  const mainVideoRef = useRef(null);
  const facecamVideoRef = useRef(null);

  useEffect(() => {
    const mainVideo = mainVideoRef.current;
    const facecamVideo = facecamVideoRef.current;
    const wrapper = wrapperRef.current;
    if (!mainVideo) return undefined;

    // Do not mirror the entire local-video wrapper. A transformed fullscreen
    // wrapper can render black in a native WKWebView, and it also mirrors
    // screen/game content. Camera mirroring, where wanted, belongs on a camera
    // element only, never on the whole stage.
    if (wrapper) wrapper.style.transform = 'none';

    const studio = stream?.__droxionStudio || null;
    const videoTracks = stream?.getVideoTracks?.().filter(track => track.readyState === 'live') || [];

    if (!studio) {
      const cameraTrack = videoTracks[0] || null;
      const cameraStream = cameraTrack ? new MediaStream([cameraTrack]) : null;
      const detachMain = attachVideo(mainVideo, cameraStream);
      const detachFacecam = attachVideo(facecamVideo, null);
      mainVideo.style.transform = 'none';

      return () => {
        detachMain();
        detachFacecam();
      };
    }

    const screenTrack = videoTracks.find(track => track.__droxionSource === 'screen') || videoTracks[0] || null;
    const cameraTrack = videoTracks.find(track => track.__droxionSource === 'camera') || videoTracks.find(track => track !== screenTrack) || null;
    const screenStream = screenTrack ? new MediaStream([screenTrack]) : null;
    const cameraStream = cameraTrack ? new MediaStream([cameraTrack]) : null;
    const detachMain = attachVideo(mainVideo, screenStream);
    const detachFacecam = attachVideo(facecamVideo, cameraStream);

    recordScreenShareDiagnostic('host-capture-attached', {
      track: mediaTrackSnapshot(screenTrack),
      mode: String(studio.mode || ''),
      orientation: String(studio.orientation || ''),
      displaySurface: String(studio.displaySurface || '')
    });
    const stopFrameDiagnostics = screenTrack
      ? startVideoFrameDiagnostics(mainVideo, { stage: 'host-capture-frames', track: screenTrack })
      : () => {};

    let stopped = false;
    const refreshLayout = () => {
      if (stopped) return;
      applyStudioLayout(wrapper, mainVideo, cameraTrack ? facecamVideo : null, stream.__droxionStudio || studio);
      window.setTimeout(refreshLayout, 80);
    };
    refreshLayout();

    return () => {
      stopped = true;
      stopFrameDiagnostics();
      detachMain();
      detachFacecam();
    };
  }, [stream]);

  return (
    <div ref={wrapperRef} className="liveV2LocalVideo liveStudioNativePreview">
      <video ref={mainVideoRef} className="liveV2Video liveStudioScreenPreview" muted playsInline autoPlay />
      <video ref={facecamVideoRef} className="liveV2Video liveStudioFacecamPreview" muted playsInline autoPlay />
    </div>
  );
}
