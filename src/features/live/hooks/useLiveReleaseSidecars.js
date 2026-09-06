import { useEffect, useRef } from 'react';
import { subscribeLiveEvents, supabase } from '../../../supabaseClient';
import { createLiveHighlightRecorder } from '../../../livekit/liveHighlightRecorder';
import { createExplicitLiveContentGuard } from '../services/liveExplicitContentGuard';

const NOTIFICATION_ENDPOINT = 'https://www.droxion.com/api/notifications/live-start';

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
 * These sidecars intentionally do not own or republish LiveKit tracks. Push,
 * highlight scoring and explicit-content checks all observe the already-working
 * stream. The core LIVE transport remains independent from them.
 */
export function useLiveReleaseSidecars({
  enabled,
  creatorId,
  sessionId,
  stream,
  title = 'Live on Droxion',
  onModerationBlock
}) {
  const activeSessionRef = useRef('');
  const notifiedSessionsRef = useRef(new Set());
  const moderationCallbackRef = useRef(onModerationBlock);
  moderationCallbackRef.current = onModerationBlock;

  useEffect(() => {
    if (!enabled || !creatorId || !sessionId || !stream?.active) return undefined;
    if (activeSessionRef.current === sessionId) return undefined;

    activeSessionRef.current = sessionId;
    let stopped = false;
    let unsubscribe = null;
    let recorder = null;
    let explicitGuard = null;

    // Push is fire-and-forget and uses a server-side idempotency key equal to
    // the LIVE session ID, so native + web callers cannot create duplicates.
    if (!notifiedSessionsRef.current.has(sessionId)) {
      notifiedSessionsRef.current.add(sessionId);
      window.setTimeout(() => {
        if (!stopped) sendLiveStartedPush(sessionId);
      }, 250);
    }

    // MediaRecorder reads the existing media stream as a sidecar. It never
    // replaces or republishes the LiveKit tracks. The recorder ranks segments
    // and the server enforces at most five automatic highlights per creator/day.
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

    // Creator-only, on-device explicit-content guard. It deliberately ignores
    // the NSFW model's "Sexy" label and requires repeated very-high Porn scores.
    try {
      explicitGuard = createExplicitLiveContentGuard({
        sessionId,
        stream,
        onBlocked: detail => moderationCallbackRef.current?.(detail)
      });
    } catch (error) {
      console.warn('Droxion explicit-content guard could not start', error);
    }

    // Audience activity helps rank the strongest 30-second segments. Gifts are
    // a much stronger signal than ordinary chat, with deterministic tie-breaking
    // by the earliest source position.
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
      try { explicitGuard?.stop?.(); } catch {}
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
