import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import OneSignal from '@onesignal/capacitor-plugin';
import { supabase } from './supabaseClient';

const ONESIGNAL_APP_ID = 'd04a1adc-eb95-486a-994a-993e41e0c178';
const PENDING_LIVE_PUSH_KEY = 'droxion.pendingLivePush';

let initPromise = null;

function ensureOneSignal() {
  if (!initPromise) {
    initPromise = OneSignal.initialize(ONESIGNAL_APP_ID).catch(error => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

function readLivePushData(event) {
  const notification = event?.notification || event?.result?.notification || {};
  const data = notification.additionalData || notification.additional_data || notification.customData || {};
  const sessionId = String(data.session_id || data.sessionId || '').trim();
  const creatorId = String(data.creator_id || data.creatorId || '').trim();
  if (!sessionId) return null;
  return { type: 'creator_live', sessionId, creatorId };
}

export default function DroxionPushNotifications() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return;

    (async () => {
      try {
        await ensureOneSignal();
        await OneSignal.Notifications.requestPermission(false);
      } catch (error) {
        console.warn('OneSignal initialization or permission failed', error);
      }
    })();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return;
    let alive = true;

    async function setIdentity(userId) {
      try {
        await ensureOneSignal();
        if (!alive) return;
        if (userId) await OneSignal.login(userId);
        else await OneSignal.logout();
      } catch (error) {
        console.warn('Could not sync OneSignal identity', error);
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      if (alive) setIdentity(data?.user?.id || '');
    }).catch(() => {});

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setIdentity(session?.user?.id || '');
    });

    return () => {
      alive = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return undefined;
    let handler = null;

    (async () => {
      try {
        await ensureOneSignal();
        handler = event => {
          const payload = readLivePushData(event);
          if (!payload) return;
          try { window.localStorage.setItem(PENDING_LIVE_PUSH_KEY, JSON.stringify(payload)); } catch {}
          try { window.dispatchEvent(new CustomEvent('droxion:live-push-open', { detail: payload })); } catch {}
          // OneSignal already foregrounds/opens the native app on tap. Keep the
          // user inside Droxion Home instead of launching an external browser.
          if (window.location.pathname !== '/') {
            try { window.history.replaceState({}, '', '/'); } catch {}
          }
        };
        OneSignal.Notifications.addEventListener('click', handler);
      } catch (error) {
        console.warn('Could not register LIVE notification click handler', error);
      }
    })();

    return () => {
      if (!handler) return;
      try { OneSignal.Notifications.removeEventListener('click', handler); } catch {}
    };
  }, []);

  return null;
}
