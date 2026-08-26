import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proven production LIVE startup path. Keep the host transport bootstrap in the
// START LIVE interaction instead of waiting for a later React effect. This is
// the path that produced real LiveKit host participants in production.
function liveStartReliabilityPatch() {
  const statusBefore = `      const [{ data: status }, { data: giftRows }] = await Promise.all([
        supabase.rpc('droxion_live_status'),
        supabase.rpc('droxion_gift_options')
      ]);
      if (!alive) return;
      setIsLive(Boolean(status?.is_live));
      setOwnSessionId(status?.is_live ? status?.session_id || '' : '');
      if (status?.title || status?.orientation) {
        setLiveSetup(current => ({
          ...current,
          title: status?.title || current.title,
          tags: Array.isArray(status?.tags) ? status.tags.join(', ') : current.tags,
          orientation: status?.orientation || current.orientation,
          allowGuests: status?.allow_guest_requests !== false
        }));
      }
      setGifts(giftRows || []);`;

  const statusAfter = `      const [{ data: status, error: statusError }, { data: giftRows }] = await Promise.all([
        supabase.rpc('droxion_live_status'),
        supabase.rpc('droxion_gift_options')
      ]);
      if (!alive) return;
      if (!statusError && status && !(streamRef.current?.active && status?.is_live === false)) {
        setIsLive(Boolean(status?.is_live));
        setOwnSessionId(status?.is_live ? status?.session_id || '' : '');
        if (status?.title || status?.orientation) {
          setLiveSetup(current => ({
            ...current,
            title: status?.title || current.title,
            tags: Array.isArray(status?.tags) ? status.tags.join(', ') : current.tags,
            orientation: status?.orientation || current.orientation,
            allowGuests: status?.allow_guest_requests !== false
          }));
        }
      }
      setGifts(giftRows || []);`;

  const rpcBefore = `    const { data, error } = await supabase.rpc('droxion_start_live', {
      p_title: liveSetup.title.trim() || 'Live on Droxion',
      p_tags: tags,
      p_orientation: liveSetup.orientation,
      p_allow_guest_requests: liveSetup.allowGuests
    });
    if (error || !data?.is_live) { setNotice(error?.message || 'Could not start LIVE.'); stopCamera(); return; }`;

  const rpcAfter = `    setSetupOpen(false);
    setNotice('Starting LIVE...');

    const clientSessionId = globalThis.crypto?.randomUUID?.();
    if (!clientSessionId) {
      setNotice('Could not create a LIVE session ID. Please try again.');
      stopCamera();
      return;
    }

    // Supabase auth can be temporarily locked by another auth callback. Reading
    // the already-persisted browser session first keeps START LIVE independent
    // of that lock. The bounded getSession fallback guarantees the UI can never
    // sit on "Starting LIVE..." forever.
    let accessToken = '';
    try {
      const projectRef = new URL(String(import.meta.env.VITE_SUPABASE_URL || '')).hostname.split('.')[0];
      const rawSession = window.localStorage?.getItem('sb-' + projectRef + '-auth-token');
      if (rawSession) {
        const parsedSession = JSON.parse(rawSession);
        const storedSession = parsedSession?.currentSession || parsedSession?.session || parsedSession;
        const expiresAtMs = Number(storedSession?.expires_at || 0) * 1000;
        if (storedSession?.access_token && (!expiresAtMs || expiresAtMs > Date.now() + 30000)) {
          accessToken = storedSession.access_token;
        }
      }
    } catch {}

    if (!accessToken) {
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        new Promise(resolve => window.setTimeout(() => resolve({ data: { session: null }, error: new Error('session_timeout') }), 1500))
      ]);
      accessToken = sessionResult?.data?.session?.access_token || '';
    }

    if (!accessToken) {
      setNotice('Could not read your login session. Please try LIVE again.');
      stopCamera();
      return;
    }

    const startController = new AbortController();
    const startTimer = window.setTimeout(() => startController.abort(), 8000);
    let startResponse = null;
    try {
      startResponse = await fetch(String(import.meta.env.VITE_SUPABASE_URL || '') + '/rest/v1/rpc/droxion_start_live_v2', {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_session_id: clientSessionId,
          p_title: liveSetup.title.trim() || 'Live on Droxion',
          p_tags: tags,
          p_orientation: liveSetup.orientation,
          p_allow_guest_requests: liveSetup.allowGuests
        }),
        cache: 'no-store',
        signal: startController.signal
      });
    } catch (startError) {
      setNotice(startError?.name === 'AbortError' ? 'LIVE start timed out. Please try again.' : startError?.message || 'Could not start LIVE.');
      stopCamera();
      return;
    } finally {
      window.clearTimeout(startTimer);
    }

    if (!startResponse?.ok) {
      setNotice('Could not start LIVE.');
      stopCamera();
      return;
    }

    // Do not read the PostgREST success body here. The old startup loop was
    // created after the server write while the RPC wrapper was still waiting.
    // The browser already owns the authoritative session ID.
    const data = {
      is_live: true,
      session_id: clientSessionId,
      title: liveSetup.title.trim() || 'Live on Droxion',
      tags,
      orientation: liveSetup.orientation,
      allow_guest_requests: liveSetup.allowGuests
    };
    const error = null;`;

  const startBefore = `    const room = {
      user_id: currentUserId,
      session_id: data.session_id,
      display_name: 'Your Live',
      title: data.title || liveSetup.title || 'Live on Droxion',
      tags: data.tags || tags,
      orientation: data.orientation || liveSetup.orientation,
      allow_guest_requests: data.allow_guest_requests !== false
    };
    setBeautyMode('off');
    setIsLive(true);
    setOwnSessionId(data.session_id || '');
    setActiveRoom(room);
    setSetupOpen(false);
    setNotice('You are live.');
    requestAnimationFrame(attachLocal);
    highlightRecorderRef.current = createLiveHighlightRecorder({
      creatorId: currentUserId,
      sessionId: data.session_id,
      stream,
      title: room.title
    });
    await loadLive();`;

  const startAfter = `    const startedSessionId = String(data.session_id || '').trim();
    if (!startedSessionId) {
      setSetupOpen(false);
      setNotice('LIVE session ID is missing. Please try again.');
      stopCamera();
      return;
    }

    const room = {
      user_id: currentUserId,
      session_id: startedSessionId,
      display_name: 'Your Live',
      title: data.title || liveSetup.title || 'Live on Droxion',
      tags: data.tags || tags,
      orientation: data.orientation || liveSetup.orientation,
      allow_guest_requests: data.allow_guest_requests !== false
    };

    // The backend session is authoritative now. Enter the LIVE room UI
    // immediately instead of leaving the creator on the browse page while the
    // media transport settles. Local camera preview is already available.
    setBeautyMode('off');
    setIsLive(true);
    setOwnSessionId(startedSessionId);
    setActiveRoom(room);
    setSetupOpen(false);
    setNotice('Connecting LIVE video...');
    requestAnimationFrame(attachLocal);

    let bootstrapRoom = null;
    try {
      const connection = await connectLiveKitRoom({
        sessionId: startedSessionId,
        role: 'host',
        onTrackSubscribed: (track, _publication, participant) => attachLiveKitTrack(track, participant),
        onTrackUnsubscribed: (track, _publication, participant) => detachLiveKitTrack(track, participant),
        onDisconnected: () => setNotice('LIVE connection disconnected. Reconnecting when available...'),
        onReconnecting: () => setNotice('Reconnecting LIVE...'),
        onReconnected: () => setNotice(''),
        onAudioPlaybackChanged: canPlay => setAudioBlocked(!canPlay)
      });
      bootstrapRoom = connection.room;
      lkRoomRef.current = bootstrapRoom;
      lkRoleRef.current = 'host';
      const mediaPublish = publishLocalMedia(bootstrapRoom, stream);
      mediaPublish.catch(async publishError => {
        try {
          await supabase.rpc('droxion_log_live_client_error', {
            p_stage: 'start-live-publish-background',
            p_message: String(publishError?.message || publishError || 'LIVE background publish failed'),
            p_stack: String(publishError?.stack || ''),
            p_context: { sessionId: startedSessionId, role: 'host' }
          });
        } catch {}
        setNotice('LIVE media needs attention. Please end the LIVE and try again.');
      });
      await Promise.race([
        mediaPublish,
        new Promise(resolve => window.setTimeout(resolve, 1500))
      ]);
    } catch (bootstrapError) {
      try {
        await supabase.rpc('droxion_log_live_client_error', {
          p_stage: 'start-live-bootstrap',
          p_message: String(bootstrapError?.message || bootstrapError || 'LIVE bootstrap failed'),
          p_stack: String(bootstrapError?.stack || ''),
          p_context: { sessionId: startedSessionId, role: 'host' }
        });
      } catch {}
      try { await supabase.rpc('droxion_set_live', { p_live: false }); } catch {}
      if (bootstrapRoom) {
        try { await disconnectLiveKitRoom(bootstrapRoom); } catch {}
      }
      if (lkRoomRef.current === bootstrapRoom) {
        lkRoomRef.current = null;
        lkRoleRef.current = '';
      }
      setIsLive(false);
      setOwnSessionId('');
      setActiveRoom(null);
      stopCamera();
      setSetupOpen(false);
      setNotice('LIVE video could not start. ' + (bootstrapError?.message || 'Please try again.'));
      return;
    }

    setNotice('You are live.');
    requestAnimationFrame(attachLocal);
    highlightRecorderRef.current = createLiveHighlightRecorder({
      creatorId: currentUserId,
      sessionId: startedSessionId,
      stream,
      title: room.title
    });
    await loadLive();`;

  const closeBefore = `<button onClick={() => setSetupOpen(false)}><X size={21} /></button>`;
  const closeAfter = `<button type="button" onPointerDown={event => { event.preventDefault(); event.stopPropagation(); setSetupOpen(false); }} onClick={() => setSetupOpen(false)}><X size={21} /></button>`;

  return {
    name: "droxion-live-start-reliability-patch",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, "/").split("?")[0];
      if (!normalizedId.endsWith("/src/LiveExperienceScale.jsx")) return null;

      if (!code.includes(statusBefore)) throw new Error("Droxion LIVE status patch target was not found.");
      if (!code.includes(rpcBefore)) throw new Error("Droxion LIVE start RPC patch target was not found.");
      if (!code.includes(startBefore)) throw new Error("Droxion LIVE start patch target was not found.");

      let patched = code
        .replace(statusBefore, statusAfter)
        .replace(rpcBefore, rpcAfter)
        .replace(startBefore, startAfter);
      if (patched.includes(closeBefore)) patched = patched.replace(closeBefore, closeAfter);

      return { code: patched, map: null };
    }
  };
}

export default defineConfig({
  plugins: [liveStartReliabilityPatch(), react()],
  build: {
    outDir: "dist",
  },
});