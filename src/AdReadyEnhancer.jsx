import { useEffect } from 'react';

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function positiveInt(value, fallback, minimum = 1) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

const config = Object.freeze({
  livePrerollEnabled: enabled(import.meta.env.VITE_DROXION_LIVE_PREROLL_ADS),
  livePrerollEveryN: positiveInt(import.meta.env.VITE_DROXION_LIVE_PREROLL_EVERY_N, 3, 2),
  livePrerollCooldownMinutes: positiveInt(import.meta.env.VITE_DROXION_LIVE_PREROLL_COOLDOWN_MINUTES, 15, 1),
  reelAdsEnabled: enabled(import.meta.env.VITE_DROXION_REEL_ADS),
  reelInterval: positiveInt(import.meta.env.VITE_DROXION_REEL_AD_INTERVAL, 6, 3),
  homeAdsEnabled: enabled(import.meta.env.VITE_DROXION_HOME_ADS),
  homeInterval: positiveInt(import.meta.env.VITE_DROXION_HOME_AD_INTERVAL, 4, 3),
  adsenseClient: String(import.meta.env.VITE_ADSENSE_CLIENT || '').trim(),
  adsenseReelSlot: String(import.meta.env.VITE_ADSENSE_REEL_SLOT || '').trim(),
  adsenseHomeSlot: String(import.meta.env.VITE_ADSENSE_HOME_SLOT || '').trim(),
  adsensePlayerSlot: String(import.meta.env.VITE_ADSENSE_PLAYER_SLOT || '').trim()
});

const LIVE_OPEN_COUNT_KEY = 'droxion.ads.live.openCount';
const LIVE_LAST_SHOWN_KEY = 'droxion.ads.live.lastShownAt';

function readNumber(key) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeNumber(key, value) {
  try { window.localStorage.setItem(key, String(value)); } catch {}
}

/**
 * Ad-ready sidecar only. It does not load an ad SDK and it never owns LIVE,
 * LiveKit, camera/mic tracks, navigation, gifts, wallet, or playback.
 *
 * A future provider can set window.__droxionAdReady.providerConnected=true,
 * listen for `droxion:ad-slot-requested`, render a real sponsored unit, then
 * dispatch `droxion:ad-slot-complete`. Until then every placement fails open
 * with no blank boxes and no delay to normal Droxion content.
 */
export default function AdReadyEnhancer() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const adsenseConnected = Boolean(
      config.adsenseClient &&
      (config.adsenseReelSlot || config.adsenseHomeSlot || config.adsensePlayerSlot)
    );

    window.__droxionAdReady = {
      version: 4,
      ...config,
      providerConnected: adsenseConnected,
      provider: adsenseConnected ? 'adsense' : ''
    };

    if (adsenseConnected && !document.querySelector('script[data-droxion-adsense]')) {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.droxionAdsense = 'true';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.adsenseClient)}`;
      document.head.appendChild(script);
    }

    const pushAd = node => {
      if (!node || node.dataset.droxionAdRequested === 'true') return;
      node.dataset.droxionAdRequested = 'true';
      window.setTimeout(() => {
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
      }, 0);
    };

    const createDisplayAd = (placement, slot) => {
      if (!adsenseConnected || !slot) return null;
      const wrap = document.createElement('div');
      wrap.className = 'droxionDisplayAd';
      wrap.dataset.droxionGeneratedAd = placement;
      wrap.setAttribute('aria-label', 'Advertisement');

      const label = document.createElement('span');
      label.className = 'droxionAdLabel';
      label.textContent = 'ADVERTISEMENT';

      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.dataset.adClient = config.adsenseClient;
      ins.dataset.adSlot = slot;
      ins.dataset.adFormat = 'auto';
      ins.dataset.fullWidthResponsive = 'true';

      wrap.append(label, ins);
      pushAd(ins);
      return wrap;
    };

    const ensureAdAfter = (node, placement, slot) => {
      if (!node || !slot) return;
      const next = node.nextElementSibling;
      if (next?.dataset?.droxionGeneratedAd === placement) return;
      const ad = createDisplayAd(placement, slot);
      if (ad) node.insertAdjacentElement('afterend', ad);
    };

    const fillPlayerAd = slotNode => {
      if (!slotNode || !config.adsensePlayerSlot || slotNode.dataset.droxionFilled === 'true') return;
      slotNode.dataset.droxionFilled = 'true';
      const ad = createDisplayAd('live_below_player', config.adsensePlayerSlot);
      if (!ad) return;
      slotNode.replaceChildren(ad);
    };

    const completeWithoutAd = (detail, reason) => {
      window.dispatchEvent(new CustomEvent('droxion:ad-slot-complete', {
        detail: { placement: detail?.placement || 'live_preroll', shown: false, reason, ...detail }
      }));
    };

    const providerConnected = () => window.__droxionAdReady?.providerConnected === true;

    const markOrganicAdBreaks = () => {
      const providerReady = providerConnected();

      const slides = Array.from(document.querySelectorAll('.sfPage > .sfSlide'));
      slides.forEach((slide, index) => {
        const breakAfter = config.reelAdsEnabled && providerReady && (index + 1) % config.reelInterval === 0;
        if (breakAfter) {
          slide.dataset.droxionAdBreakAfter = 'reel_native';
          slide.dataset.droxionAdPlacement = `reel_native_${index + 1}`;
          ensureAdAfter(slide, `reel_native_${index + 1}`, config.adsenseReelSlot);
        } else {
          delete slide.dataset.droxionAdBreakAfter;
          delete slide.dataset.droxionAdPlacement;
        }
      });

      const liveCards = Array.from(document.querySelectorAll('.productionLiveGrid > .productionLiveCard, .dxGlobalGrid > .dxGlobalCard'));
      liveCards.forEach((card, index) => {
        const breakAfter = config.homeAdsEnabled && providerReady && (index + 1) % config.homeInterval === 0;
        if (breakAfter) {
          card.dataset.droxionAdBreakAfter = 'home_live_native';
          card.dataset.droxionAdPlacement = `home_live_native_${index + 1}`;
          ensureAdAfter(card, `home_live_native_${index + 1}`, config.adsenseHomeSlot);
        } else {
          delete card.dataset.droxionAdBreakAfter;
          delete card.dataset.droxionAdPlacement;
        }
      });

      const belowPlayerSlots = Array.from(document.querySelectorAll('.dxLiveAdSlot[data-droxion-ad-placement="live_below_player"]'));
      belowPlayerSlots.forEach(slot => {
        if (providerReady && config.homeAdsEnabled) {
          slot.dataset.adActive = 'true';
          fillPlayerAd(slot);
        } else {
          delete slot.dataset.adActive;
        }
      });
    };

    const observer = new MutationObserver(markOrganicAdBreaks);
    observer.observe(document.body, { childList: true, subtree: true });
    markOrganicAdBreaks();

    const requestLiveAd = event => {
      const detail = { placement: 'live_preroll', ...(event?.detail || {}) };

      if (!config.livePrerollEnabled) {
        completeWithoutAd(detail, 'disabled');
        return;
      }
      if (!providerConnected()) {
        completeWithoutAd(detail, 'no_provider');
        return;
      }

      const nextOpenCount = readNumber(LIVE_OPEN_COUNT_KEY) + 1;
      writeNumber(LIVE_OPEN_COUNT_KEY, nextOpenCount);

      if (nextOpenCount % config.livePrerollEveryN !== 0) {
        completeWithoutAd(detail, 'frequency_cap');
        return;
      }

      const lastShownAt = readNumber(LIVE_LAST_SHOWN_KEY);
      const cooldownMs = config.livePrerollCooldownMinutes * 60 * 1000;
      if (lastShownAt > 0 && Date.now() - lastShownAt < cooldownMs) {
        completeWithoutAd(detail, 'cooldown');
        return;
      }

      window.dispatchEvent(new CustomEvent('droxion:ad-slot-requested', {
        detail: {
          ...detail,
          placement: 'live_preroll',
          optional: true,
          skippable: true,
          failOpen: true,
          frequency: `1_in_${config.livePrerollEveryN}`,
          cooldownMinutes: config.livePrerollCooldownMinutes
        }
      }));
    };

    const rememberShownAd = event => {
      const detail = event?.detail || {};
      if (detail.placement === 'live_preroll' && detail.shown === true) {
        writeNumber(LIVE_LAST_SHOWN_KEY, Date.now());
      }
    };

    const refreshPlacements = () => markOrganicAdBreaks();
    window.addEventListener('droxion:request-live-entry-ad', requestLiveAd);
    window.addEventListener('droxion:ad-slot-complete', rememberShownAd);
    window.addEventListener('droxion:ad-provider-changed', refreshPlacements);

    return () => {
      observer.disconnect();
      window.removeEventListener('droxion:request-live-entry-ad', requestLiveAd);
      window.removeEventListener('droxion:ad-slot-complete', rememberShownAd);
      window.removeEventListener('droxion:ad-provider-changed', refreshPlacements);
      try { delete window.__droxionAdReady; } catch {}
    };
  }, []);

  return null;
}
