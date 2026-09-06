const REQUEST_TIMEOUT_MS = 8000;
let tokenCache = { token: '', expiresAt: 0 };

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function timeoutSignal(ms = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function fetchJson(url, init = {}) {
  const timeout = timeoutSignal();
  try {
    const response = await fetch(url, { ...init, signal: timeout.signal });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const message = text(data?.message || data?.error || data?.data, `HTTP ${response.status}`);
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } finally {
    timeout.done();
  }
}

async function getKickAppToken() {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 60000) return tokenCache.token;

  const clientId = text(process.env.KICK_CLIENT_ID);
  const clientSecret = text(process.env.KICK_CLIENT_SECRET);
  if (!clientId || !clientSecret) return '';

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const data = await fetchJson('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  });

  const token = text(data?.access_token);
  if (token) {
    tokenCache = {
      token,
      expiresAt: now + Math.max(60, Number(data?.expires_in || 3600)) * 1000,
    };
  }
  return token;
}

async function findExistingSubscription(token, broadcasterUserId) {
  const url = new URL('https://api.kick.com/public/v1/events/subscriptions');
  url.searchParams.set('broadcaster_user_id', String(broadcasterUserId));
  const data = await fetchJson(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const subscriptions = Array.isArray(data?.data) ? data.data : [];
  return subscriptions.find(item => item?.event === 'chat.message.sent' && Number(item?.version || 1) === 1) || null;
}

async function createSubscription(token, broadcasterUserId) {
  return fetchJson('https://api.kick.com/public/v1/events/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      broadcaster_user_id: broadcasterUserId,
      events: [{ name: 'chat.message.sent', version: 1 }],
      method: 'webhook',
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const broadcasterUserId = positiveInteger(req.body?.broadcasterUserId);
  if (!broadcasterUserId) return res.status(400).json({ ok: false, error: 'Invalid broadcaster user ID' });

  try {
    const token = await getKickAppToken();
    if (!token) return res.status(200).json({ ok: false, enabled: false, reason: 'missing_credentials' });

    const existing = await findExistingSubscription(token, broadcasterUserId);
    if (existing) {
      return res.status(200).json({
        ok: true,
        enabled: true,
        alreadySubscribed: true,
        subscriptionId: text(existing?.id),
      });
    }

    const created = await createSubscription(token, broadcasterUserId);
    const result = Array.isArray(created?.data) ? created.data[0] : null;
    if (result?.error) {
      return res.status(200).json({ ok: false, enabled: true, reason: text(result.error, 'subscription_failed') });
    }

    return res.status(200).json({
      ok: true,
      enabled: true,
      alreadySubscribed: false,
      subscriptionId: text(result?.subscription_id),
    });
  } catch (error) {
    const message = text(error?.message, 'Kick event subscription failed');
    console.error('[kick-chat] subscription failed', message);
    return res.status(502).json({ ok: false, enabled: true, reason: 'provider_error', error: message });
  }
}
