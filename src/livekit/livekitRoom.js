import { Room, RoomEvent, Track } from 'livekit-client';
import { supabase } from '../supabaseClient';

const TOKEN_FUNCTION = 'livekit-token';
const CAMERA_REPLACED_EVENT = 'droxion:live-camera-replaced';
const DISCONNECT_GRACE_MS = 750;
const RECONNECT_DELAYS_MS = [350, 900, 1800, 3200];
const PUBLISH_RETRY_DELAYS_MS = [0, 140, 420];

const activeConnections = new Map();
const roomKeys = new WeakMap();
const pendingDisconnects = new WeakMap();
const publishedMediaByRoom = new WeakMap();
const recoveringRooms = new WeakSet();
const closingRooms = new WeakSet();
let latestPublisherRoom = null;
let pendingPublisherVideoTrack = null;

async function getToken(sessionId, role) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in before joining LIVE.');

  const { data, error } = await supabase.functions.invoke(TOKEN_FUNCTION, {
    body: { sessionId, role },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (error) throw new Error(data?.error || error.message || 'Could not authorize LIVE connection.');
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

function replaySubscribedTracks(room, handlers) {
  if (!room || !handlers?.onTrackSubscribed) return;
  try {
    const participants = room.remoteParticipants?.values
      ? Array.from(room.remoteParticipants.values())
      : [];
    participants.forEach(participant => {
      const publications = participant.getTrackPublications?.()
        || (participant.trackPublications?.values
          ? Array.from(participant.trackPublications.values())
          : []);
      publications.forEach(publication => {
        if (publication?.track) {
          handlers.onTrackSubscribed(publication.track, publication, participant);
        }
      });
    });
  } catch {
    // Event delivery remains the primary path; replay is a safety net for room reuse.
  }
}

function cancelPendingDisconnect(room) {
  const pending = pendingDisconnects.get(room);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingDisconnects.delete(room);
  closingRooms.delete(room);
  pending.resolve?.();
  return true;
}

function protectReusedRoom(room) {
  // React can tear down an older LIVE effect a microtask after a newer effect
  // has reclaimed the same in-flight LiveKit room. Cancel that stale teardown
  // again on the next task so it cannot disconnect the active publisher/viewer.
  cancelPendingDisconnect(room);
  if (typeof queueMicrotask === 'function') queueMicrotask(() => cancelPendingDisconnect(room));
  setTimeout(() => cancelPendingDisconnect(room), 0);
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
  if (!room || closingRooms.has(room) || recoveringRooms.has(room) || pendingDisconnects.has(room)) return;
  recoveringRooms.add(room);
  entry.handlers?.onReconnecting?.();

  let lastError = null;
  for (const delay of RECONNECT_DELAYS_MS) {
    if (closingRooms.has(room) || pendingDisconnects.has(room)) {
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
      replaySubscribedTracks(room, entry.handlers);

      recoveringRooms.delete(room);
      entry.handlers?.onReconnected?.();
      return;
    } catch (error) {
      lastError = error;
      if (/ended|not active|not found/i.test(String(error?.message || ''))) break;
    }
  }

  recoveringRooms.delete(room);
  removeConnection(room);
  entry.handlers?.onDisconnected?.(lastError || reason);
}

async function publishRawTrackWithRetry(room, mediaStreamTrack, publishOptions) {
  let lastError = null;
  for (const delay of PUBLISH_RETRY_DELAYS_MS) {
    if (delay) await wait(delay);
    if (!mediaStreamTrack || mediaStreamTrack.readyState === 'ended') {
      throw new Error('The camera or microphone stopped before LIVE could publish it.');
    }

    // A stale React cleanup may have queued a disconnect for this exact room.
    // Publishing is proof that the room is actively owned, so reclaim it first.
    cancelPendingDisconnect(room);
    closingRooms.delete(room);

    try {
      const publication = await room.localParticipant.publishTrack(mediaStreamTrack, publishOptions);
      cancelPendingDisconnect(room);
      return publication;
    } catch (error) {
      lastError = error;
      // The iOS WebView can expose a transient null LocalTrack while a reused
      // room is finishing negotiation. Retrying the still-live raw track makes
      // LiveKit create a clean LocalTrack wrapper on the stable connection.
      if (mediaStreamTrack.readyState === 'ended') break;
    }
  }

  console.warn('Droxion LIVE media publish failed after retry', lastError);
  throw new Error(mediaStreamTrack?.kind === 'video'
    ? 'LIVE camera could not start. Restoring video…'
    : 'LIVE microphone could not start.');
}

async function replacePublicationTrack(room, source, mediaStreamTrack, publishOptions = {}) {
  if (!room || !mediaStreamTrack || mediaStreamTrack.readyState === 'ended') {
    throw new Error('The local media track is not available.');
  }

  cancelPendingDisconnect(room);
  closingRooms.delete(room);

  const publication = room.localParticipant.getTrackPublication(source);
  const localTrack = publication?.track;
  const existingMediaTrack = localTrack?.mediaStreamTrack;
  if (existingMediaTrack?.id && existingMediaTrack.id === mediaStreamTrack.id) return publication;

  // Only call replaceTrack when LiveKit still owns a healthy underlying track.
  // Calling it after a room-reuse teardown on iOS can hit a null internal track.
  if (localTrack?.replaceTrack && existingMediaTrack && existingMediaTrack.readyState !== 'ended') {
    try {
      await localTrack.replaceTrack(mediaStreamTrack);
      cancelPendingDisconnect(room);
      return publication;
    } catch {
      // Fall back to a clean publication below.
    }
  }

  if (localTrack) {
    try { await room.localParticipant.unpublishTrack(localTrack); } catch {}
    await wait(40);
  }

  return publishRawTrackWithRetry(room, mediaStreamTrack, {
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
    protectReusedRoom(room);
    replaySubscribedTracks(room, handlers);
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
      room.on(RoomEvent.Reconnected, (...args) => {
        replaySubscribedTracks(room, entry.handlers);
        entry.handlers?.onReconnected?.(...args);
      });

      room.on(RoomEvent.Disconnected, reason => {
        const intentionallyClosing = closingRooms.has(room) || pendingDisconnects.has(room);
        if (intentionallyClosing) {
          removeConnection(room);
          return;
        }

        recoverUnexpectedDisconnect({ room, sessionId, role, entry, reason })
          .catch(() => entry.handlers?.onDisconnected?.(reason));
      });

      await room.connect(auth.url, auth.token, { autoSubscribe: true });
      replaySubscribedTracks(room, entry.handlers);
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

  cancelPendingDisconnect(room);
  closingRooms.delete(room);
  publishedMediaByRoom.set(room, mediaStream);

  const videoTrack = mediaStream.getVideoTracks().find(track => track.readyState !== 'ended');
  const audioTrack = mediaStream.getAudioTracks().find(track => track.readyState !== 'ended');
  if (videoTrack) latestPublisherRoom = room;

  const publications = [];
  // Publish camera first. On iOS this makes the visual path deterministic and
  // avoids an audio negotiation racing the first camera publication.
  if (videoTrack) {
    publications.push(await replacePublicationTrack(room, Track.Source.Camera, videoTrack, {
      simulcast: true,
      videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 }
    }));
  }
  if (audioTrack) {
    publications.push(await replacePublicationTrack(room, Track.Source.Microphone, audioTrack));
  }

  if (pendingPublisherVideoTrack?.readyState !== 'ended') {
    if (!videoTrack || videoTrack.id !== pendingPublisherVideoTrack.id) {
      await replacePublicationTrack(room, Track.Source.Camera, pendingPublisherVideoTrack, {
        simulcast: true,
        videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 }
      });
    }
  }
  pendingPublisherVideoTrack = null;
  cancelPendingDisconnect(room);
  return publications;
}

export const publishHostMedia = publishLocalMedia;

export function attachRemoteTrack(track, element) {
  if (!track || !element) return;
  track.attach(element);
  if (element.tagName === 'VIDEO') {
    element.playsInline = true;
    element.setAttribute('playsinline', '');
    const playback = element.play?.();
    playback?.catch?.(() => {});
  }
}

export function detachRemoteTrack(track, element) {
  if (!track) return;
  if (element) track.detach(element);
  else track.detach();
}

export async function replacePublishedVideo(room, mediaStreamTrack) {
  if (!mediaStreamTrack || mediaStreamTrack.readyState === 'ended') return;
  if (!room) {
    pendingPublisherVideoTrack = mediaStreamTrack;
    return;
  }

  cancelPendingDisconnect(room);
  closingRooms.delete(room);
  await replacePublicationTrack(room, Track.Source.Camera, mediaStreamTrack, {
    simulcast: true,
    videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 }
  });
  latestPublisherRoom = room;
  pendingPublisherVideoTrack = null;

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
    if (!mediaStreamTrack || mediaStreamTrack.readyState === 'ended') return;
    if (!latestPublisherRoom) {
      pendingPublisherVideoTrack = mediaStreamTrack;
      window.dispatchEvent(new CustomEvent(CAMERA_REPLACED_EVENT, {
        detail: {
          track: mediaStreamTrack,
          facingMode: mediaStreamTrack.getSettings?.()?.facingMode || ''
        }
      }));
      return;
    }
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
  closingRooms.add(room);

  const timer = setTimeout(async () => {
    publishedMediaByRoom.delete(room);
    removeConnection(room);
    try {
      await room.disconnect();
    } catch {
      // Best-effort cleanup; Supabase heartbeat remains the source of LIVE state.
    } finally {
      pendingDisconnects.delete(room);
      closingRooms.delete(room);
      resolvePending();
    }
  }, DISCONNECT_GRACE_MS);

  pendingDisconnects.set(room, { timer, promise, resolve: resolvePending });
  return promise;
}