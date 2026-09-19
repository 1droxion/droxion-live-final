function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

async function fetchTangoCreators() {
  const apiKey = text(process.env.TANGO_AGENCY_KEY);
  if (!apiKey) {
    const error = new Error('Missing TANGO_AGENCY_KEY');
    error.code = 'missing_key';
    throw error;
  }

  const url = new URL('https://api.tangoagent.io/api/v1/agencies/creators');
  url.searchParams.set('page', '0');
  url.searchParams.set('size', '1000');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: apiKey,
        Accept: 'application/json'
      }
    });

    const raw = await response.text();
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch {}

    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || `Tango API returned ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const rows = Array.isArray(payload?.data) ? payload.data : [];
    return rows.map(row => ({
      id: text(row?.id),
      status: text(row?.status),
      displayName: text(row?.displayName),
      registeredAt: text(row?.registeredAt),
      avatarUrl: text(row?.avatarUrl)
    })).filter(row => row.id);
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const creators = await fetchTangoCreators();
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({
      ok: true,
      count: creators.length,
      creators
    });
  } catch (error) {
    const status = Number(error?.status) || (error?.code === 'missing_key' ? 503 : 502);
    return res.status(status).json({
      ok: false,
      error: text(error?.message, 'Could not load Tango creators')
    });
  }
}
