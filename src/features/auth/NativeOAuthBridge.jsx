import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeNativeOAuthUrl, isNativePlatform } from './services/socialAuthService';

function loginErrorUrl(error) {
  const message = error?.message || 'Unable to finish social sign in.';
  return `/login?oauth_error=${encodeURIComponent(message)}`;
}

export default function NativeOAuthBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativePlatform()) return undefined;

    let active = true;
    let listenerHandle = null;

    const handleUrl = async url => {
      if (!active || !url) return;
      try {
        const handled = await completeNativeOAuthUrl(url);
        if (handled && active) navigate('/', { replace: true });
      } catch (error) {
        if (active) navigate(loginErrorUrl(error), { replace: true });
      }
    };

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        if (!active) return;

        listenerHandle = await App.addListener('appUrlOpen', event => {
          handleUrl(event?.url).catch(() => {});
        });

        const launch = await App.getLaunchUrl().catch(() => null);
        if (launch?.url) await handleUrl(launch.url);
      } catch (error) {
        console.warn('Droxion native OAuth bridge unavailable', error);
      }
    })();

    return () => {
      active = false;
      try { listenerHandle?.remove?.(); } catch {}
    };
  }, [navigate]);

  return null;
}
