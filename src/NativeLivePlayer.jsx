import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const TWITCH_SCRIPT = 'https://player.twitch.tv/js/embed/v1.js';
const TWITCH_WIDTH = 400;
const TWITCH_HEIGHT = 300;
const TWITCH_PLAYER_ID = 'droxion-native-twitch-player';

function twitchParents() {
  const parents = new Set(['www.droxion.com', 'droxion.com', 'localhost']);
  try {
    if (window.location.hostname) parents.add(window.location.hostname);
    Array.from(window.location.ancestorOrigins || []).forEach(origin => {
      const hostname = new URL(origin).hostname;
      if (hostname) parents.add(hostname);
    });
  } catch {}
  return [...parents].filter(Boolean);
}

export default function NativeLivePlayer() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const provider = String(params.get('provider') || '').toLowerCase();
  const id = String(params.get('id') || '').trim();
  const slug = String(params.get('slug') || '').trim();
  const isTwitch = provider === 'twitch' && Boolean(slug);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? TWITCH_WIDTH : window.innerWidth));
  const [twitchFailed, setTwitchFailed] = useState(false);
  const twitchPlayerRef = useRef(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlBackground = html.style.background;
    const previousBodyBackground = body.style.background;
    const previousBodyMargin = body.style.margin;
    html.style.background = '#000';
    body.style.background = '#000';
    body.style.margin = '0';
    return () => {
      html.style.background = previousHtmlBackground;
      body.style.background = previousBodyBackground;
      body.style.margin = previousBodyMargin;
    };
  }, []);

  useEffect(() => {
    if (!isTwitch) return undefined;
    const resize = () => setViewportWidth(window.innerWidth || TWITCH_WIDTH);
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [isTwitch]);

  useEffect(() => {
    if (!isTwitch) return undefined;

    let cancelled = false;
    let player = null;
    let script = document.querySelector(`script[src="${TWITCH_SCRIPT}"]`);

    setTwitchFailed(false);

    const mountPlayer = () => {
      if (cancelled || !window.Twitch?.Player) return;
      const host = document.getElementById(TWITCH_PLAYER_ID);
      if (!host) return;
      host.replaceChildren();

      try {
        player = new window.Twitch.Player(TWITCH_PLAYER_ID, {
          channel: slug,
          width: TWITCH_WIDTH,
          height: TWITCH_HEIGHT,
          autoplay: false,
          muted: true,
          parent: twitchParents()
        });
        twitchPlayerRef.current = player;
      } catch (error) {
        console.warn('Droxion Twitch player could not start', error);
        setTwitchFailed(true);
      }
    };

    if (window.Twitch?.Player) {
      mountPlayer();
    } else if (script) {
      script.addEventListener('load', mountPlayer, { once: true });
      script.addEventListener('error', () => setTwitchFailed(true), { once: true });
    } else {
      script = document.createElement('script');
      script.src = TWITCH_SCRIPT;
      script.async = true;
      script.addEventListener('load', mountPlayer, { once: true });
      script.addEventListener('error', () => setTwitchFailed(true), { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      try { player?.destroy?.(); } catch {}
      if (twitchPlayerRef.current === player) twitchPlayerRef.current = null;
    };
  }, [isTwitch, slug]);

  let youtubeSrc = '';
  if (provider === 'youtube' && id) {
    youtubeSrc = `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`;
  }

  const twitchScale = Math.min(1, Math.max(0.5, Number(viewportWidth || TWITCH_WIDTH) / TWITCH_WIDTH));
  const twitchViewportHeight = Math.round(TWITCH_HEIGHT * twitchScale);

  return (
    <main style={{ margin: 0, width: '100vw', height: '100vh', minHeight: isTwitch ? twitchViewportHeight : 300, background: '#000', overflow: 'hidden' }}>
      {isTwitch ? (
        <div style={{ position: 'relative', width: '100%', height: twitchViewportHeight, minHeight: twitchViewportHeight, overflow: 'hidden', background: '#000' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', width: TWITCH_WIDTH, height: TWITCH_HEIGHT, marginLeft: -(TWITCH_WIDTH / 2), transform: `scale(${twitchScale})`, transformOrigin: 'top center', background: '#000' }}>
            {twitchFailed ? (
              <iframe
                src={`https://player.twitch.tv/?channel=${encodeURIComponent(slug)}${twitchParents().map(parent => `&parent=${encodeURIComponent(parent)}`).join('')}&autoplay=false&muted=true`}
                title="Droxion Twitch LIVE"
                width={TWITCH_WIDTH}
                height={TWITCH_HEIGHT}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ display: 'block', width: TWITCH_WIDTH, height: TWITCH_HEIGHT, border: 0, background: '#000' }}
              />
            ) : <div id={TWITCH_PLAYER_ID} style={{ width: TWITCH_WIDTH, height: TWITCH_HEIGHT, background: '#000' }} />}
          </div>
        </div>
      ) : youtubeSrc ? (
        <iframe
          src={youtubeSrc}
          title="Droxion LIVE"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ display: 'block', width: '100%', height: '100%', minHeight: 300, border: 0, background: '#000' }}
        />
      ) : null}
    </main>
  );
}
