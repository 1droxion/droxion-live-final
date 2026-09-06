import { readProviderCache, writeProviderCache } from '../server/external-live-cache.js';

const TARGET = 50;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;

function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function normalizeStreams(rows) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.id || row?.provider !== 'youtube' || !row?.externalId) continue;
    map.set(String(row.id), row);
  }
  return [...map.values()]
    .sort((a, b) => Number(b?.viewerCount || 0) - Number(a?.viewerCount || 0))
    .slice(0, TARGET);
}

async function cachedStreams() {
  const cached = await readProviderCache('youtube').catch(() => null);
  if (!cached?.updatedAt || !Array.isArray(cached?.payload)) return [];
  const age = Date.now() - Date.parse(cached.updatedAt);
  if (!Number.isFinite(age) || age > MAX_STALE_MS) return [];
  return normalizeStreams(cached.payload);
}

async function discoverThroughSupabase(apiKey) {
  const supabaseUrl = text(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/$/, '');
  const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
  if (!supabaseUrl || !serviceRoleKey || !apiKey) throw new Error('YouTube recovery backend is not configured');

  const response = await fetch(`${supabaseUrl}/functions/v1/youtube-live-discovery`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ apiKey })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(text(data?.error, `YouTube recovery failed (${response.status})`));
  return normalizeStreams(data?.streams);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  const apiKey = text(process.env.YOUTUBE_DATA_API_KEY || process.env.YOUTUBE_API_KEY);

  try {
    const streams = await discoverThroughSupabase(apiKey);
    if (streams.length) {
      await writeProviderCache('youtube', streams).catch(() => {});
      return res.status(200).json({ streams, recovered: true, source: 'supabase-edge' });
    }
  } catch (error) {
    console.error('[youtube-live-fallback] edge discovery failed', text(error?.message, 'unknown'));
  }

  const cached = await cachedStreams();
  if (cached.length) return res.status(200).json({ streams: cached, recovered: true, source: 'cache' });

  return res.status(200).json({ streams: [], recovered: false, source: 'none' });
}
