import crypto from 'crypto';
import { getSupabaseConfig, getSupabaseHeaders, getSupabaseUser } from './paypal-lib.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true';

function env(name, fallback = '') {
  return String(process.env[name] || fallback || '').trim();
}

export function getCreatorOAuthConfig() {
  const googleClientId = env('GOOGLE_CLIENT_ID');
  const googleClientSecret = env('GOOGLE_CLIENT_SECRET');
  const stateSecret = env('CREATOR_OAUTH_STATE_SECRET');
  const encryptionKey = env('CREATOR_OAUTH_ENCRYPTION_KEY');
  const appUrl = env('CREATOR_APP_URL', env('VERCEL_PROJECT_PRODUCTION_URL') ? `https://${env('VERCEL_PROJECT_PRODUCTION_URL')}` : 'https://www.droxion.com');

  return { googleClientId, googleClientSecret, stateSecret, encryptionKey, appUrl: appUrl.replace(/\/$/, '') };
}

function requireConfig() {
  const config = getCreatorOAuthConfig();
  const missing = [];
  if (!config.googleClientId) missing.push('GOOGLE_CLIENT_ID');
  if (!config.googleClientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!config.stateSecret) missing.push('CREATOR_OAUTH_STATE_SECRET');
  if (!config.encryptionKey) missing.push('CREATOR_OAUTH_ENCRYPTION_KEY');
  if (missing.length) throw new Error(`Creator OAuth server configuration is incomplete: ${missing.join(', ')}`);
  return config;
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function unbase64url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function signOAuthState(payload) {
  const { stateSecret } = requireConfig();
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', stateSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyOAuthState(state) {
  const { stateSecret } = requireConfig();
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) throw new Error('Invalid OAuth state.');
  const expected = crypto.createHmac('sha256', stateSecret).update(body).digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) throw new Error('Invalid OAuth state.');
  const payload = JSON.parse(unbase64url(body));
  if (!payload?.userId || !payload?.issuedAt || Date.now() - Number(payload.issuedAt) > 10 * 60 * 1000) {
    throw new Error('OAuth state expired.');
  }
  return payload;
}

function keyBytes(raw) {
  const value = String(raw || '').trim();
  if (/^[A-Fa-f0-9]{64}$/.test(value)) return Buffer.from(value, 'hex');
  if (/^[A-Za-z0-9+/]{43}=$/.test(value) || /^[A-Za-z0-9+/]{44}$/.test(value)) {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length === 32) return decoded;
  }
  return crypto.createHash('sha256').update(value).digest();
}

export function encryptSecret(value) {
  if (!value) return null;
  const { encryptionKey } = requireConfig();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(encryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function youtubeRedirectUri(req) {
  const configured = env('GOOGLE_YOUTUBE_REDIRECT_URI');
  if (configured) return configured;
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${proto}://${host}/api/creator/youtube/callback`;
}

export function youtubeAuthUrl({ req, userId, returnPath = '/studio' }) {
  const { googleClientId } = requireConfig();
  const state = signOAuthState({
    userId,
    returnPath: String(returnPath || '/studio').startsWith('/') ? returnPath : '/studio',
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  });
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', googleClientId);
  url.searchParams.set('redirect_uri', youtubeRedirectUri(req));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('scope', [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.upload'
  ].join(' '));
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeYoutubeCode(req, code) {
  const { googleClientId, googleClientSecret } = requireConfig();
  const body = new URLSearchParams({
    code,
    client_id: googleClientId,
    client_secret: googleClientSecret,
    redirect_uri: youtubeRedirectUri(req),
    grant_type: 'authorization_code'
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google token exchange failed.');
  }
  return payload;
}

export async function fetchYoutubeChannel(accessToken) {
  const response = await fetch(YOUTUBE_CHANNELS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => ({}));
  const channel = payload?.items?.[0];
  if (!response.ok || !channel?.id) {
    throw new Error(payload?.error?.message || 'No YouTube channel was found for this Google account.');
  }
  return channel;
}

export async function upsertYoutubeConnection(userId, tokenPayload, channel) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = {
    ...getSupabaseHeaders(null, true),
    Prefer: 'resolution=merge-duplicates,return=representation'
  };
  const snippet = channel?.snippet || {};
  const thumbnails = snippet?.thumbnails || {};
  const expiresAt = tokenPayload.expires_in
    ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
    : null;
  const row = {
    user_id: userId,
    provider: 'youtube',
    provider_account_id: String(channel.id),
    display_name: snippet.title || 'YouTube channel',
    handle: snippet.customUrl || null,
    avatar_url: thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || null,
    access_token_ciphertext: encryptSecret(tokenPayload.access_token),
    refresh_token_ciphertext: encryptSecret(tokenPayload.refresh_token),
    token_expires_at: expiresAt,
    scopes: String(tokenPayload.scope || '').split(/\s+/).filter(Boolean),
    metadata: {
      subscriber_count: channel?.statistics?.subscriberCount || null,
      video_count: channel?.statistics?.videoCount || null
    },
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    revoked_at: null
  };

  const response = await fetch(
    `${supabaseUrl}/rest/v1/creator_channel_connections?on_conflict=user_id,provider&select=user_id,provider,provider_account_id,display_name,handle,avatar_url,connected_at,metadata`,
    { method: 'POST', headers, body: JSON.stringify(row) }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || 'Could not save the YouTube connection.');
  return Array.isArray(payload) ? payload[0] : payload;
}

export async function getCreatorConnections(userId) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = getSupabaseHeaders(null, true);
  const response = await fetch(
    `${supabaseUrl}/rest/v1/creator_channel_connections?select=provider,provider_account_id,display_name,handle,avatar_url,connected_at,metadata,revoked_at&user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null`,
    { headers }
  );
  const payload = await response.json().catch(() => []);
  if (!response.ok) throw new Error(payload?.message || 'Could not load channel connections.');
  return Array.isArray(payload) ? payload : [];
}

export { getSupabaseUser };
