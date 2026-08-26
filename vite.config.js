import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// LIVE startup reliability patch. The browser has shown repeatable failures in
// camera acquisition and network promises. Critical startup steps are bounded
// so the creator can never remain forever on "Starting LIVE...".
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

  const ensureCameraBefore = `  const ensureCamera = useCallback(async (
    orientation = 'vertical',
    requestedFacing = facingMode,
    recoveryState = null
  ) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera is not supported on this device.');
    if (streamRef.current?.active) { attachLocal(); return streamRef.current; }
    const portrait = orientation !== 'horizontal';
    const video = portrait
      ? { facingMode: { ideal: requestedFacing }, width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30, max: 30 } }
      : { facingMode: { ideal: requestedFacing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (firstError) {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
      catch { throw firstError; }
    }
    const cameraEnabled = recoveryState?.cameraOn ?? true;
    const microphoneEnabled = recoveryState?.micOn ?? true;
    applyMediaEnabledState(stream, { cameraOn: cameraEnabled, micOn: microphoneEnabled });
    streamRef.current = stream;
    setFacingMode(requestedFacing);
    if (!recoveryState) {
      setMicOn(true);
      setCameraOn(true);
    }
    requestAnimationFrame(() => { attachLocal(); window.setTimeout(attachLocal, 150); });
    return stream;
  }, [attachLocal, facingMode]);`;

  const ensureCameraAfter = `  const ensureCamera = useCallback(async (
    orientation = 'vertical',
    requestedFacing = facingMode,
    recoveryState = null
  ) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera is not supported on this device.');
    if (streamRef.current?.active) { attachLocal(); return streamRef.current; }

    const portrait = orientation !== 'horizontal';
    const video = portrait
      ? { facingMode: { ideal: requestedFacing }, width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30, max: 30 } }
      : { facingMode: { ideal: requestedFacing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };

    const getMediaWithTimeout = (constraints, timeoutMs, timeoutMessage) => {
      let expired = false;
      let timer = null;
      const request = navigator.mediaDevices.getUserMedia(constraints).then(media => {
        if (expired) {
          media.getTracks().forEach(track => track.stop());
          const lateError = new Error(timeoutMessage);
          lateError.name = 'CameraTimeoutError';
          throw lateError;
        }
        return media;
      });
      const timeout = new Promise((_, reject) => {
        timer = window.setTimeout(() => {
          expired = true;
          const timeoutError = new Error(timeoutMessage);
          timeoutError.name = 'CameraTimeoutError';
          reject(timeoutError);
        }, timeoutMs);
      });
      return Promise.race([request, timeout]).finally(() => {
        if (timer) window.clearTimeout(timer);
      });
    };

    // Acquire the camera separately from the microphone. On some Chromium/
    // Windows device combinations a combined audio+video request can remain
    // pending indefinitely. Video is mandatory; microphone is best-effort.
    let stream;
    let cameraError = null;
    try {
      stream = await getMediaWithTimeout(
        { video, audio: false },
        7000,
        'Camera did not start within 7 seconds.'
      );
    } catch (firstError) {
      cameraError = firstError;
      try {
        stream = await getMediaWithTimeout(
          { video: true, audio: false },
          5000,
          'Camera did not start. Close other apps using the camera and try again.'
        );
        cameraError = null;
      } catch {
        throw cameraError || firstError;
      }
    }

    let microphoneAvailable = false;
    try {
      const microphoneStream = await getMediaWithTimeout(
        { video: false, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } },
        2500,
        'Microphone did not start.'
      );
      const microphoneTrack = microphoneStream.getAudioTracks()[0];
      if (microphoneTrack) {
        stream.addTrack(microphoneTrack);
        microphoneAvailable = true;
      }
      microphoneStream.getTracks().forEach(track => {
        if (track !== microphoneTrack) track.stop();
      });
    } catch {
      // A microphone failure must not prevent the creator from going LIVE.
      microphoneAvailable = false;
    }

    const cameraEnabled = recoveryState?.cameraOn ?? true;
    const microphoneEnabled = microphoneAvailable && (recoveryState?.micOn ?? true);
    applyMediaEnabledState(stream, { cameraOn: cameraEnabled, micOn: microphoneEnabled });
    streamRef.current = stream;
    setFacingMode(requestedFacing);
    if (!recoveryState) {
      setMicOn(microphoneAvailable);
      setCameraOn(true);
    }
    requestAnimationFrame(() => { attachLocal(); window.setTimeout(attachLocal, 100); window.setTimeout(attachLocal, 300); });
    return stream;
  }, [attachLocal, facingMode]);`;

  const startEntryBefore = `  async function startLive() {
    if (!currentUserId) return setNotice('Sign in before going live.');
    setNotice('');
    let stream;
    try { stream = await ensureCamera(liveSetup.orientation, 'user'); }`;

  const startEntryAfter = `  async function startLive() {
    if (!currentUserId) return setNotice('Sign in before going live.');
    setSetupOpen(false);
    setNotice('Opening camera...');
    let stream;
    try {
      stream = await ensureCamera(liveSetup.orientation, 'user');
      setNotice('Starting LIVE...');
    }`;

  const cameraFailureBefore = `      setNotice(name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Camera or microphone permission is blocked. Allow Camera and Microphone for Droxion, then try again.'
        : error?.message || 'Camera and microphone are required to go live.');
      return;`;

  const cameraFailureAfter = `      setSetupOpen(true);
      setNotice(name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Camera permission is blocked. Allow Camera for Droxion, then try again.'
        : error?.message || 'Camera is required to go live.');
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

    const directLiveRpc = async (fn, payload = {}, timeoutMs = 5000) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in before going live.');
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(\`${'${import.meta.env.VITE_SUPABASE_URL}'}/rest/v1/rpc/\${fn}\`, {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: \`Bearer \${session.access_token}\`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(payload || {}),
          cache: 'no-store',
          signal: controller.signal
        });
        const text = await response.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch { body = text; }
        if (!response.ok) throw new Error(body?.message || body?.error || text || \`LIVE request failed (\${response.status}).\`);
        return body;
      } finally {
        window.clearTimeout(timer);
      }
    };

    let data = null;
    let error = null;
    try {
      data = await directLiveRpc('droxion_start_live', startPayload, 5000);
    } catch (startError) {
      error = startError;
      setNotice('Confirming LIVE...');
      try {
        const status = await directLiveRpc('droxion_live_status', {}, 3500);
        if (status?.is_live) { data = status; error = null; }
      } catch {}
    }

    if (!data?.is_live) {
      setNotice('Retrying LIVE start...');
      try {
        data = await directLiveRpc('droxion_start_live', startPayload, 5000);
        error = null;
      } catch (retryError) {
        error = retryError;
        try {
          const status = await directLiveRpc('droxion_live_status', {}, 3500);
          if (status?.is_live) { data = status; error = null; }
        } catch {}
      }
    }

    if (error || !data?.is_live) {
      setSetupOpen(true);
      setNotice(error?.name === 'AbortError' ? 'LIVE start timed out. Please try again.' : (error?.message || 'Could not start LIVE. Please try again.'));
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

    setBeautyMode('off');
    setIsLive(true);
    setOwnSessionId(startedSessionId);
    setActiveRoom(room);
    setSetupOpen(false);
    setNotice('Connecting LIVE video...');
    requestAnimationFrame(() => { attachLocal(); window.setTimeout(attachLocal, 100); });
    highlightRecorderRef.current = createLiveHighlightRecorder({
      creatorId: currentUserId,
      sessionId: startedSessionId,
      stream,
      title: room.title
    });
    loadLive().catch(() => {});

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
          if (outcome === 'timeout') publishing.catch(() => setNotice('LIVE video connection needs a retry.'));
          return;
        } catch (bootstrapError) {
          lastBootstrapError = bootstrapError;
          if (attempt === 0) {
            setNotice('Retrying LIVE video...');
            await new Promise(resolve => window.setTimeout(resolve, 700));
          }
        }
      }
      setNotice('LIVE video connection failed. ' + (lastBootstrapError?.message || 'Please retry.'));
    })();`;

  const heartbeatBefore = `  useEffect(() => {
    if (!isLive) return;
    const heartbeat = async () => {
      const { data } = await supabase.rpc('droxion_live_heartbeat');
      if (data?.is_live === false) {
        setIsLive(false);
        setOwnSessionId('');
        await disconnectTransport();
        stopCamera();
        setNotice('');
      }
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 15000);
    return () => window.clearInterval(timer);
  }, [isLive, disconnectTransport, stopCamera]);`;

  const heartbeatAfter = `  useEffect(() => {
    if (!isLive) return;
    let disposed = false;
    const heartbeat = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 4000);
        try {
          const response = await fetch(\`${'${import.meta.env.VITE_SUPABASE_URL}'}/rest/v1/rpc/droxion_live_heartbeat\`, {
            method: 'POST',
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: \`Bearer \${session.access_token}\`,
              'Content-Type': 'application/json'
            },
            body: '{}',
            cache: 'no-store',
            signal: controller.signal
          });
          if (!response.ok) return;
          const data = await response.json().catch(() => null);
          if (!disposed && data?.is_live === false) {
            setIsLive(false);
            setOwnSessionId('');
            await disconnectTransport();
            stopCamera();
            setNotice('');
          }
        } finally { window.clearTimeout(timeout); }
      } catch {}
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 15000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [isLive, disconnectTransport, stopCamera]);`;

  const logClientErrorBefore = `async function logClientError(stage, error, context = {}) {
  try {
    await supabase.rpc('droxion_log_live_client_error', {
      p_stage: stage,
      p_message: String(error?.message || error || 'unknown error'),
      p_stack: String(error?.stack || ''),
      p_context: context
    });
  } catch {}
}`;

  const logClientErrorAfter = `function logClientError(stage, error, context = {}) {
  try {
    const request = supabase.rpc('droxion_log_live_client_error', {
      p_stage: stage,
      p_message: String(error?.message || error || 'unknown error'),
      p_stack: String(error?.stack || ''),
      p_context: context
    });
    Promise.race([
      Promise.resolve(request),
      new Promise(resolve => setTimeout(resolve, 750))
    ]).catch(() => {});
  } catch {}
  return Promise.resolve();
}`;

  const tokenInvokeBefore = `  const { data, error } = await supabase.functions.invoke(TOKEN_FUNCTION, {
    body: { sessionId, role, clientInstanceId: CLIENT_INSTANCE_ID },
    headers: { Authorization: \`Bearer \${session.access_token}\` }
  });

  if (error) throw new Error(data?.error || error.message || 'Could not authorize LIVE connection.');
  if (!data?.token || !data?.url) throw new Error(data?.error || 'LIVE connection token is missing.');
  return data;`;

  const tokenInvokeAfter = `  const requestToken = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(\`${'${import.meta.env.VITE_SUPABASE_URL}'}/functions/v1/\${TOKEN_FUNCTION}\`, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: \`Bearer \${session.access_token}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId, role, clientInstanceId: CLIENT_INSTANCE_ID }),
        cache: 'no-store',
        signal: controller.signal
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || \`Could not authorize LIVE connection (\${response.status}).\`);
      if (!data?.token || !data?.url) throw new Error(data?.error || 'LIVE connection token is missing.');
      return data;
    } finally { clearTimeout(timer); }
  };

  try { return await requestToken(); }
  catch (firstError) {
    await logClientError('token-first-attempt', firstError, { sessionId, role });
    await new Promise(resolve => setTimeout(resolve, 350));
    return await requestToken();
  }`;

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
        const required = [statusBefore, ensureCameraBefore, startEntryBefore, cameraFailureBefore, startRpcBefore, startBefore, heartbeatBefore];
        if (required.some(target => !code.includes(target))) throw new Error("Droxion LIVE startup patch target was not found.");
        const patched = code
          .replace(statusBefore, statusAfter)
          .replace(ensureCameraBefore, ensureCameraAfter)
          .replace(startEntryBefore, startEntryAfter)
          .replace(cameraFailureBefore, cameraFailureAfter)
          .replace(startRpcBefore, startRpcAfter)
          .replace(startBefore, startAfter)
          .replace(heartbeatBefore, heartbeatAfter);
        return { code: patched, map: null };
      }

      if (normalizedId.endsWith("/src/livekit/livekitRoom.js")) {
        if (!code.includes(logClientErrorBefore) || !code.includes(tokenInvokeBefore) || !code.includes(connectBefore)) throw new Error("Droxion LiveKit startup timeout patch target was not found.");
        return {
          code: code
            .replace(logClientErrorBefore, logClientErrorAfter)
            .replace(tokenInvokeBefore, tokenInvokeAfter)
            .replace(connectBefore, connectAfter),
          map: null
        };
      }

      return null;
    }
  };
}

export default defineConfig({
  plugins: [liveStartReliabilityPatch(), react()],
  build: { outDir: "dist" },
});