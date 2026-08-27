import { useEffect, useRef } from 'react';
import { subscribeLiveEvents, supabase } from '../../../supabaseClient';
import { createLiveHighlightRecorder } from '../../../livekit/liveHighlightRecorder';

const NOTIFICATION_ENDPOINT = '/api/notifications/live-start';

async function sendLiveStartedPush(sessionId) {
  if (!sessionId) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const response = await fetch(NOTIFICATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ sessionId })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.warn('Droxion LIVE notification sidecar failed', payload?.error || response.status);
    }
  } catch (error) {
    console.warn('Droxion LIVE notification sidecar failed', error);
  }
}

/**
 * Release sidecars for a healthy LIVE session.
 *
 * This hook intentionally does not own or mutate LiveKit, the media stream,
 * session lifecycle, heartbeat, camera/mic state, or routing. If either
 * notification or clipping fails, the LIVE continues normally.
 */
export function useLiveReleaseSidecars({
  enabled,
  creatorId,
  sessionId,
  stream,
  title = 'Live on Droxion'
}) {
  const activeSessionRef = useRef('');
  const notifiedSessionsRef = useRef(new Set());

  useEffect(() => {
    if (!enabled || !creatorId || !sessionId || !stream?.active) return undefined;
    if (activeSessionRef.current === sessionId) return undefined;

    activeSessionRef.current = sessionId;
    let stopped = false;
    let unsubscribe = null;
    let recorder = null;

    // Push is fire-and-forget and uses a server-side idempotency key equal to
    // the LIVE session ID, so native + web callers cannot create duplicates.
    if (!notifiedSessionsRef.current.has(sessionId)) {
      notifiedSessionsRef.current.add(sessionId);
      window.setTimeout(() => {
        if (!stopped) sendLiveStartedPush(sessionId);
      }, 250);
    }

    // MediaRecorder reads the existing camera/mic MediaStream as a sidecar.
    // It never replaces or republishes the LiveKit tracks.
    try {
      recorder = createLiveHighlightRecorder({
        creatorId,
        sessionId,
        stream,
        title
      });
    } catch (error) {
      console.warn('Droxion auto-clip sidecar could not start', error);
    }

    // Audience activity helps choose the best 1-2 thirty-second segments.
    // This subscription is scoring-only; chat/gifts keep their own UI path.
    if (recorder) {
      try {
        unsubscribe = subscribeLiveEvents(sessionId, event => {
          if (stopped || !event) return;
          if (event.type === 'gift') recorder?.markMoment?.(8);
          else if (event.type === 'chat') recorder?.markMoment?.(1);
        });
      } catch {}
    }

    return () => {
      stopped = true;
      try { unsubscribe?.(); } catch {}
      if (activeSessionRef.current === sessionId) activeSessionRef.current = '';
      try {
        Promise.resolve(recorder?.stopAndPublish?.()).catch(error => {
          console.warn('Droxion auto-clip background publish failed', error);
        });
      } catch (error) {
        console.warn('Droxion auto-clip background publish failed', error);
      }
    };
  }, [enabled, creatorId, sessionId, stream, title]);
}
