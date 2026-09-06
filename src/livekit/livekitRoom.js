import { Track } from 'livekit-client';
import {
  publishLocalMedia as publishLocalMediaCompat,
  replacePublishedVideo as replacePublishedVideoCompat
} from './livekitRoomV2Compat';

// Production LIVE transport facade.
//
// The original implementation is preserved in livekitRoomLegacy.js for the
// helper functions used by the compatibility layer. All product-facing imports
// now resolve directly to the proven V2 connection path so the normal Droxion
// design and the isolated V2 test use the same LiveKit transport behavior.
export * from './livekitRoomV2Compat';
export {
  attachStudioAwareRemoteTrack as attachRemoteTrack,
  detachStudioAwareRemoteTrack as detachRemoteTrack
} from './viewerStudioTrackRouter';

let latestPublisherRoom = null;

function cameraPublication(room) {
  const participant = room?.localParticipant;
  if (!participant) return null;
  const direct = participant.getTrackPublication?.(Track.Source.Camera);
  if (direct?.track) return direct;
  const publications = participant.trackPublications?.values
    ? Array.from(participant.trackPublications.values())
    : [];
  return publications.find(publication =>
    publication?.track && (publication.source === Track.Source.Camera || publication.track?.source === Track.Source.Camera)
  ) || null;
}

async function keepPublishedCameraLive(room, fallbackTrack) {
  const publication = cameraPublication(room);
  const localTrack = publication?.track;
  const activeTrack = localTrack?.mediaStreamTrack || fallbackTrack;

  if (activeTrack?.readyState === 'live') activeTrack.enabled = true;
  if (publication?.isMuted || localTrack?.isMuted) {
    await publication?.unmute?.();
  }
  const confirmedTrack = localTrack?.mediaStreamTrack || fallbackTrack;
  if (confirmedTrack?.readyState === 'live') confirmedTrack.enabled = true;
}

export async function publishLocalMedia(room, mediaStream) {
  if (room) latestPublisherRoom = room;
  return publishLocalMediaCompat(room, mediaStream);
}

export async function replacePublishedVideo(room, mediaStreamTrack) {
  if (room) latestPublisherRoom = room;
  const result = await replacePublishedVideoCompat(room, mediaStreamTrack);
  if (room && mediaStreamTrack?.readyState === 'live') {
    await keepPublishedCameraLive(room, mediaStreamTrack);
    window.setTimeout(() => keepPublishedCameraLive(room, mediaStreamTrack).catch(() => {}), 120);
    window.setTimeout(() => keepPublishedCameraLive(room, mediaStreamTrack).catch(() => {}), 450);
  }
  return result;
}

if (typeof window !== 'undefined') {
  window.__droxionReplacePublishedCamera = async mediaStreamTrack => {
    if (!mediaStreamTrack || mediaStreamTrack.readyState === 'ended') return;
    if (!latestPublisherRoom) return replacePublishedVideoCompat(null, mediaStreamTrack);
    return replacePublishedVideo(latestPublisherRoom, mediaStreamTrack);
  };
}
