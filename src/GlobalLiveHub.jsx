import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Globe2, Radio, RefreshCw, Search, Users, X } from 'lucide-react';
import './global-live-hub.css';

const PROVIDERS = [
  { id: 'all', label: 'All LIVE' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitch', label: 'Twitch' },
  { id: 'kick', label: 'Kick' },
  { id: 'droxion', label: 'Droxion' }
];

const CATEGORIES = ['All', 'Gaming', 'IRL', 'Music', 'Sports', 'Talk'];
const REFRESH_MS = 120000;

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

function ExternalLivePlayer({ stream, onClose }) {
  const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
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
      <section className="dxLiveModalSheet">
        <div className="dxLiveModalTop">
          <div>
            <span className={`dxProviderBadge ${providerClass(stream?.provider)}`}>{stream?.providerLabel || 'LIVE'}</span>
            <strong>{stream?.creatorName || 'Creator'}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Close LIVE"><X size={22} /></button>
        </div>
        <div className="dxLivePlayerFrame">
          {src ? <iframe
            src={src}
            title={`${stream?.creatorName || 'Creator'} LIVE`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          /> : <div className="dxLivePlayerFallback">This LIVE opens on {stream?.providerLabel || 'the source platform'}.</div>}
        </div>
        <div className="dxLiveModalMeta">
          <div><Radio size={17} /><span>{stream?.title || 'LIVE now'}</span></div>
          <div className="dxLiveModalActions">
            <span><Users size={16} /> {formatViewers(stream?.viewerCount)} watching</span>
            <a href={stream?.watchUrl} target="_blank" rel="noreferrer">Open source <ExternalLink size={15} /></a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function GlobalLiveHub({ query = '', nativeLive = null }) {
  const [streams, setStreams] = useState([]);
  const [providers, setProviders] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [provider, setProvider] = useState('all');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState(null);
  const refreshTimerRef = useRef(null);

  const loadStreams = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch('/api/live-hub?limit=48', { headers: { Accept: 'application/json' } });
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
    return streams.filter(stream => {
      if (provider !== 'all' && stream.provider !== provider) return false;
      if (category !== 'All' && String(stream.category || '').toLowerCase() !== category.toLowerCase()) return false;
      if (!q) return true;
      const haystack = `${stream.creatorName || ''} ${stream.title || ''} ${stream.category || ''} ${stream.providerLabel || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [streams, query, provider, category]);

  const availableProviderCount = Object.values(providers).filter(value => value?.enabled && Number(value?.available || 0) > 0).length;
  const missingProviders = Object.entries(providers).filter(([, value]) => value?.reason === 'missing_credentials').map(([key]) => key);

  return (
    <section className="dxGlobalLiveHub">
      <div className="dxGlobalHero">
        <div>
          <span className="dxGlobalEyebrow"><Globe2 size={15} /> LIVE across the internet</span>
          <h1>One place for everything LIVE.</h1>
          <p>Discover creators live right now across supported platforms without jumping between apps.</p>
        </div>
        <button type="button" className="dxGlobalRefresh" onClick={() => loadStreams({ manual: true })} disabled={refreshing}>
          <RefreshCw size={17} className={refreshing ? 'spin' : ''} />
          <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </div>

      <div className="dxGlobalProviderRail" aria-label="LIVE sources">
        {PROVIDERS.map(item => {
          const external = item.id !== 'all' && item.id !== 'droxion';
          const enabled = external ? providers?.[item.id]?.enabled !== false : true;
          const active = provider === item.id;
          return <button
            type="button"
            key={item.id}
            className={`${active ? 'active' : ''} ${enabled ? '' : 'disabled'}`}
            onClick={() => setProvider(item.id)}
            disabled={!enabled && external}
          >
            <span>{item.label}</span>
            {external && Number(providers?.[item.id]?.available || 0) > 0 && <small>{providers[item.id].available}</small>}
          </button>;
        })}
      </div>

      <div className="dxGlobalCategoryRail" aria-label="LIVE categories">
        {CATEGORIES.map(item => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>

      {notice && <div className="dxGlobalNotice">{notice}</div>}
      {!notice && !loading && missingProviders.length > 0 && <div className="dxGlobalSetupNotice">
        <Search size={16} />
        <span>{missingProviders.map(item => item[0].toUpperCase() + item.slice(1)).join(', ')} discovery will turn on automatically after its server credentials are added.</span>
      </div>}

      {provider !== 'droxion' && <>
        {loading ? <div className="dxGlobalEmpty">Loading LIVE streams…</div> : filtered.length ? <div className="dxGlobalGrid">
          {filtered.map(stream => <button type="button" className="dxGlobalCard" key={stream.id} onClick={() => setSelected(stream)}>
            <div className="dxGlobalThumb">
              {stream.thumbnailUrl ? <img src={stream.thumbnailUrl} alt="" loading="lazy" /> : <div className="dxGlobalThumbFallback"><Radio size={28} /></div>}
              <span className="dxGlobalLivePill">LIVE</span>
              <span className={`dxProviderBadge ${providerClass(stream.provider)}`}>{stream.providerLabel}</span>
              <span className="dxGlobalViewers"><Users size={13} /> {formatViewers(stream.viewerCount)}</span>
            </div>
            <div className="dxGlobalCardBody">
              <strong>{stream.creatorName}</strong>
              <span>{stream.title}</span>
              <small>{stream.category || 'LIVE'}</small>
            </div>
          </button>)}
        </div> : <div className="dxGlobalEmpty">{availableProviderCount === 0 ? 'Connect the first LIVE source to populate Droxion.' : 'No matching LIVE streams right now.'}</div>}
      </>}

      {(provider === 'all' || provider === 'droxion') && nativeLive && <div className="dxNativeLiveSection">
        <div className="dxNativeLiveHeading">
          <div><span className="dxProviderBadge droxion">Droxion</span><strong>Native Droxion LIVE</strong></div>
          <p>Existing Droxion LIVE stays available while global discovery grows.</p>
        </div>
        {nativeLive}
      </div>}

      {selected && <ExternalLivePlayer stream={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
