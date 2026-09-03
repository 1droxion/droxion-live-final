import { useEffect, useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import '../styles/live-floating-hearts.css';

const HEART_COLORS = ['#ff3b81', '#ff5ea8', '#a855f7', '#7c3aed', '#22d3ee', '#38bdf8', '#f97316', '#facc15'];
const MAX_VISIBLE = 28;
let heartSequence = 0;

function buildHeart(index = 0) {
  heartSequence += 1;
  const seed = heartSequence + index * 17;
  return {
    id: `heart-${Date.now()}-${heartSequence}`,
    color: HEART_COLORS[seed % HEART_COLORS.length],
    x: 4 + ((seed * 19) % 72),
    drift: -30 + ((seed * 23) % 61),
    size: 18 + ((seed * 11) % 19),
    delay: (seed % 5) * 24,
    duration: 1700 + ((seed * 31) % 850),
    rotate: -18 + ((seed * 13) % 37)
  };
}

export default function LiveFloatingHearts({ burstSignal = 0, burstCount = 1, onTap }) {
  const [hearts, setHearts] = useState([]);
  const count = useMemo(() => Math.max(1, Math.min(8, Number(burstCount) || 1)), [burstCount]);

  useEffect(() => {
    if (!burstSignal) return undefined;
    const next = Array.from({ length: count }, (_, index) => buildHeart(index));
    setHearts(current => [...current, ...next].slice(-MAX_VISIBLE));

    const timer = window.setTimeout(() => {
      const ids = new Set(next.map(item => item.id));
      setHearts(current => current.filter(item => !ids.has(item.id)));
    }, 2900);

    return () => window.clearTimeout(timer);
  }, [burstSignal, count]);

  return (
    <>
      <div className="liveFloatingHeartsLayer" aria-hidden="true">
        {hearts.map(heart => (
          <Heart
            key={heart.id}
            className="liveFloatingHeart"
            fill="currentColor"
            strokeWidth={1.5}
            style={{
              '--heart-color': heart.color,
              '--heart-x': `${heart.x}%`,
              '--heart-drift': `${heart.drift}px`,
              '--heart-size': `${heart.size}px`,
              '--heart-delay': `${heart.delay}ms`,
              '--heart-duration': `${heart.duration}ms`,
              '--heart-rotate': `${heart.rotate}deg`
            }}
          />
        ))}
      </div>

      <button type="button" className="liveHeartTapButton" onClick={onTap} aria-label="Send heart reaction">
        <Heart size={21} fill="currentColor" />
      </button>
    </>
  );
}
