import {
  getSupabaseConfig,
  getSupabaseHeaders,
  getSupabaseUser,
  readJsonBody
} from '../../server/paypal-lib.js';

function cleanText(value, fallback, max = 120) {
  const text = String(value || '').trim();
  return (text || fallback).slice(0, max);
}

async function getLiveSession(userId, sessionId) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = getSupabaseHeaders(null, true);
  const url = `${supabaseUrl}/rest/v1/droxion_live_presence?select=user_id,session_id,is_live,title&user_id=eq.${encodeURIComponent(userId)}&session_id=eq.${encodeURIComponent(sessionId)}&is_live=eq.true&limit=1`;
  const response = await fetch(url, { headers });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error(rows?.message || 'Unable to verify LIVE session.');
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getCreatorName(userId) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = getSupabaseHeaders(null, true);
  const url = `${supabaseUrl}/rest/v1/droxion_profiles?select=display_name,username&user_id=eq.${encodeURIComponent(userId)}&limit=1`;
  const response = await fetch(url, { headers });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return 'A creator';
  const profile = Array.isArray(rows) ? rows[0] : null;
  return cleanText(profile?.display_name || profile?.username, 'A creator', 60);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const authHeader = String(req.headers.authorization || '');
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const body = await readJsonBody(req);
    const sessionId = String(body?.sessionId || '').trim();
    if (!sessionId) throw new Error('LIVE session ID is required.');

    const live = await getLiveSession(user.id, sessionId);
    if (!live) throw new Error('This LIVE session is not active.');

    const appId = String(process.env.ONESIGNAL_APP_ID || '').trim();
    const apiKey = String(process.env.ONESIGNAL_APP_API_KEY || '').trim();
    if (!appId || !apiKey) throw new Error('OneSignal server configuration is missing.');

    const creatorName = await getCreatorName(user.id);
    const liveTitle = cleanText(live.title, 'Live on Droxion', 100);

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: 'push',
        included_segments: ['Subscribed Users'],
        headings: { en: `${creatorName} is LIVE` },
        contents: { en: liveTitle },
        name: `Droxion LIVE ${sessionId}`,
        idempotency_key: sessionId,
        custom_data: {
          type: 'creator_live',
          creator_id: user.id,
          session_id: sessionId
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.errors?.[0] || payload?.errors || payload?.message || 'OneSignal push failed.');
    }

    res.status(200).json({ ok: true, messageId: payload?.id || null });
  } catch (error) {
    res.status(400).json({ error: error?.message || 'Could not send LIVE notification.' });
  }
}
