import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flame, Gamepad2, Globe2, Link2, Radio, Search, Unplug, Users, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import './profile-discovery-enhancer.css';

const PROVIDERS = [
  { id: 'youtube', label: 'YouTube', mark: 'YT' },
  { id: 'twitch', label: 'Twitch', mark: 'TW' },
  { id: 'kick', label: 'Kick', mark: 'K' }
];

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

function normalizeChannelIdentifier(provider, value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let clean = raw;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    if (provider === 'youtube' && /(^|\.)youtube\.com$/.test(host)) {
      if (parts[0] === 'channel' && parts[1]) clean = parts[1];
      else if (parts[0]?.startsWith('@')) clean = parts[0];
      else if (parts[0]) clean = parts[0];
    } else if (provider === 'twitch' && /(^|\.)twitch\.tv$/.test(host) && parts[0]) {
      clean = parts[0];
    } else if (provider === 'kick' && /(^|\.)kick\.com$/.test(host) && parts[0]) {
      clean = parts[0];
    }
  } catch {}
  return clean.replace(/^\/+|\/+$/g, '').trim().slice(0, 180);
}

function normalizedMatchValue(value) {
  return String(value || '').trim().toLowerCase().replace(/^@/, '').replace(/\s+/g, ' ');
}

function connectionMatchesStream(connection, stream) {
  if (!connection || connection.provider !== stream?.provider) return false;
  const target = normalizedMatchValue(connection.channel_identifier);
  if (!target) return false;
  const candidates = [stream?.channelId, stream?.channelSlug, stream?.creatorName]
    .map(normalizedMatchValue)
    .filter(Boolean);
  return candidates.some(value => value === target || value.endsWith(`/${target}`));
}

function searchScore(stream, query) {
  const q = normalizedMatchValue(query);
  if (!q) return Math.log10(Math.max(1, Number(stream?.viewerCount || 0)) + 1) * 20;
  const creator = normalizedMatchValue(stream?.creatorName);
  const title = normalizedMatchValue(stream?.title);
  const category = normalizedMatchValue(stream?.category);
  const provider = normalizedMatchValue(stream?.providerLabel || stream?.provider);
  const language = normalizedMatchValue(stream?.language);
  let score = 0;
  if (creator === q) score += 1200;
  else if (creator.startsWith(q)) score += 900;
  else if (creator.includes(q)) score += 700;
  if (title === q) score += 650;
  else if (title.startsWith(q)) score += 520;
  else if (title.includes(q)) score += 420;
  if (category === q) score += 360;
  else if (category.includes(q)) score += 220;
  if (provider === q || provider.includes(q)) score += 180;
  if (language === q) score += 70;
  score += Math.log10(Math.max(1, Number(stream?.viewerCount || 0)) + 1) * 28;
  return score;
}

function matchesSearch(stream, query) {
  const q = normalizedMatchValue(query);
  if (!q) return true;
  return [stream?.creatorName, stream?.title, stream?.category, stream?.providerLabel, stream?.provider, stream?.language]
    .some(value => normalizedMatchValue(value).includes(q));
}

function isGaming(stream) {
  const text = `${stream?.category || ''} ${stream?.title || ''}`.toLowerCase();
  return /game|gaming|esport|gta|grand theft auto|minecraft|valorant|fortnite|call of duty|warzone|roblox|pubg|free fire|league of legends|counter.?strike|fifa/.test(text);
}

function uniqueCreators(streams, limit = 10) {
  const seen = new Set();
  const result = [];
  for (const stream of [...streams].sort((a, b) => Number(b.viewerCount || 0) - Number(a.viewerCount || 0))) {
    const key = `${stream.provider}:${stream.channelId || stream.channelSlug || stream.creatorName}`.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(stream);
    if (result.length >= limit) break;
  }
  return result;
}

function LiveCard({ stream, onOpen }) {
  return <button type="button" className="pdLiveCard" onClick={() => onOpen(stream)}>
    <span className="pdLiveThumb">
      {stream.thumbnailUrl ? <img src={stream.thumbnailUrl} alt="" loading="lazy" /> : <span className="pdLiveThumbFallback"><Radio size={25} /></span>}
      <i>LIVE</i>
      <b>{formatViewers(stream.viewerCount)} watching</b>
    </span>
    <span className="pdLiveCardBody">
      <span className={`pdProvider ${providerClass(stream.provider)}`}>{stream.providerLabel || stream.provider}</span>
      <strong>{stream.creatorName || 'Creator'}</strong>
      <small>{stream.title || 'LIVE now'}</small>
    </span>
  </button>;
}

function CreatorCard({ stream, onOpen }) {
  const name = stream?.creatorName || 'Creator';
  return <button type="button" className="pdCreatorCard" onClick={() => onOpen(stream)}>
    <span className={`pdCreatorAvatar ${providerClass(stream.provider)}`}>{name.slice(0, 1).toUpperCase()}</span>
    <span><strong>{name}</strong><small>{stream.providerLabel || stream.provider} · {formatViewers(stream.viewerCount)} watching</small></span>
    <i>LIVE</i>
  </button>;
}

function InternalLivePlayer({ stream, onClose }) {
  const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  let src = '';
  if (stream?.embedType === 'youtube' && stream.externalId) src = `https://www.youtube.com/embed/${encodeURIComponent(stream.externalId)}?autoplay=1&playsinline=1&rel=0`;
  else if (stream?.embedType === 'twitch' && stream.channelSlug) src = `https://player.twitch.tv/?channel=${encodeURIComponent(stream.channelSlug)}&parent=${encodeURIComponent(parent)}&autoplay=true`;
  else if (stream?.embedType === 'kick' && stream.channelSlug) src = `https://player.kick.com/${encodeURIComponent(stream.channelSlug)}`;

  return <div className="pdPlayer" role="dialog" aria-modal="true" aria-label={`${stream?.creatorName || 'Creator'} LIVE`}>
    <button type="button" className="pdPlayerBackdrop" onClick={onClose} aria-label="Close LIVE" />
    <section className="pdPlayerSheet">
      <header><div><span className={`pdProvider ${providerClass(stream?.provider)}`}>{stream?.providerLabel || 'LIVE'}</span><strong>{stream?.creatorName || 'Creator'}</strong></div><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
      <div className="pdPlayerFrame">{src ? <iframe src={src} title={`${stream?.creatorName || 'Creator'} LIVE`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <div>LIVE player unavailable.</div>}</div>
      <footer><strong>{stream?.title || 'LIVE now'}</strong><span>{formatViewers(stream?.viewerCount)} watching · Watch inside Droxion</span></footer>
    </section>
  </div>;
}

export default function ProfileDiscoveryEnhancer() {
  const [host, setHost] = useState(null);
  const [userId, setUserId] = useState('');
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [connections, setConnections] = useState([]);
  const [editingProvider, setEditingProvider] = useState('');
  const [channelInput, setChannelInput] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const sync = session => { if (alive) setUserId(session?.user?.id || ''); };
    supabase.auth.getSession().then(({ data }) => sync(data?.session)).catch(() => sync(null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => sync(session));
    return () => { alive = false; data?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    let lastHost = null;
    const attach = () => {
      const active = Boolean(document.querySelector('.lfNav button[data-tab="profile"].active')) && window.location.pathname === '/';
      const content = active ? document.querySelector('.lfContent') : null;
      if (!active || !(content instanceof HTMLElement)) {
        setHost(null);
        if (lastHost?.isConnected) lastHost.remove();
        lastHost = null;
        return;
      }
      let node = content.querySelector(':scope > .profileDiscoveryEnhancerHost');
      if (!(node instanceof HTMLElement)) {
        node = document.createElement('div');
        node.className = 'profileDiscoveryEnhancerHost';
        content.appendChild(node);
      }
      lastHost = node;
      setHost(current => current === node ? current : node);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    const timer = window.setInterval(attach, 800);
    return () => { observer.disconnect(); window.clearInterval(timer); if (lastHost?.isConnected) lastHost.remove(); };
  }, []);

  useEffect(() => {
    if (!host) return undefined;
    let alive = true;
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      setLoading(current => streams.length ? current : true);
      try {
        const bucket = Math.floor(Date.now() / 120000);
        const response = await fetch(`/api/live-hub?limit=150&profile_bucket=${bucket}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (!response.ok) throw new Error(`LIVE discovery unavailable (${response.status})`);
        const payload = await response.json();
        if (alive) setStreams(Array.isArray(payload?.streams) ? payload.streams : []);
      } catch (error) {
        if (alive) setNotice(error?.message || 'Could not refresh LIVE discovery.');
      } finally {
        busy = false;
        if (alive) setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, 60000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [host]);

  useEffect(() => {
    if (!userId) { setConnections([]); return; }
    let alive = true;
    supabase.from('droxion_creator_platform_connections')
      .select('provider,channel_identifier,channel_url,display_name,enabled,verified,updated_at')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setNotice('Could not load connected creator platforms.');
        else setConnections(data || []);
      });
    return () => { alive = false; };
  }, [userId]);

  const ranked = useMemo(() => [...streams]
    .filter(stream => matchesSearch(stream, query))
    .sort((a, b) => searchScore(b, query) - searchScore(a, query)), [streams, query]);
  const trending = useMemo(() => [...streams].sort((a, b) => Number(b.viewerCount || 0) - Number(a.viewerCount || 0)).slice(0, 12), [streams]);
  const gaming = useMemo(() => [...streams].filter(isGaming).sort((a, b) => Number(b.viewerCount || 0) - Number(a.viewerCount || 0)).slice(0, 12), [streams]);
  const creators = useMemo(() => uniqueCreators(streams, 10), [streams]);
  const connectionLive = useMemo(() => connections.map(connection => ({ connection, stream: streams.find(stream => connectionMatchesStream(connection, stream)) || null })), [connections, streams]);

  function startConnection(provider) {
    const existing = connections.find(item => item.provider === provider);
    setEditingProvider(provider);
    setChannelInput(existing?.channel_url || existing?.channel_identifier || '');
    setNotice('');
  }

  async function saveConnection() {
    if (!userId || !editingProvider || saving) return;
    const identifier = normalizeChannelIdentifier(editingProvider, channelInput);
    if (!identifier) { setNotice('Enter your channel URL, handle or username.'); return; }
    setSaving(true);
    const raw = String(channelInput || '').trim();
    const channelUrl = /^https?:\/\//i.test(raw) ? raw.slice(0, 500) : null;
    const { error } = await supabase.from('droxion_creator_platform_connections').upsert({
      user_id: userId,
      provider: editingProvider,
      channel_identifier: identifier,
      channel_url: channelUrl,
      display_name: identifier,
      enabled: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,provider' });
    setSaving(false);
    if (error) { setNotice(error.message || 'Could not connect this channel.'); return; }
    setConnections(current => [...current.filter(item => item.provider !== editingProvider), { provider: editingProvider, channel_identifier: identifier, channel_url: channelUrl, display_name: identifier, enabled: true, verified: false }]);
    setEditingProvider('');
    setChannelInput('');
    setNotice('Channel connected to your Droxion creator profile.');
    window.setTimeout(() => setNotice(''), 2500);
  }

  async function disconnect(provider) {
    if (!userId) return;
    const { error } = await supabase.from('droxion_creator_platform_connections').delete().eq('user_id', userId).eq('provider', provider);
    if (error) { setNotice('Could not disconnect this channel.'); return; }
    setConnections(current => current.filter(item => item.provider !== provider));
  }

  if (!host) return null;

  return createPortal(<section className="pdRoot" aria-label="Droxion profile LIVE discovery">
    {userId ? <section className="pdConnections">
      <header className="pdSectionHeader"><div><span><Link2 size={14} /> CREATOR SOURCES</span><h2>Connected platforms</h2><p>Add your YouTube, Twitch or Kick channel so Droxion can identify your creator source and surface a matching LIVE when it appears in discovery.</p></div></header>
      <div className="pdConnectionGrid">{PROVIDERS.map(provider => {
        const connected = connections.find(item => item.provider === provider.id);
        const live = connectionLive.find(item => item.connection.provider === provider.id)?.stream;
        return <article className={`pdConnectionCard ${providerClass(provider.id)} ${connected ? 'connected' : ''}`} key={provider.id}>
          <div className="pdConnectionMark">{provider.mark}</div>
          <div className="pdConnectionInfo"><strong>{provider.label}</strong><span>{connected ? connected.channel_identifier : 'Not connected'}</span>{live && <button type="button" className="pdConnectionLive" onClick={() => setSelected(live)}><i /> LIVE now · Watch</button>}</div>
          {connected ? <div className="pdConnectionActions"><button type="button" onClick={() => startConnection(provider.id)}>Edit</button><button type="button" className="danger" onClick={() => disconnect(provider.id)} aria-label={`Disconnect ${provider.label}`}><Unplug size={15} /></button></div> : <button type="button" className="pdConnectButton" onClick={() => startConnection(provider.id)}>Connect</button>}
        </article>;
      })}</div>
    </section> : <section className="pdSignedOutCallout"><div><Globe2 size={19} /><span><strong>Discover more before you sign in</strong><small>Search LIVE creators, gaming streams and popular channels below.</small></span></div><div><button type="button" onClick={() => window.location.assign('/login')}>Sign in</button><button type="button" className="secondary" onClick={() => window.location.assign('/signup')}>Create account</button></div></section>}

    <section className="pdDiscovery">
      <header className="pdDiscoveryHero"><div><span><Radio size={14} /> LIVE DISCOVERY</span><h2>More LIVE. More creators.</h2><p>Popular streams from YouTube, Twitch and Kick, ranked by relevance and viewers.</p></div><label><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search creator, game, LIVE title or platform" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</label></header>
      {notice && <div className="pdNotice">{notice}</div>}
      {loading && !streams.length ? <div className="pdLoading"><span />Loading LIVE streams…</div> : <>
        {query && <section className="pdRailSection"><header><div><Search size={15} /><strong>Best matches</strong></div><small>{ranked.length} LIVE found</small></header>{ranked.length ? <div className="pdLiveRail">{ranked.slice(0, 16).map(stream => <LiveCard key={`search:${stream.id}`} stream={stream} onOpen={setSelected} />)}</div> : <div className="pdEmpty">No LIVE match yet. Try a creator name, game, YouTube, Twitch or Kick.</div>}</section>}
        {!query && <>
          <section className="pdRailSection"><header><div><Flame size={15} /><strong>Trending LIVE now</strong></div><small>Highest viewers first</small></header><div className="pdLiveRail">{trending.map(stream => <LiveCard key={`trend:${stream.id}`} stream={stream} onOpen={setSelected} />)}</div></section>
          <section className="pdRailSection"><header><div><Gamepad2 size={15} /><strong>Gaming LIVE</strong></div><small>GTA · Minecraft · Valorant · Fortnite + more</small></header>{gaming.length ? <div className="pdLiveRail">{gaming.map(stream => <LiveCard key={`game:${stream.id}`} stream={stream} onOpen={setSelected} />)}</div> : <div className="pdEmpty">Gaming LIVE will appear here as providers refresh.</div>}</section>
          <section className="pdRailSection"><header><div><Users size={15} /><strong>Popular creators</strong></div><small>LIVE across the network</small></header><div className="pdCreatorRail">{creators.map(stream => <CreatorCard key={`creator:${stream.provider}:${stream.channelId || stream.channelSlug || stream.creatorName}`} stream={stream} onOpen={setSelected} />)}</div></section>
        </>}
      </>}
    </section>

    {editingProvider && <div className="pdConnectModal" role="dialog" aria-modal="true" aria-label="Connect creator platform"><button type="button" className="pdConnectBackdrop" onClick={() => setEditingProvider('')} aria-label="Close" /><section><header><div><span className={`pdProvider ${providerClass(editingProvider)}`}>{PROVIDERS.find(item => item.id === editingProvider)?.label}</span><strong>Connect creator channel</strong></div><button type="button" onClick={() => setEditingProvider('')} aria-label="Close"><X size={18} /></button></header><p>Paste your channel URL, @handle, channel ID or username. This saves the creator source to your Droxion profile; it does not ask for your platform password.</p><input autoFocus value={channelInput} onChange={event => setChannelInput(event.target.value)} placeholder={editingProvider === 'youtube' ? 'youtube.com/@yourchannel or UC…' : `${editingProvider}.com/yourchannel`} onKeyDown={event => { if (event.key === 'Enter') saveConnection(); }} /><button type="button" className="pdSaveConnection" onClick={saveConnection} disabled={saving}>{saving ? 'Connecting…' : 'Connect channel'}</button></section></div>}
    {selected && <InternalLivePlayer stream={selected} onClose={() => setSelected(null)} />}
  </section>, host);
}
