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

function makeTone(ctx, { freq, duration, type = 'sine', startTime, gain = 0.18 }) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, startTime);
  // quick attack
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  // exponential decay
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

export function playDing() {
  safePlay((ctx) => {
    const now = ctx.currentTime;
    makeTone(ctx, { freq: 600, duration: 0.1, startTime: now, gain: 0.18 });
    makeTone(ctx, { freq: 900, duration: 0.13, startTime: now + 0.08, gain: 0.2 });
  });
}

export function playSwoosh() {
  safePlay((ctx) => {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(800, now);
    oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  });
}

export function playTick() {
  safePlay((ctx) => {
    const now = ctx.currentTime;
    makeTone(ctx, { freq: 1400, duration: 0.03, type: 'triangle', startTime: now, gain: 0.12 });
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
