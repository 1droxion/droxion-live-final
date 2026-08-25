import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  actionableJoinRequests,
  appendBoundedStableLiveEvent,
  applyMediaEnabledState,
  canDecorateLiveRoom,
  canCompleteLiveReadReconciliation,
  captureLiveReadSubscriptionState,
  createLiveDeliveryProbe,
  createLiveEventBatcher,
  hasLiveGuest,
  liveChatRowFromWrite,
  liveGiftReconciliationCursor,
  liveFeedWindow,
  liveGuestEventTargetsUser,
  livePendingRecoveryDelay,
  liveQueueNeedsAuthoritativeRead,
  liveSafetyReconcileDelay,
  markLiveQueueForReconciliation,
  mergeStableLiveEvents,
  microphoneStateMatches,
  retryLiveReconnect,
  shouldEnterGuestMode,
} from '../src/livekit/reliabilityState.js';

const liveComponentSource = fs.readFileSync(new URL('../src/LiveExperienceScale.jsx', import.meta.url), 'utf8');
const liveCssSource = fs.readFileSync(new URL('../src/live-experience-v4.css', import.meta.url), 'utf8');
const supabaseSource = fs.readFileSync(new URL('../src/supabaseClient.js', import.meta.url), 'utf8');
const cameraEnhancerSource = fs.readFileSync(new URL('../src/LiveCameraStartupEnhancer.jsx', import.meta.url), 'utf8');
const androidPrepareSource = fs.readFileSync(new URL('../scripts/prepare-android.sh', import.meta.url), 'utf8');
const codemagicSource = fs.readFileSync(new URL('../codemagic.yaml', import.meta.url), 'utf8');
const qualityGateSource = fs.readFileSync(new URL('../.github/workflows/quality-gate.yml', import.meta.url), 'utf8');

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

test('accepted guest uses viewport orientation for a real rotating 50/50 layout', () => {
  assert.equal(hasLiveGuest({ guestMode: false, guestVideoReady: false }), false);
  assert.equal(hasLiveGuest({ guestMode: true, guestVideoReady: false }), true);
  assert.equal(hasLiveGuest({ guestMode: false, guestVideoReady: true }), true);
  assert.match(liveComponentSource, /hasGuestStage \? 'liveStage-split'/);
  assert.match(liveCssSource, /\.liveStage-split \.liveMainVideo[\s\S]*height: 50%/);
  assert.match(liveCssSource, /@media \(orientation: landscape\)[\s\S]*liveStage-split[\s\S]*width: 50%/);
  assert.doesNotMatch(liveCssSource, /liveRoom-horizontal \.liveStage-split/);
  assert.match(cameraEnhancerSource, /@media \(orientation: landscape\)[\s\S]*liveStage-split/);
  assert.doesNotMatch(cameraEnhancerSource, /:has\(\.liveGuestVideo\)/);
  assert.doesNotMatch(cameraEnhancerSource, /liveRoom-horizontal[\s\S]*liveStage-split/);
  assert.match(liveCssSource, /liveStage-split[\s\S]*object-fit: cover/);
});

test('host guest management is only exposed through the three-dot menu', () => {
  assert.match(liveComponentSource, /className="liveGuestMenuButton"/);
  assert.match(liveComponentSource, /<MoreHorizontal size=\{22\}/);
  assert.match(liveComponentSource, /className="liveGuestMenu" role="menu"/);
  assert.doesNotMatch(liveComponentSource, /className="liveGuestManagement"/);
  assert.match(liveComponentSource, /activeGuestId && guestVideoReady/);
  assert.match(liveComponentSource, /invalidateLiveGuestState\(sessionId\)[\s\S]*setGuestStateRevision/);
  assert.doesNotMatch(liveComponentSource, /roomStatus\?\.guest_id, disconnectTransport/);
});

test('join, invite, accept, decline, remove and block events target only affected guest clients', () => {
  const viewer = 'viewer-1';
  assert.equal(liveGuestEventTargetsUser({ event_type: 'guest_state', actor_id: viewer, metadata: { action: 'requested' } }, viewer), true);
  assert.equal(liveGuestEventTargetsUser({ event_type: 'guest_state', actor_id: 'host', metadata: { requester_id: viewer, action: 'accepted' } }, viewer), true);
  assert.equal(liveGuestEventTargetsUser({ event_type: 'guest_state', actor_id: 'host', metadata: { requester_id: viewer, action: 'declined' } }, viewer), true);
  assert.equal(liveGuestEventTargetsUser({ event_type: 'guest_state', actor_id: 'host', metadata: { invitee_id: viewer, action: 'invited' } }, viewer), true);
  assert.equal(liveGuestEventTargetsUser({ event_type: 'guest_state', actor_id: 'host', metadata: { guest_id: viewer, action: 'removed' } }, viewer), true);
  assert.equal(liveGuestEventTargetsUser({ event_type: 'guest_state', actor_id: 'host', metadata: { target_user_id: viewer, action: 'blocked' } }, viewer), true);
  assert.equal(liveGuestEventTargetsUser({ event_type: 'guest_state', actor_id: 'other', metadata: { invitee_id: 'other' } }, viewer), false);
});

test('stale requests cannot remain actionable after authoritative replacement', () => {
  assert.deepEqual(actionableJoinRequests([
    { request_id: '1', status: 'requested' },
    { request_id: '2', status: 'accepted' },
    { request_id: '3', status: 'declined' },
    { request_id: '4', status: 'expired' },
  ]).map(row => row.request_id), ['1']);
  assert.doesNotMatch(liveComponentSource, /This request is no longer available/);
  assert.match(liveComponentSource, /setJoinRequests\(current => current\.filter[\s\S]*droxion_respond_live_join_request/);
  assert.match(liveComponentSource, /droxion_live_join_requests[\s\S]*authoritative\.some/);
});

test('guest state invalidates invites and React subscribes directly instead of fast polling', () => {
  assert.match(supabaseSource, /key\.startsWith\("droxion_my_live_invite:"\)/);
  assert.match(supabaseSource, /notifyLiveEventSubscribers\(stream, \{ type: "guest_state"/);
  assert.match(liveComponentSource, /subscribeLiveEvents\(sessionId/);
  assert.doesNotMatch(liveComponentSource, /setInterval\(poll, (800|900|1200|1500|2500)\)/);
});

test('foreground, focus, pageshow and online restart realtime with immediate catch-up', () => {
  assert.match(supabaseSource, /export function recoverLiveEventStream/);
  assert.match(supabaseSource, /catchUpLiveEventStream\(sessionId, stream, generation\)/);
  assert.match(supabaseSource, /originalRpc\("droxion_live_chat_messages"/);
  assert.match(supabaseSource, /originalRpc\("droxion_live_gift_events"/);
  assert.match(liveComponentSource, /recoverLiveEventStream\(sessionId, event\?\.type \|\| 'foreground'\)/);
  assert.match(liveComponentSource, /addEventListener\('online', recoverOnline\)/);
  assert.doesNotMatch(liveComponentSource, /setInterval\(poll, (1000|2000|3000)\)/);
});

test('delivery diagnostics measure send and realtime callback through React commit', () => {
  let time = 100;
  const probe = createLiveDeliveryProbe({ now: () => time, wallNow: () => 1000, limit: 2 });
  probe.startSend('chat');
  time = 140;
  probe.mark({ eventType: 'chat', eventId: 9, phase: 'write_success', source: 'sender' });
  time = 180;
  probe.mark({ eventType: 'chat', eventId: 9, phase: 'realtime_callback', source: 'realtime' });
  time = 184;
  const result = probe.mark({ eventType: 'chat', eventId: 9, phase: 'render_committed' });
  assert.equal(result.sendToRenderMs, 84);
  assert.equal(result.callbackToRenderMs, 4);
  assert.equal(probe.snapshot().length, 1);
  assert.equal(probe.markLifecycle('catchup_complete', { sessionId: 'room-1' }).sessionId, 'room-1');
  assert.equal(probe.lifecycleSnapshot()[0].phase, 'catchup_complete');
  assert.match(liveComponentSource, /__droxionLiveDeliveryDiagnostics/);
});

test('chat and gift bursts deduplicate in O(1) queues and flush once per frame', () => {
  const callbacks = [];
  const flushed = [];
  const batcher = createLiveEventBatcher({
    schedule: callback => { callbacks.push(callback); return callbacks.length; },
    cancel: () => {},
    flush: batch => flushed.push(batch),
  });
  const started = performance.now();
  for (let index = 0; index < 1000; index += 1) {
    batcher.enqueue('chat', { id: index % 500, body: `message-${index}` });
    batcher.enqueue('gift', { id: `gift-${index % 250}` });
  }
  const queuedMs = performance.now() - started;
  assert.equal(callbacks.length, 1);
  callbacks[0]();
  assert.equal(flushed.length, 1);
  assert.equal(flushed[0].chat.length, 500);
  assert.equal(flushed[0].gift.length, 250);
  console.log(JSON.stringify({ chatGiftBurstEvents: 2000, uniqueEvents: 750, queuedMs: Number(queuedMs.toFixed(3)), reactFlushes: 1 }));
});

test('join and invite bursts preserve latest entity state and flush once per frame', () => {
  const callbacks = [];
  const flushed = [];
  const batcher = createLiveEventBatcher({
    schedule: callback => { callbacks.push(callback); return callbacks.length; },
    cancel: () => {},
    flush: batch => flushed.push(batch),
  });
  const started = performance.now();
  for (let index = 0; index < 1000; index += 1) {
    const requestId = `request-${index % 500}`;
    const inviteId = `invite-${index % 250}`;
    batcher.enqueue('guest', { id: `join-event-${index}`, metadata: { request_id: requestId, action: index < 500 ? 'requested' : 'accepted' } });
    batcher.enqueue('guest', { id: `invite-event-${index}`, metadata: { invite_id: inviteId, action: 'invited' } });
  }
  const queuedMs = performance.now() - started;
  assert.equal(callbacks.length, 1);
  callbacks[0]();
  assert.equal(flushed.length, 1);
  assert.equal(flushed[0].guest.length, 750);
  assert.equal(flushed[0].guest.filter(row => row.metadata.request_id).every(row => row.metadata.action === 'accepted'), true);
  console.log(JSON.stringify({ joinInviteBurstEvents: 2000, uniqueEntities: 750, queuedMs: Number(queuedMs.toFixed(3)), reactFlushes: 1 }));
});

test('chat and gift UI state is isolated from the parent LIVE render tree', () => {
  assert.match(liveComponentSource, /const LiveEventOverlay = memo/);
  assert.match(liveComponentSource, /<LiveEventOverlay sessionId=\{sessionId\} \/>/);
  assert.match(supabaseSource, /applyAuthoritativeLiveRows\(stream, queue, response\.data\)/);
  assert.match(liveComponentSource, /isHostRoom \? 15000 : 300000/);
});

test('bounded stable event index caps memory and rejects duplicate IDs', () => {
  const rows = [];
  const ids = new Set();
  for (let id = 0; id < 1000; id += 1) appendBoundedStableLiveEvent(rows, ids, { id }, 200);
  assert.equal(rows.length, 200);
  assert.equal(ids.size, 200);
  assert.equal(appendBoundedStableLiveEvent(rows, ids, { id: 999 }, 200), false);
  assert.equal(rows[0].id, 800);
});

test('pending guest recovery starts near one second and backs off while idle users stop', () => {
  assert.equal(livePendingRecoveryDelay(0, { random: () => 0.5 }), 1000);
  assert.equal(livePendingRecoveryDelay(1, { random: () => 0.5 }), 2000);
  assert.equal(livePendingRecoveryDelay(8, { random: () => 0.5 }), 30000);
  assert.match(liveComponentSource, /authoritativeLiveRpc\('droxion_live_join_requests'/);
  assert.match(liveComponentSource, /authoritativeLiveRpc\('droxion_my_live_join_request'/);
  assert.match(liveComponentSource, /authoritativeLiveRpc\('droxion_my_live_invite'/);
  assert.doesNotMatch(liveComponentSource, /window\.setTimeout\(poll, 30000\)/);
});

test('guest realtime recovery does not refetch the full viewer list', () => {
  assert.match(liveComponentSource, /droxion_live_room_viewers[\s\S]*\.slice\(0, 100\)/);
  assert.doesNotMatch(liveComponentSource, /activeRoom\?\.user_id, guestStateRevision/);
  assert.match(supabaseSource, /export function authoritativeLiveRpc/);
});

test('guest event payloads apply safe invite and removal state before recovery reads', () => {
  assert.match(liveComponentSource, /action === 'invited'[\s\S]*setInvite\(\{/);
  assert.match(liveComponentSource, /\['removed', 'blocked'\]\.includes\(action\)[\s\S]*setGuestMode\(false\)/);
  assert.match(liveComponentSource, /setGuestStateRevision\(value => value \+ 1\)/);
});

test('Android preparation prunes legacy demo videos after its final web build', () => {
  assert.match(androidPrepareSource, /npm run build[\s\S]*find dist[\s\S]*20250520[\s\S]*npx cap sync android/);
  assert.match(androidPrepareSource, /find android\/app\/src\/main\/assets[\s\S]*20250520/);
  assert.match(codemagicSource, /unzip -Z1 "\$AAB" \| grep -qi '20250520'/);
  assert.match(codemagicSource, /Android AAB bytes/);
  assert.match(qualityGateSource, /Build and inspect unsigned release AAB[\s\S]*bundleRelease/);
  assert.match(qualityGateSource, /unzip -Z1 "\$AAB" \| grep -qi '20250520'/);
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

test('successful chat writes render immediately and realtime reconciliation does not duplicate them', () => {
  const optimistic = liveChatRowFromWrite(
    { allowed: true, chat_id: 84, created_at: '2026-08-24T23:00:03.000Z' },
    { body: 'Instant', senderId: 'viewer-1', displayName: 'You' }
  );
  const reconciled = mergeStableLiveEvents([optimistic], [{ ...optimistic, display_name: 'Dhruv' }]);
  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].display_name, 'Dhruv');
  assert.match(supabaseSource, /notifyLiveEventSubscribers\(stream, \{ type: "chat"/);
  assert.match(supabaseSource, /notifyLiveEventSubscribers\(stream, \{ type: "gift"/);
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
