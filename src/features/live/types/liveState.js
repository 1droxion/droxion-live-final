export const LIVE_PHASE = Object.freeze({
  IDLE: 'idle',
  PREVIEW: 'preview',
  STARTING: 'starting',
  CONNECTING: 'connecting',
  LIVE: 'live',
  RECONNECTING: 'reconnecting',
  ENDING: 'ending',
  ERROR: 'error'
});

export const LIVE_PHASE_LABEL = Object.freeze({
  [LIVE_PHASE.IDLE]: 'Ready',
  [LIVE_PHASE.PREVIEW]: 'Camera ready',
  [LIVE_PHASE.STARTING]: 'Starting LIVE',
  [LIVE_PHASE.CONNECTING]: 'Connecting video',
  [LIVE_PHASE.LIVE]: 'You are live',
  [LIVE_PHASE.RECONNECTING]: 'Reconnecting',
  [LIVE_PHASE.ENDING]: 'Ending LIVE',
  [LIVE_PHASE.ERROR]: 'LIVE error'
});

export function isLiveBusy(phase) {
  return [LIVE_PHASE.STARTING, LIVE_PHASE.CONNECTING, LIVE_PHASE.ENDING].includes(phase);
}

export function isBroadcastActive(phase) {
  return [LIVE_PHASE.LIVE, LIVE_PHASE.RECONNECTING].includes(phase);
}
