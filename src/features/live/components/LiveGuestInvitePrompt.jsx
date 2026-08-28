import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Mic, UserPlus, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { requestBroadcastMedia, stopMediaStream } from '../services/liveMediaService';
import { connectGuestTransport, disconnectTransport } from '../services/liveTransportService';
import '../styles/live-guest-invite.css';

export default function LiveGuestInvitePrompt({ sessionId, currentUserId, onGuestStateChange }) {
  const [invite, setInvite] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [guestStream, setGuestStream] = useState(null);
  const guestRoomRef = useRef(null);
  const localVideoRef = useRef(null);

  const load = useCallback(async () => {
    if (!sessionId || !currentUserId || phase === 'joining' || phase === 'live') return;
    try {
      const { data, error: rpcError } = await supabase.rpc('droxion_my_live_guest_state', { p_session_id: sessionId });
      if (rpcError) throw rpcError;
      const next = data && typeof data === 'object' ? data : {};
      setInvite(next.status && next.status !== 'none' ? next : null);
      if (next.status === 'accepted' && phase === 'idle') setPhase('accepted');
      onGuestStateChange?.(next);
    } catch {}
  }, [sessionId, currentUserId, phase, onGuestStateChange]);

  useEffect(() => {
    load();
    if (!sessionId || !currentUserId) return undefined;
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, [load, sessionId, currentUserId]);

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
    if (!invite?.invite_id || phase === 'joining') return;
    setError('');
    setPhase(accept ? 'joining' : 'declining');
    try {
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

      const stream = await requestBroadcastMedia({ orientation: 'vertical', facingMode: 'user' });
      setGuestStream(stream);
      const transport = await connectGuestTransport({
        sessionId,
        stream,
        callbacks: {
          onDisconnected: () => setPhase(current => current === 'live' ? 'ended' : current)
        }
      });
      guestRoomRef.current = transport.room;
      setPhase('live');
      onGuestStateChange?.({ ...invite, status: 'accepted' });
    } catch (joinError) {
      setError(joinError?.message || 'Could not join as guest.');
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
    try { await supabase.rpc('droxion_leave_live_guest', { p_session_id: sessionId }); } catch {}
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
