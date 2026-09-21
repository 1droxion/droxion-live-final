import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Radio, RefreshCw, Users, Volume2, VolumeX, X } from 'lucide-react';
import ExternalLiveDroxionChat from './ExternalLiveDroxionChat';
import './external-vertical-live-feed.css';

const REFRESH_MS = 90000;
const SWIPE_THRESHOLD = 52;

function formatViewers(value) {
  const count = Number(value || 0);
  if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  return String(Math.max(0, count));
}

function embedUrl(stream, soundEnabled = false) {
  if (!stream) return '';
  const provider = String(stream.provider || '').toLowerCase();
  const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const muted = soundEnabled ? 'false' : 'true';
  const mute = soundEnabled ? '0' : '1';

  if (provider === 'youtube' && stream.externalId) {
    return `https://www.youtube.com/embed/${encodeURIComponent(stream.externalId)}?autoplay=1&mute=${mute}&playsinline=1&rel=0&modestbranding=1&controls=1`;
  }
  if (provider === 'twitch' && stream.channelSlug) {
    return `https://player.twitch.tv/?channel=${encodeURIComponent(stream.channelSlug)}&parent=${encodeURIComponent(parent)}&autoplay=true&muted=${muted}`;
  }
  if (provider === 'kick' && stream.channelSlug) {
    return `https://player.kick.com/${encodeURIComponent(stream.channelSlug)}?autoplay=true&muted=${muted}`;
  }
  if (['tango','liveme','poppo'].includes(provider) && stream.embedUrl) return stream.embedUrl;
  return '';
}

export default function ExternalVerticalLiveFeed({
  currentUserId,
  coins = 0,
  onCoinsChanged,
  onOpenWallet
}) {
  const [streams, setStreams] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [chatOpen, setChatOpen] = useState(true);
  const [interactive, setInteractive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const touchStartYRef = useRef(null);
  const wheelLockRef = useRef(false);

  const active = streams[index] || null;
  const src = useMemo(() => embedUrl(active, soundEnabled), [active, soundEnabled]);

  const load = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/live-hub?limit=80', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`LIVE discovery unavailable (${response.status})`);
      const payload = await response.json();

      const next = (Array.isArray(payload?.streams) ? payload.streams : [])
        .filter(stream => stream?.approvedWoman === true)
        .filter(stream => Boolean(embedUrl(stream, false)));

      setStreams(next);
      setIndex(current => Math.min(current, Math.max(0, next.length - 1)));
      setNotice('');
    } catch (error) {
      setStreams([]);
      setIndex(0);
      setNotice(error?.name === 'AbortError' ? 'LIVE refresh took too long. Tap Refresh LIVE.' : (error?.message || 'Could not load LIVE streams.'));
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
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
    if (interactive || wheelLockRef.current || Math.abs(event.deltaY) < 48) return;
    wheelLockRef.current = true;
    move(event.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => { wheelLockRef.current = false; }, 650);
  }

  function toggleSound() {
    setInteractive(false);
    setSoundEnabled(value => !value);
  }

  if (loading) {
    return (
      <section className="externalLiveLoading">
        <RefreshCw size={30} className="externalLiveSpinner" />
        <strong>Finding women LIVE…</strong>
        <span>Droxion LIVE</span>
      </section>
    );
  }

  if (!active) {
    return (
      <section className="externalLiveLoading">
        <Radio size={30} />
        <strong>No approved women are LIVE right now</strong>
        <span>Droxion only shows approved adult women creators in this feed.</span>
        <button type="button" onClick={() => load({ manual: true })} disabled={refreshing}>
          <RefreshCw size={17} /> {refreshing ? 'Refreshing…' : 'Refresh LIVE'}
        </button>
        {notice && <small>{notice}</small>}
      </section>
    );
  }

  return (
    <section
      className={`externalVerticalLive ${interactive ? 'isInteractive' : ''} ${chatOpen ? 'hasChat' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div className="externalLiveFrameWrap">
        <iframe
          key={`${active.id}:${soundEnabled ? 'sound' : 'muted'}`}
          className="externalLiveFrame"
          src={src}
          title="Droxion LIVE"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <div className="externalLiveShade" />
      </div>

      <header className="externalLiveHeader">
        <div className="externalLiveHeaderLine">
          <span className="externalLiveNow">LIVE</span>
          <strong className="externalLiveCreator">{active.creatorName || 'LIVE creator'}</strong>
          <span className="externalViewerCount"><Users size={13} /> {formatViewers(active.viewerCount)}</span>
        </div>
        <span className="externalLiveTitle">{active.title || 'LIVE now'}</span>
        <small>{active.category || 'LIVE'}{active.language ? ` · ${String(active.language).toUpperCase()}` : ''}</small>
      </header>

      <div className="externalLiveActions">
        <button type="button" onClick={() => setChatOpen(value => !value)} aria-label={chatOpen ? 'Hide chat' : 'Show chat'}>
          {chatOpen ? <X size={18} /> : <MessageCircle size={18} />}
        </button>
        <button
          type="button"
          className={soundEnabled ? 'soundOn' : 'soundOff'}
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Mute LIVE' : 'Turn LIVE sound on'}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      {!soundEnabled && (
        <button type="button" className="externalTapForSound" onClick={toggleSound}>
          <Volume2 size={16} />
          <span>Tap for sound</span>
        </button>
      )}

      {chatOpen && (
        <div
          className="externalLiveChatOverlay"
          onTouchStart={event => event.stopPropagation()}
          onTouchEnd={event => event.stopPropagation()}
          onWheel={event => event.stopPropagation()}
        >
          <ExternalLiveDroxionChat
            stream={active}
            currentUserId={currentUserId}
            coins={coins}
            onCoinsChanged={onCoinsChanged}
            onOpenWallet={onOpenWallet}
            hideProviderBranding
          />
        </div>
      )}

      {!interactive && !chatOpen && <div className="externalSwipeHint">Swipe ↑ for next LIVE</div>}
    </section>
  );
}
