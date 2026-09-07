import { readProviderCache, writeProviderCache } from '../server/external-live-cache.js';

const MAX_LIMIT = 150;
const YOUTUBE_TARGET = 50;
const TWITCH_TARGET = 50;
const KICK_TARGET = 50;
const CACHE_FRESH_MS = 10 * 60 * 1000;
const CACHE_STALE_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;

let twitchTokenCache = { token: '', expiresAt: 0 };
let kickTokenCache = { token: '', expiresAt: 0 };
let youtubePromise = null;

function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(MAX_LIMIT, parsed)) : 150;
}

function normalizeCategory(value) {
  const s = text(value).toLowerCase();
  if (/game|gaming|esport|fortnite|minecraft|valorant|league|gta|call of duty|गेम/.test(s)) return 'Gaming';
  if (/music|dj|concert|song|भजन|संगीत/.test(s)) return 'Music';
  if (/sport|football|soccer|basketball|baseball|cricket|mma|boxing|racing|f1|क्रिकेट|खेल/.test(s)) return 'Sports';
  if (/talk|chat|podcast|news|education|science|technology|समाचार|न्यूज़|खबर/.test(s)) return 'Talk';
  if (/irl|travel|outdoor|people|blog|lifestyle|walking|यात्रा/.test(s)) return 'IRL';
  return 'Live';
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
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(text(data?.error?.message || data?.error, `HTTP ${response.status}`));
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    timeout.done();
  }
}

async function fetchText(url, init = {}) {
  const timeout = timeoutSignal();
  try {
    const response = await fetch(url, { ...init, signal: timeout.signal });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.text();
  } finally {
    timeout.done();
  }
}

function sortStreams(streams) {
  return [...(streams || [])].sort((a, b) => number(b?.viewerCount) - number(a?.viewerCount));
}

function mergeStreams(streams, limit) {
  const map = new Map();
  for (const stream of streams || []) {
    if (!stream?.id) continue;
    const old = map.get(stream.id);
    if (!old || number(stream.viewerCount) >= number(old.viewerCount)) map.set(stream.id, { ...old, ...stream });
  }
  return sortStreams([...map.values()]).slice(0, limit);
}

function selectBalanced(results, limit) {
  const groups = results.filter(result => result?.streams?.length).map(result => ({ ...result, streams: sortStreams(result.streams) }));
  if (!groups.length) return [];
  const chosen = [];
  const seen = new Set();
  const quota = Math.max(1, Math.floor(limit / groups.length));
  for (const group of groups) {
    for (const stream of group.streams.slice(0, quota)) {
      if (!seen.has(stream.id)) { seen.add(stream.id); chosen.push(stream); }
    }
  }
  for (const stream of sortStreams(groups.flatMap(group => group.streams))) {
    if (chosen.length >= limit) break;
    if (!seen.has(stream.id)) { seen.add(stream.id); chosen.push(stream); }
  }
  return sortStreams(chosen).slice(0, limit);
}

function normalizeYouTubeRows(rows) {
  return mergeStreams((Array.isArray(rows) ? rows : []).filter(row => row?.provider === 'youtube' && row?.externalId).map(row => ({
    ...row,
    id: text(row.id, `youtube:${text(row.externalId)}`),
    provider: 'youtube',
    providerLabel: 'YouTube',
    category: text(row.category) || normalizeCategory(`${row.title || ''} ${row.creatorName || ''}`),
    watchUrl: text(row.watchUrl) || `https://www.youtube.com/watch?v=${encodeURIComponent(text(row.externalId))}`,
    embedType: 'youtube',
    isMature: false
  })), YOUTUBE_TARGET);
}

async function loadYouTubeFromEdge(apiKey) {
  const supabaseUrl = text(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/$/, '');
  const serviceKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
  if (!supabaseUrl || !serviceKey || !apiKey) return [];
  const data = await fetchJson(`${supabaseUrl}/functions/v1/youtube-live-discovery`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ apiKey })
  });
  return normalizeYouTubeRows(data?.streams);
}

async function loadYouTubeFromWeb(apiKey) {
  if (!apiKey) return [];
  const pages = [
    'https://www.youtube.com/live?gl=US&hl=en',
    'https://www.youtube.com/gaming?gl=US&hl=en',
    'https://www.youtube.com/results?search_query=live&sp=EgJAAQ%253D%253D&gl=US&hl=en',
    'https://www.youtube.com/results?search_query=hindi+live&sp=EgJAAQ%253D%253D&gl=IN&hl=hi'
  ];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.7',
    Accept: 'text/html,application/xhtml+xml'
  };
  const pageResults = await Promise.allSettled(pages.map(url => fetchText(url, { headers })));
  const ids = [];
  const seen = new Set();
  for (const result of pageResults) {
    if (result.status !== 'fulfilled') continue;
    for (const match of result.value.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)) {
      const id = match[1];
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= 100) break;
    }
    if (ids.length >= 100) break;
  }
  if (!ids.length) return [];

  const items = [];
  for (let start = 0; start < ids.length; start += 50) {
    const chunk = ids.slice(start, start + 50);
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,liveStreamingDetails,status');
    url.searchParams.set('id', chunk.join(','));
    url.searchParams.set('key', apiKey);
    const data = await fetchJson(url);
    if (Array.isArray(data?.items)) items.push(...data.items);
  }

  return normalizeYouTubeRows(items.map(item => {
    const id = text(item?.id);
    const snippet = item?.snippet || {};
    const live = item?.liveStreamingDetails || {};
    const status = item?.status || {};
    if (!id || status?.embeddable === false || !live?.actualStartTime || live?.actualEndTime) return null;
    return {
      id: `youtube:${id}`,
      provider: 'youtube',
      providerLabel: 'YouTube',
      externalId: id,
      channelId: text(snippet.channelId),
      channelSlug: '',
      creatorName: text(snippet.channelTitle, 'YouTube creator'),
      title: text(snippet.title, 'LIVE on YouTube'),
      category: normalizeCategory(`${snippet.title || ''} ${snippet.channelTitle || ''}`),
      language: text(snippet.defaultAudioLanguage || snippet.defaultLanguage),
      viewerCount: number(live.concurrentViewers),
      startedAt: text(live.actualStartTime),
      thumbnailUrl: text(snippet?.thumbnails?.maxres?.url || snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
      embedType: 'youtube',
      isMature: false
    };
  }).filter(Boolean));
}

function youtubeSearchUrl(apiKey, { region = 'US', language = 'en', q = '', maxResults = 25 } = {}) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('eventType', 'live');
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('order', 'viewCount');
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('regionCode', region);
  url.searchParams.set('relevanceLanguage', language);
  if (q) url.searchParams.set('q', q);
  url.searchParams.set('key', apiKey);
  return url;
}

async function loadYouTubeDirect(apiKey) {
  if (!apiKey) return [];
  const [en, hi] = await Promise.all([
    fetchJson(youtubeSearchUrl(apiKey, { region: 'US', language: 'en' })),
    fetchJson(youtubeSearchUrl(apiKey, { region: 'IN', language: 'hi', q: 'हिंदी live' }))
  ]);
  const base = [
    ...(en?.items || []).map(item => ({ item, language: 'en' })),
    ...(hi?.items || []).map(item => ({ item, language: 'hi' }))
  ];
  const streams = base.map(({ item, language }) => {
    const id = text(item?.id?.videoId);
    const snippet = item?.snippet || {};
    if (!id) return null;
    return {
      id: `youtube:${id}`, provider: 'youtube', providerLabel: 'YouTube', externalId: id,
      channelId: text(snippet.channelId), channelSlug: '', creatorName: text(snippet.channelTitle, 'YouTube creator'),
      title: text(snippet.title, 'LIVE on YouTube'), category: normalizeCategory(`${snippet.title || ''} ${snippet.channelTitle || ''}`),
      language, viewerCount: 0, startedAt: text(snippet.publishedAt),
      thumbnailUrl: text(snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`, embedType: 'youtube', isMature: false
    };
  }).filter(Boolean);
  return mergeStreams(streams, YOUTUBE_TARGET);
}

async function loadYouTubeFresh() {
  const cached = await readProviderCache('youtube').catch(() => null);
  const cachedRows = normalizeYouTubeRows(cached?.payload);
  const cacheAge = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  if (cachedRows.length && cacheAge < CACHE_FRESH_MS) {
    return { provider: 'youtube', enabled: true, streams: cachedRows, reason: '', cacheUsed: true };
  }

  const apiKey = text(process.env.YOUTUBE_DATA_API_KEY || process.env.YOUTUBE_API_KEY);
  if (!apiKey) {
    if (cachedRows.length && cacheAge < CACHE_STALE_MS) return { provider: 'youtube', enabled: true, streams: cachedRows, reason: '', cacheUsed: true, fallbackUsed: true };
    return { provider: 'youtube', enabled: false, streams: [], reason: 'missing_credentials' };
  }
  const errors = [];

  try {
    const webRows = await loadYouTubeFromWeb(apiKey);
    if (webRows.length) {
      await writeProviderCache('youtube', webRows).catch(() => {});
      return { provider: 'youtube', enabled: true, streams: webRows, reason: '', cacheUsed: false, fallbackUsed: true };
    }
  } catch (error) {
    errors.push(error);
    console.error('[live-hub] YouTube web recovery failed', text(error?.message, 'unknown'));
  }

  try {
    const edgeRows = await loadYouTubeFromEdge(apiKey);
    if (edgeRows.length) {
      await writeProviderCache('youtube', edgeRows).catch(() => {});
      return { provider: 'youtube', enabled: true, streams: edgeRows, reason: '', cacheUsed: false, fallbackUsed: true };
    }
  } catch (error) {
    errors.push(error);
    console.error('[live-hub] YouTube edge recovery failed', text(error?.message, 'unknown'));
  }

  try {
    const directRows = await loadYouTubeDirect(apiKey);
    if (directRows.length) {
      await writeProviderCache('youtube', directRows).catch(() => {});
      return { provider: 'youtube', enabled: true, streams: directRows, reason: '', cacheUsed: false };
    }
  } catch (error) {
    errors.push(error);
    console.error('[live-hub] YouTube direct discovery failed', text(error?.message, 'unknown'));
  }

  if (cachedRows.length && cacheAge < CACHE_STALE_MS) {
    return { provider: 'youtube', enabled: true, streams: cachedRows, reason: '', cacheUsed: true, fallbackUsed: true };
  }

  const throttled = errors.some(error => Number(error?.status) === 429 || /quota|rate/i.test(text(error?.message)));
  return { provider: 'youtube', enabled: true, streams: [], reason: 'provider_error', error: throttled ? 'YouTube discovery is rate limited.' : 'YouTube LIVE discovery is temporarily unavailable.', fallbackUsed: true };
}

async function loadYouTube() {
  if (youtubePromise) return youtubePromise;
  youtubePromise = loadYouTubeFresh().finally(() => { youtubePromise = null; });
  return youtubePromise;
}

async function getTwitchToken() {
  const now = Date.now();
  if (twitchTokenCache.token && twitchTokenCache.expiresAt > now + 60000) return twitchTokenCache.token;
  const clientId = text(process.env.TWITCH_CLIENT_ID);
  const clientSecret = text(process.env.TWITCH_CLIENT_SECRET);
  if (!clientId || !clientSecret) return '';
  const url = new URL('https://id.twitch.tv/oauth2/token');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('grant_type', 'client_credentials');
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
    const slug = text(item?.user_login);
    return {
      id: `twitch:${text(item?.id) || slug}`, provider: 'twitch', providerLabel: 'Twitch', externalId: text(item?.id),
      channelId: text(item?.user_id), channelSlug: slug, creatorName: text(item?.user_name, slug || 'Twitch creator'),
      title: text(item?.title, 'LIVE on Twitch'), category: normalizeCategory(item?.game_name || 'Gaming'), language: text(item?.language),
      viewerCount: number(item?.viewer_count), startedAt: text(item?.started_at),
      thumbnailUrl: text(item?.thumbnail_url).replace('{width}', '1280').replace('{height}', '720'),
      watchUrl: slug ? `https://www.twitch.tv/${encodeURIComponent(slug)}` : 'https://www.twitch.tv', embedType: 'twitch', isMature: Boolean(item?.is_mature)
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
  const data = await fetchJson('https://id.kick.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: body.toString() });
  const token = text(data?.access_token);
  if (token) kickTokenCache = { token, expiresAt: now + Math.max(60, number(data?.expires_in, 3600)) * 1000 };
  return token;
}

function kickSlug(item) {
  return text(item?.slug || item?.broadcaster?.slug || item?.broadcaster?.username || item?.broadcaster_user_name || item?.channel?.slug || item?.channel?.username);
}

function kickBroadcasterId(item) {
  const candidates = [item?.broadcaster_user_id, item?.broadcaster?.user_id, item?.broadcaster?.id, item?.channel?.broadcaster_user_id, item?.channel?.user_id, item?.channel?.user?.id, item?.channel_id, item?.user_id];
  for (const value of candidates) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) return String(id);
  }
  return '';
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
    const cat = item?.category || item?.categories?.[0] || {};
    const thumbnail = typeof item?.thumbnail === 'string' ? text(item.thumbnail) : text(item?.thumbnail?.url || item?.thumbnail_url || item?.channel?.livestream?.thumbnail?.url || item?.channel?.livestream?.thumbnail_url);
    return {
      id: `kick:${text(item?.id || item?.livestream_id) || slug}`, provider: 'kick', providerLabel: 'Kick', externalId: text(item?.id || item?.livestream_id),
      channelId: kickBroadcasterId(item), channelSlug: slug,
      creatorName: text(item?.broadcaster?.username || item?.broadcaster_user_name || item?.channel?.username || item?.channel?.user?.username, slug || 'Kick creator'),
      title: text(item?.stream_title || item?.title, 'LIVE on Kick'), category: normalizeCategory(cat?.name || item?.category_name || 'Live'),
      language: text(item?.language || item?.language_code || item?.channel?.language), viewerCount: number(item?.viewer_count || item?.viewers),
      startedAt: text(item?.started_at || item?.created_at), thumbnailUrl: thumbnail,
      watchUrl: slug ? `https://kick.com/${encodeURIComponent(slug)}` : 'https://kick.com', embedType: 'kick', isMature: Boolean(item?.has_mature_content || item?.is_mature)
    };
  }).filter(stream => stream.channelSlug);
  return { provider: 'kick', enabled: true, streams, reason: streams.length ? '' : 'empty_result' };
}

function providerFailure(provider, error) {
  console.error(`[live-hub] ${provider} failed`, text(error?.message, 'unknown'));
  return { provider, enabled: true, streams: [], reason: 'provider_error', error: 'Provider temporarily unavailable' };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requested = clampLimit(req.query?.limit);
  const expanded = requested >= 150;
  const youtubeLimit = expanded ? YOUTUBE_TARGET : Math.min(YOUTUBE_TARGET, Math.max(16, Math.ceil(requested / 3) + 12));
  const twitchLimit = expanded ? TWITCH_TARGET : Math.min(TWITCH_TARGET, Math.max(16, Math.ceil(requested / 3) + 12));
  const kickLimit = expanded ? KICK_TARGET : Math.min(KICK_TARGET, Math.max(16, Math.ceil(requested / 3) + 12));
  const responseLimit = expanded ? 150 : requested;

  const results = await Promise.all([
    loadYouTube(youtubeLimit).catch(error => providerFailure('youtube', error)),
    loadTwitch(twitchLimit).catch(error => providerFailure('twitch', error)),
    loadKick(kickLimit).catch(error => providerFailure('kick', error))
  ]);

  const streams = selectBalanced(results, responseLimit);
  const counts = streams.reduce((map, stream) => { map[stream.provider] = (map[stream.provider] || 0) + 1; return map; }, {});
  const providers = Object.fromEntries(results.map(result => [result.provider, {
    enabled: Boolean(result.enabled),
    available: counts[result.provider] || 0,
    fetched: result.streams?.length || 0,
    reason: result.reason || '',
    error: result.error || '',
    fallbackUsed: Boolean(result.fallbackUsed),
    cacheUsed: Boolean(result.cacheUsed)
  }]));

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
  return res.status(200).json({ streams, providers, generatedAt: new Date().toISOString() });
}