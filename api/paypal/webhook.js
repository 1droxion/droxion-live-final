import { callRpc, findTransactionByCaptureId, getPayPalConfig, normalizeError, readJsonBody, verifyWebhookSignature } from './lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const headers = req.headers;
    const event = await readJsonBody(req);
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || '';

    if (!webhookId) {
      res.status(503).json({ error: 'PAYPAL_WEBHOOK_ID is not configured yet.' });
      return;
    }

    if (!event || !headers['paypal-transmission-id'] || !headers['paypal-auth-algo']) {
      res.status(400).json({ error: 'Invalid webhook payload.' });
      return;
    }

    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    const verified = await verifyWebhookSignature({ baseUrl, clientId, clientSecret, event, headers });

    if (!verified) {
      res.status(401).json({ error: 'Webhook signature could not be verified.' });
      return;
    }

    const eventType = event?.event_type;
    if (eventType !== 'PAYMENT.CAPTURE.COMPLETED' && eventType !== 'PAYMENT.CAPTURE.DENIED' && eventType !== 'PAYMENT.CAPTURE.REFUNDED') {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const resource = event?.resource || {};
    const captureId = resource?.id || '';
    const orderId = resource?.supplementary_data?.related_ids?.order_id || '';
    const status = resource?.status || '';

    if (!captureId || !orderId) {
      res.status(400).json({ error: 'Webhook resource is missing identifiers.' });
      return;
    }

    const transaction = await findTransactionByCaptureId(null, captureId);
    if (!transaction) {
      res.status(404).json({ error: 'No matching purchase record was found.' });
      return;
    }

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED' && status === 'COMPLETED') {
      const result = await callRpc('', 'droxion_fulfill_paypal_purchase', {
        p_user_id: transaction.user_id,
        p_paypal_order_id: orderId,
        p_paypal_capture_id: captureId,
        p_package_id: transaction.package_id,
        p_amount: Number(transaction.amount),
        p_currency: transaction.currency,
        p_coins: Number(transaction.coins),
        p_status: 'COMPLETED'
      });
      res.status(200).json({ ok: true, capture: captureId, result });
      return;
    }

    res.status(200).json({ ok: true, status });
  } catch (error) {
    res.status(400).json({ error: normalizeError(error) });
  }
}
