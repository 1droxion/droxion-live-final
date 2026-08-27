import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production LIVE reliability patch.
//
// The last confirmed working host stream connected to LiveKit and started
// publishing inside the START LIVE interaction itself. A later refactor moved
// that work entirely into a React effect; production then showed successful
// start RPCs and valid host tokens, but the LiveKit room still had 0
// participants six seconds later. Keep the newer deterministic start-session
// response path, but restore the proven direct host bootstrap before committing
// the immersive LIVE UI state.
function liveHostBootstrapPatch() {
  const startBefore = `      liveStateRevisionRef.current += 1;
      setBeautyMode('off');
      setOwnSessionId(startedSessionId);
      setIsLive(true);
      setActiveRoom(room);
      setNotice('Connecting LIVE video…');
      requestAnimationFrame(attachLocal);
      highlightRecorderRef.current = createLiveHighlightRecorder({
        creatorId: currentUserId,
        sessionId: startedSessionId,
        stream,
        title: room.title
      });
      loadLive().catch(() => {});`;

  const startAfter = `      setNotice('Connecting LIVE video…');

      let bootstrapRoom = null;
      try {
        const connection = await connectLiveKitRoom({
          sessionId: startedSessionId,
          role: 'host',
          onTrackSubscribed: (track, _publication, participant) => attachLiveKitTrack(track, participant),
          onTrackUnsubscribed: (track, _publication, participant) => detachLiveKitTrack(track, participant),
          onDisconnected: () => setNotice('LIVE connection disconnected. Reconnecting when available…'),
          onReconnecting: () => setNotice('Reconnecting LIVE…'),
          onReconnected: () => setNotice('You are live.'),
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
          setNotice('LIVE camera or microphone could not publish. Please end the LIVE and try again.');
        });

        // Do not make the creator wait for every SDK publication callback once
        // the host has joined the room. The existing publish confirmation path
        // continues in the background and the transport effect reuses this room.
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
        liveStateRevisionRef.current += 1;
        setIsLive(false);
        setOwnSessionId('');
        setActiveRoom(null);
        stopCamera();
        setSetupOpen(false);
        setNotice('LIVE video could not start. ' + (bootstrapError?.message || 'Please try again.'));
        return;
      }

      liveStateRevisionRef.current += 1;
      setBeautyMode('off');
      setOwnSessionId(startedSessionId);
      setIsLive(true);
      setActiveRoom(room);
      setNotice('You are live.');
      requestAnimationFrame(attachLocal);
      highlightRecorderRef.current = createLiveHighlightRecorder({
        creatorId: currentUserId,
        sessionId: startedSessionId,
        stream,
        title: room.title
      });
      loadLive().catch(() => {});`;

  const connectBefore = `      try {
        await room.connect(auth.url, auth.token, { autoSubscribe: true });
      } catch (error) {
        await logClientError('connect', error, { sessionId, role });
        throw error;
      }`;

  const connectAfter = `      try {
        let connectTimeout = null;
        try {
          await Promise.race([
            room.connect(auth.url, auth.token, { autoSubscribe: true }),
            new Promise((_, reject) => {
              connectTimeout = setTimeout(() => reject(new Error('LIVE connection timed out. Please try again.')), 10000);
            })
          ]);
        } finally {
          if (connectTimeout) clearTimeout(connectTimeout);
        }
      } catch (error) {
        try { await room.disconnect(true); } catch {}
        await logClientError('connect', error, { sessionId, role });
        throw error;
      }`;

  return {
    name: "droxion-live-host-bootstrap",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, "/").split("?")[0];

      if (normalizedId.endsWith("/src/LiveExperienceScale.jsx")) {
        if (!code.includes(startBefore)) {
          throw new Error("Droxion direct LIVE bootstrap target was not found.");
        }
        return { code: code.replace(startBefore, startAfter), map: null };
      }

      if (normalizedId.endsWith("/src/livekit/livekitRoom.js")) {
        if (!code.includes(connectBefore)) {
          throw new Error("Droxion LiveKit connect timeout target was not found.");
        }
        return { code: code.replace(connectBefore, connectAfter), map: null };
      }

      return null;
    }
  };
}

export default defineConfig({
  plugins: [liveHostBootstrapPatch(), react()],
  build: {
    outDir: "dist",
  },
});
