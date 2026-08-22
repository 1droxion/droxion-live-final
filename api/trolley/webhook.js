import crypto from 'node:crypto';
import { callRpc, getSupabaseConfig, getSupabaseHeaders } from './lib.js';

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function verifyWebhook(rawBody, signatureHeader) {
  const hmacKey = process.env.TROLLEY_WEBHOOK_HMAC_KEY || '';
  if (!hmacKey) throw new Error('Trolley webhook HMAC key is not configured.');
  const values = Object.fromEntries(String(signatureHeader || '').split(',').map(part => {
    const [key, ...rest] = part.trim().split('=');
    return [key, rest.join('=')];
  }));
  const timestamp = values.t || '';
  const signature = values.v1 || '';
  if (!timestamp || !signature) return false;
  const expected = crypto.createHmac('sha256', hmacKey).update(`${timestamp}${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function findRequestByPaymentId(paymentId) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = getSupabaseHeaders(null, true);
  const response = await fetch(`${supabaseUrl}/rest/v1/droxion_payout_requests?select=id,status&provider=eq.trolley&provider_payment_id=eq.${encodeURIComponent(paymentId)}&limit=1`, { headers });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error('Unable to find payout request for provider payment.');
  return Array.isArray(rows) ? rows[0] : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    const signatureHeader = req.headers['x-paymentrails-signature'];
    if (!verifyWebhook(rawBody, signatureHeader)) {
      res.status(401).json({ error: 'Invalid webhook signature.' });
      return;
    }

    const deliveryId = String(req.headers['x-paymentrails-delivery'] || '').trim();
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const model = String(payload?.model || '').toLowerCase();
    const action = String(payload?.action || '').toLowerCase();

    if (deliveryId) {
      const inserted = await callRpc(null, 'droxion_record_trolley_webhook_delivery', {
        p_delivery_id: deliveryId,
        p_model: model || null,
        p_action: action || null
      });
      if (inserted === false) {
        res.status(200).json({ ok: true, duplicate: true });
        return;
      }
    }

    if (model === 'recipient') {
      res.status(200).json({ ok: true });
      return;
    }

    const payment = payload?.body?.payment || payload?.payment || null;
    const paymentId = String(payment?.id || '').trim();
    if (!paymentId) {
      // Trolley validates subscriptions with an empty JSON body.
      res.status(200).json({ ok: true });
      return;
    }

    const request = await findRequestByPaymentId(paymentId);
    if (!request) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const status = String(payment?.status || action || '').toLowerCase();
    if (['processed', 'completed', 'paid'].includes(status)) {
      await callRpc(null, 'droxion_finalize_payout', {
        p_request_id: request.id,
        p_success: true,
        p_provider_item_id: paymentId,
        p_failure_reason: null
      });
    } else if (['failed', 'rejected', 'cancelled', 'canceled'].includes(status)) {
      await callRpc(null, 'droxion_finalize_payout', {
        p_request_id: request.id,
        p_success: false,
        p_provider_item_id: paymentId,
        p_failure_reason: payment?.failureMessage || payment?.error || `Trolley payment ${status}.`
      });
    } else if (['returned', 'reversed'].includes(status)) {
      await callRpc(null, 'droxion_reverse_completed_payout', {
        p_request_id: request.id,
        p_failure_reason: payment?.returnedNote || payment?.returnedReason || 'Trolley payout was returned.'
      });
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Trolley webhook error:', error?.message || error);
    res.status(400).json({ error: error?.message || 'Webhook processing failed.' });
  }
}
