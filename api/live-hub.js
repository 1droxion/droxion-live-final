import { readProviderCache, writeProviderCache } from '../server/external-live-cache.js';
import { MANUAL_APPROVED_WOMEN } from '../config/approved-women-live.js';

const MAX_LIMIT = 300;
const MIN_LIVE_VIEWERS = 1000;
const YOUTUBE_TARGET = 150;
const YOUTUBE_DISCOVERY_TARGET = 250;
const YOUTUBE_DISCOVERY_CACHE_MS = 6 * 60 * 60 * 1000;
const YOUTUBE_LIVE_CACHE_MS = 5 * 60 * 1000;
const KICK_TARGET = 90;
const TWITCH_TARGET = 60;
const RUMBLE_TARGET = 40;
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


function ageFromDateOfBirth(value) {
  if (!value) return 0;
  const birth = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

async function supabaseRest(path) {
  const base = text(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/$/, '');
  const key = text(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
  if (!base || !key) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`${base}/rest/v1/${path}`, {
      signal: controller.signal,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json'
      }
    });
    if (!response.ok) return [];
    const data = await response.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function approvedKey(provider, value) {
  const p = text(provider).toLowerCase();
  const v = text(value).toLowerCase();
  return p && v ? `${p}:${v}` : '';
}

async function loadApprovedWomenKeys() {
  const keys = new Set();

  for (const row of Array.isArray(MANUAL_APPROVED_WOMEN) ? MANUAL_APPROVED_WOMEN : []) {
    const provider = text(row?.provider).toLowerCase();
    for (const value of [row?.channelId, row?.channelSlug, row?.externalId, row?.creatorName]) {
      const key = approvedKey(provider, value);
      if (key) keys.add(key);
    }
  }

  const connections = await supabaseRest(
    'droxion_creator_platform_connections?select=user_id,provider,channel_identifier,enabled,verified&enabled=eq.true&verified=eq.true'
  );
  if (!connections.length) return keys;

  const userIds = [...new Set(connections.map(row => text(row?.user_id)).filter(Boolean))];
  if (!userIds.length) return keys;

  const filter = encodeURIComponent(`in.(${userIds.join(',')})`);
  const [accounts, profiles] = await Promise.all([
    supabaseRest(`droxion_creator_accounts?select=user_id,status&user_id=${filter}`),
    supabaseRest(`droxion_profiles?select=user_id,gender,date_of_birth&user_id=${filter}`)
  ]);

  const approvedUsers = new Set(
    accounts
      .filter(row => text(row?.status).toLowerCase() === 'approved')
      .map(row => text(row?.user_id))
  );

  const adultWomen = new Set(
    profiles
      .filter(row => {
        const gender = text(row?.gender).toLowerCase();
        return (gender === 'woman' || gender === 'female') && ageFromDateOfBirth(row?.date_of_birth) >= 18;
      })
      .map(row => text(row?.user_id))
  );

  for (const row of connections) {
    const userId = text(row?.user_id);
    if (!approvedUsers.has(userId) || !adultWomen.has(userId)) continue;
    const key = approvedKey(row?.provider, row?.channel_identifier);
    if (key) keys.add(key);
  }

  return keys;
}

function isApprovedWomanStream(stream, approvedKeys) {
  if (!stream) return false;

  if (
    stream.partnerVerified === true &&
    stream.approvedWoman === true &&
    stream.adultVerified === true
  ) {
    return true;
  }

  if (!(approvedKeys instanceof Set) || approvedKeys.size === 0) return false;

  const provider = text(stream.provider).toLowerCase();
  return [
    stream.channelId,
    stream.channelSlug,
    stream.externalId,
    stream.creatorName
  ].some(value => approvedKeys.has(approvedKey(provider, value)));
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

async function enrichYouTubeViewers(apiKey, rows) {
  const result = [];
  const list = Array.isArray(rows) ? rows : [];

  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    const ids = batch.map(row => row.externalId).filter(Boolean);

    if (!ids.length) continue;

    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'liveStreamingDetails');
    url.searchParams.set('id', ids.join(','));
    url.searchParams.set('key', apiKey);

    const data = await fetchJson(url);
    const viewers = new Map();

    for (const item of data?.items || []) {
      viewers.set(
        String(item.id),
        number(item?.liveStreamingDetails?.concurrentViewers)
      );
    }

    for (const row of batch) {
      result.push({
        ...row,
        viewerCount: viewers.get(String(row.externalId)) || 0
      });
    }
  }

  return result;
}

async function loadYouTube() {
  const apiKey = text(
    process.env.YOUTUBE_DATA_API_KEY ||
    process.env.YOUTUBE_API_KEY
  );

  if (!apiKey) {
    return {
      provider: 'youtube',
      enabled: false,
      streams: [],
      reason: 'missing_credentials'
    };
  }

  const liveCached = await readProviderCache('youtube-live-v4').catch(() => null);
  const liveCachedRows = Array.isArray(liveCached?.payload)
    ? liveCached.payload
    : [];

  const liveAge = liveCached?.updatedAt
    ? Date.now() - Date.parse(liveCached.updatedAt)
    : Infinity;

  if (liveCachedRows.length && liveAge < YOUTUBE_LIVE_CACHE_MS) {
    return {
      provider: 'youtube',
      enabled: true,
      streams: focusLanguages(liveCachedRows, YOUTUBE_TARGET),
      cacheUsed: true
    };
  }

  const discoveryCached = await readProviderCache(
    'youtube-discovery-v5'
  ).catch(() => null);

  const discoveryCachedRows = Array.isArray(discoveryCached?.payload)
    ? discoveryCached.payload
    : [];

  const legacyCached = await readProviderCache(
    'youtube-balanced-v3'
  ).catch(() => null);

  const legacyRows = Array.isArray(legacyCached?.payload)
    ? legacyCached.payload
    : [];

  let discovered = discoveryCachedRows.length
    ? discoveryCachedRows
    : legacyRows;

  const sourceCache = discoveryCachedRows.length
    ? discoveryCached
    : legacyCached;

  const discoveryAge = sourceCache?.updatedAt
    ? Date.now() - Date.parse(sourceCache.updatedAt)
    : Infinity;

  let fallbackUsed = false;

  if (!discoveryCachedRows.length || discoveryAge >= YOUTUBE_DISCOVERY_CACHE_MS) {
    try {
      const [
  general,
  gaming,
  music,
  sports,
  irl,
  hindi
] = await Promise.all([
  fetchYouTubeGroup(
    apiKey,
    { region: 'US', language: 'en' },
    50
  ),

  fetchYouTubeGroup(
    apiKey,
    { region: 'US', language: 'en', q: 'gaming live' },
    50
  ),

  fetchYouTubeGroup(
    apiKey,
    { region: 'US', language: 'en', q: 'music live' },
    40
  ),

  fetchYouTubeGroup(
    apiKey,
    { region: 'US', language: 'en', q: 'sports live' },
    40
  ),

  fetchYouTubeGroup(
    apiKey,
    { region: 'US', language: 'en', q: 'IRL live' },
    40
  ),

  fetchYouTubeGroup(
    apiKey,
    { region: 'IN', language: 'hi', q: 'हिंदी live' },
    30
  )
]);

const fresh = mergeUnique(
  [
    ...general,
    ...gaming,
    ...music,
    ...sports,
    ...irl,
    ...hindi
  ],
  YOUTUBE_DISCOVERY_TARGET
);

      if (fresh.length) {
        discovered = fresh;

        await writeProviderCache(
          'youtube-discovery-v5',
          fresh
        ).catch(() => {});
      }
    } catch (error) {
      console.error(
        '[live-hub] YouTube search refresh failed',
        text(error?.message, 'unknown')
      );

      fallbackUsed = true;
    }
  }

  if (!discovered.length) {
    return {
      provider: 'youtube',
      enabled: true,
      streams: [],
      reason: 'empty_result'
    };
  }

  try {
    const withViewers = await enrichYouTubeViewers(
      apiKey,
      discovered
    );

    const streams = focusLanguages(
      withViewers.filter(
        stream => number(stream.viewerCount) > 0
      ),
      YOUTUBE_TARGET
    );

    if (streams.length) {
      await writeProviderCache(
        'youtube-live-v4',
        streams
      ).catch(() => {});
    }

    return {
      provider: 'youtube',
      enabled: true,
      streams,
      reason: streams.length ? '' : 'empty_result',
      cacheUsed: false,
      fallbackUsed
    };
  } catch (error) {
    console.error(
      '[live-hub] YouTube viewer refresh failed',
      text(error?.message, 'unknown')
    );

    if (liveCachedRows.length) {
      return {
        provider: 'youtube',
        enabled: true,
        streams: focusLanguages(
          liveCachedRows,
          YOUTUBE_TARGET
        ),
        cacheUsed: true,
        fallbackUsed: true
      };
    }

    return {
      provider: 'youtube',
      enabled: true,
      streams: [],
      reason: 'provider_error',
      error: 'YouTube LIVE discovery is temporarily unavailable.'
    };
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
  const slug = text(
    item?.slug ||
    item?.broadcaster?.slug ||
    item?.broadcaster?.username ||
    item?.broadcaster_user_name ||
    item?.channel?.slug ||
    item?.channel?.username
  );

  if (!slug) return null;

  const cat = item?.category || item?.categories?.[0] || {};

  const channelId = text(
    item?.broadcaster_user?.id ||
    item?.broadcaster_user_id ||
    item?.broadcaster?.user_id ||
    item?.broadcaster?.id ||
    item?.channel?.broadcaster_user_id ||
    item?.channel?.user_id ||
    item?.channel?.user?.id ||
    item?.channel_id ||
    item?.user_id
  );

  const thumbnail =
    typeof item?.thumbnail === 'string'
      ? text(item.thumbnail)
      : text(
          item?.thumbnail?.url ||
          item?.thumbnail_url ||
          item?.channel?.livestream?.thumbnail?.url ||
          item?.channel?.livestream?.thumbnail_url
        );

  return {
    id: `kick:${text(item?.id || item?.livestream_id) || slug}`,
    provider: 'kick',
    providerLabel: 'Kick',
    externalId: text(item?.id || item?.livestream_id),
    channelId,
    channelSlug: slug,

    creatorName: text(
      item?.broadcaster_user?.username ||
      item?.broadcaster?.username ||
      item?.broadcaster_user_name ||
      item?.channel?.username ||
      item?.channel?.user?.username,
      slug
    ),

    title: text(item?.stream_title || item?.title, 'LIVE on Kick'),
    category: normalizeCategory(cat?.name || item?.category_name || 'Live'),
    language: text(
      item?.language ||
      item?.language_code ||
      item?.channel?.language
    ),
    viewerCount: number(
  item?.viewer_count ||
  item?.viewers ||
  item?.concurrent_viewers ||
  item?.concurrent_viewer_count ||
  item?.viewerCount ||
  item?.livestream?.viewer_count ||
  item?.livestream?.viewers ||
  item?.channel?.livestream?.viewer_count ||
  item?.channel?.livestream?.viewers
),
    startedAt: text(item?.started_at || item?.created_at),
    thumbnailUrl: thumbnail,
    watchUrl: `https://kick.com/${encodeURIComponent(slug)}`,
    embedType: 'kick',
    isMature: Boolean(item?.has_mature_content || item?.is_mature)
  };
}

async function fetchKickPages(token) {
  const url = new URL('https://api.kick.com/public/v1/livestreams');

  url.searchParams.set('limit', '100');
  url.searchParams.set('sort', 'viewer_count');

  const data = await fetchJson(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  const rows = (Array.isArray(data?.data) ? data.data : [])
    .map(mapKickItem)
    .filter(Boolean);

  return mergeUnique(rows, KICK_TARGET);
}

async function loadKick() {
  const cached = await readProviderCache('kick-balanced-v4').catch(() => null);
  const cachedRows = Array.isArray(cached?.payload) ? cached.payload : [];
  const age = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  if (cachedRows.length >= 45 && age < CACHE_FRESH_MS) return { provider: 'kick', enabled: true, streams: focusLanguages(cachedRows, KICK_TARGET), cacheUsed: true };

  const token = await getKickToken();
  if (!token) return { provider: 'kick', enabled: false, streams: [], reason: 'missing_credentials' };
  try {
    let streams = await fetchKickPages(token);
    streams = focusLanguages(streams, KICK_TARGET);
    if (streams.length) await writeProviderCache('kick-balanced-v4', streams).catch(() => {});
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


async function loadApprovedTwitchStreams(approvedKeys) {
  const clientId = text(process.env.TWITCH_CLIENT_ID);
  const clientSecret = text(process.env.TWITCH_CLIENT_SECRET);
  if (!clientId || !clientSecret) {
    return { provider: 'twitch', enabled: false, streams: [], reason: 'missing_credentials' };
  }

  const handles = [...(approvedKeys || [])]
    .filter(key => key.startsWith('twitch:'))
    .map(key => key.slice('twitch:'.length))
    .filter(value => /^[a-z0-9_]{2,25}$/i.test(value))
    .slice(0, 100);

  if (!handles.length) {
    return { provider: 'twitch', enabled: true, streams: [], reason: 'no_approved_channels' };
  }

  try {
    const token = await getTwitchToken();
    if (!token) throw new Error('missing_token');

    const url = new URL('https://api.twitch.tv/helix/streams');
    handles.forEach(handle => url.searchParams.append('user_login', handle));

    const data = await fetchJson(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': clientId,
        Accept: 'application/json'
      }
    });

    const streams = (Array.isArray(data?.data) ? data.data : [])
      .filter(item => !item?.is_mature)
      .map(item => {
        const login = text(item?.user_login);
        if (!login || !item?.id) return null;
        return {
          id: `twitch:${text(item.id)}`,
          provider: 'twitch',
          providerLabel: '',
          externalId: text(item.id),
          channelId: text(item.user_id),
          channelSlug: login,
          creatorName: text(item.user_name, login),
          title: text(item.title, 'LIVE now'),
          category: normalizeCategory(`${item.game_name || ''} ${item.title || ''}`),
          language: text(item.language),
          viewerCount: number(item.viewer_count),
          startedAt: text(item.started_at),
          thumbnailUrl: text(item.thumbnail_url).replace('{width}', '1280').replace('{height}', '720'),
          watchUrl: `https://www.twitch.tv/${encodeURIComponent(login)}`,
          embedType: 'twitch',
          isMature: false
        };
      })
      .filter(Boolean);

    return {
      provider: 'twitch',
      enabled: true,
      streams,
      reason: streams.length ? '' : 'approved_channels_offline'
    };
  } catch (error) {
    return {
      provider: 'twitch',
      enabled: true,
      streams: [],
      reason: 'provider_error',
      error: text(error?.message, 'Twitch LIVE lookup failed')
    };
  }
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
  const anchorRegex = /<a\b([^>]+)>/gi;
  let match;

  while ((match = anchorRegex.exec(normalized)) && links.length < 120) {
    const attrs = match[1] || '';
    const classMatch = attrs.match(/\bclass\s*=\s*["']([^"']+)["']/i);
    const classes = classMatch?.[1] || '';
    if (!/\b(video-item--a|videostream__link)\b/i.test(classes)) continue;

    const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    const href = decodeHtml(hrefMatch?.[1] || '');
    if (!href || !/^\/?v[\w.-]+\.html(?:\?|$)/i.test(href)) continue;

    try {
      const url = new URL(href, 'https://rumble.com');
      if (url.hostname !== 'rumble.com' && url.hostname !== 'www.rumble.com') continue;
      url.search = '';
      url.hash = '';
      const clean = url.toString();
      if (!seen.has(clean)) {
        seen.add(clean);
        links.push(clean);
      }
    } catch {}
  }

  return links;
}

function rumbleEmbedId(html) {
  const normalized = String(html || '').replace(/\\\//g, '/');
  const direct = normalized.match(/https:\/\/rumble\.com\/embed\/(?:[0-9a-z]+\.)?([0-9a-z]+)\/?/i);
  if (direct?.[1]) return direct[1];
  const player = normalized.match(/\bRumble\(\s*["']play["']\s*,\s*\{[^}]*["']?video["']?\s*:\s*["']([a-z0-9]+)["']/i);
  return text(player?.[1]);
}

async function rumbleIsLive(embedId) {
  if (!embedId) return false;
  try {
    const info = await fetchJson(
      `https://rumble.com/embedJS/u3/?request=video&ver=2&v=${encodeURIComponent(embedId)}`,
      { headers: { Accept: 'application/json' } },
      4500
    );
    return Number(info?.live) === 2;
  } catch {
    return false;
  }
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

  let pageId = '';
  try { pageId = new URL(watchUrl).pathname.split('/').filter(Boolean)[0] || ''; } catch {}
  if (!/^v[a-z0-9]+/i.test(pageId)) return null;

  const embedId = rumbleEmbedId(normalized);
  if (!embedId) return null;

  const title = metaContent(normalized, 'og:title') || metaContent(normalized, 'twitter:title') || 'LIVE on Rumble';
  const thumbnailUrl = metaContent(normalized, 'og:image') || metaContent(normalized, 'twitter:image');
  const creatorName = metaContent(normalized, 'author') || metaContent(normalized, 'article:author') || 'Rumble creator';
  const description = metaContent(normalized, 'og:description');
  const chatMatch = normalized.match(/(?:https:\/\/rumble\.com)?(\/chat\/popup\/[a-z0-9_-]+)/i);
  const viewerMatch = normalized.match(/(?:watching[_ -]?now|viewer[_ -]?count|watching now)[^0-9]{0,80}([0-9][0-9,.]*\s*[kKmM]?)/i);
  const viewerCount = parseCompactCount(viewerMatch?.[1] || '0');

  return {
    id: `rumble:${pageId}`,
    provider: 'rumble',
    providerLabel: 'Rumble',
    externalId: embedId,
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
    embedUrl: `https://rumble.com/embed/${embedId}/`,
    chatUrl: chatMatch?.[1] ? `https://rumble.com${chatMatch[1]}` : '',
    isMature: false
  };
}

async function loadRumble() {
  const cached = await readProviderCache('rumble-public-live-v3').catch(() => null);
  const cachedRows = Array.isArray(cached?.payload) ? cached.payload : [];
  const age = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  if (cachedRows.length >= 5 && age < CACHE_FRESH_MS) return { provider: 'rumble', enabled: true, streams: cachedRows.slice(0, RUMBLE_TARGET), cacheUsed: true };

  try {
    const seedUrls = [
      'https://rumble.com/browse/live',
      'https://rumble.com/browse/live?page=2',
      'https://rumble.com/browse/live?page=3'
    ];    const seedPages = await Promise.allSettled(seedUrls.map(url => fetchHtml(url, 3500)));
    const candidates = [];
    const seen = new Set();
    seedPages.forEach(result => {
      if (result.status !== 'fulfilled') return;
      rumbleLinks(result.value).forEach(url => {
        if (!seen.has(url) && candidates.length < 60) { seen.add(url); candidates.push(url); }
      });
    });

    console.log('[live-hub] Rumble candidates', candidates.length);

    const detailPages = await Promise.allSettled(
      candidates.map(async url => {
        const html = await fetchHtml(url, RUMBLE_TIMEOUT_MS);
        return parseRumblePage(url, html);
      })
    );

    const streams = detailPages
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => result.value)
      .slice(0, RUMBLE_TARGET);

    console.log('[live-hub] Rumble parsed LIVE streams', streams.length);

    if (streams.length) await writeProviderCache('rumble-public-live-v3', streams).catch(() => {});
    if (streams.length) return { provider: 'rumble', enabled: true, streams, reason: '', cacheUsed: false };
    if (cachedRows.length) return { provider: 'rumble', enabled: true, streams: cachedRows.slice(0, RUMBLE_TARGET), reason: '', cacheUsed: true, fallbackUsed: true };
    return { provider: 'rumble', enabled: true, streams: [], reason: 'empty_result' };
  } catch (error) {
    console.error('[live-hub] Rumble discovery failed', text(error?.message, 'unknown'));
    if (cachedRows.length) return { provider: 'rumble', enabled: true, streams: cachedRows.slice(0, RUMBLE_TARGET), reason: '', cacheUsed: true, fallbackUsed: true };
    return { provider: 'rumble', enabled: true, streams: [], reason: 'provider_error', error: 'Rumble LIVE discovery is temporarily unavailable.' };
  }
}


async function loadRumbleCreatorApis() {
  const raw = text(process.env.RUMBLE_LIVESTREAM_API_URLS || process.env.RUMBLE_LIVESTREAM_API_URL);
  const urls = [...new Set(
    raw
      .split(/[\n,;]+/)
      .map(value => value.trim())
      .filter(Boolean)
      .filter(value => {
        try {
          const url = new URL(value);
          return url.protocol === 'https:' && (url.hostname === 'rumble.com' || url.hostname === 'www.rumble.com');
        } catch {
          return false;
        }
      })
  )].slice(0, 50);

  if (!urls.length) {
    return { provider: 'rumble', enabled: true, streams: [], reason: 'creator_api_not_configured' };
  }

  const results = await Promise.allSettled(
    urls.map(async apiUrl => {
      const payload = await fetchJson(apiUrl, { headers: { Accept: 'application/json' } }, 6000);
      const creatorName = text(payload?.username || payload?.channel_name, 'Rumble creator');
      const lives = Array.isArray(payload?.livestreams) ? payload.livestreams : [];

      const rows = await Promise.all(
        lives
          .filter(item => item && item.is_live !== false)
          .slice(0, 10)
          .map(async item => {
            const watchUrl = text(item?.url) || (text(item?.link) ? new URL(text(item.link), 'https://rumble.com').toString() : '');
            let embedUrl = '';

            if (watchUrl) {
              try {
                const html = await fetchHtml(watchUrl, 3500);
                const embedId = rumbleEmbedId(html);
                if (embedId) embedUrl = `https://rumble.com/embed/${embedId}/`;
              } catch {}
            }

            return {
              id: `rumble:api:${text(item?.id || item?.stream_id || watchUrl || item?.title)}`,
              provider: 'rumble',
              providerLabel: 'Rumble',
              externalId: text(item?.id || item?.stream_id),
              channelId: '',
              channelSlug: '',
              creatorName,
              title: text(item?.title, 'LIVE on Rumble'),
              category: normalizeCategory(item?.categories?.primary?.title || item?.categories?.primary?.slug || item?.title || 'Live'),
              language: 'en',
              viewerCount: number(item?.watching_now ?? item?.viewers),
              startedAt: text(item?.created_on || item?.started_at),
              thumbnailUrl: typeof item?.thumbnail === 'string' ? item.thumbnail : text(item?.thumbnail?.url),
              watchUrl,
              embedType: 'rumble',
              embedUrl,
              chatUrl: text(item?.chat?.url),
              isMature: false,
              source: 'rumble_creator_api'
            };
          })
      );

      return rows.filter(row => row.watchUrl || row.embedUrl);
    })
  );

  const streams = mergeUnique(
    results.flatMap(result => result.status === 'fulfilled' ? result.value : []),
    RUMBLE_TARGET
  );

  return {
    provider: 'rumble',
    enabled: true,
    streams,
    reason: streams.length ? '' : 'creator_api_empty',
    cacheUsed: false
  };
}

async function loadRumbleCombined() {
  const [publicFeed, creatorFeed] = await Promise.all([
    loadRumble().catch(() => ({ provider: 'rumble', enabled: true, streams: [], reason: 'public_discovery_unavailable' })),
    loadRumbleCreatorApis().catch(() => ({ provider: 'rumble', enabled: true, streams: [], reason: 'creator_api_error' }))
  ]);

  const streams = mergeUnique(
    [...(creatorFeed.streams || []), ...(publicFeed.streams || [])],
    RUMBLE_TARGET
  );

  return {
    provider: 'rumble',
    enabled: true,
    streams,
    reason: streams.length ? '' : (creatorFeed.reason || publicFeed.reason || 'empty_result'),
    cacheUsed: Boolean(publicFeed.cacheUsed),
    fallbackUsed: Boolean(publicFeed.fallbackUsed)
  };
}


async function loadPartnerProvider(provider) {
  const cached = await readProviderCache(`partner-${provider}-live-v1`).catch(() => null);
  const rows = Array.isArray(cached?.payload) ? cached.payload : [];
  return {
    provider,
    enabled: rows.length > 0,
    streams: rows.slice(0, 80),
    reason: rows.length ? '' : 'awaiting_partner_feed',
    cacheUsed: true
  };
}

async function loadTango() {
  return loadPartnerProvider('tango');
}

async function loadLiveMe() {
  return loadPartnerProvider('liveme');
}

async function loadPoppo() {
  return loadPartnerProvider('poppo');
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

  const [youtube, kick, twitch, rumble, tango, liveme, poppo] = await Promise.all([
    loadYouTube(),
    loadKick(),
    loadTwitch(),
    loadRumbleCombined(),
    loadTango(),
    loadLiveMe(),
    loadPoppo()
  ]);

  const ytRows = focusLanguages(youtube.streams || [], YOUTUBE_TARGET)
    .filter(stream => !stream?.isMature);
  const kickRows = focusLanguages(kick.streams || [], KICK_TARGET)
    .filter(stream => !stream?.isMature);
  const twitchRows = focusLanguages(twitch.streams || [], TWITCH_TARGET)
    .filter(stream => !stream?.isMature);
  const rumbleRows = (rumble.streams || []).filter(stream => !stream?.isMature).slice(0, RUMBLE_TARGET);
  const tangoRows = (tango.streams || []).filter(stream => !stream?.isMature).slice(0, 80);
  const livemeRows = (liveme.streams || []).filter(stream => !stream?.isMature).slice(0, 80);
  const poppoRows = (poppo.streams || []).filter(stream => !stream?.isMature).slice(0, 80);

  const streams = interleaveProviders(
    [ytRows, twitchRows, kickRows, rumbleRows, tangoRows, livemeRows, poppoRows],
    requested
  ).filter(stream => !stream?.isMature);

  const counts = streams.reduce((map, stream) => {
    map[stream.provider] = (map[stream.provider] || 0) + 1;
    return map;
  }, {});

  const providers = {
    youtube: providerState(youtube, ytRows, counts),
    twitch: providerState(twitch, twitchRows, counts),
    kick: providerState(kick, kickRows, counts),
    rumble: providerState(rumble, rumbleRows, counts),
    tango: providerState(tango, tangoRows, counts),
    liveme: providerState(liveme, livemeRows, counts),
    poppo: providerState(poppo, poppoRows, counts)
  };

  res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=180');
  return res.status(200).json({
    streams,
    providers,
    approvedWomenOnly: false,
    publicProviders: ['youtube', 'twitch', 'kick', 'rumble', 'tango', 'liveme', 'poppo'],
    generatedAt: new Date().toISOString()
  });
}

// redeploy-marker: rumble-api-env-2026-09-24
