import { Room, RoomEvent, Track } from 'livekit-client';
import { supabase } from '../../../supabaseClient';

const TOKEN_FUNCTION = 'livekit-token';
const CONNECT_TIMEOUT_MS = 10000;
const PUBLISH_TIMEOUT_MS = 10000;
const CLIENT_INSTANCE_ID = (() => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 24);
  } catch {}
  return `v2${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.slice(0, 24);
})();

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(promise).then(value => {
      window.clearTimeout(timer);
      resolve(value);
    }).catch(error => {
      window.clearTimeout(timer);
      reject(error);
    });
  });
}

async function getLiveKitToken(sessionId, role) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in before using LIVE.');

  const { data, error } = await supabase.functions.invoke(TOKEN_FUNCTION, {
    body: { sessionId, role, clientInstanceId: CLIENT_INSTANCE_ID },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (error) throw new Error(data?.error || error.message || 'Could not authorize LIVE video.');
  if (!data?.url || !data?.token) throw new Error(data?.error || 'LIVE video authorization is incomplete.');
  return data;
}

function bindRoomEvents(room, callbacks = {}) {
  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    callbacks.onTrackSubscribed?.(track, publication, participant);
  });
  room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
    callbacks.onTrackUnsubscribed?.(track, publication, participant);
  });
  room.on(RoomEvent.ParticipantConnected, participant => callbacks.onParticipantChange?.(participant));
  room.on(RoomEvent.ParticipantDisconnected, participant => callbacks.onParticipantChange?.(participant));
  room.on(RoomEvent.Reconnecting, () => callbacks.onReconnecting?.());
  room.on(RoomEvent.Reconnected, () => callbacks.onReconnected?.());
  room.on(RoomEvent.Disconnected, reason => callbacks.onDisconnected?.(reason));
}

async function connectRoom(sessionId, role, callbacks) {
  const auth = await getLiveKitToken(sessionId, role);
  const room = new Room({
    adaptiveStream: role !== 'host',
    dynacast: role === 'host'
  });
  bindRoomEvents(room, callbacks);

  try {
    await withTimeout(
      room.connect(auth.url, auth.token, { autoSubscribe: true }),
      CONNECT_TIMEOUT_MS,
      'LIVE video connection timed out.'
    );
    return room;
  } catch (error) {
    try { await room.disconnect(); } catch {}
    throw error;
  }
}

export async function connectHostTransport({ sessionId, stream, callbacks = {} }) {
  const room = await connectRoom(sessionId, 'host', callbacks);
  const videoTrack = stream?.getVideoTracks?.().find(track => track.readyState === 'live');
  const audioTrack = stream?.getAudioTracks?.().find(track => track.readyState === 'live');

  if (!videoTrack || !audioTrack) {
    try { await room.disconnect(); } catch {}
    throw new Error('Camera or microphone stopped before LIVE connected.');
  }

  try {
    const [videoPublication, audioPublication] = await withTimeout(
      Promise.all([
        room.localParticipant.publishTrack(videoTrack, {
          source: Track.Source.Camera,
          simulcast: true
        }),
        room.localParticipant.publishTrack(audioTrack, {
          source: Track.Source.Microphone
        })
      ]),
      PUBLISH_TIMEOUT_MS,
      'Camera or microphone publishing timed out.'
    );

    return { room, videoPublication, audioPublication };
  } catch (error) {
    try { await room.disconnect(); } catch {}
    throw error;
  }
}

export async function connectViewerTransport({ sessionId, callbacks = {} }) {
  return connectRoom(sessionId, 'viewer', callbacks);
}

export async function disconnectTransport(room) {
  if (!room) return;
  try { await room.disconnect(); } catch {}
}
