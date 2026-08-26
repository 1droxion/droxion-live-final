import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production safety patch for LIVE startup. A stale/failed status request must
// not erase a session that has just been created, and the setup modal must not
// stay blocked on a LiveKit SDK promise after the server already has the host
// camera and microphone tracks.
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
      // Never let a transient/unauthorized status read erase a LIVE that is
      // already being started with an active camera stream.
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

    // Enter the host room immediately. The local camera is already available,
    // so there is no reason to keep the creator trapped behind the setup modal
    // while LiveKit finishes publication acknowledgements.
    setBeautyMode('off');
    setIsLive(true);
    setOwnSessionId(startedSessionId);
    setActiveRoom(room);
    setSetupOpen(false);
    setNotice('Connecting LIVE video...');
    requestAnimationFrame(attachLocal);
    highlightRecorderRef.current = createLiveHighlightRecorder({
      creatorId: currentUserId,
      sessionId: startedSessionId,
      stream,
      title: room.title
    });
    loadLive().catch(() => {});

    // Bootstrap transport in the background. The normal React transport effect
    // uses the same connection cache, so either path can finish first safely.
    // Do not block the UI on publishLocalMedia: production diagnostics showed
    // both camera and microphone present in LiveKit while this promise remained
    // pending in the browser.
    (async () => {
      let bootstrapRoom = null;
      try {
        const connection = await connectLiveKitRoom({
          sessionId: startedSessionId,
          role: 'host',
          onTrackSubscribed: (track, _publication, participant) => attachLiveKitTrack(track, participant),
          onTrackUnsubscribed: (track, _publication, participant) => detachLiveKitTrack(track, participant),
          onDisconnected: () => setNotice('LIVE connection disconnected. Reconnecting when available...'),
          onReconnecting: () => setNotice('Reconnecting LIVE...'),
          onReconnected: () => setNotice('You are live.'),
          onAudioPlaybackChanged: canPlay => setAudioBlocked(!canPlay)
        });
        bootstrapRoom = connection.room;
        lkRoomRef.current = bootstrapRoom;
        lkRoleRef.current = 'host';

        const publishing = publishLocalMedia(bootstrapRoom, stream);
        const outcome = await Promise.race([
          publishing.then(() => 'published'),
          new Promise(resolve => window.setTimeout(() => resolve('timeout'), 5000))
        ]);

        if (outcome === 'published') setNotice('You are live.');
        else {
          // A timeout is not a failure. Keep the LIVE running and let the SDK
          // finish in the background; server-side room probes verify the media.
          setNotice('You are live.');
          publishing.catch(async publishError => {
            try {
              await supabase.rpc('droxion_log_live_client_error', {
                p_stage: 'start-live-publish-late-failure',
                p_message: String(publishError?.message || publishError || 'LIVE publish failed'),
                p_stack: String(publishError?.stack || ''),
                p_context: { sessionId: startedSessionId, role: 'host' }
              });
            } catch {}
            setNotice('LIVE video connection needs a retry.');
          });
        }
      } catch (bootstrapError) {
        try {
          await supabase.rpc('droxion_log_live_client_error', {
            p_stage: 'start-live-bootstrap',
            p_message: String(bootstrapError?.message || bootstrapError || 'LIVE bootstrap failed'),
            p_stack: String(bootstrapError?.stack || ''),
            p_context: { sessionId: startedSessionId, role: 'host' }
          });
        } catch {}
        setNotice('LIVE video connection failed. ' + (bootstrapError?.message || 'Please retry.'));
      }
    })();`;

  return {
    name: "droxion-live-start-reliability-patch",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, "/").split("?")[0];
      if (!normalizedId.endsWith("/src/LiveExperienceScale.jsx")) return null;

      if (!code.includes(statusBefore)) {
        throw new Error("Droxion LIVE status patch target was not found.");
      }
      if (!code.includes(startBefore)) {
        throw new Error("Droxion LIVE start patch target was not found.");
      }

      const patched = code
        .replace(statusBefore, statusAfter)
        .replace(startBefore, startAfter);

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
