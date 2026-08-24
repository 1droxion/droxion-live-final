import { Room, RoomEvent, Track } from 'livekit-client';
import { supabase } from '../supabaseClient';

const TOKEN_FUNCTION = 'livekit-token';
const CAMERA_REPLACED_EVENT = 'droxion:live-camera-replaced';

async function getToken(sessionId, role) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in before joining LIVE.');

  const { data, error } = await supabase.functions.invoke(TOKEN_FUNCTION, {
    body: { sessionId, role },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (error) throw new Error(error.message || 'Could not authorize LIVE connection.');
  if (!data?.token || !data?.url) throw new Error(data?.error || 'LIVE connection token is missing.');
  return data;
}

export async function connectLiveKitRoom({
  sessionId,
  role = 'viewer',
  onTrackSubscribed,
  onTrackUnsubscribed,
  onDisconnected,
  onParticipantConnected,
  onParticipantDisconnected,
  onReconnecting,
  onReconnected
}) {
  const auth = await getToken(sessionId, role);
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    disconnectOnPageLeave: true,
    stopLocalTrackOnUnpublish: false
  });

  if (onTrackSubscribed) room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
  if (onTrackUnsubscribed) room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
  if (onDisconnected) room.on(RoomEvent.Disconnected, onDisconnected);
  if (onParticipantConnected) room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
  if (onParticipantDisconnected) room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
  if (onReconnecting) room.on(RoomEvent.Reconnecting, onReconnecting);
  if (onReconnected) room.on(RoomEvent.Reconnected, onReconnected);

  // Hosts must subscribe too so they can see an accepted guest.
  await room.connect(auth.url, auth.token, { autoSubscribe: true });
  return { room, auth };
}

export async function publishLocalMedia(room, mediaStream) {
  if (!room || !mediaStream) throw new Error('LIVE room or camera stream is missing.');

  const publications = [];
  for (const track of mediaStream.getTracks()) {
    const publication = await room.localParticipant.publishTrack(track, {
      source: track.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone,
      simulcast: track.kind === 'video',
      videoEncoding: track.kind === 'video' ? { maxBitrate: 2_500_000, maxFramerate: 30 } : undefined
    });
    publications.push(publication);
  }
  return publications;
}

export const publishHostMedia = publishLocalMedia;

export function attachRemoteTrack(track, element) {
  if (!track || !element) return;
  track.attach(element);
}

export function detachRemoteTrack(track, element) {
  if (!track) return;
  if (element) track.detach(element);
  else track.detach();
}

export async function replacePublishedVideo(room, mediaStreamTrack) {
  if (!room || !mediaStreamTrack) return;
  const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
  const localTrack = publication?.track;
  if (localTrack?.replaceTrack) {
    await localTrack.replaceTrack(mediaStreamTrack);
  } else {
    if (localTrack) await room.localParticipant.unpublishTrack(localTrack);
    await room.localParticipant.publishTrack(mediaStreamTrack, {
      source: Track.Source.Camera,
      simulcast: true,
      videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 }
    });
  }

  // Keep the automatic highlight recorder on the same physical camera as the LIVE.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CAMERA_REPLACED_EVENT, {
      detail: {
        track: mediaStreamTrack,
        facingMode: mediaStreamTrack.getSettings?.()?.facingMode || ''
      }
    }));
  }
}

export function setPublishedAudioMuted(room, muted) {
  const publication = room?.localParticipant?.getTrackPublication(Track.Source.Microphone);
  if (!publication) return;
  if (muted) publication.mute(); else publication.unmute();
}

export function setPublishedVideoMuted(room, muted) {
  const publication = room?.localParticipant?.getTrackPublication(Track.Source.Camera);
  if (!publication) return;
  if (muted) publication.mute(); else publication.unmute();
}

export async function disconnectLiveKitRoom(room) {
  if (!room) return;
  try {
    await room.disconnect();
  } catch {
    // Best-effort cleanup; Supabase heartbeat remains the source of LIVE state.
  }
}
