import { Capacitor } from "@capacitor/core";
import {
  getInstallId,
  getScanToken,
  setScanToken,
  getEntitlementToken,
  setFreeRemaining
} from "./storage.js";

const API_ORIGIN = (
  import.meta.env.VITE_API_ORIGIN ||
  (Capacitor.isNativePlatform?.() ? "https://www.droxion.com" : "")
).replace(/\/$/, "");

function endpoint(path) {
  return API_ORIGIN + path;
}

async function postJson(path, body, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error || ("Request failed (" + response.status + ")."));
      error.status = response.status;
      error.code = payload?.code || "";
      error.paywall = Boolean(payload?.paywall);
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The scan took too long. Please try again on a stronger connection.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function ensureInstallToken() {
  const installId = getInstallId();
  const existing = getScanToken();
  const payload = await postJson("/api/install", {
    installId,
    token: existing || null
  }, 15000);

  if (payload?.token) setScanToken(payload.token);
  if (Number.isFinite(Number(payload?.freeRemaining))) {
    setFreeRemaining(Number(payload.freeRemaining));
  }

  return { installId, token: payload?.token || existing };
}

export async function analyzeFood(image, hint = "") {
  const install = await ensureInstallToken();
  const payload = await postJson("/api/analyze-food", {
    installId: install.installId,
    scanToken: install.token,
    entitlementToken: getEntitlementToken() || null,
    image,
    hint: String(hint || "").trim()
  });

  if (payload?.scanToken) setScanToken(payload.scanToken);
  if (Number.isFinite(Number(payload?.freeRemaining))) {
    setFreeRemaining(Number(payload.freeRemaining));
  }

  return payload;
}

export async function verifyStoreSubscription(platform, transaction) {
  return postJson("/api/subscriptions/" + platform, {
    installId: getInstallId(),
    transaction
  }, 30000);
}
