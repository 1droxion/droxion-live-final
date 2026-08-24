import { useEffect } from 'react';

const VIDEO_SELECTOR = '.sfVideo';
const FEED_SELECTOR = '.sfPage';

function visibleRatio(video) {
  if (!video?.getBoundingClientRect) return 0;
  const rect = video.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
  const visibleTop = Math.max(0, rect.top);
  const visibleBottom = Math.min(viewportHeight, rect.bottom);
  const visible = Math.max(0, visibleBottom - visibleTop);
  return rect.height > 0 ? visible / rect.height : 0;
}

function allVideos() {
  return [...document.querySelectorAll(VIDEO_SELECTOR)];
}

function mostVisibleVideo() {
  const videos = allVideos();
  videos.sort((a, b) => visibleRatio(b) - visibleRatio(a));
  const video = videos[0] || null;
  return video && visibleRatio(video) >= 0.5 ? video : null;
}

function rewindIfFinished(video) {
  if (!video) return;
  try {
    const duration = Number(video.duration);
    if (video.ended || (Number.isFinite(duration) && duration > 0 && video.currentTime >= duration - 0.18)) {
      video.currentTime = 0;
    }
  } catch {}
}

function requestPlay(video, { gesture = false } = {}) {
  if (!video || document.hidden || visibleRatio(video) < 0.5) return;
  rewindIfFinished(video);
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.preload = 'auto';

  try {
    const result = video.play?.();
    if (result?.then) {
      result.then(() => {
        video.dataset.droxionPlaybackBlocked = '0';
      }).catch(() => {
        video.dataset.droxionPlaybackBlocked = '1';
        // On iOS an unmuted clip can require a real user gesture. The capture
        // phase gesture handler calls this synchronously; a second microtask
        // retry helps WKWebView after scroll snapping completes.
        if (gesture) {
          window.setTimeout(() => {
            try { video.play?.(); } catch {}
          }, 0);
        }
      });
    }
  } catch {
    video.dataset.droxionPlaybackBlocked = '1';
  }
}

export default function ShortFeedPlaybackEnhancer() {
  useEffect(() => {
    const cleanups = new Map();
    const progress = new WeakMap();
    let observer = null;
    let refreshTimer = null;
    let watchdog = null;

    const makeActive = video => {
      if (!video) return;
      allVideos().forEach(other => {
        if (other === video) return;
        if (visibleRatio(other) < 0.35) {
          try { other.pause?.(); } catch {}
        }
      });
      requestPlay(video);
    };

    const recover = (video, { hard = false, gesture = false } = {}) => {
      if (!video || document.hidden || visibleRatio(video) < 0.5) return;
      rewindIfFinished(video);

      if (hard && video.muted) {
        try {
          const time = Number(video.currentTime || 0);
          video.load?.();
          const restore = () => {
            try {
              if (time > 0 && Number.isFinite(video.duration) && time < video.duration - 0.25) video.currentTime = time;
            } catch {}
            requestPlay(video, { gesture });
          };
          video.addEventListener('canplay', restore, { once: true });
          window.setTimeout(() => requestPlay(video, { gesture }), 450);
          return;
        } catch {}
      }

      // For unmuted playback do not reload the media element because WebKit
      // can treat the reload as a brand-new autoplay request. Seek a tiny
      // amount instead and resume the existing playback session.
      if (hard && !video.muted) {
        try {
          const duration = Number(video.duration);
          if (Number.isFinite(duration) && duration > 0 && video.currentTime < duration - 0.4) {
            video.currentTime = Math.min(duration - 0.25, Number(video.currentTime || 0) + 0.04);
          }
        } catch {}
      }
      requestPlay(video, { gesture });
    };

    const attach = video => {
      if (!video || cleanups.has(video)) return;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.preload = 'auto';
      video.loop = true;

      const onEnded = () => {
        try { video.currentTime = 0; } catch {}
        requestPlay(video);
      };
      const onCanPlay = () => {
        if (visibleRatio(video) >= 0.5) requestPlay(video);
      };
      const onLoadedData = () => {
        progress.set(video, { time: Number(video.currentTime || 0), misses: 0 });
        if (visibleRatio(video) >= 0.5) requestPlay(video);
      };
      const onTimeUpdate = () => {
        // Some iOS WKWebView builds fire ended and leave the video paused even
        // with loop=true. Seek just before ended so the same playback session
        // loops without needing a second autoplay permission.
        try {
          const duration = Number(video.duration);
          if (!Number.isFinite(duration) || duration <= 0) return;
          if (duration - Number(video.currentTime || 0) <= 0.28 && visibleRatio(video) >= 0.5) {
            video.currentTime = 0;
            requestPlay(video);
          }
        } catch {}
      };
      const onWaiting = () => window.setTimeout(() => recover(video), 220);
      const onStalled = () => window.setTimeout(() => recover(video, { hard: true }), 400);
      const onSuspend = () => {
        if (visibleRatio(video) >= 0.72 && !video.ended) window.setTimeout(() => requestPlay(video), 120);
      };
      const onError = () => {
        video.dataset.droxionPlaybackError = String(video.error?.code || '1');
        window.setTimeout(() => recover(video, { hard: true }), 450);
      };
      const onPause = () => {
        if (!document.hidden && visibleRatio(video) >= 0.72 && !video.ended) {
          window.setTimeout(() => requestPlay(video), 70);
        }
      };

      video.addEventListener('ended', onEnded);
      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('stalled', onStalled);
      video.addEventListener('suspend', onSuspend);
      video.addEventListener('error', onError);
      video.addEventListener('pause', onPause);

      cleanups.set(video, () => {
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('stalled', onStalled);
        video.removeEventListener('suspend', onSuspend);
        video.removeEventListener('error', onError);
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
      makeActive(mostVisibleVideo());
    };

    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.intersectionRatio < 0.3) {
          try { entry.target.pause?.(); } catch {}
        }
      });
      makeActive(mostVisibleVideo());
    }, { threshold: [0, 0.3, 0.5, 0.72, 0.9, 1] });

    const mutationObserver = new MutationObserver(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refresh, 40);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const onFeedGesture = event => {
      if (!event.target?.closest?.(FEED_SELECTOR)) return;
      const video = mostVisibleVideo();
      if (!video) return;
      recover(video, { gesture: true });
    };

    const onVisibility = () => {
      if (document.hidden) {
        allVideos().forEach(video => {
          try { video.pause?.(); } catch {}
        });
      } else {
        window.setTimeout(() => makeActive(mostVisibleVideo()), 40);
      }
    };

    watchdog = window.setInterval(() => {
      const video = mostVisibleVideo();
      if (!video || document.hidden) return;
      const now = Number(video.currentTime || 0);
      const previous = progress.get(video) || { time: now, misses: 0 };
      const advanced = now > previous.time + 0.035;
      const shouldAdvance = !video.paused && !video.ended && video.readyState >= 2;
      const misses = shouldAdvance && !advanced ? previous.misses + 1 : 0;
      progress.set(video, { time: now, misses });

      if (video.paused && visibleRatio(video) >= 0.72) requestPlay(video);
      else if (misses >= 2) {
        progress.set(video, { time: now, misses: 0 });
        recover(video, { hard: true });
      }
    }, 700);

    document.addEventListener('pointerup', onFeedGesture, true);
    document.addEventListener('touchend', onFeedGesture, true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onVisibility);
    window.addEventListener('focus', onVisibility);
    refresh();

    return () => {
      window.clearTimeout(refreshTimer);
      window.clearInterval(watchdog);
      mutationObserver.disconnect();
      observer.disconnect();
      document.removeEventListener('pointerup', onFeedGesture, true);
      document.removeEventListener('touchend', onFeedGesture, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onVisibility);
      window.removeEventListener('focus', onVisibility);
      cleanups.forEach(cleanup => cleanup());
      cleanups.clear();
    };
  }, []);

  return null;
}
