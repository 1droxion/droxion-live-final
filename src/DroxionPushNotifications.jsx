import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import OneSignal from '@onesignal/capacitor-plugin';
import { supabase } from './supabaseClient';

const ONESIGNAL_APP_ID = 'd04a1adc-eb95-486a-994a-993e41e0c178';
const PENDING_LIVE_PUSH_KEY = 'droxion.pendingLivePush';
const PENDING_CHAT_PUSH_KEY = 'droxion.pendingChatPush';
const SUBSCRIPTION_WAIT_MS = 12000;
const SUBSCRIPTION_POLL_MS = 500;

let initPromise = null;
let subscriptionPromise = null;

function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function ensureOneSignal() {
  if (!initPromise) {
    initPromise = Promise.resolve(OneSignal.initialize(ONESIGNAL_APP_ID)).catch(error => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

async function readSubscriptionState() {
  const pushSubscription = OneSignal?.User?.pushSubscription;
  if (!pushSubscription) {
    return { subscriptionId: null, token: null, optedIn: false, ready: false };
  }

  const [subscriptionId, token, optedIn] = await Promise.all([
    pushSubscription.getIdAsync?.() ?? Promise.resolve(null),
    pushSubscription.getTokenAsync?.() ?? Promise.resolve(null),
    pushSubscription.getOptedInAsync?.() ?? Promise.resolve(null)
  ]);

  return {
    subscriptionId: subscriptionId || null,
    token: token || null,
    optedIn: Boolean(optedIn),
    ready: Boolean(subscriptionId && token && optedIn)
  };
}

async function waitForSubscriptionReady(timeoutMs = SUBSCRIPTION_WAIT_MS) {
  const startedAt = Date.now();
  let latest = await readSubscriptionState().catch(() => ({ subscriptionId: null, token: null, optedIn: false, ready: false }));

  while (!latest.ready && Date.now() - startedAt < timeoutMs) {
    await sleep(SUBSCRIPTION_POLL_MS);
    latest = await readSubscriptionState().catch(() => latest);
  }
  return latest;
}

async function ensurePushSubscription({ requestPermission = true } = {}) {
  if (subscriptionPromise) return subscriptionPromise;

  subscriptionPromise = (async () => {
    await ensureOneSignal();

    let permission = false;
    try {
      if (OneSignal?.Notifications?.hasPermission) {
        permission = Boolean(await OneSignal.Notifications.hasPermission());
      }
    } catch {}

    if (!permission && requestPermission) {
      try {
        permission = Boolean(await OneSignal.Notifications.requestPermission(false));
      } catch (error) {
        console.warn('OneSignal notification permission request failed', error);
      }
    }

    const pushSubscription = OneSignal?.User?.pushSubscription;
    if (permission && pushSubscription?.optIn) {
      try {
        await pushSubscription.optIn();
      } catch (error) {
        console.warn('Could not opt in OneSignal push subscription', error);
      }
    }

    let state = await waitForSubscriptionReady();

    // Native registration can lag behind the permission result immediately
    // after install/update. One extra opt-in + wait recovers that state without
    // repeatedly prompting the user.
    if (permission && !state.ready && pushSubscription?.optIn) {
      try { await pushSubscription.optIn(); } catch {}
      state = await waitForSubscriptionReady(6000);
    }

    console.log('Droxion OneSignal subscription state', {
      permission,
      optedIn: state.optedIn,
      hasSubscriptionId: Boolean(state.subscriptionId),
      hasPushToken: Boolean(state.token),
      ready: state.ready
    });

    if (permission && !state.ready) {
      console.warn('Droxion push permission is enabled but OneSignal registration is not ready yet.');
    }

    return { permission, ...state };
  })().finally(() => {
    subscriptionPromise = null;
  });

  return subscriptionPromise;
}

function notificationData(event) {
  const notification = event?.notification || event?.result?.notification || {};
  return notification.additionalData || notification.additional_data || notification.customData || {};
}

function readPushData(event) {
  const data = notificationData(event);
  const type = String(data.type || '').trim();

  if (type === 'chat_message') {
    const senderId = String(data.sender_id || data.senderId || '').trim();
    if (!senderId) return null;
    return {
      type: 'chat_message',
      messageId: String(data.message_id || data.messageId || '').trim(),
      senderId,
      senderName: String(data.sender_name || data.senderName || '').trim()
    };
  }

  const sessionId = String(data.session_id || data.sessionId || '').trim();
  const creatorId = String(data.creator_id || data.creatorId || '').trim();
  if (!sessionId) return null;
  return { type: 'creator_live', sessionId, creatorId };
}

export default function DroxionPushNotifications() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return undefined;
    let stopped = false;

    const recover = () => {
      if (stopped || document.visibilityState === 'hidden') return;
      ensurePushSubscription({ requestPermission: true }).catch(error => {
        console.warn('OneSignal initialization or subscription failed', error);
      });
    };

    recover();
    window.addEventListener('focus', recover);
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', recover);

    return () => {
      stopped = true;
      window.removeEventListener('focus', recover);
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return undefined;
    const pushSubscription = OneSignal?.User?.pushSubscription;
    if (!pushSubscription?.addEventListener) return undefined;

    const handleChange = event => {
      const current = event?.current || event?.state || {};
      console.log('Droxion OneSignal subscription changed', {
        optedIn: Boolean(current.optedIn),
        hasSubscriptionId: Boolean(current.id),
        hasPushToken: Boolean(current.token)
      });
      if (current.optedIn && (!current.id || !current.token)) {
        window.setTimeout(() => {
          ensurePushSubscription({ requestPermission: false }).catch(() => {});
        }, 1000);
      }
    };

    try { pushSubscription.addEventListener('change', handleChange); } catch {}
    return () => {
      try { pushSubscription.removeEventListener?.('change', handleChange); } catch {}
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return;
    let alive = true;

    async function setIdentity(userId) {
      try {
        const state = await ensurePushSubscription({ requestPermission: true });
        if (!alive) return;
        if (userId) await OneSignal.login(userId);
        else await OneSignal.logout();

        // Login can merge/create a OneSignal user. Verify the actual device
        // subscription again after identity is attached.
        if (userId && state.permission) {
          await ensurePushSubscription({ requestPermission: false });
        }
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
          const payload = readPushData(event);
          if (!payload) return;

          if (payload.type === 'chat_message') {
            try { window.localStorage.setItem(PENDING_CHAT_PUSH_KEY, JSON.stringify(payload)); } catch {}
            try { window.dispatchEvent(new CustomEvent('droxion:chat-push-open', { detail: payload })); } catch {}
          } else {
            try { window.localStorage.setItem(PENDING_LIVE_PUSH_KEY, JSON.stringify(payload)); } catch {}
            try { window.dispatchEvent(new CustomEvent('droxion:live-push-open', { detail: payload })); } catch {}
          }

          // OneSignal already foregrounds/opens the native app on tap. Keep the
          // user inside the native Droxion shell instead of launching a browser.
          if (window.location.pathname !== '/') {
            try { window.history.replaceState({}, '', '/'); } catch {}
          }
        };
        OneSignal.Notifications.addEventListener('click', handler);
      } catch (error) {
        console.warn('Could not register Droxion notification click handler', error);
      }
    })();

    return () => {
      if (!handler) return;
      try { OneSignal.Notifications.removeEventListener('click', handler); } catch {}
    };
  }, []);

  return null;
}
