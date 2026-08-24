import { Room, RoomEvent, Track } from 'livekit-client';
import { supabase } from '../supabaseClient';

const TOKEN_FUNCTION = 'livekit-token';
const CAMERA_REPLACED_EVENT = 'droxion:live-camera-replaced';
const DISCONNECT_GRACE_MS = 750;
const RECONNECT_DELAYS_MS = [350, 900, 1800, 3200];

const activeConnections = new Map();
const roomKeys = new WeakMap();
const pendingDisconnects = new WeakMap();
const publishedMediaByRoom = new WeakMap();
const recoveringRooms = new WeakSet();
let latestPublisherRoom = null;

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

function makeHandlers({
  onTrackSubscribed,
  onTrackUnsubscribed,
  onDisconnected,
  onParticipantConnected,
  onParticipantDisconnected,
  onReconnecting,
  onReconnected
}) {
  return {
    onTrackSubscribed,
    onTrackUnsubscribed,
    onDisconnected,
    onParticipantConnected,
    onParticipantDisconnected,
    onReconnecting,
    onReconnected
  };
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
  if (latestPublisherRoom === room) latestPublisherRoom = null;
  roomKeys.delete(room);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function recoverUnexpectedDisconnect({ room, sessionId, role, entry, reason }) {
  if (!room || recoveringRooms.has(room) || pendingDisconnects.has(room)) return;
  recoveringRooms.add(room);
  entry.handlers?.onReconnecting?.();

  let lastError = null;
  for (const delay of RECONNECT_DELAYS_MS) {
    if (pendingDisconnects.has(room)) {
      recoveringRooms.delete(room);
      return;
    }

    await wait(delay);
    try {
      const auth = await getToken(sessionId, role);
      entry.auth = auth;
      await room.connect(auth.url, auth.token, { autoSubscribe: true });

      const savedMedia = publishedMediaByRoom.get(room);
      if (savedMedia?.active) await publishLocalMedia(room, savedMedia);

      recoveringRooms.delete(room);
      entry.handlers?.onReconnected?.();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  recoveringRooms.delete(room);
  removeConnection(room);
  entry.handlers?.onDisconnected?.(lastError || reason);
}

async function replacePublicationTrack(room, source, mediaStreamTrack, publishOptions = {}) {
  if (!room || !mediaStreamTrack || mediaStreamTrack.readyState === 'ended') {
    throw new Error('The local media track is not available.');
  }

  const publication = room.localParticipant.getTrackPublication(source);
  const localTrack = publication?.track;
  if (localTrack?.mediaStreamTrack?.id === mediaStreamTrack.id) return publication;

  if (localTrack?.replaceTrack) {
    try {
      await localTrack.replaceTrack(mediaStreamTrack);
      return publication;
    } catch {
      // Safari/iOS can leave an ended camera sender behind after switching.
    }
  }

  if (localTrack) {
    try { await room.localParticipant.unpublishTrack(localTrack); } catch {}
  }

  return room.localParticipant.publishTrack(mediaStreamTrack, {
    source,
    ...publishOptions
  });
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
  const handlers = makeHandlers({
    onTrackSubscribed,
    onTrackUnsubscribed,
    onDisconnected,
    onParticipantConnected,
    onParticipantDisconnected,
    onReconnecting,
    onReconnected
  });
  const existing = activeConnections.get(key);

  if (existing) {
    existing.handlers = handlers;
    if (existing.room) cancelPendingDisconnect(existing.room);
    const room = await existing.ready;
    cancelPendingDisconnect(room);
    return { room, auth: existing.auth };
  }

  const entry = { room: null, auth: null, ready: null, handlers };
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

      room.on(RoomEvent.TrackSubscribed, (...args) => entry.handlers?.onTrackSubscribed?.(...args));
      room.on(RoomEvent.TrackUnsubscribed, (...args) => entry.handlers?.onTrackUnsubscribed?.(...args));
      room.on(RoomEvent.ParticipantConnected, (...args) => entry.handlers?.onParticipantConnected?.(...args));
      room.on(RoomEvent.ParticipantDisconnected, (...args) => entry.handlers?.onParticipantDisconnected?.(...args));
      room.on(RoomEvent.Reconnecting, (...args) => entry.handlers?.onReconnecting?.(...args));
      room.on(RoomEvent.Reconnected, (...args) => entry.handlers?.onReconnected?.(...args));

      room.on(RoomEvent.Disconnected, reason => {
        const intentionallyClosing = pendingDisconnects.has(room);
        if (intentionallyClosing) {
          removeConnection(room);
          return;
        }

        recoverUnexpectedDisconnect({ room, sessionId, role, entry, reason })
          .catch(() => entry.handlers?.onDisconnected?.(reason));
      });

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
  publishedMediaByRoom.set(room, mediaStream);
  if (mediaStream.getVideoTracks().some(track => track.readyState !== 'ended')) latestPublisherRoom = room;

  const publications = [];
  for (const track of mediaStream.getTracks()) {
    if (track.readyState === 'ended') continue;
    const source = track.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone;
    const publication = await replacePublicationTrack(room, source, track, {
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

  await replacePublicationTrack(room, Track.Source.Camera, mediaStreamTrack, {
    simulcast: true,
    videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 }
  });
  latestPublisherRoom = room;

  const savedMedia = publishedMediaByRoom.get(room);
  if (savedMedia) {
    const audioTracks = savedMedia.getAudioTracks().filter(track => track.readyState !== 'ended');
    publishedMediaByRoom.set(room, new MediaStream([mediaStreamTrack, ...audioTracks]));
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CAMERA_REPLACED_EVENT, {
      detail: {
        track: mediaStreamTrack,
        facingMode: mediaStreamTrack.getSettings?.()?.facingMode || ''
      }
    }));
  }
}

if (typeof window !== 'undefined') {
  window.__droxionReplacePublishedCamera = async mediaStreamTrack => {
    if (!latestPublisherRoom) throw new Error('LIVE video transport is not ready yet.');
    return replacePublishedVideo(latestPublisherRoom, mediaStreamTrack);
  };
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

  let resolvePending;
  const promise = new Promise(resolve => { resolvePending = resolve; });
  const timer = setTimeout(async () => {
    pendingDisconnects.delete(room);
    publishedMediaByRoom.delete(room);
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
