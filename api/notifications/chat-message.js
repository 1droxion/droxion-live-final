import {
  getSupabaseConfig,
  getSupabaseHeaders,
  getSupabaseUser,
  readJsonBody
} from '../../server/paypal-lib.js';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');
}

function cleanText(value, fallback = '', max = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return (text || fallback).slice(0, max);
}

async function getMessageForSender(userId, messageId) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = getSupabaseHeaders(null, true);
  const url = `${supabaseUrl}/rest/v1/droxion_direct_messages?select=id,sender_id,recipient_id,body,created_at,read_at&id=eq.${encodeURIComponent(messageId)}&sender_id=eq.${encodeURIComponent(userId)}&limit=1`;
  const response = await fetch(url, { headers });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error(rows?.message || 'Unable to verify message.');
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getSenderProfile(userId) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = getSupabaseHeaders(null, true);
  const url = `${supabaseUrl}/rest/v1/droxion_profiles?select=display_name,username,avatar_url&user_id=eq.${encodeURIComponent(userId)}&limit=1`;
  const response = await fetch(url, { headers });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return null;
  return Array.isArray(rows) ? rows[0] || null : null;
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const authHeader = String(req.headers.authorization || '');
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const body = await readJsonBody(req);
    const messageId = String(body?.messageId || '').trim();
    if (!messageId) throw new Error('Message ID is required.');

    // Never trust recipient/body data sent by the client. The server reads the
    // authoritative row and requires the authenticated caller to be its sender.
    const message = await getMessageForSender(user.id, messageId);
    if (!message) throw new Error('Message was not found for this sender.');

    // A delayed/replayed request should not notify for a conversation that was
    // already read. OneSignal also receives the message UUID as idempotency key.
    if (message.read_at) {
      res.status(200).json({ ok: true, skipped: 'already_read' });
      return;
    }

    const createdAt = Date.parse(message.created_at || '');
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 10 * 60 * 1000) {
      res.status(200).json({ ok: true, skipped: 'stale_message' });
      return;
    }

    const appId = String(process.env.ONESIGNAL_APP_ID || '').trim();
    const apiKey = String(process.env.ONESIGNAL_APP_API_KEY || '').trim();
    if (!appId || !apiKey) throw new Error('OneSignal server configuration is missing.');

    const profile = await getSenderProfile(user.id);
    const senderName = cleanText(profile?.display_name || profile?.username, 'Droxion member', 60);
    const preview = cleanText(message.body, 'Sent you a message', 140);

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: 'push',
        include_aliases: {
          external_id: [String(message.recipient_id)]
        },
        headings: { en: senderName },
        contents: { en: preview },
        name: `Droxion message ${message.id}`,
        idempotency_key: String(message.id),
        custom_data: {
          type: 'chat_message',
          message_id: String(message.id),
          sender_id: String(message.sender_id),
          sender_name: senderName
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.errors?.[0] || payload?.errors || payload?.message || 'OneSignal message push failed.');
    }

    res.status(200).json({
      ok: true,
      messageId: payload?.id || null,
      recipients: Number(payload?.recipients || 0)
    });
  } catch (error) {
    res.status(400).json({ error: error?.message || 'Could not send message notification.' });
  }
}
