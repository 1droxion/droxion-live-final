import { Track } from 'livekit-client';

function getPublication(room, source) {
  if (!room?.localParticipant) return null;
  const direct = room.localParticipant.getTrackPublication?.(source);
  if (direct?.track) return direct;
  const publications = room.localParticipant.trackPublications?.values
    ? Array.from(room.localParticipant.trackPublications.values())
    : [];
  return publications.find(publication =>
    publication?.track && (publication.source === source || publication.track?.source === source)
  ) || null;
}

function mediaTrackOf(localTrack) {
  return localTrack?.mediaStreamTrack || localTrack || null;
}

function cameraPublishOptions() {
  return {
    source: Track.Source.Camera,
    name: 'droxion_camera',
    simulcast: true,
    videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 },
    videoCodec: undefined
  };
}

async function setPublicationMuted(room, source, muted) {
  const publication = getPublication(room, source);
  const localTrack = publication?.track;
  const mediaTrack = mediaTrackOf(localTrack);

  if (!localTrack || !mediaTrack) {
    throw new Error(source === Track.Source.Microphone
      ? 'LIVE microphone control is unavailable.'
      : 'LIVE camera control is unavailable.');
  }

  // Keep this operation scoped to the exact already-published LocalTrack.
  // We do not reconnect, republish, restart the room, or replace the session.
  if (muted) {
    try { mediaTrack.enabled = false; } catch {}
    if (typeof localTrack.mute === 'function') await Promise.resolve(localTrack.mute());
  } else {
    try { mediaTrack.enabled = true; } catch {}
    if (typeof localTrack.unmute === 'function') await Promise.resolve(localTrack.unmute());
    try {
      const activeTrack = mediaTrackOf(localTrack);
      if (activeTrack?.readyState === 'live') activeTrack.enabled = true;
    } catch {}
  }

  return Boolean(publication.isMuted ?? localTrack.isMuted ?? muted);
}

export async function setHostMicrophoneMuted(room, muted) {
  return setPublicationMuted(room, Track.Source.Microphone, Boolean(muted));
}

export async function setHostCameraMuted(room, muted) {
  return setPublicationMuted(room, Track.Source.Camera, Boolean(muted));
}

export async function switchHostCameraFacing(room, stream, facingMode, orientation = 'vertical') {
  const publication = getPublication(room, Track.Source.Camera);
  const localTrack = publication?.track;
  const previousMediaTrack = mediaTrackOf(localTrack);

  if (!localTrack || typeof localTrack.restartTrack !== 'function') {
    throw new Error('Camera switching is unavailable on this device.');
  }

  const nextFacing = facingMode === 'environment' ? 'environment' : 'user';
  const portrait = orientation !== 'horizontal';
  const wasMuted = Boolean(publication?.isMuted ?? localTrack?.isMuted ?? false);

  // Restart the capture first so mobile Safari/Capacitor can release the old
  // lens before opening the other one. The creator preview updates from this
  // same LocalVideoTrack.
  await localTrack.restartTrack({
    facingMode: nextFacing,
    resolution: {
      width: portrait ? 720 : 1280,
      height: portrait ? 1280 : 720,
      frameRate: 30
    }
  });

  const nextMediaTrack = mediaTrackOf(localTrack);
  if (!nextMediaTrack || nextMediaTrack.readyState !== 'live') {
    throw new Error('Droxion could not switch the camera.');
  }

  // A LocalVideoTrack restart can update the host preview while some mobile
  // WebRTC stacks leave the existing sender/publication stale for viewers.
  // Force a new Camera publication with the restarted track so every remote
  // subscriber gets a fresh TrackSubscribed event and the new lens immediately.
  if (room?.localParticipant?.unpublishTrack && room?.localParticipant?.publishTrack) {
    await room.localParticipant.unpublishTrack(localTrack, false);
    try {
      const nextPublication = await room.localParticipant.publishTrack(localTrack, cameraPublishOptions());
      if (wasMuted) await Promise.resolve(nextPublication?.mute?.());
    } catch (error) {
      // Best-effort restore: keep the restarted camera live even if the first
      // republish attempt failed transiently.
      try {
        const restored = await room.localParticipant.publishTrack(localTrack, cameraPublishOptions());
        if (wasMuted) await Promise.resolve(restored?.mute?.());
      } catch {}
      throw error;
    }
  }

  // Keep the local preview on the same MediaStream object while LiveKit uses
  // the freshly republished LocalVideoTrack for current viewers.
  if (stream && previousMediaTrack !== nextMediaTrack) {
    try { if (previousMediaTrack && stream.getTracks().includes(previousMediaTrack)) stream.removeTrack(previousMediaTrack); } catch {}
    try { if (!stream.getTracks().includes(nextMediaTrack)) stream.addTrack(nextMediaTrack); } catch {}
  }

  return nextFacing;
}
