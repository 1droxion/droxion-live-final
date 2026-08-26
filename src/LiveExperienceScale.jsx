import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Ban, Camera, CameraOff, Gift, LogOut, Maximize2, Mic, MicOff, MoreHorizontal, Radio, RefreshCw, Send, Smartphone, Sparkles, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { Track } from 'livekit-client';
import { authoritativeLiveRpc, invalidateLiveGuestState, recoverLiveEventStream, releaseLiveEventStream, requestLiveAuthoritativeReconcile, subscribeLiveEvents, supabase } from './supabaseClient';
import {
  attachRemoteTrack,
  connectLiveKitRoom,
  disconnectLiveKitRoom,
  publishLocalMedia,
  recoverLiveKitAfterForeground,
  replacePublishedVideo,
  setPublishedAudioMuted,
  setPublishedVideoMuted,
  unlockRemoteAudio
} from './livekit/livekitRoom';
import { createLiveHighlightRecorder } from './livekit/liveHighlightRecorder';
import { actionableJoinRequests, applyMediaEnabledState, createLiveDeliveryProbe, createLiveEventBatcher, hasLiveGuest, liveChatRowFromWrite, liveFeedWindow, liveGiftReconciliationCursor, liveGuestEventTargetsUser, livePendingRecoveryDelay, mergeStableLiveEvents, shouldEnterGuestMode } from './livekit/reliabilityState';
import './live-experience-v3.css';
import './live-experience-v4.css';

const LIVE_FEED_PAGE_SIZE = 12;
const liveDeliveryProbe = createLiveDeliveryProbe();

if (typeof window !== 'undefined') {
  window.__droxionLiveDeliveryDiagnostics = {
    snapshot: () => liveDeliveryProbe.snapshot(),
    lifecycle: () => liveDeliveryProbe.lifecycleSnapshot()
  };
}

function personAvatar(person, size = 42) {
  if (person?.avatar_url) return <img src={person.avatar_url} alt={person.display_name || 'Droxion user'} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 50% 36%,rgba(226,232,240,.72) 0 14%,transparent 15%),radial-gradient(ellipse at 50% 86%,rgba(226,232,240,.55) 0 27%,transparent 28%),linear-gradient(135deg,#252538,#15151f)' }} />;
}

export default function LiveExperienceScale({ currentUserId, coins = 0, onCoinsChanged, onOpenWallet, onImmersiveChange }) {
  const [isLive, setIsLive] = useState(false);
  const [ownSessionId, setOwnSessionId] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [giftEvents, setGiftEvents] = useState([]);
  const [giftDrawerOpen, setGiftDrawerOpen] = useState(false);
  const [busyGift, setBusyGift] = useState('');
  const [notice, setNotice] = useState('');
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomStatus, setRoomStatus] = useState(null);
  const [viewers, setViewers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [myJoinRequest, setMyJoinRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [invite, setInvite] = useState(null);
  const [guestMode, setGuestMode] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [facingMode, setFacingMode] = useState('user');
  const [beautyMode, setBeautyMode] = useState('off');
  const [hostVideoReady, setHostVideoReady] = useState(false);
  const [guestVideoReady, setGuestVideoReady] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [followingHost, setFollowingHost] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [refreshingLiveFeed, setRefreshingLiveFeed] = useState(false);
  const [homePullDistance, setHomePullDistance] = useState(0);
  const [visibleLiveCount, setVisibleLiveCount] = useState(LIVE_FEED_PAGE_SIZE);
  const [guestActionBusy, setGuestActionBusy] = useState('');
  const [respondingRequestIds, setRespondingRequestIds] = useState([]);
  const [guestMenuOpen, setGuestMenuOpen] = useState(false);
  const [remoteGuestId, setRemoteGuestId] = useState('');
  const [guestStateRevision, setGuestStateRevision] = useState(0);
  const [liveSetup, setLiveSetup] = useState({ title: '', tags: '', orientation: 'vertical', allowGuests: true });

  const localVideo = useRef(null);
  const remoteHostVideo = useRef(null);
  const remoteHostAudio = useRef(null);
  const remoteGuestVideo = useRef(null);
  const remoteGuestAudio = useRef(null);
  const streamRef = useRef(null);
  const lkRoomRef = useRef(null);
  const lkRoleRef = useRef('');
  const remoteTracksRef = useRef(new Map());
  const highlightRecorderRef = useRef(null);
  const lastChatId = useRef(0);
  const lastGiftAt = useRef(null);
  const seenGiftIds = useRef(new Set());
  const sendingChat = useRef(false);
  const touchStartY = useRef(null);
  const previousViewerCount = useRef(0);
  const lifecycleRecoveryRef = useRef(null);
  const microphoneSyncRef = useRef(null);
  const noticeExpiryRef = useRef(null);
  const homePullStartY = useRef(null);
  const liveFeedSentinelRef = useRef(null);
  const voluntarilyExitedRequestRef = useRef('');
  const pendingChatCommitsRef = useRef([]);
  const pendingGiftCommitsRef = useRef([]);

  const sessionId = activeRoom?.session_id || (isLive ? ownSessionId : '');
  const isHostRoom = Boolean(isLive && ownSessionId && sessionId === ownSessionId);
  const roomOrientation = isHostRoom ? liveSetup.orientation : (activeRoom?.orientation || 'vertical');
  const immersive = Boolean(sessionId);

  useEffect(() => { onImmersiveChange?.(immersive); }, [immersive, onImmersiveChange]);
  useEffect(() => { if (!roomStatus?.guest_id) setGuestMenuOpen(false); }, [roomStatus?.guest_id]);
  useEffect(() => () => onImmersiveChange?.(false), [onImmersiveChange]);
  useEffect(() => () => window.clearTimeout(noticeExpiryRef.current), []);

  async function loadLive() {
    const { data, error } = await supabase.rpc('droxion_live_feed');
    if (error) return [];
    setProfiles(data || []);
    return data || [];
  }

  const attachLocal = useCallback(() => {
    const node = localVideo.current;
    const stream = streamRef.current;
    if (!node || !stream) return false;
    if (node.srcObject !== stream) node.srcObject = stream;
    node.muted = true;
    node.setAttribute('playsinline', '');
    node.play?.().catch(() => {});
    return true;
  }, []);

  const localVideoRef = useCallback(node => {
    localVideo.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.muted = true;
      node.setAttribute('playsinline', '');
      window.setTimeout(() => node.play?.().catch(() => {}), 0);
    }
  }, []);

  const ensureCamera = useCallback(async (
    orientation = 'vertical',
    requestedFacing = facingMode,
    recoveryState = null
  ) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera is not supported on this device.');
    if (streamRef.current?.active) { attachLocal(); return streamRef.current; }
    const portrait = orientation !== 'horizontal';
    const video = portrait
      ? { facingMode: { ideal: requestedFacing }, width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30, max: 30 } }
      : { facingMode: { ideal: requestedFacing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (firstError) {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
      catch { throw firstError; }
    }
    const cameraEnabled = recoveryState?.cameraOn ?? true;
    const microphoneEnabled = recoveryState?.micOn ?? true;
    applyMediaEnabledState(stream, { cameraOn: cameraEnabled, micOn: microphoneEnabled });
    streamRef.current = stream;
    setFacingMode(requestedFacing);
    if (!recoveryState) {
      setMicOn(true);
      setCameraOn(true);
    }
    requestAnimationFrame(() => { attachLocal(); window.setTimeout(attachLocal, 150); });
    return stream;
  }, [attachLocal, facingMode]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
  }, []);

  const clearRemoteMedia = useCallback(() => {
    remoteTracksRef.current.forEach(track => { try { track.detach(); } catch {} });
    remoteTracksRef.current.clear();
    setHostVideoReady(false);
    setGuestVideoReady(false);
    setRemoteGuestId('');
    [remoteHostVideo.current, remoteGuestVideo.current, remoteHostAudio.current, remoteGuestAudio.current].forEach(node => {
      if (node) node.srcObject = null;
    });
  }, []);

  const disconnectTransport = useCallback(async () => {
    const room = lkRoomRef.current;
    lkRoomRef.current = null;
    lkRoleRef.current = '';
    clearRemoteMedia();
    await disconnectLiveKitRoom(room);
  }, [clearRemoteMedia]);

  function attachLiveKitTrack(track, participant) {
    if (!track || !participant?.identity) return;
    const identity = participant.identity;
    const hostId = isHostRoom ? currentUserId : activeRoom?.user_id;
    const key = `${identity}:${track.kind}`;
    remoteTracksRef.current.set(key, track);

    const attach = () => {
      if (identity === hostId && !isHostRoom) {
        const element = track.kind === Track.Kind.Video ? remoteHostVideo.current : remoteHostAudio.current;
        if (element) attachRemoteTrack(track, element);
        if (track.kind === Track.Kind.Video) setHostVideoReady(true);
      } else if (identity !== hostId && identity !== currentUserId) {
        setRemoteGuestId(identity);
        invalidateLiveGuestState(sessionId);
        setGuestStateRevision(value => value + 1);
        const element = track.kind === Track.Kind.Video ? remoteGuestVideo.current : remoteGuestAudio.current;
        if (element) attachRemoteTrack(track, element);
        if (track.kind === Track.Kind.Video) setGuestVideoReady(true);
      }
    };
    attach();
    requestAnimationFrame(attach);
    window.setTimeout(attach, 150);
  }

  function detachLiveKitTrack(track, participant) {
    try { track?.detach?.(); } catch {}
    if (participant?.identity) remoteTracksRef.current.delete(`${participant.identity}:${track?.kind}`);
    if (participant?.identity && participant.identity !== (isHostRoom ? currentUserId : activeRoom?.user_id) && track?.kind === Track.Kind.Video) {
      setGuestVideoReady(false);
      const stillPublished = Array.from(remoteTracksRef.current.keys()).some(key => key.startsWith(`${participant.identity}:`));
      if (!stillPublished) setRemoteGuestId('');
    }
  }

  useEffect(() => {
    if (!sessionId || !currentUserId) { disconnectTransport(); return; }
    let cancelled = false;
    const role = isHostRoom ? 'host' : guestMode ? 'guest' : 'viewer';

    (async () => {
      await disconnectTransport();
      try {
        const { room } = await connectLiveKitRoom({
          sessionId,
          role,
          onTrackSubscribed: (track, _publication, participant) => attachLiveKitTrack(track, participant),
          onTrackUnsubscribed: (track, _publication, participant) => detachLiveKitTrack(track, participant),
          onDisconnected: () => { if (!cancelled) setNotice('LIVE connection disconnected. Reconnecting when available…'); },
          onReconnecting: () => { if (!cancelled) setNotice('Reconnecting LIVE…'); },
          onReconnected: () => {
            if (!cancelled) setNotice('');
            unlockRemoteAudio(lkRoomRef.current).then(unlocked => {
              if (!cancelled) setAudioBlocked(!unlocked);
            });
          },
          onAudioPlaybackChanged: canPlay => { if (!cancelled) setAudioBlocked(!canPlay); }
        });
        if (cancelled) { await disconnectLiveKitRoom(room); return; }
        lkRoomRef.current = room;
        lkRoleRef.current = role;
        if ((role === 'host' || role === 'guest') && streamRef.current) await publishLocalMedia(room, streamRef.current);
        const unlocked = await unlockRemoteAudio(room);
        if (!cancelled) setAudioBlocked(!unlocked);
      } catch (error) {
        if (!cancelled) setNotice(error?.message || 'Could not connect to LIVE video.');
      }
    })();

    return () => { cancelled = true; disconnectTransport(); };
  }, [sessionId, currentUserId, isHostRoom, guestMode, activeRoom?.user_id, disconnectTransport]);

  useEffect(() => () => {
    disconnectTransport();
    stopCamera();
    highlightRecorderRef.current?.stopAndPublish?.().catch(() => {});
  }, [disconnectTransport, stopCamera]);

  useEffect(() => {
    if (!sessionId) return;
    let disposed = false;
    let wasBackgrounded = document.visibilityState === 'hidden';

    const markBackgrounded = () => {
      wasBackgrounded = true;
    };

    const recoverForeground = event => {
      if (disposed || document.visibilityState === 'hidden') return;
      recoverLiveEventStream(sessionId, event?.type || 'foreground').catch(() => {});
      if (!wasBackgrounded) return;
      wasBackgrounded = false;
      if (lifecycleRecoveryRef.current) return;

      lifecycleRecoveryRef.current = (async () => {
        const room = lkRoomRef.current;
        const role = lkRoleRef.current;
        if (!room || !role) return;
        const mediaStateBeforeBackground = { cameraOn, micOn };

        setNotice('Restoring LIVE…');
        let mediaStream = streamRef.current;
        if (role === 'host' || role === 'guest') {
          const videoTrack = mediaStream?.getVideoTracks?.()[0];
          const audioTrack = mediaStream?.getAudioTracks?.()[0];
          if (videoTrack?.readyState !== 'live' || audioTrack?.readyState !== 'live') {
            mediaStream?.getTracks?.().forEach(track => track.stop());
            streamRef.current = null;
            mediaStream = await ensureCamera(roomOrientation, facingMode, mediaStateBeforeBackground);
          }

          applyMediaEnabledState(mediaStream, mediaStateBeforeBackground);
        }

        await recoverLiveKitAfterForeground(room, mediaStream);
        const unlocked = await unlockRemoteAudio(room);
        if (!disposed) setAudioBlocked(!unlocked);
        if (role === 'host' || role === 'guest') {
          await Promise.all([
            setPublishedVideoMuted(room, !mediaStateBeforeBackground.cameraOn),
            setPublishedAudioMuted(room, !mediaStateBeforeBackground.micOn)
          ]);
          applyMediaEnabledState(streamRef.current, mediaStateBeforeBackground);
          attachLocal();
        }
        if (!disposed) setNotice('');
      })()
        .catch(error => {
          if (!disposed) setNotice(error?.message || 'Could not restore LIVE after returning to the app.');
        })
        .finally(() => {
          lifecycleRecoveryRef.current = null;
        });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') markBackgrounded();
      else recoverForeground({ type: 'visibilitychange' });
    };
    const recoverOnline = () => recoverLiveEventStream(sessionId, 'online').catch(() => {});

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', markBackgrounded);
    window.addEventListener('pageshow', recoverForeground);
    window.addEventListener('focus', recoverForeground);
    window.addEventListener('online', recoverOnline);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', markBackgrounded);
      window.removeEventListener('pageshow', recoverForeground);
      window.removeEventListener('focus', recoverForeground);
      window.removeEventListener('online', recoverOnline);
    };
  }, [sessionId, roomOrientation, facingMode, cameraOn, micOn, ensureCamera, attachLocal]);

  useEffect(() => {
    if (!sessionId) return;
    const batcher = createLiveEventBatcher({
      flush: batch => {
        if (batch.chat.length) {
          setMessages(current => mergeStableLiveEvents(current, batch.chat, 200));
          pendingChatCommitsRef.current.push(...batch.chat);
          lastChatId.current = Math.max(lastChatId.current, ...batch.chat.map(row => Number(row.id || 0)));
          if (isHostRoom) highlightRecorderRef.current?.markMoment?.(Math.min(5, batch.chat.length));
        }
        if (batch.gift.length) {
          setGiftEvents(current => mergeStableLiveEvents(current, batch.gift, 30));
          pendingGiftCommitsRef.current.push(...batch.gift);
          const fresh = batch.gift.filter(row => {
            const id = String(row.id ?? '');
            if (!id || seenGiftIds.current.has(id)) return false;
            seenGiftIds.current.add(id);
            return true;
          });
          lastGiftAt.current = batch.gift.reduce((latest, row) => String(row.created_at || '') > String(latest || '') ? row.created_at : latest, lastGiftAt.current);
          if (isHostRoom && fresh.length) highlightRecorderRef.current?.markMoment?.(Math.min(20, fresh.reduce((sum, row) => sum + 4 + Math.log10(Math.max(1, Number(row.cost_coins || 1))), 0)));
        }
      }
    });
    const unsubscribe = subscribeLiveEvents(sessionId, event => {
      if (event.type === 'chat' && event.row) {
        liveDeliveryProbe.mark({ eventType: 'chat', eventId: event.row.id, phase: 'realtime_callback', source: event.source, createdAt: event.row.created_at });
        batcher.enqueue('chat', event.row);
        liveDeliveryProbe.mark({ eventType: 'chat', eventId: event.row.id, phase: 'state_queued', source: event.source, createdAt: event.row.created_at });
        return;
      }

      if (event.type === 'gift' && event.row) {
        const id = String(event.row.id ?? '');
        liveDeliveryProbe.mark({ eventType: 'gift', eventId: id, phase: 'realtime_callback', source: event.source, createdAt: event.row.created_at });
        batcher.enqueue('gift', event.row);
        liveDeliveryProbe.mark({ eventType: 'gift', eventId: id, phase: 'state_queued', source: event.source, createdAt: event.row.created_at });
        return;
      }

      if (event.type === 'recovery') {
        liveDeliveryProbe.markLifecycle(event.phase, { sessionId, source: event.source, timestamp: event.timestamp });
        return;
      }

      if (event.type === 'guest_state' && (isHostRoom || liveGuestEventTargetsUser(event.row, currentUserId))) {
        const metadata = event.row?.metadata || {};
        const action = metadata.action || event.row?.action || '';
        const requestId = metadata.request_id || event.row?.request_id;
        const inviteId = metadata.invite_id || event.row?.invite_id;
        if (isHostRoom && action === 'requested' && requestId) {
          setJoinRequests(current => {
            const requests = new Map(current.map(row => [String(row.request_id), row]));
            requests.set(String(requestId), {
              request_id: requestId,
              user_id: event.row.actor_id,
              display_name: event.row.display_name || 'Droxion user',
              status: 'requested'
            });
            return actionableJoinRequests(Array.from(requests.values()).slice(-100));
          });
        } else if (isHostRoom && requestId && ['accepted', 'declined', 'expired'].includes(action)) {
          setJoinRequests(current => current.filter(row => String(row.request_id) !== String(requestId)));
        } else if (!isHostRoom && action === 'invited' && inviteId) {
          setInvite({
            invite_id: inviteId,
            session_id: sessionId,
            host_id: event.row.actor_id,
            host_name: event.row.display_name || 'Droxion user'
          });
        } else if (!isHostRoom && requestId && ['accepted', 'declined', 'removed', 'expired'].includes(action)) {
          setMyJoinRequest(current => ({ ...current, request_id: requestId, session_id: sessionId, status: action }));
        }
        if (!isHostRoom && ['removed', 'blocked'].includes(action)) {
          stopCamera();
          setGuestMode(false);
          setInvite(null);
        }
        setGuestStateRevision(value => value + 1);
      }
    });
    return () => { unsubscribe(); batcher.dispose(); };
  }, [sessionId, isHostRoom, currentUserId, stopCamera]);

  useEffect(() => {
    const rows = pendingChatCommitsRef.current.splice(0);
    for (const row of rows) liveDeliveryProbe.mark({ eventType: 'chat', eventId: row.id, phase: 'render_committed', createdAt: row.created_at });
  }, [messages]);

  useEffect(() => {
    const rows = pendingGiftCommitsRef.current.splice(0);
    for (const row of rows) liveDeliveryProbe.mark({ eventType: 'gift', eventId: row.id, phase: 'render_committed', createdAt: row.created_at });
  }, [giftEvents]);

  useEffect(() => () => releaseLiveEventStream(sessionId), [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setAudioBlocked(false);
      return;
    }

    const markBlocked = () => setAudioBlocked(true);
    const markRecovered = () => setAudioBlocked(false);
    const retryFromGesture = () => {
      const room = lkRoomRef.current;
      if (!room) return;
      unlockRemoteAudio(room).then(unlocked => setAudioBlocked(!unlocked));
    };

    window.addEventListener('droxion:live-audio-blocked', markBlocked);
    window.addEventListener('droxion:live-audio-recovered', markRecovered);
    window.addEventListener('pointerdown', retryFromGesture, true);
    window.addEventListener('touchend', retryFromGesture, true);
    return () => {
      window.removeEventListener('droxion:live-audio-blocked', markBlocked);
      window.removeEventListener('droxion:live-audio-recovered', markRecovered);
      window.removeEventListener('pointerdown', retryFromGesture, true);
      window.removeEventListener('touchend', retryFromGesture, true);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!currentUserId) return;
    let alive = true;
    (async () => {
      const [{ data: status }, { data: giftRows }] = await Promise.all([
        supabase.rpc('droxion_live_status'),
        supabase.rpc('droxion_gift_options')
      ]);
      if (!alive) return;
      setIsLive(Boolean(status?.is_live));
      setOwnSessionId(status?.is_live ? status?.session_id || '' : '');
      if (status?.title || status?.orientation) {
        setLiveSetup(current => ({
          ...current,
          title: status?.title || current.title,
          tags: Array.isArray(status?.tags) ? status.tags.join(', ') : current.tags,
          orientation: status?.orientation || current.orientation,
          allowGuests: status?.allow_guest_requests !== false
        }));
      }
      setGifts(giftRows || []);
      await loadLive();
    })();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden' && !document.querySelector('.liveRoomV4')) loadLive();
    }, 120000 + Math.floor(Math.random() * 60000));
    return () => { alive = false; window.clearInterval(timer); };
  }, [currentUserId]);

  useEffect(() => {
    if (!isLive) return;
    const heartbeat = async () => {
      const { data } = await supabase.rpc('droxion_live_heartbeat');
      if (data?.is_live === false) {
        setIsLive(false);
        setOwnSessionId('');
        await disconnectTransport();
        stopCamera();
        setNotice('');
      }
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 15000);
    return () => window.clearInterval(timer);
  }, [isLive, disconnectTransport, stopCamera]);

  function openGoLiveSetup() { setNotice(''); setSetupOpen(true); }

  async function directLiveRpc(functionName, payload = {}, timeoutMs = 6000) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sign in before going live.');

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload || {}),
        cache: 'no-store',
        signal: controller.signal
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if (!response.ok) {
        throw new Error(body?.message || body?.error || text || `LIVE request failed (${response.status}).`);
      }
      return body;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function startLive() {
    if (!currentUserId) return setNotice('Sign in before going live.');
    // Give immediate, truthful feedback before camera/RPC/LiveKit work begins.
    // A successful backend write can otherwise leave this setup sheet visible
    // while the browser is still settling the client response.
    setSetupOpen(false);
    setNotice('Starting LIVE…');
    let stream;
    try { stream = await ensureCamera(liveSetup.orientation, 'user'); }
    catch (error) {
      const name = error?.name || '';
      setNotice(name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Camera or microphone permission is blocked. Allow Camera and Microphone for Droxion, then try again.'
        : error?.message || 'Camera and microphone are required to go live.');
      setSetupOpen(true);
      return;
    }
    const tags = liveSetup.tags.split(',').map(item => item.trim()).filter(Boolean).slice(0, 8);
    const startPayload = {
      p_title: liveSetup.title.trim() || 'Live on Droxion',
      p_tags: tags,
      p_orientation: liveSetup.orientation,
      p_allow_guest_requests: liveSetup.allowGuests
    };
    let data = null;
    let error = null;
    try {
      data = await directLiveRpc('droxion_start_live', startPayload, 6000);
    } catch (startError) {
      error = startError;
      setNotice('Confirming LIVE…');
      try {
        const status = await directLiveRpc('droxion_live_status', {}, 4000);
        if (status?.is_live) {
          data = status;
          error = null;
        }
      } catch {}
    }
    if (error || !data?.is_live) {
      setNotice(error?.message || 'Could not start LIVE.');
      stopCamera();
      setSetupOpen(true);
      return;
    }

    const room = {
      user_id: currentUserId,
      session_id: data.session_id,
      display_name: 'Your Live',
      title: data.title || liveSetup.title || 'Live on Droxion',
      tags: data.tags || tags,
      orientation: data.orientation || liveSetup.orientation,
      allow_guest_requests: data.allow_guest_requests !== false
    };
    setBeautyMode('off');
    setIsLive(true);
    setOwnSessionId(data.session_id || '');
    setActiveRoom(room);
    setSetupOpen(false);
    setNotice('You are live.');
    requestAnimationFrame(attachLocal);
    highlightRecorderRef.current = createLiveHighlightRecorder({
      creatorId: currentUserId,
      sessionId: data.session_id,
      stream,
      title: room.title
    });
    await loadLive();
  }

  async function endLive() {
    const { error } = await supabase.rpc('droxion_set_live', { p_live: false });
    if (error) return setNotice(error.message || 'Could not end LIVE.');
    setNotice('Saving LIVE highlights…');
    try {
      await highlightRecorderRef.current?.stopAndPublish?.();
    } catch (error) {
      console.warn('Could not save LIVE highlights', error);
    }
    highlightRecorderRef.current = null;
    setIsLive(false);
    setOwnSessionId('');
    setActiveRoom(null);
    setGuestMode(false);
    setGuestActionBusy('');
    setJoinRequests([]);
    setMyJoinRequest(null);
    setInvite(null);
    setRoomStatus(null);
    setViewers([]);
    setGiftDrawerOpen(false);
    setSetupOpen(false);
    await disconnectTransport();
    stopCamera();
    setNotice('');
    await loadLive();
  }

  async function openRoom(profile) {
    if (!profile?.user_id) return;
    setNotice('');
    if (sessionId && !isHostRoom) await supabase.rpc('droxion_leave_live', { p_session_id: sessionId });
    await disconnectTransport();
    if (guestMode) stopCamera();
    setGuestMode(false);
    setMessages([]);
    setGiftEvents([]);
    setGiftDrawerOpen(false);
    setMyJoinRequest(null);
    setInvite(null);
    setRoomStatus(null);
    setHostVideoReady(false);
    setGuestVideoReady(false);
    lastChatId.current = 0;
    lastGiftAt.current = new Date().toISOString();
    seenGiftIds.current.clear();
    const { data, error } = await supabase.rpc('droxion_join_live', { p_host_id: profile.user_id });
    if (error || !data?.allowed) {
      setNotice(error?.message || 'This LIVE has ended.');
      await loadLive();
      return;
    }
    setActiveRoom({ ...profile, session_id: data.session_id });
  }

  useEffect(() => {
    const handler = async event => {
      const creatorId = event?.detail?.creatorId;
      if (!creatorId || creatorId === currentUserId) return;
      let target = profiles.find(profile => profile.user_id === creatorId);
      if (!target) {
        const current = await loadLive();
        target = current.find(profile => profile.user_id === creatorId);
      }
      if (target) await openRoom(target);
      else setNotice('That creator is no longer LIVE.');
    };
    window.addEventListener('droxion:open-live-creator', handler);
    return () => window.removeEventListener('droxion:open-live-creator', handler);
  }, [profiles, currentUserId, sessionId, isHostRoom, guestMode]);

  async function leaveRoom() {
    setNotice('');
    if (sessionId && !isHostRoom) await supabase.rpc('droxion_leave_live', { p_session_id: sessionId });
    if (guestMode) stopCamera();
    setGuestMode(false);
    setInvite(null);
    setMyJoinRequest(null);
    setActiveRoom(null);
    setRoomStatus(null);
    setViewers([]);
    setMessages([]);
    setGiftEvents([]);
    setGiftDrawerOpen(false);
    setGuestActionBusy('');
    await disconnectTransport();
    setNotice('');
  }

  async function switchLive(direction) {
    if (isHostRoom || profiles.length < 2 || !activeRoom?.user_id) return;
    const currentIndex = profiles.findIndex(profile => profile.user_id === activeRoom.user_id);
    const base = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (base + direction + profiles.length) % profiles.length;
    if (profiles[nextIndex]?.user_id !== activeRoom.user_id) await openRoom(profiles[nextIndex]);
  }

  function handleTouchStart(event) { touchStartY.current = event.touches?.[0]?.clientY ?? null; }
  function handleTouchEnd(event) {
    if (touchStartY.current == null || isHostRoom) return;
    const end = event.changedTouches?.[0]?.clientY ?? touchStartY.current;
    const delta = touchStartY.current - end;
    touchStartY.current = null;
    if (Math.abs(delta) >= 70) switchLive(delta > 0 ? 1 : -1);
  }

  useEffect(() => {
    if (!sessionId || isHostRoom) return;
    const beat = () => supabase.rpc('droxion_live_viewer_heartbeat', { p_session_id: sessionId });
    beat();
    const timer = window.setInterval(beat, 60000);
    return () => window.clearInterval(timer);
  }, [sessionId, isHostRoom]);

  useEffect(() => {
    if (!sessionId) return;
    let stopped = false;
    const refresh = async () => {
      const { data: status } = await supabase.rpc('droxion_live_room_status', { p_session_id: sessionId });
      if (stopped) return;
      setRoomStatus(status || null);
      const count = Number(status?.viewer_count || 0);
      if (isHostRoom && count > previousViewerCount.current) highlightRecorderRef.current?.markMoment?.(2 + Math.min(4, count - previousViewerCount.current));
      previousViewerCount.current = count;
      if (status && status.active === false && !isHostRoom) {
        const others = profiles.filter(profile => profile.user_id !== activeRoom?.user_id);
        if (others[0]) await openRoom(others[0]); else await leaveRoom();
      }
    };
    refresh();
    const timer = window.setInterval(refresh, isHostRoom ? 15000 : 60000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [sessionId, isHostRoom, profiles, activeRoom?.user_id]);

  useEffect(() => {
    if (!sessionId || !isHostRoom) { setViewers([]); return; }
    let stopped = false;
    supabase.rpc('droxion_live_room_viewers', { p_session_id: sessionId }).then(({ data }) => {
      if (!stopped) setViewers((data || []).slice(0, 100));
    });
    return () => { stopped = true; };
  }, [sessionId, isHostRoom]);

  useEffect(() => {
    if (!sessionId || guestStateRevision === 0) return;
    let stopped = false;
    authoritativeLiveRpc('droxion_live_room_status', { p_session_id: sessionId }).then(({ data }) => {
      if (!stopped && data) setRoomStatus(data);
    });
    return () => { stopped = true; };
  }, [sessionId, guestStateRevision]);

  useEffect(() => {
    if (!sessionId || !isHostRoom) { setJoinRequests([]); return; }
    let stopped = false;
    let timer = null;
    let attempt = 0;
    const poll = async () => {
      const { data } = await authoritativeLiveRpc('droxion_live_join_requests', { p_session_id: sessionId });
      if (stopped) return;
      const requests = actionableJoinRequests(data);
      setJoinRequests(requests);
      if (requests.length) timer = window.setTimeout(poll, livePendingRecoveryDelay(attempt++));
    };
    poll();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [sessionId, isHostRoom, guestStateRevision]);

  useEffect(() => {
    if (!sessionId || isHostRoom) return;
    let stopped = false;
    let timer = null;
    let attempt = 0;
    const poll = async () => {
      const { data } = await authoritativeLiveRpc('droxion_my_live_join_request', { p_session_id: sessionId });
      if (stopped) return;
      if (!data?.request_id) {
        setMyJoinRequest(null);
        return;
      }
      setMyJoinRequest(data);
      if (data.status === 'accepted' && String(data.request_id) === voluntarilyExitedRequestRef.current) {
        return;
      }
      if (shouldEnterGuestMode({ requestId: data.request_id, status: data.status, guestMode, voluntarilyExitedRequestId: voluntarilyExitedRequestRef.current })) {
        try {
          await ensureCamera(activeRoom?.orientation || 'vertical', 'user');
          if (!stopped) { setGuestMode(true); setNotice('You joined the LIVE.'); requestAnimationFrame(attachLocal); }
        } catch { setNotice('Camera and microphone permission are required to join the LIVE.'); }
      } else if (['declined', 'removed', 'expired'].includes(data.status)) {
        if (guestMode) stopCamera();
        setGuestMode(false);
        if (data.status === 'declined') setNotice('The host declined your join request.');
        if (data.status === 'removed') setNotice('The host removed you as guest.');
      }
      if (!stopped && data.status === 'requested') timer = window.setTimeout(poll, livePendingRecoveryDelay(attempt++));
    };
    poll();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [sessionId, isHostRoom, guestMode, activeRoom?.orientation, ensureCamera, attachLocal, stopCamera, guestStateRevision]);

  useEffect(() => {
    if (!sessionId || isHostRoom) return;
    let stopped = false;
    let timer = null;
    let attempt = 0;
    const poll = async () => {
      const { data } = await authoritativeLiveRpc('droxion_my_live_invite');
      if (stopped) return;
      const nextInvite = data?.invite_id && data?.session_id === sessionId ? data : null;
      setInvite(nextInvite);
      if (nextInvite) timer = window.setTimeout(poll, livePendingRecoveryDelay(attempt++));
    };
    poll();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [sessionId, isHostRoom, guestStateRevision]);

  useEffect(() => {
    if (!currentUserId || isHostRoom || !activeRoom?.user_id) { setFollowingHost(false); return; }
    let alive = true;
    supabase.from('droxion_follows').select('followed_id').eq('follower_id', currentUserId).eq('followed_id', activeRoom.user_id).maybeSingle().then(({ data }) => { if (alive) setFollowingHost(Boolean(data)); });
    return () => { alive = false; };
  }, [currentUserId, isHostRoom, activeRoom?.user_id]);

  async function toggleFollow() {
    if (!currentUserId || !activeRoom?.user_id || followBusy) return;
    setFollowBusy(true);
    const query = followingHost
      ? supabase.from('droxion_follows').delete().eq('follower_id', currentUserId).eq('followed_id', activeRoom.user_id)
      : supabase.from('droxion_follows').insert({ follower_id: currentUserId, followed_id: activeRoom.user_id });
    const { error } = await query;
    if (!error) setFollowingHost(value => !value); else setNotice(error.message);
    setFollowBusy(false);
  }

  async function requestToJoin() {
    if (!sessionId || guestMode) return;
    if (myJoinRequest?.status === 'declined') {
      setNotice('The host declined this request. You cannot request again during this LIVE.');
      return;
    }
    const { data, error } = await supabase.rpc('droxion_request_live_guest', { p_session_id: sessionId });
    if (error || !data?.allowed) {
      const reason = data?.reason;
      setNotice(reason === 'requests_disabled' ? 'This creator is not accepting guest requests.' : reason === 'guest_already_joined' ? 'A guest is already on this LIVE.' : error?.message || 'Could not send join request.');
      return;
    }
    voluntarilyExitedRequestRef.current = '';
    setMyJoinRequest({ request_id: data.request_id, status: 'requested', session_id: sessionId });
    setGuestStateRevision(value => value + 1);
    setNotice('Join request sent to the host.');
  }

  async function respondJoinRequest(requestId, accept) {
    if (respondingRequestIds.includes(requestId)) return;
    const previous = joinRequests.find(item => String(item.request_id) === String(requestId));
    setRespondingRequestIds(current => [...current, requestId]);
    setJoinRequests(current => current.filter(item => String(item.request_id) !== String(requestId)));
    setNotice('');
    invalidateLiveGuestState(sessionId);
    setGuestStateRevision(value => value + 1);
    try {
      const { data, error } = await supabase.rpc('droxion_respond_live_join_request', { p_request_id: requestId, p_accept: accept });
      invalidateLiveGuestState(sessionId);
      const refreshed = await supabase.rpc('droxion_live_join_requests', { p_session_id: sessionId });
      const authoritative = actionableJoinRequests(refreshed.data);
      setJoinRequests(authoritative);
      setGuestStateRevision(value => value + 1);
      if (!error && data?.allowed) {
        setNotice(accept ? 'Guest accepted.' : 'Guest request declined.');
      } else if (refreshed.error || authoritative.some(item => String(item.request_id) === String(requestId))) {
        if (previous && refreshed.error) setJoinRequests(current => actionableJoinRequests([...current, previous]));
        setNotice(error?.message || refreshed.error?.message || 'Could not update this join request.');
      } else {
        setNotice('');
      }
    } finally {
      setRespondingRequestIds(current => current.filter(id => String(id) !== String(requestId)));
    }
  }

  async function respondInvite(accept) {
    if (!invite?.invite_id) return;
    if (accept) {
      try { await ensureCamera(activeRoom?.orientation || 'vertical', 'user'); }
      catch { setNotice('Camera and microphone permission are required to join the LIVE.'); return; }
    }
    const { data, error } = await supabase.rpc('droxion_respond_live_invite', { p_invite_id: invite.invite_id, p_accept: accept });
    if (error || !data?.allowed) {
      setNotice(error?.message || 'Invite is no longer available.');
      if (accept) stopCamera();
    } else {
      setGuestMode(Boolean(accept));
      setNotice(accept ? 'You joined as a guest.' : 'Invite declined.');
      if (accept) requestAnimationFrame(attachLocal);
    }
    setInvite(null);
  }

  async function inviteViewer(viewerId) {
    const { data, error } = await supabase.rpc('droxion_invite_live_guest', { p_session_id: sessionId, p_invitee_id: viewerId });
    setNotice(error?.message || (data?.allowed ? 'Guest invite sent.' : 'Could not invite this viewer.'));
  }

  async function removeGuestMembership(attempts = 1) {
    let response = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      response = await supabase.rpc('droxion_remove_live_guest', { p_session_id: sessionId });
      if (!response.error && response.data?.allowed !== false) return response;
      if (attempt < attempts - 1) await new Promise(resolve => window.setTimeout(resolve, 250 * (attempt + 1)));
    }
    return response;
  }

  async function removeGuest() {
    const guestId = roomStatus?.guest_id || remoteGuestId;
    if (!guestId || guestActionBusy) return;
    setGuestMenuOpen(false);
    setGuestActionBusy('remove');
    const { data, error } = await removeGuestMembership();
    if (error || data?.allowed === false) {
      setNotice(error?.message || 'Could not remove this guest.');
    } else {
      remoteTracksRef.current.forEach((track, key) => {
        if (!key.startsWith(`${guestId}:`)) return;
        try { track.detach(); } catch {}
        remoteTracksRef.current.delete(key);
      });
      setGuestVideoReady(false);
      setRoomStatus(current => current ? { ...current, guest_id: null } : current);
      setNotice('Guest removed. The LIVE is still running.');
    }
    setGuestActionBusy('');
  }

  async function blockGuest() {
    const guestId = roomStatus?.guest_id || remoteGuestId;
    const guest = viewers.find(viewer => viewer.user_id === guestId);
    if (!guestId || guestActionBusy) return;
    if (!window.confirm(`Block ${guest?.display_name || 'this guest'} and remove them from your LIVE?`)) return;
    setGuestMenuOpen(false);
    setGuestActionBusy('block');
    const { data: blockResult, error: blockError } = await supabase.rpc('droxion_block_user', { p_blocked_user_id: guestId });
    if (blockError || !blockResult?.allowed) {
      setNotice(blockError?.message || 'Could not block this guest.');
      setGuestActionBusy('');
      return;
    }
    const { data: removeResult, error: removeError } = await removeGuestMembership(3);
    if (removeError || removeResult?.allowed === false) {
      setNotice(removeError?.message || 'User was blocked, but guest removal needs a retry.');
    } else {
      remoteTracksRef.current.forEach((track, key) => {
        if (!key.startsWith(`${guestId}:`)) return;
        try { track.detach(); } catch {}
        remoteTracksRef.current.delete(key);
      });
      setGuestVideoReady(false);
      setViewers(current => current.filter(viewer => viewer.user_id !== guestId));
      setRoomStatus(current => current ? { ...current, guest_id: null } : current);
      setNotice(`${guest?.display_name || 'Guest'} was blocked and removed.`);
    }
    setGuestActionBusy('');
  }

  async function leaveGuestStage() {
    if (!guestMode || !sessionId || guestActionBusy) return;
    setGuestActionBusy('leave');
    const hostId = activeRoom?.user_id;
    const { error: leaveError } = await supabase.rpc('droxion_leave_live', { p_session_id: sessionId });
    if (leaveError) {
      setNotice(leaveError.message || 'Could not leave the guest stage.');
      setGuestActionBusy('');
      return;
    }

    stopCamera();
    voluntarilyExitedRequestRef.current = String(myJoinRequest?.request_id || '');
    setGuestMode(false);
    setMyJoinRequest(null);
    setRoomStatus(current => current ? { ...current, guest_id: null } : current);
    const { data: joinResult, error: joinError } = await supabase.rpc('droxion_join_live', { p_host_id: hostId });
    if (joinError || !joinResult?.allowed) {
      await disconnectTransport();
      setActiveRoom(null);
      setNotice(joinError?.message || 'You left the stage, but the LIVE is no longer available.');
    } else {
      setActiveRoom(current => ({ ...current, session_id: joinResult.session_id || sessionId }));
      requestLiveAuthoritativeReconcile(joinResult.session_id || sessionId);
      setNotice('You left the guest stage and are watching as a viewer.');
    }
    setGuestActionBusy('');
  }

  useEffect(() => {
    if (!sessionId) return;
    let stopped = false;
    const poll = async () => {
      const { data } = await supabase.rpc('droxion_live_chat_messages', { p_session_id: sessionId, p_after_id: lastChatId.current });
      if (stopped || !data?.length) return;
      setMessages(current => mergeStableLiveEvents(current, data, 200));
      lastChatId.current = Math.max(lastChatId.current, ...data.map(row => Number(row.id)));
      if (isHostRoom) highlightRecorderRef.current?.markMoment?.(Math.min(5, data.length));
    };
    poll();
    const timer = window.setInterval(poll, 60000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [sessionId, isHostRoom]);

  useEffect(() => {
    if (!sessionId) return;
    lastGiftAt.current = new Date().toISOString();
    seenGiftIds.current.clear();
    setGiftEvents([]);
    let stopped = false;
    const poll = async () => {
      const { data } = await supabase.rpc('droxion_live_gift_events', {
        p_session_id: sessionId,
        p_after: liveGiftReconciliationCursor(lastGiftAt.current)
      });
      if (stopped || !data?.length) return;
      setGiftEvents(current => mergeStableLiveEvents(current, data, 30));
      const fresh = data.filter(row => {
        const id = String(row.id ?? '');
        if (!id || seenGiftIds.current.has(id)) return false;
        seenGiftIds.current.add(id);
        return true;
      });
      lastGiftAt.current = data.reduce((latest, row) => String(row.created_at || '') > String(latest || '') ? row.created_at : latest, lastGiftAt.current);
      if (isHostRoom && fresh.length) highlightRecorderRef.current?.markMoment?.(Math.min(20, fresh.reduce((sum, row) => sum + 4 + Math.log10(Math.max(1, Number(row.cost_coins || 1))), 0)));
    };
    poll();
    const timer = window.setInterval(poll, 60000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [sessionId, isHostRoom]);

  async function sendChat() {
    const body = draft.trim();
    if (!body || !sessionId || sendingChat.current) return;
    sendingChat.current = true;
    liveDeliveryProbe.startSend('chat');
    try {
      const { data, error } = await supabase.rpc('droxion_send_live_chat', { p_session_id: sessionId, p_body: body });
      if (error || !data?.allowed) {
        liveDeliveryProbe.cancelSend('chat');
        setNotice(error?.message || 'Message could not be sent.');
      }
      else {
        const sent = liveChatRowFromWrite(data, {
          body,
          senderId: currentUserId,
          displayName: 'You'
        });
        if (sent) {
          liveDeliveryProbe.mark({ eventType: 'chat', eventId: sent.id, phase: 'write_success', source: 'sender', createdAt: sent.created_at });
          pendingChatCommitsRef.current.push(sent);
          setMessages(current => mergeStableLiveEvents(current, [sent], 200));
          lastChatId.current = Math.max(lastChatId.current, Number(sent.id || 0));
        } else {
          requestLiveAuthoritativeReconcile(sessionId, ['chat']);
          const { data: rows } = await supabase.rpc('droxion_live_chat_messages', { p_session_id: sessionId, p_after_id: lastChatId.current });
          if (rows?.length) {
            setMessages(current => mergeStableLiveEvents(current, rows, 200));
            lastChatId.current = Math.max(lastChatId.current, ...rows.map(row => Number(row.id || 0)));
          }
          liveDeliveryProbe.cancelSend('chat');
        }
        setDraft('');
      }
    } finally { sendingChat.current = false; }
  }

  async function sendGift(profile, gift) {
    if (busyGift) return;
    setBusyGift(`${profile.user_id}:${gift.gift_code}`);
    liveDeliveryProbe.startSend('gift');
    const { data, error } = await supabase.rpc('droxion_send_live_gift', { p_recipient_id: profile.user_id, p_gift_code: gift.gift_code });
    if (error) { liveDeliveryProbe.cancelSend('gift'); setNotice(error.message || 'Gift could not be sent.'); }
    else if (!data?.allowed) {
      liveDeliveryProbe.cancelSend('gift');
      if (data?.reason === 'insufficient_coins') { setNotice(`You need ${data.required_coins} coins.`); onOpenWallet?.(); }
      else setNotice('Gift could not be sent.');
    } else {
      onCoinsChanged?.(Number(data.coin_balance || 0));
      if (data.gift_id) {
        const sentGift = {
          id: data.gift_id,
          sender_id: currentUserId,
          display_name: 'You',
          gift_name: data.gift_name || gift.gift_name,
          emoji: data.emoji || gift.emoji,
          cost_coins: Number(data.cost_coins || gift.cost_coins || 0),
          created_at: data.created_at || new Date().toISOString()
        };
        liveDeliveryProbe.mark({ eventType: 'gift', eventId: sentGift.id, phase: 'write_success', source: 'sender', createdAt: sentGift.created_at });
        seenGiftIds.current.add(String(sentGift.id));
        pendingGiftCommitsRef.current.push(sentGift);
        setGiftEvents(current => mergeStableLiveEvents(current, [sentGift], 30));
      } else liveDeliveryProbe.cancelSend('gift');
      const successNotice = `${data.emoji} ${data.gift_name} sent.`;
      setNotice(successNotice);
      window.clearTimeout(noticeExpiryRef.current);
      noticeExpiryRef.current = window.setTimeout(() => {
        setNotice(current => current === successNotice ? '' : current);
      }, 3000);
      setGiftDrawerOpen(false);
    }
    setBusyGift('');
  }

  async function toggleMic() {
    if (microphoneSyncRef.current) return;
    const next = !micOn;
    if (!next) streamRef.current?.getAudioTracks().forEach(track => { track.enabled = false; });
    const synchronize = (async () => {
      try {
        const actual = await setPublishedAudioMuted(lkRoomRef.current, !next, streamRef.current);
        setMicOn(!actual.muted);
      } catch (error) {
        try {
          const restored = await setPublishedAudioMuted(lkRoomRef.current, !micOn, streamRef.current);
          setMicOn(!restored.muted);
        } catch {}
        setNotice(error?.message || 'Could not update the LIVE microphone.');
      }
    })().finally(() => { microphoneSyncRef.current = null; });
    microphoneSyncRef.current = synchronize;
    await synchronize;
  }

  function handleHomePullStart(event) {
    if (refreshingLiveFeed || window.scrollY > 0) return;
    homePullStartY.current = event.touches?.[0]?.clientY ?? null;
  }

  function handleHomePullMove(event) {
    if (homePullStartY.current == null || window.scrollY > 0) return;
    const distance = (event.touches?.[0]?.clientY ?? homePullStartY.current) - homePullStartY.current;
    if (distance <= 0) return setHomePullDistance(0);
    if (distance > 8) event.preventDefault();
    setHomePullDistance(Math.min(96, distance * 0.55));
  }

  async function handleHomePullEnd() {
    const shouldRefresh = homePullDistance >= 58 && !refreshingLiveFeed;
    homePullStartY.current = null;
    if (!shouldRefresh) return setHomePullDistance(0);
    setRefreshingLiveFeed(true);
    setHomePullDistance(48);
    try { setVisibleLiveCount(LIVE_FEED_PAGE_SIZE); await loadLive(); }
    finally {
      setRefreshingLiveFeed(false);
      setHomePullDistance(0);
    }
  }

  useEffect(() => {
    const sentinel = liveFeedSentinelRef.current;
    if (sessionId || !sentinel || visibleLiveCount >= profiles.length) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisibleLiveCount(current => Math.min(profiles.length, current + LIVE_FEED_PAGE_SIZE));
      }
    }, { rootMargin: '500px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sessionId, profiles.length, visibleLiveCount]);

  function toggleCamera() {
    const next = !cameraOn;
    streamRef.current?.getVideoTracks().forEach(track => { track.enabled = next; });
    setPublishedVideoMuted(lkRoomRef.current, !next)
      .catch(error => setNotice(error?.message || 'Could not update the LIVE camera.'));
    setCameraOn(next);
    if (next) requestAnimationFrame(attachLocal);
  }

  async function flipCamera() {
    if (!streamRef.current || !navigator.mediaDevices?.getUserMedia) return;
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    try {
      const portrait = roomOrientation !== 'horizontal';
      const fresh = await navigator.mediaDevices.getUserMedia({
        video: portrait
          ? { facingMode: { ideal: nextFacing }, width: { ideal: 720 }, height: { ideal: 1280 } }
          : { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      const newVideoTrack = fresh.getVideoTracks()[0];
      if (!newVideoTrack) throw new Error('No camera available.');
      const oldStream = streamRef.current;
      const audioTracks = oldStream.getAudioTracks();
      const oldVideoTracks = oldStream.getVideoTracks();
      const nextStream = new MediaStream([newVideoTrack, ...audioTracks]);
      streamRef.current = nextStream;
      await replacePublishedVideo(lkRoomRef.current, newVideoTrack);
      oldVideoTracks.forEach(track => track.stop());
      setFacingMode(nextFacing);
      setCameraOn(true);
      requestAnimationFrame(attachLocal);
    } catch (error) { setNotice(error?.message || 'Could not switch camera.'); }
  }

  function cycleBeauty() {
    setBeautyMode(current => current === 'off' ? 'soft' : current === 'soft' ? 'clear' : 'off');
  }

  if (sessionId) {
    const host = isHostRoom ? { user_id: currentUserId, display_name: 'Your Live', ...activeRoom } : activeRoom;
    const liveIndex = profiles.findIndex(profile => profile.user_id === activeRoom?.user_id);
    const showRemoteGuest = guestVideoReady && !guestMode;
    const hasGuestStage = hasLiveGuest({ guestMode, guestVideoReady });
    const activeGuestId = roomStatus?.guest_id || remoteGuestId;
    const activeGuest = viewers.find(viewer => viewer.user_id === activeGuestId);
    const combinedEvents = [
      ...messages.slice(-8).map(item => ({ type: 'chat', time: item.created_at || '', key: `c-${item.id}`, ...item })),
      ...giftEvents.slice(-5).map(item => ({ type: 'gift', time: item.created_at || '', key: `g-${item.id}`, ...item }))
    ].sort((a, b) => String(a.time).localeCompare(String(b.time))).slice(-8);

    return (
      <section className={`liveRoomPage liveRoomV4 liveRoom-${roomOrientation}`} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className={`liveStage liveStageV4 liveStage-${roomOrientation} ${hasGuestStage ? 'liveStage-split' : ''}`}>
          {isHostRoom
            ? <video ref={localVideoRef} autoPlay playsInline muted className={`liveMainVideo liveLocalPreview beauty-${beautyMode} ${facingMode === 'user' ? 'mirrored' : ''}`} />
            : <video ref={remoteHostVideo} autoPlay playsInline muted className="liveMainVideo" />}
          <audio ref={remoteHostAudio} autoPlay playsInline />

          {isHostRoom && !cameraOn && <div className="liveVideoLoading"><CameraOff size={30} /><strong>Camera is off</strong></div>}
          {!isHostRoom && !hostVideoReady && <div className="liveVideoLoading"><Radio size={30} /><strong>Connecting LIVE video…</strong></div>}

          {guestMode && <video ref={localVideoRef} autoPlay playsInline muted className={`liveGuestVideo liveGuestSelfVideo beauty-${beautyMode} ${facingMode === 'user' ? 'mirrored' : ''}`} />}
          {!guestMode && <video ref={remoteGuestVideo} autoPlay playsInline muted className={`liveGuestVideo ${showRemoteGuest ? '' : 'liveGuestVideoPending'}`} />}
          <audio ref={remoteGuestAudio} autoPlay playsInline />
          {audioBlocked && <button type="button" className="liveAudioRecovery" onClick={() => unlockRemoteAudio(lkRoomRef.current).then(unlocked => setAudioBlocked(!unlocked))}>Enable audio</button>}

          <div className="liveTopOverlay liveTopV4">
            <button className="liveBackButton" aria-label={isHostRoom ? 'End live' : 'Exit live'} onClick={isHostRoom ? endLive : leaveRoom}><ArrowLeft size={21} /><span>{isHostRoom ? 'End' : 'Exit'}</span></button>
            <div className="liveIdentity"><span className="liveBadge">LIVE</span><div className="liveIdentityText"><strong>{host?.display_name || 'Droxion Live'}</strong><small>{host?.title || liveSetup.title || 'Live on Droxion'}</small></div></div>
            {!isHostRoom && <button className={`liveFollowButton ${followingHost ? 'following' : ''}`} disabled={followBusy} onClick={toggleFollow}>{followingHost ? 'Following' : '+ Follow'}</button>}
            <div className="liveViewerBadge"><Users size={15} /> {roomStatus?.viewer_count || 0}</div>
          </div>

          {!isHostRoom && profiles.length > 1 && <div className="liveSwipeHint">{liveIndex + 1}/{profiles.length} · Swipe up for next LIVE</div>}
          <div className="liveBottomGradient" />

          <div className="liveChatOverlay liveChatV4">
            {combinedEvents.map(event => event.type === 'gift'
              ? <div className="liveChatLine liveGiftEvent" key={event.key}><strong>{event.display_name}</strong> sent {event.emoji} {event.gift_name}</div>
              : <div className="liveChatLine" key={event.key}><strong>{event.display_name}</strong> {event.body}</div>)}
            {combinedEvents.length === 0 && <div className="liveChatHint">Live chat will appear here.</div>}
          </div>

          {!isHostRoom && !guestMode && activeRoom?.allow_guest_requests !== false && !roomStatus?.guest_id && !guestVideoReady && (
            <button className="liveFloatingJoin" onClick={requestToJoin} disabled={['requested', 'declined'].includes(myJoinRequest?.status)}><UserPlus size={19} /> {myJoinRequest?.status === 'requested' ? 'Requested' : myJoinRequest?.status === 'declined' ? 'Declined' : 'Join LIVE'}</button>
          )}

          {isHostRoom && activeGuestId && guestVideoReady && <button type="button" className="liveGuestMenuButton" aria-label={`Manage ${activeGuest?.display_name || 'guest'}`} aria-haspopup="menu" aria-expanded={guestMenuOpen} onClick={() => setGuestMenuOpen(open => !open)}><MoreHorizontal size={22} /></button>}
          {isHostRoom && activeGuestId && guestVideoReady && guestMenuOpen && <div className="liveGuestMenu" role="menu" aria-label="Guest actions"><strong>{activeGuest?.display_name || 'Guest on stage'}</strong><button type="button" role="menuitem" disabled={Boolean(guestActionBusy)} onClick={removeGuest}><UserMinus size={17} /> {guestActionBusy === 'remove' ? 'Removing…' : 'Remove Guest'}</button><button type="button" role="menuitem" className="danger" disabled={Boolean(guestActionBusy)} onClick={blockGuest}><Ban size={17} /> {guestActionBusy === 'block' ? 'Blocking…' : 'Block User'}</button></div>}

          <div className="liveComposerOverlay liveComposerV4" onTouchStart={event => event.stopPropagation()} onTouchEnd={event => event.stopPropagation()}>
            <input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Say something…" maxLength={500} />
            {!isHostRoom && <button className="liveGiftButton" onClick={() => setGiftDrawerOpen(true)}><Gift size={19} /></button>}
            <button onClick={sendChat} disabled={!draft.trim()}><Send size={18} /></button>
          </div>

          {(isHostRoom || guestMode) && <div className="liveHostControlsV4">
            <button onClick={toggleMic} aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}>{micOn ? <Mic size={19} /> : <MicOff size={19} />}</button>
            <button onClick={toggleCamera}>{cameraOn ? <Camera size={19} /> : <CameraOff size={19} />}</button>
            <button onClick={flipCamera}><RefreshCw size={19} /></button>
            <button className={`beauty beauty-${beautyMode}`} onClick={cycleBeauty}><Sparkles size={18} /><span>{beautyMode === 'off' ? 'Beauty' : beautyMode === 'soft' ? 'Soft' : 'Clear'}</span></button>
            {guestMode && <button className="leaveStage" disabled={Boolean(guestActionBusy)} onClick={leaveGuestStage}><LogOut size={18} /><span>{guestActionBusy === 'leave' ? 'Leaving…' : 'Leave Guest'}</span></button>}
            {isHostRoom && <button className="end" onClick={endLive}><X size={19} /></button>}
          </div>}
        </div>

        {invite && <div className="liveInviteCard liveOverlayCardV4"><div><strong>{invite.host_name} invited you to join the LIVE.</strong><span>Your camera and mic will turn on.</span></div><button onClick={() => respondInvite(false)}>Decline</button><button className="accept" onClick={() => respondInvite(true)}>Join</button></div>}
        {notice && <div className={`liveNotice liveNoticeV4 ${notice === 'You are live.' ? 'liveToastSuccess' : ''}`}>{notice}</div>}

        {isHostRoom && joinRequests.length > 0 && <div className="liveViewerPanel liveRequestPanel liveHostPanelV4"><div className="livePanelHead"><div><strong>Requests to join</strong><span>{joinRequests.length} waiting</span></div></div><div className="liveRequestList">{joinRequests.map(request => <div className="liveRequestPerson" key={request.request_id}>{personAvatar(request)}<strong>{request.display_name}</strong><button disabled={respondingRequestIds.includes(request.request_id)} onClick={() => respondJoinRequest(request.request_id, false)}>Decline</button><button className="accept" disabled={respondingRequestIds.includes(request.request_id)} onClick={() => respondJoinRequest(request.request_id, true)}>Accept</button></div>)}</div></div>}

        {isHostRoom && <div className="liveViewerPanel liveHostPanelV4"><div className="livePanelHead"><div><strong>Viewers</strong><span>{viewers.length} in your LIVE</span></div></div>{viewers.length === 0 ? <div className="liveEmptySmall">Nobody is watching yet.</div> : <div className="liveViewerScroll">{viewers.map(viewer => <div className="liveViewerPerson" key={viewer.user_id}>{personAvatar(viewer)}<strong>{viewer.display_name}</strong>{!roomStatus?.guest_id && <button onClick={() => inviteViewer(viewer.user_id)}><UserPlus size={15} /> Invite</button>}</div>)}</div>}</div>}

        {giftDrawerOpen && !isHostRoom && host?.user_id && <div className="liveGiftDrawerBackdrop" onClick={() => setGiftDrawerOpen(false)}><div className="liveGiftDrawer" onClick={event => event.stopPropagation()}><div className="liveGiftDrawerHead"><div><strong>Send a gift</strong><span>🪙 {coins} coins</span></div><button onClick={() => setGiftDrawerOpen(false)}><X size={20} /></button></div><div className="liveGiftGridV4">{gifts.map(gift => <button key={gift.gift_code} disabled={Boolean(busyGift)} onClick={() => sendGift(host, gift)}><span>{gift.emoji}</span><strong>{gift.gift_name}</strong><small>{gift.cost_coins} coins</small></button>)}</div><button className="liveBuyCoinsV4" onClick={() => onOpenWallet?.()}>+ Buy Coins</button></div></div>}
      </section>
    );
  }

  return (
    <section className="realPage liveBrowsePage liveFeedPage liveOnlyHome" onTouchStart={handleHomePullStart} onTouchMove={handleHomePullMove} onTouchEnd={handleHomePullEnd} onTouchCancel={handleHomePullEnd}>
      <div className={`livePullRefresh ${refreshingLiveFeed ? 'refreshing' : ''}`} style={{ height: homePullDistance }} aria-live="polite"><RefreshCw size={19} />{refreshingLiveFeed && <span>Refreshing LIVE</span>}</div>
      <button type="button" className="liveGoButton liveNavGoTrigger" onClick={openGoLiveSetup} aria-hidden="true" tabIndex={-1}>Go Live</button>
      <div className="liveOnlyHomeHead"><strong><Radio size={15} /> {profiles.length} LIVE now</strong><span>{profiles.length ? 'Browse creators. Video connects only after you open a LIVE.' : 'No one is live right now.'}</span></div>
      {notice && <div className="liveNotice">{notice}</div>}
      {profiles.length === 0 ? <div className="liveZeroState liveZeroSimple"><span className="liveZeroIcon"><Radio size={28} /></span><h2>No one is LIVE right now</h2><p>When creators go LIVE, they will appear here.</p></div> : <div className="liveFeedScroll liveOnlyScroll" aria-label="People live now">{liveFeedWindow(profiles, visibleLiveCount).map(profile => <button key={profile.user_id} className={`liveFeedCard ${profile.orientation === 'horizontal' ? 'horizontal' : 'vertical'}`} onClick={() => openRoom(profile)}>{profile.avatar_url ? <img src={profile.avatar_url} alt={profile.display_name} loading="lazy" decoding="async" /> : <div className="liveBrowseFallback" />}<div className="liveBrowseShade" /><div className="liveFeedCardTop"><span className="liveBadge">LIVE</span><span className="liveFeedViewers"><Users size={13} /> {profile.viewer_count || 0}</span></div><div className="liveBrowseInfo"><strong>{profile.display_name}{profile.age ? `, ${profile.age}` : ''}</strong><b>{profile.title || 'Live on Droxion'}</b><small>{profile.country || 'Global'}{profile.language ? ` · ${profile.language}` : ''}</small>{Array.isArray(profile.tags) && profile.tags.length > 0 && <div className="liveFeedTags">{profile.tags.slice(0, 3).map(tag => <span key={tag}>#{tag}</span>)}</div>}<em>Tap to open LIVE</em></div></button>)}{visibleLiveCount < profiles.length && <div ref={liveFeedSentinelRef} className="liveFeedSentinel" aria-hidden="true" />}</div>}

      {setupOpen && <div className="liveSetupOverlay" role="dialog" aria-modal="true"><div className="liveSetupSheet"><div className="liveSetupHead"><div><span>🔴 GO LIVE</span><h2>Set up your LIVE</h2></div><button onClick={() => setSetupOpen(false)}><X size={21} /></button></div><label>LIVE title<input value={liveSetup.title} maxLength={100} placeholder="What are you talking about?" onChange={event => setLiveSetup(state => ({ ...state, title: event.target.value }))} /></label><label>Tags<input value={liveSetup.tags} placeholder="music, chatting, business" onChange={event => setLiveSetup(state => ({ ...state, tags: event.target.value }))} /></label><div className="liveOrientationChoice"><button className={liveSetup.orientation === 'vertical' ? 'selected' : ''} onClick={() => setLiveSetup(state => ({ ...state, orientation: 'vertical' }))}><Smartphone size={22} /><strong>Vertical</strong><span>Best for phones</span></button><button className={liveSetup.orientation === 'horizontal' ? 'selected' : ''} onClick={() => setLiveSetup(state => ({ ...state, orientation: 'horizontal' }))}><Maximize2 size={22} /><strong>Horizontal</strong><span>Wide LIVE</span></button></div><label className="liveGuestToggle"><input type="checkbox" checked={liveSetup.allowGuests} onChange={event => setLiveSetup(state => ({ ...state, allowGuests: event.target.checked }))} /><span><strong>Allow viewers to request to join</strong><small>You approve every guest before they come on camera.</small></span></label><button className="liveStartButton" onClick={startLive}><Radio size={19} /> START LIVE</button></div></div>}
    </section>
  );
}
