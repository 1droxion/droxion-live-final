import { supabase } from '../../../supabaseClient';
import { startLiveSession } from '../../../livekit/liveStartSession';

function normalizeStatus(payload) {
  const value = payload && typeof payload === 'object' ? payload : {};
  return {
    isLive: Boolean(value.is_live ?? value.isLive ?? value.active),
    sessionId: String(value.session_id ?? value.sessionId ?? ''),
    hostId: String(value.host_id ?? value.hostId ?? ''),
    title: String(value.title ?? ''),
    orientation: String(value.orientation ?? 'vertical'),
    raw: value
  };
}

export async function createLiveSession({
  title = 'Live on Droxion',
  tags = [],
  orientation = 'vertical',
  allowGuestRequests = false
} = {}) {
  const started = await startLiveSession({
    client: supabase,
    title: String(title || 'Live on Droxion').trim().slice(0, 120),
    tags: Array.isArray(tags) ? tags : [],
    orientation: orientation === 'horizontal' ? 'horizontal' : 'vertical',
    allowGuestRequests: Boolean(allowGuestRequests)
  });

  const sessionId = String(started?.session_id || '');
  if (!sessionId) throw new Error('Droxion did not return a LIVE session ID.');

  return {
    sessionId,
    source: 'safari-safe-start',
    status: normalizeStatus(started)
  };
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
