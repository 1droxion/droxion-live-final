import { useEffect, useMemo, useState } from 'react';
import { Crown, Sparkles } from 'lucide-react';
import '../styles/live-supporter-spotlight.css';

function formatCoins(value) {
  const coins = Number(value || 0);
  if (coins >= 1000000) return `${(coins / 1000000).toFixed(coins >= 10000000 ? 0 : 1)}M`;
  if (coins >= 1000) return `${(coins / 1000).toFixed(coins >= 10000 ? 0 : 1)}K`;
  return String(coins);
}

function remainingLabel(spotlight, now) {
  if (spotlight.full_live) return 'FULL LIVE';
  const expires = Date.parse(spotlight.expires_at || '');
  if (!Number.isFinite(expires)) return '';
  const ms = Math.max(0, expires - now);
  const minutes = Math.ceil(ms / 60000);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export default function LiveSupporterSpotlight({ spotlights = [], onSelectUser }) {
  const [rotation, setRotation] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setRotation(value => value + 1), 7000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const active = useMemo(() => spotlights.filter(item => {
    if (item?.full_live) return true;
    const expires = Date.parse(item?.expires_at || '');
    return Number.isFinite(expires) && expires > now;
  }), [spotlights, now]);

  if (!active.length) return null;

  const count = Math.min(3, active.length);
  const start = rotation % active.length;
  const visible = Array.from({ length: count }, (_, offset) => active[(start + offset) % active.length]);
  const overflow = Math.max(0, active.length - visible.length);
  const galaxyActive = active.some(item => Number(item.highest_gift_coins || 0) >= 5000);

  return (
    <aside className="liveSupporterSpotlight" aria-label="LIVE supporters">
      <div className={`liveSupporterSpotlightTitle ${galaxyActive ? 'galaxy' : ''}`}>
        {galaxyActive ? <Sparkles size={14} /> : <Crown size={14} />}
        <span>{galaxyActive ? 'GALAXY WALL' : 'SUPPORTER SPOTLIGHT'}</span>
      </div>
      <div className="liveSupporterSpotlightRail">
        {visible.map((supporter, index) => {
          const name = supporter.display_name || supporter.username || 'Supporter';
          return (
            <button
              type="button"
              className={`liveSupporterChip ${supporter.full_live ? 'fullLive' : ''}`}
              key={`${supporter.supporter_id}:${supporter.latest_gift_at}:${index}`}
              onClick={() => onSelectUser?.(supporter)}
              aria-label={`Open ${name} profile`}
            >
              <div className="liveSupporterAvatar">
                {supporter.avatar_url ? <img src={supporter.avatar_url} alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="liveSupporterCopy">
                <strong>{name}</strong>
                <small>{supporter.latest_emoji || '🎁'} {formatCoins(supporter.total_coins)} coins · {remainingLabel(supporter, now)}</small>
              </div>
            </button>
          );
        })}
        {overflow > 0 && <div className="liveSupporterOverflow">+{overflow}</div>}
      </div>
    </aside>
  );
}
