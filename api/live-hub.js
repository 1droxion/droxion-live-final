import { readProviderCache, writeProviderCache } from '../server/external-live-cache.js';

const DEFAULT_LIMIT = 90;
const MAX_LIMIT = 150;
const REQUEST_TIMEOUT_MS = 8000;
const LIVE_HUB_CACHE_SECONDS = 1800;
const LIVE_HUB_STALE_SECONDS = 21600;
const YOUTUBE_SEARCH_COOLDOWN_MS = 30 * 60 * 1000;
const YOUTUBE_CACHE_FRESH_MS = 20 * 60 * 1000;

const YOUTUBE_CATEGORY_BY_ID = {
  '1': 'Entertainment', '2': 'Entertainment', '10': 'Music', '15': 'Entertainment',
  '17': 'Sports', '19': 'IRL', '20': 'Gaming', '22': 'IRL', '23': 'Entertainment',
  '24': 'Entertainment', '25': 'Talk', '26': 'Lifestyle', '27': 'Talk', '28': 'Talk'
};

let twitchTokenCache = { token: '', expiresAt: 0 };
let kickTokenCache = { token: '', expiresAt: 0 };
let youtubeRequest = null;

function clampLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(MAX_LIMIT, parsed)) : DEFAULT_LIMIT;
}

function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function timeoutSignal(ms = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function fetchJson(url, init = {}) {
  const timeout = timeoutSignal();
  try {
    const response = await fetch(url, { ...init, signal: timeout.signal });
    if (!response.ok) {
      let hostname = 'provider';
      try { hostname = new URL(url).hostname; } catch {}
      const error = new Error(`HTTP ${response.status} from ${hostname}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    timeout.done();
  }
}

async function fetchText(url, init = {}) {
  const timeout = timeoutSignal();
  try {
    const response = await fetch(url, { ...init, signal: timeout.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    timeout.done();
  }
}

function normalizeCategory(value) {
  const raw = text(value);
  if (YOUTUBE_CATEGORY_BY_ID[raw]) return YOUTUBE_CATEGORY_BY_ID[raw];
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
  return [...streams].sort((a, b) => number(b.viewerCount) - number(a.viewerCount));
}

function selectBalancedStreams(results, limit) {
  const groups = results.map(result => ({ provider: result.provider, streams: sortStreams(result.streams || []) })).filter(group => group.streams.length);
  if (!groups.length) return [];
  const selected = [];
  const ids = new Set();
  const quota = Math.max(1, Math.floor(limit / groups.length));
  for (const group of groups) {
    for (const stream of group.streams.slice(0, quota)) {
      if (ids.has(stream.id)) continue;
      ids.add(stream.id); selected.push(stream);
    }
  }
  const remaining = sortStreams(groups.flatMap(group => group.streams).filter(stream => !ids.has(stream.id)));
  for (const stream of remaining) {
    if (selected.length >= limit) break;
    ids.add(stream.id); selected.push(stream);
  }
  return sortStreams(selected).slice(0, limit);
}

function normalizeYouTubeStream(videoId, snippet = {}, live = {}, status = {}) {
  if (!videoId || status?.embeddable === false || live?.actualEndTime || !live?.actualStartTime) return null;
  return {
    id: `youtube:${videoId}`, provider: 'youtube', providerLabel: 'YouTube', externalId: videoId,
    channelId: text(snippet?.channelId), channelSlug: '', creatorName: text(snippet?.channelTitle, 'YouTube creator'),
    title: text(snippet?.title, 'LIVE on YouTube'), category: normalizeCategory(snippet?.categoryId || 'Live'),
    language: text(snippet?.defaultAudioLanguage || snippet?.defaultLanguage), viewerCount: number(live?.concurrentViewers),
    startedAt: text(live?.actualStartTime), thumbnailUrl: text(snippet?.thumbnails?.maxres?.url || snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url),
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, embedType: 'youtube', isMature: false
  };
}

async function youtubeDetails(apiKey, ids) {
  const unique = [...new Set((ids || []).map(text).filter(Boolean))].slice(0, 50);
  if (!unique.length) return [];
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,liveStreamingDetails,statistics,status');
  url.searchParams.set('id', unique.join(','));
  url.searchParams.set('key', apiKey);
  const data = await fetchJson(url);
  return (data?.items || []).map(item => normalizeYouTubeStream(text(item?.id), item?.snippet || {}, item?.liveStreamingDetails || {}, item?.status || {})).filter(Boolean);
}

function youtubeSearchUrl(apiKey, limit) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('eventType', 'live');
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('order', 'viewCount');
  url.searchParams.set('maxResults', String(Math.min(50, limit)));
  url.searchParams.set('key', apiKey);
  return url;
}

async function youtubeWebLiveIds(limit) {
  const html = await fetchText('https://www.youtube.com/live', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const ids = [];
  const seen = new Set();
  for (const match of html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id); ids.push(id);
    if (ids.length >= Math.min(50, Math.max(limit * 2, 30))) break;
  }
  return ids;
}

async function validateCachedYouTube(apiKey, cached) {
  const ids = (Array.isArray(cached?.payload) ? cached.payload : []).map(item => item?.externalId).filter(Boolean);
  if (!ids.length) return [];
  try { return await youtubeDetails(apiKey, ids); }
  catch { return []; }
}

async function loadYouTubeFresh(limit) {
  const apiKey = text(process.env.YOUTUBE_DATA_API_KEY || process.env.YOUTUBE_API_KEY);
  if (!apiKey) return { provider: 'youtube', enabled: false, streams: [], reason: 'missing_credentials' };

  const [cached, attempt] = await Promise.all([
    readProviderCache('youtube').catch(() => null),
    readProviderCache('youtube_search_attempt').catch(() => null)
  ]);
  const cachedAge = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  const attemptAge = attempt?.updatedAt ? Date.now() - Date.parse(attempt.updatedAt) : Infinity;

  if (cachedAge < YOUTUBE_CACHE_FRESH_MS) {
    const streams = await validateCachedYouTube(apiKey, cached);
    if (streams.length) return { provider: 'youtube', enabled: true, streams, reason: '', fallbackUsed: true, cacheUsed: true };
  }

  let streams = [];
  let searchError = null;
  if (attemptAge >= YOUTUBE_SEARCH_COOLDOWN_MS) {
    await writeProviderCache('youtube_search_attempt', []).catch(() => {});
    try {
      const search = await fetchJson(youtubeSearchUrl(apiKey, limit));
      const ids = (search?.items || []).map(item => text(item?.id?.videoId)).filter(Boolean);
      streams = await youtubeDetails(apiKey, ids);
    } catch (error) {
      searchError = error;
    }
  }

  if (!streams.length) {
    try {
      const ids = await youtubeWebLiveIds(limit);
      streams = await youtubeDetails(apiKey, ids);
    } catch (error) {
      if (!searchError) searchError = error;
    }
  }

  if (!streams.length) streams = await validateCachedYouTube(apiKey, cached);
  if (streams.length) {
    await writeProviderCache('youtube', streams).catch(() => {});
    return { provider: 'youtube', enabled: true, streams, reason: '', fallbackUsed: Boolean(searchError), cacheUsed: !streams.length };
  }

  return {
    provider: 'youtube', enabled: true, streams: [], reason: 'provider_error',
    error: searchError?.status === 429 ? 'YouTube is rate-limiting discovery.' : 'YouTube LIVE discovery is temporarily unavailable.',
    fallbackUsed: true
  };
}

async function loadYouTube(limit) {
  if (youtubeRequest) return youtubeRequest;
  youtubeRequest = loadYouTubeFresh(limit).finally(() => { youtubeRequest = null; });
  return youtubeRequest;
}

async function getTwitchToken() {
  const now = Date.now();
  if (twitchTokenCache.token && twitchTokenCache.expiresAt > now + 60000) return twitchTokenCache.token;
  const clientId = text(process.env.TWITCH_CLIENT_ID);
  const clientSecret = text(process.env.TWITCH_CLIENT_SECRET);
  if (!clientId || !clientSecret) return '';
  const url = new URL('https://id.twitch.tv/oauth2/token');
  url.searchParams.set('client_id', clientId); url.searchParams.set('client_secret', clientSecret); url.searchParams.set('grant_type', 'client_credentials');
  const data = await fetchJson(url, { method: 'POST' });
  const token = text(data?.access_token);
  if (token) twitchTokenCache = { token, expiresAt: now + Math.max(60, number(data?.expires_in, 3600)) * 1000 };
  return token;
}

async function loadTwitch(limit) {
  const clientId = text(process.env.TWITCH_CLIENT_ID);
  const clientSecret = text(process.env.TWITCH_CLIENT_SECRET);
  if (!clientId || !clientSecret) return { provider: 'twitch', enabled: false, streams: [], reason: 'missing_credentials' };
  const token = await getTwitchToken();
  if (!token) throw new Error('Could not obtain Twitch token');
  const url = new URL('https://api.twitch.tv/helix/streams');
  url.searchParams.set('first', String(Math.min(100, limit)));
  const data = await fetchJson(url, { headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId } });
  const streams = (data?.data || []).map(item => {
    const login = text(item?.user_login);
    return {
      id: `twitch:${text(item?.id) || login}`, provider: 'twitch', providerLabel: 'Twitch', externalId: text(item?.id),
      channelId: text(item?.user_id), channelSlug: login, creatorName: text(item?.user_name, login || 'Twitch creator'),
      title: text(item?.title, 'LIVE on Twitch'), category: normalizeCategory(item?.game_name || 'Gaming'), language: text(item?.language),
      viewerCount: number(item?.viewer_count), startedAt: text(item?.started_at),
      thumbnailUrl: text(item?.thumbnail_url).replace('{width}', '1280').replace('{height}', '720'),
      watchUrl: login ? `https://www.twitch.tv/${encodeURIComponent(login)}` : 'https://www.twitch.tv', embedType: 'twitch', isMature: Boolean(item?.is_mature)
    };
  }).filter(stream => stream.channelSlug);
  return { provider: 'twitch', enabled: true, streams, reason: streams.length ? '' : 'empty_result' };
}

async function getKickToken() {
  const now = Date.now();
  if (kickTokenCache.token && kickTokenCache.expiresAt > now + 60000) return kickTokenCache.token;
  const clientId = text(process.env.KICK_CLIENT_ID);
  const clientSecret = text(process.env.KICK_CLIENT_SECRET);
  if (!clientId || !clientSecret) return '';
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
  const data = await fetchJson('https://id.kick.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  const token = text(data?.access_token);
  if (token) kickTokenCache = { token, expiresAt: now + Math.max(60, number(data?.expires_in, 3600)) * 1000 };
  return token;
}

function kickSlug(item) {
  return text(item?.slug || item?.broadcaster?.slug || item?.broadcaster?.username || item?.broadcaster_user_name || item?.channel?.slug || item?.channel?.username);
}

async function loadKick(limit) {
  const clientId = text(process.env.KICK_CLIENT_ID);
  const clientSecret = text(process.env.KICK_CLIENT_SECRET);
  if (!clientId || !clientSecret) return { provider: 'kick', enabled: false, streams: [], reason: 'missing_credentials' };
  const token = await getKickToken();
  if (!token) throw new Error('Could not obtain Kick token');
  const request = async version => {
    const url = new URL(`https://api.kick.com/public/${version}/livestreams`);
    url.searchParams.set('limit', String(Math.min(50, limit)));
    return fetchJson(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  };
  let data;
  try { data = await request('v2'); } catch { data = await request('v1'); }
  const streams = (data?.data || []).map(item => {
    const slug = kickSlug(item);
    const category = item?.category || item?.categories?.[0] || {};
    const broadcasterId = text(item?.broadcaster_user_id || item?.channel_id || item?.broadcaster?.id || item?.channel?.user_id || item?.channel?.user?.id);
    const thumbnail = typeof item?.thumbnail === 'string' ? text(item.thumbnail) : text(item?.thumbnail?.url || item?.thumbnail_url || item?.channel?.livestream?.thumbnail?.url || item?.channel?.livestream?.thumbnail_url);
    return {
      id: `kick:${text(item?.id || item?.livestream_id) || slug}`, provider: 'kick', providerLabel: 'Kick', externalId: text(item?.id || item?.livestream_id),
      channelId: broadcasterId, channelSlug: slug,
      creatorName: text(item?.broadcaster?.username || item?.broadcaster_user_name || item?.channel?.username || item?.channel?.user?.username, slug || 'Kick creator'),
      title: text(item?.stream_title || item?.title, 'LIVE on Kick'), category: normalizeCategory(category?.name || item?.category_name || 'Live'),
      language: text(item?.language || item?.language_code || item?.channel?.language), viewerCount: number(item?.viewer_count || item?.viewers),
      startedAt: text(item?.started_at || item?.created_at), thumbnailUrl: thumbnail,
      watchUrl: slug ? `https://kick.com/${encodeURIComponent(slug)}` : 'https://kick.com', embedType: 'kick', isMature: Boolean(item?.has_mature_content || item?.is_mature)
    };
  }).filter(stream => stream.channelSlug);
  return { provider: 'kick', enabled: true, streams, reason: streams.length ? '' : 'empty_result' };
}

function providerFailure(provider, error) {
  console.error(`[live-hub] ${provider} request failed`, text(error?.message, 'Provider request failed'));
  return { provider, enabled: true, streams: [], reason: 'provider_error', error: 'Provider temporarily unavailable' };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const limit = clampLimit(req.query?.limit);
  const perProvider = Math.min(50, Math.max(16, Math.ceil(limit / 3) + 12));
  const results = await Promise.all([
    loadYouTube(perProvider).catch(error => providerFailure('youtube', error)),
    loadTwitch(perProvider).catch(error => providerFailure('twitch', error)),
    loadKick(perProvider).catch(error => providerFailure('kick', error))
  ]);
  const streams = selectBalancedStreams(results, limit);
  const visibleCounts = streams.reduce((counts, stream) => { counts[stream.provider] = (counts[stream.provider] || 0) + 1; return counts; }, {});
  const providers = Object.fromEntries(results.map(result => [result.provider, {
    enabled: Boolean(result.enabled), available: visibleCounts[result.provider] || 0, fetched: (result.streams || []).length,
    reason: result.reason || '', error: result.error || '', fallbackUsed: Boolean(result.fallbackUsed), cacheUsed: Boolean(result.cacheUsed)
  }]));
  res.setHeader('Cache-Control', `public, s-maxage=${LIVE_HUB_CACHE_SECONDS}, stale-while-revalidate=${LIVE_HUB_STALE_SECONDS}`);
  return res.status(200).json({ streams, providers, generatedAt: new Date().toISOString() });
}
