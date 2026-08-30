const LONG_LIVE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/**
 * Product rule for automatic LIVE highlights.
 *
 * - Normal LIVE sessions, including a ~30 minute LIVE: publish 1 highlight.
 * - Long LIVE sessions of 2 hours or more: publish 2 highlights when candidates exist.
 *
 * This policy is intentionally independent from LiveKit transport and recording.
 */
export function highlightCountForLiveDuration(durationMs) {
  const duration = Math.max(0, Number(durationMs || 0));
  return duration >= LONG_LIVE_THRESHOLD_MS ? 2 : 1;
}

export { LONG_LIVE_THRESHOLD_MS };
