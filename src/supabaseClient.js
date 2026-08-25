import { createClient } from "@supabase/supabase-js";
import {
  canCompleteLiveReadReconciliation,
  captureLiveReadSubscriptionState,
  mergeStableLiveEvents,
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
  droxion_live_feed: 20000,
  droxion_live_room_status: 20000,
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
const LIVE_AUTHORITATIVE_RECONCILE_MS = 3000;

function result(data) {
  return { data, error: null, count: null, status: 200, statusText: "OK" };
}

function stableKey(fn, args) {
  try { return `${fn}:${JSON.stringify(args || {})}`; }
  catch { return `${fn}:uncacheable`; }
}

function applyLiveEvent(stream, sessionId, row) {
  if (!row) return;
  stream.lastTouchedAt = Date.now();

  if (row.event_type === "chat") {
    const id = Number(row.metadata?.chat_id || row.id || 0);
    stream.chat = mergeStableLiveEvents(stream.chat, [{
      id,
      sender_id: row.actor_id,
      display_name: row.display_name || "Droxion user",
      avatar_url: null,
      body: row.body || "",
      created_at: row.created_at,
    }], 300);
  } else if (row.event_type === "gift") {
    stream.gifts = mergeStableLiveEvents(stream.gifts, [{
      id: row.metadata?.gift_id || String(row.id),
      sender_id: row.actor_id,
      display_name: row.display_name || "Droxion user",
      gift_name: row.gift_name || "Gift",
      emoji: row.emoji || "🎁",
      cost_coins: Number(row.cost_coins || 0),
      created_at: row.created_at,
    }], 100);
  } else if (row.event_type === "guest_state") {
    for (const key of readCache.keys()) {
      if (key.includes(sessionId) && (key.startsWith("droxion_live_room_status:") || key.startsWith("droxion_live_join_requests:") || key.startsWith("droxion_my_live_join_request:"))) {
        readCache.delete(key);
      }
    }
  } else if (row.event_type === "live_started" || row.event_type === "live_ended") {
    for (const key of readCache.keys()) {
      if (key.startsWith("droxion_live_feed:")) readCache.delete(key);
    }
  }
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
      return;
    }
    if (!["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) return;

    stream.ready = false;
    stream.reconcile.chat = true;
    stream.reconcile.gifts = true;
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
    ready: false,
    channel: null,
    closed: false,
    generation: 0,
    retryIndex: 0,
    reconnectTimer: null,
    reconcile: { chat: true, gifts: true },
    lastTouchedAt: Date.now(),
    lastAuthoritativeAt: { chat: 0, gifts: 0 },
  };

  liveEventStreams.set(sessionId, stream);
  subscribeLiveEventStream(sessionId, stream);
  return stream;
}

function authoritativeLiveRead(stream, queue, fn, args, options) {
  const subscriptionState = captureLiveReadSubscriptionState(stream, queue);
  return Promise.resolve(originalRpc(fn, args, options)).then(response => {
    if (!response?.error) {
      stream[queue] = mergeStableLiveEvents(stream[queue], response.data, queue === "chat" ? 300 : 100);
      stream.lastTouchedAt = Date.now();
      stream.lastAuthoritativeAt[queue] = Date.now();
      if (canCompleteLiveReadReconciliation(stream, subscriptionState)) stream.reconcile[queue] = false;
    }
    return response;
  });
}

function cleanupOldLiveStreams() {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [sessionId, stream] of liveEventStreams.entries()) {
    if (stream.lastTouchedAt >= cutoff) continue;
    stream.closed = true;
    stream.ready = false;
    stream.generation += 1;
    if (stream.reconnectTimer) globalThis.clearTimeout(stream.reconnectTimer);
    try {
      if (stream.channel) Promise.resolve(client.removeChannel(stream.channel)).catch(() => {});
    } catch {}
    liveEventStreams.delete(sessionId);
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
    if (stream?.ready && !stream.reconcile.chat && Date.now() - stream.lastAuthoritativeAt.chat < LIVE_AUTHORITATIVE_RECONCILE_MS) {
      stream.lastTouchedAt = Date.now();
      return Promise.resolve(result(stream.chat.filter(row => Number(row.id || 0) > afterId).slice(0, 200)));
    }
    return authoritativeLiveRead(stream, "chat", fn, args, options);
  }

  if (fn === "droxion_live_gift_events" && args?.p_session_id) {
    const stream = getLiveEventStream(args.p_session_id);
    const after = args?.p_after ? Date.parse(args.p_after) : 0;
    if (stream?.ready && !stream.reconcile.gifts && Date.now() - stream.lastAuthoritativeAt.gifts < LIVE_AUTHORITATIVE_RECONCILE_MS) {
      stream.lastTouchedAt = Date.now();
      return Promise.resolve(result(stream.gifts.filter(row => !after || Date.parse(row.created_at) > after).slice(0, 100)));
    }
    return authoritativeLiveRead(stream, "gifts", fn, args, options);
  }

  if ((fn === "droxion_send_live_chat" || fn === "droxion_send_live_gift")) {
    return Promise.resolve(originalRpc(fn, args, options)).then(response => {
      if (!response?.error && response?.data?.allowed) {
        for (const stream of liveEventStreams.values()) {
          stream.reconcile[fn === "droxion_send_live_chat" ? "chat" : "gifts"] = true;
          stream.lastAuthoritativeAt[fn === "droxion_send_live_chat" ? "chat" : "gifts"] = 0;
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
