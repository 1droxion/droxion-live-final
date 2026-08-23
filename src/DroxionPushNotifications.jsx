import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import OneSignal from '@onesignal/capacitor-plugin';
import { supabase } from './supabaseClient';

const ONESIGNAL_APP_ID = 'd04a1adc-eb95-486a-994a-993e41e0c178';

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

  return null;
}
