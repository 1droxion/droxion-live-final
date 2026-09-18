import { exchangeYoutubeCode, fetchYoutubeChannel, upsertYoutubeConnection, verifyOAuthState } from '../../../server/creator-oauth-lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method not allowed.');
  }

  let returnPath = '/studio';
  try {
    if (req.query?.error) throw new Error(String(req.query.error_description || req.query.error));
    const state = verifyOAuthState(req.query?.state);
    returnPath = state.returnPath || '/studio';
    const code = String(req.query?.code || '');
    if (!code) throw new Error('Google did not return an authorization code.');
    const tokens = await exchangeYoutubeCode(req, code);
    const channel = await fetchYoutubeChannel(tokens.access_token);
    await upsertYoutubeConnection(state.userId, tokens, channel);
    return res.redirect(302, `${returnPath}?youtube=connected`);
  } catch (error) {
    const message = encodeURIComponent(error?.message || 'YouTube connection failed.');
    return res.redirect(302, `${returnPath}?youtube=error&message=${message}`);
  }
}
