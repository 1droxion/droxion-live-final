const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;
const REQUEST_TIMEOUT_MS = 8000;
const LIVE_HUB_CACHE_SECONDS = 1800;
const LIVE_HUB_STALE_SECONDS = 7200;

const YOUTUBE_CATEGORY_BY_ID = {
  '1': 'Entertainment',
  '2': 'Entertainment',
  '10': 'Music',
  '15': 'Entertainment',
  '17': 'Sports',
  '19': 'IRL',
  '20': 'Gaming',
  '22': 'IRL',
  '23': 'Entertainment',
  '24': 'Entertainment',
  '25': 'Talk',
  '26': 'Lifestyle',
  '27': 'Talk',
  '28': 'Talk'
};

let twitchTokenCache = { token: '', expiresAt: 0 };
let kickTokenCache = { token: '', expiresAt: 0 };

function clampLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function timeoutSignal(ms = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timeout) };
}

async function fetchJson(url, init = {}) {
  const timeout = timeoutSignal();
  try {
    const response = await fetch(url, { ...init, signal: timeout.signal });
    if (!response.ok) {
      let hostname = 'provider';
      try { hostname = new URL(url).hostname; } catch {}
      throw new Error(`HTTP ${response.status} from ${hostname}`);
    }
    return await response.json();
  } finally {
    timeout.done();
  }
}

function normalizeCategory(value) {
  const raw = text(value);
  const mappedYouTubeCategory = YOUTUBE_CATEGORY_BY_ID[raw];
  if (mappedYouTubeCategory) return mappedYouTubeCategory;

  const source = raw.toLowerCase();
  if (!source) return 'Live';
  if (/game|gaming|esport|fortnite|minecraft|valorant|league|gta|call of duty/.test(source)) return 'Gaming';
  if (/music|dj|concert|song/.test(source)) return 'Music';
  if (/sport|football|soccer|basketball|baseball|cricket|mma|boxing/.test(source)) return 'Sports';
  if (/talk|chat|podcast|news|education|science|technology|howto/.test(source)) return 'Talk';
  if (/irl|travel|outdoor|people|blog|lifestyle/.test(source)) return 'IRL';
  return raw || 'Live';
}

function sortStreams(streams) {
  return [...streams].sort((a, b) => {
    const viewerDelta = number(b.viewerCount) - number(a.viewerCount);
    if (viewerDelta !== 0) return viewerDelta;
    return text(a.provider).localeCompare(text(b.provider));
  });
}

async function loadYouTube(limit) {
  const apiKey = text(process.env.YOUTUBE_DATA_API_KEY || process.env.YOUTUBE_API_KEY);
  if (!apiKey) return { provider: 'youtube', enabled: false, streams: [], reason: 'missing_credentials' };

  const search = new URL('https://www.googleapis.com/youtube/v3/search');
  search.searchParams.set('part', 'snippet');
  search.searchParams.set('type', 'video');
  search.searchParams.set('eventType', 'live');
  search.searchParams.set('videoEmbeddable', 'true');
  search.searchParams.set('order', 'viewCount');
  search.searchParams.set('maxResults', String(Math.min(50, limit)));
  search.searchParams.set('key', apiKey);

  const searchData = await fetchJson(search);
  const items = Array.isArray(searchData?.items) ? searchData.items : [];
  const ids = items.map(item => text(item?.id?.videoId)).filter(Boolean);

  let videoDetails = new Map();
  if (ids.length) {
    const details = new URL('https://www.googleapis.com/youtube/v3/videos');
    details.searchParams.set('part', 'snippet,liveStreamingDetails,statistics');
    details.searchParams.set('id', ids.join(','));
    details.searchParams.set('key', apiKey);
    const detailsData = await fetchJson(details);
    videoDetails = new Map((detailsData?.items || []).map(item => [String(item.id), item]));
  }

  const streams = items.map(item => {
    const videoId = text(item?.id?.videoId);
    const detail = videoDetails.get(videoId) || {};
    const snippet = detail?.snippet || item?.snippet || {};
    const live = detail?.liveStreamingDetails || {};
    return {
      id: `youtube:${videoId}`,
      provider: 'youtube',
      providerLabel: 'YouTube',
      externalId: videoId,
      channelId: text(snippet?.channelId),
      channelSlug: '',
      creatorName: text(snippet?.channelTitle, 'YouTube creator'),
      title: text(snippet?.title, 'LIVE on YouTube'),
      category: normalizeCategory(snippet?.categoryId || 'Live'),
      viewerCount: number(live?.concurrentViewers),
      startedAt: text(live?.actualStartTime),
      thumbnailUrl: text(snippet?.thumbnails?.maxres?.url || snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url),
      watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      embedType: 'youtube',
      isMature: false
    };
  }).filter(stream => stream.externalId);

  return { provider: 'youtube', enabled: true, streams, reason: '' };
}

async function getTwitchToken() {
  const now = Date.now();
  if (twitchTokenCache.token && twitchTokenCache.expiresAt > now + 60000) return twitchTokenCache.token;

  const clientId = text(process.env.TWITCH_CLIENT_ID);
  const clientSecret = text(process.env.TWITCH_CLIENT_SECRET);
  if (!clientId || !clientSecret) return '';

  const tokenUrl = new URL('https://id.twitch.tv/oauth2/token');
  tokenUrl.searchParams.set('client_id', clientId);
  tokenUrl.searchParams.set('client_secret', clientSecret);
  tokenUrl.searchParams.set('grant_type', 'client_credentials');
  const data = await fetchJson(tokenUrl, { method: 'POST' });
  const token = text(data?.access_token);
  if (token) {
    twitchTokenCache = {
      token,
      expiresAt: now + Math.max(60, number(data?.expires_in, 3600)) * 1000
    };
  }
  return token;
}

async function loadTwitch(limit) {
  const clientId = text(process.env.TWITCH_CLIENT_ID);
  const clientSecret = text(process.env.TWITCH_CLIENT_SECRET);
  if (!clientId || !clientSecret) return { provider: 'twitch', enabled: false, streams: [], reason: 'missing_credentials' };

  const token = await getTwitchToken();
  if (!token) throw new Error('Could not obtain Twitch app access token');

  const url = new URL('https://api.twitch.tv/helix/streams');
  url.searchParams.set('first', String(Math.min(100, limit)));
  const data = await fetchJson(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': clientId
    }
  });

  const streams = (Array.isArray(data?.data) ? data.data : []).map(item => {
    const login = text(item?.user_login);
    const thumbnail = text(item?.thumbnail_url)
      .replace('{width}', '1280')
      .replace('{height}', '720');
    return {
      id: `twitch:${text(item?.id) || login}`,
      provider: 'twitch',
      providerLabel: 'Twitch',
      externalId: text(item?.id),
      channelId: text(item?.user_id),
      channelSlug: login,
      creatorName: text(item?.user_name, login || 'Twitch creator'),
      title: text(item?.title, 'LIVE on Twitch'),
      category: normalizeCategory(item?.game_name || 'Gaming'),
      viewerCount: number(item?.viewer_count),
      startedAt: text(item?.started_at),
      thumbnailUrl: thumbnail,
      watchUrl: login ? `https://www.twitch.tv/${encodeURIComponent(login)}` : 'https://www.twitch.tv',
      embedType: 'twitch',
      isMature: Boolean(item?.is_mature)
    };
  }).filter(stream => stream.channelSlug);

  return { provider: 'twitch', enabled: true, streams, reason: '' };
}

async function getKickToken() {
  const now = Date.now();
  if (kickTokenCache.token && kickTokenCache.expiresAt > now + 60000) return kickTokenCache.token;

  const clientId = text(process.env.KICK_CLIENT_ID);
  const clientSecret = text(process.env.KICK_CLIENT_SECRET);
  if (!clientId || !clientSecret) return '';

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret
  });
  const data = await fetchJson('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const token = text(data?.access_token);
  if (token) {
    kickTokenCache = {
      token,
      expiresAt: now + Math.max(60, number(data?.expires_in, 3600)) * 1000
    };
  }
  return token;
}

function kickSlug(item) {
  return text(
    item?.slug ||
    item?.broadcaster?.slug ||
    item?.broadcaster?.username ||
    item?.broadcaster_user_name ||
    item?.channel?.slug ||
    item?.channel?.username
  );
}

function kickCreatorName(item, slug) {
  return text(
    item?.broadcaster?.username ||
    item?.broadcaster_user_name ||
    item?.channel?.username ||
    item?.channel?.user?.username,
    slug || 'Kick creator'
  );
}

function kickThumbnail(item) {
  const value = item?.thumbnail;
  if (typeof value === 'string') return text(value);
  return text(
    value?.url ||
    item?.thumbnail_url ||
    item?.channel?.livestream?.thumbnail?.url ||
    item?.channel?.livestream?.thumbnail_url
  );
}

async function loadKick(limit) {
  const clientId = text(process.env.KICK_CLIENT_ID);
  const clientSecret = text(process.env.KICK_CLIENT_SECRET);
  if (!clientId || !clientSecret) return { provider: 'kick', enabled: false, streams: [], reason: 'missing_credentials' };

  const token = await getKickToken();
  if (!token) throw new Error('Could not obtain Kick app access token');

  const request = async version => {
    const url = new URL(`https://api.kick.com/public/${version}/livestreams`);
    url.searchParams.set('limit', String(Math.min(50, limit)));
    return fetchJson(url, { headers: { Authorization: `Bearer ${token}` } });
  };

  let data;
  try {
    data = await request('v2');
  } catch {
    data = await request('v1');
  }

  const rows = Array.isArray(data?.data) ? data.data : [];
  const streams = rows.map(item => {
    const slug = kickSlug(item);
    const category = item?.category || item?.categories?.[0] || {};
    return {
      id: `kick:${text(item?.id || item?.livestream_id) || slug}`,
      provider: 'kick',
      providerLabel: 'Kick',
      externalId: text(item?.id || item?.livestream_id),
      channelId: text(item?.broadcaster_user_id || item?.channel_id || item?.broadcaster?.id),
      channelSlug: slug,
      creatorName: kickCreatorName(item, slug),
      title: text(item?.stream_title || item?.title, 'LIVE on Kick'),
      category: normalizeCategory(category?.name || item?.category_name || 'Live'),
      viewerCount: number(item?.viewer_count || item?.viewers),
      startedAt: text(item?.started_at || item?.created_at),
      thumbnailUrl: kickThumbnail(item),
      watchUrl: slug ? `https://kick.com/${encodeURIComponent(slug)}` : 'https://kick.com',
      embedType: 'kick',
      isMature: Boolean(item?.has_mature_content || item?.is_mature)
    };
  }).filter(stream => stream.channelSlug);

  return { provider: 'kick', enabled: true, streams, reason: '' };
}

function providerFailure(provider, error) {
  console.error(`[live-hub] ${provider} request failed`, text(error?.message, 'Provider request failed'));
  return {
    provider,
    enabled: true,
    streams: [],
    reason: 'provider_error',
    error: 'Provider temporarily unavailable'
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = clampLimit(req.query?.limit);
  const perProvider = Math.max(8, Math.ceil(limit / 2));

  const results = await Promise.all([
    loadYouTube(perProvider).catch(error => providerFailure('youtube', error)),
    loadTwitch(perProvider).catch(error => providerFailure('twitch', error)),
    loadKick(perProvider).catch(error => providerFailure('kick', error))
  ]);

  const streams = sortStreams(results.flatMap(result => result.streams || [])).slice(0, limit);
  const providers = Object.fromEntries(results.map(result => [result.provider, {
    enabled: Boolean(result.enabled),
    available: (result.streams || []).length,
    reason: result.reason || '',
    error: result.error || ''
  }]));

  res.setHeader(
    'Cache-Control',
    `public, s-maxage=${LIVE_HUB_CACHE_SECONDS}, stale-while-revalidate=${LIVE_HUB_STALE_SECONDS}`
  );
  return res.status(200).json({
    streams,
    providers,
    generatedAt: new Date().toISOString()
  });
}
