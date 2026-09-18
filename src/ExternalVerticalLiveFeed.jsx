import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Radio, RefreshCw, Users, Volume2, X } from 'lucide-react';
import './external-vertical-live-feed.css';

const ALLOWED_PROVIDERS = new Set(['youtube', 'twitch', 'kick']);
const REFRESH_MS = 120000;
const SWIPE_THRESHOLD = 54;

function formatViewers(value) {
  const count = Number(value || 0);
  if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  return String(Math.max(0, count));
}

function providerLabel(provider) {
  if (provider === 'youtube') return 'YouTube';
  if (provider === 'twitch') return 'Twitch';
  if (provider === 'kick') return 'Kick';
  if (provider === 'tango') return 'Tango';
  return 'LIVE';
}

function embedUrl(stream) {
  if (!stream) return '';
  const provider = String(stream.provider || '').toLowerCase();
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  if (provider === 'youtube' && stream.externalId) {
    return `https://www.youtube.com/embed/${encodeURIComponent(stream.externalId)}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;
  }
  if (provider === 'twitch' && stream.channelSlug) {
    return `https://player.twitch.tv/?channel=${encodeURIComponent(stream.channelSlug)}&parent=${encodeURIComponent(host)}&autoplay=true`;
  }
  if (provider === 'kick' && stream.channelSlug) {
    return `https://player.kick.com/${encodeURIComponent(stream.channelSlug)}`;
  }
  if (provider === 'tango') {
    return 'https://tango.me/';
  }
  return '';
}

function tangoFeedCard() {
  return {
    id: 'tango:feed',
    provider: 'tango',
    providerLabel: 'Tango',
    externalId: 'feed',
    channelSlug: '',
    creatorName: 'Tango LIVE',
    title: 'Tango LIVE Feed',
    category: 'LIVE',
    language: '',
    viewerCount: 0,
    watchUrl: 'https://tango.me/',
    embedType: 'tango',
    isTangoFeed: true
  };
}

function interleaveTango(rows) {
  const base = rows.slice(0, 60);
  const tango = tangoFeedCard();
  if (base.length <= 3) return [tango, ...base];

  const output = [];
  const insertAt = Math.min(3, base.length);
  base.forEach((stream, index) => {
    if (index === insertAt) output.push(tango);
    output.push(stream);
  });
  return output;
}

export default function ExternalVerticalLiveFeed() {
  const [streams, setStreams] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [interactive, setInteractive] = useState(false);

  const touchStartYRef = useRef(null);
  const wheelLockRef = useRef(false);

  const active = streams[index] || null;
  const src = useMemo(() => embedUrl(active), [active]);

  const load = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);

    try {
      const response = await fetch('/api/live-hub?limit=90', {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`LIVE discovery unavailable (${response.status})`);
      const data = await response.json();
      const rows = (Array.isArray(data?.streams) ? data.streams : [])
        .filter(stream => ALLOWED_PROVIDERS.has(String(stream?.provider || '').toLowerCase()));

      const next = interleaveTango(rows);
      setStreams(next);
      setIndex(current => Math.min(current, Math.max(0, next.length - 1)));
      setNotice('');
    } catch (error) {
      setNotice(error?.message || 'Could not load LIVE streams.');
      setStreams([tangoFeedCard()]);
      setIndex(0);
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') load();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    setInteractive(false);
  }, [active?.id]);

  const move = useCallback(direction => {
    if (interactive || streams.length < 2) return;
    setIndex(current => {
      const next = current + direction;
      if (next < 0) return streams.length - 1;
      if (next >= streams.length) return 0;
      return next;
    });
  }, [interactive, streams.length]);

  function handleTouchStart(event) {
    if (interactive) return;
    touchStartYRef.current = event.touches?.[0]?.clientY ?? null;
  }

  function handleTouchEnd(event) {
    if (interactive) return;
    const start = touchStartYRef.current;
    touchStartYRef.current = null;
    if (start == null) return;
    const end = event.changedTouches?.[0]?.clientY ?? start;
    const delta = end - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    move(delta < 0 ? 1 : -1);
  }

  function handleWheel(event) {
    if (interactive || wheelLockRef.current || Math.abs(event.deltaY) < 45) return;
    wheelLockRef.current = true;
    move(event.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => { wheelLockRef.current = false; }, 650);
  }

  if (loading) {
    return (
      <section className="externalLiveLoading">
        <RefreshCw size={30} className="externalLiveSpinner" />
        <strong>Loading LIVE…</strong>
        <span>YouTube · Twitch · Kick · Tango</span>
      </section>
    );
  }

  if (!active) {
    return (
      <section className="externalLiveLoading">
        <Radio size={30} />
        <strong>LIVE is unavailable right now</strong>
        <button type="button" onClick={() => load({ manual: true })} disabled={refreshing}>
          <RefreshCw size={17} /> {refreshing ? 'Refreshing…' : 'Refresh LIVE'}
        </button>
      </section>
    );
  }

  return (
    <section
      className={`externalVerticalLive ${interactive ? 'isInteractive' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div className="externalLiveFrameWrap">
        {src ? (
          <iframe
            key={active.id}
            className="externalLiveFrame"
            src={src}
            title={`${providerLabel(active.provider)} LIVE`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="externalLiveFallback">
            <Radio size={34} />
            <strong>This LIVE cannot play inside Droxion.</strong>
          </div>
        )}
        <div className="externalLiveShade" />
      </div>

      <div className="externalLiveTop">
        <span className={`externalProviderBadge ${active.provider}`}>{providerLabel(active.provider)}</span>
        <span className="externalLiveNow">LIVE</span>
        {!active.isTangoFeed && (
          <span className="externalViewerCount"><Users size={14} /> {formatViewers(active.viewerCount)}</span>
        )}
      </div>

      <div className="externalLiveMeta">
        <strong>{active.creatorName || providerLabel(active.provider)}</strong>
        <span>{active.title || 'LIVE now'}</span>
        <small>{active.category || 'LIVE'}{active.language ? ` · ${String(active.language).toUpperCase()}` : ''}</small>
      </div>

      <div className="externalLiveActions">
        <button type="button" onClick={() => setInteractive(value => !value)}>
          {interactive ? <X size={18} /> : <Volume2 size={18} />}
          <span>{interactive ? 'Back to swipe' : 'Tap to interact / sound'}</span>
        </button>
        <a href={active.watchUrl || 'https://tango.me/'} target="_blank" rel="noreferrer">
          <ExternalLink size={18} />
          <span>Open source</span>
        </a>
      </div>

      {!interactive && <div className="externalSwipeHint">Swipe ↑ for next LIVE</div>}

      {notice && <div className="externalLiveNotice">{notice}</div>}

      <button
        type="button"
        className="externalRefreshButton"
        onClick={() => load({ manual: true })}
        disabled={refreshing}
        aria-label="Refresh LIVE sources"
      >
        <RefreshCw size={17} className={refreshing ? 'externalLiveSpinner' : ''} />
      </button>
    </section>
  );
}
