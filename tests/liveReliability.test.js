import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMediaEnabledState,
  canDecorateLiveRoom,
  canCompleteLiveReadReconciliation,
  captureLiveReadSubscriptionState,
  liveGiftReconciliationCursor,
  liveFeedWindow,
  liveQueueNeedsAuthoritativeRead,
  liveSafetyReconcileDelay,
  markLiveQueueForReconciliation,
  mergeStableLiveEvents,
  microphoneStateMatches,
  retryLiveReconnect,
  shouldEnterGuestMode,
} from '../src/livekit/reliabilityState.js';

test('reconnect exhaustion rejects with the final failure', async () => {
  const failures = [new Error('first'), new Error('final')];
  let attempts = 0;

  await assert.rejects(
    retryLiveReconnect({
      delays: [0, 0],
      wait: async () => {},
      shouldAbort: () => false,
      attempt: async () => { throw failures[attempts++]; },
      onFailure: async () => {},
      shouldStop: () => false,
    }),
    /final/
  );
  assert.equal(attempts, 2);
});

test('a channel becoming ready during an RPC cannot clear reconciliation', () => {
  const stream = { generation: 4, ready: false, reconcile: { chat: true } };
  const snapshot = captureLiveReadSubscriptionState(stream, 'chat');
  stream.ready = true;

  assert.equal(canCompleteLiveReadReconciliation(stream, snapshot), false);
  assert.equal(stream.reconcile.chat, true);
});

test('an RPC started after subscription activation can complete reconciliation', () => {
  const stream = { generation: 4, ready: true, reconcile: { gifts: true } };
  const snapshot = captureLiveReadSubscriptionState(stream, 'gifts');

  assert.equal(canCompleteLiveReadReconciliation(stream, snapshot), true);
  stream.generation += 1;
  assert.equal(canCompleteLiveReadReconciliation(stream, snapshot), false);
});

test('healthy reconciliation backs off with bounded deterministic jitter', () => {
  assert.equal(liveSafetyReconcileDelay(0, { random: () => 0.5 }), 60000);
  assert.equal(liveSafetyReconcileDelay(2, { random: () => 0.5 }), 240000);
  assert.equal(liveSafetyReconcileDelay(8, { random: () => 0.5 }), 300000);
  assert.equal(liveSafetyReconcileDelay(0, { random: () => 0 }), 48000);
});

test('reconnect, foreground and successful sends can force the next authoritative read', () => {
  const stream = {
    reconcile: { chat: false },
    nextAuthoritativeAt: { chat: 999999 },
    safetyAttempt: { chat: 5 },
  };
  assert.equal(liveQueueNeedsAuthoritativeRead(stream, 'chat', 100), false);
  markLiveQueueForReconciliation(stream, 'chat', 100);
  assert.equal(stream.reconcile.chat, true);
  assert.equal(stream.safetyAttempt.chat, 0);
  assert.equal(liveQueueNeedsAuthoritativeRead(stream, 'chat', 100), true);
});

test('a late LIVE context response cannot decorate a root React reused for Home', () => {
  const root = { isConnected: true, matches: selector => selector === '.liveOnlyHome' };
  assert.equal(canDecorateLiveRoom(root), false);
  root.matches = selector => selector === '.liveRoomV4';
  assert.equal(canDecorateLiveRoom(root), true);
});

test('voluntary guest exit blocks only the stale accepted request from republishing media', () => {
  assert.equal(shouldEnterGuestMode({ requestId: 'old', status: 'accepted', guestMode: false, voluntarilyExitedRequestId: 'old' }), false);
  assert.equal(shouldEnterGuestMode({ requestId: 'new', status: 'accepted', guestMode: false, voluntarilyExitedRequestId: 'old' }), true);
  assert.equal(shouldEnterGuestMode({ requestId: 'new', status: 'declined', guestMode: false, voluntarilyExitedRequestId: 'old' }), false);
});

test('Home renders a bounded LIVE listing window', () => {
  const rows = Array.from({ length: 100 }, (_, id) => ({ id }));
  assert.equal(liveFeedWindow(rows, 12).length, 12);
  assert.deepEqual(liveFeedWindow(rows, 24).map(row => row.id), Array.from({ length: 24 }, (_, id) => id));
});

test('foreground media intent is applied to both browser track kinds', () => {
  const video = { enabled: true };
  const audio = { enabled: true };
  const stream = {
    getVideoTracks: () => [video],
    getAudioTracks: () => [audio],
  };

  applyMediaEnabledState(stream, { cameraOn: false, micOn: false });
  assert.equal(video.enabled, false);
  assert.equal(audio.enabled, false);
});

test('chat and gift reconciliation replaces duplicate stable IDs without double rendering', () => {
  const current = [
    { id: 41, body: 'Hi', created_at: '2026-08-24T23:00:00.000Z' },
    { id: 'gift-9', gift_name: 'Rose', created_at: '2026-08-24T23:00:01.000Z' },
  ];
  const reconciled = mergeStableLiveEvents(current, [
    { id: 41, body: 'Hi', display_name: 'Dhruv', created_at: '2026-08-24T23:00:00.000Z' },
    { id: 'gift-9', gift_name: 'Rose', emoji: '🌹', created_at: '2026-08-24T23:00:01.000Z' },
    { id: 42, body: 'Visible everywhere', created_at: '2026-08-24T23:00:02.000Z' },
  ]);

  assert.deepEqual(reconciled.map(row => String(row.id)), ['41', 'gift-9', '42']);
  assert.equal(reconciled[0].display_name, 'Dhruv');
  assert.equal(reconciled[1].emoji, '🌹');
});

test('gift reconciliation overlaps the timestamp cursor to recover equal-time events', () => {
  assert.equal(
    liveGiftReconciliationCursor('2026-08-24T23:00:10.000Z'),
    '2026-08-24T23:00:05.000Z'
  );
});

test('microphone mute is synchronized only when browser and sole publication agree', () => {
  const browserTrack = { enabled: false, readyState: 'live' };
  const mutedPublication = { isMuted: true, track: { mediaStreamTrack: { readyState: 'live' } } };
  const transmittingDuplicate = { isMuted: false, track: { mediaStreamTrack: { readyState: 'live' } } };

  assert.equal(microphoneStateMatches({ browserTracks: [browserTrack], publications: [mutedPublication], muted: true }), true);
  assert.equal(microphoneStateMatches({ browserTracks: [browserTrack], publications: [mutedPublication, transmittingDuplicate], muted: true }), false);
  assert.equal(microphoneStateMatches({ browserTracks: [{ ...browserTrack, enabled: true }], publications: [mutedPublication], muted: true }), false);
});

test('microphone unmute requires one live unmuted publication and an enabled browser track', () => {
  const publication = { isMuted: false, track: { mediaStreamTrack: { readyState: 'live' } } };
  assert.equal(microphoneStateMatches({
    browserTracks: [{ enabled: true, readyState: 'live' }],
    publications: [publication],
    muted: false,
  }), true);
  assert.equal(microphoneStateMatches({
    browserTracks: [{ enabled: true, readyState: 'live' }],
    publications: [],
    muted: false,
  }), false);
});
