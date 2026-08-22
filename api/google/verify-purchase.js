import { createSign } from 'node:crypto';
import { callRpc, getSupabaseConfig, getSupabaseHeaders, getSupabaseUser, readJsonBody } from '../paypal/lib.js';

const PACKAGE_NAME = 'com.droxion.live';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
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

function base64Url(value) {
  return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function getGoogleServiceAccount() {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '';
  if (!raw) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured.');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch {
      throw new Error('Google Play service account JSON is invalid.');
    }
  }
  if (!parsed?.client_email || !parsed?.private_key) throw new Error('Google Play service account credentials are incomplete.');
  return parsed;
}

async function getGoogleAccessToken() {
  const serviceAccount = getGoogleServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || 'Could not authenticate with Google Play.');
  }
  return payload.access_token;
}

async function findCoinProductByGoogleId(googleProductId) {
  const { supabaseUrl } = getSupabaseConfig();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/droxion_products?select=id,product_type,name,coins_granted,active,google_product_id&active=eq.true&product_type=eq.coin_pack&google_product_id=eq.${encodeURIComponent(googleProductId)}`,
    { headers: getSupabaseHeaders(null, true) }
  );
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error('Unable to load the Droxion Google Play coin package.');
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function verifyGooglePurchase(productId, purchaseToken) {
  const accessToken = await getGoogleAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error_description || 'Google Play could not verify this purchase.';
    throw new Error(message);
  }
  return payload;
}

export default async function handler(req, res) {
  applyCors(req, res);
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
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const body = await readJsonBody(req);
    const productId = String(body?.productId || '').trim();
    const purchaseToken = String(body?.purchaseToken || '').trim();

    if (!productId || !purchaseToken) {
      res.status(400).json({ error: 'Google Play product ID and purchase token are required.' });
      return;
    }

    const product = await findCoinProductByGoogleId(productId);
    if (!product || Number(product.coins_granted) <= 0) {
      res.status(400).json({ error: 'This Google Play product is not an active Droxion coin package.' });
      return;
    }

    const purchase = await verifyGooglePurchase(productId, purchaseToken);
    const purchaseState = Number(purchase?.purchaseState ?? -1);
    if (purchaseState !== 0) {
      res.status(400).json({ error: 'Google Play purchase is not in purchased state.' });
      return;
    }

    const quantity = Math.max(1, Number(purchase?.quantity || 1));
    const coins = Number(product.coins_granted) * quantity;
    const purchaseTimeMs = Number(purchase?.purchaseTimeMillis || 0);
    const purchaseTime = purchaseTimeMs > 0 ? new Date(purchaseTimeMs).toISOString() : null;

    const result = await callRpc(null, 'droxion_fulfill_google_purchase', {
      p_user_id: user.id,
      p_purchase_token: purchaseToken,
      p_order_id: purchase?.orderId || null,
      p_product_id: productId,
      p_package_id: product.id,
      p_coins: coins,
      p_purchase_state: purchaseState,
      p_consumption_state: Number(purchase?.consumptionState ?? 0),
      p_acknowledgement_state: Number(purchase?.acknowledgementState ?? 0),
      p_purchase_time: purchaseTime,
      p_raw_payload: {
        orderId: purchase?.orderId || null,
        purchaseType: purchase?.purchaseType,
        quantity,
        regionCode: purchase?.regionCode || null,
        obfuscatedExternalAccountId: purchase?.obfuscatedExternalAccountId || null,
        obfuscatedExternalProfileId: purchase?.obfuscatedExternalProfileId || null
      }
    });

    res.status(200).json({
      ok: true,
      alreadyCompleted: Boolean(result?.already_completed),
      coinsGranted: Number(result?.coins || coins),
      coinBalance: Number(result?.coin_balance || 0),
      purchaseToken,
      productId,
      cashBacked: Boolean(result?.cash_backed)
    });
  } catch (error) {
    const message = error?.message || 'Google Play purchase verification failed.';
    console.error('Google Play purchase verification error:', message, error?.stack || '');
    res.status(/configured|credentials/i.test(message) ? 503 : 502).json({ error: message });
  }
}
