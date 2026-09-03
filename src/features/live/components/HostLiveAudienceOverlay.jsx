import { useEffect, useRef, useState } from 'react';
import { subscribeLiveEvents, supabase } from '../../../supabaseClient';
import { getLiveUserColor } from '../utils/livePresentation';
import LiveGiftCinema from './LiveGiftCinema';
import LiveMiniProfileSheet from './LiveMiniProfileSheet';
import '../styles/host-live-audience-overlay.css';

const HUD_STORAGE_KEY = 'droxion.live.hostHud.v1';
const DEFAULT_HUD = Object.freeze({
  chat: { x: 0.03, y: 0.62 },
  gift: { x: 0.67, y: 0.18 }
});

function safeRpc(name, args) {
  return Promise.resolve(supabase.rpc(name, args));
}

function mergeRows(rows, limit = 120) {
  const map = new Map();
  for (const row of rows || []) {
    const key = String(row?.id ?? `${row?.created_at || ''}:${row?.body || row?.gift_name || ''}`);
    map.set(key, row);
  }
  return Array.from(map.values())
    .sort((a, b) => String(a?.created_at || '').localeCompare(String(b?.created_at || '')))
    .slice(-limit);
}

function readHudPositions() {
  if (typeof window === 'undefined') return DEFAULT_HUD;
  try {
    const saved = JSON.parse(window.localStorage.getItem(HUD_STORAGE_KEY) || '{}');
    return {
      chat: {
        x: Number.isFinite(Number(saved?.chat?.x)) ? Number(saved.chat.x) : DEFAULT_HUD.chat.x,
        y: Number.isFinite(Number(saved?.chat?.y)) ? Number(saved.chat.y) : DEFAULT_HUD.chat.y
      },
      gift: {
        x: Number.isFinite(Number(saved?.gift?.x)) ? Number(saved.gift.x) : DEFAULT_HUD.gift.x,
        y: Number.isFinite(Number(saved?.gift?.y)) ? Number(saved.gift.y) : DEFAULT_HUD.gift.y
      }
    };
  } catch {
    return DEFAULT_HUD;
  }
}

function giftCursor(value) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) return '1970-01-01T00:00:00.000Z';
  return new Date(Math.max(0, parsed - 1000)).toISOString();
}

export default function HostLiveAudienceOverlay({ sessionId }) {
  const [messages, setMessages] = useState([]);
  const [giftEvents, setGiftEvents] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [hud, setHud] = useState(readHudPositions);
  const lastChatIdRef = useRef(0);
  const lastGiftAtRef = useRef('');
  const dragRef = useRef(null);
  const chatRef = useRef(null);
  const giftRef = useRef(null);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setGiftEvents([]);
      setSelectedProfile(null);
      lastChatIdRef.current = 0;
      lastGiftAtRef.current = '';
      return undefined;
    }

    let stopped = false;
    lastChatIdRef.current = 0;
    lastGiftAtRef.current = '';

    const mergeChats = rows => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      setMessages(current => mergeRows([...current, ...rows]));
      lastChatIdRef.current = Math.max(lastChatIdRef.current, ...rows.map(row => Number(row?.id || 0)));
    };

    const mergeGifts = rows => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      setGiftEvents(current => mergeRows([...current, ...rows], 40));
      for (const row of rows) {
        if (String(row?.created_at || '') > String(lastGiftAtRef.current || '')) lastGiftAtRef.current = row.created_at;
      }
    };

    Promise.all([
      safeRpc('droxion_live_chat_messages', { p_session_id: sessionId, p_after_id: 0 }),
      safeRpc('droxion_live_gift_events', { p_session_id: sessionId, p_after: '1970-01-01T00:00:00.000Z' })
    ]).then(([chatResult, giftResult]) => {
      if (stopped) return;
      if (!chatResult?.error) mergeChats(chatResult?.data || []);
      if (!giftResult?.error) mergeGifts(giftResult?.data || []);
    }).catch(() => {});

    let unsubscribe = null;
    try {
      unsubscribe = subscribeLiveEvents(sessionId, event => {
        if (stopped || !event) return;

        if (event.type === 'chat' && event.row) mergeChats([event.row]);
        if (event.type === 'gift' && event.row) mergeGifts([event.row]);
      });
    } catch {}

    const reconcile = window.setInterval(() => {
      Promise.all([
        safeRpc('droxion_live_chat_messages', {
          p_session_id: sessionId,
          p_after_id: lastChatIdRef.current
        }),
        safeRpc('droxion_live_gift_events', {
          p_session_id: sessionId,
          p_after: giftCursor(lastGiftAtRef.current)
        })
      ]).then(([chatResult, giftResult]) => {
        if (stopped) return;
        if (!chatResult?.error) mergeChats(chatResult?.data || []);
        if (!giftResult?.error) mergeGifts(giftResult?.data || []);
      }).catch(() => {});
    }, 4000);

    return () => {
      stopped = true;
      window.clearInterval(reconcile);
      try { unsubscribe?.(); } catch {}
    };
  }, [sessionId]);

  function beginHudDrag(kind, event) {
    const box = kind === 'chat' ? chatRef.current : giftRef.current;
    const stage = box?.closest?.('.prodLiveStage');
    if (!box || !stage) return;
    event.preventDefault();
    event.stopPropagation();
    const stageRect = stage.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    dragRef.current = {
      kind,
      pointerId: event.pointerId,
      stageRect,
      width: boxRect.width,
      height: boxRect.height,
      offsetX: event.clientX - boxRect.left,
      offsetY: event.clientY - boxRect.top
    };
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch {}
  }

  function moveHud(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const maxX = Math.max(0, 1 - drag.width / drag.stageRect.width);
    const maxY = Math.max(0, 1 - drag.height / drag.stageRect.height);
    const x = Math.min(maxX, Math.max(0, (event.clientX - drag.stageRect.left - drag.offsetX) / drag.stageRect.width));
    const y = Math.min(maxY, Math.max(0, (event.clientY - drag.stageRect.top - drag.offsetY) / drag.stageRect.height));
    setHud(current => ({ ...current, [drag.kind]: { x, y } }));
  }

  function endHudDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setHud(current => {
      try { window.localStorage.setItem(HUD_STORAGE_KEY, JSON.stringify(current)); } catch {}
      return current;
    });
  }

  const recentMessages = messages.slice(-6);
  const latestGift = giftEvents[giftEvents.length - 1] || null;
  const giftSender = latestGift?.display_name || latestGift?.sender_name || 'Viewer';
  const giftSenderId = latestGift?.sender_id || latestGift?.user_id || '';
  const giftColor = getLiveUserColor(giftSenderId, giftSender);

  return (
    <>
      <div
        ref={chatRef}
        className="hostLiveAudienceChat hostLiveHudPositioned"
        style={{ '--host-hud-x': `${hud.chat.x * 100}%`, '--host-hud-y': `${hud.chat.y * 100}%` }}
        aria-live="polite"
      >
        <button
          type="button"
          className="hostLiveHudHandle"
          onPointerDown={event => beginHudDrag('chat', event)}
          onPointerMove={moveHud}
          onPointerUp={endHudDrag}
          onPointerCancel={endHudDrag}
          aria-label="Drag chat box"
        >
          <span>LIVE CHAT</span><small>Drag anywhere</small>
        </button>
        <div className="hostLiveAudienceChatBody">
          {recentMessages.length === 0 ? (
            <div className="hostLiveAudienceHint">Viewer messages will appear here</div>
          ) : recentMessages.map(message => {
            const name = message.display_name || message.sender_name || 'Viewer';
            const userId = message.sender_id || message.user_id || '';
            const color = getLiveUserColor(userId, name);
            return (
              <div className="hostLiveAudienceLine" key={message.id || `${message.created_at}:${message.body}`}>
                {userId ? (
                  <button
                    type="button"
                    className="hostLiveAudienceProfileLink"
                    style={{ color }}
                    onClick={() => setSelectedProfile({ user_id: userId, ...message })}
                  >
                    {name}
                  </button>
                ) : <strong style={{ color }}>{name}</strong>}
                <span>{message.body}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        ref={giftRef}
        className="hostLiveGiftHud hostLiveHudPositioned"
        style={{ '--host-hud-x': `${hud.gift.x * 100}%`, '--host-hud-y': `${hud.gift.y * 100}%` }}
        aria-live="polite"
      >
        <button
          type="button"
          className="hostLiveHudHandle"
          onPointerDown={event => beginHudDrag('gift', event)}
          onPointerMove={moveHud}
          onPointerUp={endHudDrag}
          onPointerCancel={endHudDrag}
          aria-label="Drag gift alert box"
        >
          <span>GIFTS</span><small>Drag anywhere</small>
        </button>
        <div className="hostLiveGiftHudBody">
          {latestGift ? (
            <>
              <b>{latestGift.emoji || '🎁'}</b>
              <div>
                <strong style={{ color: giftColor }}>{giftSender}</strong>
                <span>sent {latestGift.gift_name || 'a gift'}</span>
                {Number(latestGift.cost_coins || 0) > 0 && <small>🪙 {Number(latestGift.cost_coins).toLocaleString()}</small>}
              </div>
            </>
          ) : (
            <span className="hostLiveGiftHint">Gift alerts will appear here</span>
          )}
        </div>
      </div>

      <LiveGiftCinema giftEvents={giftEvents} />

      {selectedProfile?.user_id && (
        <LiveMiniProfileSheet
          userId={selectedProfile.user_id}
          fallback={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </>
  );
}
