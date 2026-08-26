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

    // Never leave the creator trapped in the setup sheet while media connects.
    setSetupOpen(false);
    setNotice('Connecting LIVE video...');

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

  const closeBefore = `<button onClick={() => setSetupOpen(false)}><X size={21} /></button>`;
  const closeAfter = `<button type="button" onPointerDown={event => { event.preventDefault(); event.stopPropagation(); setSetupOpen(false); }} onClick={() => setSetupOpen(false)}><X size={21} /></button>`;

  return {
    name: "droxion-live-start-reliability-patch",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, "/").split("?")[0];
      if (!normalizedId.endsWith("/src/LiveExperienceScale.jsx")) return null;

      if (!code.includes(statusBefore)) throw new Error("Droxion LIVE status patch target was not found.");
      if (!code.includes(startBefore)) throw new Error("Droxion LIVE start patch target was not found.");

      let patched = code
        .replace(statusBefore, statusAfter)
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
