import { supabase } from '../../../supabaseClient';

const FLUSH_MS = 180;
const MAX_BATCH = 8;

function safeCount(value) {
  return Math.max(1, Math.min(MAX_BATCH, Number(value) || 1));
}

export function createLiveReactionChannel({ sessionId, onReaction }) {
  if (!sessionId) return { sendHeart: () => false, dispose: () => {} };

  let disposed = false;
  let ready = false;
  let queuedHearts = 0;
  let flushTimer = null;

  const channel = supabase
    .channel(`droxion-live-reactions:${sessionId}`, {
      config: {
        broadcast: { self: false, ack: false }
      }
    })
    .on('broadcast', { event: 'reaction' }, ({ payload }) => {
      if (disposed || payload?.kind !== 'heart') return;
      const count = safeCount(payload?.count);
      try { onReaction?.({ kind: 'heart', count, source: 'remote' }); } catch {}
    });

  channel.subscribe(status => {
    ready = status === 'SUBSCRIBED';
  });

  const flush = () => {
    flushTimer = null;
    if (disposed || queuedHearts <= 0) return;

    const count = safeCount(queuedHearts);
    queuedHearts = Math.max(0, queuedHearts - count);

    if (ready) {
      Promise.resolve(channel.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { kind: 'heart', count }
      })).catch(() => {});
    }

    if (queuedHearts > 0 && !disposed) flushTimer = window.setTimeout(flush, FLUSH_MS);
  };

  const sendHeart = () => {
    if (disposed) return false;
    queuedHearts = Math.min(MAX_BATCH * 2, queuedHearts + 1);
    if (!flushTimer) flushTimer = window.setTimeout(flush, FLUSH_MS);
    return true;
  };

  const dispose = () => {
    disposed = true;
    ready = false;
    queuedHearts = 0;
    if (flushTimer) window.clearTimeout(flushTimer);
    flushTimer = null;
    try { Promise.resolve(supabase.removeChannel(channel)).catch(() => {}); } catch {}
  };

  return { sendHeart, dispose };
}
