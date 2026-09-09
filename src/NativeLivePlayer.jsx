import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const TWITCH_SCRIPT = 'https://player.twitch.tv/js/embed/v1.js';
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
  const [twitchFailed, setTwitchFailed] = useState(false);
  const twitchPlayerRef = useRef(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const previousHtml = html.getAttribute('style') || '';
    const previousBody = body.getAttribute('style') || '';
    const previousRoot = root?.getAttribute('style') || '';

    Object.assign(html.style, { margin: '0', padding: '0', width: '100%', height: '100%', background: '#000', overflow: 'hidden' });
    Object.assign(body.style, { margin: '0', padding: '0', width: '100%', height: '100%', background: '#000', overflow: 'hidden' });
    if (root) Object.assign(root.style, { margin: '0', padding: '0', width: '100%', height: '100%', background: '#000', overflow: 'hidden' });

    return () => {
      html.setAttribute('style', previousHtml);
      body.setAttribute('style', previousBody);
      if (root) root.setAttribute('style', previousRoot);
    };
  }, []);

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
  width: 534,
  height: 300,
  autoplay: true,
  muted: false,
  parent: twitchParents()
});
        twitchPlayerRef.current = player;
      } catch (error) {
        console.warn('Droxion Twitch player could not start', error);
        setTwitchFailed(true);
      }
    };

    if (window.Twitch?.Player) mountPlayer();
    else if (script) {
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

  const fill = { display: 'block', width: '100%', height: '100%', border: 0, margin: 0, padding: 0, background: '#000' };

  return (
    <main style={{ margin: 0, padding: 0, width: '100%', height: '100%', minWidth: 0, minHeight: 0, background: '#000', overflow: 'hidden' }}>
      {isTwitch ? (
        twitchFailed ? (
          <iframe
            src={`https://player.twitch.tv/?channel=${encodeURIComponent(slug)}${twitchParents().map(parent => `&parent=${encodeURIComponent(parent)}`).join('')}&autoplay=true&muted=false`}
            title="Droxion Twitch LIVE"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={fill}
          />
        ) : <div id={TWITCH_PLAYER_ID} style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, background: '#000', overflow: 'hidden' }} />
      ) : youtubeSrc ? (
        <iframe
          src={youtubeSrc}
          title="Droxion LIVE"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={fill}
        />
      ) : null}
    </main>
  );
}
