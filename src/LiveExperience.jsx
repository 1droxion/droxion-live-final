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
    const tags = liveSetup.tags.split(',').map(item => item.trim()).filter(Boolean).slice(0, 12);
    const { data, error } = await supabase.rpc('droxion_start_live', { p_title: liveSetup.title.trim() || null, p_tags: tags, p_orientation: liveSetup.orientation, p_allow_guest_requests: liveSetup.allowGuests });
    if (error || data?.started === false) { stopCamera(); return setNotice(error?.message || data?.reason || 'Could not start LIVE.'); }
    setSetupOpen(false);
    setIsLive(true);
    setOwnSessionId(data.session_id);
    setActiveRoom({ session_id: data.session_id, user_id: currentUserId, display_name: 'You', orientation: liveSetup.orientation, allow_guest_requests: liveSetup.allowGuests, title: liveSetup.title });
    setNotice('You are live.');
  }

  async function endLive() {
    await supabase.rpc('droxion_end_live');
    closePeers(); stopCamera(); setIsLive(false); setOwnSessionId(''); setActiveRoom(null); setRoomStatus(null); setMessages([]); setInvite(null); setGuestMode(false); setNotice('Live ended.'); await loadLive();
  }

  function leaveRoom() {
    closePeers(); if (guestMode) stopCamera(); setActiveRoom(null); setRoomStatus(null); setMessages([]); setInvite(null); setGuestMode(false); setMyJoinRequest(null); setBeautyMode('off');
  }

  async function openRoom(profile) {
    if (!profile?.session_id) return;
    closePeers(); setMessages([]); setGiftEvents([]); setInvite(null); setGuestMode(false); setMyJoinRequest(null); setNotice(''); setRemoteBeautyMode('off'); setActiveRoom(profile);
  }

  async function createBroadcasterPeer(viewerId) {
    if (!viewerId || !streamRef.current) return;
    broadcasterPeers.current.get(viewerId)?.close();
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    broadcasterPeers.current.set(viewerId, pc);
    streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
    pc.onicecandidate = event => { if (event.candidate) supabase.rpc('droxion_live_send_signal', { p_session_id: sessionId, p_target_user_id: viewerId, p_signal_type: 'ice', p_payload: event.candidate.toJSON() }); };
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    await supabase.rpc('droxion_live_send_signal', { p_session_id: sessionId, p_target_user_id: viewerId, p_signal_type: 'offer', p_payload: offer });
  }

  async function createViewerPeer(offer, senderId) {
    const key = `host:${senderId}`;
    viewerPeers.current.get(key)?.close();
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    viewerPeers.current.set(key, pc);
    const stream = new MediaStream(); remoteHostStreamRef.current = stream;
    pc.ontrack = event => { if (!stream.getTracks().some(track => track.id === event.track.id)) stream.addTrack(event.track); setHostVideoReady(true); attachRemote('host'); };
    pc.onicecandidate = event => { if (event.candidate) supabase.rpc('droxion_live_send_signal', { p_session_id: sessionId, p_target_user_id: senderId, p_signal_type: 'ice', p_payload: event.candidate.toJSON() }); };
    await pc.setRemoteDescription(offer); await flushIce(key, pc);
    const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
    await supabase.rpc('droxion_live_send_signal', { p_session_id: sessionId, p_target_user_id: senderId, p_signal_type: 'answer', p_payload: answer });
  }

  async function requestWatch() {
    if (!sessionId || isHostRoom || requestedStreams.current.has(sessionId)) return;
    requestedStreams.current.add(sessionId);
    await supabase.rpc('droxion_live_send_signal', { p_session_id: sessionId, p_target_user_id: activeRoom.user_id, p_signal_type: 'watch', p_payload: {} });
  }

  useEffect(() => { if (sessionId && !isHostRoom) requestWatch(); }, [sessionId, isHostRoom]);

  async function pollSignals() {
    if (!sessionId || processingSignals.current) return;
    processingSignals.current = true;
    try {
      const { data } = await supabase.rpc('droxion_live_signals', { p_session_id: sessionId, p_after_id: lastSignalId.current || null });
      for (const signal of data || []) {
        lastSignalId.current = Math.max(lastSignalId.current, Number(signal.signal_id || 0));
        if (signal.signal_type === 'watch' && isHostRoom) await createBroadcasterPeer(signal.sender_user_id);
        else if (signal.signal_type === 'offer' && !isHostRoom) await createViewerPeer(signal.payload, signal.sender_user_id);
        else if (signal.signal_type === 'answer' && isHostRoom) { const pc = broadcasterPeers.current.get(signal.sender_user_id); if (pc) { await pc.setRemoteDescription(signal.payload); await flushIce(`viewer:${signal.sender_user_id}`, pc); } }
        else if (signal.signal_type === 'ice') {
          const key = isHostRoom ? `viewer:${signal.sender_user_id}` : `host:${signal.sender_user_id}`;
          const pc = isHostRoom ? broadcasterPeers.current.get(signal.sender_user_id) : viewerPeers.current.get(key);
          if (pc?.remoteDescription) { try { await pc.addIceCandidate(signal.payload); } catch {} }
          else pendingIce.current.set(key, [...(pendingIce.current.get(key) || []), signal.payload]);
        }
      }
    } finally { processingSignals.current = false; }
  }

  async function loadRoom() {
    if (!sessionId) return;
    const [statusResult, viewerResult, chatResult, requestResult, ownRequestResult, giftsResult] = await Promise.all([
      supabase.rpc('droxion_live_room_status', { p_session_id: sessionId }),
      isHostRoom ? supabase.rpc('droxion_live_viewers', { p_session_id: sessionId }) : Promise.resolve({ data: [] }),
      supabase.rpc('droxion_live_chat', { p_session_id: sessionId, p_after_id: lastChatId.current || null }),
      isHostRoom ? supabase.rpc('droxion_live_join_requests', { p_session_id: sessionId }) : Promise.resolve({ data: [] }),
      !isHostRoom ? supabase.rpc('droxion_my_live_join_request', { p_session_id: sessionId }) : Promise.resolve({ data: null }),
      supabase.rpc('droxion_live_gift_events', { p_session_id: sessionId, p_after: lastGiftAt.current })
    ]);
    setRoomStatus(statusResult.data || null); setViewers(viewerResult.data || []); setJoinRequests(requestResult.data || []); setMyJoinRequest(ownRequestResult.data || null);
    if (chatResult.data?.length) { lastChatId.current = Math.max(...chatResult.data.map(row => Number(row.id || 0)), lastChatId.current); setMessages(current => [...current, ...chatResult.data].slice(-80)); }
    if (giftsResult.data?.length) { lastGiftAt.current = giftsResult.data[giftsResult.data.length - 1]?.created_at || lastGiftAt.current; setGiftEvents(current => [...current, ...giftsResult.data].slice(-40)); }
    if (!statusResult.data?.is_live) leaveRoom();
  }

  useEffect(() => {
    if (!sessionId) return;
    loadRoom(); pollSignals();
    const timer = setInterval(() => { loadRoom(); pollSignals(); }, 1200);
    return () => clearInterval(timer);
  }, [sessionId, isHostRoom]);

  async function sendChat() {
    const body = draft.trim(); if (!body || !sessionId) return;
    const { error } = await supabase.rpc('droxion_send_live_chat', { p_session_id: sessionId, p_body: body });
    if (!error) setDraft(''); else setNotice(error.message);
  }

  async function requestToJoin() { const { data, error } = await supabase.rpc('droxion_request_live_guest', { p_session_id: sessionId }); if (error) setNotice(error.message); else setMyJoinRequest(data); }
  async function respondJoinRequest(requestId, accept) { const { error } = await supabase.rpc('droxion_respond_live_join_request', { p_request_id: requestId, p_accept: accept }); if (error) setNotice(error.message); else setNotice(accept ? 'Guest accepted.' : 'Guest request declined.'); }
  async function inviteViewer(userId) { const { data, error } = await supabase.rpc('droxion_invite_live_guest', { p_session_id: sessionId, p_viewer_user_id: userId }); if (error) setNotice(error.message); else setNotice(data?.message || 'Invite sent.'); }
  async function removeGuest() { const { error } = await supabase.rpc('droxion_remove_live_guest', { p_session_id: sessionId }); if (error) setNotice(error.message); }
  async function respondInvite(accept) { if (!invite) return; if (!accept) { await supabase.rpc('droxion_respond_live_invite', { p_invite_id: invite.invite_id, p_accept: false }); setInvite(null); return; } try { await ensureCamera(roomOrientation); const { error } = await supabase.rpc('droxion_respond_live_invite', { p_invite_id: invite.invite_id, p_accept: true }); if (error) throw error; setGuestMode(true); setInvite(null); } catch (error) { setNotice(error.message || 'Could not join LIVE.'); } }
  async function toggleFollow() { if (!currentUserId || !activeRoom?.user_id || followBusy) return; setFollowBusy(true); const { error } = followingHost ? await supabase.from('droxion_follows').delete().eq('follower_id', currentUserId).eq('following_id', activeRoom.user_id) : await supabase.from('droxion_follows').upsert({ follower_id: currentUserId, following_id: activeRoom.user_id }); if (!error) setFollowingHost(value => !value); setFollowBusy(false); }
  function toggleMic() { streamRef.current?.getAudioTracks().forEach(track => { track.enabled = !track.enabled; setMicOn(track.enabled); }); }
  function toggleCamera() { streamRef.current?.getVideoTracks().forEach(track => { track.enabled = !track.enabled; setCameraOn(track.enabled); }); }
  function cycleBeauty() { setBeautyMode(mode => mode === 'off' ? 'soft' : mode === 'soft' ? 'clear' : 'off'); }

  async function sendGift(host, gift) {
    if (!host?.user_id || !gift || busyGift) return;
    setBusyGift(gift.gift_code);
    const { data, error } = await supabase.rpc('droxion_send_live_gift', { p_session_id: sessionId, p_recipient_user_id: host.user_id, p_gift_code: gift.gift_code });
    if (error || data?.sent === false) setNotice(error?.message || data?.reason || 'Could not send gift.');
    else { onCoinsChanged?.(data.new_balance); setGiftDrawerOpen(false); }
    setBusyGift('');
  }

  useEffect(() => {
    if (!sessionId || isHostRoom) return;
    supabase.from('droxion_follows').select('following_id').eq('follower_id', currentUserId).eq('following_id', activeRoom?.user_id).maybeSingle().then(({ data }) => setFollowingHost(Boolean(data)));
  }, [sessionId, isHostRoom, currentUserId, activeRoom?.user_id]);

  const liveIndex = profiles.findIndex(item => item.session_id === sessionId);
  function handleTouchStart(event) { touchStartY.current = event.touches?.[0]?.clientY ?? null; }
  function handleTouchEnd(event) {
    if (isHostRoom || profiles.length < 2 || touchStartY.current == null) return;
    const endY = event.changedTouches?.[0]?.clientY ?? touchStartY.current; const delta = touchStartY.current - endY; touchStartY.current = null;
    if (Math.abs(delta) < 55) return;
    const next = delta > 0 ? (liveIndex + 1) % profiles.length : (liveIndex - 1 + profiles.length) % profiles.length;
    openRoom(profiles[next]);
  }

  if (immersive) {
    const host = isHostRoom ? { user_id: currentUserId, display_name: 'You', title: liveSetup.title } : activeRoom;
    const combinedEvents = [
      ...messages.map(message => ({ type: 'chat', key: `c-${message.id}`, created_at: message.created_at, display_name: message.display_name || 'User', body: message.body })),
      ...giftEvents.map(event => ({ type: 'gift', key: `g-${event.id}`, created_at: event.created_at, display_name: event.display_name || 'Viewer', gift_name: event.gift_name, emoji: event.emoji }))
    ].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).slice(-20);

    return (
      <section className={`liveRoom liveRoomV4 liveRoom-${roomOrientation}`} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="liveStage liveStageV4">
          {isHostRoom || guestMode ? <video ref={localVideoRef} className={`liveMainVideo liveLocalPreview mirrored beauty-${beautyMode}`} autoPlay muted playsInline /> : <video ref={remoteHostVideo} className={`liveMainVideo beauty-${remoteBeautyMode}`} autoPlay muted playsInline />}
          {!isHostRoom && <audio ref={remoteHostAudio} autoPlay playsInline />}
          {(roomStatus?.guest_id || guestMode) && <video ref={remoteGuestVideo} className={`liveGuestVideo beauty-${remoteBeautyMode}`} autoPlay muted playsInline />}
          {(roomStatus?.guest_id || guestMode) && <audio ref={remoteGuestAudio} autoPlay playsInline />}

          <div className="liveTopOverlay liveTopV4">
            <button className="liveBackButton" aria-label={isHostRoom ? 'End live' : 'Exit live'} title={isHostRoom ? 'End live' : 'Exit live'} onClick={isHostRoom ? endLive : leaveRoom}><ArrowLeft size={22} /></button>
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
