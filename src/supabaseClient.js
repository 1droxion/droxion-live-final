import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables.");
}

const client = createClient(supabaseUrl, supabaseAnonKey);

// The LIVE UI historically polls several read-only RPCs very aggressively.
// Keep the public client API unchanged while coalescing identical reads in the
// same browser. Realtime events are the fast path; these RPCs are fallback /
// reconciliation reads. Mutating and money RPCs are NEVER cached.
const LIVE_READ_TTL_MS = {
  droxion_live_feed: 12000,
  droxion_live_room_status: 10000,
  droxion_live_room_viewers: 15000,
  droxion_live_chat_messages: 5000,
  droxion_live_gift_events: 5000,
  droxion_live_join_requests: 5000,
  droxion_my_live_join_request: 5000,
  droxion_my_live_invite: 5000,
  droxion_live_creator_summary: 5000,
  droxion_current_live_context: 5000,
};

const readCache = new Map();
const originalRpc = client.rpc.bind(client);

function stableKey(fn, args) {
  try { return `${fn}:${JSON.stringify(args || {})}`; }
  catch { return `${fn}:uncacheable`; }
}

client.rpc = (fn, args, options) => {
  const ttl = LIVE_READ_TTL_MS[fn];
  if (!ttl) return originalRpc(fn, args, options);

  const key = stableKey(fn, args);
  const now = Date.now();
  const cached = readCache.get(key);
  if (cached && now - cached.at < ttl) return cached.promise;

  const promise = Promise.resolve(originalRpc(fn, args, options)).finally(() => {
    // Keep the resolved promise until TTL expires so rapid React effects and
    // legacy timers share one backend read instead of creating a request storm.
    window.setTimeout(() => {
      if (readCache.get(key)?.promise === promise) readCache.delete(key);
    }, ttl + 50);
  });
  readCache.set(key, { at: now, promise });
  return promise;
};

export const supabase = client;
