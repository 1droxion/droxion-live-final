import { supabase } from '../../../supabaseClient';

const START_TIMEOUT_MS = 10000;
const CONFIRM_INTERVAL_MS = 250;

function delay(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function makeUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeStatus(payload) {
  const value = payload && typeof payload === 'object' ? payload : {};
  return {
    isLive: Boolean(value.is_live ?? value.isLive),
    sessionId: String(value.session_id ?? value.sessionId ?? ''),
    title: String(value.title ?? ''),
    orientation: String(value.orientation ?? 'vertical'),
    raw: value
  };
}

function firstSuccessful(promises, timeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let failures = 0;
    let lastError = null;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(lastError || new Error(timeoutMessage));
    }, timeoutMs);

    promises.forEach(promise => {
      Promise.resolve(promise).then(value => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      }).catch(error => {
        failures += 1;
        lastError = error;
        if (!settled && failures === promises.length) {
          settled = true;
          window.clearTimeout(timer);
          reject(lastError || new Error(timeoutMessage));
        }
      });
    });
  });
}

async function confirmPersistedSession(sessionId) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const { data, error } = await supabase.rpc('droxion_live_status');
      if (error) throw error;
      const status = normalizeStatus(data);
      if (status.isLive && status.sessionId === sessionId) {
        return { sessionId, source: 'status-confirmation', status };
      }
    } catch (error) {
      lastError = error;
    }
    await delay(CONFIRM_INTERVAL_MS);
  }

  throw lastError || new Error('LIVE session was not confirmed by the server.');
}

export async function createLiveSession({
  title = 'Live on Droxion',
  tags = [],
  orientation = 'vertical',
  allowGuestRequests = false
} = {}) {
  const sessionId = makeUuid();
  const rpcStart = (async () => {
    const { data, error } = await supabase.rpc('droxion_start_live_v2', {
      p_session_id: sessionId,
      p_title: String(title || 'Live on Droxion').trim().slice(0, 120),
      p_tags: Array.isArray(tags) ? tags : [],
      p_orientation: orientation === 'horizontal' ? 'horizontal' : 'vertical',
      p_allow_guest_requests: Boolean(allowGuestRequests)
    });
    if (error) throw error;
    return { sessionId, source: 'start-rpc', status: normalizeStatus(data) };
  })();

  return firstSuccessful(
    [rpcStart, confirmPersistedSession(sessionId)],
    START_TIMEOUT_MS + 1000,
    'Droxion created no confirmed LIVE session.'
  );
}

export async function getMyLiveStatus() {
  const { data, error } = await supabase.rpc('droxion_live_status');
  if (error) throw error;
  return normalizeStatus(data);
}

export async function getLiveRoomStatus(sessionId) {
  const { data, error } = await supabase.rpc('droxion_live_room_status', { p_session_id: sessionId });
  if (error) throw error;
  return normalizeStatus(data);
}

export async function sendLiveHeartbeat() {
  const { data, error } = await supabase.rpc('droxion_live_heartbeat');
  if (error) throw error;
  return normalizeStatus(data);
}

export async function endLiveSession() {
  const { data, error } = await supabase.rpc('droxion_set_live', { p_live: false });
  if (error) throw error;
  return normalizeStatus(data);
}
