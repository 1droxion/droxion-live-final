import { useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function LiveJoinDeclineEnhancer() {
  useEffect(() => {
    let stopped = false;
    let busy = false;
    let activeSessionId = '';
    let declined = false;

    function apply(room) {
      const button = room?.querySelector('.liveFloatingJoin');
      if (!button) return;
      if (declined) {
        button.style.setProperty('display', 'none', 'important');
        button.disabled = true;
        button.setAttribute('aria-hidden', 'true');
      }
    }

    async function tick() {
      if (stopped || busy) return;
      const room = document.querySelector('.liveRoomV4');
      if (!room) {
        activeSessionId = '';
        declined = false;
        return;
      }

      busy = true;
      try {
        const { data: context } = await supabase.rpc('droxion_current_live_context');
        if (!context?.active || context?.is_host !== false || !context?.session_id) return;

        if (context.session_id !== activeSessionId) {
          activeSessionId = context.session_id;
          declined = false;
        }

        const { data } = await supabase.rpc('droxion_my_live_join_request', {
          p_session_id: activeSessionId
        });
        declined = data?.status === 'declined';
        apply(room);
      } catch (error) {
        console.warn('LIVE join state check failed', error);
      } finally {
        busy = false;
      }
    }

    tick();
    const timer = window.setInterval(tick, 1000);
    const observer = new MutationObserver(() => {
      if (declined) apply(document.querySelector('.liveRoomV4'));
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
