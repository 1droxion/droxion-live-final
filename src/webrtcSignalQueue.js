export async function processIncomingCallSignals({
  rows,
  pcRef,
  pendingIce,
  isInitiator,
  flushPendingIce,
  sendSignal,
  lastSignalId,
}) {
  const pc = pcRef.current;
  if (!pc || pc.signalingState === 'closed') return false;

  for (const row of rows || []) {
    let handled = false;

    try {
      if (row.signal_type === 'offer' && !isInitiator) {
        await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
        await flushPendingIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal('answer', pc.localDescription?.toJSON?.() || answer);
        handled = true;
      } else if (row.signal_type === 'answer' && isInitiator) {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
          await flushPendingIce(pc);
        }
        handled = true;
      } else if (row.signal_type === 'ice') {
        const candidate = new RTCIceCandidate(row.payload);
        if (pc.remoteDescription) {
          await pc.addIceCandidate(candidate);
        } else {
          pendingIce.current.push(candidate);
        }
        handled = true;
      } else {
        // Ignore signals that do not apply to this side, but do not re-read them forever.
        handled = true;
      }
    } catch (error) {
      console.warn('WebRTC signal handling error', row.signal_type, error);

      if (row.signal_type === 'ice') {
        try {
          pendingIce.current.push(new RTCIceCandidate(row.payload));
          handled = true;
        } catch {}
      }
    }

    if (!handled) return false;
    lastSignalId.current = Math.max(lastSignalId.current, Number(row.id));
  }

  return true;
}
