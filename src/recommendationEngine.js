const STORAGE_KEY = 'droxion.recommendation-profile.v1';
const MAX_AFFINITY = 40;
const PROFILE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const ACTION_WEIGHTS = {
  impression: 0.05,
  view: 1,
  open: 2.5,
  watch: 4,
  watchLong: 7,
  like: 5,
  follow: 8,
  comment: 5,
  share: 7,
};

function now() {
  return Date.now();
}

function emptyProfile() {
  return {
    updatedAt: now(),
    providers: {},
    categories: {},
    creators: {},
    topics: {},
  };
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readProfile() {
  if (typeof window === 'undefined') return emptyProfile();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyProfile();
    if (now() - safeNumber(parsed.updatedAt) > PROFILE_TTL_MS) return emptyProfile();
    return {
      ...emptyProfile(),
      ...parsed,
      providers: parsed.providers || {},
      categories: parsed.categories || {},
      creators: parsed.creators || {},
      topics: parsed.topics || {},
    };
  } catch {
    return emptyProfile();
  }
}

function writeProfile(profile) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...profile, updatedAt: now() }));
  } catch {}
}

function bump(bucket, key, amount) {
  const normalized = String(key || '').trim().toLowerCase();
  if (!normalized || !Number.isFinite(amount) || amount === 0) return;
  bucket[normalized] = Math.max(-MAX_AFFINITY, Math.min(MAX_AFFINITY, safeNumber(bucket[normalized]) + amount));
}

function categoryFromText(value) {
  const text = String(value || '').toLowerCase();
  if (/game|gaming|esport|fortnite|minecraft|valorant|league|gta|call of duty|roblox/.test(text)) return 'gaming';
  if (/music|song|dj|concert|rap|hip hop|singer/.test(text)) return 'music';
  if (/sport|football|soccer|basketball|baseball|cricket|mma|boxing|nfl|nba/.test(text)) return 'sports';
  if (/irl|travel|outdoor|life|vlog|food|street/.test(text)) return 'irl';
  if (/talk|chat|podcast|news|interview|education|science|technology/.test(text)) return 'talk';
  return '';
}

function topicTokens(value) {
  const stop = new Set(['live', 'stream', 'streaming', 'the', 'and', 'for', 'with', 'from', 'this', 'that', 'now', 'official']);
  return [...new Set(String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 4 && token.length <= 24 && !stop.has(token)))]
    .slice(0, 6);
}

export function recordLiveBehavior(stream, action = 'open') {
  if (!stream) return;
  const weight = ACTION_WEIGHTS[action] || 0;
  if (!weight) return;
  const profile = readProfile();
  bump(profile.providers, stream.provider, weight * 0.75);
  bump(profile.categories, stream.category, weight);
  bump(profile.creators, `${stream.provider}:${stream.channelId || stream.channelSlug || stream.creatorName || ''}`, weight * 1.35);
  topicTokens(`${stream.title || ''} ${stream.category || ''}`).forEach(token => bump(profile.topics, token, weight * 0.35));
  writeProfile(profile);
}

export function rankLiveStreams(streams = []) {
  const profile = readProfile();
  const current = now();
  return [...streams].sort((a, b) => liveScore(b, profile, current) - liveScore(a, profile, current));
}

function liveScore(stream, profile, current) {
  const provider = String(stream?.provider || '').toLowerCase();
  const category = String(stream?.category || '').toLowerCase();
  const creatorKey = `${provider}:${stream?.channelId || stream?.channelSlug || stream?.creatorName || ''}`.toLowerCase();
  const viewerScore = Math.log10(Math.max(1, safeNumber(stream?.viewerCount)) + 1) * 1.7;
  const providerScore = safeNumber(profile.providers[provider]) * 0.22;
  const categoryScore = safeNumber(profile.categories[category]) * 0.34;
  const creatorScore = safeNumber(profile.creators[creatorKey]) * 0.5;
  const topicScore = topicTokens(`${stream?.title || ''} ${stream?.category || ''}`)
    .reduce((sum, token) => sum + safeNumber(profile.topics[token]) * 0.08, 0);
  const started = Date.parse(stream?.startedAt || '');
  const ageMinutes = Number.isFinite(started) ? Math.max(0, (current - started) / 60000) : 240;
  const freshness = Math.max(0, 2.5 - ageMinutes / 180);
  return viewerScore + providerScore + categoryScore + creatorScore + topicScore + freshness;
}

export function recordClipBehavior(clip, action = 'view') {
  if (!clip) return;
  const weight = ACTION_WEIGHTS[action] || 0;
  if (!weight) return;
  const profile = readProfile();
  bump(profile.creators, `droxion:${clip.creator_id || ''}`, weight * 1.35);
  const inferredCategory = categoryFromText(clip.caption || '');
  if (inferredCategory) bump(profile.categories, inferredCategory, weight);
  topicTokens(clip.caption || '').forEach(token => bump(profile.topics, token, weight * 0.4));
  writeProfile(profile);
}

export function rankClips(clips = []) {
  const profile = readProfile();
  const current = now();
  return [...clips].sort((a, b) => clipScore(b, profile, current) - clipScore(a, profile, current));
}

function clipScore(clip, profile, current) {
  const creatorKey = `droxion:${clip?.creator_id || ''}`.toLowerCase();
  const inferredCategory = categoryFromText(clip?.caption || '');
  const creatorScore = safeNumber(profile.creators[creatorKey]) * 0.55;
  const categoryScore = inferredCategory ? safeNumber(profile.categories[inferredCategory]) * 0.28 : 0;
  const topicScore = topicTokens(clip?.caption || '').reduce((sum, token) => sum + safeNumber(profile.topics[token]) * 0.08, 0);
  const engagement = Math.log10(
    Math.max(1,
      safeNumber(clip?.views_count) +
      safeNumber(clip?.likes_count) * 5 +
      safeNumber(clip?.comments_count) * 8 +
      safeNumber(clip?.shares_count) * 12
    ) + 1
  ) * 1.25;
  const published = Date.parse(clip?.published_at || clip?.created_at || '');
  const ageHours = Number.isFinite(published) ? Math.max(0, (current - published) / 3600000) : 168;
  const freshness = Math.max(0, 4 - ageHours / 36);
  const highlight = Math.min(5, safeNumber(clip?.highlight_score) / 20);
  return creatorScore + categoryScore + topicScore + engagement + freshness + highlight;
}
