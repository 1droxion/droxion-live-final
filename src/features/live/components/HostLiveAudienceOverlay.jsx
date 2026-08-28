import { useEffect, useRef, useState } from 'react';
import { subscribeLiveEvents, supabase } from '../../../supabaseClient';
import { getLiveUserColor } from '../utils/livePresentation';
import LiveGiftCinema from './LiveGiftCinema';
import LiveMiniProfileSheet from './LiveMiniProfileSheet';
import '../styles/host-live-audience-overlay.css';

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

export default function HostLiveAudienceOverlay({ sessionId }) {
  const [messages, setMessages] = useState([]);
  const [giftEvents, setGiftEvents] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const lastChatIdRef = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setGiftEvents([]);
      setSelectedProfile(null);
      lastChatIdRef.current = 0;
      return undefined;
    }

    let stopped = false;
    lastChatIdRef.current = 0;

    safeRpc('droxion_live_chat_messages', {
      p_session_id: sessionId,
      p_after_id: 0
    }).then(({ data, error }) => {
      if (stopped || error) return;
      const rows = Array.isArray(data) ? data : [];
      setMessages(mergeRows(rows));
      lastChatIdRef.current = rows.reduce((max, row) => Math.max(max, Number(row?.id || 0)), 0);
    }).catch(() => {});

    let unsubscribe = null;
    try {
      unsubscribe = subscribeLiveEvents(sessionId, event => {
        if (stopped || !event) return;

        if (event.type === 'chat' && event.row) {
          setMessages(current => mergeRows([...current, event.row]));
          lastChatIdRef.current = Math.max(lastChatIdRef.current, Number(event.row.id || 0));
        }

        if (event.type === 'gift' && event.row) {
          setGiftEvents(current => mergeRows([...current, event.row], 40));
        }
      });
    } catch {}

    const reconcile = window.setInterval(() => {
      safeRpc('droxion_live_chat_messages', {
        p_session_id: sessionId,
        p_after_id: lastChatIdRef.current
      }).then(({ data, error }) => {
        if (stopped || error || !Array.isArray(data) || data.length === 0) return;
        setMessages(current => mergeRows([...current, ...data]));
        lastChatIdRef.current = Math.max(lastChatIdRef.current, ...data.map(row => Number(row?.id || 0)));
      }).catch(() => {});
    }, 5000);

    return () => {
      stopped = true;
      window.clearInterval(reconcile);
      try { unsubscribe?.(); } catch {}
    };
  }, [sessionId]);

  const recentMessages = messages.slice(-6);

  return (
    <>
      <div className="hostLiveAudienceChat" aria-live="polite">
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
