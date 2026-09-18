import { writeProviderCache } from '../server/external-live-cache.js';

const ALLOWED_PROVIDERS = new Set(['tango', 'liveme', 'poppo']);

function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStream(provider, row, index) {
  const channelIdentifier = text(row?.channelIdentifier || row?.channelId || row?.channelSlug);
  const externalId = text(row?.externalId || row?.streamId || row?.id);
  const embedUrl = text(row?.embedUrl || row?.playerUrl);
  const watchUrl = text(row?.watchUrl || row?.url);

  if (!channelIdentifier || (!embedUrl && !watchUrl)) return null;
  if (row?.approvedWoman !== true || row?.adultVerified !== true) return null;

  return {
    id: `${provider}:${externalId || channelIdentifier || index}`,
    provider,
    providerLabel: '',
    externalId,
    channelId: text(row?.channelId || channelIdentifier),
    channelSlug: text(row?.channelSlug || channelIdentifier),
    creatorName: text(row?.creatorName || row?.displayName, 'LIVE creator'),
    title: text(row?.title, 'LIVE now'),
    category: text(row?.category, 'LIVE'),
    language: text(row?.language),
    viewerCount: Math.max(0, number(row?.viewerCount)),
    startedAt: text(row?.startedAt || row?.started_at),
    thumbnailUrl: text(row?.thumbnailUrl || row?.thumbnail),
    watchUrl,
    embedType: provider,
    embedUrl,
    chatUrl: text(row?.chatUrl),
    isMature: false,
    approvedWoman: true,
    adultVerified: true,
    partnerVerified: true
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedSecret = text(process.env.DROXION_PARTNER_INGEST_SECRET);
  const suppliedSecret = text(req.headers['x-droxion-ingest-secret']);

  if (!expectedSecret) {
    return res.status(503).json({ error: 'Partner ingest is not configured' });
  }

  if (!suppliedSecret || suppliedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const provider = text(req.body?.provider).toLowerCase();
  if (!ALLOWED_PROVIDERS.has(provider)) {
    return res.status(400).json({ error: 'Unsupported provider' });
  }

  const sourceRows = Array.isArray(req.body?.streams) ? req.body.streams : [];
  const streams = sourceRows
    .map((row, index) => normalizeStream(provider, row, index))
    .filter(Boolean)
    .slice(0, 200);

  await writeProviderCache(`partner-${provider}-live-v1`, streams);

  return res.status(200).json({
    ok: true,
    provider,
    accepted: streams.length,
    updatedAt: new Date().toISOString()
  });
}
