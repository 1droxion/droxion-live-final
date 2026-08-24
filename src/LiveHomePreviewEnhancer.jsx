import { useEffect } from 'react';
import './live-home-preview.css';

function addOrientationBadge(card) {
  if (!card || card.querySelector('.liveOrientationBadge')) return;
  const badge = document.createElement('span');
  badge.className = 'liveOrientationBadge';
  badge.setAttribute('aria-hidden', 'true');
  const horizontal = card.classList.contains('horizontal');
  badge.innerHTML = horizontal
    ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>';
  card.appendChild(badge);
}

function removeLegacyPreview(card) {
  card?.querySelectorAll?.('.liveHomePreviewVideo').forEach(video => {
    try { video.pause?.(); } catch {}
    try { video.srcObject = null; } catch {}
    video.remove();
  });
  card?.classList?.remove('liveHomePreviewActive');
}

export default function LiveHomePreviewEnhancer({ enabled = true }) {
  useEffect(() => {
    if (!enabled) return undefined;

    const decorate = () => {
      document.querySelectorAll('.liveOnlyHome .liveFeedCard').forEach(card => {
        // The old home-preview layer used the retired peer-to-peer signalling
        // transport while the real LIVE room uses LiveKit. It could cover a
        // healthy card with a permanently black video. Keep cards stable and
        // enter the full LiveKit room only after the viewer taps one.
        removeLegacyPreview(card);
        addOrientationBadge(card);
      });
    };

    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled]);

  return null;
}
