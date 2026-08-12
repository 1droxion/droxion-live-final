import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, CameraOff, Gift, Maximize2, MessageCircle, Mic, MicOff, Radio, RefreshCw, Send, Smartphone, Sparkles, UserPlus, Users, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import './live-experience-v3.css';
import './live-experience-v4.css';

function iceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ];
  if (import.meta.env.VITE_TURN_URL) {
    servers.push({ urls: import.meta.env.VITE_TURN_URL, username: import.meta.env.VITE_TURN_USERNAME || '', credential: import.meta.env.VITE_TURN_CREDENTIAL || '' });
  }
  return servers;
}

function personAvatar(person, size = 42) {
  if (person?.avatar_url) return <img src={person.avatar_url} alt={person.display_name || 'Droxion user'} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  return <div style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: '#fff', fontWeight: 900 }}>{(person?.display_name || 'D')[0]}</div>;
}

export default function LiveExperience({ currentUserId, coins = 0, onCoinsChanged, onOpenWallet, onImmersiveChange }) {
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
  const [remoteBeautyMode, setRemoteBeautyMode] = useState('off');
  const [hostVideoReady, setHostVideoReady] = useState(false);
  const [guestVideoReady, setGuestVideoReady] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [followingHost, setFollowingHost] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [liveSetup, setLiveSetup] = useState({ title: '', tags: '', orientation: 'vertical', allowGuests: true });

  const localVideo = useRef(null);
  const remoteHostVideo = useRef(null);
  const remoteHostAudio = useRef(null);
  const remoteGuestVideo = useRef(null);
  const remoteGuestAudio = useRef(null);
  const streamRef = useRef(null);
  const remoteHostStreamRef = useRef(null);
  const remoteGuestStreamRef = useRef(null);
  const broadcasterPeers = useRef(new Map());
  const viewerPeers = useRef(new Map());
  const pendingIce = useRef(new Map());
  const lastSignalId = useRef(0);
  const lastChatId = useRef(0);
  const processingSignals = useRef(false);
  const requestedStreams = useRef(new Set());
  const touchStartY = useRef(null);
  const lastGiftAt = useRef(null);

  const sessionId = activeRoom?.session_id || (isLive ? ownSessionId : '');
  const isHostRoom = Boolean(isLive && ownSessionId && sessionId === ownSessionId);
  const roomOrientation = isHostRoom ? liveSetup.orientation : (activeRoom?.orientation || 'vertical');
  const immersive = Boolean(sessionId);

  useEffect(() => { onImmersiveChange?.(immersive); }, [immersive, onImmersiveChange]);
  useEffect(() => () => onImmersiveChange?.(false), [onImmersiveChange]);
  useEffect(() => {
    if (!notice || !['You are live.', 'Live ended.', 'Guest accepted.', 'Guest request declined.'].includes(notice)) return;
    const timer = window.setTimeout(() => setNotice(''), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function loadLive() {
    const { data } = await supabase.rpc('droxion_live_feed');
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

  const attachRemote = useCallback(role => {
    const stream = role === 'guest' ? remoteGuestStreamRef.current : remoteHostStreamRef.current;
    const video = role === 'guest' ? remoteGuestVideo.current : remoteHostVideo.current;
    const audio = role === 'guest' ? remoteGuestAudio.current : remoteHostAudio.current;
    if (!stream) return;
    if (video) {
      if (video.srcObject !== stream) video.srcObject = stream;
      video.muted = true;
      video.setAttribute('playsinline', '');
      video.play?.().catch(() => {});
    }
    if (audio) {
      if (audio.srcObject !== stream) audio.srcObject = stream;
      audio.play?.().catch(() => {});
    }
  }, []);

  const ensureCamera = useCallback(async (orientation = 'vertical', requestedFacing = facingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera is not supported in this browser.');
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
    streamRef.current = stream;
    setFacingMode(requestedFacing);
    setMicOn(true);
    setCameraOn(true);
    requestAnimationFrame(() => { attachLocal(); window.setTimeout(attachLocal, 120); window.setTimeout(attachLocal, 500); });
    return stream;
  }, [attachLocal, facingMode]);

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
      oldStream.getVideoTracks().forEach(track => track.stop());
      const nextStream = new MediaStream([newVideoTrack, ...audioTracks]);
      streamRef.current = nextStream;
      const replace = [];
      broadcasterPeers.current.forEach(pc => {
        const sender = pc.getSenders().find(item => item.track?.kind === 'video');
        if (sender) replace.push(sender.replaceTrack(newVideoTrack));
      });
      await Promise.allSettled(replace);
      setFacingMode(nextFacing);
      setCameraOn(true);
      requestAnimationFrame(attachLocal);
    } catch (error) {
      setNotice(error?.message || 'Could not switch camera.');
    }
  }

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
  }, []);

  const closePeers = useCallback(() => {
    broadcasterPeers.current.forEach(pc => pc.close());
    viewerPeers.current.forEach(pc => pc.close());
    broadcasterPeers.current.clear();
    viewerPeers.current.clear();
    pendingIce.current.clear();
    requestedStreams.current.clear();
    lastSignalId.current = 0;
    remoteHostStreamRef.current = null;
    remoteGuestStreamRef.current = null;
    setRemoteBeautyMode('off');
    setHostVideoReady(false);
    setGuestVideoReady(false);
    if (remoteHostVideo.current) remoteHostVideo.current.srcObject = null;
    if (remoteHostAudio.current) remoteHostAudio.current.srcObject = null;
    if (remoteGuestVideo.current) remoteGuestVideo.current.srcObject = null;
    if (remoteGuestAudio.current) remoteGuestAudio.current.srcObject = null;
  }, []);

  const flushIce = useCallback(async (key, pc) => {
    if (!pc?.remoteDescription) return;
    const list = pendingIce.current.get(key) || [];
    pendingIce.current.delete(key);
    for (const candidate of list) { try { await pc.addIceCandidate(candidate); } catch {} }
  }, []);

  useEffect(() => () => { closePeers(); stopCamera(); }, [closePeers, stopCamera]);
  useEffect(() => {
    if ((isHostRoom || guestMode) && streamRef.current) {
      requestAnimationFrame(attachLocal);
      const timer = window.setTimeout(attachLocal, 250);
      return () => window.clearTimeout(timer);
    }
  }, [isHostRoom, guestMode, attachLocal]);
  useEffect(() => { if (hostVideoReady) requestAnimationFrame(() => attachRemote('host')); }, [hostVideoReady, attachRemote]);
  useEffect(() => { if (guestVideoReady) requestAnimationFrame(() => attachRemote('guest')); }, [guestVideoReady, attachRemote]);

  useEffect(() => {
    if (!currentUserId) return;
    let alive = true;
    (async () => {
      const [{ data: status }, { data: giftRows }] = await Promise.all([supabase.rpc('droxion_live_status'), supabase.rpc('droxion_gift_options')]);
      if (!alive) return;
      setIsLive(Boolean(status?.is_live));
      setOwnSessionId(status?.is_live ? status?.session_id || '' : '');
      if (status?.title || status?.orientation) setLiveSetup(current => ({ ...current, title: status?.title || current.title, tags: Array.isArray(status?.tags) ? status.tags.join(', ') : current.tags, orientation: status?.orientation || current.orientation, allowGuests: status?.allow_guest_requests !== false }));
      setGifts(giftRows || []);
      await loadLive();
    })();
    const timer = setInterval(loadLive, 4000);
    return () => { alive = false; clearInterval(timer); };
  }, [currentUserId]);

  useEffect(() => {
    if (!isLive) return;
    const heartbeat = async () => {
      const { data } = await supabase.rpc('droxion_live_heartbeat');
      if (data?.is_live === false) { setIsLive(false); setOwnSessionId(''); stopCamera(); }
    };
    heartbeat();
    const timer = setInterval(heartbeat, 15000);
    return () => clearInterval(timer);
  }, [isLive, stopCamera]);

  function openGoLiveSetup() { setNotice(''); setSetupOpen(true); }

  async function startLive() {
    if (!currentUserId) return setNotice('Sign in before going live.');
    setNotice('');
    try { await ensureCamera(liveSetup.orientation, 'user'); }
    catch (error) {
      const name = error?.name || '';
      setNotice(name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'Camera or microphone permission is blocked. Allow Camera and Microphone for Droxion in your device settings, then try again.' : error?.message || 'Camera and microphone are required to go live.');
      return;
    }
    const tags = liveSetup.tags.split(',').map(item => item.trim()).filter(Boolean).slice(0, 8);
    const { data, error } = await supabase.rpc('droxion_start_live', { p_title: liveSetup.title.trim() || 'Live on Droxion', p_tags: tags, p_orientation: liveSetup.orientation, p_allow_guest_requests: liveSetup.allowGuests });
    if (error || !data?.is_live) { setNotice(error?.message || 'Could not start LIVE.'); stopCamera(); return; }
    const room = { user_id: currentUserId, session_id: data.session_id, display_name: 'Your Live', title: data.title || liveSetup.title || 'Live on Droxion', tags: data.tags || tags, orientation: data.orientation || liveSetup.orientation, allow_guest_requests: data.allow_guest_requests !== false };
    setBeautyMode('off');
    setIsLive(true);
    setOwnSessionId(data.session_id || '');
    setActiveRoom(room);
    setSetupOpen(false);
    setNotice('You are live.');
    requestAnimationFrame(() => { attachLocal(); window.setTimeout(attachLocal, 200); });
    await loadLive();
  }

  async function endLive() {
    const { error } = await supabase.rpc('droxion_set_live', { p_live: false });
    if (error) return setNotice(error.message || 'Could not end LIVE.');
    setIsLive(false);
    setOwnSessionId('');
    setActiveRoom(null);
    setGuestMode(false);
    setJoinRequests([]);
    closePeers();
    stopCamera();
    setNotice('Live ended.');
    await loadLive();
  }

  async function openRoom(profile) {
    if (!profile?.user_id) return;
    setNotice('');
    if (sessionId && !isHostRoom) await supabase.rpc('droxion_leave_live', { p_session_id: sessionId });
    closePeers();
    if (guestMode) stopCamera();
    setGuestMode(false);
    setMessages([]);
    setGiftEvents([]);
    setGiftDrawerOpen(false);
    setMyJoinRequest(null);
    setInvite(null);
    setRemoteBeautyMode('off');
    lastChatId.current = 0;
    lastGiftAt.current = new Date().toISOString();
    const { data, error } = await supabase.rpc('droxion_join_live', { p_host_id: profile.user_id });
    if (error || !data?.allowed) {
      setNotice(error?.message || 'This live has ended.');
      await loadLive();
      return;
    }
    setActiveRoom({ ...profile, session_id: data.session_id });
  }

  async function leaveRoom() {
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
    setRemoteBeautyMode('off');
    closePeers();
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
    if (Math.abs(delta) < 70) return;
    switchLive(delta > 0 ? 1 : -1);
  }

  useEffect(() => {
    if (!sessionId || isHostRoom) return;
    const beat = () => supabase.rpc('droxion_live_viewer_heartbeat', { p_session_id: sessionId });
    beat();
    const timer = setInterval(beat, 15000);
    return () => clearInterval(timer);
  }, [sessionId, isHostRoom]);

  useEffect(() => {
    if (!sessionId) return;
    let stopped = false;
    const refresh = async () => {
      const [{ data: status }, { data: viewerRows }] = await Promise.all([
        supabase.rpc('droxion_live_room_status', { p_session_id: sessionId }),
        supabase.rpc('droxion_live_room_viewers', { p_session_id: sessionId })
      ]);
      if (stopped) return;
      setRoomStatus(status || null);
      setViewers(viewerRows || []);
      if (status && status.active === false && !isHostRoom) {
        const others = profiles.filter(profile => profile.user_id !== activeRoom?.user_id);
        if (others[0]) await openRoom(others[0]); else await leaveRoom();
      }
    };
    refresh();
    const timer = setInterval(refresh, 2500);
    return () => { stopped = true; clearInterval(timer); };
  }, [sessionId, isHostRoom, profiles, activeRoom?.user_id]);

  useEffect(() => {
    if (!sessionId || !isHostRoom) { setJoinRequests([]); return; }
    let stopped = false;
    const poll = async () => {
      const { data } = await supabase.rpc('droxion_live_join_requests', { p_session_id: sessionId });
      if (!stopped) setJoinRequests(data || []);
    };
    poll();
    const timer = setInterval(poll, 1200);
    return () => { stopped = true; clearInterval(timer); };
  }, [sessionId, isHostRoom]);

  useEffect(() => {
    if (!sessionId || isHostRoom || guestMode) return;
    let stopped = false;
    const poll = async () => {
      const { data } = await supabase.rpc('droxion_my_live_join_request', { p_session_id: sessionId });
      if (stopped || !data?.request_id) return;
      setMyJoinRequest(data);
      if (data.status === 'accepted' && !guestMode) {
        try {
          await ensureCamera(activeRoom?.orientation || 'vertical', 'user');
          if (!stopped) { setGuestMode(true); setNotice('You joined the LIVE.'); requestAnimationFrame(attachLocal); }
        } catch { setNotice('Camera and microphone permission are required to join the LIVE.'); }
      } else if (data.status === 'declined') setNotice('The host declined your join request.');
    };
    poll();
    const timer = setInterval(poll, 1200);
    return () => { stopped = true; clearInterval(timer); };
  }, [sessionId, isHostRoom, guestMode, activeRoom?.orientation, ensureCamera, attachLocal]);

  useEffect(() => {
    if (!sessionId || isHostRoom) return;
    let stopped = false;
    const poll = async () => {
      const { data } = await supabase.rpc('droxion_my_live_invite');
      if (!stopped) setInvite(data?.invite_id && data?.session_id === sessionId ? data : null);
    };
    poll();
    const timer = setInterval(poll, 1500);
    return () => { stopped = true; clearInterval(timer); };
  }, [sessionId, isHostRoom]);

  useEffect(() => {
    if (!currentUserId || isHostRoom || !activeRoom?.user_id) { setFollowingHost(false); return; }
    let alive = true;
    supabase.from('droxion_follows').select('followed_id').eq('follower_id', currentUserId).eq('followed_id', activeRoom.user_id).maybeSingle().then(({ data }) => { if (alive) setFollowingHost(Boolean(data)); });
    return () => { alive = false; };
  }, [currentUserId, isHostRoom, activeRoom?.user_id]);

  async function toggleFollow() {
    if (!currentUserId || !activeRoom?.user_id || followBusy) return;
    setFollowBusy(true);
    if (followingHost) {
      const { error } = await supabase.from('droxion_follows').delete().eq('follower_id', currentUserId).eq('followed_id', activeRoom.user_id);
      if (!error) setFollowingHost(false); else setNotice(error.message);
    } else {
      const { error } = await supabase.from('droxion_follows').insert({ follower_id: currentUserId, followed_id: activeRoom.user_id });
      if (!error) setFollowingHost(true); else setNotice(error.message);
    }
    setFollowBusy(false);
  }

  async function requestToJoin() {
    if (!sessionId || guestMode) return;
    const { data, error } = await supabase.rpc('droxion_request_live_guest', { p_session_id: sessionId });
    if (error || !data?.allowed) {
      const reason = data?.reason;
      setNotice(reason === 'requests_disabled' ? 'This creator is not accepting guest requests.' : reason === 'guest_already_joined' ? 'A guest is already on this LIVE.' : error?.message || 'Could not send join request.');
      return;
    }
    setMyJoinRequest({ request_id: data.request_id, status: 'requested', session_id: sessionId });
    setNotice('Join request sent to the host.');
  }

  async function respondJoinRequest(requestId, accept) {
    const { data, error } = await supabase.rpc('droxion_respond_live_join_request', { p_request_id: requestId, p_accept: accept });
    if (error || !data?.allowed) setNotice(error?.message || 'This request is no longer available.');
    else setNotice(accept ? 'Guest accepted.' : 'Guest request declined.');
    setJoinRequests(current => current.filter(item => item.request_id !== requestId));
  }

  async function respondInvite(accept) {
    if (!invite?.invite_id) return;
    if (accept) {
      try { await ensureCamera(activeRoom?.orientation || 'vertical', 'user'); }
      catch { setNotice('Camera and microphone permission are required to join the live.'); return; }
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
  async function removeGuest() { await supabase.rpc('droxion_remove_live_guest', { p_session_id: sessionId }); setNotice('Guest removed.'); }

  const sendLiveSignal = useCallback(async (recipientId, role, type, payload = {}) => {
    if (!sessionId || !recipientId) return;
    await supabase.rpc('droxion_send_live_signal', { p_session_id: sessionId, p_recipient_id: recipientId, p_stream_role: role, p_signal_type: type, p_payload: payload });
  }, [sessionId]);

  async function setBeauty(nextMode) {
    setBeautyMode(nextMode);
    const sends = [];
    broadcasterPeers.current.forEach((_pc, key) => {
      const [role, viewerId] = key.split(':');
      if (viewerId) sends.push(sendLiveSignal(viewerId, role, 'beauty_mode', { mode: nextMode }));
    });
    await Promise.allSettled(sends);
  }

  async function cycleBeauty() {
    const next = beautyMode === 'off' ? 'soft' : beautyMode === 'soft' ? 'clear' : 'off';
    await setBeauty(next);
  }

  const createBroadcasterPeer = useCallback(async (viewerId, role) => {
    const key = `${role}:${viewerId}`;
    broadcasterPeers.current.get(key)?.close();
    const stream = await ensureCamera(roomOrientation, facingMode);
    const pc = new RTCPeerConnection({ iceServers: iceServers(), iceCandidatePoolSize: 10 });
    broadcasterPeers.current.set(key, pc);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = event => { if (event.candidate) sendLiveSignal(viewerId, role, 'ice', event.candidate.toJSON()); };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendLiveSignal(viewerId, role, 'offer', pc.localDescription?.toJSON?.() || offer);
    await sendLiveSignal(viewerId, role, 'beauty_mode', { mode: beautyMode });
  }, [ensureCamera, sendLiveSignal, roomOrientation, facingMode, beautyMode]);

  const createViewerPeer = useCallback((senderId, role) => {
    const key = `${role}:${senderId}`;
    if (viewerPeers.current.has(key)) return viewerPeers.current.get(key);
    const pc = new RTCPeerConnection({ iceServers: iceServers(), iceCandidatePoolSize: 10 });
    viewerPeers.current.set(key, pc);
    pc.onicecandidate = event => { if (event.candidate) sendLiveSignal(senderId, role, 'ice', event.candidate.toJSON()); };
    pc.ontrack = event => {
      let stream = event.streams?.[0];
      if (!stream) {
        const existing = role === 'guest' ? remoteGuestStreamRef.current : remoteHostStreamRef.current;
        stream = existing || new MediaStream();
        if (!stream.getTracks().some(track => track.id === event.track.id)) stream.addTrack(event.track);
      }
      if (role === 'guest') {
        remoteGuestStreamRef.current = stream;
        setGuestVideoReady(true);
        requestAnimationFrame(() => attachRemote('guest'));
      } else {
        remoteHostStreamRef.current = stream;
        setHostVideoReady(true);
        requestAnimationFrame(() => attachRemote('host'));
      }
    };
    return pc;
  }, [sendLiveSignal, attachRemote]);

  useEffect(() => {
    if (!sessionId || !currentUserId) return;
    let stopped = false;
    const poll = async () => {
      if (processingSignals.current || stopped) return;
      processingSignals.current = true;
      try {
        const { data: rows } = await supabase.rpc('droxion_live_signals_for_me', { p_session_id: sessionId, p_after_id: lastSignalId.current });
        for (const row of rows || []) {
          const key = `${row.stream_role}:${row.sender_id}`;
          try {
            if (row.signal_type === 'watch_request') {
              if ((row.stream_role === 'host' && isHostRoom) || (row.stream_role === 'guest' && guestMode)) await createBroadcasterPeer(row.sender_id, row.stream_role);
            } else if (row.signal_type === 'offer') {
              const pc = createViewerPeer(row.sender_id, row.stream_role);
              await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
              await flushIce(key, pc);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await sendLiveSignal(row.sender_id, row.stream_role, 'answer', pc.localDescription?.toJSON?.() || answer);
            } else if (row.signal_type === 'answer') {
              const pc = broadcasterPeers.current.get(key);
              if (pc && pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
                await flushIce(key, pc);
              }
            } else if (row.signal_type === 'ice') {
              const pc = broadcasterPeers.current.get(key) || viewerPeers.current.get(key);
              if (pc) {
                const candidate = new RTCIceCandidate(row.payload);
                if (pc.remoteDescription) await pc.addIceCandidate(candidate);
                else pendingIce.current.set(key, [...(pendingIce.current.get(key) || []), candidate]);
              }
            } else if (row.signal_type === 'beauty_mode' && row.stream_role === 'host') {
              const mode = ['off', 'soft', 'clear'].includes(row.payload?.mode) ? row.payload.mode : 'off';
              setRemoteBeautyMode(mode);
            }
          } catch (error) { console.warn('Live signal error', error); }
          lastSignalId.current = Math.max(lastSignalId.current, Number(row.id));
        }
      } finally { processingSignals.current = false; }
    };
    poll();
    const timer = setInterval(poll, 500);
    return () => { stopped = true; clearInterval(timer); };
  }, [sessionId, currentUserId, isHostRoom, guestMode, createBroadcasterPeer, createViewerPeer, sendLiveSignal, flushIce]);

  useEffect(() => {
    if (!sessionId || isHostRoom || !activeRoom?.user_id) return;
    const key = `host:${activeRoom.user_id}`;
    if (!requestedStreams.current.has(key)) {
      requestedStreams.current.add(key);
      sendLiveSignal(activeRoom.user_id, 'host', 'watch_request', {});
    }
  }, [sessionId, isHostRoom, activeRoom?.user_id, sendLiveSignal]);

  useEffect(() => {
    const guestId = roomStatus?.guest_id;
    if (!sessionId || !guestId || guestId === currentUserId) return;
    const key = `guest:${guestId}`;
    if (!requestedStreams.current.has(key)) {
      requestedStreams.current.add(key);
      sendLiveSignal(guestId, 'guest', 'watch_request', {});
    }
  }, [sessionId, roomStatus?.guest_id, currentUserId, sendLiveSignal]);

  useEffect(() => {
    if (!sessionId) return;
    let stopped = false;
    const poll = async () => {
      const { data } = await supabase.rpc('droxion_live_chat_messages', { p_session_id: sessionId, p_after_id: lastChatId.current });
      if (stopped || !data?.length) return;
      setMessages(current => [...current, ...data].slice(-200));
      lastChatId.current = Math.max(lastChatId.current, ...data.map(row => Number(row.id)));
    };
    poll();
    const timer = setInterval(poll, 800);
    return () => clearInterval(timer);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    lastGiftAt.current = new Date().toISOString();
    setGiftEvents([]);
    let stopped = false;
    const poll = async () => {
      const { data } = await supabase.rpc('droxion_live_gift_events', { p_session_id: sessionId, p_after: lastGiftAt.current });
      if (stopped || !data?.length) return;
      setGiftEvents(current => [...current, ...data].slice(-30));
      lastGiftAt.current = data[data.length - 1].created_at;
    };
    const timer = setInterval(poll, 900);
    return () => { stopped = true; clearInterval(timer); };
  }, [sessionId]);

  async function sendChat() {
    const body = draft.trim();
    if (!body || !sessionId) return;
    const { data, error } = await supabase.rpc('droxion_send_live_chat', { p_session_id: sessionId, p_body: body });
    if (error || !data?.allowed) setNotice(error?.message || 'Message could not be sent.');
    else setDraft('');
  }

  async function sendGift(profile, gift) {
    if (busyGift) return;
    setBusyGift(`${profile.user_id}:${gift.gift_code}`);
    const { data, error } = await supabase.rpc('droxion_send_live_gift', { p_recipient_id: profile.user_id, p_gift_code: gift.gift_code });
    if (error) setNotice(error.message || 'Gift could not be sent.');
    else if (!data?.allowed) {
      if (data?.reason === 'insufficient_coins') { setNotice(`You need ${data.required_coins} coins.`); onOpenWallet?.(); }
      else setNotice('Gift could not be sent.');
    } else {
      onCoinsChanged?.(Number(data.coin_balance || 0));
      setNotice(`${data.emoji} ${data.gift_name} sent.`);
      setGiftDrawerOpen(false);
    }
    setBusyGift('');
  }

  function toggleMic() {
    const next = !micOn;
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = next; });
    setMicOn(next);
  }
  function toggleCamera() {
    const next = !cameraOn;
    streamRef.current?.getVideoTracks().forEach(track => { track.enabled = next; });
    setCameraOn(next);
    if (next) requestAnimationFrame(attachLocal);
  }

  if (sessionId) {
    const host = isHostRoom ? { user_id: currentUserId, display_name: 'Your Live', ...activeRoom } : activeRoom;
    const liveIndex = profiles.findIndex(profile => profile.user_id === activeRoom?.user_id);
    const showRemoteGuest = guestVideoReady && !guestMode;
    const currentBeauty = isHostRoom ? beautyMode : remoteBeautyMode;
    const combinedEvents = [
      ...messages.slice(-8).map(item => ({ type: 'chat', time: item.created_at || '', key: `c-${item.id}`, ...item })),
      ...giftEvents.slice(-5).map(item => ({ type: 'gift', time: item.created_at || '', key: `g-${item.id}`, ...item }))
    ].sort((a, b) => String(a.time).localeCompare(String(b.time))).slice(-8);

    return (
      <section className={`liveRoomPage liveRoomV4 liveRoom-${roomOrientation}`} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className={`liveStage liveStageV4 liveStage-${roomOrientation}`}>
          {isHostRoom
            ? <video ref={localVideoRef} autoPlay playsInline muted className={`liveMainVideo liveLocalPreview beauty-${currentBeauty} ${facingMode === 'user' ? 'mirrored' : ''}`} />
            : <video ref={remoteHostVideo} autoPlay playsInline muted className={`liveMainVideo beauty-${currentBeauty}`} />}
          <audio ref={remoteHostAudio} autoPlay playsInline />

          {isHostRoom && !cameraOn && <div className="liveVideoLoading"><CameraOff size={30} /><strong>Camera is off</strong></div>}
          {!isHostRoom && !hostVideoReady && <div className="liveVideoLoading"><Radio size={30} /><strong>Connecting LIVE video…</strong></div>}

          {guestMode && <video ref={localVideoRef} autoPlay playsInline muted className={`liveGuestVideo liveGuestSelfVideo beauty-${beautyMode} ${facingMode === 'user' ? 'mirrored' : ''}`} />}
          {showRemoteGuest && <video ref={remoteGuestVideo} autoPlay playsInline muted className="liveGuestVideo" />}
          <audio ref={remoteGuestAudio} autoPlay playsInline />

          <div className="liveTopOverlay liveTopV4">
            <button className="liveBackButton" aria-label={isHostRoom ? 'End live' : 'Exit live'} onClick={isHostRoom ? endLive : leaveRoom}><ArrowLeft size={21} /><span>{isHostRoom ? 'End' : 'Exit'}</span></button>
            <div className="liveIdentity">
              <span className="liveBadge">LIVE</span>
              <div className="liveIdentityText"><strong>{host?.display_name || 'Droxion Live'}</strong><small>{host?.title || liveSetup.title || 'Live on Droxion'}</small></div>
            </div>
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

          {!isHostRoom && !guestMode && activeRoom?.allow_guest_requests !== false && !roomStatus?.guest_id && (
            <button className="liveFloatingJoin" onClick={requestToJoin} disabled={myJoinRequest?.status === 'requested'}><UserPlus size={19} /> {myJoinRequest?.status === 'requested' ? 'Requested' : 'Join LIVE'}</button>
          )}

          <div className="liveComposerOverlay liveComposerV4">
            <input value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendChat()} placeholder="Say something…" maxLength={500} />
            {!isHostRoom && <button className="liveGiftButton" onClick={() => setGiftDrawerOpen(true)}><Gift size={19} /></button>}
            <button onClick={sendChat} disabled={!draft.trim()}><Send size={18} /></button>
          </div>

          {(isHostRoom || guestMode) && (
            <div className="liveHostControlsV4">
              <button onClick={toggleMic}>{micOn ? <Mic size={19} /> : <MicOff size={19} />}</button>
              <button onClick={toggleCamera}>{cameraOn ? <Camera size={19} /> : <CameraOff size={19} />}</button>
              <button onClick={flipCamera}><RefreshCw size={19} /></button>
              <button className={`beauty beauty-${beautyMode}`} onClick={cycleBeauty}><Sparkles size={18} /><span>{beautyMode === 'off' ? 'Beauty' : beautyMode === 'soft' ? 'Soft' : 'Clear'}</span></button>
              {isHostRoom && <button className="end" onClick={endLive}><X size={19} /></button>}
            </div>
          )}
        </div>

        {invite && <div className="liveInviteCard liveOverlayCardV4"><div><strong>{invite.host_name} invited you to join the LIVE.</strong><span>Your camera and mic will turn on.</span></div><button onClick={() => respondInvite(false)}>Decline</button><button className="accept" onClick={() => respondInvite(true)}>Join</button></div>}
        {notice && <div className={`liveNotice liveNoticeV4 ${notice === 'You are live.' ? 'liveToastSuccess' : ''}`}>{notice}</div>}

        {isHostRoom && joinRequests.length > 0 && <div className="liveViewerPanel liveRequestPanel liveHostPanelV4"><div className="livePanelHead"><div><strong>Requests to join</strong><span>{joinRequests.length} waiting</span></div></div><div className="liveRequestList">{joinRequests.map(request => <div className="liveRequestPerson" key={request.request_id}>{personAvatar(request)}<strong>{request.display_name}</strong><button onClick={() => respondJoinRequest(request.request_id, false)}>Decline</button><button className="accept" onClick={() => respondJoinRequest(request.request_id, true)}>Accept</button></div>)}</div></div>}

        {isHostRoom && <div className="liveViewerPanel liveHostPanelV4"><div className="livePanelHead"><div><strong>Viewers</strong><span>{viewers.length} in your LIVE</span></div>{roomStatus?.guest_id && <button onClick={removeGuest}>Remove guest</button>}</div>{viewers.length === 0 ? <div className="liveEmptySmall">Nobody is watching yet.</div> : <div className="liveViewerScroll">{viewers.map(viewer => <div className="liveViewerPerson" key={viewer.user_id}>{personAvatar(viewer)}<strong>{viewer.display_name}</strong>{!roomStatus?.guest_id && <button onClick={() => inviteViewer(viewer.user_id)}><UserPlus size={15} /> Invite</button>}</div>)}</div>}</div>}

        {giftDrawerOpen && !isHostRoom && host?.user_id && (
          <div className="liveGiftDrawerBackdrop" onClick={() => setGiftDrawerOpen(false)}>
            <div className="liveGiftDrawer" onClick={event => event.stopPropagation()}>
              <div className="liveGiftDrawerHead"><div><strong>Send a gift</strong><span>🪙 {coins} coins</span></div><button onClick={() => setGiftDrawerOpen(false)}><X size={20} /></button></div>
              <div className="liveGiftGridV4">{gifts.map(gift => <button key={gift.gift_code} disabled={Boolean(busyGift)} onClick={() => sendGift(host, gift)}><span>{gift.emoji}</span><strong>{gift.gift_name}</strong><small>{gift.cost_coins} coins</small></button>)}</div>
              <button className="liveBuyCoinsV4" onClick={() => onOpenWallet?.()}>+ Buy Coins</button>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="realPage liveBrowsePage liveFeedPage liveOnlyHome">
      <button type="button" className="liveGoButton liveNavGoTrigger" onClick={openGoLiveSetup} aria-hidden="true" tabIndex={-1}>Go Live</button>
      <div className="liveOnlyHomeHead"><strong><Radio size={15} /> {profiles.length} LIVE now</strong><span>{profiles.length ? 'Tap a creator to watch. Scroll for more.' : 'No one is live right now.'}</span></div>
      {notice && <div className="liveNotice">{notice}</div>}
      {profiles.length === 0 ? <div className="liveZeroState liveZeroSimple"><span className="liveZeroIcon"><Radio size={28} /></span><h2>No one is LIVE right now</h2><p>When creators go LIVE, they will appear here.</p></div> : <div className="liveFeedScroll liveOnlyScroll" aria-label="People live now">{profiles.map(profile => <button key={profile.user_id} className={`liveFeedCard ${profile.orientation === 'horizontal' ? 'horizontal' : 'vertical'}`} onClick={() => openRoom(profile)}>{profile.avatar_url ? <img src={profile.avatar_url} alt={profile.display_name} /> : <div className="liveBrowseFallback">{(profile.display_name || 'D')[0]}</div>}<div className="liveBrowseShade" /><div className="liveFeedCardTop"><span className="liveBadge">LIVE</span><span className="liveFeedViewers"><Users size={13} /> {profile.viewer_count || 0}</span></div><div className="liveBrowseInfo"><strong>{profile.display_name}{profile.age ? `, ${profile.age}` : ''}</strong><b>{profile.title || 'Live on Droxion'}</b><small>{profile.country || 'Global'}{profile.language ? ` · ${profile.language}` : ''}</small>{Array.isArray(profile.tags) && profile.tags.length > 0 && <div className="liveFeedTags">{profile.tags.slice(0, 3).map(tag => <span key={tag}>#{tag}</span>)}</div>}<em>Tap to watch</em></div></button>)}</div>}

      {setupOpen && <div className="liveSetupOverlay" role="dialog" aria-modal="true"><div className="liveSetupSheet"><div className="liveSetupHead"><div><span>🔴 GO LIVE</span><h2>Set up your LIVE</h2></div><button onClick={() => setSetupOpen(false)}><X size={21} /></button></div><label>LIVE title<input value={liveSetup.title} maxLength={100} placeholder="What are you talking about?" onChange={event => setLiveSetup(state => ({ ...state, title: event.target.value }))} /></label><label>Tags<input value={liveSetup.tags} placeholder="music, chatting, business" onChange={event => setLiveSetup(state => ({ ...state, tags: event.target.value }))} /></label><div className="liveOrientationChoice"><button className={liveSetup.orientation === 'vertical' ? 'selected' : ''} onClick={() => setLiveSetup(state => ({ ...state, orientation: 'vertical' }))}><Smartphone size={22} /><strong>Vertical</strong><span>Best for phones</span></button><button className={liveSetup.orientation === 'horizontal' ? 'selected' : ''} onClick={() => setLiveSetup(state => ({ ...state, orientation: 'horizontal' }))}><Maximize2 size={22} /><strong>Horizontal</strong><span>Wide LIVE</span></button></div><label className="liveGuestToggle"><input type="checkbox" checked={liveSetup.allowGuests} onChange={event => setLiveSetup(state => ({ ...state, allowGuests: event.target.checked }))} /><span><strong>Allow viewers to request to join</strong><small>You approve every guest before they come on camera.</small></span></label><button className="liveStartButton" onClick={startLive}><Radio size={19} /> START LIVE</button></div></div>}
    </section>
  );
}
