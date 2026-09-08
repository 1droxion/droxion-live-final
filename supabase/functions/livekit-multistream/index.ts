import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  EgressClient,
  EncodingOptionsPreset,
  StreamOutput,
  StreamProtocol,
} from "npm:livekit-server-sdk@2.18.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LIVE_FRESH_MS = 180_000;
const ALLOWED_PLATFORMS = new Set(["youtube", "facebook", "twitch", "kick", "tiktok", "custom"]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function cleanEnv(name: string) {
  return String(Deno.env.get(name) || "").trim().replace(/[\r\n]/g, "");
}

function toHttpUrl(value: string) {
  return value.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:").replace(/\/$/, "");
}

function validRtmp(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "rtmp:" || url.protocol === "rtmps:";
  } catch {
    return false;
  }
}

function maskRtmp(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname.split("/").filter(Boolean);
    if (!path.length) return `${url.protocol}//${url.host}/••••••`;
    path[path.length - 1] = "••••••";
    return `${url.protocol}//${url.host}/${path.join("/")}`;
  } catch {
    return "Saved securely";
  }
}

function normalizeLabel(value: unknown) {
  return String(value || "").trim().slice(0, 64);
}

async function authContext(req: Request) {
  const supabaseUrl = cleanEnv("SUPABASE_URL");
  const anonKey = cleanEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = cleanEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error("Supabase server configuration is missing.");

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user?.id) return null;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user: data.user, admin };
}

function egressClient() {
  const url = cleanEnv("LIVEKIT_URL");
  const apiKey = cleanEnv("LIVEKIT_API_KEY");
  const apiSecret = cleanEnv("LIVEKIT_API_SECRET");
  if (!url || !apiKey || !apiSecret) throw new Error("LiveKit server configuration is missing.");
  return new EgressClient(toHttpUrl(url), apiKey, apiSecret);
}

async function listDestinations(admin: any, userId: string) {
  const { data, error } = await admin
    .from("droxion_multistream_destinations")
    .select("id,platform,label,rtmp_url,enabled,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    platform: row.platform,
    label: row.label,
    enabled: Boolean(row.enabled),
    saved: true,
    maskedUrl: maskRtmp(row.rtmp_url),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function currentSession(admin: any, userId: string) {
  const { data, error } = await admin
    .from("droxion_multistream_sessions")
    .select("id,session_id,egress_id,room_name,destination_count,status,started_at,ended_at,updated_at")
    .eq("user_id", userId)
    .in("status", ["starting", "active", "stopping"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function startMultistream(admin: any, userId: string, sessionId: string) {
  const existing = await currentSession(admin, userId);
  if (existing) return { alreadyActive: true, session: existing };

  const { data: live, error: liveError } = await admin
    .from("droxion_live_presence")
    .select("user_id,session_id,is_live,last_seen_at,orientation")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .eq("is_live", true)
    .maybeSingle();
  if (liveError) throw liveError;
  if (!live?.session_id) throw new Error("This Droxion LIVE session is not active.");
  const seen = live.last_seen_at ? Date.parse(live.last_seen_at) : 0;
  if (!seen || Date.now() - seen > LIVE_FRESH_MS) throw new Error("This Droxion LIVE session is no longer fresh.");

  const { data: destinations, error: destinationError } = await admin
    .from("droxion_multistream_destinations")
    .select("id,rtmp_url")
    .eq("user_id", userId)
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .limit(5);
  if (destinationError) throw destinationError;
  const urls = (destinations || []).map((row: any) => String(row.rtmp_url || "")).filter(validRtmp);
  if (!urls.length) throw new Error("Enable at least one streaming destination first.");

  const roomName = `droxion-${sessionId}`;
  const output = new StreamOutput({ protocol: StreamProtocol.RTMP, urls });
  const portrait = String(live.orientation || "vertical").toLowerCase() !== "horizontal";
  const encodingOptions = portrait
    ? EncodingOptionsPreset.PORTRAIT_H264_720P_30
    : EncodingOptionsPreset.H264_720P_30;

  const { data: starting, error: startingError } = await admin
    .from("droxion_multistream_sessions")
    .insert({
      user_id: userId,
      session_id: sessionId,
      egress_id: `starting-${crypto.randomUUID()}`,
      room_name: roomName,
      destination_count: urls.length,
      status: "starting",
    })
    .select("id")
    .single();
  if (startingError) throw startingError;

  try {
    const info = await egressClient().startRoomCompositeEgress(roomName, output, {
      layout: "speaker",
      encodingOptions,
      audioOnly: false,
      videoOnly: false,
    });
    const egressId = String((info as any)?.egressId || "");
    if (!egressId) throw new Error("LiveKit did not return an egress ID.");
    const { data: active, error: activeError } = await admin
      .from("droxion_multistream_sessions")
      .update({ egress_id: egressId, status: "active", updated_at: new Date().toISOString() })
      .eq("id", starting.id)
      .select("id,session_id,egress_id,room_name,destination_count,status,started_at,updated_at")
      .single();
    if (activeError) throw activeError;
    return { alreadyActive: false, session: active };
  } catch (error) {
    await admin
      .from("droxion_multistream_sessions")
      .update({ status: "failed", ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", starting.id);
    throw error;
  }
}

async function stopMultistream(admin: any, userId: string) {
  const active = await currentSession(admin, userId);
  if (!active) return { stopped: true, session: null };

  await admin
    .from("droxion_multistream_sessions")
    .update({ status: "stopping", updated_at: new Date().toISOString() })
    .eq("id", active.id);

  try {
    if (active.egress_id && !String(active.egress_id).startsWith("starting-")) {
      await egressClient().stopEgress(active.egress_id);
    }
  } catch (error) {
    console.warn("LiveKit stopEgress returned an error; marking the local session stopped anyway", String((error as any)?.message || error));
  }

  const endedAt = new Date().toISOString();
  const { data, error } = await admin
    .from("droxion_multistream_sessions")
    .update({ status: "stopped", ended_at: endedAt, updated_at: endedAt })
    .eq("id", active.id)
    .select("id,session_id,egress_id,room_name,destination_count,status,started_at,ended_at,updated_at")
    .single();
  if (error) throw error;
  return { stopped: true, session: data };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const context = await authContext(req);
    if (!context) return json({ error: "Authentication required." }, 401);
    const { user, admin } = context;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list").trim().toLowerCase();

    if (action === "list") {
      const [destinations, session] = await Promise.all([
        listDestinations(admin, user.id),
        currentSession(admin, user.id),
      ]);
      return json({ ok: true, destinations, session });
    }

    if (action === "upsert") {
      const id = String(body?.id || "").trim();
      const platform = String(body?.platform || "custom").trim().toLowerCase();
      const label = normalizeLabel(body?.label);
      const enabled = body?.enabled !== false;
      const rtmpUrl = String(body?.rtmpUrl || "").trim();
      if (!ALLOWED_PLATFORMS.has(platform)) return json({ error: "Unsupported streaming platform." }, 400);

      if (id) {
        const patch: Record<string, unknown> = { platform, label, enabled, updated_at: new Date().toISOString() };
        if (rtmpUrl) {
          if (!validRtmp(rtmpUrl)) return json({ error: "Use a valid RTMP or RTMPS stream URL." }, 400);
          patch.rtmp_url = rtmpUrl;
        }
        const { error } = await admin
          .from("droxion_multistream_destinations")
          .update(patch)
          .eq("id", id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        if (!validRtmp(rtmpUrl)) return json({ error: "Use a valid RTMP or RTMPS stream URL." }, 400);
        const { error } = await admin.from("droxion_multistream_destinations").insert({
          user_id: user.id,
          platform,
          label,
          rtmp_url: rtmpUrl,
          enabled,
        });
        if (error) throw error;
      }
      return json({ ok: true, destinations: await listDestinations(admin, user.id) });
    }

    if (action === "delete") {
      const id = String(body?.id || "").trim();
      if (!id) return json({ error: "Destination ID is required." }, 400);
      const { error } = await admin
        .from("droxion_multistream_destinations")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      return json({ ok: true, destinations: await listDestinations(admin, user.id) });
    }

    if (action === "start") {
      const sessionId = String(body?.sessionId || "").trim();
      if (!sessionId) return json({ error: "LIVE session ID is required." }, 400);
      const result = await startMultistream(admin, user.id, sessionId);
      return json({ ok: true, ...result });
    }

    if (action === "stop") {
      const result = await stopMultistream(admin, user.id);
      return json({ ok: true, ...result });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("livekit-multistream error", error);
    return json({ error: String((error as any)?.message || error || "Multistream request failed.") }, 500);
  }
});
