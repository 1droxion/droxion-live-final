import { Room, RoomEvent } from 'livekit-client';
import { supabase } from '../supabaseClient';
import {
  attachRemoteTrack,
  detachRemoteTrack,
  publishLocalMedia as publishLegacyManagedMedia,
  replacePublishedVideo,
  setPublishedAudioMuted,
  setPublishedVideoMuted,
  unlockRemoteAudio
} from './livekitRoomLegacy';

const TOKEN_FUNCTION = 'livekit-token';
const CONNECT_TIMEOUT_MS = 8000;
const CONNECT_ATTEMPTS = 2;
const CONNECT_RETRY_DELAY_MS = 350;
const roomMeta = new WeakMap();
const mediaByRoom = new WeakMap();

const CLIENT_INSTANCE_ID = (() => {
  try {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 24);
    }
  } catch {}
  return `regular${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, 24);
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

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function logClientError(stage, error, context = {}) {
  try {
    await supabase.rpc('droxion_log_live_client_error', {
      p_stage: stage,
      p_message: String(error?.message || error || 'unknown LIVE transport error'),
      p_stack: String(error?.stack || ''),
      p_context: context
    });
  } catch {}
}

async function getToken(sessionId, role) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in before joining LIVE.');

  const { data, error } = await supabase.functions.invoke(TOKEN_FUNCTION, {
    body: { sessionId, role, clientInstanceId: CLIENT_INSTANCE_ID },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (error) throw new Error(data?.error || error.message || 'Could not authorize LIVE connection.');
  if (!data?.token || !data?.url) throw new Error(data?.error || 'LIVE connection token is missing.');
  return data;
}

function normalizedParticipant(participant) {
  if (!participant) return participant;
  let metadata = {};
  try {
    metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
  } catch {}
  const rawIdentity = String(participant.identity || '');
  const identity = String(metadata?.droxionUserId || rawIdentity.split('::')[0] || rawIdentity);
  if (!identity || identity === rawIdentity) return participant;
  return {
    identity,
    rawIdentity,
    metadata: participant.metadata,
    name: participant.name,
    sid: participant.sid
  };
}

function publicationsOf(participant) {
  if (!participant) return [];
  if (participant.getTrackPublications) return participant.getTrackPublications() || [];
  if (participant.trackPublications?.values) return Array.from(participant.trackPublications.values());
  return [];
}

function subscribePublication(publication) {
  try {
    if (typeof publication?.setSubscribed === 'function' && !publication.isSubscribed) publication.setSubscribed(true);
  } catch {}
}

function replayRemoteTracks(room) {
  const meta = roomMeta.get(room);
  if (!meta) return;
  const participants = room.remoteParticipants?.values
    ? Array.from(room.remoteParticipants.values())
    : [];

  participants.forEach(participant => {
    const appParticipant = normalizedParticipant(participant);
    publicationsOf(participant).forEach(publication => {
      subscribePublication(publication);
      if (publication?.track) {
        meta.handlers.onTrackSubscribed?.(publication.track, publication, appParticipant);
      }
    });
  });
}

function bindRoomEvents(room) {
  const meta = roomMeta.get(room);
  if (!meta) return;
  const { handlers, sessionId, role } = meta;

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    handlers.onTrackSubscribed?.(track, publication, normalizedParticipant(participant));
  });
  room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
    handlers.onTrackUnsubscribed?.(track, publication, normalizedParticipant(participant));
  });
  room.on(RoomEvent.TrackPublished, (publication, participant) => {
    subscribePublication(publication);
    handlers.onParticipantConnected?.(normalizedParticipant(participant));
    window.setTimeout(() => replayRemoteTracks(room), 40);
  });
  room.on(RoomEvent.TrackSubscriptionFailed, (trackSid, participant) => {
    logClientError('regular-v2-track-subscription-failed', new Error('Remote LIVE track subscription failed.'), {
      sessionId,
      role,
      trackSid: String(trackSid || ''),
      participant: String(normalizedParticipant(participant)?.identity || '')
    });
  });
  room.on(RoomEvent.ParticipantConnected, participant => {
    handlers.onParticipantConnected?.(normalizedParticipant(participant));
    window.setTimeout(() => replayRemoteTracks(room), 40);
  });
  room.on(RoomEvent.ParticipantDisconnected, participant => {
    handlers.onParticipantDisconnected?.(normalizedParticipant(participant));
  });
  room.on(RoomEvent.Reconnecting, (...args) => handlers.onReconnecting?.(...args));
  room.on(RoomEvent.Reconnected, (...args) => {
    const media = mediaByRoom.get(room);
    const republish = media && (role === 'host' || role === 'guest')
      ? publishLegacyManagedMedia(room, media)
      : Promise.resolve();
    Promise.resolve(republish).then(() => {
      replayRemoteTracks(room);
      window.setTimeout(() => replayRemoteTracks(room), 150);
      handlers.onReconnected?.(...args);
    }).catch(error => {
      logClientError('regular-v2-republish', error, { sessionId, role });
      handlers.onDisconnected?.(error);
    });
  });
  room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
    handlers.onAudioPlaybackChanged?.(room.canPlaybackAudio !== false);
  });
  room.on(RoomEvent.Disconnected, reason => {
    if (!meta.suppressDisconnect) handlers.onDisconnected?.(reason);
  });
}

function createRoom(sessionId, role, handlers) {
  const publishingRole = role === 'host' || role === 'guest';
  const room = new Room({
    adaptiveStream: !publishingRole,
    dynacast: publishingRole,
    disconnectOnPageLeave: true,
    stopLocalTrackOnUnpublish: false
  });
  roomMeta.set(room, {
    sessionId: String(sessionId),
    role,
    handlers,
    suppressDisconnect: false
  });
  bindRoomEvents(room);
  return room;
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
  onReconnected,
  onAudioPlaybackChanged
}) {
  if (!sessionId) throw new Error('LIVE session ID is missing.');
  const normalizedRole = String(role || 'viewer').trim().toLowerCase();
  const handlers = {
    onTrackSubscribed,
    onTrackUnsubscribed,
    onDisconnected,
    onParticipantConnected,
    onParticipantDisconnected,
    onReconnecting,
    onReconnected,
    onAudioPlaybackChanged
  };

  let lastError = null;
  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt += 1) {
    const auth = await getToken(sessionId, normalizedRole);
    const room = createRoom(sessionId, normalizedRole, handlers);

    try {
      await withTimeout(
        room.connect(auth.url, auth.token, { autoSubscribe: true }),
        CONNECT_TIMEOUT_MS,
        'LIVE video connection timed out.'
      );
      replayRemoteTracks(room);
      window.setTimeout(() => replayRemoteTracks(room), 150);
      window.setTimeout(() => replayRemoteTracks(room), 600);
      return { room, auth };
    } catch (error) {
      lastError = error;
      await logClientError('regular-v2-connect', error, {
        sessionId,
        role: normalizedRole,
        attempt,
        maxAttempts: CONNECT_ATTEMPTS
      });
      const meta = roomMeta.get(room);
      if (meta) meta.suppressDisconnect = true;
      roomMeta.delete(room);
      mediaByRoom.delete(room);
      try { await room.disconnect(true); } catch {}
      if (attempt < CONNECT_ATTEMPTS) {
        handlers.onReconnecting?.();
        await wait(CONNECT_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError || new Error('Could not connect to LIVE video.');
}

export async function publishLocalMedia(room, mediaStream) {
  if (!room || !mediaStream) throw new Error('LIVE room or camera stream is missing.');
  const liveVideo = mediaStream.getVideoTracks?.().find(track => track.readyState === 'live');
  if (!liveVideo) throw new Error('LIVE camera track is missing or ended.');
  mediaByRoom.set(room, mediaStream);
  try {
    return await publishLegacyManagedMedia(room, mediaStream);
  } catch (error) {
    const meta = roomMeta.get(room);
    await logClientError('regular-v2-publish', error, {
      sessionId: meta?.sessionId || '',
      role: meta?.role || '',
      videoTrackCount: mediaStream.getVideoTracks?.().length || 0,
      liveVideoTrackCount: mediaStream.getVideoTracks?.().filter(track => track.readyState === 'live').length || 0,
      audioTrackCount: mediaStream.getAudioTracks?.().length || 0
    });
    throw error;
  }
}

export async function recoverLiveKitAfterForeground(room, mediaStream) {
  if (!room) return;
  const meta = roomMeta.get(room);
  if (!meta) return;
  const state = String(room.state || room.connectionState || '').toLowerCase();

  if (state === 'disconnected') {
    let lastError = null;
    for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt += 1) {
      try {
        const auth = await getToken(meta.sessionId, meta.role);
        await withTimeout(
          room.connect(auth.url, auth.token, { autoSubscribe: true }),
          CONNECT_TIMEOUT_MS,
          'LIVE video reconnection timed out.'
        );
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        await logClientError('regular-v2-reconnect', error, {
          sessionId: meta.sessionId,
          role: meta.role,
          attempt,
          maxAttempts: CONNECT_ATTEMPTS
        });
        if (attempt < CONNECT_ATTEMPTS) await wait(CONNECT_RETRY_DELAY_MS);
      }
    }
    if (lastError) throw lastError;
  }

  if (mediaStream && (meta.role === 'host' || meta.role === 'guest')) {
    mediaByRoom.set(room, mediaStream);
    await publishLocalMedia(room, mediaStream);
  }
  replayRemoteTracks(room);
  window.setTimeout(() => replayRemoteTracks(room), 150);
}

export async function disconnectLiveKitRoom(room) {
  if (!room) return;
  const meta = roomMeta.get(room);
  if (meta) meta.suppressDisconnect = true;
  roomMeta.delete(room);
  mediaByRoom.delete(room);
  try { await room.disconnect(); } catch {}
}

export {
  attachRemoteTrack,
  detachRemoteTrack,
  replacePublishedVideo,
  setPublishedAudioMuted,
  setPublishedVideoMuted,
  unlockRemoteAudio
};
