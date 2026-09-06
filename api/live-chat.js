const REQUEST_TIMEOUT_MS = 8000;
const MIN_POLL_MS = 3000;
const MAX_POLL_MS = 15000;

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function clampPoll(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5000;
  return Math.max(MIN_POLL_MS, Math.min(MAX_POLL_MS, parsed));
}

function timeoutSignal(ms = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function fetchJson(url) {
  const timeout = timeoutSignal();
  try {
    const response = await fetch(url, { signal: timeout.signal, headers: { Accept: 'application/json' } });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const reason = text(data?.error?.errors?.[0]?.reason || data?.error?.status || data?.error?.message, `HTTP ${response.status}`);
      const error = new Error(reason);
      error.status = response.status;
      error.reason = reason;
      throw error;
    }
    return data;
  } finally {
    timeout.done();
  }
}

function unavailable(res, reason, status = 200) {
  return res.status(status).json({
    provider: 'youtube',
    available: false,
    reason,
    messages: [],
    pollingIntervalMillis: 10000,
  });
}

function normalizeYouTubeMessage(item) {
  const snippet = item?.snippet || {};
  const author = item?.authorDetails || {};
  const type = text(snippet?.type, 'textMessageEvent');
  const displayMessage = text(
    snippet?.displayMessage ||
    snippet?.textMessageDetails?.messageText ||
    snippet?.superChatDetails?.userComment ||
    snippet?.memberMilestoneChatDetails?.userComment ||
    snippet?.superStickerDetails?.superStickerMetadata?.altText
  );
  const amountDisplayString = text(
    snippet?.superChatDetails?.amountDisplayString ||
    snippet?.superStickerDetails?.amountDisplayString ||
    snippet?.fanFundingEventDetails?.amountDisplayString
  );

  return {
    id: text(item?.id),
    provider: 'youtube',
    type,
    authorId: text(author?.channelId || snippet?.authorChannelId),
    authorName: text(author?.displayName, 'YouTube user'),
    avatarUrl: text(author?.profileImageUrl),
    message: displayMessage,
    publishedAt: text(snippet?.publishedAt),
    hasDisplayContent: snippet?.hasDisplayContent !== false && Boolean(displayMessage || amountDisplayString),
    isOwner: Boolean(author?.isChatOwner),
    isModerator: Boolean(author?.isChatModerator),
    isMember: Boolean(author?.isChatSponsor),
    isVerified: Boolean(author?.isVerified),
    amountDisplayString,
  };
}

async function getActiveLiveChatId(videoId, apiKey) {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'liveStreamingDetails');
  url.searchParams.set('id', videoId);
  url.searchParams.set('key', apiKey);
  const data = await fetchJson(url);
  return text(data?.items?.[0]?.liveStreamingDetails?.activeLiveChatId);
}

async function loadYouTubeChat({ videoId, liveChatId, pageToken, apiKey }) {
  const resolvedChatId = liveChatId || await getActiveLiveChatId(videoId, apiKey);
  if (!resolvedChatId) {
    return {
      provider: 'youtube',
      available: false,
      reason: 'live_chat_unavailable',
      liveChatId: '',
      messages: [],
      pollingIntervalMillis: 10000,
    };
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/liveChat/messages');
  url.searchParams.set('liveChatId', resolvedChatId);
  url.searchParams.set('part', 'id,snippet,authorDetails');
  url.searchParams.set('maxResults', '200');
  url.searchParams.set('profileImageSize', '32');
  url.searchParams.set('key', apiKey);
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const data = await fetchJson(url);
  const messages = (Array.isArray(data?.items) ? data.items : [])
    .map(normalizeYouTubeMessage)
    .filter(message => message.id && message.hasDisplayContent);

  return {
    provider: 'youtube',
    available: true,
    reason: '',
    liveChatId: resolvedChatId,
    nextPageToken: text(data?.nextPageToken),
    pollingIntervalMillis: clampPoll(data?.pollingIntervalMillis),
    offlineAt: text(data?.offlineAt),
    messages,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const provider = text(req.query?.provider).toLowerCase();
  if (provider !== 'youtube') return res.status(400).json({ error: 'Unsupported chat provider' });

  const videoId = text(req.query?.videoId);
  const liveChatId = text(req.query?.liveChatId);
  const pageToken = text(req.query?.pageToken);
  if (!videoId && !liveChatId) return res.status(400).json({ error: 'Missing YouTube video ID' });

  const apiKey = text(process.env.YOUTUBE_DATA_API_KEY || process.env.YOUTUBE_API_KEY);
  if (!apiKey) return unavailable(res, 'missing_credentials');

  try {
    const payload = await loadYouTubeChat({ videoId, liveChatId, pageToken, apiKey });
    return res.status(200).json(payload);
  } catch (error) {
    const reason = text(error?.reason || error?.message, 'youtube_chat_error');
    if (/liveChatDisabled|liveChatEnded|liveChatNotFound|forbidden/i.test(reason)) {
      return unavailable(res, reason);
    }
    console.error('[live-chat] YouTube request failed', reason);
    return res.status(502).json({
      provider: 'youtube',
      available: false,
      reason: 'provider_error',
      error: 'YouTube LIVE chat temporarily unavailable',
      messages: [],
      pollingIntervalMillis: 10000,
    });
  }
}
