import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production safety patch for LIVE startup. Keep the creator UI responsive even
// when camera, database, Supabase Edge Functions, or LiveKit take longer than
// expected. Every network step gets a bounded recovery path instead of leaving
// the creator on an endless "Starting LIVE" state.
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

  const startEntryBefore = `  async function startLive() {
    if (!currentUserId) return setNotice('Sign in before going live.');
    setNotice('');
    let stream;
    try { stream = await ensureCamera(liveSetup.orientation, 'user'); }`;

  const startEntryAfter = `  async function startLive() {
    if (!currentUserId) return setNotice('Sign in before going live.');
    // Give immediate visual feedback. The setup sheet must never remain frozen
    // while the browser or network is doing asynchronous LIVE startup work.
    setSetupOpen(false);
    setNotice('Starting LIVE...');
    let stream;
    try { stream = await ensureCamera(liveSetup.orientation, 'user'); }`;

  const cameraFailureBefore = `      setNotice(name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Camera or microphone permission is blocked. Allow Camera and Microphone for Droxion, then try again.'
        : error?.message || 'Camera and microphone are required to go live.');
      return;`;

  const cameraFailureAfter = `      setSetupOpen(true);
      setNotice(name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Camera or microphone permission is blocked. Allow Camera and Microphone for Droxion, then try again.'
        : error?.message || 'Camera and microphone are required to go live.');
      return;`;

  const startRpcBefore = `    const { data, error } = await supabase.rpc('droxion_start_live', {
      p_title: liveSetup.title.trim() || 'Live on Droxion',
      p_tags: tags,
      p_orientation: liveSetup.orientation,
      p_allow_guest_requests: liveSetup.allowGuests
    });
    if (error || !data?.is_live) { setNotice(error?.message || 'Could not start LIVE.'); stopCamera(); return; }`;

  const startRpcAfter = `    const startPayload = {
      p_title: liveSetup.title.trim() || 'Live on Droxion',
      p_tags: tags,
      p_orientation: liveSetup.orientation,
      p_allow_guest_requests: liveSetup.allowGuests
    };
    const settleLiveStartRequest = (request, timeoutMs) => Promise.race([
      Promise.resolve(request)
        .then(value => ({ value }))
        .catch(caught => ({ caught })),
      new Promise(resolve => window.setTimeout(() => resolve({ timeout: true }), timeoutMs))
    ]);

    // A PostgREST request can reach Postgres successfully while the browser
    // never receives/resolves the response. If that happens, verify the newly
    // created LIVE through status, then retry idempotently if needed.
    const firstStart = await settleLiveStartRequest(supabase.rpc('droxion_start_live', startPayload), 3500);
    let data = firstStart?.value?.data || null;
    let error = firstStart?.value?.error || firstStart?.caught || null;

    if (firstStart?.timeout) {
      setNotice('Confirming LIVE...');
      const statusCheck = await settleLiveStartRequest(supabase.rpc('droxion_live_status'), 2500);
      if (statusCheck?.value?.data?.is_live) {
        data = statusCheck.value.data;
        error = null;
      } else {
        setNotice('Retrying LIVE start...');
        const retryStart = await settleLiveStartRequest(supabase.rpc('droxion_start_live', startPayload), 3500);
        data = retryStart?.value?.data || null;
        error = retryStart?.value?.error || retryStart?.caught || (retryStart?.timeout ? new Error('LIVE start timed out.') : null);
      }
    }

    if (!data?.is_live) {
      const finalStatus = await settleLiveStartRequest(supabase.rpc('droxion_live_status'), 2500);
      if (finalStatus?.value?.data?.is_live) {
        data = finalStatus.value.data;
        error = null;
      }
    }

    if (error || !data?.is_live) {
      setSetupOpen(true);
      setNotice(error?.message || 'Could not start LIVE. Please try again.');
      stopCamera();
      return;
    }`;

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
      setSetupOpen(true);
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

    // Enter the local host stage before waiting for LiveKit. The creator should
    // always see their own camera immediately after the LIVE session is created.
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

    // Bootstrap transport in the background. If the initial token request or
    // LiveKit websocket stalls, connectLiveKitRoom now times out and removes the
    // stale cache entry, allowing this loop to make a clean second attempt.
    (async () => {
      let lastBootstrapError = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
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
          const bootstrapRoom = connection.room;
          lkRoomRef.current = bootstrapRoom;
          lkRoleRef.current = 'host';

          const publishing = publishLocalMedia(bootstrapRoom, stream);
          const outcome = await Promise.race([
            publishing.then(() => 'published'),
            new Promise(resolve => window.setTimeout(() => resolve('timeout'), 5000))
          ]);

          setNotice('You are live.');
          if (outcome === 'timeout') {
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
          return;
        } catch (bootstrapError) {
          lastBootstrapError = bootstrapError;
          if (attempt === 0) {
            setNotice('Retrying LIVE video...');
            await new Promise(resolve => window.setTimeout(resolve, 700));
          }
        }
      }

      try {
        await supabase.rpc('droxion_log_live_client_error', {
          p_stage: 'start-live-bootstrap',
          p_message: String(lastBootstrapError?.message || lastBootstrapError || 'LIVE bootstrap failed'),
          p_stack: String(lastBootstrapError?.stack || ''),
          p_context: { sessionId: startedSessionId, role: 'host' }
        });
      } catch {}
      setNotice('LIVE video connection failed. ' + (lastBootstrapError?.message || 'Please retry.'));
    })();`;

  const tokenInvokeBefore = `  const { data, error } = await supabase.functions.invoke(TOKEN_FUNCTION, {
    body: { sessionId, role, clientInstanceId: CLIENT_INSTANCE_ID },
    headers: { Authorization: \`Bearer \${session.access_token}\` }
  });

  if (error) throw new Error(data?.error || error.message || 'Could not authorize LIVE connection.');
  if (!data?.token || !data?.url) throw new Error(data?.error || 'LIVE connection token is missing.');
  return data;`;

  const tokenInvokeAfter = `  const invokeToken = () => supabase.functions.invoke(TOKEN_FUNCTION, {
    body: { sessionId, role, clientInstanceId: CLIENT_INSTANCE_ID },
    headers: { Authorization: \`Bearer \${session.access_token}\` }
  });
  const settleToken = request => Promise.race([
    Promise.resolve(request)
      .then(value => ({ value }))
      .catch(caught => ({ caught })),
    new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 6500))
  ]);

  let attempt = await settleToken(invokeToken());
  if (attempt?.timeout) {
    await logClientError('token-timeout', new Error('LIVE token request timed out.'), { sessionId, role });
    attempt = await settleToken(invokeToken());
  }

  if (attempt?.timeout) throw new Error('LIVE video authorization timed out.');
  if (attempt?.caught) throw attempt.caught;
  const { data, error } = attempt?.value || {};
  if (error) throw new Error(data?.error || error.message || 'Could not authorize LIVE connection.');
  if (!data?.token || !data?.url) throw new Error(data?.error || 'LIVE connection token is missing.');
  return data;`;

  const connectBefore = `      try {
        await room.connect(auth.url, auth.token, { autoSubscribe: true });
      } catch (error) {
        await logClientError('connect', error, { sessionId, role });
        throw error;
      }`;

  const connectAfter = `      let initialConnectTimer = null;
      try {
        const connectAttempt = room.connect(auth.url, auth.token, { autoSubscribe: true });
        await Promise.race([
          connectAttempt,
          new Promise((_, reject) => {
            initialConnectTimer = setTimeout(() => reject(new Error('LIVE connection timed out.')), 8000);
          })
        ]);
      } catch (error) {
        try { room.disconnect(); } catch {}
        await logClientError('connect', error, { sessionId, role });
        throw error;
      } finally {
        if (initialConnectTimer) clearTimeout(initialConnectTimer);
      }`;

  return {
    name: "droxion-live-start-reliability-patch",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, "/").split("?")[0];

      if (normalizedId.endsWith("/src/LiveExperienceScale.jsx")) {
        const required = [statusBefore, startEntryBefore, cameraFailureBefore, startRpcBefore, startBefore];
        if (required.some(target => !code.includes(target))) {
          throw new Error("Droxion LIVE startup patch target was not found.");
        }
        const patched = code
          .replace(statusBefore, statusAfter)
          .replace(startEntryBefore, startEntryAfter)
          .replace(cameraFailureBefore, cameraFailureAfter)
          .replace(startRpcBefore, startRpcAfter)
          .replace(startBefore, startAfter);
        return { code: patched, map: null };
      }

      if (normalizedId.endsWith("/src/livekit/livekitRoom.js")) {
        if (!code.includes(tokenInvokeBefore) || !code.includes(connectBefore)) {
          throw new Error("Droxion LiveKit startup timeout patch target was not found.");
        }
        const patched = code
          .replace(tokenInvokeBefore, tokenInvokeAfter)
          .replace(connectBefore, connectAfter);
        return { code: patched, map: null };
      }

      return null;
    }
  };
}

export default defineConfig({
  plugins: [liveStartReliabilityPatch(), react()],
  build: {
    outDir: "dist",
  },
});