import {
  getSupabaseConfig,
  getSupabaseHeaders,
  getSupabaseUser,
  readJsonBody
} from '../../server/paypal-lib.js';

const REACTION_FACTORY_BACKEND = 'https://zlnhaqzawbzagraxhmlb.supabase.co/functions/v1/reaction-factory-cloud';
const FOLLOWER_PAGE_SIZE = 1000;
const ONESIGNAL_ALIAS_BATCH_SIZE = 20000;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function cleanText(value, fallback, max = 120) {
  const text = String(value || '').trim();
  return (text || fallback).slice(0, max);
}

function cleanReactionFactoryKey(value) {
  return String(value || '').trim().slice(0, 200);
}

function cleanReactionFactoryOp(value) {
  const op = String(value || '').trim();
  return op === 'status' || op === 'queue' ? op : '';
}

async function handleReactionFactory(req, res) {
  const op = cleanReactionFactoryOp(req.query?.op);
  const key = cleanReactionFactoryKey(req.query?.key);

  if (!op) {
    res.status(400).json({ error: 'Unsupported operation.' });
    return;
  }
  if (!key) {
    res.status(401).json({ error: 'Private dashboard key is missing.' });
    return;
  }
  if (op === 'status' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  if (op === 'queue' && req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const target = new URL(REACTION_FACTORY_BACKEND);
    target.searchParams.set('op', op);
    target.searchParams.set('key', key);

    const init = { method: req.method, headers: {} };
    if (req.method === 'POST') {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body || {});
    }

    const upstream = await fetch(target.toString(), init);
    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = upstream.ok ? { ok: true } : { error: text || 'Cloud request failed.' };
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(upstream.status).json(payload);
  } catch (error) {
    res.status(502).json({ error: error?.message || 'Could not reach Reaction Factory cloud.' });
  }
}

async function getLiveSession(userId, sessionId) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = getSupabaseHeaders(null, true);
  const url = `${supabaseUrl}/rest/v1/droxion_live_presence?select=user_id,session_id,is_live,title&user_id=eq.${encodeURIComponent(userId)}&session_id=eq.${encodeURIComponent(sessionId)}&is_live=eq.true&limit=1`;
  const response = await fetch(url, { headers });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error(rows?.message || 'Unable to verify LIVE session.');
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getCreatorName(userId) {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = getSupabaseHeaders(null, true);
  const url = `${supabaseUrl}/rest/v1/droxion_profiles?select=display_name,username&user_id=eq.${encodeURIComponent(userId)}&limit=1`;
  const response = await fetch(url, { headers });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return 'A creator';
  const profile = Array.isArray(rows) ? rows[0] : null;
  return cleanText(profile?.display_name || profile?.username, 'A creator', 60);
}

async function getFollowerIds(creatorId) {
  const { supabaseUrl } = getSupabaseConfig();
  const baseHeaders = getSupabaseHeaders(null, true);
  const ids = [];
  let offset = 0;

  while (true) {
    const url = `${supabaseUrl}/rest/v1/droxion_follows?select=follower_id&followed_id=eq.${encodeURIComponent(creatorId)}&follower_id=neq.${encodeURIComponent(creatorId)}&order=created_at.asc`;
    const headers = {
      ...baseHeaders,
      Range: `${offset}-${offset + FOLLOWER_PAGE_SIZE - 1}`
    };
    const response = await fetch(url, { headers });
    const rows = await response.json().catch(() => []);
    if (!response.ok) throw new Error(rows?.message || 'Unable to load creator followers.');
    const page = Array.isArray(rows) ? rows : [];
    for (const row of page) {
      const id = String(row?.follower_id || '').trim();
      if (id) ids.push(id);
    }
    if (page.length < FOLLOWER_PAGE_SIZE) break;
    offset += FOLLOWER_PAGE_SIZE;
  }

  return Array.from(new Set(ids));
}

function oneSignalError(payload) {
  const errors = Array.isArray(payload?.errors)
    ? payload.errors.map(String).filter(Boolean)
    : (payload?.errors ? [String(payload.errors)] : []);
  return errors[0] || String(payload?.message || '').trim() || '';
}

function chunks(values, size) {
  const result = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

async function sendFollowerPush({ appId, apiKey, creatorId, creatorName, liveTitle, sessionId, followerIds }) {
  const batches = chunks(followerIds, ONESIGNAL_ALIAS_BATCH_SIZE);
  const messageIds = [];
  let recipients = 0;

  for (let index = 0; index < batches.length; index += 1) {
    const aliases = batches[index];
    const body = {
      app_id: appId,
      target_channel: 'push',
      include_aliases: { external_id: aliases },
      headings: { en: `${creatorName} is LIVE` },
      contents: { en: liveTitle },
      name: `Droxion LIVE ${sessionId}${batches.length > 1 ? ` ${index + 1}/${batches.length}` : ''}`,
      collapse_id: sessionId,
      data: {
        type: 'creator_live',
        creator_id: creatorId,
        session_id: sessionId
      }
    };

    if (batches.length === 1) body.idempotency_key = sessionId;

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));
    const providerError = oneSignalError(payload);
    if (!response.ok) throw new Error(providerError || 'OneSignal push failed.');

    if (payload?.id) messageIds.push(String(payload.id));
    recipients += Math.max(0, Number(payload?.recipients || 0));
  }

  return { messageIds, recipients, batches: batches.length };
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (String(req.query?.rf || '') === '1') {
    await handleReactionFactory(req, res);
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const authHeader = String(req.headers.authorization || '');
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const body = await readJsonBody(req);
    const sessionId = String(body?.sessionId || '').trim();
    if (!sessionId) throw new Error('LIVE session ID is required.');

    const live = await getLiveSession(user.id, sessionId);
    if (!live) throw new Error('This LIVE session is not active.');

    const followerIds = await getFollowerIds(user.id);
    if (followerIds.length === 0) {
      res.status(200).json({
        ok: true,
        sessionId,
        followers: 0,
        recipients: 0,
        messageIds: [],
        reason: 'no_followers'
      });
      return;
    }

    const appId = String(process.env.ONESIGNAL_APP_ID || '').trim();
    const apiKey = String(process.env.ONESIGNAL_APP_API_KEY || '').trim();
    if (!appId || !apiKey) throw new Error('OneSignal server configuration is missing.');

    const creatorName = await getCreatorName(user.id);
    const liveTitle = cleanText(live.title, 'Live on Droxion', 100);
    const delivery = await sendFollowerPush({
      appId,
      apiKey,
      creatorId: user.id,
      creatorName,
      liveTitle,
      sessionId,
      followerIds
    });

    res.status(200).json({
      ok: true,
      sessionId,
      followers: followerIds.length,
      recipients: delivery.recipients,
      messageIds: delivery.messageIds,
      batches: delivery.batches,
      deliveryAccepted: delivery.messageIds.length > 0
    });
  } catch (error) {
    res.status(400).json({ error: error?.message || 'Could not send LIVE notification.' });
  }
}
