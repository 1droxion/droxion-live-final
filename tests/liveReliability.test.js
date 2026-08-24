import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMediaEnabledState,
  canCompleteLiveReadReconciliation,
  captureLiveReadSubscriptionState,
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
