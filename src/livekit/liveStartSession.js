const START_LIVE_TIMEOUT_MS = 10_000;
const ERROR_BODY_TIMEOUT_MS = 750;

function createSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error('This device cannot create a secure LIVE session.');

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
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
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
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

    // The v2 RPC persists the client-owned session ID before returning success.
    // Do not read the success body: that read is the exact WebView/Supabase stall
    // that previously left the setup sheet open after an HTTP 200 response.
    try { response.body?.cancel?.()?.catch?.(() => {}); } catch {}

    return {
      is_live: true,
      session_id: sessionId,
      title: payload.p_title,
      tags: normalizedTags,
      orientation: normalizedOrientation,
      allow_guest_requests: payload.p_allow_guest_requests
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Starting LIVE timed out. Please try again.');
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}
