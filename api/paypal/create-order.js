import { createPayPalOrder, createTransactionRecord, getPayPalConfig, getSupabaseConfig, getSupabaseHeaders, getSupabaseUser, normalizeError, readJsonBody } from './lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const body = await readJsonBody(req);
    const { packageId } = body || {};

    if (!packageId) {
      res.status(400).json({ error: 'A package selection is required.' });
      return;
    }

    const user = await getSupabaseUser(accessToken);
    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    const { supabaseUrl } = getSupabaseConfig();
    const packageProduct = await fetch(`${supabaseUrl}/rest/v1/droxion_products?select=id,product_type,name,price_cents,coins_granted,active&active=eq.true&product_type=eq.coin_pack&id=eq.${encodeURIComponent(packageId)}`, {
      headers: {
        ...getSupabaseHeaders(accessToken, true),
        Authorization: accessToken ? `Bearer ${accessToken}` : undefined
      }
    }).then((response) => response.json().catch(() => [])).then((data) => Array.isArray(data) && data.length ? data[0] : null);

    if (!packageProduct || Number(packageProduct.price_cents) <= 0 || Number(packageProduct.coins_granted) <= 0) {
      res.status(400).json({ error: 'The selected package is invalid.' });
      return;
    }

    const amount = (Number(packageProduct.price_cents) / 100).toFixed(2);
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: amount
        },
        custom_id: `${user.id}:${packageProduct.id}`,
        description: `Droxion coins package ${packageProduct.id}`
      }],
      application_context: {
        brand_name: 'Droxion',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'droxion.app'}/wallet`,
        cancel_url: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'droxion.app'}/wallet`
      }
    };

    const paypalOrder = await createPayPalOrder({ clientId, clientSecret, baseUrl, orderPayload });
    const paypalOrderId = paypalOrder?.id;

    if (!paypalOrderId) {
      res.status(502).json({ error: 'PayPal did not return an order id.' });
      return;
    }

    const transactionPayload = {
      user_id: user.id,
      package_id: packageProduct.id,
      paypal_order_id: paypalOrderId,
      payment_status: 'pending',
      amount: Number(amount),
      currency: 'USD',
      coins: Number(packageProduct.coins_granted),
      fulfilled: false,
      created_at: new Date().toISOString()
    };

    const transaction = await createTransactionRecord(accessToken, transactionPayload);
    const transactionId = transaction?.id;

    if (!transactionId) {
      res.status(502).json({ error: 'The PayPal order was created, but the purchase record could not be saved.' });
      return;
    }

    res.status(200).json({ orderId: paypalOrderId, transactionId });
  } catch (error) {
    res.status(502).json({ error: normalizeError(error) });
  }
}
