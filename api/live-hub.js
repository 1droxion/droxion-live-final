const DEFAULT_LIMIT = 90;
const MAX_LIMIT = 200;
const REQUEST_TIMEOUT_MS = 8000;
const LIVE_HUB_CACHE_SECONDS = 3600;
const LIVE_HUB_STALE_SECONDS = 21600;
const YOUTUBE_TARGET_LIMIT = 100;
const TWITCH_TARGET_LIMIT = 50;
const KICK_TARGET_LIMIT = 50;
const ISHOWSPEED_CHANNEL_ID = 'UCWsDFcIhY2DBi3GB5uykGXA';

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
let youtubeRequest = null;

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

async function fetchText(url, init = {}) {
  const timeout = timeoutSignal();
  try {
    const response = await fetch(url, { ...init, signal: timeout.signal, redirect: 'follow' });
    if (!response.ok) {
      let hostname = 'provider';
      try { hostname = new URL(url).hostname; } catch {}
      throw new Error(`HTTP ${response.status} from ${hostname}`);
    }
    return { body: await response.text(), finalUrl: response.url || String(url) };
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

function selectBalancedStreams(results, limit) {
  const groups = results
    .map(result => ({ provider: result.provider, streams: sortStreams(result.streams || []) }))
    .filter(group => group.streams.length > 0);

  if (!groups.length) return [];

  const selected = [];
  const selectedIds = new Set();
  const baseQuota = Math.max(1, Math.floor(limit / groups.length));

  for (const group of groups) {
    for (const stream of group.streams.slice(0, baseQuota)) {
      if (selectedIds.has(stream.id)) continue;
      selected.push(stream);
      selectedIds.add(stream.id);
    }
  }

  if (selected.length < limit) {
    const remaining = sortStreams(groups.flatMap(group => group.streams).filter(stream => !selectedIds.has(stream.id)));
    for (const stream of remaining) {
      if (selected.length >= limit) break;
      selected.push(stream);
      selectedIds.add(stream.id);
    }
  }

  return sortStreams(selected).slice(0, limit);
}

function youtubeSearchUrl(apiKey, limit, { fallback = false } = {}) {
  const search = new URL('https://www.googleapis.com/youtube/v3/search');
  search.searchParams.set('part', 'snippet');
  search.searchParams.set('type', 'video');
  search.searchParams.set('eventType', 'live');
  search.searchParams.set('maxResults', String(Math.min(50, limit)));
  search.searchParams.set('key', apiKey);

  if (fallback) {
    search.searchParams.set('order', 'relevance');
    search.searchParams.set('q', 'live');
  } else {
    search.searchParams.set('videoEmbeddable', 'true');
    search.searchParams.set('order', 'viewCount');
  }
  return search;
}

function normalizeYouTubeStream(videoId, snippet = {}, live = {}, status = {}) {
  if (!videoId || status?.embeddable === false || live?.actualEndTime) return null;
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
    language: text(snippet?.defaultAudioLanguage || snippet?.defaultLanguage),
    viewerCount: number(live?.concurrentViewers),
    startedAt: text(live?.actualStartTime),
    thumbnailUrl: text(snippet?.thumbnails?.maxres?.url || snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url),
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    embedType: 'youtube',
    isMature: false
  };
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

function decodeHtml(value) {
  return text(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
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
  const overlays = Array.isArray(renderer.thumbnailOverlays) ? renderer.thumbnailOverlays : [];
  const liveOverlay = overlays.find(item => item?.thumbnailOverlayTimeStatusRenderer?.style === 'LIVE');
  const viewerText = youtubeText(renderer.viewCountText) || youtubeText(liveOverlay?.thumbnailOverlayTimeStatusRenderer?.text);
  const thumbnails = Array.isArray(renderer?.thumbnail?.thumbnails) ? renderer.thumbnail.thumbnails : [];
  const thumbnailUrl = text(thumbnails[thumbnails.length - 1]?.url);
  const title = youtubeText(renderer.title) || 'LIVE on YouTube';
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
    thumbnailUrl,
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

  while (stack.length && found.length < limit && inspected < 100000) {
    const node = stack.pop();
    inspected += 1;
    if (!node || typeof node !== 'object') continue;

    const renderer = node.videoRenderer || node.gridVideoRenderer || node.compactVideoRenderer || (node.videoId ? node : null);
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

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${escaped}["']`, 'i')
  ];
  for (const pattern of patterns) {
    const match = String(html || '').match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return '';
}

function speedWatchStream(html, finalUrl) {
  const source = String(html || '');
  const liveNow = /itemprop=["']isLiveBroadcast["'][^>]+content=["']True["']/i.test(source)
    || /"isLiveContent"\s*:\s*true/.test(source)
    || /"isLiveNow"\s*:\s*true/.test(source);
  if (!liveNow) return null;
  let videoId = '';
  try { videoId = text(new URL(finalUrl).searchParams.get('v')); } catch {}
  if (!videoId) {
    const canonical = source.match(/<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*[?&]v=([A-Za-z0-9_-]{11})/i);
    videoId = text(canonical?.[1]);
  }
  if (!videoId) videoId = text(source.match(/"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/)?.[1]);
  if (!videoId) return null;
  const title = metaContent(source, 'og:title') || metaContent(source, 'title') || 'IShowSpeed LIVE';
  const thumbnailUrl = metaContent(source, 'og:image');
  const viewCount = text(source.match(/"viewCount"\s*:\s*"([0-9]+)"/)?.[1]);
  return {
    id: `youtube:${videoId}`,
    provider: 'youtube',
    providerLabel: 'YouTube',
    externalId: videoId,
    channelId: ISHOWSPEED_CHANNEL_ID,
    channelSlug: '',
    creatorName: 'IShowSpeed',
    title,
    category: normalizeCategory(`${title} IShowSpeed`),
    language: '',
    viewerCount: number(viewCount),
    startedAt: '',
    thumbnailUrl,
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    embedType: 'youtube',
    isMature: false
  };
}

async function youtubeWebPageStreams(url, limit, { speedPage = false } = {}) {
  const { body, finalUrl } = await fetchText(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const initialData = extractInitialData(body);
  const streams = collectYouTubeWebStreams(initialData, limit);
  if (speedPage) {
    const speed = speedWatchStream(body, finalUrl);
    if (speed) streams.unshift(speed);
  }
  return streams;
}

async function youtubeDetails(apiKey, ids) {
  const unique = [...new Set((ids || []).map(text).filter(Boolean))];
  if (!apiKey || !unique.length) return [];
  const chunks = [];
  for (let index = 0; index < unique.length; index += 50) chunks.push(unique.slice(index, index + 50));
  const groups = await Promise.all(chunks.map(async chunk => {
    const details = new URL('https://www.googleapis.com/youtube/v3/videos');
    details.searchParams.set('part', 'snippet,liveStreamingDetails,statistics,status');
    details.searchParams.set('id', chunk.join(','));
    details.searchParams.set('key', apiKey);
    const data = await fetchJson(details);
    return (Array.isArray(data?.items) ? data.items : [])
      .filter(item => item?.liveStreamingDetails?.actualStartTime && !item?.liveStreamingDetails?.actualEndTime)
      .map(item => normalizeYouTubeStream(text(item?.id), item?.snippet || {}, item?.liveStreamingDetails || {}, item?.status || {}))
      .filter(Boolean);
  }));
  return groups.flat();
}

function mergeYouTubeStreams(streams, limit) {
  const map = new Map();
  for (const stream of streams || []) {
    if (!stream?.id) continue;
    const existing = map.get(stream.id);
    if (!existing || number(stream.viewerCount) > number(existing.viewerCount) || (!existing.channelId && stream.channelId)) map.set(stream.id, stream);
  }

  const speedStreams = [...map.values()].filter(stream => stream.channelId === ISHOWSPEED_CHANNEL_ID || text(stream.creatorName).toLowerCase() === 'ishowspeed');
  const speed = sortStreams(speedStreams)[0] || null;
  const withoutExtraSpeed = sortStreams([...map.values()].filter(stream => !(stream.channelId === ISHOWSPEED_CHANNEL_ID || text(stream.creatorName).toLowerCase() === 'ishowspeed')));
  const selected = withoutExtraSpeed.slice(0, limit);
  if (speed) {
    if (selected.length >= limit) selected[selected.length - 1] = speed;
    else selected.push(speed);
  }
  return sortStreams(selected);
}

async function loadYouTubeLowQuota(apiKey, limit) {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,liveStreamingDetails,status');
  url.searchParams.set('chart', 'mostPopular');
  url.searchParams.set('maxResults', String(Math.min(50, limit)));
  url.searchParams.set('key', apiKey);
  const data = await fetchJson(url);
  const streams = (Array.isArray(data?.items) ? data.items : [])
    .filter(item => item?.liveStreamingDetails?.actualStartTime && !item?.liveStreamingDetails?.actualEndTime)
    .map(item => normalizeYouTubeStream(text(item?.id), item?.snippet || {}, item?.liveStreamingDetails || {}, item?.status || {}))
    .filter(Boolean);
  return streams;
}

async function loadYouTubeFresh(limit) {
  const target = Math.min(YOUTUBE_TARGET_LIMIT, Math.max(1, limit));
  const apiKey = text(process.env.YOUTUBE_DATA_API_KEY || process.env.YOUTUBE_API_KEY);
  const webUrls = [
    'https://www.youtube.com/live',
    'https://www.youtube.com/results?search_query=live',
    'https://www.youtube.com/results?search_query=gaming+live',
    'https://www.youtube.com/results?search_query=music+live',
    'https://www.youtube.com/results?search_query=sports+live',
    'https://www.youtube.com/results?search_query=news+live',
    'https://www.youtube.com/results?search_query=irl+live'
  ];

  const webGroups = await Promise.all(webUrls.map(url => youtubeWebPageStreams(url, 35).catch(() => [])));
  const speedGroup = await youtubeWebPageStreams(`https://www.youtube.com/channel/${ISHOWSPEED_CHANNEL_ID}/live`, 12, { speedPage: true }).catch(() => []);
  let streams = [...speedGroup, ...webGroups.flat()];
  let usedFallback = false;
  let lowQuotaFallback = false;
  let searchError = null;

  if (apiKey) {
    try {
      let searchData = await fetchJson(youtubeSearchUrl(apiKey, Math.min(50, target)));
      let items = Array.isArray(searchData?.items) ? searchData.items : [];
      if (!items.length) {
        searchData = await fetchJson(youtubeSearchUrl(apiKey, Math.min(50, target), { fallback: true }));
        items = Array.isArray(searchData?.items) ? searchData.items : [];
        usedFallback = true;
      }
      const apiIds = [...new Set(items.map(item => text(item?.id?.videoId)).filter(Boolean))];
      let detailed = [];
      try { detailed = await youtubeDetails(apiKey, apiIds); }
      catch { detailed = []; }
      const detailMap = new Map(detailed.map(stream => [stream.externalId, stream]));
      const apiStreams = items.map(item => {
        const videoId = text(item?.id?.videoId);
        return detailMap.get(videoId) || normalizeYouTubeStream(videoId, item?.snippet || {}, {}, {});
      }).filter(Boolean);
      streams.push(...apiStreams, ...detailed);
    } catch (error) {
      searchError = error;
      usedFallback = true;
      try {
        const lowQuotaStreams = await loadYouTubeLowQuota(apiKey, target);
        if (lowQuotaStreams.length) {
          streams.push(...lowQuotaStreams);
          lowQuotaFallback = true;
        }
      } catch {}
    }

    const webIds = [...new Set(streams.map(stream => stream?.externalId).filter(Boolean))].slice(0, 150);
    try {
      const validated = await youtubeDetails(apiKey, webIds);
      if (validated.length) streams.push(...validated);
    } catch {}
  } else {
    usedFallback = true;
  }

  const merged = mergeYouTubeStreams(streams, target);
  return {
    provider: 'youtube',
    enabled: true,
    streams: merged,
    reason: merged.length ? '' : 'provider_error',
    error: merged.length ? '' : (searchError ? 'YouTube LIVE discovery is temporarily unavailable.' : 'No YouTube LIVE streams found in this refresh.'),
    fallbackUsed: usedFallback || webGroups.some(group => group.length > 0),
    lowQuotaFallback
  };
}

async function loadYouTube(limit) {
  if (youtubeRequest) return youtubeRequest;
  youtubeRequest = loadYouTubeFresh(limit).finally(() => {
    youtubeRequest = null;
  });
  return youtubeRequest;
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
    twitchTokenCache = { token, expiresAt: now + Math.max(60, number(data?.expires_in, 3600)) * 1000 };
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
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId }
  });

  const streams = (Array.isArray(data?.data) ? data.data : []).map(item => {
    const login = text(item?.user_login);
    const thumbnail = text(item?.thumbnail_url).replace('{width}', '1280').replace('{height}', '720');
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
      thumbnailUrl: thumbnail,
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
  if (token) {
    kickTokenCache = { token, expiresAt: now + Math.max(60, number(data?.expires_in, 3600)) * 1000 };
  }
  return token;
}

function kickSlug(item) {
  return text(item?.slug || item?.broadcaster?.slug || item?.broadcaster?.username || item?.broadcaster_user_name || item?.channel?.slug || item?.channel?.username);
}

function kickCreatorName(item, slug) {
  return text(item?.broadcaster?.username || item?.broadcaster_user_name || item?.channel?.username || item?.channel?.user?.username, slug || 'Kick creator');
}

function kickThumbnail(item) {
  const value = item?.thumbnail;
  if (typeof value === 'string') return text(value);
  return text(value?.url || item?.thumbnail_url || item?.channel?.livestream?.thumbnail?.url || item?.channel?.livestream?.thumbnail_url);
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
  try { data = await request('v2'); }
  catch { data = await request('v1'); }

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
      language: text(item?.language || item?.language_code || item?.channel?.language),
      viewerCount: number(item?.viewer_count || item?.viewers),
      startedAt: text(item?.started_at || item?.created_at),
      thumbnailUrl: kickThumbnail(item),
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

  const limit = clampLimit(req.query?.limit);
  const expandedDiscovery = limit >= 150;
  const youtubeLimit = expandedDiscovery ? YOUTUBE_TARGET_LIMIT : Math.min(YOUTUBE_TARGET_LIMIT, Math.max(16, Math.ceil(limit / 3) + 12));
  const twitchLimit = expandedDiscovery ? TWITCH_TARGET_LIMIT : Math.min(TWITCH_TARGET_LIMIT, Math.max(16, Math.ceil(limit / 3) + 12));
  const kickLimit = expandedDiscovery ? KICK_TARGET_LIMIT : Math.min(KICK_TARGET_LIMIT, Math.max(16, Math.ceil(limit / 3) + 12));
  const responseLimit = expandedDiscovery ? Math.min(MAX_LIMIT, YOUTUBE_TARGET_LIMIT + TWITCH_TARGET_LIMIT + KICK_TARGET_LIMIT) : limit;

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
    lowQuotaFallback: Boolean(result.lowQuotaFallback)
  }]));

  res.setHeader('Cache-Control', `public, s-maxage=${LIVE_HUB_CACHE_SECONDS}, stale-while-revalidate=${LIVE_HUB_STALE_SECONDS}`);
  return res.status(200).json({ streams, providers, generatedAt: new Date().toISOString() });
}