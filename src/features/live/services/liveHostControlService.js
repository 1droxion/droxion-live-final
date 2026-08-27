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

async function setPublicationMuted(room, source, muted) {
  const publication = getPublication(room, source);
  const localTrack = publication?.track;
  if (!localTrack) {
    throw new Error(source === Track.Source.Microphone
      ? 'LIVE microphone control is unavailable.'
      : 'LIVE camera control is unavailable.');
  }

  if (muted) await localTrack.mute?.();
  else await localTrack.unmute?.();

  return Boolean(publication.isMuted ?? localTrack.isMuted ?? muted);
}

export async function setHostMicrophoneMuted(room, muted) {
  return setPublicationMuted(room, Track.Source.Microphone, Boolean(muted));
}

export async function setHostCameraMuted(room, muted) {
  return setPublicationMuted(room, Track.Source.Camera, Boolean(muted));
}
