import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Gift, MessageCircle, Send, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import './external-live-droxion-chat.css';

const POLL_MS = 2200;

function streamKey(stream) {
  const provider = String(stream?.provider || 'live').toLowerCase();
  const external = String(stream?.externalId || stream?.channelSlug || stream?.channelId || stream?.id || '').trim();
  return `${provider}:${external}`.slice(0, 220);
}

function dedupe(rows) {
  const map = new Map();
  (rows || []).forEach(row => map.set(String(row.id), row));
  return Array.from(map.values()).sort((a, b) => Number(a.id || 0) - Number(b.id || 0)).slice(-200);
}

export default function ExternalLiveDroxionChat({
  stream,
  currentUserId,
  coins = 0,
  onCoinsChanged,
  onOpenWallet,
  sourceChat
}) {
  const [messages, setMessages] = useState([]);
  const [giftOptions, setGiftOptions] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [busyGift, setBusyGift] = useState('');
  const [notice, setNotice] = useState('');
  const [activeGift, setActiveGift] = useState(null);
  const pollRef = useRef(null);
  const lastIdRef = useRef(0);
  const bottomRef = useRef(null);
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
    setDraft('');
    setNotice('');
    setGiftOpen(false);
    lastIdRef.current = 0;
    loadMessages();
    pollRef.current = window.setInterval(loadMessages, POLL_MS);
    return () => window.clearInterval(pollRef.current);
  }, [key, loadMessages]);

  useEffect(() => {
    supabase.rpc('droxion_gift_options').then(({ data, error }) => {
      if (!error) setGiftOptions(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function sendChat() {
    const body = draft.trim();
    if (!body || sending) return;
    if (!currentUserId) {
      setNotice('Sign in to chat on Droxion.');
      return;
    }
    setSending(true);
    setNotice('');
    try {
      const { data, error } = await supabase.rpc('droxion_send_external_live_chat', {
        p_stream_key: key,
        p_provider: stream.provider,
        p_body: body
      });
      if (error || data?.allowed === false) throw new Error(error?.message || data?.reason || 'Message could not be sent.');
      setDraft('');
      await loadMessages();
    } catch (error) {
      setNotice(error?.message === 'rate_limited' ? 'Slow down for a moment.' : (error?.message || 'Message could not be sent.'));
    } finally {
      setSending(false);
    }
  }

  async function sendGift(gift) {
    if (!gift?.gift_code || busyGift) return;
    if (!currentUserId) {
      setGiftOpen(false);
      setNotice('Sign in to send Droxion gifts.');
      return;
    }
    if (Number(gift.cost_coins || 0) > Number(coins || 0)) {
      setGiftOpen(false);
      onOpenWallet?.();
      return;
    }

    setBusyGift(String(gift.gift_code));
    setNotice('');
    try {
      const { data, error } = await supabase.rpc('droxion_send_external_live_gift', {
        p_stream_key: key,
        p_provider: stream.provider,
        p_creator_label: stream.creatorName || '',
        p_gift_code: gift.gift_code
      });
      if (data?.reason === 'insufficient_coins') {
        setGiftOpen(false);
        onOpenWallet?.();
        return;
      }
      if (error || data?.allowed === false) throw new Error(error?.message || data?.reason || 'Gift could not be sent.');
      onCoinsChanged?.(Number(data?.coin_balance ?? coins));
      setActiveGift({ emoji: data?.emoji || gift.emoji || '🎁', name: data?.gift_name || gift.gift_name || 'Gift' });
      window.setTimeout(() => setActiveGift(null), 2100);
      setGiftOpen(false);
      await loadMessages();
    } catch (error) {
      setNotice(error?.message || 'Gift could not be sent.');
    } finally {
      setBusyGift('');
    }
  }

  return (
    <div className="dxDroxionChat dxMixedChat">
      <section className="dxMixedSource">
        <header><span>LIVE CHAT</span><strong>{stream?.providerLabel || 'Source'} community</strong></header>
        <div className="dxSourceChatHost">{sourceChat}</div>
      </section>

      <section className="dxMixedDroxion">
        <header><MessageCircle size={14} /><strong>Droxion Chat</strong><span>Gifts + Droxion users</span></header>
        <div className="dxDroxionChatStream">
          {messages.length === 0 && <div className="dxDroxionChatEmpty"><strong>Start the Droxion chat</strong><span>Chat with Droxion viewers or send a gift while the source chat stays visible above.</span></div>}
          {messages.map(message => <div className={`dxDroxionMessage ${message.event_type === 'gift' ? 'gift' : ''}`} key={message.id}>
            {message.avatar_url ? <img src={message.avatar_url} alt="" /> : <span className="dxDroxionAvatar" />}
            <div><strong>{message.display_name || message.username || 'Droxion user'}{message.username ? <small>@{message.username}</small> : null}</strong><p>{message.event_type === 'gift' ? <><b>{message.emoji || '🎁'} {message.gift_name}</b> <span>sent on Droxion</span></> : message.body}</p></div>
          </div>)}
          <div ref={bottomRef} />
        </div>

        {notice && <div className="dxDroxionChatNotice">{notice}</div>}

        <div className="dxDroxionComposer">
          <button type="button" className="dxCoinsButton" onClick={() => onOpenWallet?.()} aria-label="Buy Droxion coins"><Coins size={16} /><span>{Number(coins || 0)}</span></button>
          <button type="button" className="dxGiftButton" onClick={() => setGiftOpen(true)} aria-label="Send Droxion gift"><Gift size={18} /></button>
          <input value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendChat(); } }} maxLength={500} placeholder="Message on Droxion" />
          <button type="button" className="dxSendButton" disabled={!draft.trim() || sending} onClick={sendChat}><Send size={17} /></button>
        </div>
      </section>

      {giftOpen && <div className="dxGiftBackdrop" onClick={() => setGiftOpen(false)}>
        <section className="dxGiftSheet" onClick={event => event.stopPropagation()}>
          <header><div><span>DROXION GIFTS</span><strong>Send a gift</strong><small>Balance · 🪙 {Number(coins || 0)}</small></div><button type="button" onClick={() => setGiftOpen(false)}><X size={18} /></button></header>
          <div className="dxGiftGrid">{giftOptions.map(gift => <button type="button" key={gift.gift_code} disabled={Boolean(busyGift)} onClick={() => sendGift(gift)}><span>{gift.emoji || '🎁'}</span><strong>{gift.gift_name}</strong><small>🪙 {gift.cost_coins}</small></button>)}</div>
          <button type="button" className="dxBuyCoinsWide" onClick={() => { setGiftOpen(false); onOpenWallet?.(); }}>+ Buy Coins</button>
        </section>
      </div>}

      {activeGift && <div className="dxExternalGiftBurst" aria-hidden="true"><span>{activeGift.emoji}</span><strong>{activeGift.name}</strong><small>DROXION GIFT</small></div>}
    </div>
  );
}
