import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production safety patch for the LIVE start race. The backend can create a
// LIVE session before React's transport effect gets a chance to request the
// LiveKit token. Bootstrapping the host transport inside startLive makes the
// operation transactional from the creator's point of view: either camera +
// LiveKit publishing succeeds, or the backend LIVE flag is rolled back.
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

    // Do not wait for the post-render effect to begin the host connection.
    // The session is already authoritative at this point, so connect and
    // publish the exact camera stream while this click handler is still alive.
    let bootstrapRoom = null;
    try {
      setNotice('Connecting LIVE video...');
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
      await publishLocalMedia(bootstrapRoom, stream);
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
      stopCamera();
      setSetupOpen(false);
      setNotice('LIVE video could not start. ' + (bootstrapError?.message || 'Please try again.'));
      return;
    }

    setBeautyMode('off');
    setIsLive(true);
    setOwnSessionId(startedSessionId);
    setActiveRoom(room);
    setSetupOpen(false);
    setNotice('You are live.');
    requestAnimationFrame(attachLocal);
    highlightRecorderRef.current = createLiveHighlightRecorder({
      creatorId: currentUserId,
      sessionId: startedSessionId,
      stream,
      title: room.title
    });
    await loadLive();`;

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
