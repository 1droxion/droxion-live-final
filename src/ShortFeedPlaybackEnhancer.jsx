import { useEffect } from 'react';

const VIDEO_SELECTOR = '.sfVideo';

function visibleRatio(video) {
  if (!video?.getBoundingClientRect) return 0;
  const rect = video.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
  const visibleTop = Math.max(0, rect.top);
  const visibleBottom = Math.min(viewportHeight, rect.bottom);
  const visible = Math.max(0, visibleBottom - visibleTop);
  return rect.height > 0 ? visible / rect.height : 0;
}

function safePlay(video) {
  if (!video || document.hidden) return;
  const result = video.play?.();
  if (result?.catch) result.catch(() => {});
}

export default function ShortFeedPlaybackEnhancer() {
  useEffect(() => {
    const cleanups = new Map();
    let observer = null;
    let refreshTimer = null;

    const restart = video => {
      if (!video || visibleRatio(video) < 0.55) return;
      try {
        if (video.ended || Number.isFinite(video.duration) && video.currentTime >= Math.max(0, video.duration - 0.15)) {
          video.currentTime = 0;
        }
      } catch {}
      safePlay(video);
    };

    const attach = video => {
      if (!video || cleanups.has(video)) return;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.preload = 'auto';

      const onEnded = () => {
        try { video.currentTime = 0; } catch {}
        restart(video);
      };
      const onCanPlay = () => restart(video);
      const onLoadedData = () => restart(video);
      const onStalled = () => {
        window.setTimeout(() => restart(video), 350);
      };
      const onPause = () => {
        if (!document.hidden && visibleRatio(video) >= 0.72) {
          window.setTimeout(() => restart(video), 120);
        }
      };

      video.addEventListener('ended', onEnded);
      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('stalled', onStalled);
      video.addEventListener('pause', onPause);

      cleanups.set(video, () => {
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('stalled', onStalled);
        video.removeEventListener('pause', onPause);
      });
      observer?.observe(video);
    };

    const refresh = () => {
      document.querySelectorAll(VIDEO_SELECTOR).forEach(attach);
      for (const [video, cleanup] of cleanups) {
        if (!document.documentElement.contains(video)) {
          observer?.unobserve(video);
          cleanup();
          cleanups.delete(video);
        }
      }
    };

    observer = new IntersectionObserver(entries => {
      const visibleEntries = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      const winner = visibleEntries[0]?.intersectionRatio >= 0.55 ? visibleEntries[0].target : null;

      entries.forEach(entry => {
        const video = entry.target;
        if (video === winner) {
          restart(video);
        } else if (entry.intersectionRatio < 0.45) {
          video.pause?.();
        }
      });
    }, { threshold: [0, 0.45, 0.55, 0.72, 0.9, 1] });

    const mutationObserver = new MutationObserver(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refresh, 40);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const onVisibility = () => {
      if (document.hidden) {
        document.querySelectorAll(VIDEO_SELECTOR).forEach(video => video.pause?.());
      } else {
        const videos = [...document.querySelectorAll(VIDEO_SELECTOR)];
        videos.sort((a, b) => visibleRatio(b) - visibleRatio(a));
        restart(videos[0]);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onVisibility);
    refresh();

    return () => {
      window.clearTimeout(refreshTimer);
      mutationObserver.disconnect();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onVisibility);
      cleanups.forEach(cleanup => cleanup());
      cleanups.clear();
    };
  }, []);

  return null;
}
