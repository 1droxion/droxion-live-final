import {
  buildPayPalHeaders,
  callRpc,
  getPayPalAccessToken,
  getPayPalConfig,
  getSupabaseConfig,
  getSupabaseHeaders,
  getSupabaseUser,
  normalizeError,
  readJsonBody
} from '../../server/paypal-lib.js';

async function beginPayout(accessToken, paypalEmail, creatorCoins) {
  const { supabaseUrl } = getSupabaseConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/droxion_begin_payout_request_v3`, {
    method: 'POST',
    headers: {
      ...getSupabaseHeaders(accessToken, false),
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      p_method: 'paypal',
      p_creator_coins: creatorCoins,
      p_paypal_email: paypalEmail
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || 'Unable to create payout request.');
  return payload;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  let requestId = null;

  try {
    const authorization = req.headers.authorization || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    await getSupabaseUser(accessToken);

    const body = await readJsonBody(req);
    const paypalEmail = String(body?.paypalEmail || '').trim().toLowerCase();
    const creatorCoins = Math.floor(Number(body?.creatorCoins || 0));

    const payoutRequest = await beginPayout(accessToken, paypalEmail, creatorCoins);
    if (!payoutRequest?.allowed) {
      res.status(400).json(payoutRequest || { error: 'Payout request was not allowed.' });
      return;
    }

    requestId = payoutRequest.request_id;
    const amount = (Number(payoutRequest.amount_cents || 0) / 100).toFixed(2);
    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    const paypalAccessToken = await getPayPalAccessToken({ clientId, clientSecret, baseUrl });
    const senderBatchId = `droxion-${requestId}`;

    const paypalResponse = await fetch(`${baseUrl}/v1/payments/payouts`, {
      method: 'POST',
      headers: buildPayPalHeaders(paypalAccessToken, {
        'PayPal-Request-Id': senderBatchId
      }),
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: senderBatchId,
          email_subject: 'Your Droxion creator payout',
          email_message: 'Droxion sent your creator earnings payout.'
        },
        items: [{
          recipient_type: 'EMAIL',
          amount: { value: amount, currency: 'USD' },
          receiver: paypalEmail,
          note: 'Droxion creator earnings',
          sender_item_id: requestId
        }]
      })
    });

    const paypalPayload = await paypalResponse.json().catch(() => ({}));
    if (!paypalResponse.ok || !paypalPayload?.batch_header?.payout_batch_id) {
      await callRpc(null, 'droxion_finalize_payout', {
        p_request_id: requestId,
        p_success: false,
        p_provider_item_id: null,
        p_failure_reason: paypalPayload?.message || paypalPayload?.error_description || 'PayPal payout failed.'
      });
      res.status(400).json({ error: paypalPayload?.message || 'PayPal payout failed.' });
      return;
    }

    const batchId = paypalPayload.batch_header.payout_batch_id;
    await callRpc(null, 'droxion_mark_payout_processing', {
      p_request_id: requestId,
      p_provider_batch_id: batchId
    });

    const status = String(paypalPayload.batch_header.batch_status || '').toUpperCase();
    if (status === 'SUCCESS') {
      await callRpc(null, 'droxion_finalize_payout', {
        p_request_id: requestId,
        p_success: true,
        p_provider_item_id: batchId,
        p_failure_reason: null
      });
    }

    res.status(200).json({
      ok: true,
      requestId,
      payoutBatchId: batchId,
      status: status || 'PENDING',
      amount
    });
  } catch (error) {
    if (requestId) {
      try {
        await callRpc(null, 'droxion_finalize_payout', {
          p_request_id: requestId,
          p_success: false,
          p_provider_item_id: null,
          p_failure_reason: normalizeError(error)
        });
      } catch {}
    }
    res.status(400).json({ error: normalizeError(error) });
  }
}
