import { callRpc, extractBatchPayment, extractLocalQuote, getSupabaseUser, trolleyRequest } from '../../server/trolley-lib.js';

async function failReservedRequest(requestId, reason) {
  if (!requestId) return;
  try {
    await callRpc(null, 'droxion_finalize_payout', {
      p_request_id: requestId,
      p_success: false,
      p_provider_item_id: null,
      p_failure_reason: reason || 'Bank payout quote failed.'
    });
  } catch {}
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
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const creatorCoins = Math.floor(Number(body.creatorCoins || 0));
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) throw new Error('Server payout configuration is incomplete.');

    const begin = await fetch(`${supabaseUrl}/rest/v1/rpc/droxion_begin_payout_request_v3`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ p_method: 'bank', p_creator_coins: creatorCoins, p_paypal_email: null })
    });
    const payoutRequest = await begin.json().catch(() => ({}));
    if (!begin.ok) throw new Error(payoutRequest?.message || payoutRequest?.error || 'Unable to reserve payout balance.');
    if (!payoutRequest?.allowed) {
      res.status(400).json(payoutRequest || { error: 'Bank payout is not available.' });
      return;
    }

    requestId = payoutRequest.request_id;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
    if (!serviceKey) throw new Error('Server payout configuration is incomplete.');
    const requestLookup = await fetch(`${supabaseUrl}/rest/v1/droxion_payout_requests?select=id,user_id,provider_recipient_id,destination_currency,destination_country,amount_cents&id=eq.${encodeURIComponent(requestId)}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    const requestRows = await requestLookup.json().catch(() => []);
    if (!requestLookup.ok || !Array.isArray(requestRows) || !requestRows[0]?.provider_recipient_id) throw new Error('Verified bank payout destination was not found.');
    const row = requestRows[0];
    const amountUsd = (Number(row.amount_cents || 0) / 100).toFixed(2);

    const batchPayload = await trolleyRequest('/v1/batches', {
      method: 'POST',
      body: { currency: 'USD', description: `Droxion creator payout ${requestId}`, tags: ['droxion', requestId] }
    });
    const batchId = batchPayload?.batch?.id;
    if (!batchId) throw new Error('Payout provider did not create a payout batch.');

    const paymentPayload = await trolleyRequest(`/v1/batches/${encodeURIComponent(batchId)}/payments`, {
      method: 'POST',
      body: { recipient: { id: row.provider_recipient_id }, amount: amountUsd, currency: 'USD', tags: ['droxion', requestId] }
    });
    const paymentId = paymentPayload?.payment?.id;
    if (!paymentId) throw new Error('Payout provider did not create a payout payment.');

    const quotePayload = await trolleyRequest(`/v1/batches/${encodeURIComponent(batchId)}/generate-quote`, { method: 'POST' });
    const summaryPayload = await trolleyRequest(`/v1/batches/${encodeURIComponent(batchId)}/summary`, { method: 'GET' });
    const payment = extractBatchPayment(summaryPayload) || paymentPayload?.payment || null;
    const quote = extractLocalQuote(payment, row.destination_currency || '');
    const quoteExpiresAt = quotePayload?.batch?.quoteExpiredAt || summaryPayload?.batch?.quoteExpiredAt || null;
    if (!quote?.destinationCurrency) throw new Error('Payout provider did not return a destination currency quote.');

    await callRpc(null, 'droxion_mark_payout_quoted', {
      p_request_id: requestId,
      p_provider_batch_id: batchId,
      p_provider_payment_id: paymentId,
      p_destination_amount: Number.isFinite(quote.destinationAmount) ? quote.destinationAmount : null,
      p_destination_currency: quote.destinationCurrency,
      p_fx_rate: Number.isFinite(quote.fxRate) && quote.fxRate > 0 ? quote.fxRate : null,
      p_provider_fee: Number.isFinite(quote.providerFee) ? quote.providerFee : null,
      p_quote_expires_at: quoteExpiresAt
    });

    res.status(200).json({
      ok: true, requestId, sourceAmount: Number(amountUsd), sourceCurrency: 'USD',
      destinationAmount: Number.isFinite(quote.destinationAmount) ? quote.destinationAmount : null,
      destinationCurrency: quote.destinationCurrency,
      fxRate: Number.isFinite(quote.fxRate) && quote.fxRate > 0 ? quote.fxRate : null,
      providerFee: Number.isFinite(quote.providerFee) ? quote.providerFee : null,
      quoteExpiresAt
    });
  } catch (error) {
    await failReservedRequest(requestId, error?.message);
    const message = error?.message || 'Could not create bank payout quote.';
    res.status(/credentials|configured/i.test(message) ? 503 : 400).json({ error: message });
  }
}
