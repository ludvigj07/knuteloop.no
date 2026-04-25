// Lightweight WebAudio sound helpers — no binary assets.
// Each function checks `localStorage.sounds_muted` ('1' = mute) and silently
// fails if AudioContext isn't ready (e.g. before first user interaction).

const MUTE_KEY = 'sounds_muted';

let audioContext = null;

function isMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function getContext() {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioContext) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume?.().catch(() => {});
    }
    return audioContext;
  } catch {
    return null;
  }
}

function safePlay(playFn) {
  if (isMuted()) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    playFn(ctx);
  } catch {
    // silent fail
  }
}

// Helper: ADSR envelope on a GainNode. Times are in seconds, peak is the
// linear gain at the top of the attack. We use linear ramps for the body
// and a small exponential tail at the very end so the sound doesn't pop.
function applyAdsr(gainParam, startTime, { attack = 0.005, decay = 0.08, sustain = 0.3, release = 0.4, peak = 0.2, hold = 0 }) {
  const sustainLevel = Math.max(0.0001, peak * sustain);
  gainParam.setValueAtTime(0.0001, startTime);
  gainParam.linearRampToValueAtTime(peak, startTime + attack);
  gainParam.linearRampToValueAtTime(sustainLevel, startTime + attack + decay);
  if (hold > 0) {
    gainParam.setValueAtTime(sustainLevel, startTime + attack + decay + hold);
  }
  const releaseStart = startTime + attack + decay + hold;
  gainParam.linearRampToValueAtTime(0.0001, releaseStart + release);
}

// Build a small bell-like partial: oscillator → individual gain → master gain.
// Used inside playDing to stack a few harmonics for a warmer chime.
function makeBellPartial(ctx, masterGain, { freq, type = 'sine', startTime, peak, attack, decay, sustain, release, hold = 0 }) {
  const oscillator = ctx.createOscillator();
  const partialGain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, startTime);
  applyAdsr(partialGain.gain, startTime, { attack, decay, sustain, release, peak, hold });
  oscillator.connect(partialGain);
  partialGain.connect(masterGain);
  oscillator.start(startTime);
  oscillator.stop(startTime + attack + decay + hold + release + 0.05);
}

// playDing — soft, iMessage-style two-note chime. Stacks a sine fundamental
// with a quieter triangle harmonic an octave + fifth above for brightness,
// plus a subtle fifth below for body. ADSR keeps it from sounding harsh.
export function playDing() {
  safePlay((ctx) => {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(ctx.destination);

    // First note (around B5)
    const f1 = 988;
    makeBellPartial(ctx, masterGain, { freq: f1, type: 'sine', startTime: now, peak: 0.18, attack: 0.005, decay: 0.08, sustain: 0.3, release: 0.42 });
    makeBellPartial(ctx, masterGain, { freq: f1 * 2, type: 'triangle', startTime: now, peak: 0.05, attack: 0.005, decay: 0.06, sustain: 0.2, release: 0.32 });
    makeBellPartial(ctx, masterGain, { freq: f1 * 0.5, type: 'sine', startTime: now, peak: 0.04, attack: 0.008, decay: 0.1, sustain: 0.4, release: 0.45 });

    // Second note (around E6) — a perfect fourth up
    const t2 = now + 0.13;
    const f2 = 1319;
    makeBellPartial(ctx, masterGain, { freq: f2, type: 'sine', startTime: t2, peak: 0.2, attack: 0.005, decay: 0.09, sustain: 0.3, release: 0.5 });
    makeBellPartial(ctx, masterGain, { freq: f2 * 2, type: 'triangle', startTime: t2, peak: 0.05, attack: 0.005, decay: 0.07, sustain: 0.2, release: 0.4 });
    makeBellPartial(ctx, masterGain, { freq: f2 * 0.5, type: 'sine', startTime: t2, peak: 0.04, attack: 0.008, decay: 0.1, sustain: 0.4, release: 0.5 });
  });
}

// playSwoosh — soft whoosh: filtered white noise sweeping a low-pass from
// 1000Hz down to 200Hz, layered with a short low body tone. No square waves.
export function playSwoosh() {
  safePlay((ctx) => {
    const now = ctx.currentTime;
    const duration = 0.25;

    // White noise buffer
    const noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      channel[i] = (Math.random() * 2 - 1) * 0.6;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.Q.value = 0.7;
    lowpass.frequency.setValueAtTime(1000, now);
    lowpass.frequency.exponentialRampToValueAtTime(200, now + duration);

    const noiseGain = ctx.createGain();
    applyAdsr(noiseGain.gain, now, { attack: 0.02, decay: 0.05, sustain: 0.6, release: 0.18, peak: 0.14, hold: 0.04 });

    noise.connect(lowpass);
    lowpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration + 0.05);

    // Subtle body tone — gives the swoosh some pitch character
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(280, now);
    body.frequency.exponentialRampToValueAtTime(140, now + duration);
    const bodyGain = ctx.createGain();
    applyAdsr(bodyGain.gain, now, { attack: 0.01, decay: 0.08, sustain: 0.3, release: 0.16, peak: 0.08 });
    body.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    body.start(now);
    body.stop(now + duration + 0.05);
  });
}

// playTick — short, gentle sine click around 1500Hz with rapid decay.
// No metallic edge, just a quick "tap".
export function playTick() {
  safePlay((ctx) => {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1500, now);
    applyAdsr(gainNode.gain, now, { attack: 0.002, decay: 0.018, sustain: 0.0, release: 0.008, peak: 0.12 });
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.05);
  });
}

export function isSoundsMuted() {
  return isMuted();
}

export function setSoundsMuted(muted) {
  try {
    if (muted) {
      window.localStorage.setItem(MUTE_KEY, '1');
    } else {
      window.localStorage.removeItem(MUTE_KEY);
    }
  } catch {
    // ignore
  }
}
