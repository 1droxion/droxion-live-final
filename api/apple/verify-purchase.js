import { callRpc, getSupabaseConfig, getSupabaseHeaders, getSupabaseUser, readJsonBody } from '../paypal/lib.js';

const BUNDLE_ID = 'com.droxion.live';
const APPLE_PRODUCTION_VERIFY_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_VERIFY_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

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
    const transactionId = typeof body?.transactionId === 'string' ? body.transactionId.trim() : '';
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';

    if (!receipt || !transactionId || !productId) {
      res.status(400).json({ error: 'Apple receipt, transaction ID and product ID are required.' });
      return;
    }

    const product = await findCoinProductByAppleId(productId);
    if (!product || Number(product.coins_granted) <= 0) {
      res.status(400).json({ error: 'This Apple product is not an active Droxion coin package.' });
      return;
    }

    const { payload, environment } = await verifyAppleReceipt(receipt);
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

    const appAccountToken = String(transaction?.app_account_token || transaction?.appAccountToken || '').trim();
    if (appAccountToken && appAccountToken.toLowerCase() !== String(user.id).toLowerCase()) {
      res.status(403).json({ error: 'This Apple purchase belongs to a different Droxion account.' });
      return;
    }

    const purchaseDateMs = Number(transaction?.purchase_date_ms || 0);
    const purchaseDate = purchaseDateMs > 0 ? new Date(purchaseDateMs).toISOString() : null;

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
        purchase_date_ms: transaction?.purchase_date_ms || null,
        original_transaction_id: transaction?.original_transaction_id || null,
        app_account_token: appAccountToken || null
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
