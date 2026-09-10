import { useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

const HOSTED_PLAYER = 'https://www.droxion.com/native-live-player';
const TwitchPlayer = registerPlugin('TwitchPlayer');

function hostedUrlFor(src) {
  try {
    const url = new URL(src);

    if (
      url.hostname.includes('youtube.com') &&
      url.pathname.startsWith('/embed/')
    ) {
      const id = url.pathname.split('/embed/')[1]?.split('/')[0] || '';
      if (id) {
        return `${HOSTED_PLAYER}?provider=youtube&id=${encodeURIComponent(id)}`;
      }
    }

    if (url.hostname === 'player.twitch.tv') {
      const slug = url.searchParams.get('channel') || '';

      if (slug) {
        return `${HOSTED_PLAYER}?provider=twitch&slug=${encodeURIComponent(
          slug
        )}`;
      }
    }
  } catch {}

  return '';
}

export default function NativeExternalLivePlayerBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    if (window.location.pathname === '/native-live-player') return undefined;

    const isIOS = Capacitor.getPlatform() === 'ios';

    let activeTwitchFrame = null;
    let frameUpdatePending = false;

    const getFrameBox = frame => {
      const rect = frame.getBoundingClientRect();

      return {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    };

    const hideNativeTwitch = async () => {
      activeTwitchFrame = null;

      if (!isIOS) return;

      try {
        await TwitchPlayer.hide();
      } catch {}
    };

    const updateNativeTwitchFrame = () => {
      if (!isIOS || !activeTwitchFrame || frameUpdatePending) return;

      if (!document.body.contains(activeTwitchFrame)) {
        hideNativeTwitch();
        return;
      }

      frameUpdatePending = true;

      window.requestAnimationFrame(async () => {
        frameUpdatePending = false;

        if (!activeTwitchFrame) return;

        const box = getFrameBox(activeTwitchFrame);

        if (box.width <= 1 || box.height <= 1) return;

        try {
          await TwitchPlayer.updateFrame(box);
        } catch {}
      });
    };

    const showNativeTwitch = async (frame, url) => {
      const container = frame.parentElement;

      if (container) {
        container.style.aspectRatio = '16 / 9';
        container.style.height = 'auto';
        container.style.minHeight = '0';
        container.style.background = '#000';
        container.style.overflow = 'hidden';
      }

      frame.style.width = '100%';
      frame.style.height = '100%';
      frame.style.minHeight = '0';
      frame.style.background = '#000';
      frame.style.border = '0';

      const box = getFrameBox(frame);

      if (box.width <= 1 || box.height <= 1) return;

      activeTwitchFrame = frame;

      try {
        await TwitchPlayer.show({
          url,
          ...box
        });

        // Native WKWebView is now displaying Twitch.
        frame.style.visibility = 'hidden';
        frame.style.pointerEvents = 'none';
      } catch {
        // Safe fallback if native plugin is unavailable.
        activeTwitchFrame = null;
        frame.style.visibility = 'visible';
        frame.style.pointerEvents = 'auto';
        frame.setAttribute('src', url);
      }
    };

    const rewritePlayers = () => {
      const frames = Array.from(
        document.querySelectorAll('.dxLivePlayerFrame iframe')
      );

      let foundIOSTwitch = false;

      frames.forEach(frame => {
        const current = frame.getAttribute('src') || '';
        if (!current) return;

        let next = '';

        if (
          current.startsWith(HOSTED_PLAYER) &&
          current.includes('provider=twitch')
        ) {
          next = current;
        } else {
          next = hostedUrlFor(current);
        }

        if (!next) return;

        if (isIOS && next.includes('provider=twitch')) {
          foundIOSTwitch = true;

          if (
            frame.dataset.nativeTwitchUrl !== next ||
            activeTwitchFrame !== frame
          ) {
            frame.dataset.nativeTwitchUrl = next;
            showNativeTwitch(frame, next);
          } else {
            updateNativeTwitchFrame();
          }

          return;
        }

        if (current.startsWith(HOSTED_PLAYER)) return;

        frame.setAttribute('src', next);
      });

      if (isIOS && !foundIOSTwitch && activeTwitchFrame) {
        hideNativeTwitch();
      }
    };

    rewritePlayers();

    const observer = new MutationObserver(rewritePlayers);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });

    window.addEventListener('resize', updateNativeTwitchFrame);
    window.addEventListener('scroll', updateNativeTwitchFrame, true);

    return () => {
      observer.disconnect();

      window.removeEventListener('resize', updateNativeTwitchFrame);
      window.removeEventListener('scroll', updateNativeTwitchFrame, true);

      hideNativeTwitch();
    };
  }, []);

  return null;
}
