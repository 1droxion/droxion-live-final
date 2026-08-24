import { useEffect } from 'react';
import { supabase } from './supabaseClient';

const WATCH_RETRY_MS = 4500;
const TICK_MS = 900;

function videoHasLiveTrack(video) {
  const stream = video?.srcObject;
  if (!stream?.getVideoTracks) return false;
  return stream.getVideoTracks().some(track => track.readyState === 'live' && track.enabled !== false);
}

export default function LiveReliabilityEnhancer() {
  useEffect(() => {
    let stopped = false;
    let busy = false;
    let sessionId = '';
    let lastWatchRequestAt = 0;
    let lastJoinStatusCheckAt = 0;
    let declinedForSession = false;

    const reset = nextSessionId => {
      sessionId = nextSessionId || '';
      lastWatchRequestAt = 0;
      lastJoinStatusCheckAt = 0;
      declinedForSession = false;
    };

    const hideDeclinedJoinButton = room => {
      const button = room?.querySelector('.liveFloatingJoin');
      if (!button) return;
      if (declinedForSession) {
        button.style.setProperty('display', 'none', 'important');
        button.setAttribute('aria-hidden', 'true');
        button.disabled = true;
      } else if (button.getAttribute('aria-hidden') === 'true') {
        button.style.removeProperty('display');
        button.removeAttribute('aria-hidden');
      }
    };

    const refreshJoinStatus = async (room, activeSessionId) => {
      const now = Date.now();
      if (now - lastJoinStatusCheckAt < 1200) {
        hideDeclinedJoinButton(room);
        return;
      }
      lastJoinStatusCheckAt = now;

      const { data, error } = await supabase.rpc('droxion_my_live_join_request', {
        p_session_id: activeSessionId
      });
      if (!error && data?.request_id) {
        declinedForSession = data.status === 'declined';
      }
      hideDeclinedJoinButton(room);
    };

    const retryViewerStream = async (room, context) => {
      const video = room.querySelector('.liveMainVideo:not(.liveLocalPreview)');
      if (!video) return;

      if (videoHasLiveTrack(video)) {
        video.muted = true;
        video.setAttribute('playsinline', '');
        video.play?.().catch(() => {});
        return;
      }

      const now = Date.now();
      if (now - lastWatchRequestAt < WATCH_RETRY_MS) return;
      lastWatchRequestAt = now;

      const { error } = await supabase.rpc('droxion_send_live_signal', {
        p_session_id: context.session_id,
        p_recipient_id: context.host_id,
        p_stream_role: 'host',
        p_signal_type: 'watch_request',
        p_payload: { recovery: true, requested_at: new Date().toISOString() }
      });

      if (error) console.warn('LIVE recovery watch request failed', error);
    };

    const tick = async () => {
      if (stopped || busy) return;
      const room = document.querySelector('.liveRoomV4');
      if (!room) {
        if (sessionId) reset('');
        return;
      }

      busy = true;
      try {
        const { data: context, error } = await supabase.rpc('droxion_current_live_context');
        if (stopped || error || !context?.active || !context?.session_id) return;

        if (context.session_id !== sessionId) reset(context.session_id);
        if (context.is_host === true) return;

        await refreshJoinStatus(room, context.session_id);
        if (context.host_id) await retryViewerStream(room, context);
      } catch (error) {
        console.warn('LIVE reliability check failed', error);
      } finally {
        busy = false;
      }
    };

    tick();
    const timer = window.setInterval(tick, TICK_MS);
    const observer = new MutationObserver(() => {
      const room = document.querySelector('.liveRoomV4');
      if (room && declinedForSession) hideDeclinedJoinButton(room);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      stopped = true;
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}
