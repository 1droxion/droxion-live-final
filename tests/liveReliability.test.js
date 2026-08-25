import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMediaEnabledState,
  canCompleteLiveReadReconciliation,
  captureLiveReadSubscriptionState,
  liveGiftReconciliationCursor,
  mergeStableLiveEvents,
  microphoneStateMatches,
  retryLiveReconnect,
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
