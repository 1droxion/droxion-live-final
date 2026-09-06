/**
 * Product rule for automatic LIVE highlights.
 *
 * A creator can publish up to five automatic highlights per UTC day. The
 * server is the final authority for that daily cap; this client policy only
 * decides how many of the strongest non-overlapping segments from one LIVE
 * should be offered for publishing.
 *
 * Short LIVE sessions intentionally produce fewer clips so the Reel feed does
 * not fill with several near-identical moments from the same brief broadcast.
 * This policy is independent from LiveKit transport and recording.
 */
export function highlightCountForLiveDuration(liveDurationMs = 0) {
  const duration = Math.max(0, Number(liveDurationMs || 0));
  if (duration < 90_000) return 1;
  if (duration < 3 * 60_000) return 2;
  if (duration < 6 * 60_000) return 3;
  if (duration < 10 * 60_000) return 4;
  return 5;
}
