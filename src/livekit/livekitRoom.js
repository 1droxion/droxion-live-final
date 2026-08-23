import { Room, RoomEvent, Track } from 'livekit-client';
import { supabase } from '../supabaseClient';

const TOKEN_FUNCTION = 'livekit-token';

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
  onParticipantDisconnected
}) {
  const auth = await getToken(sessionId, role);
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    disconnectOnPageLeave: true
  });

  if (onTrackSubscribed) room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
  if (onTrackUnsubscribed) room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
  if (onDisconnected) room.on(RoomEvent.Disconnected, onDisconnected);
  if (onParticipantConnected) room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
  if (onParticipantDisconnected) room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);

  await room.connect(auth.url, auth.token, { autoSubscribe: role !== 'host' });
  return { room, auth };
}

export async function publishHostMedia(room, mediaStream) {
  if (!room || !mediaStream) throw new Error('LIVE room or camera stream is missing.');

  for (const track of mediaStream.getTracks()) {
    await room.localParticipant.publishTrack(track, {
      source: track.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone,
      simulcast: track.kind === 'video'
    });
  }
}

export function attachRemoteTrack(track, element) {
  if (!track || !element) return;
  track.attach(element);
}

export function detachRemoteTrack(track, element) {
  if (!track) return;
  if (element) track.detach(element);
  else track.detach();
}

export async function disconnectLiveKitRoom(room) {
  if (!room) return;
  try {
    await room.disconnect();
  } catch {
    // Best-effort cleanup; Supabase heartbeat remains the source of LIVE state.
  }
}
