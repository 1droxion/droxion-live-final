import { getSupabaseUser, youtubeAuthUrl } from '../../../server/creator-oauth-lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    const auth = String(req.headers.authorization || '');
    const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const url = youtubeAuthUrl({ req, userId: user.id, returnPath: req.body?.returnPath || '/studio' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ url });
  } catch (error) {
    return res.status(/configuration/i.test(error?.message || '') ? 503 : 400).json({ error: error?.message || 'Could not start YouTube connection.' });
  }
}
