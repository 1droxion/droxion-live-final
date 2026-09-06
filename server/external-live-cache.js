function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function getServiceConfig() {
  const supabaseUrl = text(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/$/, '');
  const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
  if (!supabaseUrl || !serviceRoleKey) return null;
  return { supabaseUrl, serviceRoleKey };
}

function serviceHeaders(extra = {}) {
  const config = getServiceConfig();
  if (!config) return null;
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: 'application/json',
    ...extra,
  };
}

async function readJson(response) {
  const raw = await response.text();
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { return null; }
}

export async function readProviderCache(provider) {
  const config = getServiceConfig();
  const headers = serviceHeaders();
  if (!config || !headers) return null;

  const url = new URL(`${config.supabaseUrl}/rest/v1/droxion_external_provider_cache`);
  url.searchParams.set('select', 'payload,updated_at');
  url.searchParams.set('provider', `eq.${text(provider)}`);
  url.searchParams.set('limit', '1');

  const response = await fetch(url, { headers });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || 'Could not read external provider cache');
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    payload: row.payload,
    updatedAt: text(row.updated_at),
  };
}

export async function writeProviderCache(provider, payload) {
  const config = getServiceConfig();
  const headers = serviceHeaders({
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  });
  if (!config || !headers) return false;

  const url = new URL(`${config.supabaseUrl}/rest/v1/droxion_external_provider_cache`);
  url.searchParams.set('on_conflict', 'provider');
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: text(provider),
      payload: Array.isArray(payload) ? payload : [],
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    const data = await readJson(response);
    throw new Error(data?.message || 'Could not write external provider cache');
  }
  return true;
}

export async function saveKickSourceMessage(message) {
  const config = getServiceConfig();
  const headers = serviceHeaders({
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  });
  if (!config || !headers) return false;

  const broadcasterUserId = Number(message?.broadcasterUserId || 0);
  const externalMessageId = text(message?.id);
  const body = text(message?.message);
  if (!Number.isInteger(broadcasterUserId) || broadcasterUserId <= 0 || !externalMessageId || !body) return false;

  const url = new URL(`${config.supabaseUrl}/rest/v1/droxion_external_source_messages`);
  url.searchParams.set('on_conflict', 'provider,external_message_id');
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: 'kick',
      broadcaster_user_id: broadcasterUserId,
      external_message_id: externalMessageId,
      author_id: text(message?.authorId) || null,
      author_name: text(message?.authorName, 'Kick user'),
      avatar_url: text(message?.avatarUrl) || null,
      body,
      published_at: text(message?.publishedAt) || new Date().toISOString(),
      is_verified: Boolean(message?.isVerified),
      metadata: {
        broadcasterSlug: text(message?.broadcasterSlug),
        badges: Array.isArray(message?.badges) ? message.badges : [],
      },
    }),
  });
  if (!response.ok) {
    const data = await readJson(response);
    throw new Error(data?.message || 'Could not save Kick source message');
  }
  return true;
}

export async function readKickSourceMessages(broadcasterUserId, { after = '', limit = 120 } = {}) {
  const config = getServiceConfig();
  const headers = serviceHeaders();
  if (!config || !headers) return [];

  const numericId = Number(broadcasterUserId || 0);
  if (!Number.isInteger(numericId) || numericId <= 0) return [];

  const url = new URL(`${config.supabaseUrl}/rest/v1/droxion_external_source_messages`);
  url.searchParams.set('select', 'external_message_id,author_id,author_name,avatar_url,body,published_at,is_verified,metadata');
  url.searchParams.set('provider', 'eq.kick');
  url.searchParams.set('broadcaster_user_id', `eq.${numericId}`);
  const cursor = text(after);
  if (cursor) {
    url.searchParams.set('published_at', `gt.${cursor}`);
  } else {
    url.searchParams.set('published_at', `gte.${new Date(Date.now() - 20 * 60 * 1000).toISOString()}`);
  }
  url.searchParams.set('order', 'published_at.asc');
  url.searchParams.set('limit', String(Math.max(1, Math.min(200, Number(limit) || 120))));

  const response = await fetch(url, { headers });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || 'Could not read Kick source messages');
  return (Array.isArray(data) ? data : []).map(row => ({
    id: text(row.external_message_id),
    provider: 'kick',
    authorId: text(row.author_id),
    authorName: text(row.author_name, 'Kick user'),
    avatarUrl: text(row.avatar_url),
    message: text(row.body),
    publishedAt: text(row.published_at),
    isVerified: Boolean(row.is_verified),
    badges: Array.isArray(row?.metadata?.badges) ? row.metadata.badges : [],
  })).filter(row => row.id && row.message);
}
