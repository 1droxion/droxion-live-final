/**
 * Product rule for automatic LIVE highlights.
 *
 * Every LIVE publishes at most one automatic reel/highlight when a valid
 * candidate exists. This keeps the creator feed clean and predictable.
 *
 * This policy is intentionally independent from LiveKit transport and recording.
 */
export function highlightCountForLiveDuration() {
  return 1;
}
