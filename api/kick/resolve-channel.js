const REQUEST_TIMEOUT_MS = 8000;
let tokenCache = { token: '', expiresAt: 0 };

function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
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
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(text(data?.message || data?.error || data?.data, `HTTP ${response.status}`));
      error.status = response.status;
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = text(req.query?.slug).toLowerCase();
  if (!slug || slug.length > 25) {
    return res.status(400).json({ ok: false, error: 'Invalid Kick channel slug' });
  }

  try {
    const token = await getKickAppToken();
    if (!token) {
      return res.status(200).json({ ok: false, reason: 'missing_credentials', broadcasterUserId: 0 });
    }

    const url = new URL('https://api.kick.com/public/v1/channels');
    url.searchParams.append('slug', slug);
    const data = await fetchJson(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    const rows = Array.isArray(data?.data) ? data.data : [];
    const channel = rows.find(row => text(row?.slug).toLowerCase() === slug) || rows[0] || null;
    const broadcasterUserId = Number(channel?.broadcaster_user_id || 0);

    if (!Number.isInteger(broadcasterUserId) || broadcasterUserId <= 0) {
      return res.status(200).json({ ok: false, reason: 'channel_not_found', broadcasterUserId: 0 });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({
      ok: true,
      slug: text(channel?.slug, slug),
      broadcasterUserId,
    });
  } catch (error) {
    const message = text(error?.message, 'Kick channel lookup failed');
    console.error('[kick-chat] channel lookup failed', message);
    return res.status(502).json({ ok: false, reason: 'provider_error', error: message, broadcasterUserId: 0 });
  }
}
