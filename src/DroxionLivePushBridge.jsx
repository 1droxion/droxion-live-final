import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabaseClient';

const API_ORIGIN = 'https://www.droxion.com';

export default function DroxionLivePushBridge() {
  const lastSentSession = useRef('');

  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return;
    let alive = true;

    async function checkLive() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!alive || !session?.access_token || !session?.user?.id) return;

        const { data, error } = await supabase.rpc('droxion_live_status');
        if (error || !data?.is_live || !data?.session_id) return;

        const sessionId = String(data.session_id);
        if (lastSentSession.current === sessionId) return;
        lastSentSession.current = sessionId;

        const response = await fetch(`${API_ORIGIN}/api/notifications/live-start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ sessionId })
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          console.warn('LIVE push broadcast failed', payload?.error || response.status);
        }
      } catch (error) {
        console.warn('LIVE push bridge failed', error);
      }
    }

    checkLive();
    const timer = window.setInterval(checkLive, 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
