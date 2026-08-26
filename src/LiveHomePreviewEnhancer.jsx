import { useEffect } from 'react';
import { supabase } from './supabaseClient';
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
    let touchStart = null;
    let hostRecoveryTimer = null;
    const recentlyOpened = new WeakMap();

    const decorate = () => {
      document.querySelectorAll('.liveOnlyHome .liveFeedCard').forEach(card => {
        removeLegacyPreview(card);
        addOrientationBadge(card);
      });
    };

    const cardFromEvent = event => event.target?.closest?.('.liveOnlyHome .liveFeedCard') || null;

    const onTouchStart = event => {
      const card = cardFromEvent(event);
      const touch = event.touches?.[0];
      if (!card || !touch) { touchStart = null; return; }
      touchStart = { card, x: touch.clientX, y: touch.clientY };
    };

    const onTouchMove = event => {
      if (!touchStart?.card || !touchStart.card.isConnected) return;
      // Do not let the Home pull-to-refresh gesture swallow taps on LIVE cards.
      // We do not preventDefault, so normal vertical scrolling still works.
      event.stopPropagation();
    };

    const onTouchEnd = event => {
      const start = touchStart;
      touchStart = null;
      const touch = event.changedTouches?.[0];
      if (!start?.card || !touch || !start.card.isConnected) return;
      const distance = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
      if (distance > 18) return;

      recentlyOpened.set(start.card, Date.now());
      event.preventDefault();
      event.stopPropagation();
      queueMicrotask(() => start.card?.click?.());
    };

    const onClickCapture = event => {
      const card = cardFromEvent(event);
      if (!card || !event.isTrusted) return;
      const openedAt = recentlyOpened.get(card) || 0;
      if (Date.now() - openedAt > 700) return;
      recentlyOpened.delete(card);
      event.preventDefault();
      event.stopPropagation();
    };

    const recoverHostAfterStart = () => {
      window.clearTimeout(hostRecoveryTimer);
      hostRecoveryTimer = window.setTimeout(async () => {
        // A successful start writes the LIVE session before the UI transitions.
        // If an older/stale React state update leaves the setup sheet on screen,
        // reload once. Startup hydration then restores the active host session.
        if (!document.querySelector('.liveSetupOverlay')) return;
        try {
          const { data } = await supabase.rpc('droxion_live_status');
          if (data?.is_live && data?.session_id) window.location.reload();
        } catch {}
      }, 2200);
    };

    const onStartLiveClick = event => {
      if (!event.target?.closest?.('.liveStartButton')) return;
      recoverHostAfterStart();
    };

    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('touchstart', onTouchStart, true);
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: true });
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('click', onStartLiveClick, true);

    return () => {
      window.clearTimeout(hostRecoveryTimer);
      observer.disconnect();
      document.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('touchmove', onTouchMove, true);
      document.removeEventListener('touchend', onTouchEnd, true);
      document.removeEventListener('click', onClickCapture, true);
      document.removeEventListener('click', onStartLiveClick, true);
    };
  }, [enabled]);

  return null;
}