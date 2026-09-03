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

  // Keep the local preview on the same MediaStream object while LiveKit keeps
  // publishing the restarted LocalVideoTrack to current viewers.
  if (stream && previousMediaTrack !== nextMediaTrack) {
    try { if (previousMediaTrack && stream.getTracks().includes(previousMediaTrack)) stream.removeTrack(previousMediaTrack); } catch {}
    try { if (!stream.getTracks().includes(nextMediaTrack)) stream.addTrack(nextMediaTrack); } catch {}
  }

  return nextFacing;
}
