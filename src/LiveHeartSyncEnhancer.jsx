import { useEffect } from 'react';
import { supabase } from './supabaseClient';
import './live-heart-sync.css';

const HEART_COLORS = ['#ff3b81', '#ff5ea8', '#a855f7', '#7c3aed', '#22d3ee', '#38bdf8', '#f97316', '#facc15'];
const HEART_POSITION_KEY = 'droxion.liveHeartPosition.v1';
const DEFAULT_POSITION = { x: 0.88, y: 0.72 };

function normalizePosition(value) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  return {
    x: Number.isFinite(x) ? Math.min(0.94, Math.max(0.06, x)) : DEFAULT_POSITION.x,
    y: Number.isFinite(y) ? Math.min(0.9, Math.max(0.1, y)) : DEFAULT_POSITION.y
  };
}

function readSavedPosition() {
  try {
    return normalizePosition(JSON.parse(window.localStorage.getItem(HEART_POSITION_KEY) || 'null'));
  } catch {
    return { ...DEFAULT_POSITION };
  }
}

function savePosition(position) {
  try { window.localStorage.setItem(HEART_POSITION_KEY, JSON.stringify(normalizePosition(position))); } catch {}
}

function liveSurface() {
  const host = document.querySelector('.prodLiveHost.isMinimalLive .prodLiveStage, .prodLiveHost .prodLiveStage');
  const viewer = document.querySelector('.productionViewerPage');
  return { host, viewer };
}

function applyHeartPosition(stage, position) {
  if (!(stage instanceof HTMLElement)) return;
  const next = normalizePosition(position);
  stage.style.setProperty('--sync-heart-origin-x', `${next.x * 100}%`);
  stage.style.setProperty('--sync-heart-origin-y', `${next.y * 100}%`);
}

function makeHeart(stage, seed = Date.now()) {
  if (!(stage instanceof HTMLElement)) return;
  const heart = document.createElement('span');
  heart.className = 'droxionSyncedHeart';
  heart.textContent = '♥';
  heart.style.setProperty('--sync-heart-color', HEART_COLORS[Math.abs(seed) % HEART_COLORS.length]);
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
    let hostHandle = null;
    let hostPosition = readSavedPosition();
    let sharedPosition = { ...DEFAULT_POSITION };
    let dragState = null;
    let lastPositionBroadcastAt = 0;

    const removeHostHandle = () => {
      if (hostHandle) {
        hostHandle.remove();
        hostHandle = null;
      }
      dragState = null;
    };

    const updateHandlePosition = position => {
      if (!(hostHandle instanceof HTMLElement)) return;
      const next = normalizePosition(position);
      hostHandle.style.left = `${next.x * 100}%`;
      hostHandle.style.top = `${next.y * 100}%`;
    };

    const broadcastHostPosition = force => {
      const { host } = liveSurface();
      if (!host || !channel || !activeSessionId) return;
      const now = Date.now();
      if (!force && now - lastPositionBroadcastAt < 9000) return;
      lastPositionBroadcastAt = now;
      try {
        Promise.resolve(channel.send({
          type: 'broadcast',
          event: 'heart_position',
          payload: {
            session_id: activeSessionId,
            position: hostPosition,
            sent_at: new Date().toISOString()
          }
        })).catch(() => {});
      } catch {}
    };

    const finishDrag = event => {
      if (!dragState || (event?.pointerId != null && dragState.pointerId !== event.pointerId)) return;
      const pointerId = dragState.pointerId;
      dragState = null;
      try { hostHandle?.releasePointerCapture?.(pointerId); } catch {}
      savePosition(hostPosition);
      broadcastHostPosition(true);
    };

    const moveDrag = event => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      event.preventDefault();
      const rect = dragState.rect;
      if (!rect?.width || !rect?.height) return;
      hostPosition = normalizePosition({
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height
      });
      const { host } = liveSurface();
      applyHeartPosition(host, hostPosition);
      updateHandlePosition(hostPosition);
    };

    const beginDrag = event => {
      const { host } = liveSurface();
      if (!host || event.button > 0) return;
      event.preventDefault();
      event.stopPropagation();
      dragState = { pointerId: event.pointerId, rect: host.getBoundingClientRect() };
      try { hostHandle?.setPointerCapture?.(event.pointerId); } catch {}
    };

    const ensureHostHandle = host => {
      if (!(host instanceof HTMLElement)) {
        removeHostHandle();
        return;
      }
      applyHeartPosition(host, hostPosition);
      if (hostHandle?.isConnected && host.contains(hostHandle)) {
        updateHandlePosition(hostPosition);
        return;
      }

      removeHostHandle();
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'droxionHeartPositionHandle';
      handle.setAttribute('aria-label', 'Drag to position LIVE heart reactions');
      handle.setAttribute('title', 'Drag to move heart reactions');
      handle.innerHTML = '<span>♥</span><small>drag</small>';
      handle.addEventListener('pointerdown', beginDrag);
      handle.addEventListener('pointermove', moveDrag);
      handle.addEventListener('pointerup', finishDrag);
      handle.addEventListener('pointercancel', finishDrag);
      host.appendChild(handle);
      hostHandle = handle;
      updateHandlePosition(hostPosition);
    };

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
        applyHeartPosition(target, host ? hostPosition : sharedPosition);
        burstHearts(target, payload?.count || 2, Number(payload?.seed || Date.now()));
      });
      next.on('broadcast', { event: 'heart_position' }, ({ payload }) => {
        if (stopped || String(payload?.session_id || '') !== activeSessionId) return;
        sharedPosition = normalizePosition(payload?.position);
        const { host, viewer } = liveSurface();
        if (viewer) applyHeartPosition(viewer, sharedPosition);
        if (host) applyHeartPosition(host, hostPosition);
      });
      next.subscribe(status => {
        if (status === 'SUBSCRIBED') broadcastHostPosition(true);
      });
      channel = next;
    };

    const resolveContext = async force => {
      const { host, viewer } = liveSurface();
      if (!host && !viewer) {
        injectedButton?.remove();
        injectedButton = null;
        removeHostHandle();
        removeChannel();
        return;
      }

      if (host) ensureHostHandle(host);
      else removeHostHandle();
      if (viewer) {
        ensureViewerButton(viewer);
        applyHeartPosition(viewer, sharedPosition);
      }

      const now = Date.now();
      if (resolving || (!force && now - lastResolveAt < 1500)) {
        if (host) broadcastHostPosition(false);
        return;
      }
      resolving = true;
      lastResolveAt = now;
      try {
        const { data, error } = await supabase.rpc('droxion_current_live_context');
        if (stopped || error || !data?.active || !data?.session_id) return;
        subscribe(data.session_id);
        if (host) broadcastHostPosition(false);
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
      applyHeartPosition(viewer, sharedPosition);
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
      removeHostHandle();
      removeChannel();
      document.querySelectorAll('.droxionSyncedHeart').forEach(node => node.remove());
    };
  }, []);

  return null;
}
