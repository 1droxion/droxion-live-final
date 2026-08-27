const START_LIVE_TIMEOUT_MS = 10_000;
const ERROR_BODY_TIMEOUT_MS = 750;
const START_CONFIRM_INTERVAL_MS = 250;
const START_CONFIRM_CALL_TIMEOUT_MS = 900;
const START_HANDOFF_GRACE_MS = 1_800;

function createSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error('This device cannot create a secure LIVE session.');

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

function wait(ms) {
  return new Promise(resolve => globalThis.setTimeout(resolve, ms));
}

function startedLiveResult(sessionId, payload, status = null) {
  const statusOrientation = status?.orientation === 'horizontal' ? 'horizontal' : status?.orientation === 'vertical' ? 'vertical' : '';
  return {
    is_live: true,
    session_id: sessionId,
    title: status?.title || payload.p_title,
    tags: Array.isArray(status?.tags) ? status.tags : payload.p_tags,
    orientation: statusOrientation || payload.p_orientation,
    allow_guest_requests: typeof status?.allow_guest_requests === 'boolean'
      ? status.allow_guest_requests
      : payload.p_allow_guest_requests
  };
}

async function readFailureMessage(response) {
  try {
    const text = await Promise.race([
      response.text(),
      new Promise(resolve => globalThis.setTimeout(() => resolve(''), ERROR_BODY_TIMEOUT_MS))
    ]);
    if (!text) return '';
    try {
      const body = JSON.parse(text);
      return body?.message || body?.error || body?.hint || text;
    } catch {
      return text;
    }
  } catch {
    return '';
  }
}

async function confirmPersistedLive({
  client,
  sessionId,
  payload,
  deadlineAt,
  intervalMs,
  callTimeoutMs
}) {
  if (typeof client?.rpc !== 'function') return null;

  while (Date.now() < deadlineAt) {
    try {
      const result = await Promise.race([
        client.rpc('droxion_live_status'),
        new Promise(resolve => globalThis.setTimeout(() => resolve(null), callTimeoutMs))
      ]);
      const status = result?.data;
      if (status?.is_live && String(status?.session_id || '') === sessionId) {
        return startedLiveResult(sessionId, payload, status);
      }
    } catch {}

    if (Date.now() >= deadlineAt) break;
    await wait(intervalMs);
  }

  return null;
}

export async function startLiveSession({
  client,
  title,
  tags = [],
  orientation = 'vertical',
  allowGuestRequests = true,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  projectUrl = import.meta.env?.VITE_SUPABASE_URL,
  anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY,
  timeoutMs = START_LIVE_TIMEOUT_MS,
  confirmIntervalMs = START_CONFIRM_INTERVAL_MS,
  confirmCallTimeoutMs = START_CONFIRM_CALL_TIMEOUT_MS,
  handoffGraceMs = START_HANDOFF_GRACE_MS,
  sessionIdFactory = createSessionId
}) {
  if (!client || !fetchImpl || !projectUrl || !anonKey) throw new Error('LIVE service is not configured.');

  const { data: authData, error: authError } = await client.auth.getSession();
  const accessToken = authData?.session?.access_token;
  if (authError || !accessToken) throw new Error('Sign in before going live.');

  const sessionId = sessionIdFactory();
  const normalizedOrientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
  const normalizedTags = Array.isArray(tags) ? tags : [];
  const payload = {
    p_session_id: sessionId,
    p_title: title || 'Live on Droxion',
    p_tags: normalizedTags,
    p_orientation: normalizedOrientation,
    p_allow_guest_requests: allowGuestRequests !== false
  };
  const controller = new AbortController();
  const deadlineAt = Date.now() + Math.max(1, timeoutMs);
  let timeoutHandle = null;
  let completed = false;

  const requestPromise = (async () => {
    const response = await fetchImpl(`${projectUrl}/rest/v1/rpc/droxion_start_live_v2`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await readFailureMessage(response);
      throw new Error(message || `Could not start LIVE (${response.status}).`);
    }

    // Do not read the success body. Some iPhone/WebView clients complete the
    // database write but never finish the original response handoff.
    try { response.body?.cancel?.()?.catch?.(() => {}); } catch {}
    return startedLiveResult(sessionId, payload);
  })();

  const confirmationPromise = (async () => {
    const confirmed = await confirmPersistedLive({
      client,
      sessionId,
      payload,
      deadlineAt,
      intervalMs: Math.max(0, confirmIntervalMs),
      callTimeoutMs: Math.max(1, confirmCallTimeoutMs)
    });
    if (!confirmed) return new Promise(() => {});
    return confirmed;
  })();

  // A few browser/WebView stacks can deliver the authenticated write to
  // PostgREST while never resolving either JavaScript response promise. Do not
  // leave the creator trapped on "Starting LIVE" in that case. After a short
  // grace period, continue with the client-owned session ID. The LiveKit token
  // endpoint immediately verifies that this exact session exists, is fresh and
  // belongs to the signed-in host before any publishing permission is issued.
  const handoffPromise = (async () => {
    await wait(Math.max(1, handoffGraceMs));
    if (completed) return new Promise(() => {});
    return startedLiveResult(sessionId, payload);
  })();

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = globalThis.setTimeout(() => {
      controller.abort();
      reject(new Error('Starting LIVE timed out. Please try again.'));
    }, Math.max(1, timeoutMs));
  });

  try {
    const result = await Promise.race([requestPromise, confirmationPromise, handoffPromise, timeoutPromise]);
    completed = true;
    // Stop a response handoff that is still hanging after another authoritative
    // path (status confirmation or the guarded transport handoff) won the race.
    try { controller.abort(); } catch {}
    return result;
  } catch (error) {
    completed = true;
    if (error?.name === 'AbortError') throw new Error('Starting LIVE timed out. Please try again.');
    throw error;
  } finally {
    if (timeoutHandle) globalThis.clearTimeout(timeoutHandle);
  }
}
