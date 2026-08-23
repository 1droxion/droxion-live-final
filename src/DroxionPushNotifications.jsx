import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import OneSignal from '@onesignal/capacitor-plugin';
import { supabase } from './supabaseClient';

const ONESIGNAL_APP_ID = 'd04a1adc-eb95-486a-994a-993e41e0c178';

let initialized = false;

export default function DroxionPushNotifications() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform?.() || initialized) return;
    initialized = true;

    try {
      OneSignal.initialize(ONESIGNAL_APP_ID);
      OneSignal.Notifications.requestPermission(false).catch(error => {
        console.warn('Push permission request failed', error);
      });
    } catch (error) {
      console.warn('OneSignal initialization failed', error);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return;
    let alive = true;

    async function syncIdentity() {
      try {
        const { data } = await supabase.auth.getUser();
        if (!alive) return;
        if (data?.user?.id) await OneSignal.login(data.user.id);
        else await OneSignal.logout();
      } catch (error) {
        console.warn('Could not sync OneSignal identity', error);
      }
    }

    syncIdentity();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session?.user?.id) OneSignal.login(session.user.id).catch(() => {});
      else OneSignal.logout().catch(() => {});
    });

    return () => {
      alive = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return null;
}
