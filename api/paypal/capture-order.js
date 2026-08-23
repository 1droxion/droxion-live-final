import {
  callRpc,
  capturePayPalOrder,
  findTransactionByOrderId,
  getPayPalConfig,
  getSupabaseUser,
  normalizeError,
  readJsonBody,
  updateTransactionRecord
} from '../../server/paypal-lib.js';

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
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';

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

    if (existingTransaction.fulfilled && String(existingTransaction.payment_status).toUpperCase() === 'COMPLETED') {
      res.status(200).json({
        ok: true,
        alreadyCompleted: true,
        coins: existingTransaction.coins,
        transactionId: existingTransaction.id
      });
      return;
    }

    const captureResult = await capturePayPalOrder({ clientId, clientSecret, baseUrl, orderId });
    const captureData = captureResult?.purchase_units?.[0]?.payments?.captures?.[0] || null;
    const status = String(captureData?.status || captureResult?.status || '').toUpperCase();
    const captureId = typeof captureData?.id === 'string' ? captureData.id.trim() : '';
    const amount = captureData?.amount?.value;
    const currency = String(captureData?.amount?.currency_code || '').toUpperCase();

    if (status !== 'COMPLETED') {
      await updateTransactionRecord(null, existingTransaction.id, {
        payment_status: status || 'PENDING'
      });
      res.status(409).json({ error: 'PayPal capture is not completed yet.' });
      return;
    }

    if (!captureId) {
      res.status(502).json({ error: 'PayPal completed the capture but did not return a capture ID.' });
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

    const updatedTransaction = await callRpc(null, 'droxion_fulfill_paypal_purchase', {
      p_user_id: user.id,
      p_paypal_order_id: orderId,
      p_paypal_capture_id: captureId,
      p_package_id: existingTransaction.package_id,
      p_amount: Number(existingTransaction.amount),
      p_currency: currency,
      p_coins: Number(existingTransaction.coins),
      p_status: 'COMPLETED'
    });

    const transactionId = updatedTransaction?.id || existingTransaction?.id || null;

    res.status(200).json({
      ok: true,
      alreadyCompleted: Boolean(updatedTransaction?.already_completed),
      coins: Number(existingTransaction.coins),
      transactionId,
      orderId,
      captureId
    });
  } catch (error) {
    res.status(502).json({ error: normalizeError(error) });
  }
}
