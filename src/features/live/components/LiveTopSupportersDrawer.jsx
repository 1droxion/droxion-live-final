import { useCallback, useEffect, useState } from 'react';
import { Crown, Medal, Trophy, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import LiveMiniProfileSheet from './LiveMiniProfileSheet';
import '../styles/live-top-supporters.css';

function compactNumber(value) {
  const number = Number(value || 0);
  if (number < 1000) return String(number);
  if (number < 1_000_000) return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1).replace('.0', '')}K`;
  return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1).replace('.0', '')}M`;
}

function RankIcon({ rank }) {
  if (rank === 1) return <Crown size={18} />;
  if (rank === 2 || rank === 3) return <Medal size={18} />;
  return <span>#{rank}</span>;
}

export default function LiveTopSupportersDrawer({ open, onClose, sessionId = null, refreshKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profileTarget, setProfileTarget] = useState(null);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('droxion_live_top_supporters', { p_session_id: sessionId || null });
      if (rpcError) throw rpcError;
      setRows(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError?.message || 'Could not load Top Supporters.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [open, sessionId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setInterval(load, 12000);
    return () => window.clearInterval(timer);
  }, [open, load]);

  if (!open) return null;

  const topThree = rows.slice(0, 3);

  return (
    <>
      <div className="liveTopSupportersBackdrop" onClick={onClose}>
        <section className="liveTopSupportersDrawer" onClick={event => event.stopPropagation()} aria-label="LIVE Top Supporters">
          <header className="liveTopSupportersHeader">
            <div><Trophy size={20} /><div><strong>Top Supporters</strong><span>This LIVE · all gift coins</span></div></div>
            <button type="button" onClick={onClose} aria-label="Close Top Supporters"><X size={20} /></button>
          </header>

          {loading && rows.length === 0 ? (
            <div className="liveTopSupportersState">Loading ranking…</div>
          ) : error && rows.length === 0 ? (
            <div className="liveTopSupportersState isError">{error}</div>
          ) : rows.length === 0 ? (
            <div className="liveTopSupportersState">No gifts yet. Be the first supporter.</div>
          ) : (
            <>
              <div className="liveTopSupportersPodium">
                {topThree.map(row => {
                  const name = row.display_name || row.username || 'Supporter';
                  return (
                    <button type="button" key={row.supporter_id} className={`liveTopPodiumCard rank${row.rank_number}`} onClick={() => setProfileTarget(row)}>
                      <div className="liveTopPodiumRank"><RankIcon rank={Number(row.rank_number)} /></div>
                      <div className="liveTopPodiumAvatar">{row.avatar_url ? <img src={row.avatar_url} alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}</div>
                      <strong>{name}</strong>
                      <small>🪙 {compactNumber(row.total_coins)}</small>
                    </button>
                  );
                })}
              </div>

              <div className="liveTopSupportersList">
                {rows.map(row => {
                  const rank = Number(row.rank_number || 0);
                  const name = row.display_name || row.username || 'Supporter';
                  return (
                    <button type="button" key={`row-${row.supporter_id}`} className="liveTopSupporterRow" onClick={() => setProfileTarget(row)}>
                      <div className="liveTopSupporterRank"><RankIcon rank={rank} /></div>
                      <div className="liveTopSupporterAvatar">{row.avatar_url ? <img src={row.avatar_url} alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}</div>
                      <div className="liveTopSupporterCopy"><strong>{name}</strong>{row.username && <span>@{row.username}</span>}</div>
                      <div className="liveTopSupporterCoins"><strong>🪙 {compactNumber(row.total_coins)}</strong><span>{Number(row.gift_count || 0)} gifts</span></div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {error && rows.length > 0 && <div className="liveTopSupportersInlineError">{error}</div>}
        </section>
      </div>

      {profileTarget && (
        <LiveMiniProfileSheet
          userId={profileTarget.supporter_id}
          fallback={profileTarget}
          onClose={() => setProfileTarget(null)}
        />
      )}
    </>
  );
}
