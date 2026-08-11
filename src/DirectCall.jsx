import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, CameraOff, Mic, MicOff, PhoneOff } from 'lucide-react';
import { supabase } from './supabaseClient';
import './random-call.css';

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

export default function DirectCall() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [user, setUser] = useState(null);
  const [callId, setCallId] = useState(params.get('call') || '');
  const [status, setStatus] = useState('loading');
  const [partner, setPartner] = useState(null);
  const [message, setMessage] = useState('');
  const [coins, setCoins] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const remoteAudio = useRef(null);
  const streamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pcRef = useRef(null);
  const partnerIdRef = useRef('');
  const lastSignalId = useRef(0);
  const pendingIce = useRef([]);
  const connectedOnce = useRef(false);
  const processingSignals = useRef(false);

  const stopMedia = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    remoteStreamRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
  }, []);

  const endCall = useCallback(async () => {
    if (callId) await supabase.rpc('droxion_end_call', { p_call_id: callId });
    stopMedia();
    navigate('/');
  }, [callId, navigate, stopMedia]);

  useEffect(() => () => stopMedia(), [stopMedia]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!authUser) {
        navigate('/login');
        return;
      }
      setUser(authUser);
      const { data: wallet } = await supabase.from('droxion_wallets').select('coin_balance').eq('user_id', authUser.id).maybeSingle();
      if (alive) setCoins(Number(wallet?.coin_balance || 0));

      const recipient = params.get('to');
      if (!callId && recipient) {
        const { data, error } = await supabase.rpc('droxion_start_direct_call', { p_recipient_id: recipient });
        if (!alive) return;
        if (error || !data?.allowed) {
          setMessage(error?.message || (data?.reason === 'insufficient_coins' ? 'You need 50 coins to start this call.' : 'Could not start the call.'));
          setStatus('failed');
          return;
        }
        setCallId(data.call_id);
        window.history.replaceState({}, '', `/direct-call?call=${data.call_id}`);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!callId || !user?.id) return;
    let stopped = false;
    const poll = async () => {
      const { data, error } = await supabase.rpc('droxion_direct_call_status', { p_call_id: callId });
      if (stopped) return;
      if (error || !data?.allowed) {
        setStatus('failed');
        setMessage(error?.message || 'Call is unavailable.');
        return;
      }
      partnerIdRef.current = data.partner_id || '';
      setPartner({ id: data.partner_id, name: data.partner_name, avatar_url: data.avatar_url, country: data.country });
      if (data.status === 'ended') {
        setStatus('ended');
        setMessage(data.end_reason === 'declined' ? 'Call declined.' : data.end_reason === 'missed' ? 'No answer.' : 'Call ended.');
        stopMedia();
      } else if (!data.accepted) {
        setStatus(data.is_initiator ? 'ringing' : 'waiting');
      } else if (data.status === 'connected') {
        setStatus('connected');
      } else {
        setStatus('connecting');
      }
    };
    poll();
    const timer = setInterval(poll, 1000);
    return () => { stopped = true; clearInterval(timer); };
  }, [callId, user?.id, stopMedia]);

  const sendSignal = useCallback(async (type, payload) => {
    if (!callId || !user?.id || !partnerIdRef.current) return false;
    const { error } = await supabase.from('droxion_call_signals').insert({
      call_id: callId,
      sender_id: user.id,
      recipient_id: partnerIdRef.current,
      signal_type: type,
      payload
    });
    return !error;
  }, [callId, user?.id]);

  const markConnected = useCallback(async () => {
    if (connectedOnce.current || !callId) return;
    connectedOnce.current = true;
    const { data, error } = await supabase.rpc('droxion_mark_call_connected', { p_call_id: callId });
    if (error || !data?.allowed) {
      connectedOnce.current = false;
      setMessage(error?.message || 'Not enough coins to connect.');
      await supabase.rpc('droxion_end_call', { p_call_id: callId });
      setStatus('ended');
      return;
    }
    if (data.coin_balance != null && data.connection_fee > 0) setCoins(Number(data.coin_balance));
    setStatus('connected');
  }, [callId]);

  useEffect(() => {
    if (!callId || !user?.id || status !== 'connecting' || pcRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: { echoCancellation: true, noiseSuppression: true } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (localVideo.current) { localVideo.current.srcObject = stream; localVideo.current.play?.().catch(() => {}); }

        const pc = new RTCPeerConnection({ iceServers: iceServers(), iceCandidatePoolSize: 10 });
        pcRef.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        pc.ontrack = event => {
          let remote = event.streams?.[0] || remoteStreamRef.current || new MediaStream();
          if (!remote.getTracks().some(t => t.id === event.track.id)) remote.addTrack(event.track);
          remoteStreamRef.current = remote;
          if (remoteVideo.current) { remoteVideo.current.srcObject = remote; remoteVideo.current.muted = true; remoteVideo.current.play?.().catch(() => {}); }
          if (remoteAudio.current) { remoteAudio.current.srcObject = remote; remoteAudio.current.play?.().catch(() => {}); }
        };
        pc.onicecandidate = e => { if (e.candidate) sendSignal('ice', e.candidate.toJSON()); };
        pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected') markConnected(); };

        const { data: call } = await supabase.rpc('droxion_direct_call_status', { p_call_id: callId });
        if (call?.is_initiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal('offer', pc.localDescription?.toJSON?.() || offer);
        }
      } catch (error) {
        setMessage('Camera and microphone permission are required.');
        await supabase.rpc('droxion_end_call', { p_call_id: callId });
        setStatus('ended');
      }
    })();
    return () => { cancelled = true; };
  }, [callId, user?.id, status, markConnected, sendSignal]);

  useEffect(() => {
    if (!callId || !user?.id || !['connecting', 'connected'].includes(status)) return;
    let stopped = false;
    const poll = async () => {
      if (processingSignals.current || stopped) return;
      const pc = pcRef.current;
      if (!pc) return;
      processingSignals.current = true;
      try {
        const { data: rows } = await supabase.from('droxion_call_signals').select('id,signal_type,payload').eq('call_id', callId).eq('recipient_id', user.id).gt('id', lastSignalId.current).order('id');
        for (const row of rows || []) {
          if (row.signal_type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
            while (pendingIce.current.length) await pc.addIceCandidate(pendingIce.current.shift());
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal('answer', pc.localDescription?.toJSON?.() || answer);
          } else if (row.signal_type === 'answer' && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
            while (pendingIce.current.length) await pc.addIceCandidate(pendingIce.current.shift());
          } else if (row.signal_type === 'ice') {
            const candidate = new RTCIceCandidate(row.payload);
            if (pc.remoteDescription) await pc.addIceCandidate(candidate); else pendingIce.current.push(candidate);
          }
          lastSignalId.current = Math.max(lastSignalId.current, Number(row.id));
        }
      } catch (error) {
        console.warn('Direct call signal error', error);
      } finally {
        processingSignals.current = false;
      }
    };
    poll();
    const timer = setInterval(poll, 500);
    return () => { stopped = true; clearInterval(timer); };
  }, [callId, user?.id, status, sendSignal]);

  useEffect(() => {
    if (status !== 'connected' || !callId) return;
    const clock = setInterval(() => setSeconds(s => s + 1), 1000);
    const billing = setInterval(async () => {
      const { data, error } = await supabase.rpc('droxion_bill_call_tick', { p_call_id: callId });
      if (data?.coin_balance != null) setCoins(Number(data.coin_balance));
      if (error || !data?.allowed) {
        setMessage('Call ended because the caller does not have enough coins.');
        setStatus('ended');
        stopMedia();
      }
    }, 10000);
    return () => { clearInterval(clock); clearInterval(billing); };
  }, [status, callId, stopMedia]);

  function toggleMic() {
    const track = streamRef.current?.getAudioTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  function toggleCamera() {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  if (status === 'failed') return <div className="randomPage"><div className="randomCard"><h2>Direct Video Call</h2><p>{message}</p><button className="primaryButton" onClick={() => navigate('/')}>Back</button></div></div>;

  return (
    <div className="randomCallStage">
      <video ref={remoteVideo} className="remoteVideo" autoPlay playsInline muted />
      <audio ref={remoteAudio} autoPlay playsInline />
      <video ref={localVideo} className="localVideo" autoPlay playsInline muted />
      <div className="callTopBar">
        <div><strong>{partner?.name || 'Direct Call'}</strong><div>{status === 'ringing' ? 'Ringing…' : status === 'connecting' ? 'Connecting…' : status === 'connected' ? `${mm}:${ss}` : message || 'Call ended'}</div></div>
        <div>🪙 {coins ?? 0}</div>
      </div>
      {status === 'ringing' && <div className="callStatusMessage">50 coins when connected · then 5 coins every 10 seconds</div>}
      {message && status !== 'ringing' && <div className="callStatusMessage">{message}</div>}
      <div className="callControls">
        <button onClick={toggleMic}>{micOn ? <Mic /> : <MicOff />}</button>
        <button onClick={toggleCamera}>{cameraOn ? <Camera /> : <CameraOff />}</button>
        <button className="endCallButton" onClick={endCall}><PhoneOff /></button>
      </div>
    </div>
  );
}
