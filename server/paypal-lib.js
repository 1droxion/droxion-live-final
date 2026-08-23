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

  if (useServiceRole && !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  const key = useServiceRole ? supabaseServiceRoleKey : supabaseAnonKey;
  const bearer = useServiceRole ? supabaseServiceRoleKey : accessToken;
  const headers = {
    apikey: key,
    'Content-Type': 'application/json'
  };

  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  return headers;
}

export function getPayPalConfig() {
  const clientId = getEnv('PAYPAL_CLIENT_ID', '');
  const clientSecret = getEnv('PAYPAL_CLIENT_SECRET', '');
  const baseUrl = getEnv('PAYPAL_BASE_URL', 'https://api-m.paypal.com').replace(/\/$/, '');

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

function apiErrorMessage(payload, fallback) {
  return (
    payload?.message ||
    payload?.error_description ||
    payload?.details?.[0]?.description ||
    payload?.details?.[0]?.issue ||
    payload?.error ||
    fallback
  );
}

export async function getSupabaseUser(accessToken) {
  const { supabaseUrl } = getSupabaseConfig();

  if (!accessToken) {
    throw new Error('Authentication required.');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: getSupabaseHeaders(accessToken, false)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || payload?.msg || 'Unable to verify the signed-in user.');
  }

  const user = payload?.user?.id ? payload.user : payload;

  if (!user?.id) {
    throw new Error('Supabase did not return a valid authenticated user.');
  }

  return user;
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

export async function getProductById(packageId) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = getSupabaseHeaders(null, true);

  const response = await fetch(
    `${supabaseUrl}/rest/v1/droxion_products?select=id,product_type,name,price_cents,coins_granted,active&active=eq.true&product_type=eq.coin_pack&id=eq.${encodeURIComponent(packageId)}`,
    { headers }
  );

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    const detail = Array.isArray(data) ? '' : data?.message || data?.error;
    throw new Error(detail || 'Unable to load package details from Droxion.');
  }

  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function createTransactionRecord(_accessToken, payload) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = {
    ...getSupabaseHeaders(null, true),
    Prefer: 'return=representation'
  };

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

export async function updateTransactionRecord(_accessToken, transactionId, payload) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = {
    ...getSupabaseHeaders(null, true),
    Prefer: 'return=representation'
  };

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

export async function findTransactionByOrderId(_accessToken, orderId, userId) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = getSupabaseHeaders(null, true);
  const userFilter = userId ? `&user_id=eq.${encodeURIComponent(userId)}` : '';

  const response = await fetch(
    `${supabaseUrl}/rest/v1/droxion_paypal_transactions?select=*&paypal_order_id=eq.${encodeURIComponent(orderId)}${userFilter}`,
    { headers }
  );

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    const detail = Array.isArray(data) ? '' : data?.message || data?.error;
    throw new Error(detail || 'Unable to look up the captured purchase.');
  }

  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function findTransactionByCaptureId(_accessToken, captureId) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = getSupabaseHeaders(null, true);

  const response = await fetch(
    `${supabaseUrl}/rest/v1/droxion_paypal_transactions?select=*&paypal_capture_id=eq.${encodeURIComponent(captureId)}`,
    { headers }
  );

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    const detail = Array.isArray(data) ? '' : data?.message || data?.error;
    throw new Error(detail || 'Unable to look up the captured purchase.');
  }

  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function callRpc(_accessToken, functionName, args = {}) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = {
    ...getSupabaseHeaders(null, true),
    Prefer: 'return=representation'
  };

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

function buildBasicAuthorization(clientId, clientSecret) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

export async function getPayPalAccessToken({ clientId, clientSecret, baseUrl }) {
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en_US',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: buildBasicAuthorization(clientId, clientSecret)
    },
    body: 'grant_type=client_credentials'
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.access_token) {
    throw new Error(apiErrorMessage(payload, 'Unable to authenticate with PayPal.'));
  }

  return payload.access_token;
}

export function buildPayPalHeaders(accessToken, extraHeaders = {}) {
  if (!accessToken) {
    throw new Error('A PayPal OAuth access token is required.');
  }

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    ...extraHeaders
  };
}

export async function getPayPalOrder({ clientId, clientSecret, baseUrl, orderId }) {
  const accessToken = await getPayPalAccessToken({ clientId, clientSecret, baseUrl });
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: buildPayPalHeaders(accessToken)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, 'Unable to retrieve the PayPal order.'));
  }

  return payload;
}

export async function createPayPalOrder({ clientId, clientSecret, baseUrl, orderPayload }) {
  const accessToken = await getPayPalAccessToken({ clientId, clientSecret, baseUrl });
  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: buildPayPalHeaders(accessToken),
    body: JSON.stringify(orderPayload)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, 'Unable to create the PayPal order.'));
  }

  return payload;
}

export async function capturePayPalOrder({ clientId, clientSecret, baseUrl, orderId }) {
  const accessToken = await getPayPalAccessToken({ clientId, clientSecret, baseUrl });
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: buildPayPalHeaders(accessToken, {
      'PayPal-Request-Id': `droxion-capture-${orderId}`
    }),
    body: '{}'
  });

  const payload = await response.json().catch(() => ({}));

  if (response.ok) {
    return payload;
  }

  const alreadyCaptured = payload?.details?.some?.((detail) => detail?.issue === 'ORDER_ALREADY_CAPTURED');
  if (alreadyCaptured) {
    return getPayPalOrder({ clientId, clientSecret, baseUrl, orderId });
  }

  throw new Error(apiErrorMessage(payload, 'Unable to capture the PayPal order.'));
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
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
  const webhookId = getWebhookConfig();
  if (!webhookId) {
    throw new Error('PAYPAL_WEBHOOK_ID is not configured yet.');
  }

  const payload = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: event
  };

  const accessToken = await getPayPalAccessToken({ clientId, clientSecret, baseUrl });
  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: buildPayPalHeaders(accessToken),
    body: JSON.stringify(payload)
  });

  const responsePayload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(apiErrorMessage(responsePayload, 'Unable to verify the PayPal webhook signature.'));
  }

  return responsePayload?.verification_status === 'SUCCESS';
}
