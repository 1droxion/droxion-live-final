const SOUND_PREFERENCE_KEY = 'droxion_gift_sounds_enabled';
const MASTER_VOLUME = 0.18;

let audioContext = null;
let masterGain = null;
let unlocked = false;

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

  if (!audioContext) {
    audioContext = new AudioContextCtor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = MASTER_VOLUME;
    masterGain.connect(audioContext.destination);
  }
  return audioContext;
}

export function setGiftSoundsEnabled(enabled) {
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? 'true' : 'false');
  } catch {}
}

export function getGiftSoundsEnabled() {
  return soundsEnabled();
}

export async function unlockGiftSound() {
  if (!soundsEnabled()) return false;
  const context = getAudioContext();
  if (!context) return false;
  try {
    if (context.state === 'suspended') await context.resume();
    unlocked = context.state === 'running';
  } catch {
    unlocked = false;
  }
  return unlocked;
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
  high = 4200
} = {}) {
  if (!masterGain) return;
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i += 1) {
    const envelope = 1 - (i / frameCount);
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
  filter.frequency.exponentialRampToValueAtTime(Math.max(low + 1, high), now + duration);
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
    endFrequency: 48,
    start,
    duration: 0.42,
    gain: 0.15 * strength,
    type: 'sine'
  });
  tone(context, {
    frequency: 180,
    endFrequency: 75,
    start: start + 0.008,
    duration: 0.22,
    gain: 0.055 * strength,
    type: 'triangle'
  });
  noiseSweep(context, {
    start,
    duration: 0.18,
    gain: 0.035 * strength,
    low: 120,
    high: 900
  });
}

function sparkleChord(context, start = 0, strength = 1, root = 660) {
  [1, 1.25, 1.5, 2].forEach((ratio, index) => {
    tone(context, {
      frequency: root * ratio,
      endFrequency: root * ratio * 1.04,
      start: start + index * 0.055,
      duration: 0.38 + index * 0.03,
      gain: (0.038 - index * 0.004) * strength,
      type: index % 2 ? 'triangle' : 'sine'
    });
  });
}

function cinematicChord(context, start = 0, strength = 1) {
  [220, 330, 440, 660].forEach((frequency, index) => {
    tone(context, {
      frequency,
      endFrequency: frequency * 1.015,
      start: start + index * 0.025,
      duration: 1.15 - index * 0.08,
      gain: (0.052 - index * 0.006) * strength,
      type: index < 2 ? 'triangle' : 'sine'
    });
  });
}

export async function playGiftSound(gift = {}, presentation = {}) {
  if (!soundsEnabled()) return false;
  const context = getAudioContext();
  if (!context) return false;

  if (context.state !== 'running') {
    try { await context.resume(); } catch {}
  }
  if (context.state !== 'running' && !unlocked) return false;

  const tier = String(presentation.tier || 'standard').toLowerCase();
  const code = String(gift.gift_code || '').toLowerCase();
  const name = String(gift.gift_name || '').toLowerCase();
  const key = `${code} ${name}`;

  if (tier === 'standard') {
    tone(context, { frequency: 720, endFrequency: 980, duration: 0.22, gain: 0.06, type: 'sine' });
    tone(context, { frequency: 1080, endFrequency: 1380, start: 0.08, duration: 0.19, gain: 0.035, type: 'triangle' });
    return true;
  }

  if (tier === 'featured') {
    noiseSweep(context, { duration: 0.28, gain: 0.025, low: 480, high: 3200 });
    tone(context, { frequency: 420, endFrequency: 760, duration: 0.34, gain: 0.055, type: 'triangle' });
    sparkleChord(context, 0.12, 0.9, /crown/.test(key) ? 720 : 640);
    return true;
  }

  if (tier === 'premium') {
    noiseSweep(context, { duration: 0.52, gain: 0.045, low: 180, high: 5200 });
    impact(context, 0.08, 0.82);
    sparkleChord(context, 0.18, 1.05, /diamond/.test(key) ? 820 : 620);
    return true;
  }

  if (tier === 'elite') {
    noiseSweep(context, { duration: 0.78, gain: 0.052, low: 90, high: 6500 });
    tone(context, { frequency: 72, endFrequency: 108, duration: 0.72, gain: 0.07, type: 'sine' });
    impact(context, 0.36, 1.05);
    cinematicChord(context, 0.42, 0.95);
    if (/(galaxy|phoenix)/.test(key)) sparkleChord(context, 0.6, 0.75, 760);
    return true;
  }

  noiseSweep(context, { duration: 1.05, gain: 0.06, low: 70, high: 7600 });
  tone(context, { frequency: 58, endFrequency: 86, duration: 0.9, gain: 0.085, type: 'sine' });
  impact(context, 0.46, 1.2);
  cinematicChord(context, 0.5, 1.12);
  sparkleChord(context, 0.78, 0.88, /royalty|crown|throne/.test(key) ? 740 : 820);
  return true;
}
