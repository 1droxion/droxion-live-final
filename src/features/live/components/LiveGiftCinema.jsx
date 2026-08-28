import { useEffect, useMemo, useState } from 'react';
import { getGiftPresentation, getLiveUserColor } from '../utils/livePresentation';
import { playGiftSound, unlockGiftSound } from '../utils/giftSoundEngine';
import GiftSignatureScene from './GiftSignatureScene';
import '../styles/live-gift-cinema.css';

const PARTICLE_COUNT = 28;

export default function LiveGiftCinema({ giftEvents = [] }) {
  const [activeGift, setActiveGift] = useState(null);

  useEffect(() => {
    const unlock = () => { unlockGiftSound().catch(() => {}); };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const latest = giftEvents[giftEvents.length - 1];
    if (!latest) return undefined;

    const presentation = getGiftPresentation(latest);
    const animationKey = `${latest.id || latest.created_at || Date.now()}:${Math.random()}`;
    setActiveGift({ ...latest, ...presentation, animationKey });
    playGiftSound(latest, presentation).catch(() => {});

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
  const cost = Number(activeGift.cost_coins || 0);
  const hasSignatureScene = ['dragon_fire', 'galaxy_blast', 'universe_expand', 'royalty_reveal'].includes(activeGift.scene);
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
                : code.includes('dragon') || name.includes('dragon')
                  ? 'dragon'
                  : code.includes('rocket') || name.includes('rocket')
                    ? 'rocket'
                    : 'gift';

  return (
    <div
      className={`liveGiftCinemaLayer ${activeGift.tier} ${giftClass} ${hasSignatureScene ? 'hasSignatureScene' : ''}`}
      key={activeGift.animationKey}
      aria-hidden="true"
    >
      <div className="liveGiftCinemaVignette" />
      <div className="liveGiftCinemaBackdrop" />
      <div className="liveGiftCinemaBeam beamA" />
      <div className="liveGiftCinemaBeam beamB" />
      <div className="liveGiftCinemaHalo" />
      <div className="liveGiftCinemaRing ringA" />
      <div className="liveGiftCinemaRing ringB" />
      <div className="liveGiftCinemaSweep" />

      {hasSignatureScene && <GiftSignatureScene scene={activeGift.scene} />}

      {!hasSignatureScene && (
        <div className="liveGiftCinemaParticles">
          {particles.map(index => (
            <span
              key={index}
              style={{
                '--gift-particle-index': index,
                '--gift-particle-delay': `${(index % 14) * 48}ms`,
                '--gift-particle-x': `${3 + ((index * 37) % 94)}%`,
                '--gift-particle-size': `${0.72 + ((index * 17) % 10) / 16}`
              }}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}

      <div className={`liveGiftCinemaHero ${hasSignatureScene ? 'signatureHero' : ''}`}>
        <div className="liveGiftCinemaTierLabel">{activeGift.tier}</div>
        <div className="liveGiftCinemaHeroEmoji">{emoji}</div>
        <div className="liveGiftCinemaText">
          <strong style={{ color: senderColor }}>{sender}</strong>
          <span className="liveGiftCinemaVerb">sent</span>
          <b>{activeGift.gift_name || 'a gift'}</b>
          {cost > 0 && <small>🪙 {cost.toLocaleString()}</small>}
        </div>
      </div>

      {(activeGift.tier === 'elite' || activeGift.tier === 'legendary') && (
        <div className="liveGiftCinemaSignature">
          <span>{activeGift.tier === 'legendary' ? 'DROXION LEGENDARY MOMENT' : 'DROXION ELITE GIFT'}</span>
        </div>
      )}
    </div>
  );
}
