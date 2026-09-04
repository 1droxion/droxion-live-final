import { useEffect } from 'react';
import { supabase } from './supabaseClient';
import './live-heart-sync.css';

const HEART_COLORS = ['#ff3b81', '#ff5ea8', '#a855f7', '#7c3aed', '#22d3ee', '#38bdf8', '#f97316', '#facc15'];

function liveSurface() {
  const host = document.querySelector('.prodLiveHost.isMinimalLive .prodLiveStage, .prodLiveHost .prodLiveStage');
  const viewer = document.querySelector('.productionViewerPage');
  return { host, viewer };
}

function makeHeart(stage, seed = Date.now()) {
  if (!(stage instanceof HTMLElement)) return;
  const heart = document.createElement('span');
  heart.className = 'droxionSyncedHeart';
  heart.textContent = '♥';
  heart.style.setProperty('--sync-heart-color', HEART_COLORS[Math.abs(seed) % HEART_COLORS.length]);
  heart.style.setProperty('--sync-heart-x', `${8 + (Math.abs(seed * 17) % 68)}%`);
  heart.style.setProperty('--sync-heart-drift', `${-34 + (Math.abs(seed * 13) % 69)}px`);
  heart.style.setProperty('--sync-heart-size', `${20 + (Math.abs(seed * 7) % 18)}px`);
  stage.appendChild(heart);
  window.setTimeout(() => heart.remove(), 2600);
}

function burstHearts(stage, count = 3, seed = Date.now()) {
  const safeCount = Math.max(1, Math.min(8, Number(count) || 1));
  for (let index = 0; index < safeCount; index += 1) {
    window.setTimeout(() => makeHeart(stage, seed + index * 31), index * 45);
  }
}

export default function LiveHeartSyncEnhancer() {
  useEffect(() => {
    let stopped = false;
    let activeSessionId = '';
    let channel = null;
    let resolving = false;
    let lastResolveAt = 0;
    let injectedButton = null;

    const removeChannel = () => {
      const old = channel;
      channel = null;
      activeSessionId = '';
      if (old) {
        try { Promise.resolve(supabase.removeChannel(old)).catch(() => {}); } catch {}
      }
    };

    const ensureViewerButton = viewer => {
      if (!(viewer instanceof HTMLElement)) return;
      const composer = viewer.querySelector('.productionViewerComposer');
      if (!(composer instanceof HTMLElement)) return;

      const existing = composer.querySelector('.productionViewerHeartSyncButton');
      if (existing) {
        if (injectedButton && injectedButton !== existing) injectedButton.remove();
        injectedButton = existing;
        return;
      }

      if (injectedButton && !composer.contains(injectedButton)) {
        injectedButton.remove();
        injectedButton = null;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'productionViewerHeartSyncButton';
      button.setAttribute('aria-label', 'Send heart reaction');
      button.textContent = '♥';

      const giftButton = composer.querySelector('.productionViewerGiftButton');
      if (giftButton) composer.insertBefore(button, giftButton);
      else composer.appendChild(button);
      injectedButton = button;
    };

    const subscribe = sessionId => {
      if (!sessionId || stopped || sessionId === activeSessionId) return;
      removeChannel();
      activeSessionId = String(sessionId);

      const next = supabase.channel(`droxion-live-hearts:${activeSessionId}`, {
        config: { broadcast: { self: true } }
      });
      next.on('broadcast', { event: 'heart' }, ({ payload }) => {
        if (stopped || String(payload?.session_id || '') !== activeSessionId) return;
        const { host, viewer } = liveSurface();
        const target = host || viewer;
        if (!target) return;
        burstHearts(target, payload?.count || 2, Number(payload?.seed || Date.now()));
      });
      next.subscribe();
      channel = next;
    };

    const resolveContext = async force => {
      const { host, viewer } = liveSurface();
      if (!host && !viewer) {
        injectedButton?.remove();
        injectedButton = null;
        removeChannel();
        return;
      }

      if (viewer) ensureViewerButton(viewer);

      const now = Date.now();
      if (resolving || (!force && now - lastResolveAt < 1500)) return;
      resolving = true;
      lastResolveAt = now;
      try {
        const { data, error } = await supabase.rpc('droxion_current_live_context');
        if (stopped || error || !data?.active || !data?.session_id) return;
        subscribe(data.session_id);
      } catch {
        // Heart reactions are optional UI and must never affect LIVE video.
      } finally {
        resolving = false;
      }
    };

    const sendHeart = () => {
      const { viewer } = liveSurface();
      if (!viewer || !activeSessionId) {
        resolveContext(true).catch(() => {});
        return;
      }

      const seed = Date.now() + Math.floor(Math.random() * 1000);
      burstHearts(viewer, 2, seed);
      try {
        Promise.resolve(channel?.send({
          type: 'broadcast',
          event: 'heart',
          payload: {
            session_id: activeSessionId,
            count: 3,
            seed,
            sent_at: new Date().toISOString()
          }
        })).catch(() => {});
      } catch {}
    };

    const clickHandler = event => {
      const button = event.target?.closest?.('.productionViewerHeartSyncButton, .liveHeartTapButton');
      if (!button || !document.querySelector('.productionViewerPage')) return;
      if (button.classList.contains('liveHeartTapButton') && !button.closest('.productionViewerComposer')) return;
      sendHeart();
    };

    document.addEventListener('click', clickHandler, true);
    const observer = new MutationObserver(() => resolveContext(false).catch(() => {}));
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(() => resolveContext(false).catch(() => {}), 1400);
    resolveContext(true).catch(() => {});

    return () => {
      stopped = true;
      document.removeEventListener('click', clickHandler, true);
      observer.disconnect();
      window.clearInterval(timer);
      injectedButton?.remove();
      removeChannel();
      document.querySelectorAll('.droxionSyncedHeart').forEach(node => node.remove());
    };
  }, []);

  return null;
}
