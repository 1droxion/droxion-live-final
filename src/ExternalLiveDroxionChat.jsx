import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Gift, MessageCircle, Send, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import './external-live-droxion-chat.css';

const DROXION_POLL_MS = 2200;
const SOURCE_LIMIT = 180;

function streamKey(stream) {
  const provider = String(stream?.provider || 'live').toLowerCase();
  const external = String(stream?.externalId || stream?.channelSlug || stream?.channelId || stream?.id || '').trim();
  return `${provider}:${external}`.slice(0, 220);
}

function dedupe(rows, keyOf = row => String(row.id)) {
  const map = new Map();
  (rows || []).forEach(row => map.set(keyOf(row), row));
  return Array.from(map.values()).slice(-200);
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
  return String(value)
    .replace(/\\s/g, ' ')
    .replace(/\\:/g, ';')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\');
}

function parseTwitchLine(line, sequence) {
  if (!line.includes(' PRIVMSG ')) return null;
  const tags = {};
  let rest = line;
  if (rest[0] === '@') {
    const space = rest.indexOf(' ');
    rest.slice(1, space).split(';').forEach(pair => {
      const index = pair.indexOf('=');
      const key = index >= 0 ? pair.slice(0, index) : pair;
      const value = index >= 0 ? pair.slice(index + 1) : '';
      tags[key] = unescapeIrcTag(value);
    });
    rest = rest.slice(space + 1);
  }
  const match = rest.match(/^:([^! ]+)!.* PRIVMSG #[^ ]+ :(.*)$/);
  if (!match) return null;
  const publishedAt = Number(tags['tmi-sent-ts'] || 0) || Date.now();
  return {
    id: tags.id || `twitch-${publishedAt}-${sequence}`,
    source: 'source',
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
  if (stream?.provider === 'twitch' && stream?.channelSlug) {
    return `https://www.twitch.tv/embed/${encodeURIComponent(stream.channelSlug)}/chat?parent=${encodeURIComponent(parent)}&darkpopout`;
  }
  if (stream?.provider === 'youtube' && stream?.externalId) {
    return `https://www.youtube.com/live_chat?v=${encodeURIComponent(stream.externalId)}&embed_domain=${encodeURIComponent(parent)}`;
  }
  return '';
}

export default function ExternalLiveDroxionChat({
  stream,
  currentUserId,
  coins = 0,
  onCoinsChanged,
  onOpenWallet
}) {
  const [messages, setMessages] = useState([]);
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
  const pollRef = useRef(null);
  const sourceTimerRef = useRef(null);
  const socketRef = useRef(null);
  const lastIdRef = useRef(0);
  const bottomRef = useRef(null);
  const twitchSequenceRef = useRef(0);
  const key = useMemo(() => streamKey(stream), [stream]);

  const loadMessages = useCallback(async () => {
    if (!key) return;
    const { data, error } = await supabase.rpc('droxion_external_live_messages', {
      p_stream_key: key,
      p_after_id: lastIdRef.current
    });
    if (error) return;
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) return;
    lastIdRef.current = Math.max(lastIdRef.current, ...rows.map(row => Number(row.id || 0)));
    setMessages(current => dedupe([...current, ...rows]));
  }, [key]);

  useEffect(() => {
    setMessages([]);
    setSourceMessages([]);
    setSourceStatus('Connecting source chat…');
    setDraft('');
    setNotice('');
    setGiftOpen(false);
    setSourceComposerOpen(false);
    lastIdRef.current = 0;
    loadMessages();
    pollRef.current = window.setInterval(loadMessages, DROXION_POLL_MS);
    return () => window.clearInterval(pollRef.current);
  }, [key, loadMessages]);

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
    if (socketRef.current) {
      try { socketRef.current.close(); } catch {}
      socketRef.current = null;
    }

    const addSourceRows = incoming => {
      if (stopped || !incoming?.length) return;
      setSourceMessages(current => dedupe([...current, ...incoming], row => `${row.provider}:${row.id}`).slice(-SOURCE_LIMIT));
      setSourceStatus('');
    };

    if (stream?.provider === 'youtube' && stream?.externalId) {
      let pageToken = '';
      let liveChatId = '';
      const poll = async () => {
        if (stopped) return;
        try {
          const params = new URLSearchParams({ provider: 'youtube', videoId: stream.externalId });
          if (liveChatId) params.set('liveChatId', liveChatId);
          if (pageToken) params.set('pageToken', pageToken);
          const response = await fetch(`/api/live-chat?${params.toString()}`, { headers: { Accept: 'application/json' } });
          const data = await response.json();
          if (!response.ok) throw new Error('Source chat unavailable');
          liveChatId = data?.liveChatId || liveChatId;
          pageToken = data?.nextPageToken || pageToken;
          addSourceRows((data?.messages || []).map(item => ({ ...item, source: 'source', provider: 'youtube', publishedAt: toMillis(item.publishedAt) })));
          if (data?.available === false) setSourceStatus('YouTube chat is unavailable for this LIVE.');
          const delay = Math.max(3000, Math.min(15000, Number(data?.pollingIntervalMillis || 5000)));
          sourceTimerRef.current = window.setTimeout(poll, delay);
        } catch {
          setSourceStatus('YouTube chat temporarily unavailable.');
          sourceTimerRef.current = window.setTimeout(poll, 10000);
        }
      };
      poll();
    } else if (stream?.provider === 'kick' && Number(stream?.channelId || 0) > 0) {
      const broadcasterUserId = Number(stream.channelId);
      fetch('/api/kick/subscribe-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ broadcasterUserId })
      }).catch(() => {});
      const poll = async () => {
        if (stopped) return;
        try {
          const response = await fetch(`/api/kick/webhook?broadcasterUserId=${encodeURIComponent(broadcasterUserId)}`, { headers: { Accept: 'application/json' } });
          const data = await response.json();
          if (!response.ok) throw new Error('Source chat unavailable');
          addSourceRows((data?.messages || []).map(item => ({ ...item, source: 'source', provider: 'kick', publishedAt: toMillis(item.publishedAt) })));
          sourceTimerRef.current = window.setTimeout(poll, 2000);
        } catch {
          setSourceStatus('Kick chat temporarily unavailable.');
          sourceTimerRef.current = window.setTimeout(poll, 7000);
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
            if (line.startsWith('PING')) {
              try { socket.send(line.replace('PING', 'PONG')); } catch {}
              return;
            }
            twitchSequenceRef.current += 1;
            const parsed = parseTwitchLine(line, twitchSequenceRef.current);
            if (parsed) addSourceRows([parsed]);
          });
        };
        socket.onerror = () => setSourceStatus('Twitch chat temporarily unavailable.');
        socket.onclose = () => { if (!stopped) setSourceStatus('Twitch chat reconnects when you reopen this LIVE.'); };
      } catch {
        setSourceStatus('Twitch chat temporarily unavailable.');
      }
    } else {
      setSourceStatus('Source chat is unavailable for this LIVE.');
    }

    return () => {
      stopped = true;
      if (sourceTimerRef.current) window.clearTimeout(sourceTimerRef.current);
      if (socketRef.current) {
        try { socketRef.current.close(); } catch {}
        socketRef.current = null;
      }
    };
  }, [stream?.provider, stream?.externalId, stream?.channelId, stream?.channelSlug]);

  const combinedMessages = useMemo(() => {
    const sourceRows = sourceMessages.map(row => ({
      kind: 'source', key: `source:${row.provider}:${row.id}`, timestamp: toMillis(row.publishedAt), provider: row.provider,
      authorName: row.authorName || `${providerLabel(row.provider)} user`, avatarUrl: row.avatarUrl || '', message: row.message || '',
      color: row.color || '', isModerator: Boolean(row.isModerator), isVerified: Boolean(row.isVerified)
    }));
    const droxionRows = messages.map(row => ({
      kind: row.event_type === 'gift' ? 'gift' : 'droxion', key: `droxion:${row.id}`, timestamp: toMillis(row.created_at),
      authorName: row.display_name || row.username || 'Droxion user', username: row.username || '', avatarUrl: row.avatar_url || '',
      message: row.body || '', giftName: row.gift_name || '', giftEmoji: row.emoji || '🎁', costCoins: Number(row.cost_coins || 0)
    }));
    return [...sourceRows, ...droxionRows].sort((a, b) => a.timestamp - b.timestamp).slice(-220);
  }, [sourceMessages, messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [combinedMessages.length]);

  async function sendChat() {
    const body = draft.trim();
    if (!body || sending) return;
    if (!currentUserId) { setNotice('Sign in to chat on Droxion.'); return; }
    setSending(true); setNotice('');
    try {
      const { data, error } = await supabase.rpc('droxion_send_external_live_chat', { p_stream_key: key, p_provider: stream.provider, p_body: body });
      if (error || data?.allowed === false) throw new Error(error?.message || data?.reason || 'Message could not be sent.');
      setDraft(''); await loadMessages();
    } catch (error) {
      setNotice(error?.message === 'rate_limited' ? 'Slow down for a moment.' : (error?.message || 'Message could not be sent.'));
    } finally { setSending(false); }
  }

  async function sendGift(gift) {
    if (!gift?.gift_code || busyGift) return;
    if (!currentUserId) { setGiftOpen(false); setNotice('Sign in to send Droxion gifts.'); return; }
    if (Number(gift.cost_coins || 0) > Number(coins || 0)) { setGiftOpen(false); onOpenWallet?.(); return; }
    setBusyGift(String(gift.gift_code)); setNotice('');
    try {
      const { data, error } = await supabase.rpc('droxion_send_external_live_gift', { p_stream_key: key, p_provider: stream.provider, p_creator_label: stream.creatorName || '', p_gift_code: gift.gift_code });
      if (data?.reason === 'insufficient_coins') { setGiftOpen(false); onOpenWallet?.(); return; }
      if (error || data?.allowed === false) throw new Error(error?.message || data?.reason || 'Gift could not be sent.');
      onCoinsChanged?.(Number(data?.coin_balance ?? coins));
      setActiveGift({ emoji: data?.emoji || gift.emoji || '🎁', name: data?.gift_name || gift.gift_name || 'Gift' });
      window.setTimeout(() => setActiveGift(null), 2100);
      setGiftOpen(false); await loadMessages();
    } catch (error) { setNotice(error?.message || 'Gift could not be sent.'); }
    finally { setBusyGift(''); }
  }

  const sourceFrame = sourceChatFrameUrl(stream);

  return (
    <div className="dxDroxionChat dxUnifiedChat">
      <div className="dxUnifiedChatTop">
        <div><MessageCircle size={15} /><span><strong>One LIVE chat</strong><small>{providerLabel(stream?.provider)} + Droxion together</small></span></div>
        {sourceFrame ? <button type="button" className="dxSourceComposerButton" onClick={() => setSourceComposerOpen(true)}>Chat on {providerLabel(stream?.provider)}</button> : <span className="dxSourceReadOnly">{providerLabel(stream?.provider)} read-only</span>}
      </div>

      <div className="dxUnifiedChatStream">
        {combinedMessages.length === 0 && <div className="dxDroxionChatEmpty"><strong>LIVE chat is connecting</strong><span>{sourceStatus || 'Source messages and Droxion messages will appear together here.'}</span></div>}
        {sourceStatus && combinedMessages.length > 0 && <div className="dxSourceStatus">{sourceStatus}</div>}
        {combinedMessages.map(message => <div className={`dxUnifiedMessage ${message.kind}`} key={message.key}>
          {message.avatarUrl ? <img src={message.avatarUrl} alt="" /> : <span className={`dxUnifiedAvatar ${message.kind}`} />}
          <div className="dxUnifiedMessageBody">
            <div className="dxUnifiedNameRow"><strong style={message.color ? { color: message.color } : undefined}>{message.authorName}</strong>{message.kind === 'source' ? <span className={`dxChatSourceBadge ${providerClass(message.provider)}`}>{providerLabel(message.provider)}</span> : <span className="dxChatSourceBadge droxion">Droxion</span>}{message.isModerator && <i>MOD</i>}{message.isVerified && <i>✓</i>}</div>
            {message.kind === 'gift' ? <p className="dxGiftLine"><b>{message.giftEmoji} {message.giftName}</b><span> sent a Droxion gift{message.costCoins ? ` · ${message.costCoins} coins` : ''}</span></p> : <p>{message.message}</p>}
          </div>
        </div>)}
        <div ref={bottomRef} />
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
