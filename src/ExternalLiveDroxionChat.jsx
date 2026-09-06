import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Gift, MessageCircle, Send, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import './external-live-droxion-chat.css';

const DROXION_POLL_MS = 3500;
const SOURCE_LIMIT = 180;
const CHAT_LIMIT = 1000;
const CHAT_CACHE_PREFIX = 'droxion.live.chat.v2:';

function streamKey(stream) {
  const provider = String(stream?.provider || 'live').toLowerCase();
  const external = String(stream?.externalId || stream?.channelSlug || stream?.channelId || stream?.id || '').trim();
  return `${provider}:${external}`.slice(0, 220);
}

function mergeRows(current, incoming, keyOf, limit = CHAT_LIMIT) {
  const map = new Map();
  for (const row of current || []) {
    const key = keyOf(row);
    if (key) map.set(key, row);
  }
  for (const row of incoming || []) {
    const key = keyOf(row);
    if (!key) continue;
    map.set(key, map.has(key) ? { ...map.get(key), ...row } : row);
  }
  return [...map.values()].sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0)).slice(-limit);
}

function readCachedMessages(key) {
  if (!key || typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(`${CHAT_CACHE_PREFIX}${key}`) || '[]');
    return Array.isArray(value) ? value.filter(row => row && Number(row.id || 0) > 0).slice(-CHAT_LIMIT) : [];
  } catch {
    return [];
  }
}

function writeCachedMessages(key, rows) {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${CHAT_CACHE_PREFIX}${key}`, JSON.stringify((rows || []).slice(-CHAT_LIMIT)));
  } catch {}
}

function toMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function providerLabel(provider) {
  if (provider === 'youtube') return 'YouTube';
  if (provider === 'twitch') return 'Twitch';
  if (provider === 'kick') return 'Kick';
  return 'Source';
}

function providerClass(provider) {
  if (provider === 'youtube') return 'youtube';
  if (provider === 'twitch') return 'twitch';
  if (provider === 'kick') return 'kick';
  return 'droxion';
}

function unescapeIrcTag(value = '') {
  return String(value).replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}

function parseTwitchLine(line, sequence) {
  if (!line.includes(' PRIVMSG ')) return null;
  const tags = {};
  let rest = line;
  if (rest.startsWith('@')) {
    const space = rest.indexOf(' ');
    rest.slice(1, space).split(';').forEach(pair => {
      const index = pair.indexOf('=');
      tags[index >= 0 ? pair.slice(0, index) : pair] = unescapeIrcTag(index >= 0 ? pair.slice(index + 1) : '');
    });
    rest = rest.slice(space + 1);
  }
  const match = rest.match(/^:([^! ]+)!.* PRIVMSG #[^ ]+ :(.*)$/);
  if (!match) return null;
  const publishedAt = Number(tags['tmi-sent-ts'] || 0) || Date.now();
  return {
    id: tags.id || `twitch-${publishedAt}-${sequence}`,
    provider: 'twitch',
    authorName: tags['display-name'] || match[1],
    avatarUrl: '',
    message: match[2],
    publishedAt,
    color: tags.color || '',
    isModerator: tags.mod === '1',
    isVerified: Boolean(tags.badges && /(broadcaster|moderator|vip)/.test(tags.badges))
  };
}

function sourceChatFrameUrl(stream) {
  if (typeof window === 'undefined') return '';
  const parent = window.location.hostname;
  if (stream?.provider === 'twitch' && stream?.channelSlug) return `https://www.twitch.tv/embed/${encodeURIComponent(stream.channelSlug)}/chat?parent=${encodeURIComponent(parent)}&darkpopout`;
  if (stream?.provider === 'youtube' && stream?.externalId) return `https://www.youtube.com/live_chat?v=${encodeURIComponent(stream.externalId)}&embed_domain=${encodeURIComponent(parent)}`;
  return '';
}

export default function ExternalLiveDroxionChat({ stream, currentUserId, coins = 0, onCoinsChanged, onOpenWallet }) {
  const key = useMemo(() => streamKey(stream), [stream?.provider, stream?.externalId, stream?.channelSlug, stream?.channelId, stream?.id]);
  const [messages, setMessages] = useState(() => readCachedMessages(key));
  const [sourceMessages, setSourceMessages] = useState([]);
  const [sourceStatus, setSourceStatus] = useState('Connecting source chat…');
  const [giftOptions, setGiftOptions] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [sourceComposerOpen, setSourceComposerOpen] = useState(false);
  const [busyGift, setBusyGift] = useState('');
  const [notice, setNotice] = useState('');
  const [activeGift, setActiveGift] = useState(null);
  const pollTimerRef = useRef(null);
  const sourceTimerRef = useRef(null);
  const socketRef = useRef(null);
  const lastIdRef = useRef(0);
  const loadingRef = useRef(false);
  const queuedRefreshRef = useRef(false);
  const twitchSequenceRef = useRef(0);
  const chatStreamRef = useRef(null);
  const stickBottomRef = useRef(true);

  useEffect(() => { writeCachedMessages(key, messages); }, [key, messages]);

  const loadMessages = useCallback(async ({ force = false, full = false } = {}) => {
    if (!key) return;
    if (!force && typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (loadingRef.current) {
      if (force) queuedRefreshRef.current = true;
      return;
    }
    loadingRef.current = true;
    try {
      const { data, error } = await supabase.rpc('droxion_external_live_messages', {
        p_stream_key: key,
        p_after_id: full ? 0 : lastIdRef.current
      });
      if (!error && Array.isArray(data) && data.length) {
        lastIdRef.current = Math.max(lastIdRef.current, ...data.map(row => Number(row.id || 0)));
        setMessages(current => mergeRows(current, data, row => String(row.id), CHAT_LIMIT));
      }
    } finally {
      loadingRef.current = false;
      if (queuedRefreshRef.current) {
        queuedRefreshRef.current = false;
        window.setTimeout(() => loadMessages({ force: true }), 50);
      }
    }
  }, [key]);

  useEffect(() => {
    let stopped = false;
    const cached = readCachedMessages(key);
    setMessages(cached);
    writeCachedMessages(key, cached);
    lastIdRef.current = 0;
    loadingRef.current = false;
    queuedRefreshRef.current = false;
    setDraft('');
    setNotice('');
    stickBottomRef.current = true;

    const poll = async () => {
      if (stopped) return;
      await loadMessages({ full: lastIdRef.current === 0 });
      if (!stopped) pollTimerRef.current = window.setTimeout(poll, document.visibilityState === 'hidden' ? 12000 : DROXION_POLL_MS);
    };
    poll();
    const wake = () => { if (document.visibilityState === 'visible') loadMessages({ force: true, full: true }); };
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [key, loadMessages]);

  useEffect(() => {
    if (!key) return undefined;
    const channel = supabase
      .channel(`external-live-chat:${key}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'droxion_external_live_events', filter: `stream_key=eq.${key}` },
        payload => {
          const row = payload?.new;
          if (!row?.id) return;
          stickBottomRef.current = true;
          setMessages(current => mergeRows(current, [{
            ...row,
            display_name: row.user_id === currentUserId ? 'You' : 'Droxion user',
            username: '',
            avatar_url: ''
          }], item => String(item.id), CHAT_LIMIT));
          window.setTimeout(() => loadMessages({ force: true, full: true }), 40);
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') loadMessages({ force: true, full: true });
      });

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [key, currentUserId, loadMessages]);

  useEffect(() => {
    supabase.rpc('droxion_gift_options').then(({ data, error }) => {
      if (!error) setGiftOptions(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let stopped = false;
    setSourceMessages([]);
    setSourceStatus('Connecting source chat…');
    if (sourceTimerRef.current) window.clearTimeout(sourceTimerRef.current);
    if (socketRef.current) { try { socketRef.current.close(); } catch {} socketRef.current = null; }

    const addSource = rows => {
      if (stopped || !rows?.length) return;
      setSourceMessages(current => {
        const map = new Map(current.map(row => [`${row.provider}:${row.id}`, row]));
        rows.forEach(row => map.set(`${row.provider}:${row.id}`, row));
        return [...map.values()].sort((a, b) => toMillis(a.publishedAt) - toMillis(b.publishedAt)).slice(-SOURCE_LIMIT);
      });
      setSourceStatus('');
    };

    if (stream?.provider === 'youtube' && stream?.externalId) {
      let pageToken = '';
      let liveChatId = '';
      const poll = async () => {
        if (stopped) return;
        try {
          const params = new URLSearchParams({ provider: 'youtube', videoId: String(stream.externalId) });
          if (liveChatId) params.set('liveChatId', liveChatId);
          if (pageToken) params.set('pageToken', pageToken);
          const response = await fetch(`/api/live-chat?${params.toString()}`);
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error('unavailable');
          liveChatId = data?.liveChatId || liveChatId;
          pageToken = data?.nextPageToken || pageToken;
          addSource((data?.messages || []).map(item => ({ ...item, provider: 'youtube', publishedAt: toMillis(item.publishedAt) })));
          if (data?.available === false) setSourceStatus('YouTube chat is unavailable for this LIVE.');
          sourceTimerRef.current = window.setTimeout(poll, Math.max(4500, Math.min(15000, Number(data?.pollingIntervalMillis || 6000))));
        } catch {
          setSourceStatus('YouTube chat temporarily unavailable.');
          sourceTimerRef.current = window.setTimeout(poll, 12000);
        }
      };
      poll();
    } else if (stream?.provider === 'kick' && Number(stream?.channelId || 0) > 0) {
      const broadcasterUserId = Number(stream.channelId);
      let after = '';
      fetch('/api/kick/subscribe-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ broadcasterUserId }) }).catch(() => {});
      const poll = async () => {
        if (stopped) return;
        try {
          const params = new URLSearchParams({ broadcasterUserId: String(broadcasterUserId) });
          if (after) params.set('after', after);
          const response = await fetch(`/api/kick/webhook?${params.toString()}`);
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error('unavailable');
          addSource((data?.messages || []).map(item => ({ ...item, provider: 'kick', publishedAt: toMillis(item.publishedAt) })));
          after = data?.nextAfter || after;
          sourceTimerRef.current = window.setTimeout(poll, 5000);
        } catch {
          setSourceStatus('Kick chat temporarily unavailable.');
          sourceTimerRef.current = window.setTimeout(poll, 12000);
        }
      };
      poll();
    } else if (stream?.provider === 'twitch' && stream?.channelSlug) {
      const channel = String(stream.channelSlug).toLowerCase().replace(/[^a-z0-9_]/g, '');
      try {
        const socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
        socketRef.current = socket;
        socket.onopen = () => {
          const guest = `justinfan${Math.floor(10000 + Math.random() * 89999)}`;
          socket.send('PASS SCHMOOPIIE');
          socket.send(`NICK ${guest}`);
          socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
          socket.send(`JOIN #${channel}`);
          setSourceStatus('Waiting for Twitch chat…');
        };
        socket.onmessage = event => {
          String(event.data || '').split(/\r?\n/).filter(Boolean).forEach(line => {
            if (line.startsWith('PING')) { try { socket.send(line.replace('PING', 'PONG')); } catch {} return; }
            twitchSequenceRef.current += 1;
            const parsed = parseTwitchLine(line, twitchSequenceRef.current);
            if (parsed) addSource([parsed]);
          });
        };
        socket.onerror = () => setSourceStatus('Twitch chat temporarily unavailable.');
      } catch {
        setSourceStatus('Twitch chat temporarily unavailable.');
      }
    } else {
      setSourceStatus('Source chat is unavailable for this LIVE.');
    }

    return () => {
      stopped = true;
      if (sourceTimerRef.current) window.clearTimeout(sourceTimerRef.current);
      if (socketRef.current) { try { socketRef.current.close(); } catch {} socketRef.current = null; }
    };
  }, [stream?.provider, stream?.externalId, stream?.channelId, stream?.channelSlug]);

  const combinedMessages = useMemo(() => {
    const source = sourceMessages.map(row => ({
      kind: 'source', key: `source:${row.provider}:${row.id}`, timestamp: toMillis(row.publishedAt), provider: row.provider,
      authorName: row.authorName || `${providerLabel(row.provider)} user`, avatarUrl: row.avatarUrl || '', message: row.message || '',
      color: row.color || '', isModerator: Boolean(row.isModerator), isVerified: Boolean(row.isVerified)
    }));
    const droxion = messages.map(row => ({
      kind: row.event_type === 'gift' ? 'gift' : 'droxion', key: `droxion:${row.id}`, timestamp: toMillis(row.created_at),
      authorName: row.display_name || row.username || 'Droxion user', avatarUrl: row.avatar_url || '', message: row.body || '',
      giftName: row.gift_name || '', giftEmoji: row.emoji || '🎁', costCoins: Number(row.cost_coins || 0)
    }));
    return [...source, ...droxion].sort((a, b) => a.timestamp - b.timestamp);
  }, [sourceMessages, messages]);

  useEffect(() => {
    const node = chatStreamRef.current;
    if (node && stickBottomRef.current) node.scrollTop = node.scrollHeight;
  }, [combinedMessages.length]);

  async function sendChat() {
    const body = draft.trim();
    if (!body || sending) return;
    if (!currentUserId) { setNotice('Sign in to chat on Droxion.'); return; }
    setSending(true);
    setNotice('');
    try {
      const { data, error } = await supabase.rpc('droxion_send_external_live_chat', { p_stream_key: key, p_provider: stream.provider, p_body: body });
      if (error || data?.allowed === false) throw new Error(error?.message || data?.reason || 'Message could not be sent.');
      const eventId = Number(data?.event_id || 0);
      if (eventId > 0) {
        const optimistic = {
          id: eventId, event_type: 'chat', user_id: currentUserId, display_name: 'You', username: '', avatar_url: '',
          creator_label: null, body, gift_code: null, gift_name: null, emoji: null, cost_coins: 0, created_at: new Date().toISOString()
        };
        stickBottomRef.current = true;
        setMessages(current => {
          const next = mergeRows(current, [optimistic], row => String(row.id), CHAT_LIMIT);
          writeCachedMessages(key, next);
          return next;
        });
        lastIdRef.current = Math.max(lastIdRef.current, eventId);
      }
      setDraft('');
      window.setTimeout(() => loadMessages({ force: true, full: true }), 120);
    } catch (error) {
      const message = error?.message || 'Message could not be sent.';
      setNotice(message === 'rate_limited' ? 'Slow down for a moment.' : message);
    } finally {
      setSending(false);
    }
  }

  async function sendGift(gift) {
    if (!gift?.gift_code || busyGift) return;
    if (!currentUserId) { setGiftOpen(false); setNotice('Sign in to send Droxion gifts.'); return; }
    if (Number(gift.cost_coins || 0) > Number(coins || 0)) { setGiftOpen(false); onOpenWallet?.(); return; }
    setBusyGift(String(gift.gift_code)); setNotice('');
    try {
      const { data, error } = await supabase.rpc('droxion_send_external_live_gift', {
        p_stream_key: key, p_provider: stream.provider, p_creator_label: stream.creatorName || '', p_gift_code: gift.gift_code
      });
      if (data?.reason === 'insufficient_coins') { setGiftOpen(false); onOpenWallet?.(); return; }
      if (error || data?.allowed === false) throw new Error(error?.message || data?.reason || 'Gift could not be sent.');
      onCoinsChanged?.(Number(data?.coin_balance ?? coins));
      setActiveGift({ emoji: data?.emoji || gift.emoji || '🎁', name: data?.gift_name || gift.gift_name || 'Gift' });
      window.setTimeout(() => setActiveGift(null), 2100);
      setGiftOpen(false);
      await loadMessages({ force: true, full: true });
    } catch (error) {
      setNotice(error?.message || 'Gift could not be sent.');
    } finally {
      setBusyGift('');
    }
  }

  const sourceFrame = sourceChatFrameUrl(stream);

  return (
    <div className="dxDroxionChat dxUnifiedChat">
      <div className="dxUnifiedChatTop">
        <div><MessageCircle size={15} /><span><strong>One LIVE chat</strong><small>{providerLabel(stream?.provider)} + Droxion together</small></span></div>
        {sourceFrame ? <button type="button" className="dxSourceComposerButton" onClick={() => setSourceComposerOpen(true)}>Chat on {providerLabel(stream?.provider)}</button> : <span className="dxSourceReadOnly">{providerLabel(stream?.provider)} read-only</span>}
      </div>

      <div ref={chatStreamRef} className="dxUnifiedChatStream" onScroll={event => {
        const node = event.currentTarget;
        stickBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight <= 84;
      }}>
        {combinedMessages.length === 0 && <div className="dxDroxionChatEmpty"><strong>LIVE chat is connecting</strong><span>{sourceStatus || 'Source messages and Droxion messages will appear together here.'}</span></div>}
        {sourceStatus && combinedMessages.length > 0 && <div className="dxSourceStatus">{sourceStatus}</div>}
        {combinedMessages.map(message => <div className={`dxUnifiedMessage ${message.kind}`} key={message.key}>
          {message.avatarUrl ? <img src={message.avatarUrl} alt="" /> : <span className={`dxUnifiedAvatar ${message.kind}`} />}
          <div className="dxUnifiedMessageBody">
            <div className="dxUnifiedNameRow"><strong style={message.color ? { color: message.color } : undefined}>{message.authorName}</strong>{message.kind === 'source' ? <span className={`dxChatSourceBadge ${providerClass(message.provider)}`}>{providerLabel(message.provider)}</span> : <span className="dxChatSourceBadge droxion">Droxion</span>}{message.isModerator && <i>MOD</i>}{message.isVerified && <i>✓</i>}</div>
            {message.kind === 'gift' ? <p className="dxGiftLine"><b>{message.giftEmoji} {message.giftName}</b><span> sent a Droxion gift{message.costCoins ? ` · ${message.costCoins} coins` : ''}</span></p> : <p>{message.message}</p>}
          </div>
        </div>)}
      </div>

      {notice && <div className="dxDroxionChatNotice">{notice}</div>}
      <div className="dxQuickGiftRail" aria-label="Quick Droxion gifts">
        {giftOptions.slice(0, 5).map(gift => <button type="button" key={gift.gift_code} disabled={Boolean(busyGift)} onClick={() => sendGift(gift)}><span>{gift.emoji || '🎁'}</span><small>{gift.cost_coins}</small></button>)}
        <button type="button" className="dxMoreGifts" onClick={() => setGiftOpen(true)}><Gift size={16} /><small>More</small></button>
      </div>
      <div className="dxDroxionComposer">
        <button type="button" className="dxCoinsButton" onClick={() => onOpenWallet?.()} aria-label="Buy Droxion coins"><Coins size={16} /><span>{Number(coins || 0)}</span></button>
        <button type="button" className="dxGiftButton" onClick={() => setGiftOpen(true)} aria-label="Send Droxion gift"><Gift size={18} /></button>
        <input value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendChat(); } }} maxLength={500} placeholder="Message on Droxion" />
        <button type="button" className="dxSendButton" disabled={!draft.trim() || sending} onClick={sendChat}><Send size={17} /></button>
      </div>

      {sourceComposerOpen && <div className="dxSourceComposerBackdrop" onClick={() => setSourceComposerOpen(false)}><section className="dxSourceComposerSheet" onClick={event => event.stopPropagation()}><header><div><strong>{providerLabel(stream?.provider)} chat</strong><small>Use your {providerLabel(stream?.provider)} account here; Droxion chat remains the default.</small></div><button type="button" onClick={() => setSourceComposerOpen(false)}><X size={18} /></button></header><iframe src={sourceFrame} title={`${providerLabel(stream?.provider)} official chat`} /></section></div>}
      {giftOpen && <div className="dxGiftBackdrop" onClick={() => setGiftOpen(false)}><section className="dxGiftSheet" onClick={event => event.stopPropagation()}><header><div><span>DROXION GIFTS</span><strong>Send a gift</strong><small>Balance · 🪙 {Number(coins || 0)}</small></div><button type="button" onClick={() => setGiftOpen(false)}><X size={18} /></button></header><div className="dxGiftGrid">{giftOptions.map(gift => <button type="button" key={gift.gift_code} disabled={Boolean(busyGift)} onClick={() => sendGift(gift)}><span>{gift.emoji || '🎁'}</span><strong>{gift.gift_name}</strong><small>🪙 {gift.cost_coins}</small></button>)}</div><button type="button" className="dxBuyCoinsWide" onClick={() => { setGiftOpen(false); onOpenWallet?.(); }}>+ Buy Coins</button></section></div>}
      {activeGift && <div className="dxExternalGiftBurst" aria-hidden="true"><span>{activeGift.emoji}</span><strong>{activeGift.name}</strong><small>DROXION GIFT</small></div>}
    </div>
  );
}
