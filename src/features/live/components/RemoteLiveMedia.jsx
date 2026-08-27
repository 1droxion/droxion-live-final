import { useEffect, useRef, useState } from 'react';

export default function RemoteLiveMedia({ videoTrack, audioTrack }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoTrack) return undefined;
    videoTrack.attach(video);
    video.playsInline = true;
    video.autoplay = true;
    video.play?.().catch?.(() => {});
    return () => {
      try { videoTrack.detach(video); } catch {}
    };
  }, [videoTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioTrack) {
      setAudioReady(false);
      return undefined;
    }
    audioTrack.attach(audio);
    setAudioReady(true);
    audio.autoplay = true;
    audio.play?.().catch?.(() => {});
    return () => {
      try { audioTrack.detach(audio); } catch {}
    };
  }, [audioTrack]);

  const enableSound = () => {
    audioRef.current?.play?.().catch?.(() => {});
  };

  return (
    <div className="liveV2RemoteMedia">
      <video ref={videoRef} className="liveV2Video" playsInline autoPlay />
      <audio ref={audioRef} autoPlay />
      {!videoTrack && <div className="liveV2Waiting">Waiting for creator video…</div>}
      {audioReady && <button className="liveV2SoundButton" type="button" onClick={enableSound}>Enable sound</button>}
    </div>
  );
}
