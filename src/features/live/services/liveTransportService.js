import { Room, RoomEvent } from 'livekit-client';
import { supabase } from '../../../supabaseClient';
import { publishHostMediaV2 } from './livePublisherService';

const TOKEN_FUNCTION = 'livekit-token';
const CONNECT_TIMEOUT_MS = 10000;
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

async function logTransportFailure(stage, error, context = {}) {
  try {
    await supabase.rpc('droxion_log_live_client_error', {
      p_stage: stage,
      p_message: String(error?.message || error || 'unknown LIVE transport error'),
      p_stack: String(error?.stack || ''),
      p_context: context
    });
  } catch {}
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

function publicationsOf(participant) {
  if (!participant) return [];
  if (typeof participant.getTrackPublications === 'function') return participant.getTrackPublications() || [];
  if (participant.trackPublications?.values) return Array.from(participant.trackPublications.values());
  return [];
}

function replayRemoteTracks(room, callbacks = {}) {
  if (!room || !callbacks.onTrackSubscribed) return;
  const participants = room.remoteParticipants?.values ? Array.from(room.remoteParticipants.values()) : [];
  participants.forEach(participant => {
    publicationsOf(participant).forEach(publication => {
      try {
        if (typeof publication?.setSubscribed === 'function' && !publication.isSubscribed) publication.setSubscribed(true);
      } catch {}
      if (publication?.track) callbacks.onTrackSubscribed(publication.track, publication, participant);
    });
  });
}

function bindRoomEvents(room, callbacks = {}) {
  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    callbacks.onTrackSubscribed?.(track, publication, participant);
  });
  room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
    callbacks.onTrackUnsubscribed?.(track, publication, participant);
  });
  room.on(RoomEvent.TrackPublished, publication => {
    try { publication?.setSubscribed?.(true); } catch {}
    window.setTimeout(() => replayRemoteTracks(room, callbacks), 30);
  });
  room.on(RoomEvent.ParticipantConnected, participant => {
    callbacks.onParticipantChange?.(participant);
    window.setTimeout(() => replayRemoteTracks(room, callbacks), 30);
  });
  room.on(RoomEvent.ParticipantDisconnected, participant => callbacks.onParticipantChange?.(participant));
  room.on(RoomEvent.Reconnecting, () => callbacks.onReconnecting?.());
  room.on(RoomEvent.Reconnected, () => {
    replayRemoteTracks(room, callbacks);
    window.setTimeout(() => replayRemoteTracks(room, callbacks), 150);
    callbacks.onReconnected?.();
  });
  room.on(RoomEvent.Disconnected, reason => callbacks.onDisconnected?.(reason));
}

async function connectRoom(sessionId, role, callbacks) {
  const auth = await getLiveKitToken(sessionId, role);
  const room = new Room({
    adaptiveStream: role !== 'host',
    dynacast: role === 'host',
    disconnectOnPageLeave: true,
    stopLocalTrackOnUnpublish: false
  });
  bindRoomEvents(room, callbacks);

  try {
    await withTimeout(
      room.connect(auth.url, auth.token, { autoSubscribe: true }),
      CONNECT_TIMEOUT_MS,
      'LIVE video connection timed out.'
    );
    // Critical for viewers joining an already-running LIVE: TrackSubscribed can
    // fire while React is still committing the viewer screen. Replay all
    // authoritative remote publications after connect so the video element
    // always receives the host track instead of staying on a black page.
    replayRemoteTracks(room, callbacks);
    window.setTimeout(() => replayRemoteTracks(room, callbacks), 100);
    window.setTimeout(() => replayRemoteTracks(room, callbacks), 400);
    window.setTimeout(() => replayRemoteTracks(room, callbacks), 1000);
    return room;
  } catch (error) {
    await logTransportFailure('v2-room-connect', error, { sessionId, role });
    try { await room.disconnect(); } catch {}
    throw error;
  }
}

export async function connectHostTransport({ sessionId, stream, callbacks = {} }) {
  const room = await connectRoom(sessionId, 'host', callbacks);

  try {
    const published = await publishHostMediaV2({
      room,
      stream,
      logFailure: (stage, error, context) => logTransportFailure(stage, error, { sessionId, ...context })
    });
    return { room, ...published };
  } catch (error) {
    await logTransportFailure('v2-host-publish', error, { sessionId });
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
