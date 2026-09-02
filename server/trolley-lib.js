import crypto from 'node:crypto';
import {
  callRpc,
  getSupabaseConfig,
  getSupabaseHeaders,
  getSupabaseUser,
  readJsonBody
} from './paypal-lib.js';

export { callRpc, getSupabaseConfig, getSupabaseHeaders, getSupabaseUser, readJsonBody };

export function getTrolleyConfig() {
  const accessKey = process.env.TROLLEY_ACCESS_KEY || '';
  const secretKey = process.env.TROLLEY_SECRET_KEY || '';
  const apiBaseUrl = (process.env.TROLLEY_API_BASE_URL || 'https://api.trolley.com').replace(/\/$/, '');
  const widgetBaseUrl = (process.env.TROLLEY_WIDGET_BASE_URL || 'https://widget.trolley.com').replace(/\/$/, '');

  if (!accessKey || !secretKey) throw new Error('Trolley payout credentials are not configured.');
  return { accessKey, secretKey, apiBaseUrl, widgetBaseUrl };
}

function trolleySignature({ method, requestPath, body, secretKey, timestamp }) {
  const message = `${timestamp}\n${method.toUpperCase()}\n${requestPath}\n${body || ''}\n`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('hex');
}

export async function trolleyRequest(path, { method = 'GET', body = null } = {}) {
  const { accessKey, secretKey, apiBaseUrl } = getTrolleyConfig();
  const url = new URL(path, `${apiBaseUrl}/`);
  const requestPath = `${url.pathname}${url.search}`;
  const bodyString = body == null ? '' : JSON.stringify(body);
  const timestamp = Math.round(Date.now() / 1000);
  const signature = trolleySignature({ method, requestPath, body: bodyString, secretKey, timestamp });
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `prsign ${accessKey}:${signature}`,
      'X-PR-Timestamp': String(timestamp),
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: body == null ? undefined : bodyString
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    const first = Array.isArray(payload?.errors) ? payload.errors[0] : null;
    const message = first?.message || payload?.message || payload?.error || `Trolley request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function buildTrolleyWidgetUrl({ email, referenceId }) {
  const { accessKey, secretKey, widgetBaseUrl } = getTrolleyConfig();
  const params = new URLSearchParams();
  params.set('ts', String(Math.floor(Date.now() / 1000)));
  params.set('key', accessKey);
  params.set('email', email);
  params.set('refid', referenceId);
  params.set('hideEmail', 'false');
  params.set('hideAccountType', 'false');
  params.set('roEmail', 'true');
  params.set('payoutMethods', 'bank-transfer,paypal');
  params.set('locale', 'en');
  params.set('products', 'pay');
  const query = params.toString().replace(/\+/g, '%20');
  const signature = crypto.createHmac('sha256', secretKey).update(query).digest('hex');
  return `${widgetBaseUrl}?${query}&sign=${signature}`;
}

export async function findTrolleyRecipient(referenceId) {
  const payload = await trolleyRequest(`/v1/recipients?referenceId=${encodeURIComponent(referenceId)}&page=1&pageSize=10`);
  const recipients = payload?.recipients ? payload.recipients : (payload?.recipient ? [payload.recipient] : []);
  return recipients.find(row => String(row?.referenceId || '') === String(referenceId)) || recipients[0] || null;
}

export function safePayoutProfile(recipient) {
  if (!recipient) return null;
  const accounts = Array.isArray(recipient.accounts) ? recipient.accounts : [];
  const primaryMethod = String(recipient?.payoutMethod || '').toLowerCase();
  const primaryAccount = accounts.find(account => account?.primary === true && String(account?.type || account?.payoutMethod || '').toLowerCase() === primaryMethod)
    || accounts.find(account => String(account?.type || account?.payoutMethod || '').toLowerCase() === primaryMethod)
    || accounts.find(account => account?.primary === true)
    || null;
  const bank = accounts.find(account => String(account?.type || account?.payoutMethod || '').toLowerCase() === 'bank-transfer')
    || accounts.find(account => account?.bankName || account?.accountNum)
    || null;
  const paypal = accounts.find(account => String(account?.type || account?.payoutMethod || '').toLowerCase() === 'paypal') || null;
  const rawAccount = String(bank?.accountNum || bank?.accountNumber || '');
  const digits = rawAccount.replace(/\D/g, '');
  const last4 = digits ? digits.slice(-4) : '';
  const payoutMethod = String(primaryMethod || primaryAccount?.type || bank?.type || paypal?.type || '').toLowerCase();
  const country = String(primaryAccount?.country || bank?.country || recipient?.address?.country || '').toUpperCase();
  const currency = String(primaryAccount?.currency || bank?.currency || recipient?.primaryCurrency || '').toUpperCase();
  const compliance = String(recipient?.compliance?.status || recipient?.complianceStatus || '').toLowerCase();
  return {
    recipientId: recipient.id || '', status: String(recipient.status || '').toLowerCase(),
    complianceStatus: compliance, payoutMethod, country, currency,
    routeType: recipient.routeType || primaryAccount?.routeType || bank?.routeType || null,
    routeMinimum: recipient.routeMinimum ?? null,
    estimatedFee: recipient.estimatedFees ?? recipient.estimatedFee ?? null,
    bankName: bank?.bankName ? String(bank.bankName).slice(0, 120) : null,
    accountLast4: last4 || null,
    paypalEmail: paypal?.emailAddress ? String(paypal.emailAddress).toLowerCase() : null
  };
}

export async function syncTrolleyProfile(userId, recipient) {
  const profile = safePayoutProfile(recipient);
  if (!profile?.recipientId) return null;
  await callRpc(null, 'droxion_sync_trolley_payout_profile', {
    p_user_id: userId, p_provider_recipient_id: profile.recipientId,
    p_country_code: profile.country || null, p_currency: profile.currency || null,
    p_recipient_status: profile.status || null, p_compliance_status: profile.complianceStatus || null,
    p_payout_method: profile.payoutMethod || null, p_route_type: profile.routeType || null,
    p_route_minimum: profile.routeMinimum, p_estimated_fee: profile.estimatedFee,
    p_bank_name_masked: profile.bankName, p_account_last4: profile.accountLast4
  });
  return profile;
}

export function extractBatchPayment(summary) {
  const candidates = [
    ...(Array.isArray(summary?.payments) ? summary.payments : []),
    ...(Array.isArray(summary?.batch?.payments) ? summary.batch.payments : []),
    ...(Array.isArray(summary?.batchSummary?.payments) ? summary.batchSummary.payments : [])
  ];
  return candidates[0] || null;
}

export function extractLocalQuote(payment, fallbackCurrency = '') {
  if (!payment) return null;
  const destinationAmount = Number(payment.targetAmount ?? payment.destinationAmount ?? payment.recipientAmount ?? payment.amount ?? 0);
  const destinationCurrency = String(payment.targetCurrency || payment.destinationCurrency || payment.recipientCurrency || fallbackCurrency || payment.currency || '').toUpperCase();
  const sourceAmount = Number(payment.sourceAmount ?? payment.amount ?? 0);
  const sourceCurrency = String(payment.sourceCurrency || payment.currency || 'USD').toUpperCase();
  const fxRate = Number(payment.exchangeRate ?? payment.fxRate ?? 0);
  const providerFee = Number(payment.fees ?? payment.recipientFees ?? payment.merchantFees ?? 0);
  return { destinationAmount, destinationCurrency, sourceAmount, sourceCurrency, fxRate, providerFee };
}
