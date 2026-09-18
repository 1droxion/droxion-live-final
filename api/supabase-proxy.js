const SUPABASE_ORIGIN = 'https://zlnhaqzawbzagraxhmlb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_17-SDTCCb40s2jU1UWO3sw_3Si-jw3b';
const ALLOWED_PREFIXES = ['/auth/v1/', '/rest/v1/', '/storage/v1/', '/functions/v1/'];
const FORWARDED_HEADERS = [
  'authorization',
  'apikey',
  'content-type',
  'accept',
  'prefer',
  'range',
  'x-client-info'
];

function cleanPath(value) {
  const path = String(value || '').trim();
  if (!path.startsWith('/') || path.includes('..')) return '';
  if (!ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix))) return '';
  return path;
}

export default async function handler(req, res) {
  const path = cleanPath(req.query?.path);
  if (!path) {
    res.status(400).json({ error: 'Unsupported Supabase proxy path.' });
    return;
  }

  const method = String(req.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method)) {
    res.setHeader('Allow', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    res.status(204).end();
    return;
  }

  const target = new URL(path, SUPABASE_ORIGIN);
  const headers = {};

  for (const name of FORWARDED_HEADERS) {
    const value = req.headers?.[name];
    if (value != null && value !== '') headers[name] = value;
  }

  if (!headers.apikey) headers.apikey = SUPABASE_PUBLISHABLE_KEY;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const init = {
      method,
      headers,
      signal: controller.signal,
      cache: 'no-store'
    };

    if (!['GET', 'HEAD'].includes(method)) {
      if (Buffer.isBuffer(req.body)) {
        init.body = req.body;
      } else if (typeof req.body === 'string') {
        init.body = req.body;
      } else if (req.body != null) {
        init.body = JSON.stringify(req.body);
        if (!headers['content-type']) headers['content-type'] = 'application/json';
      }
    }

    const upstream = await fetch(target.toString(), init);
    const body = Buffer.from(await upstream.arrayBuffer());

    res.status(upstream.status);
    res.setHeader('Cache-Control', 'no-store, max-age=0');

    for (const name of ['content-type', 'content-range', 'range-unit', 'preference-applied']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    res.send(body);
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'Supabase request timed out.' : 'Supabase request failed.'
    });
  } finally {
    clearTimeout(timeout);
  }
}
