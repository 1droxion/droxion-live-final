import { readProviderCache, writeProviderCache } from '../server/external-live-cache.js';

const DEFAULT_LIMIT = 90;
const MAX_LIMIT = 150;
const REQUEST_TIMEOUT_MS = 9000;
const LIVE_HUB_CACHE_SECONDS = 30;
const LIVE_HUB_STALE_SECONDS = 300;
const YOUTUBE_TARGET_LIMIT = 50;
const TWITCH_TARGET_LIMIT = 50;
const KICK_TARGET_LIMIT = 50;
const YOUTUBE_SEARCH_COOLDOWN_MS = 30 * 60 * 1000;
const YOUTUBE_CACHE_FRESH_MS = 15 * 60 * 1000;
const YOUTUBE_CACHE_MAX_STALE_MS = 24 * 60 * 60 * 1000;
const ISHOWSPEED_CHANNEL_ID = 'UCWsDFcIhY2DBi3GB5uykGXA';

const YOUTUBE_CATEGORY_BY_ID = {
  '1': 'Entertainment', '2': 'Entertainment', '10': 'Music', '15': 'Entertainment',
  '17': 'Sports', '19': 'IRL', '20': 'Gaming', '22': 'IRL', '23': 'Entertainment',
  '24': 'Entertainment', '25': 'Talk', '26': 'Lifestyle', '27': 'Talk', '28': 'Talk'
};

const YOUTUBE_WEB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
  Cookie: 'PREF=hl=en&gl=US; CONSENT=YES+cb; SOCS=CAI'
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

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
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

async function fetchTextWithUrl(url, init = {}) {
  const timeout = timeoutSignal();
  try {
    const response = await fetch(url, { ...init, signal: timeout.signal, redirect: 'follow' });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return { body: await response.text(), finalUrl: response.url || String(url) };
  } finally {
    timeout.done();
  }
}

function normalizeCategory(value) {
  const raw = text(value);
  if (YOUTUBE_CATEGORY_BY_ID[raw]) return YOUTUBE_CATEGORY_BY_ID[raw];
  const source = raw.toLowerCase();
  if (!source) return 'Live';
  if (/game|gaming|esport|fortnite|minecraft|valorant|league|gta|call of duty|गेम/.test(source)) return 'Gaming';
  if (/music|dj|concert|song|भजन|संगीत/.test(source)) return 'Music';
  if (/sport|football|soccer|basketball|baseball|cricket|mma|boxing|racing|f1|क्रिकेट|खेल/.test(source)) return 'Sports';
  if (/talk|chat|podcast|news|education|science|technology|howto|समाचार|न्यूज़|खबर/.test(source)) return 'Talk';
  if (/irl|travel|outdoor|people|blog|lifestyle|walking|यात्रा/.test(source)) return 'IRL';
  return raw || 'Live';
}

function sortStreams(streams) {
  return [...(streams || [])].sort((a, b) => {
    const viewerDelta = number(b?.viewerCount) - number(a?.viewerCount);
    if (viewerDelta !== 0) return viewerDelta;
    return text(a?.provider).localeCompare(text(b?.provider));
  });
}

function selectBalancedStreams(results, limit) {
  const groups = (results || [])
    .map(result => ({ provider: result.provider, streams: sortStreams(result.streams || []) }))
    .filter(group => group.streams.length);
  if (!groups.length) return [];

  const selected = [];
  const ids = new Set();
  const quota = Math.max(1, Math.floor(limit / groups.length));
  for (const group of groups) {
    for (const stream of group.streams.slice(0, quota)) {
      if (!stream?.id || ids.has(stream.id)) continue;
      ids.add(stream.id);
      selected.push(stream);
    }
  }

  const remaining = sortStreams(groups.flatMap(group => group.streams).filter(stream => stream?.id && !ids.has(stream.id)));
  for (const stream of remaining) {
    if (selected.length >= limit) break;
    ids.add(stream.id);
    selected.push(stream);
  }
  return sortStreams(selected).slice(0, limit);
}

function normalizeYouTubeStream(videoId, snippet = {}, live = {}, status = {}, languageHint = '') {
  if (!videoId || status?.embeddable === false || live?.actualEndTime || !live?.actualStartTime) return null;
  return {
    id: `youtube:${videoId}`,
    provider: 'youtube', providerLabel: 'YouTube', externalId: videoId,
    channelId: text(snippet?.channelId), channelSlug: '', creatorName: text(snippet?.channelTitle, 'YouTube creator'),
    title: text(snippet?.title, 'LIVE on YouTube'), category: normalizeCategory(snippet?.categoryId || `${snippet?.title || ''} ${snippet?.channelTitle || ''}`),
    language: text(snippet?.defaultAudioLanguage || snippet?.defaultLanguage || languageHint), viewerCount: number(live?.concurrentViewers),
    startedAt: text(live?.actualStartTime),
    thumbnailUrl: text(snippet?.thumbnails?.maxres?.url || snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url),
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, embedType: 'youtube', isMature: false
  };
}

function normalizeYouTubeSearchItem(item = {}, languageHint = '') {
  const videoId = text(item?.id?.videoId || item?.id);
  const snippet = item?.snippet || {};
  if (!videoId) return null;
  return {
    id: `youtube:${videoId}`, provider: 'youtube', providerLabel: 'YouTube', externalId: videoId,
    channelId: text(snippet?.channelId), channelSlug: '', creatorName: text(snippet?.channelTitle, 'YouTube creator'),
    title: text(snippet?.title, 'LIVE on YouTube'), category: normalizeCategory(`${snippet?.title || ''} ${snippet?.channelTitle || ''}`),
    language: languageHint, viewerCount: 0, startedAt: text(snippet?.publishedAt),
    thumbnailUrl: text(snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url) || `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, embedType: 'youtube', isMature: false
  };
}

function isSpeedStream(stream) {
  if (!stream) return false;
  if (text(stream.channelId) === ISHOWSPEED_CHANNEL_ID) return true;
  return text(stream.creatorName).toLowerCase().replace(/[^a-z0-9]/g, '') === 'ishowspeed';
}

function youtubeLanguageGroup(stream) {
  const language = text(stream?.language).toLowerCase();
  const words = `${text(stream?.title)} ${text(stream?.creatorName)}`;
  if (language.startsWith('hi') || /[\u0900-\u097F]/.test(words)) return 'hi';
  if (language.startsWith('en')) return 'en';
  return 'other';
}

function mergeYouTubeStreams(streams) {
  const byId = new Map();
  for (const stream of streams || []) {
    if (!stream?.id || stream.provider !== 'youtube') continue;
    const existing = byId.get(stream.id);
    const score = (stream.channelId ? 2 : 0) + (stream.viewerCount ? 2 : 0) + (stream.language ? 1 : 0) + (stream.title && stream.title !== 'LIVE on YouTube' ? 1 : 0);
    const existingScore = existing ? ((existing.channelId ? 2 : 0) + (existing.viewerCount ? 2 : 0) + (existing.language ? 1 : 0) + (existing.title && existing.title !== 'LIVE on YouTube' ? 1 : 0)) : -1;
    if (!existing || score >= existingScore) byId.set(stream.id, { ...existing, ...stream, language: stream.language || existing?.language || '' });
  }
  return sortStreams([...byId.values()]);
}

function selectYouTubeLanguageMix(streams, limit = YOUTUBE_TARGET_LIMIT) {
  const all = mergeYouTubeStreams(streams);
  const hindi = all.filter(stream => youtubeLanguageGroup(stream) === 'hi');
  const english = all.filter(stream => youtubeLanguageGroup(stream) === 'en');
  const selected = [...hindi.slice(0, Math.floor(limit / 2)), ...english.slice(0, Math.floor(limit / 2))];
  const ids = new Set(selected.map(stream => stream.id));
  for (const stream of all) {
    if (selected.length >= limit) break;
    if (ids.has(stream.id)) continue;
    ids.add(stream.id);
    selected.push(stream);
  }
  const speed = all.find(isSpeedStream);
  if (speed && !ids.has(speed.id)) {
    if (selected.length >= limit) selected[selected.length - 1] = speed;
    else selected.push(speed);
  }
  return sortStreams(selected).slice(0, limit);
}

async function youtubeDetails(apiKey, searchStreams) {
  const candidates = mergeYouTubeStreams(searchStreams).slice(0, 50);
  if (!apiKey || !candidates.length) return [];
  const hintById = new Map(candidates.map(stream => [stream.externalId, stream.language || '']));
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,liveStreamingDetails,statistics,status');
  url.searchParams.set('id', candidates.map(stream => stream.externalId).join(','));
  url.searchParams.set('key', apiKey);
  const data = await fetchJson(url);
  return (data?.items || []).map(item => normalizeYouTubeStream(text(item?.id), item?.snippet || {}, item?.liveStreamingDetails || {}, item?.status || {}, hintById.get(text(item?.id)) || '')).filter(Boolean);
}

function youtubeSearchUrl(apiKey, { maxResults = 25, regionCode = '', relevanceLanguage = '', query = '' } = {}) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('eventType', 'live');
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('order', 'viewCount');
  url.searchParams.set('maxResults', String(Math.min(50, Math.max(1, maxResults))));
  url.searchParams.set('key', apiKey);
  if (regionCode) url.searchParams.set('regionCode', regionCode);
  if (relevanceLanguage) url.searchParams.set('relevanceLanguage', relevanceLanguage);
  if (query) url.searchParams.set('q', query);
  return url;
}

async function loadYouTubeApi(apiKey) {
  const bucketSize = Math.ceil(YOUTUBE_TARGET_LIMIT / 2);
  const [englishData, hindiData] = await Promise.all([
    fetchJson(youtubeSearchUrl(apiKey, { maxResults: bucketSize, regionCode: 'US', relevanceLanguage: 'en' })),
    fetchJson(youtubeSearchUrl(apiKey, { maxResults: bucketSize, regionCode: 'IN', relevanceLanguage: 'hi', query: 'हिंदी live' }))
  ]);
  const searchStreams = [
    ...(englishData?.items || []).map(item => normalizeYouTubeSearchItem(item, 'en')),
    ...(hindiData?.items || []).map(item => normalizeYouTubeSearchItem(item, 'hi'))
  ].filter(Boolean);
  const details = await youtubeDetails(apiKey, searchStreams);
  return selectYouTubeLanguageMix([...searchStreams, ...details], YOUTUBE_TARGET_LIMIT);
}

function youtubeText(value) {
  if (!value) return '';
  if (typeof value.simpleText === 'string') return value.simpleText.trim();
  if (Array.isArray(value.runs)) return value.runs.map(run => text(run?.text)).join('').trim();
  return '';
}

function parseCompactCount(value) {
  const raw = text(value).replace(/,/g, '').toUpperCase();
  const match = raw.match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/);
  if (!match) return 0;
  const amount = Number(match[1]);
  const multiplier = match[2] === 'B' ? 1e9 : match[2] === 'M' ? 1e6 : match[2] === 'K' ? 1e3 : 1;
  return Number.isFinite(amount) ? Math.round(amount * multiplier) : 0;
}

function extractInitialData(html) {
  const source = String(html || '');
  const markers = ['var ytInitialData =', 'window["ytInitialData"] =', 'ytInitialData ='];
  for (const marker of markers) {
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) continue;
    const start = source.indexOf('{', markerIndex + marker.length);
    if (start < 0) continue;
    let depth = 0, inString = false, escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') { inString = true; continue; }
      if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          try { return JSON.parse(source.slice(start, index + 1)); } catch { break; }
        }
      }
    }
  }
  return null;
}

function youtubeRendererIsLive(renderer = {}) {
  const overlays = Array.isArray(renderer.thumbnailOverlays) ? renderer.thumbnailOverlays : [];
  if (overlays.some(item => item?.thumbnailOverlayTimeStatusRenderer?.style === 'LIVE')) return true;
  const badges = Array.isArray(renderer.badges) ? renderer.badges : [];
  return badges.some(item => {
    const badge = item?.metadataBadgeRenderer || {};
    return /LIVE/.test(text(badge.style).toUpperCase()) || /LIVE/.test(text(badge.label).toUpperCase());
  });
}

function normalizeYouTubeWebRenderer(renderer = {}, languageHint = '') {
  const videoId = text(renderer.videoId);
  if (!videoId || !youtubeRendererIsLive(renderer)) return null;
  const byline = renderer.ownerText || renderer.shortBylineText || renderer.longBylineText || {};
  const bylineRun = Array.isArray(byline.runs) ? byline.runs[0] : null;
  const creatorName = text(bylineRun?.text, 'YouTube creator');
  const channelId = text(bylineRun?.navigationEndpoint?.browseEndpoint?.browseId);
  const thumbnails = Array.isArray(renderer?.thumbnail?.thumbnails) ? renderer.thumbnail.thumbnails : [];
  const title = youtubeText(renderer.title) || 'LIVE on YouTube';
  return {
    id: `youtube:${videoId}`, provider: 'youtube', providerLabel: 'YouTube', externalId: videoId,
    channelId, channelSlug: '', creatorName, title, category: normalizeCategory(`${title} ${creatorName}`), language: languageHint,
    viewerCount: parseCompactCount(youtubeText(renderer.viewCountText)), startedAt: '',
    thumbnailUrl: text(thumbnails[thumbnails.length - 1]?.url) || `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, embedType: 'youtube', isMature: false
  };
}

function collectYouTubeWebStreams(initialData, limit = 30, languageHint = '') {
  if (!initialData || typeof initialData !== 'object') return [];
  const found = [], stack = [initialData], seen = new Set();
  let inspected = 0;
  while (stack.length && found.length < limit && inspected < 120000) {
    const node = stack.pop(); inspected += 1;
    if (!node || typeof node !== 'object') continue;
    const renderer = node.videoRenderer || node.gridVideoRenderer || node.compactVideoRenderer || null;
    if (renderer) {
      const stream = normalizeYouTubeWebRenderer(renderer, languageHint);
      if (stream && !seen.has(stream.id)) { seen.add(stream.id); found.push(stream); }
    }
    for (const value of Object.values(node)) if (value && typeof value === 'object') stack.push(value);
  }
  return found;
}

async function youtubeWebPageStreams(url, limit, languageHint = '') {
  const headers = { ...YOUTUBE_WEB_HEADERS };
  if (languageHint === 'hi') headers['Accept-Language'] = 'hi-IN,hi;q=0.95,en;q=0.7';
  const { body } = await fetchTextWithUrl(url, { headers });
  return collectYouTubeWebStreams(extractInitialData(body), limit, languageHint);
}

async function loadYouTubeWeb() {
  const sources = [
    ['https://www.youtube.com/live?hl=en&gl=US', 'en'],
    ['https://www.youtube.com/results?search_query=live&hl=en&gl=US', 'en'],
    ['https://www.youtube.com/results?search_query=gaming+live&hl=en&gl=US', 'en'],
    ['https://www.youtube.com/results?search_query=news+live&hl=en&gl=US', 'en'],
    ['https://www.youtube.com/results?search_query=%E0%A4%B9%E0%A4%BF%E0%A4%82%E0%A4%A6%E0%A5%80+live&hl=hi&gl=IN', 'hi'],
    ['https://www.youtube.com/results?search_query=%E0%A4%AD%E0%A4%BE%E0%A4%B0%E0%A4%A4+live&hl=hi&gl=IN', 'hi'],
    ['https://www.youtube.com/results?search_query=%E0%A4%B9%E0%A4%BF%E0%A4%82%E0%A4%A6%E0%A5%80+%E0%A4%A8%E0%A5%8D%E0%A4%AF%E0%A5%82%E0%A4%9C%E0%A4%BC+live&hl=hi&gl=IN', 'hi'],
    ['https://www.youtube.com/results?search_query=%E0%A4%B9%E0%A4%BF%E0%A4%82%E0%A4%A6%E0%A5%80+gaming+live&hl=hi&gl=IN', 'hi']
  ];
  const groups = await Promise.all(sources.map(([url, language]) => youtubeWebPageStreams(url, 30, language).catch(() => [])));
  return selectYouTubeLanguageMix(groups.flat(), YOUTUBE_TARGET_LIMIT);
}

function cachedYouTubeStreams(cached) {
  if (!Array.isArray(cached?.payload)) return [];
  return selectYouTubeLanguageMix(cached.payload, YOUTUBE_TARGET_LIMIT);
}

async function loadYouTubeFresh() {
  const apiKey = text(process.env.YOUTUBE_DATA_API_KEY || process.env.YOUTUBE_API_KEY);
  const [cached, attempt] = await Promise.all([
    readProviderCache('youtube').catch(() => null),
    readProviderCache('youtube_search_attempt').catch(() => null)
  ]);
  const cacheAge = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  const attemptAge = attempt?.updatedAt ? Date.now() - Date.parse(attempt.updatedAt) : Infinity;
  const cachedStreams = cacheAge <= YOUTUBE_CACHE_MAX_STALE_MS ? cachedYouTubeStreams(cached) : [];

  if (cachedStreams.length && cacheAge < YOUTUBE_CACHE_FRESH_MS) {
    return { provider: 'youtube', enabled: true, streams: cachedStreams, reason: '', cacheUsed: true };
  }

  let apiError = null;
  if (apiKey && attemptAge >= YOUTUBE_SEARCH_COOLDOWN_MS) {
    await writeProviderCache('youtube_search_attempt', []).catch(() => {});
    try {
      const apiStreams = await loadYouTubeApi(apiKey);
      if (apiStreams.length) {
        await writeProviderCache('youtube', apiStreams).catch(() => {});
        return { provider: 'youtube', enabled: true, streams: apiStreams, reason: '', cacheUsed: false };
      }
    } catch (error) {
      apiError = error;
      console.error('[live-hub] youtube official discovery failed', text(error?.message, 'unknown'));
    }
  }

  try {
    const webStreams = await loadYouTubeWeb();
    if (webStreams.length) {
      await writeProviderCache('youtube', webStreams).catch(() => {});
      return { provider: 'youtube', enabled: true, streams: webStreams, reason: '', cacheUsed: false, fallbackUsed: true };
    }
  } catch (error) {
    console.error('[live-hub] youtube web discovery failed', text(error?.message, 'unknown'));
    if (!apiError) apiError = error;
  }

  if (cachedStreams.length) {
    return { provider: 'youtube', enabled: true, streams: cachedStreams, reason: '', cacheUsed: true, fallbackUsed: true };
  }

  return {
    provider: 'youtube', enabled: true, streams: [], reason: 'provider_error',
    error: apiError?.status === 429 ? 'YouTube is rate-limiting discovery.' : 'YouTube LIVE discovery is temporarily unavailable.',
    fallbackUsed: true
  };
}

async function loadYouTube() {
  if (youtubeRequest) return youtubeRequest;
  youtubeRequest = loadYouTubeFresh().finally(() => { youtubeRequest = null; });
  return youtubeRequest;
}

async function getTwitchToken() {
  const now = Date.now();
  if (twitchTokenCache.token && twitchTokenCache.expiresAt > now + 60000) return twitchTokenCache.token;
  const clientId = text(process.env.TWITCH_CLIENT_ID), clientSecret = text(process.env.TWITCH_CLIENT_SECRET);
  if (!clientId || !clientSecret) return '';
  const url = new URL('https://id.twitch.tv/oauth2/token');
  url.searchParams.set('client_id', clientId); url.searchParams.set('client_secret', clientSecret); url.searchParams.set('grant_type', 'client_credentials');
  const data = await fetchJson(url, { method: 'POST' });
  const token = text(data?.access_token);
  if (token) twitchTokenCache = { token, expiresAt: now + Math.max(60, number(data?.expires_in, 3600)) * 1000 };
  return token;
}

async function loadTwitch(limit) {
  const clientId = text(process.env.TWITCH_CLIENT_ID), clientSecret = text(process.env.TWITCH_CLIENT_SECRET);
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
  const clientId = text(process.env.KICK_CLIENT_ID), clientSecret = text(process.env.KICK_CLIENT_SECRET);
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
  for (const candidate of candidates) {
    const id = positiveInteger(candidate);
    if (id) return String(id);
  }
  return '';
}

async function loadKick(limit) {
  const clientId = text(process.env.KICK_CLIENT_ID), clientSecret = text(process.env.KICK_CLIENT_SECRET);
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
    const slug = kickSlug(item), category = item?.category || item?.categories?.[0] || {}, broadcasterId = kickBroadcasterId(item);
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
  const requestedLimit = clampLimit(req.query?.limit);
  const expandedDiscovery = requestedLimit >= 150;
  const youtubeLimit = expandedDiscovery ? YOUTUBE_TARGET_LIMIT : Math.min(YOUTUBE_TARGET_LIMIT, Math.max(16, Math.ceil(requestedLimit / 3) + 12));
  const twitchLimit = expandedDiscovery ? TWITCH_TARGET_LIMIT : Math.min(TWITCH_TARGET_LIMIT, Math.max(16, Math.ceil(requestedLimit / 3) + 12));
  const kickLimit = expandedDiscovery ? KICK_TARGET_LIMIT : Math.min(KICK_TARGET_LIMIT, Math.max(16, Math.ceil(requestedLimit / 3) + 12));
  const responseLimit = expandedDiscovery ? Math.min(MAX_LIMIT, YOUTUBE_TARGET_LIMIT + TWITCH_TARGET_LIMIT + KICK_TARGET_LIMIT) : requestedLimit;

  const results = await Promise.all([
    loadYouTube(youtubeLimit).catch(error => providerFailure('youtube', error)),
    loadTwitch(twitchLimit).catch(error => providerFailure('twitch', error)),
    loadKick(kickLimit).catch(error => providerFailure('kick', error))
  ]);
  const streams = selectBalancedStreams(results, responseLimit);
  const visibleCounts = streams.reduce((counts, stream) => { counts[stream.provider] = (counts[stream.provider] || 0) + 1; return counts; }, {});
  const providers = Object.fromEntries(results.map(result => [result.provider, {
    enabled: Boolean(result.enabled), available: visibleCounts[result.provider] || 0, fetched: (result.streams || []).length,
    reason: result.reason || '', error: result.error || '', fallbackUsed: Boolean(result.fallbackUsed), cacheUsed: Boolean(result.cacheUsed)
  }]));
  res.setHeader('Cache-Control', `public, s-maxage=${LIVE_HUB_CACHE_SECONDS}, stale-while-revalidate=${LIVE_HUB_STALE_SECONDS}`);
  return res.status(200).json({ streams, providers, generatedAt: new Date().toISOString() });
}
