import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Users, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import LiveMiniProfileSheet from './LiveMiniProfileSheet';
import '../styles/live-audience-drawer.css';

export default function LiveAudienceDrawer({ open, sessionId, onClose }) {
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profileTarget, setProfileTarget] = useState(null);

  const load = useCallback(async () => {
    if (!open || !sessionId) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('droxion_live_host_audience', { p_session_id: sessionId });
      if (rpcError) throw rpcError;
      setViewers(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError?.message || 'Could not load viewers.');
    } finally {
      setLoading(false);
    }
  }, [open, sessionId]);

  useEffect(() => {
    if (!open) {
      setProfileTarget(null);
      return undefined;
    }
    load();
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, [open, load]);

  if (!open) return null;

  return (
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
                return (
                  <button
                    type="button"
                    className="liveAudienceRow"
                    key={viewer.user_id}
                    onClick={() => setProfileTarget(viewer)}
                  >
                    {viewer.avatar_url ? (
                      <img src={viewer.avatar_url} alt="" />
                    ) : (
                      <span className="liveAudienceAvatarFallback">{String(name).trim().charAt(0).toUpperCase()}</span>
                    )}
                    <div>
                      <strong>{name}</strong>
                      <span>{viewer.username ? `@${viewer.username}` : viewer.country || 'Viewer'}</span>
                    </div>
                    <small>View profile</small>
                  </button>
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
    </>
  );
}
