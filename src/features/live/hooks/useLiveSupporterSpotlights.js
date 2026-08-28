import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../supabaseClient';

const REFRESH_MS = 12000;

export default function useLiveSupporterSpotlights(sessionId) {
  const [spotlights, setSpotlights] = useState([]);
  const refreshRunRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setSpotlights([]);
      return;
    }

    const run = ++refreshRunRef.current;
    try {
      const { data, error } = await supabase.rpc('droxion_live_supporter_spotlights', {
        p_session_id: sessionId
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
    if (!sessionId) return undefined;

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
  }, [sessionId, refresh]);

  return { spotlights, refreshSpotlights: refresh };
}
