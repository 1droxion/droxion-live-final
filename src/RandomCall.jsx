import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CameraOff, Coins, Gift, MessageCircle, Mic, MicOff, PhoneOff, RotateCcw, Send, ShieldCheck, Video, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import './random-call.css';

const FILTERS = [
  { id: 'both', label: 'Both', cost: 'FREE' },
  { id: 'male', label: 'Male', cost: 'FREE' },
  { id: 'female', label: 'Female', cost: '3 coins when connected' }
];

const GIFTS = [
  { code: 'rose', name: 'Rose', emoji: '🌹', cost: 5 },
  { code: 'heart', name: 'Heart', emoji: '💜', cost: 10 },
  { code: 'star', name: 'Star', emoji: '⭐', cost: 25 },
  { code: 'crown', name: 'Crown', emoji: '👑', cost: 100 }
];

function iceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || ''
    });
  }

  return servers;
}

export default function RandomCall() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState('both');
  const [phase, setPhase] = useState('loading');
  const [partner, setPartner] = useState(null);
  const [callId, setCallId] = useState(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [message, setMessage] = useState('');
  const [coins, setCoins] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [focusedVideo, setFocusedVideo] = useState('remote');
  const [giftOpen, setGiftOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [callMessages, setCallMessages] = useState([]);
  const [giftToast, setGiftToast] = useState(null);

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const streamRef = useRef(null);
  const pcRef = useRef(null);
  const lastSignalId = useRef(0);
  const lastCallMessageId = useRef(0);
  const lastGiftId = useRef(0);
  const connectedOnce = useRef(false);
  const billingTimer = useRef(null);
  const pendingIce = useRef([]);
  const partnerIdRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectingRef = useRef(false);
  const giftToastTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!alive) return;
      setUser(authUser || null);
      if (!authUser) {
        setPhase('guest');
        return;
      }

      const { data: bonus } = await supabase.rpc('droxion_claim_welcome_bonus');
      if (bonus?.coin_balance != null) {
        setCoins(Number(bonus.coin_balance));
      } else {
        const { data: wallet } = await supabase
          .from('droxion_wallets')
          .select('coin_balance')
          .eq('user_id', authUser.id)
          .maybeSingle();
        setCoins(Number(wallet?.coin_balance || 0));
      }

      setPhase('choose');
    })();

    return () => { alive = false; };
  }, []);

  const showGiftToast = useCallback(toast => {
    if (giftToastTimer.current) clearTimeout(giftToastTimer.current);
    setGiftToast(toast);
    giftToastTimer.current = setTimeout(() => setGiftToast(null), 2500);
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = null;
    reconnectingRef.current = false;
  }, []);

  const cleanupMedia = useCallback(() => {
    if (billingTimer.current) clearInterval(billingTimer.current);
    billingTimer.current = null;
    clearReconnectTimer();
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    pendingIce.current = [];
    partnerIdRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  }, [clearReconnectTimer]);

  const resetCallUi = useCallback(() => {
    setCallId(null);
    setPartner(null);
    setSeconds(0);
    setFocusedVideo('remote');
    setGiftOpen(false);
    setChatOpen(false);
    setChatDraft('');
    setCallMessages([]);
    connectedOnce.current = false;
    lastSignalId.current = 0;
    lastCallMessageId.current = 0;
    lastGiftId.current = 0;
  }, []);

  const endCall = useCallback(async (goBack = true) => {
    const id = callId;
    cleanupMedia();
    if (id) await supabase.rpc('droxion_end_call', { p_call_id: id });
    resetCallUi();
    if (goBack) setPhase('choose');
  }, [callId, cleanupMedia, resetCallUi]);

  useEffect(() => () => {
    cleanupMedia();
    if (giftToastTimer.current) clearTimeout(giftToastTimer.current);
  }, [cleanupMedia]);

  async function cancelWaiting() {
    await supabase.from('droxion_random_queue').delete().eq('user_id', user.id);
    setPhase('choose');
  }

  async function prepareMatch(data) {
    lastSignalId.current = 0;
    pendingIce.current = [];
    connectedOnce.current = false;
    lastCallMessageId.current = 0;
    lastGiftId.current = 0;
    setFocusedVideo('remote');
    setGiftOpen(false);
    setChatOpen(false);
    setCallMessages([]);
    partnerIdRef.current = data.partner_id || null;
    setCallId(data.call_id);
    setIsInitiator(Boolean(data.is_initiator));

    if (!partnerIdRef.current) {
      const { data: status } = await supabase.rpc('droxion_random_status');
      partnerIdRef.current = status?.partner_id || null;
    }

    const { data: profile } = await supabase.rpc('droxion_partner_profile', { p_call_id: data.call_id });
    setPartner(profile || { name: 'Droxion user', country: '' });
    setMessage('');
    setPhase('calling');
  }

  async function joinQueue() {
    const { data, error } = await supabase.rpc('droxion_join_random_queue', { p_filter: filter });
    if (error) throw error;
    if (data?.call_id) await prepareMatch(data);
    return data;
  }

  async function beginSearch() {
    if (!user) return;
    setMessage('');

    if (filter === 'female' && Number(coins || 0) < 3) {
      setMessage('You need at least 3 coins to use the Female filter.');
      return;
    }

    setPhase('searching');
    try {
      await joinQueue();
    } catch (error) {
      setMessage(error?.message || 'Could not start matching.');
      setPhase('choose');
    }
  }

  const autoFindNext = useCallback(async () => {
    cleanupMedia();
    resetCallUi();
    setMessage('Finding the next available person…');
    setPhase('searching');

    try {
      const { data, error } = await supabase.rpc('droxion_join_random_queue', { p_filter: filter });
      if (error) throw error;
      if (data?.call_id) await prepareMatch(data);
    } catch (error) {
      setMessage(error?.message || 'Could not find the next person.');
      setPhase('choose');
    }
  }, [cleanupMedia, filter, resetCallUi]);

  useEffect(() => {
    if (phase !== 'searching' || !user) return;

    const timer = setInterval(async () => {
      const { data } = await supabase.rpc('droxion_random_status');
      if (data?.call_id) await prepareMatch(data);
    }, 1500);

    return () => clearInterval(timer);
  }, [phase, user]);

  const flushPendingIce = useCallback(async pc => {
    if (!pc?.remoteDescription || pendingIce.current.length === 0) return;

    const queued = pendingIce.current.splice(0);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Queued ICE candidate failed', error);
      }
    }
  }, []);

  const sendSignal = useCallback(async (signalType, payload, explicitPartnerId = null) => {
    const recipient = explicitPartnerId || partnerIdRef.current;
    if (!callId || !user?.id || !recipient) return;

    const { error } = await supabase.from('droxion_call_signals').insert({
      call_id: callId,
      sender_id: user.id,
      recipient_id: recipient,
      signal_type: signalType,
      payload
    });

    if (error) console.warn(`Could not send ${signalType} signal`, error);
  }, [callId, user?.id]);

  const restartIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState === 'closed' || !isInitiator) return;
    if (pc.signalingState !== 'stable') return;

    try {
      setMessage('Reconnecting video…');
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      await sendSignal('offer', pc.localDescription?.toJSON?.() || offer);
    } catch (error) {
      console.warn('ICE restart failed', error);
    }
  }, [isInitiator, sendSignal]);

  useEffect(() => {
    if (phase !== 'calling' || !callId || !user) return;

    let stopped = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        if (stopped) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && 'contentHint' in videoTrack) videoTrack.contentHint = 'motion';

        streamRef.current = stream;
        if (localVideo.current) {
          localVideo.current.srcObject = stream;
          localVideo.current.play?.().catch(() => {});
        }

        const pc = new RTCPeerConnection({
          iceServers: iceServers(),
          iceCandidatePoolSize: 10,
          bundlePolicy: 'max-bundle',
          iceTransportPolicy: 'all'
        });
        pcRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = async event => {
          const remoteStream = event.streams?.[0];
          if (remoteVideo.current && remoteStream) {
            remoteVideo.current.srcObject = remoteStream;
            remoteVideo.current.play?.().catch(() => {});
          }

          if (!connectedOnce.current) {
            connectedOnce.current = true;
            const { data, error } = await supabase.rpc('droxion_mark_call_connected', { p_call_id: callId });

            if (error || !data?.allowed) {
              connectedOnce.current = false;
              setMessage(error?.message || 'Not enough coins to connect.');
              await endCall(false);
              setPhase('choose');
              return;
            }

            if (data.coin_balance != null) setCoins(Number(data.coin_balance));
            setMessage('');
            setPhase('connected');
          }
        };

        pc.onicecandidate = event => {
          if (!event.candidate) return;
          sendSignal('ice', event.candidate.toJSON());
        };

        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;

          if (state === 'connected') {
            clearReconnectTimer();
            setMessage('');
            return;
          }

          if (state === 'disconnected' || state === 'failed') {
            if (!reconnectingRef.current) {
              reconnectingRef.current = true;
              setMessage('Reconnecting video…');
              restartIce();
              reconnectTimer.current = setTimeout(() => {
                reconnectingRef.current = false;
                if (pc.connectionState !== 'connected' && pc.connectionState !== 'closed') {
                  setMessage('Connection is weak. Still trying to reconnect…');
                  restartIce();
                }
              }, 8000);
            }
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'failed') restartIce();
        };

        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal('offer', pc.localDescription?.toJSON?.() || offer);
        }
      } catch (error) {
        console.error('Media/WebRTC setup error', error);
        setMessage('Camera and microphone permission are required for a video call.');
        await endCall(false);
        setPhase('choose');
      }
    })();

    return () => { stopped = true; };
  }, [phase, callId, user?.id, isInitiator, endCall, sendSignal, restartIce, clearReconnectTimer]);

  useEffect(() => {
    if (!callId || !user || !['calling', 'connected'].includes(phase)) return;

    let polling = false;

    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;

      try {
        const { data: rows, error: signalError } = await supabase
          .from('droxion_call_signals')
          .select('id,signal_type,payload')
          .eq('call_id', callId)
          .eq('recipient_id', user.id)
          .gt('id', lastSignalId.current)
          .order('id');

        if (signalError) throw signalError;

        for (const row of rows || []) {
          lastSignalId.current = Math.max(lastSignalId.current, Number(row.id));
          const pc = pcRef.current;
          if (!pc || pc.signalingState === 'closed') continue;

          try {
            if (row.signal_type === 'offer' && !isInitiator) {
              await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
              await flushPendingIce(pc);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await sendSignal('answer', pc.localDescription?.toJSON?.() || answer);
            } else if (row.signal_type === 'answer' && isInitiator) {
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
                await flushPendingIce(pc);
              }
            } else if (row.signal_type === 'ice') {
              const candidate = new RTCIceCandidate(row.payload);
              if (pc.remoteDescription) {
                await pc.addIceCandidate(candidate);
              } else {
                pendingIce.current.push(candidate);
              }
            }
          } catch (error) {
            console.warn('WebRTC signal handling error', row.signal_type, error);
            if (row.signal_type === 'ice') {
              try {
                pendingIce.current.push(new RTCIceCandidate(row.payload));
              } catch {}
            }
          }
        }

        const { data: status, error: statusError } = await supabase.rpc('droxion_random_status');
        if (!statusError && status?.partner_id) partnerIdRef.current = status.partner_id;

        if (!statusError && status?.status === 'ended') {
          await autoFindNext();
        }
      } catch (error) {
        console.warn('Call signaling poll failed', error);
      } finally {
        polling = false;
      }
    }, 700);

    return () => clearInterval(timer);
  }, [callId, user?.id, phase, isInitiator, autoFindNext, flushPendingIce, sendSignal]);

  useEffect(() => {
    if (phase !== 'connected' || !callId) return;

    const clock = setInterval(() => setSeconds(value => value + 1), 1000);
    billingTimer.current = setInterval(async () => {
      const { data, error } = await supabase.rpc('droxion_bill_call_tick', { p_call_id: callId });
      if (data?.coin_balance != null) setCoins(Number(data.coin_balance));

      if (error || !data?.allowed) {
        setMessage('Call ended because there are not enough coins.');
        await endCall(false);
        setPhase('choose');
      }
    }, 10000);

    return () => {
      clearInterval(clock);
      if (billingTimer.current) clearInterval(billingTimer.current);
      billingTimer.current = null;
    };
  }, [phase, callId, endCall]);

  useEffect(() => {
    if (phase !== 'connected' || !callId || !user?.id) return;

    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;

      try {
        const { data: messages } = await supabase
          .from('droxion_call_messages')
          .select('id,sender_id,recipient_id,body,created_at')
          .eq('call_id', callId)
          .gt('id', lastCallMessageId.current)
          .order('id');

        for (const item of messages || []) {
          lastCallMessageId.current = Math.max(lastCallMessageId.current, Number(item.id));
          setCallMessages(previous => [...previous.slice(-49), item]);
        }

        const { data: gifts } = await supabase
          .from('droxion_call_gifts')
          .select('id,gift_code,gift_name,cost_coins,sender_id,recipient_id,created_at')
          .eq('call_id', callId)
          .eq('recipient_id', user.id)
          .gt('id', lastGiftId.current)
          .order('id');

        for (const item of gifts || []) {
          lastGiftId.current = Math.max(lastGiftId.current, Number(item.id));
          const gift = GIFTS.find(value => value.code === item.gift_code);
          showGiftToast({
            emoji: gift?.emoji || '🎁',
            text: `${partner?.name || 'Your match'} sent ${item.gift_name || 'a gift'}`
          });
        }
      } catch (error) {
        console.warn('Call social polling failed', error);
      } finally {
        busy = false;
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [phase, callId, user?.id, partner?.name, showGiftToast]);

  async function sendCallMessage() {
    const body = chatDraft.trim();
    const recipient = partnerIdRef.current || partner?.id;
    if (!body || !callId || !user?.id || !recipient) return;

    const { data, error } = await supabase
      .from('droxion_call_messages')
      .insert({ call_id: callId, sender_id: user.id, recipient_id: recipient, body })
      .select('id,sender_id,recipient_id,body,created_at')
      .single();

    if (error) {
      setMessage(error.message || 'Could not send chat message.');
      return;
    }

    setCallMessages(previous => [...previous.slice(-49), data]);
    lastCallMessageId.current = Math.max(lastCallMessageId.current, Number(data.id));
    setChatDraft('');
  }

  async function sendGift(gift) {
    if (!callId) return;
    if (Number(coins || 0) < gift.cost) {
      setMessage(`You need ${gift.cost} coins for ${gift.name}.`);
      return;
    }

    const { data, error } = await supabase.rpc('droxion_send_call_gift', {
      p_call_id: callId,
      p_gift_code: gift.code
    });

    if (error || !data?.allowed) {
      setMessage(error?.message || data?.reason || 'Could not send gift.');
      return;
    }

    if (data.coin_balance != null) setCoins(Number(data.coin_balance));
    setMessage('');
    setGiftOpen(false);
    showGiftToast({ emoji: gift.emoji, text: `You sent ${gift.name}` });
  }

  function toggleMic() {
    const track = streamRef.current?.getAudioTracks()?.[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  function toggleCamera() {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
  }

  async function switchCamera() {
    const current = streamRef.current?.getVideoTracks()?.[0];
    if (!current) return;

    try {
      const currentMode = current.getSettings().facingMode;
      const nextMode = currentMode === 'environment' ? 'user' : 'environment';
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (newTrack && 'contentHint' in newTrack) newTrack.contentHint = 'motion';
      const sender = pcRef.current?.getSenders().find(item => item.track?.kind === 'video');
      await sender?.replaceTrack(newTrack);
      current.stop();
      const audio = streamRef.current?.getAudioTracks()?.[0];
      streamRef.current = new MediaStream([newTrack, ...(audio ? [audio] : [])]);
      if (localVideo.current) {
        localVideo.current.srcObject = streamRef.current;
        localVideo.current.play?.().catch(() => {});
      }
    } catch (error) {
      console.warn('Camera switch failed', error);
      setMessage('Could not switch camera on this device.');
    }
  }

  if (phase === 'loading') {
    return <main className="randomCallPage"><div className="finderPulse"/><h2>Loading Droxion…</h2></main>;
  }

  if (phase === 'guest') {
    return <main className="randomCallPage"><button className="randomClose" onClick={() => navigate('/')}><X /></button><div className="welcomeCoin"><Coins /> 50 welcome coins</div><h1>Meet someone real.</h1><p>Create a verified 21+ account before entering random video chat. Your 50 welcome coins are credited once after email verification.</p><button className="randomPrimary" onClick={() => navigate('/signup')}>Create account</button><button className="randomSecondary" onClick={() => navigate('/login')}>Log in</button></main>;
  }

  if (phase === 'choose') {
    return <main className="randomCallPage"><button className="randomClose" onClick={() => navigate('/')}><X /></button><div className="randomWallet"><Coins size={18}/> {coins ?? 0}</div><Video size={48}/><h1>Random Call</h1><p>Connect only with real Droxion users who are available now.</p><div className="genderChoices">{FILTERS.map(item => <button key={item.id} className={filter === item.id ? 'selected' : ''} onClick={() => setFilter(item.id)}><strong>{item.label}</strong><span>{item.cost}</span></button>)}</div><p className="priceNote">Searching, waiting, ringing, busy and rejected calls are free. Connected video costs 5 coins every 10 seconds (30/min). Female filter adds 3 coins only when connected.</p>{message && <p className="randomError">{message}</p>}<button className="randomPrimary" onClick={beginSearch}>Find someone</button><div className="safetyLine"><ShieldCheck size={18}/> 21+ · Real accounts only.</div></main>;
  }

  if (phase === 'searching') {
    return <main className="randomCallPage searchingPage"><div className="finderWrap"><div className="finderPulse"/><div className="finderPulse second"/><Video size={44}/></div><h1>Finding someone…</h1><p>{message || `Looking for an available ${filter === 'both' ? 'person' : filter === 'female' ? 'woman' : 'man'}.`}</p><p className="priceNote">No charge while waiting. If another call ends, an available person can match with you automatically.</p><button className="randomSecondary" onClick={cancelWaiting}>Cancel</button></main>;
  }

  return (
    <main className="videoCallPage">
      <video
        ref={remoteVideo}
        className={`callVideo remoteFeed ${focusedVideo === 'remote' ? 'videoMain' : 'videoThumb'}`}
        autoPlay
        playsInline
        onClick={() => setFocusedVideo('remote')}
        aria-label="Other person's video"
      />
      <video
        ref={localVideo}
        className={`callVideo localFeed ${focusedVideo === 'local' ? 'videoMain' : 'videoThumb'}`}
        autoPlay
        muted
        playsInline
        onClick={() => setFocusedVideo('local')}
        aria-label="Your video"
      />

      <div className="callShade"/>
      <div className="realProfile"><div className="avatarFallback">{(partner?.name || 'D')[0]}</div><div><strong>{partner?.name || 'Droxion user'}</strong><span>{partner?.country || 'Worldwide'}{partner?.language ? ` · ${partner.language}` : ''}</span></div></div>
      <div className="callState">{phase === 'calling' ? 'Calling…' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · 30 coins/min`}</div>
      {phase === 'calling' && <div className="callingPulse"/>}
      {giftToast && <div className="giftToast"><span>{giftToast.emoji}</span><strong>{giftToast.text}</strong></div>}
      {message && <div className="callMessage">{message}</div>}

      {giftOpen && phase === 'connected' && (
        <div className="callDrawer giftDrawer">
          <div className="callDrawerHead"><strong>Send a gift</strong><button onClick={() => setGiftOpen(false)}><X size={18}/></button></div>
          <div className="giftGrid">
            {GIFTS.map(gift => (
              <button key={gift.code} onClick={() => sendGift(gift)}>
                <span>{gift.emoji}</span>
                <strong>{gift.name}</strong>
                <small><Coins size={12}/> {gift.cost}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {chatOpen && phase === 'connected' && (
        <div className="callDrawer callChatDrawer">
          <div className="callDrawerHead"><strong>Call chat</strong><button onClick={() => setChatOpen(false)}><X size={18}/></button></div>
          <div className="callChatMessages">
            {callMessages.length === 0 && <span className="callChatEmpty">Say hello 👋</span>}
            {callMessages.map(item => <div key={item.id} className={item.sender_id === user?.id ? 'callChatBubble mine' : 'callChatBubble'}>{item.body}</div>)}
          </div>
          <div className="callChatComposer">
            <input value={chatDraft} maxLength={500} onChange={event => setChatDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') sendCallMessage(); }} placeholder="Message during call…"/>
            <button onClick={sendCallMessage} disabled={!chatDraft.trim()}><Send size={18}/></button>
          </div>
        </div>
      )}

      <div className="videoControls">
        <button onClick={toggleMic}>{micOn ? <Mic/> : <MicOff/>}</button>
        <button onClick={toggleCamera}>{cameraOn ? <Camera/> : <CameraOff/>}</button>
        <button onClick={switchCamera}><RotateCcw/></button>
        <button className={giftOpen ? 'activeTool' : ''} onClick={() => { setGiftOpen(value => !value); setChatOpen(false); }} disabled={phase !== 'connected'}><Gift/></button>
        <button className={chatOpen ? 'activeTool' : ''} onClick={() => { setChatOpen(value => !value); setGiftOpen(false); }} disabled={phase !== 'connected'}><MessageCircle/></button>
        <button className="hangButton" onClick={() => endCall(true)}><PhoneOff/></button>
      </div>
      <div className="callCoins"><Coins size={16}/> {coins ?? 0}</div>
      <div className="tapVideoHint">Tap either video to make it full screen</div>
    </main>
  );
}
