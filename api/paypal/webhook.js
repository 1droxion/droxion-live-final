import {
  callRpc,
  findTransactionByCaptureId,
  findTransactionByOrderId,
  getPayPalConfig,
  normalizeError,
  readJsonBody,
  updateTransactionRecord,
  verifyWebhookSignature
} from './lib.js';

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
    const supportedEvents = new Set([
      'PAYMENT.CAPTURE.COMPLETED',
      'PAYMENT.CAPTURE.DENIED',
      'PAYMENT.CAPTURE.REFUNDED'
    ]);

    if (!supportedEvents.has(eventType)) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const resource = event?.resource || {};
    const captureId = typeof resource?.id === 'string' ? resource.id.trim() : '';
    const orderId = typeof resource?.supplementary_data?.related_ids?.order_id === 'string'
      ? resource.supplementary_data.related_ids.order_id.trim()
      : '';
    const status = String(resource?.status || '').toUpperCase();

    if (!captureId || !orderId) {
      res.status(400).json({ error: 'Webhook resource is missing identifiers.' });
      return;
    }

    // A webhook can arrive before the normal capture endpoint has recorded the
    // capture ID, so fall back to the PayPal order ID to recover the pending row.
    let transaction = await findTransactionByCaptureId(null, captureId);
    if (!transaction) {
      transaction = await findTransactionByOrderId(null, orderId, null);
    }

    if (!transaction) {
      res.status(404).json({ error: 'No matching purchase record was found.' });
      return;
    }

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED' && status === 'COMPLETED') {
      const amount = resource?.amount?.value;
      const currency = String(resource?.amount?.currency_code || '').toUpperCase();

      if (currency !== String(transaction.currency || '').toUpperCase() || Number(amount) !== Number(transaction.amount)) {
        res.status(400).json({ error: 'Webhook amount or currency does not match the pending purchase.' });
        return;
      }

      const result = await callRpc(null, 'droxion_fulfill_paypal_purchase', {
        p_user_id: transaction.user_id,
        p_paypal_order_id: orderId,
        p_paypal_capture_id: captureId,
        p_package_id: transaction.package_id,
        p_amount: Number(transaction.amount),
        p_currency: currency,
        p_coins: Number(transaction.coins),
        p_status: 'COMPLETED'
      });

      res.status(200).json({ ok: true, capture: captureId, result });
      return;
    }

    await updateTransactionRecord(null, transaction.id, {
      payment_status: status || eventType,
      paypal_capture_id: transaction.paypal_capture_id || captureId
    });

    res.status(200).json({ ok: true, status });
  } catch (error) {
    res.status(400).json({ error: normalizeError(error) });
  }
}
