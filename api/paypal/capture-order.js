import { callRpc, capturePayPalOrder, findTransactionByOrderId, getPayPalConfig, getSupabaseUser, normalizeError, readJsonBody, updateTransactionRecord } from './lib.js';

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
    const { orderId } = body || {};

    if (!orderId) {
      res.status(400).json({ error: 'A PayPal order ID is required.' });
      return;
    }

    const user = await getSupabaseUser(accessToken);
    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    const existingTransaction = await findTransactionByOrderId(accessToken, orderId, user.id);

    if (!existingTransaction) {
      res.status(404).json({ error: 'Unable to find the pending purchase.' });
      return;
    }

    if (existingTransaction.fulfilled && existingTransaction.payment_status === 'COMPLETED') {
      res.status(200).json({ ok: true, alreadyCompleted: true, coins: existingTransaction.coins, transactionId: existingTransaction.id });
      return;
    }

    const captureResult = await capturePayPalOrder({ clientId, clientSecret, baseUrl, orderId });
    const status = captureResult?.status || '';
    const captureId = captureResult?.purchase_units?.[0]?.payments?.captures?.[0]?.id || '';
    const amount = captureResult?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || '';
    const currency = captureResult?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.currency_code || '';

    if (status !== 'COMPLETED') {
      await updateTransactionRecord(accessToken, existingTransaction.id, {
        payment_status: status || 'PENDING',
        paypal_capture_id: captureId,
        updated_at: new Date().toISOString()
      });
      res.status(400).json({ error: 'PayPal capture is not completed yet.' });
      return;
    }

    if (currency !== 'USD') {
      res.status(400).json({ error: 'Unexpected currency received from PayPal.' });
      return;
    }

    if (Number(amount) !== Number(existingTransaction.amount)) {
      res.status(400).json({ error: 'Captured amount does not match the selected package.' });
      return;
    }

    const updatedTransaction = await callRpc(accessToken, 'droxion_fulfill_paypal_purchase', {
      p_user_id: user.id,
      p_paypal_order_id: orderId,
      p_paypal_capture_id: captureId,
      p_package_id: existingTransaction.package_id,
      p_amount: Number(existingTransaction.amount),
      p_currency: currency,
      p_coins: Number(existingTransaction.coins),
      p_status: 'COMPLETED'
    });

    res.status(200).json({ ok: true, alreadyCompleted: false, coins: existingTransaction.coins, transactionId: updatedTransaction?.id || existingTransaction.id });
  } catch (error) {
    res.status(400).json({ error: normalizeError(error) });
  }
}
