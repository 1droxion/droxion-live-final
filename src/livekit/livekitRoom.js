import { Room, RoomEvent, Track } from 'livekit-client';
import { supabase } from '../supabaseClient';

const TOKEN_FUNCTION = 'livekit-token';
const CAMERA_REPLACED_EVENT = 'droxion:live-camera-replaced';
const AUDIO_BLOCKED_EVENT = 'droxion:live-audio-blocked';
const AUDIO_RECOVERED_EVENT = 'droxion:live-audio-recovered';
const DISCONNECT_GRACE_MS = 900;
const RECONNECT_DELAYS_MS = [350, 900, 1800, 3200];
const PUBLISH_RETRY_DELAYS_MS = [0, 180, 520];
const CLIENT_INSTANCE_ID = (() => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  } catch {}
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.slice(0, 24);
})();

const activeConnections = new Map();
const roomKeys = new WeakMap();
const pendingDisconnects = new WeakMap();
const publishedMediaByRoom = new WeakMap();
const managedStateByRoom = new WeakMap();
const recoveringRooms = new WeakSet();
const closingRooms = new WeakSet();
const audioUnlocksByRoom = new WeakMap();
const mediaPublishPromisesByRoom = new WeakMap();
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
    body: { sessionId, role, clientInstanceId: CLIENT_INSTANCE_ID },
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
  onReconnected,
  onAudioPlaybackChanged
}) {
  return {
    onTrackSubscribed,
    onTrackUnsubscribed,
    onDisconnected,
    onParticipantConnected,
    onParticipantDisconnected,
    onReconnecting,
    onReconnected,
    onAudioPlaybackChanged
  };
}

function parseParticipantMetadata(participant) {
  try {
    const metadata = participant?.metadata ? JSON.parse(participant.metadata) : {};
    return metadata && typeof metadata === 'object' ? metadata : {};
  } catch {
    return {};
  }
}

function normalizedParticipant(participant) {
  if (!participant) return participant;
  const metadata = parseParticipantMetadata(participant);
  const rawIdentity = String(participant.identity || '');
  const userId = String(metadata.droxionUserId || rawIdentity.split('::')[0] || rawIdentity);
  if (!userId || userId === rawIdentity) return participant;
  return {
    identity: userId,
    rawIdentity,
    metadata: participant.metadata,
    name: participant.name,
    sid: participant.sid
  };
}

function subscribePublication(publication) {
  try {
    if (publication && typeof publication.setSubscribed === 'function' && !publication.isSubscribed) {
      publication.setSubscribed(true);
    }
  } catch {}
}

function replaySubscribedTracks(room, handlers) {
  if (!room || !handlers?.onTrackSubscribed) return;
  try {
    const participants = room.remoteParticipants?.values
      ? Array.from(room.remoteParticipants.values())
      : [];
    participants.forEach(participant => {
      const appParticipant = normalizedParticipant(participant);
      const publications = participant.getTrackPublications?.()
        || (participant.trackPublications?.values
          ? Array.from(participant.trackPublications.values())
          : []);
      publications.forEach(publication => {
        subscribePublication(publication);
        if (publication?.track) handlers.onTrackSubscribed(publication.track, publication, appParticipant);
      });
    });
  } catch {}
}

function forceRemoteSubscriptions(room, handlers) {
  if (!room) return;
  try {
    const participants = room.remoteParticipants?.values
      ? Array.from(room.remoteParticipants.values())
      : [];
    participants.forEach(participant => {
      const publications = participant.getTrackPublications?.()
        || (participant.trackPublications?.values
          ? Array.from(participant.trackPublications.values())
          : []);
      publications.forEach(subscribePublication);
    });
  } catch {}
  replaySubscribedTracks(room, handlers);
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

function nudgeLocalPreview(stream) {
  if (typeof document === 'undefined' || !stream) return;
  const videos = document.querySelectorAll('video.liveMainVideo.liveLocalPreview, video.liveGuestSelfVideo');
  videos.forEach(video => {
    try {
      if (video.srcObject !== stream) video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute('playsinline', '');
      const play = () => video.play?.().catch?.(() => {});
      play();
      setTimeout(play, 60);
      setTimeout(play, 180);
    } catch {}
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
      forceRemoteSubscriptions(room, entry.handlers);

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

export async function recoverLiveKitAfterForeground(room, mediaStream) {
  if (!room) return;
  cancelPendingDisconnect(room);
  closingRooms.delete(room);

  const key = roomKeys.get(room);
  const entry = key ? activeConnections.get(key) : null;
  const connectionState = String(room.state || room.connectionState || '').toLowerCase();

  if (connectionState === 'disconnected') {
    if (!entry) throw new Error('LIVE connection is no longer available.');
    await recoverUnexpectedDisconnect({
      room,
      sessionId: key.split(':')[0],
      role: key.split(':').slice(1).join(':') || 'viewer',
      entry,
      reason: new Error('LIVE connection was interrupted while the app was backgrounded.')
    });
  } else {
    forceRemoteSubscriptions(room, entry?.handlers);
    setTimeout(() => forceRemoteSubscriptions(room, entry?.handlers), 150);
    setTimeout(() => forceRemoteSubscriptions(room, entry?.handlers), 600);
  }

  const state = managedStateByRoom.get(room);
  if (!state || !mediaStream) return;

  const repairTrack = async (localTrack, publication, options, stage) => {
    const mediaTrack = localTrack?.mediaStreamTrack;
    if (!localTrack || publication?.isMuted || (mediaTrack?.readyState === 'live' && !mediaTrack.muted)) return;
    try {
      await localTrack.restartTrack?.(options);
    } catch (error) {
      await logClientError(stage, error, {
        trackId: mediaTrack?.id || '',
        readyState: mediaTrack?.readyState || '',
        muted: Boolean(mediaTrack?.muted)
      });
      throw error;
    }
  };

  await repairTrack(state.videoTrack, state.videoPublication, state.videoCaptureOptions, 'foreground-camera-restart');
  await repairTrack(state.audioTrack, state.audioPublication, undefined, 'foreground-microphone-restart');

  const localTracks = [state.videoTrack, state.audioTrack].filter(Boolean);
  replaceStreamTracks(mediaStream, localTracks);
  publishedMediaByRoom.set(room, mediaStream);
  const videoTrack = state.videoTrack?.mediaStreamTrack;
  if (videoTrack?.readyState === 'live') announceCameraTrack(videoTrack);
  nudgeLocalPreview(mediaStream);
}

async function publishManagedTrackWithRetry(room, track, publishOptions = {}, stage = 'publish') {
  let lastError = null;
  for (const delay of PUBLISH_RETRY_DELAYS_MS) {
    if (delay) await wait(delay);
    const mediaTrack = track?.mediaStreamTrack || track;
    if (!mediaTrack || mediaTrack.readyState === 'ended') {
      const error = new Error('LIVE media track ended before publishing.');
      await logClientError(`${stage}:track-ended`, error, { kind: track?.kind || mediaTrack?.kind || '' });
      throw error;
    }

    cancelPendingDisconnect(room);
    closingRooms.delete(room);
    try {
      const publication = await room.localParticipant.publishTrack(track, publishOptions);
      cancelPendingDisconnect(room);
      return publication;
    } catch (error) {
      lastError = error;
      await logClientError(stage, error, {
        kind: track?.kind || mediaTrack?.kind || '',
        trackId: mediaTrack?.id || '',
        readyState: mediaTrack?.readyState || ''
      });
    }
  }

  throw new Error((track?.kind || track?.mediaStreamTrack?.kind) === Track.Kind.Video
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
  onReconnected,
  onAudioPlaybackChanged
}) {
  const key = connectionKey(sessionId, role);
  const handlers = makeHandlers({
    onTrackSubscribed,
    onTrackUnsubscribed,
    onDisconnected,
    onParticipantConnected,
    onParticipantDisconnected,
    onReconnecting,
    onReconnected,
    onAudioPlaybackChanged
  });
  const existing = activeConnections.get(key);

  if (existing) {
    existing.handlers = handlers;
    if (existing.room) cancelPendingDisconnect(existing.room);
    const room = await existing.ready;
    protectReusedRoom(room);
    forceRemoteSubscriptions(room, handlers);
    setTimeout(() => forceRemoteSubscriptions(room, handlers), 120);
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

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        entry.handlers?.onTrackSubscribed?.(track, publication, normalizedParticipant(participant));
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        entry.handlers?.onTrackUnsubscribed?.(track, publication, normalizedParticipant(participant));
      });
      room.on(RoomEvent.TrackPublished, (publication, participant) => {
        subscribePublication(publication);
        setTimeout(() => replaySubscribedTracks(room, entry.handlers), 30);
        entry.handlers?.onParticipantConnected?.(normalizedParticipant(participant));
      });
      room.on(RoomEvent.TrackSubscriptionFailed, (trackSid, participant) => {
        logClientError('remote-track-subscription-failed', new Error('Remote LIVE track subscription failed.'), {
          sessionId,
          role,
          trackSid: String(trackSid || ''),
          participant: String(normalizedParticipant(participant)?.identity || '')
        });
      });
      room.on(RoomEvent.ParticipantConnected, participant => {
        entry.handlers?.onParticipantConnected?.(normalizedParticipant(participant));
        setTimeout(() => forceRemoteSubscriptions(room, entry.handlers), 40);
      });
      room.on(RoomEvent.ParticipantDisconnected, participant => {
        entry.handlers?.onParticipantDisconnected?.(normalizedParticipant(participant));
      });
      room.on(RoomEvent.Reconnecting, (...args) => entry.handlers?.onReconnecting?.(...args));
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        entry.handlers?.onAudioPlaybackChanged?.(room.canPlaybackAudio !== false);
      });
      room.on(RoomEvent.Reconnected, (...args) => {
        (async () => {
          const savedMedia = publishedMediaByRoom.get(room);
          if (savedMedia?.active) await publishLocalMedia(room, savedMedia);
          forceRemoteSubscriptions(room, entry.handlers);
          setTimeout(() => forceRemoteSubscriptions(room, entry.handlers), 120);
          entry.handlers?.onReconnected?.(...args);
        })().catch(error => {
          logClientError('reconnect-republish', error, { sessionId, role });
          entry.handlers?.onDisconnected?.(error);
        });
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

      forceRemoteSubscriptions(room, entry.handlers);
      setTimeout(() => forceRemoteSubscriptions(room, entry.handlers), 120);
      setTimeout(() => forceRemoteSubscriptions(room, entry.handlers), 500);
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
  const pending = mediaPublishPromisesByRoom.get(room);
  if (pending) return pending;

  const publish = publishLocalMediaOnce(room, mediaStream)
    .finally(() => mediaPublishPromisesByRoom.delete(room));
  mediaPublishPromisesByRoom.set(room, publish);
  return publish;
}

async function publishLocalMediaOnce(room, mediaStream) {
  cancelPendingDisconnect(room);
  closingRooms.delete(room);
  publishedMediaByRoom.set(room, mediaStream);

  const existingState = managedStateByRoom.get(room);
  const currentVideoPublication = room.localParticipant.getTrackPublication?.(Track.Source.Camera);
  const currentVideoTrack = currentVideoPublication?.track;
  const currentVideoMedia = currentVideoTrack?.mediaStreamTrack;
  if (currentVideoMedia?.readyState === 'live') {
    const currentAudioPublication = room.localParticipant.getTrackPublication?.(Track.Source.Microphone);
    existingState.videoPublication = currentVideoPublication;
    existingState.videoTrack = currentVideoTrack;
    existingState.audioPublication = currentAudioPublication || null;
    existingState.audioTrack = currentAudioPublication?.track || null;
    replaceStreamTracks(mediaStream, [existingState.videoTrack, existingState.audioTrack].filter(Boolean));
    latestPublisherRoom = room;
    announceCameraTrack(currentVideoMedia);
    nudgeLocalPreview(mediaStream);
    return [existingState.videoPublication, existingState.audioPublication].filter(Boolean);
  }

  let browserVideo = mediaStream.getVideoTracks().find(track => track.readyState !== 'ended');
  let browserAudio = mediaStream.getAudioTracks().find(track => track.readyState !== 'ended');
  if (!browserVideo && existingState?.videoTrack && !existingState.videoPublication?.isMuted) {
    try {
      await existingState.videoTrack.restartTrack?.(existingState.videoCaptureOptions);
      browserVideo = existingState.videoTrack.mediaStreamTrack;
    } catch (error) {
      await logClientError('republish-camera-restart', error, {});
    }
  }
  if (!browserAudio && existingState?.audioTrack && !existingState.audioPublication?.isMuted) {
    try {
      await existingState.audioTrack.restartTrack?.();
      browserAudio = existingState.audioTrack.mediaStreamTrack;
    } catch (error) {
      await logClientError('republish-microphone-restart', error, {});
    }
  }
  if (!browserVideo) throw new Error('LIVE camera track is missing.');

  const videoCaptureOptions = {
    facingMode: facingFromTrack(browserVideo),
    resolution: dimensionsFromTrack(browserVideo)
  };
  const videoPublishOptions = {
    source: Track.Source.Camera,
    simulcast: true,
    videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 }
  };

  const state = {
    videoTrack: existingState?.videoTrack || null,
    audioTrack: existingState?.audioTrack || null,
    videoPublication: null,
    audioPublication: null,
    videoMuted: Boolean(existingState?.videoMuted || existingState?.videoPublication?.isMuted),
    audioMuted: Boolean(existingState?.audioMuted || existingState?.audioPublication?.isMuted),
    videoCaptureOptions,
    videoPublishOptions
  };
  managedStateByRoom.set(room, state);

  try {
    const videoCandidate = state.videoTrack?.mediaStreamTrack?.readyState === 'live' ? state.videoTrack : browserVideo;
    state.videoPublication = await publishManagedTrackWithRetry(room, videoCandidate, videoPublishOptions, 'publish-camera');
    state.videoTrack = state.videoPublication?.track || null;
    if (!state.videoTrack?.mediaStreamTrack) throw new Error('LIVE camera publication is missing its track.');
    if (state.videoMuted) await state.videoPublication.mute();
  } catch (error) {
    managedStateByRoom.delete(room);
    await logClientError('publish-camera:final', error, {
      trackId: browserVideo.id || '',
      readyState: browserVideo.readyState || ''
    });
    throw error;
  }

  if (browserAudio?.readyState === 'live') {
    try {
      const audioCandidate = state.audioTrack?.mediaStreamTrack?.readyState === 'live' ? state.audioTrack : browserAudio;
      state.audioPublication = await publishManagedTrackWithRetry(room, audioCandidate, {
        source: Track.Source.Microphone
      }, 'publish-microphone');
      state.audioTrack = state.audioPublication?.track || null;
      if (state.audioMuted) await state.audioPublication.mute();
    } catch (error) {
      await logClientError('publish-microphone:final', error, {});
      throw new Error('LIVE microphone could not republish.');
    }
  }

  // Keep the exact camera MediaStream that was already visible in the preview.
  // Do not stop and reopen the camera during publish. This removes the one-second
  // black/orientation jump when a vertical LIVE starts.
  replaceStreamTracks(mediaStream, [state.videoTrack, state.audioTrack].filter(Boolean));
  latestPublisherRoom = room;
  announceCameraTrack(state.videoTrack.mediaStreamTrack);
  nudgeLocalPreview(mediaStream);

  if (pendingPublisherVideoTrack
      && pendingPublisherVideoTrack.readyState !== 'ended'
      && pendingPublisherVideoTrack.id !== state.videoTrack.mediaStreamTrack.id) {
    try { await replacePublishedVideo(room, pendingPublisherVideoTrack); }
    catch (error) { await logClientError('pending-camera-replace', error, {}); }
  }
  pendingPublisherVideoTrack = null;
  cancelPendingDisconnect(room);
  return [state.videoPublication, state.audioPublication].filter(Boolean);
}

export const publishHostMedia = publishLocalMedia;

function dispatchAudioPlaybackEvent(type, error) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(type, {
    detail: { message: String(error?.message || error || '') }
  }));
}

export async function unlockRemoteAudio(room) {
  if (!room) return false;
  const pending = audioUnlocksByRoom.get(room);
  if (pending) return pending;

  const attempt = (async () => {
    try {
      await room.startAudio?.();
      const elements = typeof document === 'undefined'
        ? []
        : Array.from(document.querySelectorAll('.liveRoomV4 audio')).filter(element => element.srcObject || element.src);
      const playback = await Promise.allSettled(elements.map(element => element.play()));
      const failure = playback.find(result => result.status === 'rejected');
      if (room.canPlaybackAudio === false || failure) {
        throw failure?.reason || new Error('Remote audio playback is blocked.');
      }
      dispatchAudioPlaybackEvent(AUDIO_RECOVERED_EVENT);
      return true;
    } catch (error) {
      await logClientError('remote-audio-unlock', error, {});
      dispatchAudioPlaybackEvent(AUDIO_BLOCKED_EVENT, error);
      return false;
    } finally {
      audioUnlocksByRoom.delete(room);
    }
  })();

  audioUnlocksByRoom.set(room, attempt);
  return attempt;
}

export function attachRemoteTrack(track, element) {
  if (!track || !element) return;
  try { track.attach(element); } catch {}
  element.autoplay = true;
  element.playsInline = true;
  element.setAttribute('playsinline', '');
  const isAudio = String(element.tagName || '').toLowerCase() === 'audio';
  const playback = element.play?.();
  playback?.then?.(() => {
    if (isAudio) dispatchAudioPlaybackEvent(AUDIO_RECOVERED_EVENT);
  }).catch?.(error => {
    if (isAudio) dispatchAudioPlaybackEvent(AUDIO_BLOCKED_EVENT, error);
    setTimeout(() => {
      element.play?.()
        .then?.(() => { if (isAudio) dispatchAudioPlaybackEvent(AUDIO_RECOVERED_EVENT); })
        .catch?.(retryError => { if (isAudio) dispatchAudioPlaybackEvent(AUDIO_BLOCKED_EVENT, retryError); });
    }, 120);
  });
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
    await state.videoTrack.replaceTrack(mediaStreamTrack, true);
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
  state.videoCaptureOptions = {
    facingMode: facingFromTrack(activeTrack),
    resolution: dimensionsFromTrack(activeTrack)
  };
  const savedMedia = publishedMediaByRoom.get(room);
  if (savedMedia && activeTrack?.readyState !== 'ended') {
    replaceStreamTracks(savedMedia, [state.videoTrack, state.audioTrack].filter(Boolean));
    nudgeLocalPreview(savedMedia);
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
  if (state) state.audioMuted = muted;
  const publication = state?.audioPublication;
  if (!publication?.track) return;
  Promise.resolve(muted ? publication.mute() : publication.unmute())
    .catch(error => logClientError('toggle-microphone', error, { muted }));
}

export function setPublishedVideoMuted(room, muted) {
  const state = room ? managedStateByRoom.get(room) : null;
  const publication = state?.videoPublication;
  const savedMedia = room ? publishedMediaByRoom.get(room) : null;
  if (state) state.videoMuted = muted;
  if (!state?.videoTrack || !publication?.track) return;

  (async () => {
    try {
      cancelPendingDisconnect(room);
      closingRooms.delete(room);

      if (muted) {
        await publication.mute();
        return;
      }

      await publication.unmute();
      let activeTrack = state.videoTrack?.mediaStreamTrack;
      if (!activeTrack || activeTrack.readyState !== 'live') {
        await state.videoTrack.restartTrack?.(state.videoCaptureOptions);
        activeTrack = state.videoTrack?.mediaStreamTrack;
      }

      if (!activeTrack || activeTrack.readyState !== 'live') {
        throw new Error('Camera did not restart after being turned on.');
      }

      activeTrack.enabled = true;
      if (savedMedia) {
        replaceStreamTracks(savedMedia, [state.videoTrack, state.audioTrack].filter(Boolean));
        nudgeLocalPreview(savedMedia);
      }
      announceCameraTrack(activeTrack);
    } catch (error) {
      await logClientError('toggle-camera', error, {
        muted,
        trackId: state.videoTrack?.mediaStreamTrack?.id || '',
        readyState: state.videoTrack?.mediaStreamTrack?.readyState || ''
      });
    }
  })();
}

export async function disconnectLiveKitRoom(room) {
  if (!room) return;
  const alreadyPending = pendingDisconnects.get(room);
  // Do not block a React effect on the grace timer. A new effect for the same
  // session/role can immediately reuse this room and cancel the pending close.
  if (alreadyPending) return;

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
  // Resolve the caller immediately. Actual disconnect remains delayed so a
  // same-room React remount/status refresh can cancel it through reuse.
  return;
}