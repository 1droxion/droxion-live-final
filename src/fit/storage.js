import { STORAGE_KEYS, FREE_SCANS } from "./constants.js";

export function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readText(key, fallback = "") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function writeText(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0,8) + "-" + hex.slice(8,12) + "-" + hex.slice(12,16) + "-" + hex.slice(16,20) + "-" + hex.slice(20);
}

export function getInstallId() {
  let value = readText(STORAGE_KEYS.installId);
  if (!value) {
    value = uuid();
    writeText(STORAGE_KEYS.installId, value);
  }
  return value;
}

export const getProfile = () => readJson(STORAGE_KEYS.profile, null);
export const saveProfile = profile => writeJson(STORAGE_KEYS.profile, profile);
export const getMeals = () => readJson(STORAGE_KEYS.meals, []);
export const saveMeals = meals => writeJson(STORAGE_KEYS.meals, meals.slice(-500));
export const getScanToken = () => readText(STORAGE_KEYS.scanToken);
export const setScanToken = token => writeText(STORAGE_KEYS.scanToken, token);
export const getEntitlementToken = () => readText(STORAGE_KEYS.entitlementToken);
export const getEntitlementMeta = () => readJson(STORAGE_KEYS.entitlementMeta, null);

export function getFreeRemaining() {
  const value = Number(readText(STORAGE_KEYS.freeRemaining, String(FREE_SCANS)));
  return Number.isFinite(value) ? Math.max(0, Math.min(FREE_SCANS, value)) : FREE_SCANS;
}

export function setFreeRemaining(value) {
  return writeText(STORAGE_KEYS.freeRemaining, Math.max(0, Number(value) || 0));
}

export function setEntitlement(token, meta) {
  writeText(STORAGE_KEYS.entitlementToken, token || "");
  writeJson(STORAGE_KEYS.entitlementMeta, meta || null);
}

export function clearEntitlement() {
  try {
    localStorage.removeItem(STORAGE_KEYS.entitlementToken);
    localStorage.removeItem(STORAGE_KEYS.entitlementMeta);
  } catch {}
}

export function clearUserData() {
  try {
    localStorage.removeItem(STORAGE_KEYS.profile);
    localStorage.removeItem(STORAGE_KEYS.meals);
  } catch {}
}
