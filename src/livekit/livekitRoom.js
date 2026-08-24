import { Room, RoomEvent, Track } from 'livekit-client';
import { supabase } from '../supabaseClient';

const TOKEN_FUNCTION = 'livekit-token';
const CAMERA_REPLACED_EVENT = 'droxion:live-camera-replaced';
const DISCONNECT_GRACE_MS = 750;

// React/iOS can mount the LIVE transport twice within a few milliseconds while
// LIVE state settles. Reusing the in-flight/connected room prevents two
// LiveKit participants with the same identity from kicking each other out.
const activeConnections = new Map();
const roomKeys = new WeakMap();
const pendingDisconnects = new WeakMap();

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

function connectionKey(sessionId, role) {
  return `${String(sessionId || '').trim()}:${String(role || 'viewer').trim().toLowerCase()}`;
}

function cancelPendingDisconnect(room) {
  const pending = pendingDisconnects.get(room);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingDisconnects.delete(room);
  pending.resolve?.();
}

function removeConnection(room) {
  const key = roomKeys.get(room);
  if (key && activeConnections.get(key)?.room === room) activeConnections.delete(key);
  roomKeys.delete(room);
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
  const key = connectionKey(sessionId, role);
  const existing = activeConnections.get(key);

  // Reuse both an already-connected room and a connection that is still in
  // flight. This is the important iOS/React race: the second mount can arrive
  // before the first token request has even finished.
  if (existing) {
    if (existing.room) cancelPendingDisconnect(existing.room);
    const room = await existing.ready;
    cancelPendingDisconnect(room);
    return { room, auth: existing.auth };
  }

  const entry = { room: null, auth: null, ready: null };
  activeConnections.set(key, entry);

  entry.ready = (async () => {
    try {
      const auth = await getToken(sessionId, role);
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        disconnectOnPageLeave: true,
        stopLocalTrackOnUnpublish: false
      });

      entry.room = room;
      entry.auth = auth;
      roomKeys.set(room, key);

      if (onTrackSubscribed) room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      if (onTrackUnsubscribed) room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      if (onParticipantConnected) room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
      if (onParticipantDisconnected) room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      if (onReconnecting) room.on(RoomEvent.Reconnecting, onReconnecting);
      if (onReconnected) room.on(RoomEvent.Reconnected, onReconnected);

      room.on(RoomEvent.Disconnected, reason => {
        const intentionallyClosing = pendingDisconnects.has(room);
        removeConnection(room);
        if (!intentionallyClosing && onDisconnected) onDisconnected(reason);
      });

      // Hosts must subscribe too so they can see an accepted guest.
      await room.connect(auth.url, auth.token, { autoSubscribe: true });
      return room;
    } catch (error) {
      if (activeConnections.get(key) === entry) activeConnections.delete(key);
      if (entry.room) roomKeys.delete(entry.room);
      throw error;
    }
  })();

  const room = await entry.ready;
  return { room, auth: entry.auth };
}

export async function publishLocalMedia(room, mediaStream) {
  if (!room || !mediaStream) throw new Error('LIVE room or camera stream is missing.');

  const publications = [];
  for (const track of mediaStream.getTracks()) {
    const source = track.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone;
    const existing = room.localParticipant.getTrackPublication(source);
    const localTrack = existing?.track;

    // Idempotent publishing is important when the LIVE React effect quickly
    // reuses the same room during startup/reconciliation.
    if (localTrack) {
      const currentMediaTrack = localTrack.mediaStreamTrack;
      if (currentMediaTrack?.id === track.id) {
        publications.push(existing);
        continue;
      }
      if (localTrack.replaceTrack) {
        await localTrack.replaceTrack(track);
        publications.push(existing);
        continue;
      }
      await room.localParticipant.unpublishTrack(localTrack);
    }

    const publication = await room.localParticipant.publishTrack(track, {
      source,
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
  const alreadyPending = pendingDisconnects.get(room);
  if (alreadyPending) return alreadyPending.promise;

  // A short grace period lets an immediate React effect restart reclaim the
  // existing connection instead of disconnecting and creating a second token.
  let resolvePending;
  const promise = new Promise(resolve => { resolvePending = resolve; });
  const timer = setTimeout(async () => {
    pendingDisconnects.delete(room);
    removeConnection(room);
    try {
      await room.disconnect();
    } catch {
      // Best-effort cleanup; Supabase heartbeat remains the source of LIVE state.
    } finally {
      resolvePending();
    }
  }, DISCONNECT_GRACE_MS);

  pendingDisconnects.set(room, { timer, promise, resolve: resolvePending });
  return promise;
}
