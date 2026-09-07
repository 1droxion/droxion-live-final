import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export default function NativeLivePlayer() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const provider = String(params.get('provider') || '').toLowerCase();
  const id = String(params.get('id') || '').trim();
  const slug = String(params.get('slug') || '').trim();

  let src = '';
  if (provider === 'youtube' && id) {
    src = `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`;
  } else if (provider === 'twitch' && slug) {
    src = `https://player.twitch.tv/?channel=${encodeURIComponent(slug)}&parent=${encodeURIComponent(window.location.hostname)}&autoplay=true`;
  }

  return (
    <main style={{ margin: 0, width: '100vw', height: '100vh', minHeight: 300, background: '#000', overflow: 'hidden' }}>
      {src ? <iframe src={src} title="Droxion LIVE" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ display: 'block', width: '100%', height: '100%', minHeight: 300, border: 0, background: '#000' }} /> : null}
    </main>
  );
}
