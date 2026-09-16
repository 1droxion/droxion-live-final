import { useEffect } from 'react';

const CACHE_KEY = 'droxion.liveHub.response.v2';
const FRESH_CACHE_MS = 90 * 1000;
const STALE_FALLBACK_MS = 10 * 60 * 1000;

function isLiveHubRequest(input, init = {}) {
  const method = String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
  if (method !== 'GET') return false;
  try {
    const raw = typeof input === 'string' ? input : input?.url;
    if (!raw) return false;
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname === '/api/live-hub';
  } catch {
    return false;
  }
}

function readCache() {
  try {
    const value = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
    if (!value || !value.body || !Number.isFinite(Number(value.savedAt))) return null;
    return value;
  } catch {
    return null;
  }
}

function writeCache(body, response) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      body,
      status: response?.status || 200,
      statusText: response?.statusText || 'OK',
      contentType: response?.headers?.get?.('content-type') || 'application/json'
    }));
  } catch {}
}

function cachedResponse(entry, cacheState = 'HIT') {
  const headers = new Headers({
    'Content-Type': entry?.contentType || 'application/json',
    'X-Droxion-Live-Cache': cacheState
  });
  return new Response(entry.body, {
    status: Number(entry?.status || 200),
    statusText: entry?.statusText || 'OK',
    headers
  });
}

async function cacheNetworkResponse(promise) {
  const response = await promise;
  if (!response?.ok) return response;
  try {
    const body = await response.clone().text();
    if (body) writeCache(body, response);
  } catch {}
  return response;
}

/**
 * Makes repeated Home/Explore opens feel immediate without changing provider
 * behavior or rendering hundreds of players. Only /api/live-hub GET requests
 * are touched. A fresh metadata response can paint instantly while a network
 * refresh happens in the background. Failed provider refreshes can fall back
 * to a recent cached list instead of leaving Home blank.
 */
export default function LiveHubPerformanceEnhancer() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return undefined;

    const originalFetch = window.fetch.bind(window);
    let inFlight = null;
    let servedStartupCache = false;

    const refreshCache = (input, init) => {
      if (inFlight) return inFlight;
      inFlight = cacheNetworkResponse(originalFetch(input, { ...init, cache: 'no-cache' }))
        .catch(() => null)
        .finally(() => { inFlight = null; });
      return inFlight;
    };

    const enhancedFetch = async (input, init = {}) => {
      if (!isLiveHubRequest(input, init)) return originalFetch(input, init);

      const cached = readCache();
      const age = cached ? Date.now() - Number(cached.savedAt || 0) : Infinity;

      // On app startup, paint a recently fetched LIVE list immediately and
      // refresh it in parallel. Manual refreshes later in the session still go
      // to the network rather than being trapped behind the client cache.
      if (!servedStartupCache && cached && age <= FRESH_CACHE_MS) {
        servedStartupCache = true;
        refreshCache(input, init);
        return cachedResponse(cached, 'FRESH');
      }

      servedStartupCache = true;

      if (inFlight) {
        const shared = await inFlight;
        if (shared) return shared.clone();
      }

      try {
        const response = await cacheNetworkResponse(originalFetch(input, init));
        if (!response.ok && cached && age <= STALE_FALLBACK_MS) return cachedResponse(cached, 'STALE');
        return response;
      } catch (error) {
        if (cached && age <= STALE_FALLBACK_MS) return cachedResponse(cached, 'STALE');
        throw error;
      }
    };

    window.fetch = enhancedFetch;
    window.__droxionLiveHubPerformance = {
      version: 1,
      freshCacheMs: FRESH_CACHE_MS,
      staleFallbackMs: STALE_FALLBACK_MS
    };

    return () => {
      if (window.fetch === enhancedFetch) window.fetch = originalFetch;
      try { delete window.__droxionLiveHubPerformance; } catch {}
    };
  }, []);

  return null;
}
