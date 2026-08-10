import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CameraOff, Coins, Mic, MicOff, PhoneOff, RotateCcw, ShieldCheck, Video, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import './random-call.css';

const FILTERS = [
  { id: 'both', label: 'Both', cost: 'FREE' },
  { id: 'male', label: 'Male', cost: 'FREE' },
  { id: 'female', label: 'Female', cost: '3 coins when connected' }
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

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const streamRef = useRef(null);
  const pcRef = useRef(null);
  const lastSignalId = useRef(0);
  const pendingIce = useRef([]);
  const partnerIdRef = useRef(null);
  const connectedOnce = useRef(false);
  const billingTimer = useRef(null);
  const reconnectTimer = useRef(null);
  const processingSignals = useRef(false);
  const activeCallId = useRef(null);

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

  const stopMedia = useCallback(() => {
    if (billingTimer.current) clearInterval(billingTimer.current);
    billingTimer.current = null;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    pendingIce.current = [];

    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  }, []);

  const resetCallState = useCallback(() => {
    activeCallId.current = null;
    partnerIdRef.current = null;
    connectedOnce.current = false;
    lastSignalId.current = 0;
    pendingIce.current = [];
    processingSignals.current = false;
    setCallId(null);
    setPartner(null);
    setSeconds(0);
    setMicOn(true);
    setCameraOn(true);
  }, []);

  const finishCall = useCallback(async (goBack = true) => {
    const id = activeCallId.current || callId;
    stopMedia();
    if (id) {
      await supabase.rpc('droxion_end_call', { p_call_id: id });
    }
    resetCallState();
    if (goBack) setPhase('choose');
  }, [callId, resetCallState, stopMedia]);

  useEffect(() => () => {
    stopMedia();
  }, [stopMedia]);

  async function prepareMatch(data) {
    const id = data?.call_id;
    if (!id) return;

    stopMedia();
    activeCallId.current = id;
    lastSignalId.current = 0;
    pendingIce.current = [];
    connectedOnce.current = false;
    partnerIdRef.current = data.partner_id || null;

    setCallId(id);
    setIsInitiator(Boolean(data.is_initiator));
    setSeconds(0);
    setMessage('Preparing camera…');

    if (!partnerIdRef.current) {
      const { data: status } = await supabase.rpc('droxion_random_status');
      partnerIdRef.current = status?.partner_id || null;
    }

    const { data: profile } = await supabase.rpc('droxion_partner_profile', { p_call_id: id });
    setPartner(profile || { name: 'Droxion user', country: '' });
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

    if (filter === 'female' && Number(coins || 0) < 3) {
      setMessage('You need at least 3 coins to use the Female filter.');
      return;
    }

    setMessage('');
    setPhase('searching');

    try {
      await joinQueue();
    } catch (error) {
      setMessage(error?.message || 'Could not start matching.');
      setPhase('choose');
    }
  }

  async function cancelWaiting() {
    if (user?.id) {
      await supabase.from('droxion_random_queue').delete().eq('user_id', user.id);
    }
    setPhase('choose');
  }

  const findNext = useCallback(async () => {
    stopMedia();
    resetCallState();
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
  }, [filter, resetCallState, stopMedia]);

  useEffect(() => {
    if (phase !== 'searching' || !user?.id) return;

    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const { data } = await supabase.rpc('droxion_random_status');
        if (data?.call_id) await prepareMatch(data);
      } finally {
        busy = false;
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [phase, user?.id]);

  const sendSignal = useCallback(async (signalType, payload) => {
    const id = activeCallId.current;
    const recipient = partnerIdRef.current;
    if (!id || !user?.id || !recipient) return false;

    const { error } = await supabase.from('droxion_call_signals').insert({
      call_id: id,
      sender_id: user.id,
      recipient_id: recipient,
      signal_type: signalType,
      payload
    });

    if (error) {
      console.warn(`Could not send ${signalType}`, error);
      return false;
    }
    return true;
  }, [user?.id]);

  const flushPendingIce = useCallback(async pc => {
    if (!pc?.remoteDescription || pendingIce.current.length === 0) return;

    const candidates = pendingIce.current.splice(0);
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Queued ICE candidate failed', error);
      }
    }
  }, []);

  const markConnected = useCallback(async () => {
    const id = activeCallId.current;
    if (!id || connectedOnce.current) return;

    connectedOnce.current = true;
    const { data, error } = await supabase.rpc('droxion_mark_call_connected', { p_call_id: id });

    if (error || !data?.allowed) {
      connectedOnce.current = false;
      setMessage(error?.message || 'Not enough coins to connect.');
      await finishCall(false);
      setPhase('choose');
      return;
    }

    if (data.coin_balance != null) setCoins(Number(data.coin_balance));
    setMessage('');
    setPhase('connected');
  }, [finishCall]);

  const restartIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState === 'closed' || !isInitiator || pc.signalingState !== 'stable') return;

    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      await sendSignal('offer', pc.localDescription?.toJSON?.() || offer);
    } catch (error) {
      console.warn('ICE restart failed', error);
    }
  }, [isInitiator, sendSignal]);

  useEffect(() => {
    if (phase !== 'calling' || !callId || !user?.id) return;
    if (activeCallId.current !== callId) return;

    let cancelled = false;

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

        if (cancelled || activeCallId.current !== callId) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

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

        pc.ontrack = event => {
          const remoteStream = event.streams?.[0];
          if (remoteVideo.current && remoteStream) {
            remoteVideo.current.srcObject = remoteStream;
            remoteVideo.current.play?.().catch(() => {});
          }
        };

        pc.onicecandidate = event => {
          if (event.candidate) sendSignal('ice', event.candidate.toJSON());
        };

        pc.onconnectionstatechange = async () => {
          const state = pc.connectionState;

          if (state === 'connected') {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            reconnectTimer.current = null;
            await markConnected();
            return;
          }

          if (state === 'disconnected' || state === 'failed') {
            setMessage('Reconnecting video…');
            await restartIce();

            if (!reconnectTimer.current) {
              reconnectTimer.current = setTimeout(async () => {
                reconnectTimer.current = null;
                if (pc.connectionState !== 'connected' && pc.connectionState !== 'closed') {
                  setMessage('Connection is weak. Trying again…');
                  await restartIce();
                }
              }, 6000);
            }
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'failed') restartIce();
        };

        setMessage('Connecting…');

        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal('offer', pc.localDescription?.toJSON?.() || offer);
        }
      } catch (error) {
        console.error('Media/WebRTC setup error', error);
        setMessage('Camera and microphone permission are required for a video call.');
        await finishCall(false);
        setPhase('choose');
      }
    })();

    return () => { cancelled = true; };
  }, [phase, callId, user?.id, isInitiator, finishCall, markConnected, restartIce, sendSignal]);

  useEffect(() => {
    if (!callId || !user?.id || !['calling', 'connected'].includes(phase)) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled || processingSignals.current) return;

      const pc = pcRef.current;
      // Critical: never read/consume signaling rows until the peer connection exists.
      if (!pc || pc.signalingState === 'closed') return;

      processingSignals.current = true;
      try {
        const { data: rows, error } = await supabase
          .from('droxion_call_signals')
          .select('id,signal_type,payload')
          .eq('call_id', callId)
          .eq('recipient_id', user.id)
          .gt('id', lastSignalId.current)
          .order('id');

        if (error) throw error;

        for (const row of rows || []) {
          if (cancelled || activeCallId.current !== callId) break;

          try {
            if (row.signal_type === 'offer' && !isInitiator) {
              await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
              await flushPendingIce(pc);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              const sent = await sendSignal('answer', pc.localDescription?.toJSON?.() || answer);
              if (!sent) break;
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

            // Advance only after this signal was safely handled or intentionally ignored.
            lastSignalId.current = Math.max(lastSignalId.current, Number(row.id));
          } catch (signalError) {
            console.warn('WebRTC signal handling error', row.signal_type, signalError);
            if (row.signal_type === 'ice') {
              try {
                pendingIce.current.push(new RTCIceCandidate(row.payload));
                lastSignalId.current = Math.max(lastSignalId.current, Number(row.id));
              } catch {}
            }
            // Offer/answer errors are retried on the next poll instead of being discarded.
            if (row.signal_type !== 'ice') break;
          }
        }

        const { data: status, error: statusError } = await supabase.rpc('droxion_random_status');
        if (!statusError && status?.partner_id) partnerIdRef.current = status.partner_id;
        if (!statusError && status?.status === 'ended') await findNext();
      } catch (error) {
        console.warn('Call signaling poll failed', error);
      } finally {
        processingSignals.current = false;
      }
    };

    poll();
    const timer = setInterval(poll, 500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [callId, user?.id, phase, isInitiator, findNext, flushPendingIce, sendSignal]);

  useEffect(() => {
    if (phase !== 'connected' || !callId) return;

    const clock = setInterval(() => setSeconds(value => value + 1), 1000);
    billingTimer.current = setInterval(async () => {
      const { data, error } = await supabase.rpc('droxion_bill_call_tick', { p_call_id: callId });
      if (data?.coin_balance != null) setCoins(Number(data.coin_balance));

      if (error || !data?.allowed) {
        setMessage('Call ended because there are not enough coins.');
        await finishCall(false);
        setPhase('choose');
      }
    }, 10000);

    return () => {
      clearInterval(clock);
      if (billingTimer.current) clearInterval(billingTimer.current);
      billingTimer.current = null;
    };
  }, [phase, callId, finishCall]);

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
          height: { ideal: 720 }
        },
        audio: false
      });
      const newTrack = newStream.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find(item => item.track?.kind === 'video');
      await sender?.replaceTrack(newTrack);
      current.stop();

      const audio = streamRef.current?.getAudioTracks()?.[0];
      streamRef.current = new MediaStream([newTrack, ...(audio ? [audio] : [])]);
      if (localVideo.current) localVideo.current.srcObject = streamRef.current;
    } catch (error) {
      console.warn('Camera switch failed', error);
      setMessage('Could not switch camera on this device.');
    }
  }

  if (phase === 'loading') {
    return <main className="randomCallPage"><div className="finderPulse"/><h2>Loading Droxion…</h2></main>;
  }

  if (phase === 'guest') {
    return <main className="randomCallPage"><button className="randomClose" onClick={() => navigate('/')}><X /></button><div className="welcomeCoin"><Coins /> 50 welcome coins</div><h1>Meet someone real.</h1><p>Create a verified 21+ account before entering random video chat.</p><button className="randomPrimary" onClick={() => navigate('/signup')}>Create account</button><button className="randomSecondary" onClick={() => navigate('/login')}>Log in</button></main>;
  }

  if (phase === 'choose') {
    return <main className="randomCallPage"><button className="randomClose" onClick={() => navigate('/')}><X /></button><div className="randomWallet"><Coins size={18}/> {coins ?? 0}</div><Video size={48}/><h1>Random Call</h1><p>Connect only with real Droxion users who are available now.</p><div className="genderChoices">{FILTERS.map(item => <button key={item.id} className={filter === item.id ? 'selected' : ''} onClick={() => setFilter(item.id)}><strong>{item.label}</strong><span>{item.cost}</span></button>)}</div><p className="priceNote">Searching and waiting are free. Connected video costs 5 coins every 10 seconds (30/min). Female filter adds 3 coins only when connected.</p>{message && <p className="randomError">{message}</p>}<button className="randomPrimary" onClick={beginSearch}>Find someone</button><div className="safetyLine"><ShieldCheck size={18}/> 21+ · Real accounts only.</div></main>;
  }

  if (phase === 'searching') {
    return <main className="randomCallPage searchingPage"><div className="finderWrap"><div className="finderPulse"/><div className="finderPulse second"/><Video size={44}/></div><h1>Finding someone…</h1><p>{message || `Looking for an available ${filter === 'both' ? 'person' : filter === 'female' ? 'woman' : 'man'}.`}</p><p className="priceNote">No charge while waiting.</p><button className="randomSecondary" onClick={cancelWaiting}>Cancel</button></main>;
  }

  return (
    <main className="videoCallPage">
      <video ref={remoteVideo} className="callVideo remoteFeed videoMain" autoPlay playsInline aria-label="Other person's video" />
      <video ref={localVideo} className="callVideo localFeed videoThumb" autoPlay muted playsInline aria-label="Your video" />
      <div className="callShade"/>
      <div className="realProfile"><div className="avatarFallback">{(partner?.name || 'D')[0]}</div><div><strong>{partner?.name || 'Droxion user'}</strong><span>{partner?.country || 'Worldwide'}{partner?.language ? ` · ${partner.language}` : ''}</span></div></div>
      <div className="callState">{phase === 'calling' ? 'Connecting…' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · 30 coins/min`}</div>
      {phase === 'calling' && <div className="callingPulse"/>}
      {message && <div className="callMessage">{message}</div>}
      <div className="videoControls">
        <button onClick={toggleMic}>{micOn ? <Mic/> : <MicOff/>}</button>
        <button onClick={toggleCamera}>{cameraOn ? <Camera/> : <CameraOff/>}</button>
        <button onClick={switchCamera}><RotateCcw/></button>
        <button className="hangButton" onClick={() => finishCall(true)}><PhoneOff/></button>
      </div>
      <div className="callCoins"><Coins size={16}/> {coins ?? 0}</div>
    </main>
  );
}
