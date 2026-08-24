import { Room, RoomEvent, Track, createLocalTracks } from 'livekit-client';
import { supabase } from '../supabaseClient';

const TOKEN_FUNCTION = 'livekit-token';
const CAMERA_REPLACED_EVENT = 'droxion:live-camera-replaced';
const DISCONNECT_GRACE_MS = 750;
const RECONNECT_DELAYS_MS = [350, 900, 1800, 3200];
const PUBLISH_RETRY_DELAYS_MS = [0, 160, 480];

const activeConnections = new Map();
const roomKeys = new WeakMap();
const pendingDisconnects = new WeakMap();
const publishedMediaByRoom = new WeakMap();
const managedTracksByRoom = new WeakMap();
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
        if (publication?.track) handlers.onTrackSubscribed(publication.track, publication, participant);
      });
    });
  } catch {}
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
  cancelPendingDisconnect(room);
  if (typeof queueMicrotask === 'function') queueMicrotask(() => cancelPendingDisconnect(room));
  setTimeout(() => cancelPendingDisconnect(room), 0);
}

function stopManagedTracks(room) {
  const tracks = managedTracksByRoom.get(room) || [];
  tracks.forEach(track => {
    try { track.stop?.(); } catch {}
  });
  managedTracksByRoom.delete(room);
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

function facingFromTrack(track) {
  const settings = track?.getSettings?.() || {};
  const text = String(settings.facingMode || track?.label || '').toLowerCase();
  return text.includes('environment') || text.includes('rear') || text.includes('back')
    ? 'environment'
    : 'user';
}

function dimensionsFromTrack(track) {
  const settings = track?.getSettings?.() || {};
  const width = Number(settings.width || 0);
  const height = Number(settings.height || 0);
  const portrait = height >= width;
  return portrait
    ? { width: 720, height: 1280, frameRate: 30 }
    : { width: 1280, height: 720, frameRate: 30 };
}

function replaceStreamTracks(targetStream, tracks) {
  if (!targetStream) return;
  targetStream.getTracks().forEach(track => {
    try { targetStream.removeTrack(track); } catch {}
    try { track.stop(); } catch {}
  });
  tracks.forEach(localTrack => {
    const mediaTrack = localTrack?.mediaStreamTrack;
    if (mediaTrack && mediaTrack.readyState !== 'ended') targetStream.addTrack(mediaTrack);
  });
}

function announceCameraTrack(mediaStreamTrack) {
  if (typeof window === 'undefined' || !mediaStreamTrack) return;
  window.dispatchEvent(new CustomEvent(CAMERA_REPLACED_EVENT, {
    detail: {
      track: mediaStreamTrack,
      facingMode: mediaStreamTrack.getSettings?.()?.facingMode || facingFromTrack(mediaStreamTrack)
    }
  }));
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

async function publishManagedTrackWithRetry(room, localTrack, publishOptions = {}) {
  let lastError = null;
  for (const delay of PUBLISH_RETRY_DELAYS_MS) {
    if (delay) await wait(delay);
    const mediaTrack = localTrack?.mediaStreamTrack;
    if (!mediaTrack || mediaTrack.readyState === 'ended') throw new Error('LIVE media track ended before publishing.');

    cancelPendingDisconnect(room);
    closingRooms.delete(room);
    try {
      const publication = await room.localParticipant.publishTrack(localTrack, publishOptions);
      cancelPendingDisconnect(room);
      return publication;
    } catch (error) {
      lastError = error;
    }
  }
  console.warn('Droxion LIVE managed track publish failed', localTrack?.kind, lastError);
  throw new Error(localTrack?.kind === Track.Kind.Video
    ? 'LIVE camera could not publish.'
    : 'LIVE microphone could not publish.');
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

  if (localTrack?.replaceTrack) {
    try {
      await localTrack.replaceTrack(mediaStreamTrack, false);
      cancelPendingDisconnect(room);
      return publication;
    } catch (error) {
      console.warn('Droxion LIVE replaceTrack fallback', error);
    }
  }

  // If no publication exists (for example during a very early camera flip),
  // create one SDK-managed track instead of passing a raw browser track into
  // publishTrack. This avoids the null LocalTrack wrapper crash seen in Safari.
  const facingMode = facingFromTrack(mediaStreamTrack);
  const localTracks = await createLocalTracks({
    audio: false,
    video: { facingMode, resolution: dimensionsFromTrack(mediaStreamTrack) }
  });
  const localVideoTrack = localTracks.find(track => track.kind === Track.Kind.Video);
  if (!localVideoTrack) throw new Error('LIVE camera could not be created.');

  try { mediaStreamTrack.stop(); } catch {}
  const managed = managedTracksByRoom.get(room) || [];
  managed.push(localVideoTrack);
  managedTracksByRoom.set(room, managed);
  return publishManagedTrackWithRetry(room, localVideoTrack, { source, ...publishOptions });
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

  const existingVideoPublication = room.localParticipant.getTrackPublication(Track.Source.Camera);
  if (existingVideoPublication?.track?.mediaStreamTrack?.readyState === 'live') {
    const existingAudioPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const localTracks = [existingVideoPublication.track, existingAudioPublication?.track].filter(Boolean);
    replaceStreamTracks(mediaStream, localTracks);
    latestPublisherRoom = room;
    announceCameraTrack(existingVideoPublication.track.mediaStreamTrack);
    return [existingVideoPublication, existingAudioPublication].filter(Boolean);
  }

  const browserVideo = mediaStream.getVideoTracks().find(track => track.readyState !== 'ended');
  const browserAudio = mediaStream.getAudioTracks().find(track => track.readyState !== 'ended');
  if (!browserVideo) throw new Error('LIVE camera track is missing.');

  const facingMode = facingFromTrack(browserVideo);
  const resolution = dimensionsFromTrack(browserVideo);
  const wantsAudio = Boolean(browserAudio);

  // Release the browser-owned capture before asking LiveKit to acquire devices.
  // iOS cannot reliably keep two captures of the same camera alive.
  mediaStream.getTracks().forEach(track => {
    try { track.stop(); } catch {}
  });

  let localTracks;
  try {
    localTracks = await createLocalTracks({
      video: { facingMode, resolution },
      audio: wantsAudio ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } : false
    });
  } catch (error) {
    console.warn('Droxion LIVE SDK media acquisition failed', error);
    throw new Error('LIVE camera could not start. Please try again.');
  }

  const localVideoTrack = localTracks.find(track => track.kind === Track.Kind.Video);
  const localAudioTrack = localTracks.find(track => track.kind === Track.Kind.Audio);
  if (!localVideoTrack?.mediaStreamTrack) {
    localTracks.forEach(track => { try { track.stop?.(); } catch {} });
    throw new Error('LIVE camera could not start.');
  }

  managedTracksByRoom.set(room, localTracks);
  replaceStreamTracks(mediaStream, localTracks);
  latestPublisherRoom = room;
  announceCameraTrack(localVideoTrack.mediaStreamTrack);

  const publications = [];
  const videoPublication = await publishManagedTrackWithRetry(room, localVideoTrack, {
    source: Track.Source.Camera,
    simulcast: true,
    videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 }
  });
  publications.push(videoPublication);

  if (localAudioTrack?.mediaStreamTrack?.readyState === 'live') {
    try {
      const audioPublication = await publishManagedTrackWithRetry(room, localAudioTrack, {
        source: Track.Source.Microphone
      });
      if (audioPublication) publications.push(audioPublication);
    } catch (error) {
      // Never fail a working LIVE video because microphone publishing failed.
      console.warn('Droxion LIVE microphone publish skipped', error);
    }
  }

  if (pendingPublisherVideoTrack?.readyState !== 'ended'
      && pendingPublisherVideoTrack.id !== localVideoTrack.mediaStreamTrack.id) {
    try { await replacePublishedVideo(room, pendingPublisherVideoTrack); } catch {}
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
  const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
  const activeTrack = publication?.track?.mediaStreamTrack || mediaStreamTrack;
  if (savedMedia && activeTrack?.readyState !== 'ended') {
    const audioTracks = savedMedia.getAudioTracks().filter(track => track.readyState !== 'ended');
    replaceStreamTracks(savedMedia, [{ mediaStreamTrack: activeTrack }, ...audioTracks.map(track => ({ mediaStreamTrack: track }))]);
  }
  announceCameraTrack(activeTrack);
}

if (typeof window !== 'undefined') {
  window.__droxionReplacePublishedCamera = async mediaStreamTrack => {
    if (!mediaStreamTrack || mediaStreamTrack.readyState === 'ended') return;
    if (!latestPublisherRoom) {
      pendingPublisherVideoTrack = mediaStreamTrack;
      announceCameraTrack(mediaStreamTrack);
      return;
    }
    return replacePublishedVideo(latestPublisherRoom, mediaStreamTrack);
  };
}

export function setPublishedAudioMuted(room, muted) {
  const publication = room?.localParticipant?.getTrackPublication(Track.Source.Microphone);
  if (!publication?.track) return;
  try { if (muted) publication.mute(); else publication.unmute(); } catch {}
}

export function setPublishedVideoMuted(room, muted) {
  const publication = room?.localParticipant?.getTrackPublication(Track.Source.Camera);
  if (!publication?.track) return;
  try { if (muted) publication.mute(); else publication.unmute(); } catch {}
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
    try {
      await room.disconnect();
    } catch {}
    finally {
      stopManagedTracks(room);
      removeConnection(room);
      pendingDisconnects.delete(room);
      closingRooms.delete(room);
      resolvePending();
    }
  }, DISCONNECT_GRACE_MS);

  pendingDisconnects.set(room, { timer, promise, resolve: resolvePending });
  return promise;
}