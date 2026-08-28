import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../supabaseClient';

const REFRESH_MS = 12000;

export default function useLiveSupporterSpotlights(sessionId = null) {
  const [spotlights, setSpotlights] = useState([]);
  const refreshRunRef = useRef(0);

  const refresh = useCallback(async () => {
    const run = ++refreshRunRef.current;
    try {
      const { data, error } = await supabase.rpc('droxion_live_supporter_spotlights', {
        p_session_id: sessionId || null
      });
      if (run !== refreshRunRef.current) return;
      if (error) throw error;
      setSpotlights(Array.isArray(data) ? data : []);
    } catch {
      if (run === refreshRunRef.current) setSpotlights([]);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState !== 'hidden') refresh();
    };
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      refreshRunRef.current += 1;
      window.clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return { spotlights, refreshSpotlights: refresh };
}
