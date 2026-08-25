export async function retryLiveReconnect({
  delays,
  wait,
  shouldAbort,
  attempt,
  onFailure,
  shouldStop
}) {
  let lastError = null;
  for (const delay of delays) {
    if (shouldAbort()) return { aborted: true };
    await wait(delay);
    if (shouldAbort()) return { aborted: true };

    try {
      return { aborted: false, value: await attempt() };
    } catch (error) {
      lastError = error;
      await onFailure(error);
      if (shouldStop(error)) break;
    }
  }

  throw lastError || new Error('LIVE reconnect failed.');
}

export function captureLiveReadSubscriptionState(stream, queue) {
  return {
    generation: stream.generation,
    ready: stream.ready,
    reconcile: stream.reconcile[queue],
  };
}

export function canCompleteLiveReadReconciliation(stream, snapshot) {
  return Boolean(
    snapshot.ready
    && snapshot.reconcile
    && stream.generation === snapshot.generation
    && stream.ready
  );
}

export function liveSafetyReconcileDelay(
  attempt,
  { baseMs = 60000, maxMs = 300000, jitterRatio = 0.2, random = Math.random } = {}
) {
  const exponential = Math.min(maxMs, baseMs * (2 ** Math.max(0, Number(attempt) || 0)));
  const jitter = Math.max(0, Math.min(1, jitterRatio));
  const factor = (1 - jitter) + (2 * jitter * Math.max(0, Math.min(1, random())));
  return Math.round(exponential * factor);
}

export function markLiveQueueForReconciliation(stream, queue, now = Date.now()) {
  if (!stream?.reconcile || !stream?.nextAuthoritativeAt) return stream;
  stream.reconcile[queue] = true;
  stream.nextAuthoritativeAt[queue] = now;
  stream.safetyAttempt[queue] = 0;
  return stream;
}

export function liveQueueNeedsAuthoritativeRead(stream, queue, now = Date.now()) {
  if (!stream) return true;
  return now >= Number(stream.nextAuthoritativeAt?.[queue] || 0);
}

export function canDecorateLiveRoom(room) {
  return Boolean(room?.isConnected && room?.matches?.('.liveRoomV4'));
}

export function shouldEnterGuestMode({ requestId, status, guestMode, voluntarilyExitedRequestId }) {
  return status === 'accepted'
    && !guestMode
    && String(requestId || '') !== String(voluntarilyExitedRequestId || '');
}

export function hasLiveGuest({ guestMode, guestVideoReady }) {
  return Boolean(guestMode || guestVideoReady);
}

export function actionableJoinRequests(rows) {
  return (rows || []).filter(row => !row?.status || ['requested', 'pending'].includes(row.status));
}

export function liveGuestEventTargetsUser(row, userId) {
  const expected = String(userId || '');
  if (!expected) return false;
  const metadata = row?.metadata || {};
  const candidates = [
    row?.actor_id,
    row?.target_user_id,
    row?.recipient_id,
    row?.guest_id,
    metadata.user_id,
    metadata.target_user_id,
    metadata.recipient_id,
    metadata.requester_id,
    metadata.request_user_id,
    metadata.invitee_id,
    metadata.guest_id,
    metadata.participant_id,
  ];
  return candidates.some(value => String(value || '') === expected);
}

export function liveChatRowFromWrite(data, { body, senderId, displayName, now = () => new Date().toISOString() }) {
  const id = data?.chat_id ?? data?.message_id ?? data?.id;
  if (id == null || id === '') return null;
  return {
    id: Number.isFinite(Number(id)) ? Number(id) : id,
    sender_id: senderId,
    display_name: data?.display_name || displayName || 'You',
    avatar_url: data?.avatar_url || null,
    body,
    created_at: data?.created_at || now(),
  };
}

export function liveFeedWindow(rows, visibleCount) {
  return (rows || []).slice(0, Math.max(0, Number(visibleCount) || 0));
}

export function applyMediaEnabledState(mediaStream, { cameraOn, micOn }) {
  mediaStream?.getVideoTracks?.().forEach(track => { track.enabled = Boolean(cameraOn); });
  mediaStream?.getAudioTracks?.().forEach(track => { track.enabled = Boolean(micOn); });
  return mediaStream;
}

export function stableLiveEventId(row) {
  const id = row?.id ?? row?.gift_id ?? row?.chat_id;
  return id == null || id === '' ? null : String(id);
}

export function stableLiveGuestEventId(row) {
  const metadata = row?.metadata || {};
  const id = metadata.request_id ?? row?.request_id
    ?? metadata.invite_id ?? row?.invite_id
    ?? metadata.guest_id ?? row?.guest_id
    ?? metadata.target_user_id ?? row?.target_user_id
    ?? row?.id;
  return id == null || id === '' ? null : String(id);
}

export function mergeStableLiveEvents(current, incoming, limit = 200) {
  const merged = new Map();
  for (const row of [...(current || []), ...(incoming || [])]) {
    const id = stableLiveEventId(row);
    if (id) merged.set(id, row);
  }
  return Array.from(merged.values()).slice(-limit);
}

export function appendBoundedStableLiveEvent(rows, ids, row, limit = 200) {
  const id = stableLiveEventId(row);
  if (!id || ids.has(id)) return false;
  ids.add(id);
  rows.push(row);
  while (rows.length > limit) {
    const removed = rows.shift();
    const removedId = stableLiveEventId(removed);
    if (removedId) ids.delete(removedId);
  }
  return true;
}

export function replaceBoundedStableLiveEvents(current, incoming, ids, limit = 200) {
  const rows = mergeStableLiveEvents(current, incoming, limit);
  ids.clear();
  for (const row of rows) {
    const id = stableLiveEventId(row);
    if (id) ids.add(id);
  }
  return rows;
}

export function createLiveEventBatcher({
  schedule = callback => globalThis.requestAnimationFrame(callback),
  cancel = handle => globalThis.cancelAnimationFrame(handle),
  flush,
} = {}) {
  const pending = { chat: new Map(), gift: new Map(), guest: new Map() };
  let scheduled = null;
  let closed = false;

  const drain = () => {
    scheduled = null;
    if (closed) return;
    const batch = {
      chat: Array.from(pending.chat.values()),
      gift: Array.from(pending.gift.values()),
      guest: Array.from(pending.guest.values()),
    };
    pending.chat.clear();
    pending.gift.clear();
    pending.guest.clear();
    if (batch.chat.length || batch.gift.length || batch.guest.length) flush?.(batch);
  };

  return {
    enqueue(type, row) {
      if (closed || !pending[type]) return false;
      const id = type === 'guest' ? stableLiveGuestEventId(row) : stableLiveEventId(row);
      if (!id) return false;
      pending[type].set(id, row);
      if (scheduled == null) scheduled = schedule(drain);
      return true;
    },
    flush: drain,
    dispose() {
      closed = true;
      if (scheduled != null) cancel(scheduled);
      scheduled = null;
      pending.chat.clear();
      pending.gift.clear();
      pending.guest.clear();
    },
  };
}

export function livePendingRecoveryDelay(attempt, {
  baseMs = 1000,
  maxMs = 30000,
  jitterRatio = 0.15,
  random = Math.random,
} = {}) {
  return liveSafetyReconcileDelay(attempt, { baseMs, maxMs, jitterRatio, random });
}

export function createLiveDeliveryProbe({
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  wallNow = () => Date.now(),
  limit = 100,
} = {}) {
  const records = new Map();
  const pendingSends = new Map();
  const lifecycle = [];

  const trim = () => {
    while (records.size > limit) records.delete(records.keys().next().value);
  };

  return {
    startSend(eventType) {
      const startedAt = now();
      pendingSends.set(eventType, startedAt);
      return startedAt;
    },
    cancelSend(eventType) {
      pendingSends.delete(eventType);
    },
    mark({ eventType, eventId, phase, source = '', createdAt = '' }) {
      if (!eventType || eventId == null || eventId === '' || !phase) return null;
      const key = `${eventType}:${String(eventId)}`;
      const record = records.get(key) || {
        eventType,
        eventId: String(eventId),
        source,
        phases: {},
      };
      if (phase === 'write_success' && pendingSends.has(eventType)) {
        record.phases.send_start = pendingSends.get(eventType);
        pendingSends.delete(eventType);
      }
      record.phases[phase] = now();
      record.source = source || record.source;
      if (createdAt) {
        const created = Date.parse(createdAt);
        if (Number.isFinite(created)) record.eventAgeMs = Math.max(0, wallNow() - created);
      }
      if (record.phases.send_start != null && record.phases.render_committed != null) {
        record.sendToRenderMs = record.phases.render_committed - record.phases.send_start;
      }
      if (record.phases.realtime_callback != null && record.phases.render_committed != null) {
        record.callbackToRenderMs = record.phases.render_committed - record.phases.realtime_callback;
      }
      records.delete(key);
      records.set(key, record);
      trim();
      return { ...record, phases: { ...record.phases } };
    },
    snapshot() {
      return Array.from(records.values(), record => ({ ...record, phases: { ...record.phases } }));
    },
    markLifecycle(phase, details = {}) {
      if (!phase) return null;
      const record = { phase, timestamp: wallNow(), ...details };
      lifecycle.push(record);
      if (lifecycle.length > limit) lifecycle.splice(0, lifecycle.length - limit);
      return { ...record };
    },
    lifecycleSnapshot() {
      return lifecycle.map(record => ({ ...record }));
    },
  };
}

export function liveGiftReconciliationCursor(value, overlapMs = 5000) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? new Date(timestamp - overlapMs).toISOString() : value;
}

export function microphoneStateMatches({ browserTracks, publications, muted }) {
  const liveBrowserTracks = (browserTracks || []).filter(track => track?.readyState !== 'ended');
  const livePublications = (publications || []).filter(publication => publication?.track?.mediaStreamTrack?.readyState !== 'ended');
  const browserMatches = liveBrowserTracks.every(track => track.enabled === !muted);
  if (muted && livePublications.length === 0) return browserMatches;
  return browserMatches
    && livePublications.length === 1
    && Boolean(livePublications[0].isMuted) === Boolean(muted);
}
