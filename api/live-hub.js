import { readProviderCache, writeProviderCache } from '../server/external-live-cache.js';

const DEFAULT_LIMIT = 90;
const MAX_LIMIT = 200;
const REQUEST_TIMEOUT_MS = 9000;
const LIVE_HUB_CACHE_SECONDS = 120;
const LIVE_HUB_STALE_SECONDS = 3600;
const YOUTUBE_TARGET_LIMIT = 100;
const TWITCH_TARGET_LIMIT = 50;
const KICK_TARGET_LIMIT = 50;
const YOUTUBE_SEARCH_COOLDOWN_MS = 60 * 60 * 1000;
const YOUTUBE_CACHE_FRESH_MS = 45 * 60 * 1000;
const YOUTUBE_CACHE_MAX_STALE_MS = 6 * 60 * 60 * 1000;
const ISHOWSPEED_CHANNEL_ID = 'UCWsDFcIhY2DBi3GB5uykGXA';

const YOUTUBE_CATEGORY_BY_ID = {
  '1': 'Entertainment', '2': 'Entertainment', '10': 'Music', '15': 'Entertainment',
  '17': 'Sports', '19': 'IRL', '20': 'Gaming', '22': 'IRL', '23': 'Entertainment',
  '24': 'Entertainment', '25': 'Talk', '26': 'Lifestyle', '27': 'Talk', '28': 'Talk'
};

const YOUTUBE_WEB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
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
  if (/game|gaming|esport|fortnite|minecraft|valorant|league|gta|call of duty/.test(source)) return 'Gaming';
  if (/music|dj|concert|song/.test(source)) return 'Music';
  if (/sport|football|soccer|basketball|baseball|cricket|mma|boxing|racing|f1/.test(source)) return 'Sports';
  if (/talk|chat|podcast|news|education|science|technology|howto/.test(source)) return 'Talk';
  if (/irl|travel|outdoor|people|blog|lifestyle|walking/.test(source)) return 'IRL';
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

function normalizeYouTubeStream(videoId, snippet = {}, live = {}, status = {}) {
  if (!videoId || status?.embeddable === false || live?.actualEndTime || !live?.actualStartTime) return null;
  return {
    id: `youtube:${videoId}`,
    provider: 'youtube',
    providerLabel: 'YouTube',
    externalId: videoId,
    channelId: text(snippet?.channelId),
    channelSlug: '',
    creatorName: text(snippet?.channelTitle, 'YouTube creator'),
    title: text(snippet?.title, 'LIVE on YouTube'),
    category: normalizeCategory(snippet?.categoryId || `${snippet?.title || ''} ${snippet?.channelTitle || ''}`),
    language: text(snippet?.defaultAudioLanguage || snippet?.defaultLanguage),
    viewerCount: number(live?.concurrentViewers),
    startedAt: text(live?.actualStartTime),
    thumbnailUrl: text(snippet?.thumbnails?.maxres?.url || snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url),
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    embedType: 'youtube',
    isMature: false
  };
}

function normalizeYouTubeSearchItem(item = {}) {
  const videoId = text(item?.id?.videoId || item?.id);
  const snippet = item?.snippet || {};
  if (!videoId) return null;
  return {
    id: `youtube:${videoId}`,
    provider: 'youtube',
    providerLabel: 'YouTube',
    externalId: videoId,
    channelId: text(snippet?.channelId),
    channelSlug: '',
    creatorName: text(snippet?.channelTitle, 'YouTube creator'),
    title: text(snippet?.title, 'LIVE on YouTube'),
    category: normalizeCategory(`${snippet?.title || ''} ${snippet?.channelTitle || ''}`),
    language: '',
    viewerCount: 0,
    startedAt: text(snippet?.publishedAt),
    thumbnailUrl: text(snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url) || `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    embedType: 'youtube',
    isMature: false
  };
}

function isSpeedStream(stream) {
  if (!stream) return false;
  if (text(stream.channelId) === ISHOWSPEED_CHANNEL_ID) return true;
  return text(stream.creatorName).toLowerCase().replace(/[^a-z0-9]/g, '') === 'ishowspeed';
}

function mergeYouTubeStreams(streams, limit = YOUTUBE_TARGET_LIMIT) {
  const byId = new Map();
  for (const stream of streams || []) {
    if (!stream?.id || stream.provider !== 'youtube') continue;
    const existing = byId.get(stream.id);
    const streamScore = (stream.channelId ? 2 : 0) + (stream.viewerCount ? 2 : 0) + (stream.title && stream.title !== 'LIVE on YouTube' ? 1 : 0);
    const existingScore = existing ? ((existing.channelId ? 2 : 0) + (existing.viewerCount ? 2 : 0) + (existing.title && existing.title !== 'LIVE on YouTube' ? 1 : 0)) : -1;
    if (!existing || streamScore >= existingScore) byId.set(stream.id, stream);
  }

  const all = sortStreams([...byId.values()]);
  const speed = all.find(isSpeedStream) || null;
  const withoutSpeed = all.filter(stream => !isSpeedStream(stream)).slice(0, Math.max(0, limit - (speed ? 1 : 0)));
  const selected = speed ? [speed, ...withoutSpeed] : withoutSpeed;
  return sortStreams(selected).slice(0, limit);
}

async function youtubeDetails(apiKey, ids) {
  const unique = [...new Set((ids || []).map(text).filter(Boolean))].slice(0, 100);
  if (!apiKey || !unique.length) return [];
  const chunks = [];
  for (let index = 0; index < unique.length; index += 50) chunks.push(unique.slice(index, index + 50));

  const groups = [];
  for (const chunk of chunks) {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos');
      url.searchParams.set('part', 'snippet,liveStreamingDetails,statistics,status');
      url.searchParams.set('id', chunk.join(','));
      url.searchParams.set('key', apiKey);
      const data = await fetchJson(url);
      groups.push((data?.items || []).map(item => normalizeYouTubeStream(text(item?.id), item?.snippet || {}, item?.liveStreamingDetails || {}, item?.status || {})).filter(Boolean));
    } catch {
      groups.push([]);
    }
  }
  return groups.flat();
}

function youtubeSearchUrl(apiKey, { pageToken = '', channelId = '', maxResults = 50 } = {}) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('eventType', 'live');
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('order', 'viewCount');
  url.searchParams.set('maxResults', String(Math.min(50, Math.max(1, maxResults))));
  url.searchParams.set('key', apiKey);
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  if (channelId) url.searchParams.set('channelId', channelId);
  return url;
}

async function loadYouTubeApi(apiKey, limit) {
  const target = Math.min(YOUTUBE_TARGET_LIMIT, Math.max(1, limit));
  const first = await fetchJson(youtubeSearchUrl(apiKey, { maxResults: Math.min(50, target) }));
  const items = [...(first?.items || [])];

  if (items.length < target && first?.nextPageToken) {
    try {
      const second = await fetchJson(youtubeSearchUrl(apiKey, {
        pageToken: text(first.nextPageToken),
        maxResults: Math.min(50, target - items.length)
      }));
      items.push(...(second?.items || []));
    } catch {}
  }

  const searchStreams = items.map(normalizeYouTubeSearchItem).filter(Boolean);
  if (!searchStreams.some(isSpeedStream)) {
    try {
      const speedSearch = await fetchJson(youtubeSearchUrl(apiKey, { channelId: ISHOWSPEED_CHANNEL_ID, maxResults: 1 }));
      searchStreams.push(...(speedSearch?.items || []).map(normalizeYouTubeSearchItem).filter(Boolean));
    } catch {}
  }

  const details = await youtubeDetails(apiKey, searchStreams.map(stream => stream.externalId));
  return mergeYouTubeStreams([...searchStreams, ...details], target);
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
    let depth = 0;
    let inString = false;
    let escaped = false;
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
          try { return JSON.parse(source.slice(start, index + 1)); }
          catch { break; }
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

function normalizeYouTubeWebRenderer(renderer = {}) {
  const videoId = text(renderer.videoId);
  if (!videoId || !youtubeRendererIsLive(renderer)) return null;
  const byline = renderer.ownerText || renderer.shortBylineText || renderer.longBylineText || {};
  const bylineRun = Array.isArray(byline.runs) ? byline.runs[0] : null;
  const creatorName = text(bylineRun?.text, 'YouTube creator');
  const channelId = text(bylineRun?.navigationEndpoint?.browseEndpoint?.browseId);
  const thumbnails = Array.isArray(renderer?.thumbnail?.thumbnails) ? renderer.thumbnail.thumbnails : [];
  const title = youtubeText(renderer.title) || 'LIVE on YouTube';
  const viewerText = youtubeText(renderer.viewCountText);
  return {
    id: `youtube:${videoId}`,
    provider: 'youtube',
    providerLabel: 'YouTube',
    externalId: videoId,
    channelId,
    channelSlug: '',
    creatorName,
    title,
    category: normalizeCategory(`${title} ${creatorName}`),
    language: '',
    viewerCount: parseCompactCount(viewerText),
    startedAt: '',
    thumbnailUrl: text(thumbnails[thumbnails.length - 1]?.url) || `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    embedType: 'youtube',
    isMature: false
  };
}

function collectYouTubeWebStreams(initialData, limit = 40) {
  if (!initialData || typeof initialData !== 'object') return [];
  const found = [];
  const seen = new Set();
  const stack = [initialData];
  let inspected = 0;
  while (stack.length && found.length < limit && inspected < 120000) {
    const node = stack.pop();
    inspected += 1;
    if (!node || typeof node !== 'object') continue;
    const renderer = node.videoRenderer || node.gridVideoRenderer || node.compactVideoRenderer || null;
    if (renderer) {
      const stream = normalizeYouTubeWebRenderer(renderer);
      if (stream && !seen.has(stream.id)) {
        seen.add(stream.id);
        found.push(stream);
      }
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return found;
}

function speedWatchStream(html, finalUrl) {
  const source = String(html || '');
  const liveNow = /itemprop=["']isLiveBroadcast["'][^>]+content=["']True["']/i.test(source)
    || /"isLiveContent"\s*:\s*true/.test(source)
    || /"isLiveNow"\s*:\s*true/.test(source);
  if (!liveNow) return null;
  let videoId = '';
  try { videoId = text(new URL(finalUrl).searchParams.get('v')); } catch {}
  if (!videoId) videoId = text(source.match(/"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/)?.[1]);
  if (!videoId) return null;
  const titleMatch = source.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  return {
    id: `youtube:${videoId}`,
    provider: 'youtube',
    providerLabel: 'YouTube',
    externalId: videoId,
    channelId: ISHOWSPEED_CHANNEL_ID,
    channelSlug: '',
    creatorName: 'IShowSpeed',
    title: text(titleMatch?.[1], 'IShowSpeed LIVE').replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
    category: 'IRL',
    language: '',
    viewerCount: number(source.match(/"viewCount"\s*:\s*"([0-9]+)"/)?.[1]),
    startedAt: '',
    thumbnailUrl: `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    embedType: 'youtube',
    isMature: false
  };
}

async function youtubeWebPageStreams(url, limit, { speed = false } = {}) {
  const { body, finalUrl } = await fetchTextWithUrl(url, { headers: YOUTUBE_WEB_HEADERS });
  const streams = collectYouTubeWebStreams(extractInitialData(body), limit);
  if (speed) {
    const speedStream = speedWatchStream(body, finalUrl);
    if (speedStream) streams.unshift(speedStream);
  }
  return streams;
}

async function loadYouTubeWeb(limit) {
  const target = Math.min(YOUTUBE_TARGET_LIMIT, Math.max(1, limit));
  const queries = [
    'https://www.youtube.com/live?hl=en&gl=US',
    'https://www.youtube.com/results?search_query=live&hl=en&gl=US',
    'https://www.youtube.com/results?search_query=gaming+live&hl=en&gl=US',
    'https://www.youtube.com/results?search_query=music+live&hl=en&gl=US',
    'https://www.youtube.com/results?search_query=sports+live&hl=en&gl=US',
    'https://www.youtube.com/results?search_query=news+live&hl=en&gl=US',
    'https://www.youtube.com/results?search_query=irl+live&hl=en&gl=US',
    'https://www.youtube.com/results?search_query=podcast+live&hl=en&gl=US'
  ];

  const groups = await Promise.all(queries.map(url => youtubeWebPageStreams(url, 35).catch(() => [])));
  const speed = await youtubeWebPageStreams(`https://www.youtube.com/channel/${ISHOWSPEED_CHANNEL_ID}/live?hl=en&gl=US`, 10, { speed: true }).catch(() => []);
  return mergeYouTubeStreams([...speed, ...groups.flat()], target);
}

function cachedYouTubeStreams(cached, limit) {
  if (!Array.isArray(cached?.payload)) return [];
  return mergeYouTubeStreams(cached.payload, limit);
}

async function loadYouTubeFresh(limit) {
  const target = Math.min(YOUTUBE_TARGET_LIMIT, Math.max(1, limit));
  const apiKey = text(process.env.YOUTUBE_DATA_API_KEY || process.env.YOUTUBE_API_KEY);
  const [cached, attempt] = await Promise.all([
    readProviderCache('youtube').catch(() => null),
    readProviderCache('youtube_search_attempt').catch(() => null)
  ]);
  const cacheAge = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  const attemptAge = attempt?.updatedAt ? Date.now() - Date.parse(attempt.updatedAt) : Infinity;
  const cachedStreams = cacheAge <= YOUTUBE_CACHE_MAX_STALE_MS ? cachedYouTubeStreams(cached, target) : [];

  if (cachedStreams.length && cacheAge < YOUTUBE_CACHE_FRESH_MS) {
    return { provider: 'youtube', enabled: true, streams: cachedStreams, reason: '', cacheUsed: true };
  }

  let apiError = null;
  if (apiKey && attemptAge >= YOUTUBE_SEARCH_COOLDOWN_MS) {
    await writeProviderCache('youtube_search_attempt', []).catch(() => {});
    try {
      const streams = await loadYouTubeApi(apiKey, target);
      if (streams.length) {
        await writeProviderCache('youtube', streams).catch(() => {});
        return { provider: 'youtube', enabled: true, streams, reason: '', cacheUsed: false };
      }
    } catch (error) {
      apiError = error;
      console.warn('[live-hub] YouTube API discovery fallback', text(error?.message, 'YouTube API unavailable'));
    }
  }

  if (cachedStreams.length) {
    return { provider: 'youtube', enabled: true, streams: cachedStreams, reason: '', cacheUsed: true, fallbackUsed: true };
  }

  try {
    const webStreams = await loadYouTubeWeb(target);
    if (webStreams.length) {
      await writeProviderCache('youtube', webStreams).catch(() => {});
      return { provider: 'youtube', enabled: true, streams: webStreams, reason: '', cacheUsed: false, fallbackUsed: true };
    }
  } catch (error) {
    if (!apiError) apiError = error;
  }

  if (!apiKey) return { provider: 'youtube', enabled: true, streams: [], reason: 'provider_error', error: 'YouTube LIVE discovery is temporarily unavailable.', fallbackUsed: true };
  return {
    provider: 'youtube',
    enabled: true,
    streams: [],
    reason: 'provider_error',
    error: apiError?.status === 429 ? 'YouTube is rate-limiting discovery.' : 'YouTube LIVE discovery is temporarily unavailable.',
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
    const login = text(item?.user_login);
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
      language: text(item?.language),
      viewerCount: number(item?.viewer_count),
      startedAt: text(item?.started_at),
      thumbnailUrl: text(item?.thumbnail_url).replace('{width}', '1280').replace('{height}', '720'),
      watchUrl: login ? `https://www.twitch.tv/${encodeURIComponent(login)}` : 'https://www.twitch.tv',
      embedType: 'twitch',
      isMature: Boolean(item?.is_mature)
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
  const data = await fetchJson('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
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
  try { data = await request('v2'); }
  catch { data = await request('v1'); }

  const streams = (data?.data || []).map(item => {
    const slug = kickSlug(item);
    const category = item?.category || item?.categories?.[0] || {};
    const broadcasterId = text(item?.broadcaster_user_id || item?.channel_id || item?.broadcaster?.id || item?.channel?.user_id || item?.channel?.user?.id);
    const thumbnail = typeof item?.thumbnail === 'string'
      ? text(item.thumbnail)
      : text(item?.thumbnail?.url || item?.thumbnail_url || item?.channel?.livestream?.thumbnail?.url || item?.channel?.livestream?.thumbnail_url);
    return {
      id: `kick:${text(item?.id || item?.livestream_id) || slug}`,
      provider: 'kick',
      providerLabel: 'Kick',
      externalId: text(item?.id || item?.livestream_id),
      channelId: broadcasterId,
      channelSlug: slug,
      creatorName: text(item?.broadcaster?.username || item?.broadcaster_user_name || item?.channel?.username || item?.channel?.user?.username, slug || 'Kick creator'),
      title: text(item?.stream_title || item?.title, 'LIVE on Kick'),
      category: normalizeCategory(category?.name || item?.category_name || 'Live'),
      language: text(item?.language || item?.language_code || item?.channel?.language),
      viewerCount: number(item?.viewer_count || item?.viewers),
      startedAt: text(item?.started_at || item?.created_at),
      thumbnailUrl: thumbnail,
      watchUrl: slug ? `https://kick.com/${encodeURIComponent(slug)}` : 'https://kick.com',
      embedType: 'kick',
      isMature: Boolean(item?.has_mature_content || item?.is_mature)
    };
  }).filter(stream => stream.channelSlug);

  return { provider: 'kick', enabled: true, streams, reason: streams.length ? '' : 'empty_result' };
}

function providerFailure(provider, error) {
  console.error(`[live-hub] ${provider} request failed`, text(error?.message, 'Provider request failed'));
  return { provider, enabled: true, streams: [], reason: 'provider_error', error: 'Provider temporarily unavailable' };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
  const visibleCounts = streams.reduce((counts, stream) => {
    counts[stream.provider] = (counts[stream.provider] || 0) + 1;
    return counts;
  }, {});

  const providers = Object.fromEntries(results.map(result => [result.provider, {
    enabled: Boolean(result.enabled),
    available: visibleCounts[result.provider] || 0,
    fetched: (result.streams || []).length,
    reason: result.reason || '',
    error: result.error || '',
    fallbackUsed: Boolean(result.fallbackUsed),
    cacheUsed: Boolean(result.cacheUsed)
  }]));

  res.setHeader('Cache-Control', `public, s-maxage=${LIVE_HUB_CACHE_SECONDS}, stale-while-revalidate=${LIVE_HUB_STALE_SECONDS}`);
  return res.status(200).json({ streams, providers, generatedAt: new Date().toISOString() });
}
