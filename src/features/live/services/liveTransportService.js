import { Room, RoomEvent } from 'livekit-client';
import { supabase } from '../../../supabaseClient';
import { rememberRemoteTrackMetadata, forgetRemoteTrackMetadata } from '../../../livekit/remoteTrackMetadata';
import { publishHostMediaV2 } from './livePublisherService';

const TOKEN_FUNCTION = 'livekit-token';
const CONNECT_TIMEOUT_MS = 10000;
const roomRoles = new WeakMap();
const CLIENT_INSTANCE_ID = (() => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 24);
  } catch {}
  return `v2${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.slice(0, 24);
})();

function emitViewerRoom(eventName, detail) {
  try { window.dispatchEvent(new CustomEvent(eventName, { detail })); } catch {}
}

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

function decorateRemoteTrack(track, publication) {
  if (!track || !publication) return track;

  // LiveKit RemoteTrack objects may be non-extensible in some builds. Keep the
  // authoritative publication metadata in a WeakMap so screen vs facecam
  // routing never depends on mutating a third-party track object.
  rememberRemoteTrackMetadata(track, publication);

  // Best-effort compatibility for older routing code.
  try {
    track.__droxionPublicationName = publication.trackName || publication.name || track.name || '';
    track.__droxionSource = publication.source || track.source || '';
  } catch {}
  return track;
}

function replayRemoteTracks(room, callbacks = {}) {
  if (!room || !callbacks.onTrackSubscribed) return;
  const participants = room.remoteParticipants?.values ? Array.from(room.remoteParticipants.values()) : [];
  participants.forEach(participant => {
    publicationsOf(participant).forEach(publication => {
      try {
        if (typeof publication?.setSubscribed === 'function' && !publication.isSubscribed) publication.setSubscribed(true);
      } catch {}
      if (publication?.track) callbacks.onTrackSubscribed(decorateRemoteTrack(publication.track, publication), publication, participant);
    });
  });
}

function bindRoomEvents(room, callbacks = {}) {
  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    callbacks.onTrackSubscribed?.(decorateRemoteTrack(track, publication), publication, participant);
  });
  room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
    callbacks.onTrackUnsubscribed?.(decorateRemoteTrack(track, publication), publication, participant);
    forgetRemoteTrackMetadata(track);
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
    adaptiveStream: role !== 'host' && role !== 'guest',
    dynacast: role === 'host' || role === 'guest',
    disconnectOnPageLeave: true,
    stopLocalTrackOnUnpublish: false
  });
  roomRoles.set(room, role);
  bindRoomEvents(room, callbacks);

  try {
    await withTimeout(
      room.connect(auth.url, auth.token, { autoSubscribe: true }),
      CONNECT_TIMEOUT_MS,
      'LIVE video connection timed out.'
    );
    replayRemoteTracks(room, callbacks);
    window.setTimeout(() => replayRemoteTracks(room, callbacks), 100);
    window.setTimeout(() => replayRemoteTracks(room, callbacks), 400);
    window.setTimeout(() => replayRemoteTracks(room, callbacks), 1000);
    if (role === 'viewer') emitViewerRoom('droxion:viewer-room-ready', { room, sessionId });
    return room;
  } catch (error) {
    roomRoles.delete(room);
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

export async function connectGuestTransport({ sessionId, stream, callbacks = {} }) {
  const room = await connectRoom(sessionId, 'guest', callbacks);
  try {
    const published = await publishHostMediaV2({
      room,
      stream,
      logFailure: (stage, error, context) => logTransportFailure(`guest-${stage}`, error, { sessionId, ...context })
    });
    return { room, ...published };
  } catch (error) {
    await logTransportFailure('v2-guest-publish', error, { sessionId });
    try { await room.disconnect(); } catch {}
    throw error;
  }
}

export async function disconnectTransport(room) {
  if (!room) return;
  const role = roomRoles.get(room);
  if (role === 'viewer') emitViewerRoom('droxion:viewer-room-closed', { room });
  roomRoles.delete(room);
  try { await room.disconnect(); } catch {}
}
