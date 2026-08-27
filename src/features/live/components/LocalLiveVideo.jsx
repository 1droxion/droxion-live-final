import { useEffect, useRef } from 'react';

export default function LocalLiveVideo({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.srcObject = stream || null;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    if (stream) video.play?.().catch?.(() => {});
    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  return <video ref={videoRef} className="liveV2Video liveV2LocalVideo" muted playsInline autoPlay />;
}
