import { createClient } from "@supabase/supabase-js";
import {
  canCompleteLiveReadReconciliation,
  appendBoundedStableLiveEvent,
  captureLiveReadSubscriptionState,
  liveQueueNeedsAuthoritativeRead,
  liveSafetyReconcileDelay,
  liveGiftReconciliationCursor,
  markLiveQueueForReconciliation,
  replaceBoundedStableLiveEvents,
  stableLiveEventId,
} from "./livekit/reliabilityState";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables.");
}

const client = createClient(supabaseUrl, supabaseAnonKey);
const originalRpc = client.rpc.bind(client);

// High-concurrency LIVE strategy:
// - LiveKit carries video/audio + fast participant events.
// - Supabase Realtime fans out chat/gift/guest-state events.
// - Postgres RPCs remain the authoritative write path and reconciliation path.
// - Safe read polling is coalesced; wallet/gift/message writes are never cached.
const LIVE_READ_TTL_MS = {
  droxion_live_feed: 60000,
  droxion_live_room_status: 60000,
  droxion_live_room_viewers: 30000,
  droxion_live_join_requests: 15000,
  droxion_my_live_join_request: 15000,
  droxion_my_live_invite: 15000,
  droxion_live_creator_summary: 7000,
  droxion_current_live_context: 7000,
};

const readCache = new Map();
const heartbeatCache = new Map();
const liveEventStreams = new Map();
const LIVE_EVENT_RETRY_MS = [500, 1500, 3000, 5000, 10000];

function result(data) {
  return { data, error: null, count: null, status: 200, statusText: "OK" };
}

function stableKey(fn, args) {
  try { return `${fn}:${JSON.stringify(args || {})}`; }
  catch { return `${fn}:uncacheable`; }
}

function notifyLiveEventSubscribers(stream, event) {
  for (const subscriber of stream.subscribers) {
    try { subscriber(event); }
    catch (error) { console.warn("LIVE event subscriber failed", error); }
  }
}

function invalidateGuestStateReads(sessionId) {
  for (const key of readCache.keys()) {
    const sessionRead = key.includes(sessionId) && (
      key.startsWith("droxion_live_room_status:")
      || key.startsWith("droxion_live_join_requests:")
      || key.startsWith("droxion_my_live_join_request:")
    );
    if (sessionRead || key.startsWith("droxion_my_live_invite:")) readCache.delete(key);
  }
}

function applyLiveEvent(stream, sessionId, row) {
  if (!row) return;
  stream.lastTouchedAt = Date.now();

  if (row.event_type === "chat") {
    const rawId = row.metadata?.chat_id ?? row.id;
    const numericId = Number(rawId);
    const id = Number.isFinite(numericId) ? numericId : String(rawId || "");
    const chat = {
      id,
      sender_id: row.actor_id,
      display_name: row.display_name || "Droxion user",
      avatar_url: null,
      body: row.body || "",
      created_at: row.created_at,
    };
    const isNew = appendBoundedStableLiveEvent(stream.chat, stream.chatIds, chat, 300);
    if (isNew) notifyLiveEventSubscribers(stream, { type: "chat", row: chat, source: "realtime" });
  } else if (row.event_type === "gift") {
    const gift = {
      id: row.metadata?.gift_id || String(row.id),
      sender_id: row.actor_id,
      display_name: row.display_name || "Droxion user",
      gift_name: row.gift_name || "Gift",
      emoji: row.emoji || "🎁",
      cost_coins: Number(row.cost_coins || 0),
      created_at: row.created_at,
    };
    const isNew = appendBoundedStableLiveEvent(stream.gifts, stream.giftIds, gift, 100);
    if (isNew) notifyLiveEventSubscribers(stream, { type: "gift", row: gift, source: "realtime" });
  } else if (row.event_type === "guest_state") {
    invalidateGuestStateReads(sessionId);
    notifyLiveEventSubscribers(stream, { type: "guest_state", row, source: "realtime" });
  } else if (row.event_type === "live_started" || row.event_type === "live_ended") {
    for (const key of readCache.keys()) {
      if (key.startsWith("droxion_live_feed:")) readCache.delete(key);
      if (row.event_type === "live_ended" && key.includes(sessionId) && key.startsWith("droxion_live_room_status:")) readCache.delete(key);
    }
  }
}

function applyAuthoritativeLiveRows(stream, queue, rows) {
  const incoming = Array.isArray(rows) ? rows : [];
  const known = new Set(stream[queue].map(stableLiveEventId).filter(Boolean));
  const ids = queue === "chat" ? stream.chatIds : stream.giftIds;
  stream[queue] = replaceBoundedStableLiveEvents(stream[queue], incoming, ids, queue === "chat" ? 300 : 100);
  for (const row of incoming) {
    const id = stableLiveEventId(row);
    if (!id || known.has(id)) continue;
    known.add(id);
    notifyLiveEventSubscribers(stream, { type: queue === "chat" ? "chat" : "gift", row, source: "catchup" });
  }
}

async function catchUpLiveEventStream(sessionId, stream, generation) {
  if (stream.closed || stream.generation !== generation || !stream.ready) return;
  const afterChatId = stream.chat.reduce((latest, row) => Math.max(latest, Number(row.id) || 0), 0);
  const latestGiftAt = stream.gifts.reduce(
    (latest, row) => String(row.created_at || "") > String(latest || "") ? row.created_at : latest,
    new Date(stream.createdAt).toISOString()
  );
  const [chatResponse, giftResponse] = await Promise.all([
    originalRpc("droxion_live_chat_messages", { p_session_id: sessionId, p_after_id: afterChatId }),
    originalRpc("droxion_live_gift_events", { p_session_id: sessionId, p_after: liveGiftReconciliationCursor(latestGiftAt) }),
  ]);
  if (stream.closed || stream.generation !== generation || !stream.ready) return;
  if (!chatResponse?.error) applyAuthoritativeLiveRows(stream, "chat", chatResponse.data);
  if (!giftResponse?.error) applyAuthoritativeLiveRows(stream, "gifts", giftResponse.data);
  const now = Date.now();
  for (const [queue, response] of [["chat", chatResponse], ["gifts", giftResponse]]) {
    if (response?.error) continue;
    stream.reconcile[queue] = false;
    stream.lastAuthoritativeAt[queue] = now;
    stream.nextAuthoritativeAt[queue] = now + liveSafetyReconcileDelay(0);
    stream.safetyAttempt[queue] = 1;
  }
  notifyLiveEventSubscribers(stream, { type: "recovery", phase: "catchup_complete", source: "authoritative", timestamp: Date.now() });
}

function scheduleLiveEventReconnect(sessionId, stream) {
  if (stream.closed || stream.reconnectTimer || liveEventStreams.get(sessionId) !== stream) return;
  const delay = LIVE_EVENT_RETRY_MS[Math.min(stream.retryIndex, LIVE_EVENT_RETRY_MS.length - 1)];
  stream.retryIndex += 1;
  stream.reconnectTimer = globalThis.setTimeout(() => {
    stream.reconnectTimer = null;
    if (!stream.closed && liveEventStreams.get(sessionId) === stream) subscribeLiveEventStream(sessionId, stream);
  }, delay);
}

function subscribeLiveEventStream(sessionId, stream) {
  if (stream.closed || liveEventStreams.get(sessionId) !== stream) return;
  const generation = ++stream.generation;
  stream.ready = false;

  const channel = client
    .channel(`droxion-live-events:${sessionId}:${generation}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "droxion_live_events", filter: `session_id=eq.${sessionId}` },
      payload => {
        if (stream.generation !== generation || stream.channel !== channel) return;
        applyLiveEvent(stream, sessionId, payload?.new);
      }
    );

  stream.channel = channel;
  channel.subscribe(status => {
    if (stream.closed || stream.generation !== generation || stream.channel !== channel) return;
    if (status === "SUBSCRIBED") {
      stream.ready = true;
      stream.retryIndex = 0;
      notifyLiveEventSubscribers(stream, { type: "recovery", phase: "realtime_subscribed", source: "realtime", timestamp: Date.now() });
      if (stream.reconcile.chat) stream.nextAuthoritativeAt.chat = 0;
      if (stream.reconcile.gifts) stream.nextAuthoritativeAt.gifts = 0;
      stream.catchUpPromise = catchUpLiveEventStream(sessionId, stream, generation).catch(() => {
        if (stream.generation !== generation) return;
        markLiveQueueForReconciliation(stream, "chat");
        markLiveQueueForReconciliation(stream, "gifts");
      });
      return;
    }
    if (!["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) return;

    stream.ready = false;
    markLiveQueueForReconciliation(stream, "chat");
    markLiveQueueForReconciliation(stream, "gifts");
    stream.channel = null;
    try { Promise.resolve(client.removeChannel(channel)).catch(() => {}); }
    catch {}
    scheduleLiveEventReconnect(sessionId, stream);
  });
}

function getLiveEventStream(sessionId) {
  if (!sessionId) return null;
  let stream = liveEventStreams.get(sessionId);
  if (stream) return stream;

  stream = {
    chat: [],
    gifts: [],
    chatIds: new Set(),
    giftIds: new Set(),
    ready: false,
    channel: null,
    closed: false,
    generation: 0,
    retryIndex: 0,
    reconnectTimer: null,
    reconcile: { chat: true, gifts: true },
    lastTouchedAt: Date.now(),
    lastAuthoritativeAt: { chat: 0, gifts: 0 },
    nextAuthoritativeAt: { chat: 0, gifts: 0 },
    safetyAttempt: { chat: 0, gifts: 0 },
    authoritativeInFlight: { chat: null, gifts: null },
    subscribers: new Set(),
    createdAt: Date.now(),
    lastRecoveryAt: 0,
    recoveryInFlight: null,
    catchUpPromise: null,
  };

  liveEventStreams.set(sessionId, stream);
  subscribeLiveEventStream(sessionId, stream);
  return stream;
}

function authoritativeLiveRead(stream, queue, fn, args, options) {
  if (stream.authoritativeInFlight[queue]) return stream.authoritativeInFlight[queue];
  const subscriptionState = captureLiveReadSubscriptionState(stream, queue);
  const request = Promise.resolve(originalRpc(fn, args, options)).then(response => {
    const now = Date.now();
    if (response?.error) {
      stream.reconcile[queue] = true;
      stream.nextAuthoritativeAt[queue] = now + liveSafetyReconcileDelay(
        Math.min(stream.safetyAttempt[queue], 4),
        { baseMs: 2000, maxMs: 30000 }
      );
      return response;
    }

    const ids = queue === "chat" ? stream.chatIds : stream.giftIds;
    stream[queue] = replaceBoundedStableLiveEvents(stream[queue], response.data, ids, queue === "chat" ? 300 : 100);
    stream.lastTouchedAt = now;
    stream.lastAuthoritativeAt[queue] = now;
    const completed = canCompleteLiveReadReconciliation(stream, subscriptionState);
    if (completed) stream.reconcile[queue] = false;
    stream.nextAuthoritativeAt[queue] = now + (completed
      ? liveSafetyReconcileDelay(stream.safetyAttempt[queue])
      : liveSafetyReconcileDelay(stream.safetyAttempt[queue], { baseMs: 2000, maxMs: 30000 }));
    stream.safetyAttempt[queue] = Math.min(stream.safetyAttempt[queue] + 1, 8);
    return response;
  }).finally(() => {
    if (stream.authoritativeInFlight[queue] === request) stream.authoritativeInFlight[queue] = null;
  });
  stream.authoritativeInFlight[queue] = request;
  return request;
}

function closeLiveEventStream(sessionId, stream) {
  if (!stream || liveEventStreams.get(sessionId) !== stream) return;
  stream.closed = true;
  stream.ready = false;
  stream.generation += 1;
  if (stream.reconnectTimer) globalThis.clearTimeout(stream.reconnectTimer);
  try {
    if (stream.channel) Promise.resolve(client.removeChannel(stream.channel)).catch(() => {});
  } catch {}
  liveEventStreams.delete(sessionId);
}

function cleanupOldLiveStreams() {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [sessionId, stream] of liveEventStreams.entries()) {
    if (stream.lastTouchedAt >= cutoff) continue;
    closeLiveEventStream(sessionId, stream);
  }
}

if (typeof window !== "undefined") {
  window.setInterval(cleanupOldLiveStreams, 60000);
}

client.rpc = (fn, args, options) => {
  // Viewer heartbeat is an authorization/liveness backup. The database uses a
  // 150-second TTL, so sending this every 60 seconds is sufficient and cuts
  // write volume by ~75% versus the legacy 15-second timer.
  if (fn === "droxion_live_viewer_heartbeat") {
    const sessionId = args?.p_session_id;
    const key = `viewer-heartbeat:${sessionId || ""}`;
    const now = Date.now();
    const cached = heartbeatCache.get(key);
    if (cached && now - cached.at < 55000) return Promise.resolve(result(true));
    heartbeatCache.set(key, { at: now });
    return originalRpc(fn, args, options);
  }

  // Realtime is the fast path, but SUBSCRIBED is not proof that delivery remains
  // healthy. Periodic authoritative reads reconcile silent event loss.
  if (fn === "droxion_live_chat_messages" && args?.p_session_id) {
    const stream = getLiveEventStream(args.p_session_id);
    const afterId = Number(args?.p_after_id || 0);
    if (!liveQueueNeedsAuthoritativeRead(stream, "chat")) {
      stream.lastTouchedAt = Date.now();
      return Promise.resolve(result(stream.chat.filter(row => Number(row.id || 0) > afterId).slice(0, 200)));
    }
    return authoritativeLiveRead(stream, "chat", fn, args, options);
  }

  if (fn === "droxion_live_gift_events" && args?.p_session_id) {
    const stream = getLiveEventStream(args.p_session_id);
    const after = args?.p_after ? Date.parse(args.p_after) : 0;
    if (!liveQueueNeedsAuthoritativeRead(stream, "gifts")) {
      stream.lastTouchedAt = Date.now();
      return Promise.resolve(result(stream.gifts.filter(row => !after || Date.parse(row.created_at) > after).slice(0, 100)));
    }
    return authoritativeLiveRead(stream, "gifts", fn, args, options);
  }

  if ((fn === "droxion_send_live_chat" || fn === "droxion_send_live_gift")) {
    return Promise.resolve(originalRpc(fn, args, options)).then(response => {
      if (!response?.error && response?.data?.allowed) {
        const queue = fn === "droxion_send_live_chat" ? "chat" : "gifts";
        const sessionId = args?.p_session_id;
        if (sessionId && liveEventStreams.has(sessionId)) {
          markLiveQueueForReconciliation(liveEventStreams.get(sessionId), queue);
        } else {
          for (const stream of liveEventStreams.values()) markLiveQueueForReconciliation(stream, queue);
        }
      }
      return response;
    });
  }

  const ttl = LIVE_READ_TTL_MS[fn];
  if (!ttl) return originalRpc(fn, args, options);

  const key = stableKey(fn, args);
  const now = Date.now();
  const cached = readCache.get(key);
  if (cached && now - cached.at < ttl) return cached.promise;

  const promise = Promise.resolve(originalRpc(fn, args, options));
  readCache.set(key, { at: now, promise });
  window.setTimeout(() => {
    if (readCache.get(key)?.promise === promise) readCache.delete(key);
  }, ttl + 50);
  return promise;
};

export const supabase = client;

export function requestLiveAuthoritativeReconcile(sessionId, queues = ["chat", "gifts"]) {
  const stream = liveEventStreams.get(sessionId);
  if (!stream) return;
  for (const queue of queues) markLiveQueueForReconciliation(stream, queue);
}

export function recoverLiveEventStream(sessionId, reason = "lifecycle") {
  const stream = liveEventStreams.get(sessionId);
  if (!stream || stream.closed) return Promise.resolve(false);
  const now = Date.now();
  if (stream.recoveryInFlight || now - stream.lastRecoveryAt < 1000) {
    return stream.recoveryInFlight || Promise.resolve(false);
  }
  stream.lastRecoveryAt = now;
  stream.ready = false;
  stream.generation += 1;
  markLiveQueueForReconciliation(stream, "chat");
  markLiveQueueForReconciliation(stream, "gifts");
  if (stream.reconnectTimer) {
    globalThis.clearTimeout(stream.reconnectTimer);
    stream.reconnectTimer = null;
  }
  const previousChannel = stream.channel;
  stream.channel = null;
  try { if (previousChannel) Promise.resolve(client.removeChannel(previousChannel)).catch(() => {}); }
  catch {}
  stream.recoveryInFlight = Promise.resolve().then(() => {
    if (stream.closed || liveEventStreams.get(sessionId) !== stream) return false;
    stream.lastRecoveryReason = reason;
    subscribeLiveEventStream(sessionId, stream);
    return true;
  }).finally(() => { stream.recoveryInFlight = null; });
  return stream.recoveryInFlight;
}

export function subscribeLiveEvents(sessionId, subscriber) {
  if (!sessionId || typeof subscriber !== "function") return () => {};
  const stream = getLiveEventStream(sessionId);
  stream.subscribers.add(subscriber);
  stream.lastTouchedAt = Date.now();
  return () => {
    stream.subscribers.delete(subscriber);
    stream.lastTouchedAt = Date.now();
  };
}

export function invalidateLiveGuestState(sessionId) {
  if (sessionId) invalidateGuestStateReads(sessionId);
}

const LIVE_AUTHORITATIVE_READS = new Set([
  "droxion_live_room_status",
  "droxion_live_join_requests",
  "droxion_my_live_join_request",
  "droxion_my_live_invite",
]);

export function authoritativeLiveRpc(fn, args, options) {
  if (!LIVE_AUTHORITATIVE_READS.has(fn)) return Promise.resolve({ data: null, error: new Error("Unsupported authoritative LIVE read.") });
  if (args?.p_session_id) invalidateGuestStateReads(args.p_session_id);
  else if (fn === "droxion_my_live_invite") {
    for (const key of readCache.keys()) {
      if (key.startsWith("droxion_my_live_invite:")) readCache.delete(key);
    }
  }
  return originalRpc(fn, args, options);
}

export function releaseLiveEventStream(sessionId) {
  closeLiveEventStream(sessionId, liveEventStreams.get(sessionId));
}
