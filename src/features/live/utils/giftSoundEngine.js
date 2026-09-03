const SOUND_PREFERENCE_KEY = 'droxion_gift_sounds_enabled';
const MASTER_VOLUME = 0.42;
const PENDING_SOUND_WINDOW_MS = 6000;

let audioContext = null;
let masterGain = null;
let unlocked = false;
let globalUnlockInstalled = false;
let pendingGiftSound = null;

function soundsEnabled() {
  try { return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'false'; }
  catch { return true; }
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
  pendingGiftSound = { gift, presentation, expiresAt: Date.now() + PENDING_SOUND_WINDOW_MS };
}

function flushPendingGiftSound() {
  const pending = pendingGiftSound;
  pendingGiftSound = null;
  if (!pending || pending.expiresAt < Date.now()) return;
  window.setTimeout(() => playGiftSound(pending.gift, pending.presentation).catch(() => {}), 0);
}

export function setGiftSoundsEnabled(enabled) {
  try { window.localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? 'true' : 'false'); } catch {}
  if (!enabled) pendingGiftSound = null;
}
export function getGiftSoundsEnabled() { return soundsEnabled(); }
export function getGiftSoundReady() { return Boolean(unlocked && audioContext?.state === 'running'); }

export async function unlockGiftSound() {
  if (!soundsEnabled()) return false;
  const context = getAudioContext();
  if (!context) return false;
  const wasUnlocked = unlocked && context.state === 'running';
  try {
    if (context.state !== 'running') await context.resume();
    unlocked = context.state === 'running';
    if (unlocked && !wasUnlocked) { commitOutputRoute(context); flushPendingGiftSound(); }
  } catch { unlocked = false; }
  return unlocked;
}

function installGlobalGiftSoundUnlock() {
  if (globalUnlockInstalled || typeof window === 'undefined' || typeof document === 'undefined') return;
  globalUnlockInstalled = true;
  const attemptUnlock = () => { if (soundsEnabled()) unlockGiftSound().catch(() => {}); };
  document.addEventListener('pointerdown', attemptUnlock, { capture: true, passive: true });
  document.addEventListener('touchend', attemptUnlock, { capture: true, passive: true });
  document.addEventListener('click', attemptUnlock, { capture: true, passive: true });
  document.addEventListener('keydown', attemptUnlock, true);
  const markRouteForResume = () => {
    if (!audioContext) return;
    if (document.visibilityState === 'hidden' || audioContext.state !== 'running') unlocked = false;
  };
  document.addEventListener('visibilitychange', markRouteForResume);
  window.addEventListener('pageshow', markRouteForResume);
}

function tone(context,{frequency=440,endFrequency=frequency,start=0,duration=.25,gain=.08,type='sine',detune=0}={}){
  if(!masterGain)return;const now=context.currentTime+start;const oscillator=context.createOscillator();const envelope=context.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(Math.max(1,frequency),now);oscillator.detune.setValueAtTime(detune,now);if(endFrequency!==frequency)oscillator.frequency.exponentialRampToValueAtTime(Math.max(1,endFrequency),now+duration);envelope.gain.setValueAtTime(.0001,now);envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),now+Math.min(.045,duration*.2));envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);oscillator.connect(envelope);envelope.connect(masterGain);oscillator.start(now);oscillator.stop(now+duration+.03)
}
function noiseSweep(context,{start=0,duration=.45,gain=.045,low=320,high=4200,reverse=false}={}){
  if(!masterGain)return;const frameCount=Math.max(1,Math.floor(context.sampleRate*duration));const buffer=context.createBuffer(1,frameCount,context.sampleRate);const channel=buffer.getChannelData(0);for(let i=0;i<frameCount;i+=1){const position=i/frameCount;const envelope=reverse?position:1-position;channel[i]=(Math.random()*2-1)*envelope}const source=context.createBufferSource();const filter=context.createBiquadFilter();const envelope=context.createGain();const now=context.currentTime+start;source.buffer=buffer;filter.type='bandpass';filter.Q.value=.8;filter.frequency.setValueAtTime(Math.max(20,low),now);filter.frequency.exponentialRampToValueAtTime(Math.max(21,high),now+duration);envelope.gain.setValueAtTime(.0001,now);envelope.gain.exponentialRampToValueAtTime(gain,now+Math.min(.08,duration*.25));envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);source.connect(filter);filter.connect(envelope);envelope.connect(masterGain);source.start(now);source.stop(now+duration+.02)
}
function impact(context,start=0,strength=1){tone(context,{frequency:92,endFrequency:42,start,duration:.42,gain:.16*strength,type:'sine'});tone(context,{frequency:180,endFrequency:72,start:start+.008,duration:.22,gain:.065*strength,type:'triangle'});noiseSweep(context,{start,duration:.16,gain:.045*strength,low:120,high:1100})}
function sparkleChord(context,start=0,strength=1,root=660){[1,1.25,1.5,2].forEach((ratio,index)=>tone(context,{frequency:root*ratio,endFrequency:root*ratio*1.04,start:start+index*.045,duration:.3+index*.025,gain:(.048-index*.004)*strength,type:index%2?'triangle':'sine'}))}
function cinematicChord(context,start=0,strength=1,root=220){[1,1.5,2,3].forEach((ratio,index)=>{const frequency=root*ratio;tone(context,{frequency,endFrequency:frequency*1.015,start:start+index*.02,duration:.8-index*.05,gain:(.062-index*.006)*strength,type:index<2?'triangle':'sine'})})}

const PROFILE_TONES={
  rose:[560,820],heart:[420,660],neon:[740,1180],lucky:[520,1040],star:[860,1320],finger_heart:[620,920],candy:[980,1460],coffee:[260,420],sparkle:[920,1520],soccer:[170,420],
  teddy:[330,520],wave:[480,700],crown:[390,780],camera:[1200,1800],cake:[500,880],game:[220,660],fire:[140,520],chocolate:[280,460],party:[640,1180],rocket:[180,980],
  mirror:[700,1250],diamond:[820,1640],music:[440,880],supercar:[110,760],angel:[660,1320],treasure:[360,940],electric:[180,1400],castle:[220,520],moon:[310,760],lion:[120,360],jet:[140,1050],yacht:[240,520],phoenix:[180,1300],meteor:[90,900],throne:[180,460],world_crown:[260,1080]
};

function profileSound(context,profile){
  const pair=PROFILE_TONES[profile];if(!pair)return false;const [low,high]=pair;
  const noisy=['camera','soccer','game','fire','rocket','supercar','electric','jet','meteor'].includes(profile);
  if(noisy)noiseSweep(context,{duration:.26,gain:.055,low:Math.max(70,low),high:Math.max(low+120,high)});
  tone(context,{frequency:low,endFrequency:Math.max(low+1,high),duration:.34,gain:.085,type:profile==='electric'?'sawtooth':'triangle'});
  tone(context,{frequency:high,endFrequency:Math.max(high+1,high*1.12),start:.09,duration:.22,gain:.052,type:'sine'});
  if(['crown','diamond','angel','treasure','moon','throne','world_crown'].includes(profile))sparkleChord(context,.1,.72,Math.max(560,high*.78));
  if(['supercar','rocket','jet','meteor','fire','electric'].includes(profile))impact(context,.18,.72);
  return true;
}

function dragonSound(context){noiseSweep(context,{duration:.4,gain:.075,low:140,high:2800});tone(context,{frequency:78,endFrequency:48,start:.06,duration:.55,gain:.15,type:'sawtooth'});impact(context,.34,1.08);noiseSweep(context,{start:.48,duration:.72,gain:.105,low:6200,high:220,reverse:true})}
function galaxySound(context){tone(context,{frequency:82,endFrequency:180,duration:.72,gain:.095,type:'sine'});noiseSweep(context,{duration:.68,gain:.075,low:120,high:7200});sparkleChord(context,.16,1.05,720);impact(context,.56,1.18);cinematicChord(context,.6,.96,196)}
function universeSound(context){tone(context,{frequency:44,endFrequency:84,duration:.9,gain:.15,type:'sine'});noiseSweep(context,{duration:.9,gain:.085,low:70,high:9000});cinematicChord(context,.28,1.08,174);impact(context,.72,1.3);sparkleChord(context,.78,.92,840)}
function royaltySound(context){sparkleChord(context,0,.95,740);tone(context,{frequency:110,endFrequency:64,start:.22,duration:.58,gain:.125,type:'triangle'});impact(context,.36,1.28);cinematicChord(context,.4,1.16,220);sparkleChord(context,.68,1.06,920)}

export async function playGiftSound(gift={},presentation={}){
  if(!soundsEnabled())return false;const context=getAudioContext();if(!context)return false;if(context.state!=='running'){try{await context.resume()}catch{}}if(context.state!=='running'){unlocked=false;queuePendingGiftSound(gift,presentation);return false}unlocked=true;pendingGiftSound=null;
  const tier=String(presentation.tier||'standard').toLowerCase();const profile=String(presentation.soundProfile||'').toLowerCase();const code=String(gift.gift_code||'').toLowerCase();const name=String(gift.gift_name||'').toLowerCase();const key=`${code} ${name}`;
  if(profile==='dragon'||/dragon/.test(key)){dragonSound(context);return true}
  if(profile==='galaxy'||/droxion galaxy/.test(key)){galaxySound(context);return true}
  if(profile==='universe'||/droxion universe/.test(key)){universeSound(context);return true}
  if(profile==='royalty'||/droxion royalty/.test(key)){royaltySound(context);return true}
  if(profileSound(context,profile))return true;
  if(tier==='standard'){tone(context,{frequency:720,endFrequency:980,duration:.18,gain:.085,type:'sine'});tone(context,{frequency:1080,endFrequency:1380,start:.06,duration:.15,gain:.05,type:'triangle'});return true}
  if(tier==='featured'){noiseSweep(context,{duration:.22,gain:.04,low:480,high:3200});tone(context,{frequency:420,endFrequency:760,duration:.28,gain:.08,type:'triangle'});sparkleChord(context,.09,.92,640);return true}
  if(tier==='premium'){noiseSweep(context,{duration:.34,gain:.065,low:180,high:5200});impact(context,.05,.92);sparkleChord(context,.12,1.02,700);return true}
  if(tier==='elite'){noiseSweep(context,{duration:.5,gain:.075,low:90,high:6500});tone(context,{frequency:72,endFrequency:108,duration:.48,gain:.1,type:'sine'});impact(context,.22,1.12);cinematicChord(context,.25,.96);return true}
  noiseSweep(context,{duration:.66,gain:.085,low:70,high:7600});tone(context,{frequency:58,endFrequency:86,duration:.6,gain:.12,type:'sine'});impact(context,.28,1.25);cinematicChord(context,.3,1.08);sparkleChord(context,.5,.92,820);return true
}

installGlobalGiftSoundUnlock();
