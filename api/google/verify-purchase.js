import { createSign } from 'node:crypto';
import { callRpc, getSupabaseConfig, getSupabaseHeaders, getSupabaseUser, readJsonBody } from '../paypal/lib.js';

const PACKAGE_NAME = 'com.droxion.live';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const ANDROID_PUBLISHER_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const ALLOWED_CLIENT_ORIGINS = new Set([
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
  'https://droxion.com',
  'https://www.droxion.com'
]);

function applyCors(req, res) {
  const origin = String(req.headers.origin || '').trim();
  if (origin && ALLOWED_CLIENT_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function getGoogleCredentials() {
  const email = String(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || '').trim();
  const privateKey = String(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (!email || !privateKey) throw new Error('Google Play service account credentials are not configured.');
  return { email, privateKey };
}

async function getGoogleAccessToken() {
  const { email, privateKey } = getGoogleCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: email,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) throw new Error(payload?.error_description || 'Google Play authentication failed.');
  return payload.access_token;
}

async function findCoinProductByGoogleId(productId) {
  const { supabaseUrl } = getSupabaseConfig();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/droxion_products?select=id,product_type,name,coins_granted,active,google_product_id&active=eq.true&product_type=eq.coin_pack&google_product_id=eq.${encodeURIComponent(productId)}`,
    { headers: getSupabaseHeaders(null, true) }
  );
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error('Unable to load the Droxion coin package.');
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function getGooglePurchase(accessToken, productId, purchaseToken) {
  const url = `${ANDROID_PUBLISHER_BASE}/${encodeURIComponent(PACKAGE_NAME)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || 'Google Play could not verify this purchase.');
  return payload;
}

async function consumeGooglePurchase(accessToken, productId, purchaseToken) {
  const url = `${ANDROID_PUBLISHER_BASE}/${encodeURIComponent(PACKAGE_NAME)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`;
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok && response.status !== 409) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message || 'Google Play purchase could not be consumed.');
  }
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const body = await readJsonBody(req);
    const purchaseToken = typeof body?.purchaseToken === 'string' ? body.purchaseToken.trim() : '';
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';

    if (!purchaseToken || !productId) return res.status(400).json({ error: 'Google Play purchase token and product ID are required.' });

    const product = await findCoinProductByGoogleId(productId);
    if (!product || Number(product.coins_granted) <= 0) return res.status(400).json({ error: 'This Google Play product is not an active Droxion coin package.' });

    const googleAccessToken = await getGoogleAccessToken();
    const purchase = await getGooglePurchase(googleAccessToken, productId, purchaseToken);

    // Android Publisher ProductPurchase: 0=purchased, 1=canceled, 2=pending.
    if (Number(purchase?.purchaseState) !== 0) {
      const state = Number(purchase?.purchaseState) === 2 ? 'pending' : 'not valid';
      return res.status(409).json({ error: `This Google Play purchase is ${state}.` });
    }

    const purchaseTimeMs = Number(purchase?.purchaseTimeMillis || 0);
    const result = await callRpc(null, 'droxion_fulfill_google_purchase', {
      p_user_id: user.id,
      p_purchase_token: purchaseToken,
      p_order_id: purchase?.orderId || null,
      p_product_id: productId,
      p_package_id: product.id,
      p_coins: Number(product.coins_granted),
      p_purchase_state: Number(purchase?.purchaseState ?? 0),
      p_consumption_state: Number(purchase?.consumptionState ?? 0),
      p_acknowledgement_state: Number(purchase?.acknowledgementState ?? 0),
      p_purchase_time: purchaseTimeMs > 0 ? new Date(purchaseTimeMs).toISOString() : null,
      p_raw_payload: {
        order_id: purchase?.orderId || null,
        product_id: productId,
        obfuscated_external_account_id: purchase?.obfuscatedExternalAccountId || null,
        purchase_type: purchase?.purchaseType ?? null,
        region_code: purchase?.regionCode || null
      }
    });

    try {
      await consumeGooglePurchase(googleAccessToken, productId, purchaseToken);
    } catch (consumeError) {
      console.error('Google Play consume retry needed:', consumeError?.message || consumeError);
    }

    return res.status(200).json({
      ok: true,
      alreadyCompleted: Boolean(result?.already_completed),
      coinsGranted: Number(result?.coins || product.coins_granted),
      coinBalance: Number(result?.coin_balance || 0),
      orderId: purchase?.orderId || null,
      productId
    });
  } catch (error) {
    const message = error?.message || 'Google Play purchase verification failed.';
    console.error('Google Play purchase verification error:', message, error?.stack || '');
    return res.status(502).json({ error: message });
  }
}
