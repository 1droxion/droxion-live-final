import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, MessageCircle, Radio, RefreshCw, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { rankLiveStreams, recordLiveBehavior } from './recommendationEngine';
import ExternalLiveDroxionChat from './ExternalLiveDroxionChat';
import './global-live-hub.css';

const EXTERNAL_PROVIDERS = [
  { id: 'all', label: 'All LIVE' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitch', label: 'Twitch' },
  { id: 'kick', label: 'Kick' }
];

const CATEGORIES = ['All', 'Gaming', 'IRL', 'Music', 'Sports', 'Talk'];
const REFRESH_MS = 120000;
const LIVE_DISCOVERY_LIMIT = 120;

function formatViewers(value) {
  const count = Number(value || 0);
  if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  return String(Math.max(0, count));
}

function providerClass(provider) {
  if (provider === 'youtube') return 'youtube';
  if (provider === 'twitch') return 'twitch';
  if (provider === 'kick') return 'kick';
  return 'droxion';
}

function providerEmptyMessage(provider, providers, availableProviderCount) {
  if (provider !== 'all' && provider !== 'droxion') {
    const state = providers?.[provider] || {};
    const label = provider === 'youtube' ? 'YouTube' : provider === 'twitch' ? 'Twitch' : 'Kick';
    if (state.reason === 'missing_credentials') return `${label} is not connected to Droxion yet.`;
    if (state.reason === 'provider_error') return `${label} is temporarily unavailable. Other LIVE sources still work.`;
    if (state.reason === 'empty_result') return `${label} returned no embeddable LIVE streams in this refresh. Try again shortly.`;
    return `No matching ${label} LIVE streams right now.`;
  }
  return availableProviderCount === 0 ? 'LIVE discovery is temporarily unavailable.' : 'No matching LIVE streams right now.';
}

function ChatMessageList({ provider, messages, emptyText }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);
  return <div className="dxSourceChatMessages">
    {messages.length ? messages.map(message => <div className="dxSourceChatMessage" key={`${provider}:${message.id}`}>
      {message.avatarUrl ? <img src={message.avatarUrl} alt="" loading="lazy" /> : <span className="dxSourceChatAvatar">{String(message.authorName || '?').slice(0, 1).toUpperCase()}</span>}
      <div>
        <strong>{message.authorName || `${provider} user`}{message.isOwner ? <i>HOST</i> : message.isModerator ? <i>MOD</i> : message.isVerified ? <i>✓</i> : null}</strong>
        <p>{message.amountDisplayString ? <b>{message.amountDisplayString} </b> : null}{message.message}</p>
      </div>
    </div>) : <div className="dxSourceChatEmpty">{emptyText}</div>}
    <div ref={bottomRef} />
  </div>;
}

function YouTubeSourceChat({ stream }) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('Loading source chat…');
  const pageTokenRef = useRef('');
  const liveChatIdRef = useRef('');
  const timerRef = useRef(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    setMessages([]);
    pageTokenRef.current = '';
    liveChatIdRef.current = '';

    const poll = async () => {
      if (stoppedRef.current) return;
      try {
        const params = new URLSearchParams({ provider: 'youtube', videoId: stream.externalId });
        if (liveChatIdRef.current) params.set('liveChatId', liveChatIdRef.current);
        if (pageTokenRef.current) params.set('pageToken', pageTokenRef.current);
        const response = await fetch(`/api/live-chat?${params.toString()}`, { headers: { Accept: 'application/json' } });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Source chat unavailable');
        liveChatIdRef.current = data?.liveChatId || liveChatIdRef.current;
        pageTokenRef.current = data?.nextPageToken || pageTokenRef.current;
        const incoming = Array.isArray(data?.messages) ? data.messages : [];
        if (incoming.length) {
          setMessages(current => {
            const byId = new Map(current.map(item => [item.id, item]));
            incoming.forEach(item => byId.set(item.id, item));
            return Array.from(byId.values()).slice(-250);
          });
        }
        setStatus(data?.available === false ? 'Source chat is unavailable for this LIVE.' : '');
        const delay = Math.max(3000, Math.min(15000, Number(data?.pollingIntervalMillis || 5000)));
        timerRef.current = window.setTimeout(poll, delay);
      } catch {
        setStatus('Source chat temporarily unavailable.');
        timerRef.current = window.setTimeout(poll, 10000);
      }
    };

    poll();
    return () => {
      stoppedRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [stream.externalId]);

  return <ChatMessageList provider="Source" messages={messages} emptyText={status || 'Waiting for source chat…'} />;
}

function TwitchSourceChat({ stream, parent }) {
  const chatSrc = `https://www.twitch.tv/embed/${encodeURIComponent(stream.channelSlug)}/chat?parent=${encodeURIComponent(parent)}&darkpopout`;
  return <iframe className="dxTwitchChatFrame" src={chatSrc} title={`${stream.creatorName || 'Creator'} source chat`} />;
}

function KickSourceChat({ stream }) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('Connecting source chat…');
  const timerRef = useRef(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    const broadcasterUserId = Number(stream.channelId || 0);
    stoppedRef.current = false;
    setMessages([]);
    if (!broadcasterUserId) {
      setStatus('Source chat unavailable for this LIVE.');
      return () => {};
    }

    fetch('/api/kick/subscribe-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ broadcasterUserId })
    }).then(response => response.json()).then(data => {
      if (!data?.ok) setStatus('Source chat subscription unavailable.');
      else setStatus('');
    }).catch(() => setStatus('Source chat subscription unavailable.'));

    const poll = async () => {
      if (stoppedRef.current) return;
      try {
        const response = await fetch(`/api/kick/webhook?broadcasterUserId=${encodeURIComponent(broadcasterUserId)}`, { headers: { Accept: 'application/json' } });
        const data = await response.json();
        if (!response.ok) throw new Error('Source chat unavailable');
        const incoming = Array.isArray(data?.messages) ? data.messages : [];
        setMessages(incoming.slice(-250));
        if (incoming.length) setStatus('');
      } catch {
        setStatus(current => current || 'Source chat temporarily unavailable.');
      }
      timerRef.current = window.setTimeout(poll, 2000);
    };

    poll();
    return () => {
      stoppedRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [stream.channelId]);

  return <ChatMessageList provider="Source" messages={messages} emptyText={status || 'Waiting for source chat…'} />;
}

function SourceChat({ stream, parent }) {
  if (stream?.provider === 'youtube' && stream.externalId) return <YouTubeSourceChat stream={stream} />;
  if (stream?.provider === 'twitch' && stream.channelSlug) return <TwitchSourceChat stream={stream} parent={parent} />;
  if (stream?.provider === 'kick' && stream.channelId) return <KickSourceChat stream={stream} />;
  return <div className="dxSourceChatEmpty">Source chat is unavailable for this LIVE.</div>;
}

function ExternalLivePlayer({ stream, onClose, currentUserId, coins, onCoinsChanged, onOpenWallet }) {
  const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  useEffect(() => {
    if (!stream) return undefined;
    recordLiveBehavior(stream, 'open');
    const watchTimer = window.setTimeout(() => recordLiveBehavior(stream, 'watch'), 30000);
    const longWatchTimer = window.setTimeout(() => recordLiveBehavior(stream, 'watchLong'), 120000);
    return () => {
      window.clearTimeout(watchTimer);
      window.clearTimeout(longWatchTimer);
    };
  }, [stream]);

  let src = '';
  if (stream?.embedType === 'youtube' && stream.externalId) {
    src = `https://www.youtube.com/embed/${encodeURIComponent(stream.externalId)}?autoplay=1&playsinline=1&rel=0`;
  } else if (stream?.embedType === 'twitch' && stream.channelSlug) {
    src = `https://player.twitch.tv/?channel=${encodeURIComponent(stream.channelSlug)}&parent=${encodeURIComponent(parent)}&autoplay=true`;
  } else if (stream?.embedType === 'kick' && stream.channelSlug) {
    src = `https://player.kick.com/${encodeURIComponent(stream.channelSlug)}`;
  }

  return (
    <div className="dxLiveModal" role="dialog" aria-modal="true" aria-label={`${stream?.creatorName || 'Creator'} LIVE`}>
      <div className="dxLiveModalBackdrop" onClick={onClose} />
      <section className="dxLiveModalSheet dxLiveWithChat">
        <div className="dxLiveModalTop">
          <div><span className={`dxProviderBadge ${providerClass(stream?.provider)}`}>{stream?.providerLabel || 'LIVE'}</span><strong>{stream?.creatorName || 'Creator'}</strong></div>
          <div className="dxWatchSafe"><ShieldCheck size={14} /><span>Inside Droxion</span></div>
          <button type="button" onClick={onClose} aria-label="Close LIVE"><X size={22} /></button>
        </div>
        <div className="dxExternalLiveLayout">
          <div className="dxExternalVideoColumn">
            <div className="dxLivePlayerFrame">
              {src ? <iframe src={src} title={`${stream?.creatorName || 'Creator'} LIVE`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <div className="dxLivePlayerFallback">This LIVE is temporarily unavailable inside Droxion.</div>}
            </div>
            <div className="dxLiveModalMeta">
              <div className="dxWatchTitle"><Radio size={17} /><span>{stream?.title || 'LIVE now'}</span></div>
              <div className="dxWatchMetaChips"><span>{stream?.category || 'LIVE'}</span>{stream?.language && <span>{String(stream.language).toUpperCase()}</span>}<span><Users size={14} /> {formatViewers(stream?.viewerCount)} watching</span></div>
              <div className="dxLiveModalActions"><span className="dxStayOnDroxion"><ShieldCheck size={15} /> Watch, chat and send Droxion gifts without leaving Droxion</span></div>
              <div className="dxLiveAdSlot" data-droxion-ad-placement="live_below_player" aria-hidden="true" />
            </div>
          </div>
          <aside className="dxSourceChatPanel">
            <header><MessageCircle size={16} /><strong>Droxion LIVE Chat</strong><span>Chat + Gifts</span></header>
            <ExternalLiveDroxionChat
              stream={stream}
              currentUserId={currentUserId}
              coins={coins}
              onCoinsChanged={onCoinsChanged}
              onOpenWallet={onOpenWallet}
              sourceChat={<SourceChat stream={stream} parent={parent} />}
            />
          </aside>
        </div>
      </section>
    </div>
  );
}

export default function GlobalLiveHub({ query = '', nativeLive = null, currentUserId, coins = 0, onCoinsChanged, onOpenWallet }) {
  const [streams, setStreams] = useState([]);
  const [providers, setProviders] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [provider, setProvider] = useState('all');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState(null);
  const refreshTimerRef = useRef(null);

  const providerOptions = useMemo(() => nativeLive ? [...EXTERNAL_PROVIDERS, { id: 'droxion', label: 'Droxion' }] : EXTERNAL_PROVIDERS, [nativeLive]);

  const loadStreams = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch(`/api/live-hub?limit=${LIVE_DISCOVERY_LIMIT}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`LIVE discovery unavailable (${response.status})`);
      const data = await response.json();
      setStreams(Array.isArray(data?.streams) ? data.streams : []);
      setProviders(data?.providers && typeof data.providers === 'object' ? data.providers : {});
      setNotice('');
    } catch (error) {
      setNotice(error?.message || 'Could not refresh global LIVE discovery.');
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStreams();
    refreshTimerRef.current = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') loadStreams();
    }, REFRESH_MS);
    return () => window.clearInterval(refreshTimerRef.current);
  }, [loadStreams]);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    const matching = streams.filter(stream => {
      if (provider !== 'all' && stream.provider !== provider) return false;
      if (category !== 'All' && String(stream.category || '').toLowerCase() !== category.toLowerCase()) return false;
      if (!q) return true;
      const haystack = `${stream.creatorName || ''} ${stream.title || ''} ${stream.category || ''} ${stream.providerLabel || ''} ${stream.language || ''}`.toLowerCase();
      return haystack.includes(q);
    });
    return rankLiveStreams(matching);
  }, [streams, query, provider, category]);

  const availableProviderCount = Object.values(providers).filter(value => value?.enabled && Number(value?.available || 0) > 0).length;
  const missingProviders = Object.entries(providers).filter(([, value]) => value?.reason === 'missing_credentials').map(([key]) => key);
  const totalAvailable = Object.values(providers).reduce((sum, value) => sum + Number(value?.available || 0), 0);

  function openStream(stream) {
    recordLiveBehavior(stream, 'open');
    setSelected(stream);
  }

  return (
    <section className="dxGlobalLiveHub">
      <div className="dxGlobalHero">
        <div className="dxHeroCopy"><span className="dxGlobalEyebrow"><Globe2 size={15} /> DROXION LIVE NETWORK</span><h1>Live everywhere.<br /><em>Picked for you.</em></h1><p>Discover YouTube, Twitch and Kick LIVE streams in one personalized home, then watch, chat and support from Droxion.</p><div className="dxHeroProof"><span><Sparkles size={14} /> Personalized</span><span><ShieldCheck size={14} /> Watch inside Droxion</span><span><Radio size={14} /> {totalAvailable || '—'} LIVE now</span></div></div>
        <button type="button" className="dxGlobalRefresh" onClick={() => loadStreams({ manual: true })} disabled={refreshing}><RefreshCw size={17} className={refreshing ? 'spin' : ''} /><span>{refreshing ? 'Refreshing' : 'Refresh LIVE'}</span></button>
      </div>

      <div className="dxControlDeck">
        <div className="dxGlobalProviderRail" aria-label="LIVE sources">
          {providerOptions.map(item => {
            const external = item.id !== 'all' && item.id !== 'droxion';
            const enabled = external ? providers?.[item.id]?.enabled !== false : true;
            const active = provider === item.id;
            const count = external ? Number(providers?.[item.id]?.available || 0) : totalAvailable;
            return <button type="button" key={item.id} className={`${active ? 'active' : ''} ${enabled ? '' : 'disabled'} ${providerClass(item.id)}`} onClick={() => setProvider(item.id)} disabled={!enabled && external}><span>{item.label}</span>{count > 0 && <small>{count}</small>}</button>;
          })}
        </div>

        <div className="dxGlobalCategoryRail" aria-label="LIVE categories">{CATEGORIES.map(item => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
      </div>

      {notice && <div className="dxGlobalNotice">{notice}</div>}
      {!notice && !loading && missingProviders.length > 0 && <div className="dxGlobalSetupNotice"><Search size={16} /><span>{missingProviders.map(item => item[0].toUpperCase() + item.slice(1)).join(', ')} discovery will turn on automatically after its server credentials are added.</span></div>}

      <div className="dxSectionHead"><div><span>LIVE NOW</span><strong>{provider === 'all' ? 'Recommended for you' : `${providerOptions.find(item => item.id === provider)?.label || 'LIVE'} streams`}</strong></div><small>{filtered.length ? `${filtered.length} showing` : 'Fresh results every refresh'}</small></div>

      {provider !== 'droxion' && <>{loading ? <div className="dxGlobalEmpty"><div className="dxLivePulse" />Loading LIVE streams…</div> : filtered.length ? <div className="dxGlobalGrid">{filtered.map(stream => <button type="button" className="dxGlobalCard" key={stream.id} onClick={() => openStream(stream)} data-provider={stream.provider}><div className="dxGlobalThumb">{stream.thumbnailUrl ? <img src={stream.thumbnailUrl} alt="" loading="lazy" /> : <div className="dxGlobalThumbFallback"><Radio size={28} /></div>}<span className="dxGlobalLivePill">LIVE</span><span className={`dxProviderBadge ${providerClass(stream.provider)}`}>{stream.providerLabel}</span><span className="dxGlobalViewers"><Users size={13} /> {formatViewers(stream.viewerCount)}</span></div><div className="dxGlobalCardBody"><div className="dxCardCreator"><span className={`dxCreatorDot ${providerClass(stream.provider)}`}>{String(stream.creatorName || '?').slice(0, 1).toUpperCase()}</span><strong>{stream.creatorName}</strong></div><span className="dxCardTitle">{stream.title}</span><div className="dxCardMeta"><small>{stream.category || 'LIVE'}</small>{stream.language && <small>{String(stream.language).toUpperCase()}</small>}<b>Watch</b></div></div></button>)}</div> : <div className="dxGlobalEmpty"><Radio size={25} /><strong>{providerEmptyMessage(provider, providers, availableProviderCount)}</strong><button type="button" onClick={() => loadStreams({ manual: true })}>Refresh LIVE</button></div>}</>}

      {(provider === 'all' || provider === 'droxion') && nativeLive && <div className="dxNativeLiveSection"><div className="dxNativeLiveHeading"><div><span className="dxProviderBadge droxion">Droxion</span><strong>Native Droxion LIVE</strong></div><p>Droxion creator LIVE.</p></div>{nativeLive}</div>}
      {selected && <ExternalLivePlayer stream={selected} onClose={() => setSelected(null)} currentUserId={currentUserId} coins={coins} onCoinsChanged={onCoinsChanged} onOpenWallet={onOpenWallet} />}
    </section>
  );
}
