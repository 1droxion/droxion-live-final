import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabaseClient';

const API_ORIGIN = 'https://www.droxion.com';
const PUSH_RETRY_MS = 15000;

export default function DroxionLivePushBridge() {
  const lastSentSession = useRef('');
  const lastAttemptAt = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return;
    let alive = true;
    let busy = false;

    async function checkLive() {
      if (!alive || busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!alive || !session?.access_token || !session?.user?.id) return;

        const { data, error } = await supabase.rpc('droxion_live_status');
        if (error || !data?.is_live || !data?.session_id) return;

        const sessionId = String(data.session_id);
        if (lastSentSession.current === sessionId) return;

        const now = Date.now();
        if (now - lastAttemptAt.current < PUSH_RETRY_MS - 500) return;
        lastAttemptAt.current = now;

        const response = await fetch(`${API_ORIGIN}/api/notifications/live-start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ sessionId })
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload?.ok !== true) {
          console.warn('LIVE follower push not delivered yet', payload?.error || response.status, {
            followers: Number(payload?.followers || 0),
            recipients: Number(payload?.recipients || 0)
          });
          return;
        }

        lastSentSession.current = sessionId;
        console.log('LIVE follower push processed', {
          sessionId,
          followers: Number(payload?.followers || 0),
          recipients: Number(payload?.recipients || 0),
          deliveryAccepted: payload?.deliveryAccepted !== false,
          messageIds: Array.isArray(payload?.messageIds) ? payload.messageIds : []
        });
      } catch (error) {
        console.warn('LIVE push bridge failed', error);
      } finally {
        busy = false;
      }
    }

    const wake = () => {
      if (document.visibilityState !== 'hidden') checkLive();
    };

    checkLive();
    const timer = window.setInterval(checkLive, PUSH_RETRY_MS);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);

  return null;
}
