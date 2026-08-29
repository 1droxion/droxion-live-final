import {
  callRpc,
  findTransactionByCaptureId,
  findTransactionByOrderId,
  getPayPalConfig,
  normalizeError,
  readJsonBody,
  updateTransactionRecord,
  verifyWebhookSignature
} from '../../server/paypal-lib.js';

const PAYOUT_ITEM_EVENTS = new Set([
  'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',
  'PAYMENT.PAYOUTS-ITEM.FAILED',
  'PAYMENT.PAYOUTS-ITEM.BLOCKED',
  'PAYMENT.PAYOUTS-ITEM.CANCELED',
  'PAYMENT.PAYOUTS-ITEM.HELD',
  'PAYMENT.PAYOUTS-ITEM.UNCLAIMED',
  'PAYMENT.PAYOUTS-ITEM.RETURNED',
  'PAYMENT.PAYOUTS-ITEM.REFUNDED'
]);

const PURCHASE_EVENTS = new Set([
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.REFUNDED'
]);

function payoutFailureReason(eventType, resource) {
  const status = String(resource?.transaction_status || resource?.status || '').toUpperCase();
  return `PayPal creator payout ${status || eventType.replace('PAYMENT.PAYOUTS-ITEM.', '').toLowerCase()}.`;
}

async function handleCreatorPayoutEvent(eventType, resource, res) {
  const requestId = String(resource?.payout_item?.sender_item_id || '').trim();
  const payoutItemId = String(resource?.payout_item_id || resource?.id || '').trim();
  const payoutBatchId = String(resource?.payout_batch_id || '').trim();
  const transactionStatus = String(resource?.transaction_status || resource?.status || '').toUpperCase();

  // sender_item_id is set by Droxion to the payout request UUID when the payout is created.
  if (!requestId) {
    res.status(400).json({ error: 'Payout webhook is missing the Droxion request identifier.' });
    return;
  }

  if (eventType === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED') {
    await callRpc(null, 'droxion_finalize_payout', {
      p_request_id: requestId,
      p_success: true,
      p_provider_item_id: payoutItemId || transactionStatus || null,
      p_failure_reason: null
    });

    res.status(200).json({
      ok: true,
      kind: 'creator_payout',
      requestId,
      payoutItemId: payoutItemId || null,
      payoutBatchId: payoutBatchId || null,
      status: transactionStatus || 'SUCCESS'
    });
    return;
  }

  if (eventType === 'PAYMENT.PAYOUTS-ITEM.RETURNED' || eventType === 'PAYMENT.PAYOUTS-ITEM.REFUNDED') {
    const reason = payoutFailureReason(eventType, resource);

    // A return/refund can arrive after a payout was already marked completed.
    // Reverse a completed payout first; if it was not completed yet, finalize it as failed.
    await callRpc(null, 'droxion_reverse_completed_payout', {
      p_request_id: requestId,
      p_failure_reason: reason
    });
    await callRpc(null, 'droxion_finalize_payout', {
      p_request_id: requestId,
      p_success: false,
      p_provider_item_id: payoutItemId || null,
      p_failure_reason: reason
    });

    res.status(200).json({
      ok: true,
      kind: 'creator_payout',
      requestId,
      payoutItemId: payoutItemId || null,
      payoutBatchId: payoutBatchId || null,
      status: transactionStatus || eventType.replace('PAYMENT.PAYOUTS-ITEM.', '')
    });
    return;
  }

  if (
    eventType === 'PAYMENT.PAYOUTS-ITEM.FAILED' ||
    eventType === 'PAYMENT.PAYOUTS-ITEM.BLOCKED' ||
    eventType === 'PAYMENT.PAYOUTS-ITEM.CANCELED'
  ) {
    await callRpc(null, 'droxion_finalize_payout', {
      p_request_id: requestId,
      p_success: false,
      p_provider_item_id: payoutItemId || null,
      p_failure_reason: payoutFailureReason(eventType, resource)
    });

    res.status(200).json({
      ok: true,
      kind: 'creator_payout',
      requestId,
      payoutItemId: payoutItemId || null,
      payoutBatchId: payoutBatchId || null,
      status: transactionStatus || eventType.replace('PAYMENT.PAYOUTS-ITEM.', '')
    });
    return;
  }

  // HELD and UNCLAIMED are not failures. Keep the creator's funds in pending payout
  // until PayPal later sends SUCCEEDED, FAILED, RETURNED, REFUNDED, BLOCKED, or CANCELED.
  if (payoutBatchId) {
    await callRpc(null, 'droxion_mark_payout_processing', {
      p_request_id: requestId,
      p_provider_batch_id: payoutBatchId
    });
  }

  res.status(200).json({
    ok: true,
    kind: 'creator_payout',
    requestId,
    payoutItemId: payoutItemId || null,
    payoutBatchId: payoutBatchId || null,
    status: transactionStatus || eventType.replace('PAYMENT.PAYOUTS-ITEM.', '')
  });
}

async function handlePurchaseEvent(eventType, resource, res) {
  const captureId = typeof resource?.id === 'string' ? resource.id.trim() : '';
  const orderId = typeof resource?.supplementary_data?.related_ids?.order_id === 'string'
    ? resource.supplementary_data.related_ids.order_id.trim()
    : '';
  const status = String(resource?.status || '').toUpperCase();

  if (!captureId || !orderId) {
    res.status(400).json({ error: 'Webhook resource is missing identifiers.' });
    return;
  }

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

    res.status(200).json({ ok: true, kind: 'purchase', capture: captureId, result });
    return;
  }

  await updateTransactionRecord(null, transaction.id, {
    payment_status: status || eventType,
    paypal_capture_id: transaction.paypal_capture_id || captureId
  });

  res.status(200).json({ ok: true, kind: 'purchase', status });
}

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

    const eventType = String(event?.event_type || '');
    const resource = event?.resource || {};

    if (PAYOUT_ITEM_EVENTS.has(eventType)) {
      await handleCreatorPayoutEvent(eventType, resource, res);
      return;
    }

    if (PURCHASE_EVENTS.has(eventType)) {
      await handlePurchaseEvent(eventType, resource, res);
      return;
    }

    res.status(200).json({ ok: true, ignored: true, eventType });
  } catch (error) {
    res.status(400).json({ error: normalizeError(error) });
  }
}
