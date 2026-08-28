const SOUND_PREFERENCE_KEY = 'droxion_gift_sounds_enabled';
const MASTER_VOLUME = 0.42;
const PENDING_SOUND_WINDOW_MS = 6000;

let audioContext = null;
let masterGain = null;
let unlocked = false;
let globalUnlockInstalled = false;
let pendingGiftSound = null;

function soundsEnabled() {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;

  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextCtor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = MASTER_VOLUME;
    masterGain.connect(audioContext.destination);
    unlocked = audioContext.state === 'running';
  }
  return audioContext;
}

function commitOutputRoute(context) {
  if (!context || !masterGain) return;
  try {
    // A nearly silent pulse inside a real user gesture helps iOS/WebKit and
    // embedded WebViews commit Web Audio to the current device output route.
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.frequency.value = 220;
    gain.gain.setValueAtTime(0.00001, now);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.025);
  } catch {}
}

function queuePendingGiftSound(gift, presentation) {
  pendingGiftSound = {
    gift,
    presentation,
    expiresAt: Date.now() + PENDING_SOUND_WINDOW_MS
  };
}

function flushPendingGiftSound() {
  const pending = pendingGiftSound;
  pendingGiftSound = null;
  if (!pending || pending.expiresAt < Date.now()) return;
  window.setTimeout(() => {
    playGiftSound(pending.gift, pending.presentation).catch(() => {});
  }, 0);
}

export function setGiftSoundsEnabled(enabled) {
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? 'true' : 'false');
  } catch {}
  if (!enabled) pendingGiftSound = null;
}

export function getGiftSoundsEnabled() {
  return soundsEnabled();
}

export function getGiftSoundReady() {
  return Boolean(unlocked && audioContext?.state === 'running');
}

export async function unlockGiftSound() {
  if (!soundsEnabled()) return false;
  const context = getAudioContext();
  if (!context) return false;
  const wasUnlocked = unlocked && context.state === 'running';

  try {
    if (context.state !== 'running') await context.resume();
    unlocked = context.state === 'running';

    if (unlocked && !wasUnlocked) {
      commitOutputRoute(context);
      flushPendingGiftSound();
    }
  } catch {
    unlocked = false;
  }
  return unlocked;
}

function installGlobalGiftSoundUnlock() {
  if (globalUnlockInstalled || typeof window === 'undefined' || typeof document === 'undefined') return;
  globalUnlockInstalled = true;

  const attemptUnlock = () => {
    if (!soundsEnabled()) return;
    unlockGiftSound().catch(() => {});
  };

  // Capture phase means the audio context is unlocked from the same physical
  // tap that opens a LIVE, starts a LIVE, opens gifts, sends chat, etc.
  document.addEventListener('pointerdown', attemptUnlock, { capture: true, passive: true });
  document.addEventListener('touchend', attemptUnlock, { capture: true, passive: true });
  document.addEventListener('click', attemptUnlock, { capture: true, passive: true });
  document.addEventListener('keydown', attemptUnlock, true);

  const markRouteForResume = () => {
    if (!audioContext) return;
    if (document.visibilityState === 'hidden' || audioContext.state !== 'running') {
      unlocked = false;
    }
  };
  document.addEventListener('visibilitychange', markRouteForResume);
  window.addEventListener('pageshow', markRouteForResume);
}

function tone(context, {
  frequency = 440,
  endFrequency = frequency,
  start = 0,
  duration = 0.25,
  gain = 0.08,
  type = 'sine',
  detune = 0
} = {}) {
  if (!masterGain) return;
  const now = context.currentTime + start;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(1, frequency), now);
  oscillator.detune.setValueAtTime(detune, now);
  if (endFrequency !== frequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
  }

  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + Math.min(0.045, duration * 0.2));
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(envelope);
  envelope.connect(masterGain);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function noiseSweep(context, {
  start = 0,
  duration = 0.45,
  gain = 0.045,
  low = 320,
  high = 4200,
  reverse = false
} = {}) {
  if (!masterGain) return;
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i += 1) {
    const position = i / frameCount;
    const envelope = reverse ? position : 1 - position;
    channel[i] = (Math.random() * 2 - 1) * envelope;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  const now = context.currentTime + start;

  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(Math.max(20, low), now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(21, high), now + duration);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(gain, now + Math.min(0.08, duration * 0.25));
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(masterGain);
  source.start(now);
  source.stop(now + duration + 0.02);
}

function impact(context, start = 0, strength = 1) {
  tone(context, {
    frequency: 92,
    endFrequency: 42,
    start,
    duration: 0.5,
    gain: 0.18 * strength,
    type: 'sine'
  });
  tone(context, {
    frequency: 180,
    endFrequency: 72,
    start: start + 0.008,
    duration: 0.25,
    gain: 0.07 * strength,
    type: 'triangle'
  });
  noiseSweep(context, {
    start,
    duration: 0.2,
    gain: 0.05 * strength,
    low: 120,
    high: 1100
  });
}

function sparkleChord(context, start = 0, strength = 1, root = 660) {
  [1, 1.25, 1.5, 2].forEach((ratio, index) => {
    tone(context, {
      frequency: root * ratio,
      endFrequency: root * ratio * 1.04,
      start: start + index * 0.055,
      duration: 0.4 + index * 0.03,
      gain: (0.05 - index * 0.004) * strength,
      type: index % 2 ? 'triangle' : 'sine'
    });
  });
}

function cinematicChord(context, start = 0, strength = 1, root = 220) {
  [1, 1.5, 2, 3].forEach((ratio, index) => {
    const frequency = root * ratio;
    tone(context, {
      frequency,
      endFrequency: frequency * 1.015,
      start: start + index * 0.025,
      duration: 1.2 - index * 0.08,
      gain: (0.068 - index * 0.006) * strength,
      type: index < 2 ? 'triangle' : 'sine'
    });
  });
}

function dragonSound(context) {
  noiseSweep(context, { duration: 0.55, gain: 0.08, low: 140, high: 2800 });
  tone(context, { frequency: 78, endFrequency: 48, start: 0.08, duration: 0.75, gain: 0.16, type: 'sawtooth' });
  impact(context, 0.5, 1.15);
  noiseSweep(context, { start: 0.7, duration: 1.25, gain: 0.12, low: 6200, high: 220, reverse: true });
  tone(context, { frequency: 120, endFrequency: 58, start: 0.72, duration: 1.1, gain: 0.08, type: 'triangle' });
}

function galaxySound(context) {
  tone(context, { frequency: 82, endFrequency: 180, duration: 1.1, gain: 0.1, type: 'sine' });
  noiseSweep(context, { duration: 1.0, gain: 0.08, low: 120, high: 7200 });
  sparkleChord(context, 0.22, 1.15, 720);
  impact(context, 0.92, 1.28);
  cinematicChord(context, 0.98, 1.05, 196);
}

function universeSound(context) {
  tone(context, { frequency: 44, endFrequency: 84, duration: 1.55, gain: 0.16, type: 'sine' });
  noiseSweep(context, { duration: 1.35, gain: 0.09, low: 70, high: 9000 });
  cinematicChord(context, 0.48, 1.18, 174);
  impact(context, 1.2, 1.42);
  sparkleChord(context, 1.32, 1.0, 840);
}

function royaltySound(context) {
  sparkleChord(context, 0, 1.0, 740);
  tone(context, { frequency: 110, endFrequency: 64, start: 0.34, duration: 0.85, gain: 0.13, type: 'triangle' });
  impact(context, 0.56, 1.4);
  cinematicChord(context, 0.64, 1.28, 220);
  sparkleChord(context, 1.02, 1.2, 920);
}

export async function playGiftSound(gift = {}, presentation = {}) {
  if (!soundsEnabled()) return false;
  const context = getAudioContext();
  if (!context) return false;

  if (context.state !== 'running') {
    try { await context.resume(); } catch {}
  }
  if (context.state !== 'running') {
    unlocked = false;
    queuePendingGiftSound(gift, presentation);
    return false;
  }

  unlocked = true;
  pendingGiftSound = null;

  const tier = String(presentation.tier || 'standard').toLowerCase();
  const profile = String(presentation.soundProfile || '').toLowerCase();
  const code = String(gift.gift_code || '').toLowerCase();
  const name = String(gift.gift_name || '').toLowerCase();
  const key = `${code} ${name}`;

  if (profile === 'dragon' || /dragon/.test(key)) {
    dragonSound(context);
    return true;
  }
  if (profile === 'galaxy' || /droxion galaxy/.test(key)) {
    galaxySound(context);
    return true;
  }
  if (profile === 'universe' || /droxion universe/.test(key)) {
    universeSound(context);
    return true;
  }
  if (profile === 'royalty' || /droxion royalty/.test(key)) {
    royaltySound(context);
    return true;
  }

  if (tier === 'standard') {
    tone(context, { frequency: 720, endFrequency: 980, duration: 0.22, gain: 0.09, type: 'sine' });
    tone(context, { frequency: 1080, endFrequency: 1380, start: 0.08, duration: 0.19, gain: 0.055, type: 'triangle' });
    return true;
  }

  if (tier === 'featured') {
    noiseSweep(context, { duration: 0.28, gain: 0.04, low: 480, high: 3200 });
    tone(context, { frequency: 420, endFrequency: 760, duration: 0.34, gain: 0.085, type: 'triangle' });
    sparkleChord(context, 0.12, 1.0, /crown/.test(key) ? 720 : 640);
    return true;
  }

  if (tier === 'premium') {
    noiseSweep(context, { duration: 0.52, gain: 0.07, low: 180, high: 5200 });
    impact(context, 0.08, 0.98);
    sparkleChord(context, 0.18, 1.15, /diamond/.test(key) ? 820 : 620);
    return true;
  }

  if (tier === 'elite') {
    noiseSweep(context, { duration: 0.78, gain: 0.08, low: 90, high: 6500 });
    tone(context, { frequency: 72, endFrequency: 108, duration: 0.72, gain: 0.11, type: 'sine' });
    impact(context, 0.36, 1.2);
    cinematicChord(context, 0.42, 1.05);
    return true;
  }

  noiseSweep(context, { duration: 1.05, gain: 0.09, low: 70, high: 7600 });
  tone(context, { frequency: 58, endFrequency: 86, duration: 0.9, gain: 0.13, type: 'sine' });
  impact(context, 0.46, 1.35);
  cinematicChord(context, 0.5, 1.2);
  sparkleChord(context, 0.78, 1.0, /royalty|crown|throne/.test(key) ? 740 : 820);
  return true;
}

installGlobalGiftSoundUnlock();
