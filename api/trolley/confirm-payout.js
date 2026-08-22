import { callRpc, getSupabaseUser, trolleyRequest } from '../../server/trolley-lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const authorization = req.headers.authorization || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const requestId = String(req.body?.requestId || '').trim();
    if (!requestId) {
      res.status(400).json({ error: 'Payout request ID is required.' });
      return;
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!serviceKey || !supabaseUrl) throw new Error('Server payout configuration is incomplete.');

    const lookup = await fetch(`${supabaseUrl}/rest/v1/droxion_payout_requests?select=id,user_id,status,provider,provider_batch_id,provider_payment_id,quote_expires_at,destination_amount,destination_currency,provider_fee&id=eq.${encodeURIComponent(requestId)}&user_id=eq.${encodeURIComponent(user.id)}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    const rows = await lookup.json().catch(() => []);
    const payout = Array.isArray(rows) ? rows[0] : null;
    if (!lookup.ok || !payout) {
      res.status(404).json({ error: 'Payout request was not found.' });
      return;
    }
    if (payout.provider !== 'trolley' || payout.status !== 'quoted' || !payout.provider_batch_id) {
      res.status(400).json({ error: 'This payout is not ready to confirm.' });
      return;
    }
    if (payout.quote_expires_at && new Date(payout.quote_expires_at).getTime() <= Date.now()) {
      await callRpc(accessToken, 'droxion_cancel_quoted_payout', { p_request_id: requestId });
      res.status(400).json({ error: 'This exchange-rate quote expired. Please request a new quote.' });
      return;
    }

    const processPayload = await trolleyRequest(`/v1/batches/${encodeURIComponent(payout.provider_batch_id)}/start-processing`, { method: 'POST' });
    await callRpc(null, 'droxion_mark_payout_processing', { p_request_id: requestId, p_provider_batch_id: payout.provider_batch_id });

    res.status(200).json({
      ok: true,
      requestId,
      status: String(processPayload?.batch?.status || 'processing').toLowerCase(),
      destinationAmount: payout.destination_amount == null ? null : Number(payout.destination_amount),
      destinationCurrency: payout.destination_currency || null,
      providerFee: payout.provider_fee == null ? null : Number(payout.provider_fee)
    });
  } catch (error) {
    const message = error?.message || 'Could not start bank payout.';
    res.status(/credentials|configured/i.test(message) ? 503 : 400).json({ error: message });
  }
}
