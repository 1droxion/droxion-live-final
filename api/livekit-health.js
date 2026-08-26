const HEALTH_URL = 'https://zlnhaqzawbzagraxhmlb.supabase.co/functions/v1/livekit-health';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  }

  const sessionId = String(req.query?.sessionId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return res.status(400).json({ ok: false, reason: 'invalid_session' });
  }

  try {
    const upstream = await fetch(`${HEALTH_URL}?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: { Accept: 'application/json' }
    });
    const text = await upstream.text();
    res.setHeader('Cache-Control', 'no-store');
    res.status(upstream.status);
    try { return res.json(JSON.parse(text)); }
    catch { return res.json({ ok: upstream.ok, raw: text.slice(0, 500) }); }
  } catch (error) {
    return res.status(502).json({ ok: false, reason: 'health_proxy_failed', message: error?.message || String(error) });
  }
}
