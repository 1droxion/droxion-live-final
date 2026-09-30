import { createSign } from "node:crypto";
import {
  issueEntitlementToken,
  readBody,
  setCors,
  validInstallId
} from "../../server/fit-security.js";

const PACKAGE_NAME = "com.droxion.live";
const PRODUCTS = new Set([
  "com.droxion.fit.pro.monthly",
  "com.droxion.fit.pro.yearly"
]);
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

function b64(value) {
  return Buffer.from(value).toString("base64url");
}

function serviceAccount() {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || "";
  if (!raw) throw new Error("Google Play server credentials are not configured.");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key) throw new Error();
    return parsed;
  } catch {
    try {
      const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
      if (!parsed.client_email || !parsed.private_key) throw new Error();
      return parsed;
    } catch {
      throw new Error("Google Play server credentials are invalid.");
    }
  }
}

async function accessToken() {
  const account = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64(JSON.stringify({
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + "." + claims;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = unsigned + "." + signer.sign(account.private_key).toString("base64url");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload?.error_description || "Google Play authentication failed.");
  }
  return payload.access_token;
}

async function verifySubscription(purchaseToken) {
  const token = await accessToken();
  const url = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(PACKAGE_NAME) + "/purchases/subscriptionsv2/tokens/" + encodeURIComponent(purchaseToken);
  const response = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "Google Play could not verify the subscription.");
  return payload;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  try {
    const body = readBody(req);
    const installId = String(body.installId || "");
    const transaction = body.transaction || {};
    const purchaseToken = String(transaction.purchaseToken || "");
    const requestedProduct = String(transaction.productId || "");

    if (!validInstallId(installId)) return res.status(400).json({ error: "Invalid install identifier." });
    if (!purchaseToken) return res.status(400).json({ error: "Google Play purchase token is required." });
    if (requestedProduct && !PRODUCTS.has(requestedProduct)) {
      return res.status(400).json({ error: "Unknown Droxion Fit subscription product." });
    }

    const purchase = await verifySubscription(purchaseToken);
    const activeStates = new Set([
      "SUBSCRIPTION_STATE_ACTIVE",
      "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
    ]);
    if (!activeStates.has(String(purchase.subscriptionState || ""))) {
      throw new Error("This Google Play subscription is not active.");
    }

    const line = (purchase.lineItems || []).find(item => PRODUCTS.has(String(item.productId || "")));
    if (!line) throw new Error("Google Play did not return a Droxion Fit Pro product.");

    const productId = String(line.productId);
    const expiresAt = String(line.expiryTime || "");
    if (!expiresAt || Date.parse(expiresAt) <= Date.now()) throw new Error("This Google Play subscription has expired.");

    return res.status(200).json({
      ok: true,
      active: true,
      platform: "android",
      productId,
      expiresAt,
      entitlementToken: issueEntitlementToken({ installId, productId, platform: "android", expiresAt })
    });
  } catch (error) {
    console.error("Droxion Fit Google subscription verification failed", error);
    return res.status(400).json({ error: error?.message || "Google Play subscription verification failed." });
  }
}
