import {
  createPayPalOrder,
  createTransactionRecord,
  getPayPalConfig,
  getProductById,
  getSupabaseUser,
  normalizeError,
  readJsonBody
} from './lib.js';

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

    if (packageId === undefined || packageId === null || String(packageId).trim() === '') {
      res.status(400).json({ error: 'A package selection is required.' });
      return;
    }

    const user = await getSupabaseUser(accessToken);
    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    const packageProduct = await getProductById(packageId);

    if (!packageProduct || Number(packageProduct.price_cents) <= 0 || Number(packageProduct.coins_granted) <= 0) {
      res.status(400).json({ error: 'The selected package is invalid.' });
      return;
    }

    const environment = /sandbox/i.test(String(baseUrl || '')) ? 'sandbox' : 'production';
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
        user_action: 'PAY_NOW'
      }
    };

    const paypalOrder = await createPayPalOrder({ clientId, clientSecret, baseUrl, orderPayload });
    const paypalOrderId = typeof paypalOrder?.id === 'string' ? paypalOrder.id.trim() : '';

    if (!paypalOrderId) {
      res.status(502).json({ error: 'PayPal did not return an order ID.' });
      return;
    }

    const transactionPayload = {
      user_id: user.id,
      package_id: String(packageProduct.id),
      paypal_order_id: paypalOrderId,
      payment_status: 'PENDING',
      amount: Number(amount),
      currency: 'USD',
      coins: Number(packageProduct.coins_granted),
      fulfilled: false,
      environment,
      created_at: new Date().toISOString()
    };

    const transaction = await createTransactionRecord(accessToken, transactionPayload);
    const transactionId = typeof transaction?.id === 'string' ? transaction.id : '';

    if (!transactionId) {
      res.status(502).json({ error: 'The PayPal order was created, but the purchase record could not be saved.' });
      return;
    }

    res.status(200).json({ orderId: paypalOrderId, transactionId });
  } catch (error) {
    res.status(502).json({ error: normalizeError(error) });
  }
}
