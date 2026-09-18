import { fetchLatestYoutubeVideos, getSupabaseUser, getValidYoutubeAccessToken, getYoutubeConnection } from '../../../server/creator-oauth-lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const auth = String(req.headers.authorization || '');
    const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const connection = await getYoutubeConnection(user.id);
    if (!connection) return res.status(404).json({ error: 'YouTube is not connected.' });

    const youtubeAccessToken = await getValidYoutubeAccessToken(connection);
    const videos = await fetchLatestYoutubeVideos(youtubeAccessToken, req.query?.limit || 12);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      channel: {
        display_name: connection.display_name,
        handle: connection.handle,
        avatar_url: connection.avatar_url
      },
      videos
    });
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Could not load YouTube videos.' });
  }
}
