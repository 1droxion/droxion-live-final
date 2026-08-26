import { supabase } from './supabaseClient';

// Prevent an older droxion_live_status request from overwriting a LIVE session
// that successfully started while that request was still in flight.
if (!supabase.__droxionLiveStartupRaceGuard) {
  const nativeRpc = supabase.rpc.bind(supabase);
  let recentStartedSession = null;
  let recentStartedAt = 0;
  const START_GUARD_MS = 30_000;

  supabase.rpc = async (fn, args, options) => {
    const result = await nativeRpc(fn, args, options);

    if (fn === 'droxion_start_live' && !result?.error && result?.data?.is_live && result?.data?.session_id) {
      recentStartedSession = String(result.data.session_id);
      recentStartedAt = Date.now();
      return result;
    }

    if ((fn === 'droxion_set_live' && args?.p_live === false) || fn === 'droxion_end_live') {
      recentStartedSession = null;
      recentStartedAt = 0;
      return result;
    }

    if (
      fn === 'droxion_live_status' &&
      !result?.error &&
      result?.data?.is_live === false &&
      recentStartedSession &&
      Date.now() - recentStartedAt < START_GUARD_MS
    ) {
      return {
        ...result,
        data: {
          ...(result.data || {}),
          is_live: true,
          session_id: recentStartedSession
        }
      };
    }

    if (fn === 'droxion_live_status' && result?.data?.is_live === true && result?.data?.session_id) {
      recentStartedSession = String(result.data.session_id);
      recentStartedAt = Date.now();
    }

    return result;
  };

  supabase.__droxionLiveStartupRaceGuard = true;
}
