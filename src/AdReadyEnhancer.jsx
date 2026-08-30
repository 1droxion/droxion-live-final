import { useEffect } from 'react';

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

const config = Object.freeze({
  livePrerollEnabled: enabled(import.meta.env.VITE_DROXION_LIVE_PREROLL_ADS),
  reelAdsEnabled: enabled(import.meta.env.VITE_DROXION_REEL_ADS),
  reelInterval: Math.max(3, Number(import.meta.env.VITE_DROXION_REEL_AD_INTERVAL || 6))
});

/**
 * Ad-ready sidecar only. It does not load an ad SDK and it never owns LIVE,
 * LiveKit, camera/mic tracks, navigation, gifts, wallet, or playback.
 *
 * A future provider can listen for `droxion:ad-slot-requested` and render into
 * the supplied placement. With no provider installed, all requests fail open
 * and normal Droxion content continues immediately.
 */
export default function AdReadyEnhancer() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    window.__droxionAdReady = {
      version: 1,
      ...config,
      providerConnected: false
    };

    const markReelBreaks = () => {
      const slides = Array.from(document.querySelectorAll('.sfPage > .sfSlide'));
      slides.forEach((slide, index) => {
        const breakAfter = config.reelAdsEnabled && (index + 1) % config.reelInterval === 0;
        if (breakAfter) {
          slide.dataset.droxionAdBreakAfter = 'reel_native';
          slide.dataset.droxionAdPlacement = `reel_native_${index + 1}`;
        } else {
          delete slide.dataset.droxionAdBreakAfter;
          delete slide.dataset.droxionAdPlacement;
        }
      });
    };

    const observer = new MutationObserver(markReelBreaks);
    observer.observe(document.body, { childList: true, subtree: true });
    markReelBreaks();

    const requestLiveAd = event => {
      const detail = event?.detail || {};
      if (!config.livePrerollEnabled) {
        window.dispatchEvent(new CustomEvent('droxion:ad-slot-complete', {
          detail: { placement: 'live_preroll', shown: false, reason: 'disabled', ...detail }
        }));
        return;
      }

      window.dispatchEvent(new CustomEvent('droxion:ad-slot-requested', {
        detail: {
          placement: 'live_preroll',
          optional: true,
          failOpen: true,
          ...detail
        }
      }));
    };

    window.addEventListener('droxion:request-live-entry-ad', requestLiveAd);

    return () => {
      observer.disconnect();
      window.removeEventListener('droxion:request-live-entry-ad', requestLiveAd);
      try { delete window.__droxionAdReady; } catch {}
    };
  }, []);

  return null;
}
