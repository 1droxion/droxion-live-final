import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Mic, MicOff, MoreHorizontal, UserPlus, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { requestBroadcastMedia, stopMediaStream } from '../services/liveMediaService';
import { connectGuestTransport, disconnectTransport } from '../services/liveTransportService';
import { setHostCameraMuted, setHostMicrophoneMuted } from '../services/liveHostControlService';
import '../styles/live-guest-invite.css';

export default function LiveGuestInvitePrompt({ sessionId = '', currentUserId, onGuestStateChange }) {
  const [invite, setInvite] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [guestStream, setGuestStream] = useState(null);
  const [viewerSessionId, setViewerSessionId] = useState('');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [controlBusy, setControlBusy] = useState('');
  const guestRoomRef = useRef(null);
  const localVideoRef = useRef(null);

  const scopedSessionId = String(sessionId || viewerSessionId || '');
  const effectiveSessionId = String(scopedSessionId || invite?.session_id || '');

  useEffect(() => {
    const handleViewerReady = event => {
      const nextSessionId = String(event?.detail?.sessionId || '');
      if (nextSessionId) setViewerSessionId(nextSessionId);
    };
    const handleViewerClosed = event => {
      const closedSessionId = String(event?.detail?.sessionId || '');
      setViewerSessionId(current => !closedSessionId || current === closedSessionId ? '' : current);
    };

    window.addEventListener('droxion:viewer-room-ready', handleViewerReady);
    window.addEventListener('droxion:viewer-room-closed', handleViewerClosed);
    return () => {
      window.removeEventListener('droxion:viewer-room-ready', handleViewerReady);
      window.removeEventListener('droxion:viewer-room-closed', handleViewerClosed);
    };
  }, []);

  const load = useCallback(async () => {
    if (!currentUserId || phase === 'joining' || phase === 'live') return;
    try {
      const result = scopedSessionId
        ? await supabase.rpc('droxion_my_live_guest_state', { p_session_id: scopedSessionId })
        : await supabase.rpc('droxion_my_live_invite');
      const { data, error: rpcError } = result;
      if (rpcError) throw rpcError;
      const next = data && typeof data === 'object' ? data : {};
      const hasInvite = Boolean(next.invite_id) && Boolean(next.session_id) && ['pending', 'accepted'].includes(String(next.status || 'pending'));
      const normalized = hasInvite ? { ...next, status: next.status || 'pending' } : null;
      setInvite(normalized);
      if (normalized?.status === 'accepted' && phase === 'idle') setPhase('accepted');
      if (!normalized && phase === 'accepted') setPhase('idle');
      onGuestStateChange?.(normalized || { status: 'none' });
    } catch (loadError) {
      setError(loadError?.message || 'Could not check LIVE invitation.');
    }
  }, [scopedSessionId, currentUserId, phase, onGuestStateChange]);

  useEffect(() => {
    load();
    if (!currentUserId) return undefined;
    const timer = window.setInterval(load, 1500);
    return () => window.clearInterval(timer);
  }, [load, currentUserId]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;
    video.srcObject = guestStream || null;
    if (guestStream) video.play?.().catch?.(() => {});
  }, [guestStream, phase]);

  useEffect(() => () => {
    const room = guestRoomRef.current;
    guestRoomRef.current = null;
    disconnectTransport(room).catch(() => {});
    stopMediaStream(guestStream);
  }, [guestStream]);

  useEffect(() => {
    if (phase !== 'live' || !effectiveSessionId) return undefined;
    let stopped = false;

    const checkStillAccepted = async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('droxion_my_live_guest_state', { p_session_id: effectiveSessionId });
        if (stopped || rpcError || data?.status === 'accepted') return;

        const room = guestRoomRef.current;
        guestRoomRef.current = null;
        const stream = guestStream;
        setGuestStream(null);
        setInvite(null);
        setPhase('idle');
        setControlsOpen(false);
        setMicMuted(false);
        setCameraMuted(false);
        setControlBusy('');
        setError('');
        onGuestStateChange?.({ status: 'removed', session_id: effectiveSessionId });
        await disconnectTransport(room);
        stopMediaStream(stream);
      } catch {}
    };

    checkStillAccepted();
    const timer = window.setInterval(checkStillAccepted, 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [phase, effectiveSessionId, guestStream, onGuestStateChange]);

  useEffect(() => {
    if (phase === 'live') return;
    setControlsOpen(false);
    setControlBusy('');
  }, [phase]);

  useEffect(() => {
    if (!controlsOpen) return undefined;
    const closeOutside = event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.liveGuestSelfMenu') || target.closest('.liveGuestSelfMoreButton')) return;
      setControlsOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    return () => document.removeEventListener('pointerdown', closeOutside, true);
  }, [controlsOpen]);

  async function clearAcceptedInvite(targetSessionId) {
    try {
      await supabase.rpc('droxion_leave_live_guest', { p_session_id: targetSessionId });
    } catch {}
    setInvite(null);
    setError('');
    setPhase('idle');
    onGuestStateChange?.({ status: 'removed', session_id: targetSessionId });
  }

  async function respond(accept) {
    if (!invite?.invite_id || phase === 'joining' || phase === 'declining') return;
    const targetSessionId = String(invite.session_id || scopedSessionId || '');
    if (!targetSessionId) return;

    if (!accept && invite.status === 'accepted') {
      setPhase('declining');
      await clearAcceptedInvite(targetSessionId);
      return;
    }

    setError('');
    setPhase(accept ? 'joining' : 'declining');

    let stream = null;
    let acceptedByBackend = invite.status === 'accepted';
    try {
      if (accept) {
        // iOS Safari requires getUserMedia to happen directly from the user's tap.
        // Request camera/mic before awaiting Supabase or LiveKit network work.
        stream = await requestBroadcastMedia({ orientation: 'vertical', facingMode: 'user' });
      }

      if (!accept || invite.status !== 'accepted') {
        const { data, error: rpcError } = await supabase.rpc('droxion_respond_live_invite', {
          p_invite_id: invite.invite_id,
          p_accept: Boolean(accept)
        });
        if (rpcError || data?.allowed === false) throw new Error(rpcError?.message || data?.reason || 'Could not respond to invite.');
        if (!accept) {
          setInvite(null);
          setPhase('idle');
          onGuestStateChange?.({ status: 'declined' });
          return;
        }
        acceptedByBackend = true;
        setInvite(current => ({ ...(current || invite), status: 'accepted', session_id: targetSessionId }));
      }

      setGuestStream(stream);
      const transport = await connectGuestTransport({
        sessionId: targetSessionId,
        stream,
        callbacks: {
          onDisconnected: () => setPhase(current => current === 'live' ? 'ended' : current)
        }
      });
      guestRoomRef.current = transport.room;
      setInvite(current => ({ ...(current || invite), status: 'accepted', session_id: targetSessionId }));
      setMicMuted(false);
      setCameraMuted(false);
      setPhase('live');
      onGuestStateChange?.({ ...invite, status: 'accepted', session_id: targetSessionId });
    } catch (joinError) {
      if (stream && stream !== guestStream) stopMediaStream(stream);
      setGuestStream(null);
      setError(joinError?.message || 'Could not join as guest.');
      setInvite(current => current ? {
        ...current,
        status: acceptedByBackend ? 'accepted' : (current.status || 'pending'),
        session_id: targetSessionId
      } : current);
      setPhase(acceptedByBackend ? 'accepted' : 'idle');
    }
  }

  async function toggleGuestMicrophone(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (phase !== 'live' || controlBusy) return;
    const room = guestRoomRef.current;
    if (!room) return;
    const previous = micMuted;
    const nextMuted = !previous;
    setMicMuted(nextMuted);
    setControlBusy('mic');
    setError('');
    try {
      await setHostMicrophoneMuted(room, nextMuted);
    } catch (controlError) {
      setMicMuted(previous);
      setError(controlError?.message || 'Could not change microphone.');
    } finally {
      setControlBusy('');
    }
  }

  async function toggleGuestCamera(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (phase !== 'live' || controlBusy) return;
    const room = guestRoomRef.current;
    if (!room) return;
    const previous = cameraMuted;
    const nextMuted = !previous;
    setCameraMuted(nextMuted);
    setControlBusy('camera');
    setError('');
    try {
      await setHostCameraMuted(room, nextMuted);
    } catch (controlError) {
      setCameraMuted(previous);
      setError(controlError?.message || 'Could not change camera.');
    } finally {
      setControlBusy('');
    }
  }

  async function leaveGuest() {
    setControlsOpen(false);
    const room = guestRoomRef.current;
    guestRoomRef.current = null;
    const stream = guestStream;
    setGuestStream(null);
    await disconnectTransport(room);
    stopMediaStream(stream);
    if (effectiveSessionId) {
      try { await supabase.rpc('droxion_leave_live_guest', { p_session_id: effectiveSessionId }); } catch {}
    }
    setInvite(null);
    setPhase('idle');
    setMicMuted(false);
    setCameraMuted(false);
    setControlBusy('');
    onGuestStateChange?.({ status: 'removed' });
  }

  if (!invite || !['pending', 'accepted'].includes(invite.status)) return null;

  if (phase === 'live') {
    return (
      <div className="liveGuestSelfTile isGuestLive">
        <video ref={localVideoRef} className="liveGuestSelfVideo" muted playsInline autoPlay />
        <span className="liveGuestSelfLabel">Guest</span>
        {error && <div className="liveGuestSelfError">{error}</div>}

        {controlsOpen && (
          <div className="liveGuestSelfMenu" role="menu" aria-label="Guest LIVE controls">
            <button type="button" onClick={toggleGuestMicrophone} disabled={Boolean(controlBusy)} role="menuitem">
              {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
              <span><strong>Microphone</strong><small>{micMuted ? 'Off' : 'On'}</small></span>
            </button>
            <button type="button" onClick={toggleGuestCamera} disabled={Boolean(controlBusy)} role="menuitem">
              {cameraMuted ? <CameraOff size={18} /> : <Camera size={18} />}
              <span><strong>Camera</strong><small>{cameraMuted ? 'Off' : 'On'}</small></span>
            </button>
            <button type="button" className="liveGuestSelfLeave" onClick={leaveGuest} role="menuitem">
              <X size={18} /><span><strong>Leave Guest</strong><small>Return to watching LIVE</small></span>
            </button>
          </div>
        )}

        <button
          type="button"
          className={`liveGuestSelfMoreButton ${controlsOpen ? 'isOpen' : ''}`}
          onClick={() => setControlsOpen(value => !value)}
          aria-expanded={controlsOpen}
          aria-label="Guest controls"
        >
          <MoreHorizontal size={25} />
        </button>
      </div>
    );
  }

  return (
    <div className="liveGuestInviteBackdrop">
      <section className="liveGuestInviteCard" aria-label="LIVE guest invitation">
        <button type="button" className="liveGuestInviteDismiss" onClick={() => respond(false)} aria-label="Decline invite"><X size={20} /></button>
        <span className="liveGuestInviteIcon"><UserPlus size={28} /></span>
        <strong>{invite.host_name || 'Creator'} invited you to join LIVE</strong>
        <p>Your camera and microphone will only turn on after you accept and grant permission.</p>
        {error && <div className="liveGuestInviteError">{error}</div>}
        <div className="liveGuestInviteActions">
          <button type="button" className="isDecline" onClick={() => respond(false)} disabled={phase === 'joining' || phase === 'declining'}>Decline</button>
          <button type="button" className="isAccept" onClick={() => respond(true)} disabled={phase === 'joining' || phase === 'declining'}>{phase === 'joining' ? 'Joining…' : 'Accept & join'}</button>
        </div>
      </section>
    </div>
  );
}
