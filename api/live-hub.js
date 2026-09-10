import { readProviderCache, writeProviderCache } from '../server/external-live-cache.js';

const MAX_LIMIT = 200;
const YOUTUBE_TARGET = 80;
const KICK_TARGET = 60;
const TWITCH_TARGET = 40;
const RUMBLE_TARGET = 20;
const CACHE_FRESH_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;
const RUMBLE_TIMEOUT_MS = 5000;

let kickTokenCache = { token: '', expiresAt: 0 };
let twitchTokenCache = { token: '', expiresAt: 0 };

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
  return Number.isFinite(parsed) ? Math.max(1, Math.min(MAX_LIMIT, parsed)) : MAX_LIMIT;
}

function normalizeCategory(value) {
  const s = text(value).toLowerCase();
  if (/game|gaming|esport|fortnite|minecraft|valorant|league|gta|call of duty|गेम/.test(s)) return 'Gaming';
  if (/music|dj|concert|song|भजन|संगीत/.test(s)) return 'Music';
  if (/sport|football|soccer|basketball|baseball|cricket|mma|boxing|racing|f1|क्रिकेट|खेल/.test(s)) return 'Sports';
  if (/talk|chat|podcast|news|education|science|technology|politic|समाचार|न्यूज़|खबर/.test(s)) return 'Talk';
  if (/irl|travel|outdoor|people|blog|lifestyle|walking|यात्रा/.test(s)) return 'IRL';
  return 'Live';
}

function timeoutSignal(ms = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function fetchJson(url, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: timeout.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(text(data?.error?.message || data?.error || data?.message, `HTTP ${response.status}`));
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    timeout.done();
  }
}

async function fetchHtml(url, timeoutMs = RUMBLE_TIMEOUT_MS) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    const response = await fetch(url, {
      signal: timeout.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; DroxionLive/1.0; +https://www.droxion.com)'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    timeout.done();
  }
}

function mergeUnique(rows, limit) {
  const map = new Map();
  for (const row of rows || []) {
    if (!row?.id) continue;
    const old = map.get(row.id);
    if (!old || number(row.viewerCount) >= number(old.viewerCount)) map.set(row.id, { ...old, ...row });
  }
  return [...map.values()].sort((a, b) => number(b.viewerCount) - number(a.viewerCount)).slice(0, limit);
}

function isHindi(stream) {
  const lang = text(stream?.language).toLowerCase();
  if (lang === 'hi' || lang.startsWith('hi-')) return true;
  return /[\u0900-\u097F]/.test(`${stream?.title || ''} ${stream?.creatorName || ''}`);
}

function isEnglish(stream) {
  const lang = text(stream?.language).toLowerCase();
  return !lang || lang === 'en' || lang.startsWith('en-');
}

function focusLanguages(rows, target) {
  const ranked = [...(rows || [])].sort((a, b) => number(b.viewerCount) - number(a.viewerCount));
  const englishTarget = Math.round(target * 0.8);
  const hindiTarget = target - englishTarget;
  const english = ranked.filter(isEnglish);
  const hindi = ranked.filter(isHindi);
  const chosen = [];
  const seen = new Set();
  const add = row => { if (row?.id && !seen.has(row.id) && chosen.length < target) { seen.add(row.id); chosen.push(row); } };
  english.slice(0, englishTarget).forEach(add);
  hindi.slice(0, hindiTarget).forEach(add);
  ranked.forEach(add);
  return chosen.slice(0, target);
}

function youtubeSearchUrl(apiKey, { region = 'US', language = 'en', q = '', maxResults = 50, pageToken = '' } = {}) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('eventType', 'live');
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('order', 'viewCount');
  url.searchParams.set('maxResults', String(Math.min(50, maxResults)));
  url.searchParams.set('regionCode', region);
  url.searchParams.set('relevanceLanguage', language);
  if (q) url.searchParams.set('q', q);
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  url.searchParams.set('key', apiKey);
  return url;
}

async function fetchYouTubeGroup(apiKey, options, target) {
  const rows = [];
  let pageToken = '';
  while (rows.length < target) {
    const data = await fetchJson(youtubeSearchUrl(apiKey, { ...options, maxResults: Math.min(50, target - rows.length), pageToken }));
    for (const item of data?.items || []) {
      const id = text(item?.id?.videoId);
      const snippet = item?.snippet || {};
      if (!id) continue;
      rows.push({
        id: `youtube:${id}`,
        provider: 'youtube',
        providerLabel: 'YouTube',
        externalId: id,
        channelId: text(snippet.channelId),
        channelSlug: '',
        creatorName: text(snippet.channelTitle, 'YouTube creator'),
        title: text(snippet.title, 'LIVE on YouTube'),
        category: normalizeCategory(`${snippet.title || ''} ${snippet.channelTitle || ''}`),
        language: options.language || 'en',
        viewerCount: 0,
        startedAt: text(snippet.publishedAt),
        thumbnailUrl: text(snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
        embedType: 'youtube',
        isMature: false
      });
    }
    pageToken = text(data?.nextPageToken);
    if (!pageToken || !(data?.items || []).length) break;
  }
  return rows.slice(0, target);
}

async function loadYouTube() {
  const cached = await readProviderCache('youtube-balanced-v2').catch(() => null);
  const cachedRows = Array.isArray(cached?.payload) ? cached.payload : [];
  const age = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  if (cachedRows.length >= 60 && age < CACHE_FRESH_MS) return { provider: 'youtube', enabled: true, streams: focusLanguages(cachedRows, YOUTUBE_TARGET), cacheUsed: true };

  const apiKey = text(process.env.YOUTUBE_DATA_API_KEY || process.env.YOUTUBE_API_KEY);
  if (!apiKey) return { provider: 'youtube', enabled: false, streams: [], reason: 'missing_credentials' };

  try {
    const [english, hindi] = await Promise.all([
      fetchYouTubeGroup(apiKey, { region: 'US', language: 'en' }, 64),
      fetchYouTubeGroup(apiKey, { region: 'IN', language: 'hi', q: 'हिंदी live' }, 16)
    ]);
    const streams = focusLanguages(mergeUnique([...english, ...hindi], YOUTUBE_TARGET), YOUTUBE_TARGET);
    if (streams.length) await writeProviderCache('youtube-balanced-v2', streams).catch(() => {});
    return { provider: 'youtube', enabled: true, streams, reason: streams.length ? '' : 'empty_result', cacheUsed: false };
  } catch (error) {
    console.error('[live-hub] YouTube discovery failed', text(error?.message, 'unknown'));
    if (cachedRows.length) return { provider: 'youtube', enabled: true, streams: focusLanguages(cachedRows, YOUTUBE_TARGET), reason: '', cacheUsed: true, fallbackUsed: true };
    return { provider: 'youtube', enabled: true, streams: [], reason: 'provider_error', error: 'YouTube LIVE discovery is temporarily unavailable.' };
  }
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

function mapKickItem(item) {
  const slug = text(item?.slug || item?.broadcaster?.slug || item?.broadcaster?.username || item?.broadcaster_user_name || item?.channel?.slug || item?.channel?.username);
  if (!slug) return null;
  const cat = item?.category || item?.categories?.[0] || {};
  const channelId = text(
  item?.broadcaster_user?.id ||
  item?.broadcaster_user_id ||
  item?.broadcaster?.user_id ||
  item?.broadcaster?.id ||
  item?.channel?.broadcaster_user_id ||
  creatorName: text(
  item?.broadcaster_user?.username ||
  item?.broadcaster?.username ||
  item?.broadcaster_user_name ||
  item?.channel?.username ||
  item?.channel?.user?.username,
  slug
),
  item?.channel?.user?.id ||
  item?.channel_id ||
  item?.user_id
);
  const thumbnail = typeof item?.thumbnail === 'string' ? text(item.thumbnail) : text(item?.thumbnail?.url || item?.thumbnail_url || item?.channel?.livestream?.thumbnail?.url || item?.channel?.livestream?.thumbnail_url);
  return {
    id: `kick:${text(item?.id || item?.livestream_id) || slug}`,
    provider: 'kick', providerLabel: 'Kick', externalId: text(item?.id || item?.livestream_id),
    channelId, channelSlug: slug,
    creatorName: text(item?.broadcaster?.username || item?.broadcaster_user_name || item?.channel?.username || item?.channel?.user?.username, slug),
    title: text(item?.stream_title || item?.title, 'LIVE on Kick'),
    category: normalizeCategory(cat?.name || item?.category_name || 'Live'),
    language: text(item?.language || item?.language_code || item?.channel?.language),
    viewerCount: number(item?.viewer_count || item?.viewers),
    startedAt: text(item?.started_at || item?.created_at), thumbnailUrl: thumbnail,
    watchUrl: `https://kick.com/${encodeURIComponent(slug)}`, embedType: 'kick',
    isMature: Boolean(item?.has_mature_content || item?.is_mature)
  };
}

async function fetchKickPages(token, version = 'v2') {
  const rows = [];
  let cursor = '';
  for (let page = 0; page < 2 && rows.length < KICK_TARGET; page += 1) {
    const url = new URL(`https://api.kick.com/public/${version}/livestreams`);
    url.searchParams.set('limit', '50');
    if (cursor) url.searchParams.set('cursor', cursor);
    const data = await fetchJson(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const pageRows = (Array.isArray(data?.data) ? data.data : []).map(mapKickItem).filter(Boolean);
    rows.push(...pageRows);
    const next = text(data?.next_cursor || data?.nextCursor || data?.pagination?.next_cursor || data?.pagination?.cursor);
    if (!next || next === cursor || !pageRows.length) break;
    cursor = next;
  }
  return mergeUnique(rows, KICK_TARGET);
}

async function loadKick() {
  const cached = await readProviderCache('kick-balanced-v3').catch(() => null);
  const cachedRows = Array.isArray(cached?.payload) ? cached.payload : [];
  const age = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  if (cachedRows.length >= 45 && age < CACHE_FRESH_MS) return { provider: 'kick', enabled: true, streams: focusLanguages(cachedRows, KICK_TARGET), cacheUsed: true };

  const token = await getKickToken();
  if (!token) return { provider: 'kick', enabled: false, streams: [], reason: 'missing_credentials' };
  try {
    let streams = [];
    try { streams = await fetchKickPages(token, 'v2'); } catch { streams = await fetchKickPages(token, 'v1'); }
    streams = focusLanguages(streams, KICK_TARGET);
    if (streams.length) await writeProviderCache('kick-balanced-v2', streams).catch(() => {});
    return { provider: 'kick', enabled: true, streams, reason: streams.length ? '' : 'empty_result', cacheUsed: false };
  } catch (error) {
    console.error('[live-hub] Kick discovery failed', text(error?.message, 'unknown'));
    if (cachedRows.length) return { provider: 'kick', enabled: true, streams: focusLanguages(cachedRows, KICK_TARGET), reason: '', cacheUsed: true, fallbackUsed: true };
    return { provider: 'kick', enabled: true, streams: [], reason: 'provider_error', error: 'Kick LIVE discovery is temporarily unavailable.' };
  }
}

async function getTwitchToken() {
  const now = Date.now();
  if (twitchTokenCache.token && twitchTokenCache.expiresAt > now + 60000) return twitchTokenCache.token;
  const clientId = text(process.env.TWITCH_CLIENT_ID);
  const clientSecret = text(process.env.TWITCH_CLIENT_SECRET);
  if (!clientId || !clientSecret) return '';
  const data = await fetchJson('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }).toString()
  });
  const token = text(data?.access_token);
  if (token) twitchTokenCache = { token, expiresAt: now + Math.max(60, number(data?.expires_in, 3600)) * 1000 };
  return token;
}

async function loadTwitch() {
  const cached = await readProviderCache('twitch-live-v2').catch(() => null);
  const cachedRows = Array.isArray(cached?.payload) ? cached.payload : [];
  const age = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  if (cachedRows.length >= 25 && age < CACHE_FRESH_MS) return { provider: 'twitch', enabled: true, streams: focusLanguages(cachedRows, TWITCH_TARGET), cacheUsed: true };

  const clientId = text(process.env.TWITCH_CLIENT_ID);
  const clientSecret = text(process.env.TWITCH_CLIENT_SECRET);
  if (!clientId || !clientSecret) return { provider: 'twitch', enabled: false, streams: [], reason: 'missing_credentials' };
  try {
    const token = await getTwitchToken();
    if (!token) throw new Error('missing_token');
    const data = await fetchJson(`https://api.twitch.tv/helix/streams?first=${Math.min(100, Math.max(TWITCH_TARGET, 50))}`, {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId, Accept: 'application/json' }
    });
    const streams = focusLanguages((Array.isArray(data?.data) ? data.data : [])
      .filter(item => !item?.is_mature)
      .map(item => {
        const login = text(item?.user_login);
        if (!login || !item?.id) return null;
        return {
          id: `twitch:${text(item.id)}`,
          provider: 'twitch',
          providerLabel: 'Twitch',
          externalId: text(item.id),
          channelId: text(item.user_id),
          channelSlug: login,
          creatorName: text(item.user_name, login),
          title: text(item.title, 'LIVE on Twitch'),
          category: normalizeCategory(`${item.game_name || ''} ${item.title || ''}`),
          language: text(item.language),
          viewerCount: number(item.viewer_count),
          startedAt: text(item.started_at),
          thumbnailUrl: text(item.thumbnail_url).replace('{width}', '1280').replace('{height}', '720'),
          watchUrl: `https://www.twitch.tv/${encodeURIComponent(login)}`,
          embedType: 'twitch',
          isMature: false
        };
      }).filter(Boolean), TWITCH_TARGET);
    if (streams.length) await writeProviderCache('twitch-live-v2', streams).catch(() => {});
    return { provider: 'twitch', enabled: true, streams, reason: streams.length ? '' : 'empty_result', cacheUsed: false };
  } catch (error) {
    console.error('[live-hub] Twitch discovery failed', text(error?.message, 'unknown'));
    if (cachedRows.length) return { provider: 'twitch', enabled: true, streams: focusLanguages(cachedRows, TWITCH_TARGET), reason: '', cacheUsed: true, fallbackUsed: true };
    return { provider: 'twitch', enabled: true, streams: [], reason: 'provider_error', error: 'Twitch LIVE discovery is temporarily unavailable.' };
  }
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const first = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i').exec(html);
  if (first?.[1]) return decodeHtml(first[1]);
  const second = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i').exec(html);
  return decodeHtml(second?.[1] || '');
}

function rumbleLinks(html) {
  const links = [];
  const seen = new Set();
  const normalized = String(html || '').replace(/\\\//g, '/');
  const regex = /href=["']([^"']*\/v[a-z0-9]+-[^"']+\.html(?:\?[^"']*)?)["']/gi;
  let match;
  while ((match = regex.exec(normalized)) && links.length < 50) {
    try {
      const url = new URL(decodeHtml(match[1]), 'https://rumble.com');
      if (url.hostname !== 'rumble.com' && url.hostname !== 'www.rumble.com') continue;
      url.search = '';
      url.hash = '';
      const clean = url.toString();
      if (!seen.has(clean)) { seen.add(clean); links.push(clean); }
    } catch {}
  }
  return links;
}

function parseCompactCount(value) {
  const raw = text(value).replace(/,/g, '');
  const match = raw.match(/([0-9]+(?:\.[0-9]+)?)\s*([kKmM]?)/);
  if (!match) return 0;
  const base = Number(match[1]);
  const suffix = match[2].toLowerCase();
  return Math.round(base * (suffix === 'm' ? 1000000 : suffix === 'k' ? 1000 : 1));
}

function parseRumblePage(watchUrl, html) {
  const normalized = String(html || '').replace(/\\\//g, '/');
  const isLive = /Streaming now/i.test(normalized) || /["']is_live["']\s*:\s*true/i.test(normalized) || /livestream[^\n]{0,80}["']live["']/i.test(normalized);
  if (!isLive) return null;

  let pageId = '';
  try { pageId = new URL(watchUrl).pathname.split('/').filter(Boolean)[0] || ''; } catch {}
  if (!/^v[a-z0-9]+/i.test(pageId)) return null;

  const title = metaContent(normalized, 'og:title') || metaContent(normalized, 'twitter:title') || 'LIVE on Rumble';
  const thumbnailUrl = metaContent(normalized, 'og:image') || metaContent(normalized, 'twitter:image');
  const creatorName = metaContent(normalized, 'author') || metaContent(normalized, 'article:author') || 'Rumble creator';
  const description = metaContent(normalized, 'og:description');
  const embedMatch = normalized.match(/https:\/\/rumble\.com\/embed\/(v[a-z0-9]+)\/?/i);
  const chatMatch = normalized.match(/(?:https:\/\/rumble\.com)?(\/chat\/popup\/[a-z0-9_-]+)/i);
  const viewerMatch = normalized.match(/(?:watching[_ -]?now|viewer[_ -]?count|watching now)[^0-9]{0,80}([0-9][0-9,.]*\s*[kKmM]?)/i);
  const viewerCount = parseCompactCount(viewerMatch?.[1] || '0');

  return {
    id: `rumble:${pageId}`,
    provider: 'rumble',
    providerLabel: 'Rumble',
    externalId: pageId,
    channelId: '',
    channelSlug: '',
    creatorName,
    title,
    category: normalizeCategory(`${title} ${description}`),
    language: 'en',
    viewerCount,
    startedAt: '',
    thumbnailUrl,
    watchUrl,
    embedType: 'rumble',
    embedUrl: embedMatch?.[1] ? `https://rumble.com/embed/${embedMatch[1]}/` : '',
    chatUrl: chatMatch?.[1] ? `https://rumble.com${chatMatch[1]}` : '',
    isMature: false
  };
}

async function loadRumble() {
  const cached = await readProviderCache('rumble-public-live-v1').catch(() => null);
  const cachedRows = Array.isArray(cached?.payload) ? cached.payload : [];
  const age = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  if (cachedRows.length >= 5 && age < CACHE_FRESH_MS) return { provider: 'rumble', enabled: true, streams: cachedRows.slice(0, RUMBLE_TARGET), cacheUsed: true };

  try {
    const seedUrls = [
      'https://rumble.com/',
      'https://rumble.com/category/24x7',
      'https://rumble.com/category/gaming',
      'https://rumble.com/category/news'
    ];
    const seedPages = await Promise.allSettled(seedUrls.map(url => fetchHtml(url, 3500)));
    const candidates = [];
    const seen = new Set();
    seedPages.forEach(result => {
      if (result.status !== 'fulfilled') return;
      rumbleLinks(result.value).forEach(url => {
        if (!seen.has(url) && candidates.length < 24) { seen.add(url); candidates.push(url); }
      });
    });

    const detailPages = await Promise.allSettled(candidates.map(url => fetchHtml(url, RUMBLE_TIMEOUT_MS).then(html => parseRumblePage(url, html))));
    const streams = detailPages
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => result.value)
      .slice(0, RUMBLE_TARGET);

    if (streams.length) await writeProviderCache('rumble-public-live-v1', streams).catch(() => {});
    if (streams.length) return { provider: 'rumble', enabled: true, streams, reason: '', cacheUsed: false };
    if (cachedRows.length) return { provider: 'rumble', enabled: true, streams: cachedRows.slice(0, RUMBLE_TARGET), reason: '', cacheUsed: true, fallbackUsed: true };
    return { provider: 'rumble', enabled: true, streams: [], reason: 'empty_result' };
  } catch (error) {
    console.error('[live-hub] Rumble discovery failed', text(error?.message, 'unknown'));
    if (cachedRows.length) return { provider: 'rumble', enabled: true, streams: cachedRows.slice(0, RUMBLE_TARGET), reason: '', cacheUsed: true, fallbackUsed: true };
    return { provider: 'rumble', enabled: true, streams: [], reason: 'provider_error', error: 'Rumble LIVE discovery is temporarily unavailable.' };
  }
}

function interleaveProviders(groups, limit) {
  const result = [];
  const max = Math.max(0, ...groups.map(group => group.length));
  for (let i = 0; i < max && result.length < limit; i += 1) {
    for (const group of groups) {
      if (group[i]) result.push(group[i]);
      if (result.length >= limit) break;
    }
  }
  return result.slice(0, limit);
}

function providerState(result, rows, counts) {
  return {
    enabled: Boolean(result.enabled),
    available: counts[result.provider] || 0,
    fetched: rows.length,
    reason: result.reason || '',
    error: result.error || '',
    fallbackUsed: Boolean(result.fallbackUsed),
    cacheUsed: Boolean(result.cacheUsed)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requested = clampLimit(req.query?.limit);
  const [youtube, kick, twitch, rumble] = await Promise.all([loadYouTube(), loadKick(), loadTwitch(), loadRumble()]);
  const ytRows = focusLanguages(youtube.streams || [], YOUTUBE_TARGET);
  const kickRows = focusLanguages(kick.streams || [], KICK_TARGET);
  const twitchRows = focusLanguages(twitch.streams || [], TWITCH_TARGET);
  const rumbleRows = (rumble.streams || []).slice(0, RUMBLE_TARGET);
  const streams = interleaveProviders([ytRows, kickRows, twitchRows, rumbleRows], requested);
  const counts = streams.reduce((map, stream) => { map[stream.provider] = (map[stream.provider] || 0) + 1; return map; }, {});
  const providers = {
    youtube: providerState(youtube, ytRows, counts),
    kick: providerState(kick, kickRows, counts),
    twitch: providerState(twitch, twitchRows, counts),
    rumble: providerState(rumble, rumbleRows, counts)
  };

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).json({ streams, providers, generatedAt: new Date().toISOString() });
}
