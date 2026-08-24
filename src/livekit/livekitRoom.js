import { Room, RoomEvent, Track, createLocalTracks } from 'livekit-client';
import { supabase } from '../supabaseClient';

const TOKEN_FUNCTION = 'livekit-token';
const CAMERA_REPLACED_EVENT = 'droxion:live-camera-replaced';
const DISCONNECT_GRACE_MS = 750;
const RECONNECT_DELAYS_MS = [350, 900, 1800, 3200];
const PUBLISH_RETRY_DELAYS_MS = [0, 180, 520];

const activeConnections = new Map();
const roomKeys = new WeakMap();
const pendingDisconnects = new WeakMap();
const publishedMediaByRoom = new WeakMap();
const managedStateByRoom = new WeakMap();
const recoveringRooms = new WeakSet();
const closingRooms = new WeakSet();
let latestPublisherRoom = null;
let pendingPublisherVideoTrack = null;

async function logClientError(stage, error, context = {}) {
  try {
    await supabase.rpc('droxion_log_live_client_error', {
      p_stage: stage,
      p_message: String(error?.message || error || 'unknown error'),
      p_stack: String(error?.stack || ''),
      p_context: context
    });
  } catch {}
}

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

function stopManagedState(room) {
  const state = managedStateByRoom.get(room);
  [state?.videoTrack, state?.audioTrack].forEach(track => {
    try { track?.stop?.(); } catch {}
  });
  managedStateByRoom.delete(room);
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

function replaceStreamTracks(targetStream, localTracks) {
  if (!targetStream) return;
  const nextMediaTracks = localTracks
    .map(track => track?.mediaStreamTrack || track)
    .filter(track => track && track.readyState !== 'ended');
  const keep = new Set(nextMediaTracks);

  targetStream.getTracks().forEach(track => {
    if (keep.has(track)) return;
    try { targetStream.removeTrack(track); } catch {}
    try { track.stop(); } catch {}
  });

  nextMediaTracks.forEach(track => {
    if (!targetStream.getTracks().includes(track)) {
      try { targetStream.addTrack(track); } catch {}
    }
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
      await logClientError('reconnect', error, { sessionId, role });
      if (/ended|not active|not found/i.test(String(error?.message || ''))) break;
    }
  }

  recoveringRooms.delete(room);
  removeConnection(room);
  entry.handlers?.onDisconnected?.(lastError || reason);
}

async function publishManagedTrackWithRetry(room, localTrack, publishOptions = {}, stage = 'publish') {
  let lastError = null;
  for (const delay of PUBLISH_RETRY_DELAYS_MS) {
    if (delay) await wait(delay);
    const mediaTrack = localTrack?.mediaStreamTrack;
    if (!mediaTrack || mediaTrack.readyState === 'ended') {
      const error = new Error('LIVE media track ended before publishing.');
      await logClientError(`${stage}:track-ended`, error, { kind: localTrack?.kind || '' });
      throw error;
    }

    cancelPendingDisconnect(room);
    closingRooms.delete(room);
    try {
      const publication = await room.localParticipant.publishTrack(localTrack, publishOptions);
      cancelPendingDisconnect(room);
      return publication;
    } catch (error) {
      lastError = error;
      await logClientError(stage, error, {
        kind: localTrack?.kind || '',
        trackId: mediaTrack?.id || '',
        readyState: mediaTrack?.readyState || ''
      });
    }
  }

  throw new Error(localTrack?.kind === Track.Kind.Video
    ? 'LIVE camera could not publish.'
    : 'LIVE microphone could not publish.');
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
          .catch(error => {
            logClientError('reconnect:unhandled', error, { sessionId, role });
            entry.handlers?.onDisconnected?.(reason);
          });
      });

      try {
        await room.connect(auth.url, auth.token, { autoSubscribe: true });
      } catch (error) {
        await logClientError('connect', error, { sessionId, role });
        throw error;
      }
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

  const existingState = managedStateByRoom.get(room);
  const existingVideoMedia = existingState?.videoTrack?.mediaStreamTrack;
  if (existingVideoMedia?.readyState === 'live') {
    replaceStreamTracks(mediaStream, [existingState.videoTrack, existingState.audioTrack].filter(Boolean));
    latestPublisherRoom = room;
    announceCameraTrack(existingVideoMedia);
    return [existingState.videoPublication, existingState.audioPublication].filter(Boolean);
  }

  const browserVideo = mediaStream.getVideoTracks().find(track => track.readyState !== 'ended');
  const browserAudio = mediaStream.getAudioTracks().find(track => track.readyState !== 'ended');
  if (!browserVideo) throw new Error('LIVE camera track is missing.');

  const facingMode = facingFromTrack(browserVideo);
  const resolution = dimensionsFromTrack(browserVideo);
  const wantsAudio = Boolean(browserAudio);

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
    await logClientError('create-local-tracks', error, { facingMode, wantsAudio });
    throw new Error('LIVE camera could not start. Please try again.');
  }

  const localVideoTrack = localTracks.find(track => track.kind === Track.Kind.Video);
  const localAudioTrack = localTracks.find(track => track.kind === Track.Kind.Audio);
  if (!localVideoTrack?.mediaStreamTrack) {
    localTracks.forEach(track => { try { track.stop?.(); } catch {} });
    throw new Error('LIVE camera could not start.');
  }

  const state = {
    videoTrack: localVideoTrack,
    audioTrack: localAudioTrack || null,
    videoPublication: null,
    audioPublication: null
  };
  managedStateByRoom.set(room, state);
  replaceStreamTracks(mediaStream, [localVideoTrack, localAudioTrack].filter(Boolean));
  latestPublisherRoom = room;
  announceCameraTrack(localVideoTrack.mediaStreamTrack);

  try {
    state.videoPublication = await publishManagedTrackWithRetry(room, localVideoTrack, {
      source: Track.Source.Camera,
      simulcast: true,
      videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 }
    }, 'publish-camera');
  } catch (error) {
    await logClientError('publish-camera:final', error, {
      trackId: localVideoTrack.mediaStreamTrack?.id || '',
      readyState: localVideoTrack.mediaStreamTrack?.readyState || ''
    });
    throw error;
  }

  if (localAudioTrack?.mediaStreamTrack?.readyState === 'live') {
    try {
      state.audioPublication = await publishManagedTrackWithRetry(room, localAudioTrack, {
        source: Track.Source.Microphone
      }, 'publish-microphone');
    } catch (error) {
      await logClientError('publish-microphone:ignored', error, {});
    }
  }

  if (pendingPublisherVideoTrack
      && pendingPublisherVideoTrack.readyState !== 'ended'
      && pendingPublisherVideoTrack.id !== localVideoTrack.mediaStreamTrack.id) {
    try { await replacePublishedVideo(room, pendingPublisherVideoTrack); }
    catch (error) { await logClientError('pending-camera-replace', error, {}); }
  }
  pendingPublisherVideoTrack = null;
  cancelPendingDisconnect(room);
  return [state.videoPublication, state.audioPublication].filter(Boolean);
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
  const state = managedStateByRoom.get(room);

  if (!state?.videoTrack) {
    pendingPublisherVideoTrack = mediaStreamTrack;
    return;
  }

  try {
    await state.videoTrack.replaceTrack(mediaStreamTrack, false);
  } catch (error) {
    await logClientError('replace-camera-track', error, {
      incomingTrackId: mediaStreamTrack?.id || '',
      incomingState: mediaStreamTrack?.readyState || ''
    });
    throw new Error('Could not switch LIVE camera.');
  }

  latestPublisherRoom = room;
  pendingPublisherVideoTrack = null;

  const activeTrack = state.videoTrack.mediaStreamTrack || mediaStreamTrack;
  const savedMedia = publishedMediaByRoom.get(room);
  if (savedMedia && activeTrack?.readyState !== 'ended') {
    replaceStreamTracks(savedMedia, [state.videoTrack, state.audioTrack].filter(Boolean));
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
  const state = room ? managedStateByRoom.get(room) : null;
  const publication = state?.audioPublication;
  if (!publication?.track) return;
  try { if (muted) publication.mute(); else publication.unmute(); } catch {}
}

export function setPublishedVideoMuted(room, muted) {
  const state = room ? managedStateByRoom.get(room) : null;
  const publication = state?.videoPublication;
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
    } catch (error) {
      await logClientError('disconnect', error, {});
    } finally {
      stopManagedState(room);
      removeConnection(room);
      pendingDisconnects.delete(room);
      closingRooms.delete(room);
      resolvePending();
    }
  }, DISCONNECT_GRACE_MS);

  pendingDisconnects.set(room, { timer, promise, resolve: resolvePending });
  return promise;
}