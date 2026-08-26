const BACKEND = 'https://zlnhaqzawbzagraxhmlb.supabase.co/functions/v1/reaction-factory-cloud';

function cleanKey(value) {
  return String(value || '').trim().slice(0, 200);
}

function cleanOp(value) {
  const op = String(value || '').trim();
  return op === 'status' || op === 'queue' ? op : '';
}

export default async function handler(req, res) {
  const op = cleanOp(req.query?.op);
  const key = cleanKey(req.query?.key);

  if (!op) {
    res.status(400).json({ error: 'Unsupported operation.' });
    return;
  }
  if (!key) {
    res.status(401).json({ error: 'Private dashboard key is missing.' });
    return;
  }
  if (op === 'status' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  if (op === 'queue' && req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const target = new URL(BACKEND);
    target.searchParams.set('op', op);
    target.searchParams.set('key', key);

    const init = { method: req.method, headers: {} };
    if (req.method === 'POST') {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body || {});
    }

    const upstream = await fetch(target.toString(), init);
    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = upstream.ok ? { ok: true } : { error: text || 'Cloud request failed.' };
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(upstream.status).json(payload);
  } catch (error) {
    res.status(502).json({ error: error?.message || 'Could not reach Reaction Factory cloud.' });
  }
}
