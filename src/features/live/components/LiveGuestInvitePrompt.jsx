import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Mic, UserPlus, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { requestBroadcastMedia, stopMediaStream } from '../services/liveMediaService';
import { connectGuestTransport, disconnectTransport } from '../services/liveTransportService';
import '../styles/live-guest-invite.css';

export default function LiveGuestInvitePrompt({ sessionId = '', currentUserId, onGuestStateChange }) {
  const [invite, setInvite] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [guestStream, setGuestStream] = useState(null);
  const [viewerSessionId, setViewerSessionId] = useState('');
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

  async function respond(accept) {
    if (!invite?.invite_id || phase === 'joining' || phase === 'declining') return;
    const targetSessionId = String(invite.session_id || scopedSessionId || '');
    if (!targetSessionId) return;
    setError('');
    setPhase(accept ? 'joining' : 'declining');

    let stream = null;
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
      setPhase('live');
      onGuestStateChange?.({ ...invite, status: 'accepted', session_id: targetSessionId });
    } catch (joinError) {
      if (stream && stream !== guestStream) stopMediaStream(stream);
      setGuestStream(null);
      setError(joinError?.message || 'Could not join as guest.');
      setInvite(current => current ? { ...current, status: 'accepted', session_id: targetSessionId } : current);
      setPhase('accepted');
    }
  }

  async function leaveGuest() {
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
    onGuestStateChange?.({ status: 'removed' });
  }

  if (!invite || !['pending', 'accepted'].includes(invite.status)) return null;

  if (phase === 'live') {
    return (
      <div className="liveGuestSelfTile">
        <video ref={localVideoRef} muted playsInline autoPlay />
        <div><strong>You are LIVE with {invite.host_name || 'creator'}</strong><span><Mic size={13} /> <Camera size={13} /> Guest camera + mic on</span></div>
        <button type="button" onClick={leaveGuest}>Leave guest</button>
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
