import crypto from 'crypto';

const KICK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

const recentMessageIds = new Map();
const channelMessages = new Map();
const MAX_MESSAGES_PER_CHANNEL = 250;
const MESSAGE_TTL_MS = 10 * 60 * 1000;

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function cleanup() {
  const cutoff = Date.now() - MESSAGE_TTL_MS;
  for (const [id, createdAt] of recentMessageIds.entries()) {
    if (createdAt < cutoff) recentMessageIds.delete(id);
  }
  for (const [channelId, rows] of channelMessages.entries()) {
    const fresh = rows.filter(row => Number(row.receivedAt || 0) >= cutoff);
    if (fresh.length) channelMessages.set(channelId, fresh.slice(-MAX_MESSAGES_PER_CHANNEL));
    else channelMessages.delete(channelId);
  }
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyKickSignature({ messageId, timestamp, rawBody, signature }) {
  if (!messageId || !timestamp || !signature) return false;
  const signedPayload = `${messageId}.${timestamp}.${rawBody.toString('utf8')}`;
  try {
    return crypto.verify(
      'RSA-SHA256',
      Buffer.from(signedPayload),
      KICK_PUBLIC_KEY,
      Buffer.from(signature, 'base64')
    );
  } catch {
    return false;
  }
}

function normalizeChat(payload, eventMessageId) {
  return {
    id: text(payload?.message_id || eventMessageId),
    provider: 'kick',
    broadcasterUserId: Number(payload?.broadcaster?.user_id || 0),
    broadcasterSlug: text(payload?.broadcaster?.channel_slug),
    authorId: String(payload?.sender?.user_id || ''),
    authorName: text(payload?.sender?.username, 'Kick user'),
    avatarUrl: text(payload?.sender?.profile_picture),
    message: text(payload?.content),
    publishedAt: text(payload?.created_at, new Date().toISOString()),
    isVerified: Boolean(payload?.sender?.is_verified),
    badges: Array.isArray(payload?.sender?.identity?.badges) ? payload.sender.identity.badges : [],
    receivedAt: Date.now(),
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    const broadcasterUserId = Number(req.query?.broadcasterUserId || 0);
    if (!Number.isInteger(broadcasterUserId) || broadcasterUserId <= 0) {
      return res.status(400).json({ error: 'Invalid broadcaster user ID' });
    }
    cleanup();
    const rows = channelMessages.get(String(broadcasterUserId)) || [];
    return res.status(200).json({
      provider: 'kick',
      available: true,
      messages: rows.map(({ receivedAt, ...row }) => row),
      pollingIntervalMillis: 2000,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const messageId = text(req.headers['kick-event-message-id']);
  const timestamp = text(req.headers['kick-event-message-timestamp']);
  const signature = text(req.headers['kick-event-signature']);
  const eventType = text(req.headers['kick-event-type']);

  if (!verifyKickSignature({ messageId, timestamp, rawBody, signature })) {
    return res.status(401).json({ error: 'Invalid Kick signature' });
  }

  cleanup();
  if (messageId && recentMessageIds.has(messageId)) return res.status(200).json({ ok: true, duplicate: true });
  if (messageId) recentMessageIds.set(messageId, Date.now());

  if (eventType !== 'chat.message.sent') return res.status(200).json({ ok: true, ignored: true });

  let payload;
  try { payload = JSON.parse(rawBody.toString('utf8')); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const row = normalizeChat(payload, messageId);
  if (!row.broadcasterUserId || !row.id || !row.message) return res.status(200).json({ ok: true, ignored: true });

  const key = String(row.broadcasterUserId);
  const rows = channelMessages.get(key) || [];
  if (!rows.some(item => item.id === row.id)) rows.push(row);
  channelMessages.set(key, rows.slice(-MAX_MESSAGES_PER_CHANNEL));

  return res.status(200).json({ ok: true });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
