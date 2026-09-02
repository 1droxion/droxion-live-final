import { callRpc, getSupabaseConfig, getSupabaseHeaders, getSupabaseUser, normalizeError, readJsonBody } from '../../server/paypal-lib.js';
import { trolleyRequest } from '../../server/trolley-lib.js';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function beginTrolleyPayPalPayout(accessToken, creatorCoins) {
  const { supabaseUrl } = getSupabaseConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/droxion_begin_trolley_paypal_payout`, {
    method: 'POST',
    headers: { ...getSupabaseHeaders(accessToken, false), Prefer: 'return=representation' },
    body: JSON.stringify({ p_creator_coins: creatorCoins })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || 'Unable to create PayPal payout request.');
  return payload;
}

async function failRequest(requestId, reason) {
  if (!requestId) return;
  try {
    await callRpc(null, 'droxion_finalize_payout', {
      p_request_id: requestId,
      p_success: false,
      p_provider_item_id: null,
      p_failure_reason: reason || 'Trolley PayPal payout failed.'
    });
  } catch {}
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  let requestId = null;

  try {
    const authorization = req.headers.authorization || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    await getSupabaseUser(accessToken);

    const body = await readJsonBody(req);
    const creatorCoins = Math.floor(Number(body?.creatorCoins || 0));

    const payoutRequest = await beginTrolleyPayPalPayout(accessToken, creatorCoins);
    if (!payoutRequest?.allowed) {
      res.status(400).json(payoutRequest || { error: 'PayPal payout is not available.' });
      return;
    }

    requestId = payoutRequest.request_id;
    const recipientId = String(payoutRequest.provider_recipient_id || '').trim();
    const amountUsd = (Number(payoutRequest.amount_cents || 0) / 100).toFixed(2);
    if (!recipientId) throw new Error('Complete secure PayPal payout setup first.');

    const batchPayload = await trolleyRequest('/v1/batches', {
      method: 'POST',
      body: {
        currency: 'USD',
        description: `Droxion PayPal creator payout ${requestId}`,
        tags: ['droxion', 'paypal', requestId]
      }
    });
    const batchId = batchPayload?.batch?.id;
    if (!batchId) throw new Error('Trolley did not create a payout batch.');

    const paymentPayload = await trolleyRequest(`/v1/batches/${encodeURIComponent(batchId)}/payments`, {
      method: 'POST',
      body: {
        recipient: { id: recipientId },
        amount: amountUsd,
        currency: 'USD',
        memo: 'Droxion creator earnings',
        tags: ['droxion', 'paypal', requestId]
      }
    });
    const paymentId = paymentPayload?.payment?.id;
    if (!paymentId) throw new Error('Trolley did not create a PayPal payment.');

    await callRpc(null, 'droxion_attach_trolley_payment', {
      p_request_id: requestId,
      p_provider_batch_id: batchId,
      p_provider_payment_id: paymentId
    });

    const processPayload = await trolleyRequest(`/v1/batches/${encodeURIComponent(batchId)}/start-processing`, { method: 'POST' });
    await callRpc(null, 'droxion_mark_payout_processing', {
      p_request_id: requestId,
      p_provider_batch_id: batchId
    });

    res.status(200).json({
      ok: true,
      requestId,
      payoutBatchId: batchId,
      paymentId,
      status: String(processPayload?.batch?.status || 'processing').toLowerCase(),
      amount: amountUsd,
      provider: 'trolley',
      method: 'paypal'
    });
  } catch (error) {
    await failRequest(requestId, error?.message);
    res.status(error?.status && Number.isInteger(error.status) ? error.status : 400).json({
      error: normalizeError(error)
    });
  }
}
