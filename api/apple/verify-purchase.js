import { X509Certificate, verify as verifySignature } from 'node:crypto';
import { callRpc, getSupabaseConfig, getSupabaseHeaders, getSupabaseUser, readJsonBody } from '../paypal/lib.js';

const BUNDLE_ID = 'com.droxion.live';
const APPLE_PRODUCTION_VERIFY_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_VERIFY_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

// Apple publishes these trusted root SHA-256 fingerprints in its root store documentation.
const APPLE_ROOT_SHA256 = new Set([
  'C2B9B042DD57830E7D117DAC55AC8AE19407D38E41D88F3215BC3A890444A050', // Apple Root CA - G2
  '63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179', // Apple Root CA - G3
  'B0B1730ECBC7FF4505142C49F1295E6EDA6BCAED7E2C68C5BE91B5A11001F024' // Apple Root CA
]);

function base64UrlBuffer(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
  return Buffer.from(normalized + padding, 'base64');
}

function parseJsonPart(value, label) {
  try {
    return JSON.parse(base64UrlBuffer(value).toString('utf8'));
  } catch {
    throw new Error(`Apple ${label} is malformed.`);
  }
}

function normalizedFingerprint(cert) {
  return String(cert.fingerprint256 || '').replace(/:/g, '').toUpperCase();
}

function certIsCurrentlyValid(cert) {
  const now = Date.now();
  const start = Date.parse(cert.validFrom);
  const end = Date.parse(cert.validTo);
  return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
}

function verifyStoreKitJws(jws) {
  const parts = String(jws || '').split('.');
  if (parts.length !== 3) throw new Error('Apple signed transaction is malformed.');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonPart(encodedHeader, 'JWS header');
  if (header?.alg !== 'ES256' || !Array.isArray(header?.x5c) || header.x5c.length < 2) {
    throw new Error('Apple signed transaction certificate chain is invalid.');
  }

  const certs = header.x5c.map(value => new X509Certificate(Buffer.from(value, 'base64')));
  for (const cert of certs) {
    if (!certIsCurrentlyValid(cert)) throw new Error('Apple signed transaction certificate is expired or not yet valid.');
  }

  for (let index = 0; index < certs.length - 1; index += 1) {
    if (!certs[index].verify(certs[index + 1].publicKey)) {
      throw new Error('Apple signed transaction certificate chain could not be verified.');
    }
  }

  const root = certs[certs.length - 1];
  if (!APPLE_ROOT_SHA256.has(normalizedFingerprint(root))) {
    throw new Error('Apple signed transaction did not chain to a trusted Apple root.');
  }

  const signedData = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = base64UrlBuffer(encodedSignature);
  const validSignature = verifySignature(
    'sha256',
    signedData,
    { key: certs[0].publicKey, dsaEncoding: 'ieee-p1363' },
    signature
  );
  if (!validSignature) throw new Error('Apple signed transaction signature is invalid.');

  return parseJsonPart(encodedPayload, 'signed transaction payload');
}

async function verifyReceiptAt(url, receipt) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 'receipt-data': receipt, 'exclude-old-transactions': false })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Apple receipt verification request failed.');
  return payload;
}

async function verifyAppleReceipt(receipt) {
  let payload = await verifyReceiptAt(APPLE_PRODUCTION_VERIFY_URL, receipt);
  let environment = 'Production';

  if (Number(payload?.status) === 21007) {
    payload = await verifyReceiptAt(APPLE_SANDBOX_VERIFY_URL, receipt);
    environment = 'Sandbox';
  }

  if (Number(payload?.status) !== 0) {
    throw new Error(`Apple could not verify this purchase (status ${payload?.status ?? 'unknown'}).`);
  }

  return { payload, environment };
}

async function findCoinProductByAppleId(appleProductId) {
  const { supabaseUrl } = getSupabaseConfig();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/droxion_products?select=id,product_type,name,coins_granted,active,apple_product_id&active=eq.true&product_type=eq.coin_pack&apple_product_id=eq.${encodeURIComponent(appleProductId)}`,
    { headers: getSupabaseHeaders(null, true) }
  );
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error('Unable to load the Droxion coin package.');
  return Array.isArray(data) && data.length ? data[0] : null;
}

function receiptTransactions(payload) {
  const receiptItems = Array.isArray(payload?.receipt?.in_app) ? payload.receipt.in_app : [];
  const latestItems = Array.isArray(payload?.latest_receipt_info) ? payload.latest_receipt_info : [];
  return [...receiptItems, ...latestItems];
}

function normalizeSignedTransaction(payload) {
  return {
    transactionId: String(payload?.transactionId || ''),
    productId: String(payload?.productId || ''),
    bundleId: String(payload?.bundleId || ''),
    appAccountToken: String(payload?.appAccountToken || ''),
    environment: String(payload?.environment || 'Production'),
    purchaseDateMs: Number(payload?.purchaseDate || 0),
    originalTransactionId: String(payload?.originalTransactionId || ''),
    revoked: Boolean(payload?.revocationDate || payload?.revocationReason)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const body = await readJsonBody(req);

    const receipt = typeof body?.receipt === 'string' ? body.receipt.trim() : '';
    const jwsRepresentation = typeof body?.jwsRepresentation === 'string' ? body.jwsRepresentation.trim() : '';
    const transactionId = typeof body?.transactionId === 'string' ? body.transactionId.trim() : '';
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';

    if ((!receipt && !jwsRepresentation) || !transactionId || !productId) {
      res.status(400).json({ error: 'Apple signed transaction or receipt, transaction ID and product ID are required.' });
      return;
    }

    const product = await findCoinProductByAppleId(productId);
    if (!product || Number(product.coins_granted) <= 0) {
      res.status(400).json({ error: 'This Apple product is not an active Droxion coin package.' });
      return;
    }

    let environment = 'Production';
    let purchaseDate = null;
    let originalTransactionId = null;
    let appAccountToken = '';

    if (jwsRepresentation) {
      const signed = normalizeSignedTransaction(verifyStoreKitJws(jwsRepresentation));
      if (signed.bundleId !== BUNDLE_ID) {
        res.status(400).json({ error: 'Apple signed transaction bundle does not match Droxion Live.' });
        return;
      }
      if (signed.transactionId !== transactionId || signed.productId !== productId) {
        res.status(400).json({ error: 'Apple signed transaction does not match this purchase.' });
        return;
      }
      if (signed.revoked) {
        res.status(400).json({ error: 'This Apple purchase was revoked or refunded.' });
        return;
      }
      appAccountToken = signed.appAccountToken;
      environment = signed.environment || 'Production';
      originalTransactionId = signed.originalTransactionId || null;
      purchaseDate = signed.purchaseDateMs > 0 ? new Date(signed.purchaseDateMs).toISOString() : null;
    } else {
      const { payload, environment: receiptEnvironment } = await verifyAppleReceipt(receipt);
      environment = receiptEnvironment;
      if (payload?.receipt?.bundle_id !== BUNDLE_ID) {
        res.status(400).json({ error: 'Apple receipt bundle does not match Droxion Live.' });
        return;
      }

      const transaction = receiptTransactions(payload).find(item =>
        String(item?.transaction_id || '') === transactionId &&
        String(item?.product_id || '') === productId
      );

      if (!transaction) {
        res.status(400).json({ error: 'The verified Apple receipt does not contain this transaction.' });
        return;
      }
      if (transaction?.cancellation_date || transaction?.cancellation_date_ms) {
        res.status(400).json({ error: 'This Apple purchase was cancelled or refunded.' });
        return;
      }

      appAccountToken = String(transaction?.app_account_token || transaction?.appAccountToken || '').trim();
      originalTransactionId = transaction?.original_transaction_id || null;
      const purchaseDateMs = Number(transaction?.purchase_date_ms || 0);
      purchaseDate = purchaseDateMs > 0 ? new Date(purchaseDateMs).toISOString() : null;
    }

    if (appAccountToken && appAccountToken.toLowerCase() !== String(user.id).toLowerCase()) {
      res.status(403).json({ error: 'This Apple purchase belongs to a different Droxion account.' });
      return;
    }

    const result = await callRpc(null, 'droxion_fulfill_apple_purchase', {
      p_user_id: user.id,
      p_transaction_id: transactionId,
      p_product_id: productId,
      p_package_id: product.id,
      p_coins: Number(product.coins_granted),
      p_environment: environment,
      p_purchase_date: purchaseDate,
      p_raw_payload: {
        transaction_id: transactionId,
        product_id: productId,
        original_transaction_id: originalTransactionId,
        app_account_token: appAccountToken || null,
        verification: jwsRepresentation ? 'storekit2_jws' : 'legacy_receipt'
      }
    });

    res.status(200).json({
      ok: true,
      alreadyCompleted: Boolean(result?.already_completed),
      coinsGranted: Number(result?.coins || product.coins_granted),
      coinBalance: Number(result?.coin_balance || 0),
      transactionId,
      productId,
      environment
    });
  } catch (error) {
    res.status(502).json({ error: error?.message || 'Apple purchase verification failed.' });
  }
}
