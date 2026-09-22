import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Radio, RefreshCw, Volume2, VolumeX, X } from 'lucide-react';
import ExternalLiveDroxionChat from './ExternalLiveDroxionChat';
import './external-vertical-live-feed.css';

const REFRESH_MS = 90000;
const SWIPE_THRESHOLD = 52;

function embedUrl(stream, soundEnabled = false) {
  if (!stream) return '';
  const provider = String(stream.provider || '').toLowerCase();
  const muted = soundEnabled ? 'false' : 'true';
  const mute = soundEnabled ? '0' : '1';

  if (provider === 'youtube' && stream.externalId) {
    const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
    return `https://www.youtube.com/embed/${encodeURIComponent(stream.externalId)}?autoplay=1&mute=${mute}&playsinline=1&rel=0&modestbranding=1&controls=0&enablejsapi=1${origin ? `&origin=${origin}` : ''}`;
  }

  if (provider === 'kick' && stream.channelSlug) {
    return `https://player.kick.com/${encodeURIComponent(stream.channelSlug)}?autoplay=true&muted=${muted}`;
  }

  if (provider === 'twitch' && stream.channelSlug) {
    const parent = typeof window !== 'undefined' ? encodeURIComponent(window.location.hostname) : '';
    return `https://player.twitch.tv/?channel=${encodeURIComponent(stream.channelSlug)}&autoplay=true&muted=${muted}${parent ? `&parent=${parent}` : ''}`;
  }

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
  const [chatOpen, setChatOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [switching, setSwitching] = useState(false);

  const touchStartYRef = useRef(null);
  const wheelLockRef = useRef(false);
  const playerRef = useRef(null);
  const soundEnabledRef = useRef(false);
  const switchTimerRef = useRef(null);

  const active = streams[index] || null;
  const provider = String(active?.provider || '').toLowerCase();
  const src = useMemo(() => embedUrl(active, soundEnabled), [active, soundEnabled]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

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
        .filter(stream => ['youtube', 'twitch', 'kick'].includes(String(stream?.provider || '').toLowerCase()))
        .filter(stream => Boolean(embedUrl(stream, false)));

      setStreams(next);
      setIndex(current => Math.min(current, Math.max(0, next.length - 1)));
      setNotice('');
    } catch (error) {
      setStreams([]);
      setIndex(0);
      setNotice(error?.name === 'AbortError' ? 'LIVE refresh took too long.' : (error?.message || 'Could not load LIVE streams.'));
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


  useEffect(() => () => {
    if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
  }, []);

  const move = useCallback(direction => {
    if (streams.length < 2) return;

    setSwitching(true);
    setIndex(current => {
      const next = current + direction;
      if (next < 0) return streams.length - 1;
      if (next >= streams.length) return 0;
      return next;
    });

    if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
    switchTimerRef.current = window.setTimeout(() => setSwitching(false), 220);
  }, [streams.length]);

  function nudgeYouTubePlayback(nextSound = soundEnabled) {
    if (provider !== 'youtube') return;
    const frame = playerRef.current;
    if (!frame?.contentWindow) return;

    try {
      frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
      frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: nextSound ? 'unMute' : 'mute', args: [] }), '*');
      if (nextSound) {
        frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), '*');
      }
    } catch {}
  }

  function toggleSound(event) {
    event?.stopPropagation?.();
    const next = !soundEnabled;
    soundEnabledRef.current = next;

    if ((provider === 'twitch' || provider === 'kick') && playerRef.current) {
      const nextSrc = embedUrl(active, next);
      if (nextSrc) {
        try {
          playerRef.current.src = nextSrc;
        } catch {}
      }
      setSoundEnabled(next);
      return;
    }

    setSoundEnabled(next);

    if (provider === 'youtube') {
      window.setTimeout(() => nudgeYouTubePlayback(next), 0);
    }
  }

  function handleTouchStart(event) {
    touchStartYRef.current = event.touches?.[0]?.clientY ?? null;
  }

  function handleTouchEnd(event) {
    const start = touchStartYRef.current;
    touchStartYRef.current = null;
    if (start == null) return;

    const end = event.changedTouches?.[0]?.clientY ?? start;
    const delta = end - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    move(delta < 0 ? 1 : -1);
  }

  function handleWheel(event) {
    if (wheelLockRef.current || Math.abs(event.deltaY) < 34) return;
    wheelLockRef.current = true;
    move(event.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => {
      wheelLockRef.current = false;
    }, 420);
  }

  if (loading) {
    return (
      <section className="externalLiveLoading">
        <RefreshCw size={28} className="externalLiveSpinner" />
        <strong>Finding LIVE streams…</strong>
      </section>
    );
  }

  if (!active) {
    return (
      <section className="externalLiveLoading">
        <Radio size={28} />
        <strong>No LIVE streams right now</strong>
        <button type="button" onClick={() => load({ manual: true })} disabled={refreshing}>
          <RefreshCw size={17} /> {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        {notice && <small>{notice}</small>}
      </section>
    );
  }

  return (
    <section
      className={`externalVerticalLive provider-${provider} ${chatOpen ? 'hasChat' : ''} ${soundEnabled ? 'hasSound' : ''} ${switching ? 'isSwitching' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div className="externalLiveFrameWrap">
        <iframe
            ref={playerRef}
            key={active.id}
            className="externalLiveFrame"
            src={src}
            title="Droxion LIVE"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="eager"
            onLoad={() => {
              if (provider === 'youtube') {
                window.setTimeout(() => nudgeYouTubePlayback(soundEnabled), 80);
                window.setTimeout(() => nudgeYouTubePlayback(soundEnabled), 420);
              }
            }}
          />
        <div className="externalLiveShade" />
      </div>

      <div className="externalLiveMinimalTop">
        <span>LIVE</span>
        <strong>{active.creatorName || 'Creator'}</strong>
      </div>

      <div className="externalLiveRightControls">
        <button
          type="button"
          className={`externalSoundToggle ${soundEnabled ? 'on' : ''}`}
          onPointerDown={event => event.stopPropagation()}
          onTouchStart={event => event.stopPropagation()}
          onTouchEnd={event => event.stopPropagation()}
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Mute LIVE' : 'Unmute LIVE'}
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>

        <button
          type="button"
          className="externalChatToggle"
          onPointerDown={event => event.stopPropagation()}
          onTouchStart={event => event.stopPropagation()}
          onTouchEnd={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation();
            setChatOpen(value => !value);
          }}
          aria-label={chatOpen ? 'Hide chat' : 'Show chat'}
        >
          {chatOpen ? <X size={19} /> : <MessageCircle size={20} />}
        </button>
      </div>

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
    </section>
  );
}
