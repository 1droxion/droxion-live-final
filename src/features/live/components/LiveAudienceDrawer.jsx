import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, UserPlus, Users, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import LiveMiniProfileSheet from './LiveMiniProfileSheet';
import '../styles/live-audience-drawer.css';
import '../styles/live-guest-invite.css';

export default function LiveAudienceDrawer({ open, sessionId, onClose }) {
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profileTarget, setProfileTarget] = useState(null);
  const [guestState, setGuestState] = useState({ status: 'none' });
  const [inviteBusy, setInviteBusy] = useState('');

  const load = useCallback(async () => {
    if (!open || !sessionId) return;
    setLoading(true);
    setError('');
    try {
      const [{ data, error: rpcError }, { data: guestData }] = await Promise.all([
        supabase.rpc('droxion_live_host_audience', { p_session_id: sessionId }),
        supabase.rpc('droxion_host_live_guest_state', { p_session_id: sessionId })
      ]);
      if (rpcError) throw rpcError;
      setViewers(Array.isArray(data) ? data : []);
      setGuestState(guestData && typeof guestData === 'object' ? guestData : { status: 'none' });
    } catch (loadError) {
      setError(loadError?.message || 'Could not load viewers.');
    } finally {
      setLoading(false);
    }
  }, [open, sessionId]);

  useEffect(() => {
    if (!open) {
      setProfileTarget(null);
      setGuestState({ status: 'none' });
      return undefined;
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [open, load]);

  async function inviteViewer(viewer) {
    if (!viewer?.user_id || inviteBusy) return;
    setInviteBusy(String(viewer.user_id));
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('droxion_host_invite_live_guest', {
        p_session_id: sessionId,
        p_invitee_id: viewer.user_id
      });
      if (rpcError || data?.allowed === false) {
        throw new Error(rpcError?.message || data?.reason || 'Could not invite viewer.');
      }
      setGuestState({
        ...viewer,
        invite_id: data?.invite_id,
        invitee_id: viewer.user_id,
        status: data?.status || 'pending'
      });
    } catch (inviteError) {
      setError(inviteError?.message || 'Could not invite viewer.');
    } finally {
      setInviteBusy('');
    }
  }

  async function removeGuest(viewer) {
    if (!viewer?.user_id || inviteBusy) return;
    setInviteBusy(String(viewer.user_id));
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('droxion_host_remove_live_guest', {
        p_session_id: sessionId,
        p_invitee_id: viewer.user_id
      });
      if (rpcError || data?.allowed === false) {
        throw new Error(rpcError?.message || data?.reason || 'Could not remove guest.');
      }
      setGuestState({ status: 'none' });
    } catch (removeError) {
      setError(removeError?.message || 'Could not remove guest.');
    } finally {
      setInviteBusy('');
    }
  }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="liveAudienceBackdrop" onClick={onClose}>
        <section className="liveAudienceDrawer" onClick={event => event.stopPropagation()} aria-label="LIVE audience">
          <div className="liveAudienceGrabber" />
          <header className="liveAudienceHeader">
            <div>
              <strong><Users size={18} /> Audience</strong>
              <span>{viewers.length} active viewer{viewers.length === 1 ? '' : 's'}</span>
            </div>
            <div className="liveAudienceHeaderActions">
              <button type="button" onClick={load} disabled={loading} aria-label="Refresh audience"><RefreshCw size={18} /></button>
              <button type="button" onClick={onClose} aria-label="Close audience"><X size={20} /></button>
            </div>
          </header>

          {loading && viewers.length === 0 ? (
            <div className="liveAudienceState">Loading viewers…</div>
          ) : error ? (
            <div className="liveAudienceState isError">{error}</div>
          ) : viewers.length === 0 ? (
            <div className="liveAudienceState">No active viewers right now.</div>
          ) : (
            <div className="liveAudienceList">
              {viewers.map(viewer => {
                const name = viewer.display_name || 'Droxion viewer';
                const isPending = guestState?.status === 'pending' && guestState?.invitee_id === viewer.user_id;
                const isGuest = guestState?.status === 'accepted' && guestState?.invitee_id === viewer.user_id;
                const anotherGuestActive = ['pending', 'accepted'].includes(guestState?.status) && guestState?.invitee_id !== viewer.user_id;
                return (
                  <div className="liveAudienceRow" key={viewer.user_id}>
                    <button type="button" className="liveAudienceProfileButton" onClick={() => setProfileTarget(viewer)}>
                      {viewer.avatar_url ? (
                        <img src={viewer.avatar_url} alt="" />
                      ) : (
                        <span className="liveAudienceAvatarFallback">{String(name).trim().charAt(0).toUpperCase()}</span>
                      )}
                      <div>
                        <strong>{name}</strong>
                        <span>{viewer.username ? `@${viewer.username}` : viewer.country || 'Viewer'}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`liveAudienceInviteButton ${isPending ? 'isPending' : ''} ${isGuest ? 'isGuest' : ''}`}
                      disabled={Boolean(inviteBusy) || anotherGuestActive || isPending}
                      onClick={() => isGuest ? removeGuest(viewer) : inviteViewer(viewer)}
                    >
                      {inviteBusy === viewer.user_id ? 'Working…' : isGuest ? 'Remove guest' : isPending ? 'Invited' : <><UserPlus size={13} /> Invite</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {profileTarget?.user_id && (
        <LiveMiniProfileSheet
          userId={profileTarget.user_id}
          fallback={profileTarget}
          onClose={() => setProfileTarget(null)}
        />
      )}
    </>,
    document.body
  );
}
