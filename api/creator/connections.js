import { getCreatorConnections, getSupabaseUser } from '../../server/creator-oauth-lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    const auth = String(req.headers.authorization || '');
    const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const connections = await getCreatorConnections(user.id);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ connections });
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Could not load creator connections.' });
  }
}
