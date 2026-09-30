import { createHmac, timingSafeEqual } from "node:crypto";

const ALLOWED_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
  "https://droxion.com",
  "https://www.droxion.com"
]);

function secret() {
  const value = process.env.DROXION_SCAN_SECRET || process.env.OPENAI_API_KEY;
  if (!value) throw new Error("Server signing secret is not configured.");
  return value;
}

function b64(value) {
  return Buffer.from(value).toString("base64url");
}

function signPart(value) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function issueToken(payload) {
  const body = b64(JSON.stringify(payload));
  return body + "." + signPart(body);
}

export function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = signPart(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload?.exp && Date.now() > Number(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function issueScanToken(installId, used = 0) {
  return issueToken({
    type: "scan",
    installId,
    used: Math.max(0, Number(used) || 0),
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000
  });
}

export function readScanToken(token, installId) {
  const payload = verifyToken(token);
  if (!payload || payload.type !== "scan" || payload.installId !== installId) return null;
  return payload;
}

export function issueEntitlementToken({ installId, productId, platform, expiresAt }) {
  const expiryMs = expiresAt ? Date.parse(expiresAt) : Date.now() + 7 * 24 * 60 * 60 * 1000;
  return issueToken({
    type: "pro",
    installId,
    productId,
    platform,
    exp: Number.isFinite(expiryMs) ? expiryMs : Date.now() + 7 * 24 * 60 * 60 * 1000
  });
}

export function hasActiveEntitlement(token, installId) {
  const payload = verifyToken(token);
  return Boolean(payload && payload.type === "pro" && payload.installId === installId);
}

export function setCors(req, res) {
  const origin = String(req.headers.origin || "").trim();
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export function validInstallId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}
