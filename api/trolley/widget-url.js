import { buildTrolleyWidgetUrl, getSupabaseUser } from '../../server/trolley-lib.js';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
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
    const authorization = req.headers.authorization || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    if (!user?.email) {
      res.status(400).json({ error: 'A verified account email is required for bank payout setup.' });
      return;
    }
    const widgetUrl = buildTrolleyWidgetUrl({ email: user.email, referenceId: user.id });
    res.status(200).json({ ok: true, widgetUrl });
  } catch (error) {
    const message = error?.message || 'Could not start secure bank payout setup.';
    res.status(/credentials|configured/i.test(message) ? 503 : 400).json({ error: message });
  }
}
