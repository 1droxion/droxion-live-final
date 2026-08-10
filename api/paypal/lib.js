import { createClient } from '@supabase/supabase-js';

function getEnv(name, fallback) {
  return process.env[name] || fallback || '';
}

export function getSupabaseConfig() {
  const supabaseUrl = getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL', ''));
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY', getEnv('VITE_SUPABASE_ANON_KEY', ''));
  const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', getEnv('SUPABASE_SERVICE_ROLE', ''));

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured.');
  }

  return { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };
}

export function getSupabaseHeaders(accessToken, useServiceRole = false) {
  const { supabaseAnonKey, supabaseServiceRoleKey } = getSupabaseConfig();
  const key = useServiceRole && supabaseServiceRoleKey ? supabaseServiceRoleKey : supabaseAnonKey;

  return {
    apikey: key,
    'Content-Type': 'application/json'
  };
}

export function getPayPalConfig() {
  const clientId = getEnv('PAYPAL_CLIENT_ID', '');
  const clientSecret = getEnv('PAYPAL_CLIENT_SECRET', '');
  const baseUrl = getEnv('PAYPAL_BASE_URL', 'https://api-m.paypal.com');

  if (!clientId || !clientSecret) {
    throw new Error('PayPal environment variables are not configured.');
  }

  return { clientId, clientSecret, baseUrl };
}

export function getWebhookConfig() {
  return getEnv('PAYPAL_WEBHOOK_ID', '');
}

export function normalizeError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unexpected PayPal error.';
}

export async function getSupabaseUser(accessToken) {
  const { supabaseUrl } = getSupabaseConfig();

  if (!accessToken) {
    throw new Error('Authentication required.');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      ...getSupabaseHeaders(accessToken),
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to verify the signed-in user.');
  }

  return payload.user;
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let payload = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  return { response, payload };
}

export async function getProductById(packageId, accessToken) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = getSupabaseHeaders(accessToken);

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/droxion_products?select=id,product_type,name,price_cents,coins_granted,active&active=eq.true&product_type=eq.coin_pack&id=eq.${encodeURIComponent(packageId)}`,
    { headers }
  );

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error('Unable to load package details from Droxion.');
  }

  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function createTransactionRecord(accessToken, payload) {
  const { supabaseUrl } = getSupabaseConfig();

  const headers = {
    ...getSupabaseHeaders(accessToken, true),
    Prefer: 'return=representation'
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const { response, payload: transactionPayload } = await fetchJson(
    `${supabaseUrl}/rest/v1/droxion_paypal_transactions?select=*`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const detail = transactionPayload?.message || transactionPayload?.error || 'Unable to save the purchase record.';
    throw new Error(detail);
  }

  return Array.isArray(transactionPayload) ? transactionPayload[0] : transactionPayload;
}

export async function updateTransactionRecord(accessToken, transactionId, payload) {
  const { supabaseUrl } = getSupabaseConfig();

  const headers = {
    ...getSupabaseHeaders(accessToken, true),
    Prefer: 'return=representation'
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const { response, payload: transactionPayload } = await fetchJson(
    `${supabaseUrl}/rest/v1/droxion_paypal_transactions?id=eq.${encodeURIComponent(transactionId)}&select=*`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const detail = transactionPayload?.message || transactionPayload?.error || 'Unable to update the purchase record.';
    throw new Error(detail);
  }

  return Array.isArray(transactionPayload) ? transactionPayload[0] : transactionPayload;
}

export async function findTransactionByOrderId(accessToken, orderId, userId) {
  const { supabaseUrl } = getSupabaseConfig();

  const headers = {
    ...getSupabaseHeaders(accessToken, true),
    'Content-Type': 'application/json'
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/droxion_paypal_transactions?select=*&paypal_order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      headers
    }
  );

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error('Unable to look up the purchase record.');
  }

  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function findTransactionByCaptureId(accessToken, captureId) {
  const { supabaseUrl } = getSupabaseConfig();

  const headers = {
    ...getSupabaseHeaders(accessToken, true),
    'Content-Type': 'application/json'
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/droxion_paypal_transactions?select=*&paypal_capture_id=eq.${encodeURIComponent(captureId)}`,
    {
      headers
    }
  );

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error('Unable to look up the captured purchase.');
  }

  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function callRpc(accessToken, functionName, args = {}) {
  const { supabaseUrl } = getSupabaseConfig();

  const headers = {
    ...getSupabaseHeaders(accessToken, true),
    Prefer: 'return=representation'
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const { response, payload } = await fetchJson(
    `${supabaseUrl}/rest/v1/rpc/${functionName}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(args)
    }
  );

  if (!response.ok) {
    const detail = payload?.message || payload?.error || 'Wallet update failed.';
    throw new Error(detail);
  }

  return payload;
}

export function buildPayPalHeaders(accessToken, token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${token.clientId}:${token.clientSecret}`).toString('base64')}`
  };
}

export async function createPayPalOrder({ clientId, clientSecret, baseUrl, orderPayload }) {
  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: buildPayPalHeaders(null, { clientId, clientSecret }),
    body: JSON.stringify(orderPayload)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to create the PayPal order.');
  }

  return payload;
}

export async function capturePayPalOrder({ clientId, clientSecret, baseUrl, orderId }) {
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: buildPayPalHeaders(null, { clientId, clientSecret }),
    body: JSON.stringify({})
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to capture the PayPal order.');
  }

  return payload;
}

export async function readJsonBody(req) {
  if (req.body) {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function verifyWebhookSignature({ baseUrl, clientId, clientSecret, event, headers }) {
  const payload = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: getWebhookConfig(),
    webhook_event: event
  };

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: buildPayPalHeaders(null, { clientId, clientSecret }),
    body: JSON.stringify(payload)
  });

  const responsePayload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(responsePayload?.message || 'Unable to verify the PayPal webhook signature.');
  }

  return responsePayload?.verification_status === 'SUCCESS';
}
