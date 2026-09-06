import crypto from 'crypto';
import { readKickSourceMessages, saveKickSourceMessage } from '../../server/external-live-cache.js';

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
const MESSAGE_TTL_MS = 10 * 60 * 1000;

function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function cleanup() {
  const cutoff = Date.now() - MESSAGE_TTL_MS;
  for (const [id, createdAt] of recentMessageIds.entries()) {
    if (createdAt < cutoff) recentMessageIds.delete(id);
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
    authorId: text(payload?.sender?.user_id),
    authorName: text(payload?.sender?.username, 'Kick user'),
    avatarUrl: text(payload?.sender?.profile_picture),
    message: text(payload?.content),
    publishedAt: text(payload?.created_at, new Date().toISOString()),
    isVerified: Boolean(payload?.sender?.is_verified),
    badges: Array.isArray(payload?.sender?.identity?.badges) ? payload.sender.identity.badges : [],
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    const broadcasterUserId = Number(req.query?.broadcasterUserId || 0);
    if (!Number.isInteger(broadcasterUserId) || broadcasterUserId <= 0) {
      return res.status(400).json({ error: 'Invalid broadcaster user ID' });
    }
    try {
      const after = text(req.query?.after);
      const rows = await readKickSourceMessages(broadcasterUserId, { after, limit: 120 });
      return res.status(200).json({
        provider: 'kick',
        available: true,
        messages: rows,
        nextAfter: rows.length ? rows[rows.length - 1].publishedAt : after,
        pollingIntervalMillis: 5000,
      });
    } catch (error) {
      console.error('[kick-chat] read failed', text(error?.message, 'read_failed'));
      return res.status(502).json({ provider: 'kick', available: false, messages: [], pollingIntervalMillis: 10000 });
    }
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

  try {
    await saveKickSourceMessage(row);
  } catch (error) {
    console.error('[kick-chat] persist failed', text(error?.message, 'persist_failed'));
    return res.status(502).json({ ok: false, error: 'Could not persist Kick chat message' });
  }

  return res.status(200).json({ ok: true });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
