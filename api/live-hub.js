const MAX_LIMIT = 90;
const REQUEST_TIMEOUT_MS = 6500;

let twitchTokenCache = { token: '', expiresAt: 0 };
let kickTokenCache = { token: '', expiresAt: 0 };

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

function normalizeCategory(value) {
  const source = text(value).toLowerCase();
  if (/game|gaming|esport|fortnite|minecraft|valorant|league|gta|call of duty/.test(source)) return 'Gaming';
  if (/music|dj|concert|song/.test(source)) return 'Music';
  if (/sport|football|soccer|basketball|baseball|cricket|mma|boxing|racing|f1/.test(source)) return 'Sports';
  if (/talk|chat|podcast|news|education|science|technology/.test(source)) return 'Talk';
  if (/irl|travel|outdoor|people|blog|lifestyle|walking/.test(source)) return 'IRL';
  return 'LIVE';
}

async function loadYouTube(limit) {
  const apiKey = text(process.env.YOUTUBE_DATA_API_KEY || process.env.YOUTUBE_API_KEY);
  if (!apiKey) return { provider: 'youtube', enabled: false, streams: [], reason: 'missing_credentials' };

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('eventType', 'live');
  searchUrl.searchParams.set('videoEmbeddable', 'true');
  searchUrl.searchParams.set('order', 'viewCount');
  searchUrl.searchParams.set('maxResults', String(Math.min(50, Math.max(12, limit))));
  searchUrl.searchParams.set('key', apiKey);

  const search = await fetchJson(searchUrl);
  const items = Array.isArray(search?.items) ? search.items : [];
  const ids = items.map(item => text(item?.id?.videoId)).filter(Boolean);

  if (!ids.length) return { provider: 'youtube', enabled: true, streams: [], reason: 'empty_result' };

  const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  detailsUrl.searchParams.set('part', 'snippet,liveStreamingDetails,status');
  detailsUrl.searchParams.set('id', ids.join(','));
  detailsUrl.searchParams.set('key', apiKey);

  const details = await fetchJson(detailsUrl);
  const streams = (Array.isArray(details?.items) ? details.items : [])
    .filter(item => item?.status?.embeddable !== false && !item?.liveStreamingDetails?.actualEndTime)
    .map(item => {
      const id = text(item?.id);
      const snippet = item?.snippet || {};
      const live = item?.liveStreamingDetails || {};
      if (!id) return null;
      return {
        id: `youtube:${id}`,
        provider: 'youtube',
        providerLabel: 'YouTube',
        externalId: id,
        channelId: text(snippet.channelId),
        channelSlug: '',
        creatorName: text(snippet.channelTitle, 'LIVE creator'),
        title: text(snippet.title, 'LIVE now'),
        category: normalizeCategory(`${snippet.title || ''} ${snippet.channelTitle || ''}`),
        language: text(snippet.defaultAudioLanguage || snippet.defaultLanguage),
        viewerCount: number(live.concurrentViewers),
        startedAt: text(live.actualStartTime || snippet.publishedAt),
        thumbnailUrl: text(snippet?.thumbnails?.maxres?.url || snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url),
        watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
        embedType: 'youtube',
        isMature: false
      };
    })
    .filter(Boolean);

  return { provider: 'youtube', enabled: true, streams, reason: streams.length ? '' : 'empty_result' };
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
  if (!token) throw new Error('Could not obtain Twitch token');

  const url = new URL('https://api.twitch.tv/helix/streams');
  url.searchParams.set('first', String(Math.min(100, Math.max(12, limit))));

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
        providerLabel: 'Twitch',
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

  return { provider: 'twitch', enabled: true, streams, reason: streams.length ? '' : 'empty_result' };
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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
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

async function loadKick(limit) {
  const clientId = text(process.env.KICK_CLIENT_ID);
  const clientSecret = text(process.env.KICK_CLIENT_SECRET);
  if (!clientId || !clientSecret) return { provider: 'kick', enabled: false, streams: [], reason: 'missing_credentials' };

  const token = await getKickToken();
  if (!token) throw new Error('Could not obtain Kick token');

  const request = async version => {
    const url = new URL(`https://api.kick.com/public/${version}/livestreams`);
    url.searchParams.set('limit', String(Math.min(50, Math.max(12, limit))));
    return fetchJson(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
  };

  let data;
  try {
    data = await request('v2');
  } catch {
    data = await request('v1');
  }

  const streams = (Array.isArray(data?.data) ? data.data : [])
    .map(item => {
      const slug = kickSlug(item);
      if (!slug) return null;

      const category = item?.category || item?.categories?.[0] || {};
      const channelId = text(
        item?.broadcaster_user_id ||
        item?.channel_id ||
        item?.broadcaster?.id ||
        item?.channel?.user_id ||
        item?.channel?.user?.id
      );
      const thumbnail = typeof item?.thumbnail === 'string'
        ? text(item.thumbnail)
        : text(item?.thumbnail?.url || item?.thumbnail_url || item?.channel?.livestream?.thumbnail?.url || item?.channel?.livestream?.thumbnail_url);

      return {
        id: `kick:${text(item?.id || item?.livestream_id) || slug}`,
        provider: 'kick',
        providerLabel: 'Kick',
        externalId: text(item?.id || item?.livestream_id),
        channelId,
        channelSlug: slug,
        creatorName: text(item?.broadcaster?.username || item?.broadcaster_user_name || item?.channel?.username || item?.channel?.user?.username, slug),
        title: text(item?.stream_title || item?.title, 'LIVE now'),
        category: normalizeCategory(category?.name || item?.category_name || 'LIVE'),
        language: text(item?.language || item?.language_code || item?.channel?.language),
        viewerCount: number(item?.viewer_count || item?.viewers || item?.concurrent_viewers),
        startedAt: text(item?.started_at || item?.created_at),
        thumbnailUrl: thumbnail,
        watchUrl: `https://kick.com/${encodeURIComponent(slug)}`,
        embedType: 'kick',
        isMature: Boolean(item?.has_mature_content || item?.is_mature)
      };
    })
    .filter(stream => stream && !stream.isMature);

  return { provider: 'kick', enabled: true, streams, reason: streams.length ? '' : 'empty_result' };
}

function providerFailure(provider, error) {
  return {
    provider,
    enabled: true,
    streams: [],
    reason: error?.name === 'AbortError' ? 'provider_timeout' : 'provider_error',
    error: text(error?.message, 'Provider temporarily unavailable')
  };
}

function interleaveProviders(groups, limit) {
  const sorted = groups
    .map(group => [...group].sort((a, b) => number(b.viewerCount) - number(a.viewerCount)))
    .filter(group => group.length);

  const output = [];
  const seen = new Set();
  const max = Math.max(0, ...sorted.map(group => group.length));

  for (let i = 0; i < max && output.length < limit; i += 1) {
    for (const group of sorted) {
      const stream = group[i];
      if (!stream?.id || seen.has(stream.id)) continue;
      seen.add(stream.id);
      output.push(stream);
      if (output.length >= limit) break;
    }
  }

  return output;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = clampLimit(req.query?.limit);
  const perProvider = Math.max(12, Math.ceil(limit / 3));

  const [youtube, twitch, kick] = await Promise.all([
    loadYouTube(perProvider).catch(error => providerFailure('youtube', error)),
    loadTwitch(perProvider).catch(error => providerFailure('twitch', error)),
    loadKick(perProvider).catch(error => providerFailure('kick', error))
  ]);

  const streams = interleaveProviders(
    [youtube.streams || [], twitch.streams || [], kick.streams || []],
    limit
  );

  const providers = Object.fromEntries(
    [youtube, twitch, kick].map(result => [
      result.provider,
      {
        enabled: Boolean(result.enabled),
        available: (result.streams || []).length,
        reason: result.reason || '',
        error: result.error || ''
      }
    ])
  );

  res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=180');
  return res.status(200).json({
    streams,
    providers,
    generatedAt: new Date().toISOString()
  });
}
