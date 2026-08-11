import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Gift, MessageCircle, Phone, Radio, Send, UserPlus, Video, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

function iceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ];
  if (import.meta.env.VITE_TURN_URL) {
    servers.push({
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || ''
    });
  }
  return servers;
}

function personAvatar(person, size = 46) {
  if (person?.avatar_url) return <img src={person.avatar_url} alt={person.display_name || 'Droxion user'} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  return <div style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#2b2340', color: '#fff', fontWeight: 900 }}>{(person?.display_name || 'D')[0]}</div>;
}

export default function LiveExperience({ currentUserId, coins = 0, onCoinsChanged, onOpenWallet }) {
  const navigate = useNavigate();
  const [isLive, setIsLive] = useState(false);
  const [ownSessionId, setOwnSessionId] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [busyGift, setBusyGift] = useState('');
  const [notice, setNotice] = useState('');
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomStatus, setRoomStatus] = useState(null);
  const [viewers, setViewers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [invite, setInvite] = useState(null);
  const [guestMode, setGuestMode] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [guestVideoReady, setGuestVideoReady] = useState(false);

  const localVideo = useRef(null);
  const remoteHostVideo = useRef(null);
  const remoteHostAudio = useRef(null);
  const remoteGuestVideo = useRef(null);
  const remoteGuestAudio = useRef(null);
  const streamRef = useRef(null);
  const broadcasterPeers = useRef(new Map());
  const viewerPeers = useRef(new Map());
  const lastSignalId = useRef(0);
  const lastChatId = useRef(0);
  const processingSignals = useRef(false);
  const requestedStreams = useRef(new Set());

  const sessionId = activeRoom?.session_id || (isLive ? ownSessionId : '');
  const isHostRoom = Boolean(isLive && ownSessionId && sessionId === ownSessionId);

  async function loadLive() {
    const { data } = await supabase.rpc('droxion_live_profiles');
    setProfiles(data || []);
  }

  const ensureCamera = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true }
    });
    streamRef.current = stream;
    if (localVideo.current) {
      localVideo.current.srcObject = stream;
      localVideo.current.play?.().catch(() => {});
    }
    setCameraReady(true);
    return stream;
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    if (localVideo.current) localVideo.current.srcObject = null;
  }, []);

  const closePeers = useCallback(() => {
    broadcasterPeers.current.forEach(pc => pc.close());
    viewerPeers.current.forEach(pc => pc.close());
    broadcasterPeers.current.clear();
    viewerPeers.current.clear();
    requestedStreams.current.clear();
    lastSignalId.current = 0;
    setGuestVideoReady(false);
    if (remoteHostVideo.current) remoteHostVideo.current.srcObject = null;
    if (remoteHostAudio.current) remoteHostAudio.current.srcObject = null;
    if (remoteGuestVideo.current) remoteGuestVideo.current.srcObject = null;
    if (remoteGuestAudio.current) remoteGuestAudio.current.srcObject = null;
  }, []);

  useEffect(() => () => { closePeers(); stopCamera(); }, [closePeers, stopCamera]);

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
      if (data?.is_live === false) {
        setIsLive(false);
        setOwnSessionId('');
        stopCamera();
      }
    };
    heartbeat();
    const timer = setInterval(heartbeat, 15000);
    return () => clearInterval(timer);
  }, [isLive, stopCamera]);

  async function toggleLive() {
    setNotice('');
    const next = !isLive;
    if (next) {
      try { await ensureCamera(); }
      catch { setNotice('Camera and microphone permission are required to go live.'); return; }
    }
    const { data, error } = await supabase.rpc('droxion_set_live', { p_live: next });
    if (error) {
      setNotice(error.message || 'Could not change live status.');
      if (next) stopCamera();
      return;
    }
    setIsLive(Boolean(data?.is_live));
    setOwnSessionId(data?.is_live ? data?.session_id || '' : '');
    if (next && data?.session_id) setActiveRoom({ user_id: currentUserId, session_id: data.session_id, display_name: 'Your Live' });
    if (!next) {
      setActiveRoom(null);
      setGuestMode(false);
      closePeers();
      stopCamera();
    }
    setNotice(next ? 'You are LIVE now.' : 'Live ended.');
    await loadLive();
  }

  async function openRoom(profile) {
    setNotice('');
    closePeers();
    setMessages([]);
    lastChatId.current = 0;
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
    setActiveRoom(null);
    setRoomStatus(null);
    setViewers([]);
    setMessages([]);
    closePeers();
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
      if (status && status.active === false) {
        setNotice('This live has ended.');
        if (!isHostRoom) leaveRoom();
      }
    };
    refresh();
    const timer = setInterval(refresh, 2500);
    return () => { stopped = true; clearInterval(timer); };
  }, [sessionId, isHostRoom]);

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

  async function respondInvite(accept) {
    if (!invite?.invite_id) return;
    if (accept) {
      try { await ensureCamera(); }
      catch { setNotice('Camera and microphone permission are required to join the live.'); return; }
    }
    const { data, error } = await supabase.rpc('droxion_respond_live_invite', { p_invite_id: invite.invite_id, p_accept: accept });
    if (error || !data?.allowed) {
      setNotice(error?.message || 'Invite is no longer available.');
      if (accept) stopCamera();
    } else {
      setGuestMode(Boolean(accept));
      setNotice(accept ? 'You joined the live as a guest.' : 'Invite declined.');
    }
    setInvite(null);
  }

  async function inviteViewer(viewerId) {
    const { data, error } = await supabase.rpc('droxion_invite_live_guest', { p_session_id: sessionId, p_invitee_id: viewerId });
    setNotice(error?.message || (data?.allowed ? 'Guest invite sent.' : 'Could not invite this viewer.'));
  }

  async function removeGuest() {
    await supabase.rpc('droxion_remove_live_guest', { p_session_id: sessionId });
    setNotice('Guest removed.');
  }

  const sendLiveSignal = useCallback(async (recipientId, role, type, payload = {}) => {
    if (!sessionId || !recipientId) return;
    await supabase.rpc('droxion_send_live_signal', {
      p_session_id: sessionId,
      p_recipient_id: recipientId,
      p_stream_role: role,
      p_signal_type: type,
      p_payload: payload
    });
  }, [sessionId]);

  const createBroadcasterPeer = useCallback(async (viewerId, role) => {
    const key = `${role}:${viewerId}`;
    broadcasterPeers.current.get(key)?.close();
    const stream = await ensureCamera();
    const pc = new RTCPeerConnection({ iceServers: iceServers(), iceCandidatePoolSize: 10 });
    broadcasterPeers.current.set(key, pc);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = e => { if (e.candidate) sendLiveSignal(viewerId, role, 'ice', e.candidate.toJSON()); };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendLiveSignal(viewerId, role, 'offer', pc.localDescription?.toJSON?.() || offer);
  }, [ensureCamera, sendLiveSignal]);

  const createViewerPeer = useCallback((senderId, role) => {
    const key = `${role}:${senderId}`;
    if (viewerPeers.current.has(key)) return viewerPeers.current.get(key);
    const pc = new RTCPeerConnection({ iceServers: iceServers(), iceCandidatePoolSize: 10 });
    viewerPeers.current.set(key, pc);
    pc.onicecandidate = e => { if (e.candidate) sendLiveSignal(senderId, role, 'ice', e.candidate.toJSON()); };
    pc.ontrack = event => {
      const stream = event.streams?.[0] || new MediaStream([event.track]);
      const isGuest = role === 'guest';
      const video = isGuest ? remoteGuestVideo.current : remoteHostVideo.current;
      const audio = isGuest ? remoteGuestAudio.current : remoteHostAudio.current;
      if (video) { video.srcObject = stream; video.muted = true; video.play?.().catch(() => {}); }
      if (audio) { audio.srcObject = stream; audio.play?.().catch(() => {}); }
      if (isGuest) setGuestVideoReady(true);
    };
    return pc;
  }, [sendLiveSignal]);

  useEffect(() => {
    if (!sessionId || !currentUserId) return;
    let stopped = false;
    const poll = async () => {
      if (processingSignals.current || stopped) return;
      processingSignals.current = true;
      try {
        const { data: rows } = await supabase.rpc('droxion_live_signals_for_me', { p_session_id: sessionId, p_after_id: lastSignalId.current });
        for (const row of rows || []) {
          try {
            if (row.signal_type === 'watch_request') {
              if ((row.stream_role === 'host' && isHostRoom) || (row.stream_role === 'guest' && guestMode)) {
                await createBroadcasterPeer(row.sender_id, row.stream_role);
              }
            } else if (row.signal_type === 'offer') {
              const pc = createViewerPeer(row.sender_id, row.stream_role);
              await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await sendLiveSignal(row.sender_id, row.stream_role, 'answer', pc.localDescription?.toJSON?.() || answer);
            } else if (row.signal_type === 'answer') {
              const pc = broadcasterPeers.current.get(`${row.stream_role}:${row.sender_id}`);
              if (pc && pc.signalingState === 'have-local-offer') await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
            } else if (row.signal_type === 'ice') {
              const broadcaster = broadcasterPeers.current.get(`${row.stream_role}:${row.sender_id}`);
              const viewer = viewerPeers.current.get(`${row.stream_role}:${row.sender_id}`);
              const pc = broadcaster || viewer;
              if (pc) {
                const candidate = new RTCIceCandidate(row.payload);
                if (pc.remoteDescription) await pc.addIceCandidate(candidate);
              }
            }
          } catch (error) {
            console.warn('Live signal error', error);
          }
          lastSignalId.current = Math.max(lastSignalId.current, Number(row.id));
        }
      } finally {
        processingSignals.current = false;
      }
    };
    poll();
    const timer = setInterval(poll, 500);
    return () => { stopped = true; clearInterval(timer); };
  }, [sessionId, currentUserId, isHostRoom, guestMode, createBroadcasterPeer, createViewerPeer, sendLiveSignal]);

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
    }
    setBusyGift('');
  }

  if (sessionId) {
    const host = isHostRoom ? { user_id: currentUserId, display_name: 'Your Live' } : activeRoom;
    return (
      <section className="realPage" style={{ paddingBottom: 120 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <button onClick={isHostRoom ? toggleLive : leaveRoom} style={{ border: 0, background: 'transparent', color: 'inherit', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 900 }}><ArrowLeft size={19} /> {isHostRoom ? 'End Live' : 'All Live'}</button>
          <strong style={{ color: '#ef4444' }}>● LIVE · {roomStatus?.viewer_count || 0} watching</strong>
        </div>

        <div style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', background: '#08080c', minHeight: 430 }}>
          {isHostRoom || guestMode ? <video ref={localVideo} autoPlay playsInline muted style={{ width: '100%', height: 430, objectFit: 'cover' }} /> : <video ref={remoteHostVideo} autoPlay playsInline muted style={{ width: '100%', height: 430, objectFit: 'cover' }} />}
          <audio ref={remoteHostAudio} autoPlay playsInline />
          {guestVideoReady && <video ref={remoteGuestVideo} autoPlay playsInline muted style={{ position: 'absolute', right: 12, top: 12, width: 130, height: 180, objectFit: 'cover', borderRadius: 16, border: '2px solid #fff' }} />}
          <audio ref={remoteGuestAudio} autoPlay playsInline />
          <div style={{ position: 'absolute', left: 12, bottom: 12, padding: '8px 11px', borderRadius: 12, background: 'rgba(0,0,0,.55)', color: '#fff' }}><strong>{host?.display_name || 'Droxion Live'}</strong></div>
        </div>

        {invite && <div className="realNotice"><strong>{invite.host_name} invited you to join the live.</strong><div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button onClick={() => respondInvite(true)}>Accept</button><button onClick={() => respondInvite(false)}>Decline</button></div></div>}
        {notice && <div className="realNotice">{notice}</div>}

        {!isHostRoom && host?.user_id && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 0' }}>
            {gifts.map(gift => <button key={gift.gift_code} disabled={Boolean(busyGift)} onClick={() => sendGift(host, gift)} style={{ whiteSpace: 'nowrap', minHeight: 46, borderRadius: 14, border: '1px solid #333', background: '#1d1d27', color: '#fff', padding: '0 12px', fontWeight: 800 }}>{gift.emoji} {gift.gift_name} · {gift.cost_coins}</button>)}
            <button onClick={() => onOpenWallet?.()} style={{ whiteSpace: 'nowrap', minHeight: 46, borderRadius: 14, border: '1px solid #333', padding: '0 12px' }}>🪙 {coins} · Buy</button>
            <button onClick={() => navigate(`/direct-call?to=${host.user_id}`)} style={{ whiteSpace: 'nowrap', minHeight: 46, borderRadius: 14, border: '1px solid #333', padding: '0 12px' }}><Phone size={17} /> Call 50</button>
          </div>
        )}

        {isHostRoom && <div className="realNotice"><strong>Viewers</strong>{roomStatus?.guest_id && <button onClick={removeGuest} style={{ marginLeft: 10 }}>Remove guest</button>}<div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 9 }}>{viewers.length === 0 ? <span>No viewers yet.</span> : viewers.map(v => <div key={v.user_id} style={{ minWidth: 120, padding: 8, border: '1px solid #ddd', borderRadius: 12 }}>{personAvatar(v, 36)}<div style={{ fontSize: 12, fontWeight: 800 }}>{v.display_name}</div>{!roomStatus?.guest_id && <button onClick={() => inviteViewer(v.user_id)} style={{ marginTop: 5 }}><UserPlus size={14} /> Invite</button>}</div>)}</div></div>}

        <div style={{ marginTop: 14, background: '#fff', color: '#111827', borderRadius: 18, padding: 12 }}>
          <strong><MessageCircle size={17} style={{ verticalAlign: 'middle' }} /> Live Chat</strong>
          <div style={{ maxHeight: 220, overflowY: 'auto', margin: '10px 0' }}>{messages.length === 0 ? <p style={{ color: '#64748b' }}>Start the conversation.</p> : messages.map(m => <div key={m.id} style={{ padding: '5px 0' }}><strong>{m.display_name}: </strong>{m.body}</div>)}</div>
          <div style={{ display: 'flex', gap: 7 }}><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Chat in live…" maxLength={500} style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid #d1d5db', padding: '0 11px' }} /><button onClick={sendChat} style={{ width: 48, borderRadius: 12, border: 0 }}><Send size={18} /></button></div>
        </div>
      </section>
    );
  }

  return (
    <section className="realPage">
      <div className="realHeading"><h1>Live</h1><p>Only people who are actually live appear here. Scroll and tap to watch.</p></div>
      <button className="realPrimaryButton" onClick={toggleLive} style={{ marginTop: 18, background: isLive ? '#dc2626' : undefined }}>{isLive ? <><Radio size={19} /> End Live</> : <><Video size={19} /> Go Live</>}</button>
      {notice && <div className="realNotice">{notice}</div>}
      {profiles.length === 0 ? <div className="realEmpty">Nobody is live right now.</div> : (
        <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          {profiles.map(profile => (
            <article key={profile.user_id} onClick={() => openRoom(profile)} style={{ minHeight: 260, borderRadius: 22, overflow: 'hidden', position: 'relative', background: '#15151c', cursor: 'pointer' }}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.display_name} style={{ width: '100%', height: 300, objectFit: 'cover', opacity: .88 }} /> : <div style={{ height: 300, display: 'grid', placeItems: 'center', fontSize: 70, color: '#fff' }}>{(profile.display_name || 'D')[0]}</div>}
              <div style={{ position: 'absolute', inset: 'auto 0 0', padding: 16, background: 'linear-gradient(transparent,rgba(0,0,0,.86))', color: '#fff' }}><span style={{ background: '#ef4444', borderRadius: 8, padding: '4px 8px', fontWeight: 900 }}>LIVE</span><h2 style={{ marginBottom: 4 }}>{profile.display_name}{profile.age ? `, ${profile.age}` : ''}</h2><p style={{ margin: 0 }}>{profile.country || 'Global'} · Tap to watch</p></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
