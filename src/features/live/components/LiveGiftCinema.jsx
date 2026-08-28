import { useEffect, useMemo, useState } from 'react';
import { getGiftPresentation, getLiveUserColor } from '../utils/livePresentation';
import '../styles/live-gift-cinema.css';

const PARTICLE_COUNT = 20;

export default function LiveGiftCinema({ giftEvents = [] }) {
  const [activeGift, setActiveGift] = useState(null);

  useEffect(() => {
    const latest = giftEvents[giftEvents.length - 1];
    if (!latest) return undefined;

    const presentation = getGiftPresentation(latest);
    const animationKey = `${latest.id || latest.created_at || Date.now()}:${Math.random()}`;
    setActiveGift({ ...latest, ...presentation, animationKey });

    const timer = window.setTimeout(() => setActiveGift(null), presentation.duration);
    return () => window.clearTimeout(timer);
  }, [giftEvents]);

  const particles = useMemo(() => Array.from({ length: PARTICLE_COUNT }, (_, index) => index), []);

  if (!activeGift) return null;

  const emoji = activeGift.emoji || '🎁';
  const sender = activeGift.display_name || activeGift.sender_name || 'Viewer';
  const senderColor = getLiveUserColor(activeGift.sender_id || activeGift.user_id, sender);
  const code = String(activeGift.gift_code || '').toLowerCase();
  const name = String(activeGift.gift_name || '').toLowerCase();
  const giftClass = code === 'rose' || name.includes('rose')
    ? 'rose'
    : code === 'heart' || name.includes('heart')
      ? 'heart'
      : code === 'star' || name.includes('star')
        ? 'star'
        : code === 'crown' || name.includes('crown')
          ? 'crown'
          : code === 'droxion_galaxy' || name.includes('galaxy')
            ? 'galaxy'
            : code === 'droxion_universe' || name.includes('universe')
              ? 'universe'
              : code === 'droxion_royalty' || name.includes('royalty')
                ? 'royalty'
                : 'gift';

  return (
    <div
      className={`liveGiftCinemaLayer ${activeGift.tier} ${giftClass}`}
      key={activeGift.animationKey}
      aria-hidden="true"
    >
      <div className="liveGiftCinemaBackdrop" />
      <div className="liveGiftCinemaHalo" />
      <div className="liveGiftCinemaSweep" />

      <div className="liveGiftCinemaParticles">
        {particles.map(index => (
          <span
            key={index}
            style={{
              '--gift-particle-index': index,
              '--gift-particle-delay': `${(index % 10) * 60}ms`,
              '--gift-particle-x': `${5 + ((index * 37) % 90)}%`
            }}
          >
            {emoji}
          </span>
        ))}
      </div>

      <div className="liveGiftCinemaHero">
        <div className="liveGiftCinemaHeroEmoji">{emoji}</div>
        <div className="liveGiftCinemaText">
          <strong style={{ color: senderColor }}>{sender}</strong>
          <span>sent {activeGift.gift_name || 'a gift'}</span>
        </div>
      </div>
    </div>
  );
}
