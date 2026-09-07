import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

const HOSTED_PLAYER = 'https://www.droxion.com/native-live-player';

function hostedUrlFor(src) {
  try {
    const url = new URL(src);
    if (url.hostname.includes('youtube.com') && url.pathname.startsWith('/embed/')) {
      const id = url.pathname.split('/embed/')[1]?.split('/')[0] || '';
      if (id) return `${HOSTED_PLAYER}?provider=youtube&id=${encodeURIComponent(id)}`;
    }
    if (url.hostname === 'player.twitch.tv') {
      const slug = url.searchParams.get('channel') || '';
      if (slug) return `${HOSTED_PLAYER}?provider=twitch&slug=${encodeURIComponent(slug)}`;
    }
  } catch {}
  return '';
}

export default function NativeExternalLivePlayerBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    if (window.location.pathname === '/native-live-player') return undefined;

    const rewritePlayers = () => {
      document.querySelectorAll('.dxLivePlayerFrame iframe').forEach(frame => {
        const current = frame.getAttribute('src') || '';
        if (!current || current.startsWith(HOSTED_PLAYER)) return;
        const next = hostedUrlFor(current);
        if (!next) return;

        if (next.includes('provider=twitch')) {
          const container = frame.parentElement;
          if (container) {
            container.style.aspectRatio = 'auto';
            container.style.height = '300px';
            container.style.minHeight = '300px';
          }
          frame.style.height = '300px';
          frame.style.minHeight = '300px';
        }

        frame.setAttribute('src', next);
      });
    };

    rewritePlayers();
    const observer = new MutationObserver(rewritePlayers);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    return () => observer.disconnect();
  }, []);

  return null;
}
