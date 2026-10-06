import { CONFIG } from './config.js';
import { clipKey } from './voice-key.js';

// ---------- Web Audio sound effects (synthesized, no files) ----------
let ctx = null;

export function unlockAudio() {
  // iPadOS 17+: play through the silent switch like a media app.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (C) ctx = new C();
  }
  if (ctx && ctx.state !== 'running') ctx.resume();
  // Prime speech inside the user gesture (required on iOS).
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

function tone(freq, dur, { type = 'sine', vol = 0.2, when = 0, to = freq } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.3, when = 0, freq = 1500 } = {}) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + when);
}

export const sfx = {
  pop: () => tone(500, 0.1, { to: 900, vol: 0.25 }),
  good: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.2, when: i * 0.09 })),
  oops: () => { tone(392, 0.11, { vol: 0.08, to: 415 }); tone(440, 0.13, { vol: 0.07, when: 0.1, to: 466 }); }, // a soft, curious "hm?" (not a fail sound)
  bark: () => {
    tone(480, 0.1, { type: 'sawtooth', vol: 0.1, to: 260 });
    noise(0.08, { vol: 0.15, freq: 900 });
    tone(500, 0.1, { type: 'sawtooth', vol: 0.1, to: 280, when: 0.16 });
    noise(0.08, { vol: 0.15, freq: 900, when: 0.16 });
  },
  meow: () => {
    tone(650, 0.18, { type: 'triangle', vol: 0.18, to: 1000 });
    tone(1000, 0.35, { type: 'triangle', vol: 0.18, to: 520, when: 0.18 });
  },
  crunch: () => { noise(0.07, { vol: 0.35, freq: 2500 }); noise(0.07, { vol: 0.3, freq: 1800, when: 0.08 }); },
  whoosh: () => noise(0.35, { vol: 0.2, freq: 700 }),
  engine: () => tone(90, 0.6, { type: 'sawtooth', vol: 0.06, to: 160 }),
  siren: (times = 2) => {
    for (let i = 0; i < times; i++) {
      tone(700, 0.35, { type: 'square', vol: 0.04, to: 1050, when: i * 0.7 });
      tone(1050, 0.35, { type: 'square', vol: 0.04, to: 700, when: i * 0.7 + 0.35 });
    }
  },
  toot: () => { tone(587, 0.35, { type: 'square', vol: 0.06 }); tone(740, 0.35, { type: 'square', vol: 0.05 }); tone(587, 0.5, { type: 'square', vol: 0.06, when: 0.45 }); tone(740, 0.5, { type: 'square', vol: 0.05, when: 0.45 }); },
  balloonPop: () => { noise(0.12, { vol: 0.6, freq: 3200 }); tone(900, 0.08, { vol: 0.15, to: 300 }); },
  boing: () => tone(260, 0.25, { type: 'triangle', vol: 0.2, to: 720 }),
  splash: () => { noise(0.4, { vol: 0.25, freq: 900 }); noise(0.25, { vol: 0.15, freq: 2400, when: 0.05 }); },
  ding: () => { tone(1318, 0.5, { type: 'sine', vol: 0.18 }); tone(1046, 0.7, { type: 'sine', vol: 0.15, when: 0.18 }); },
  doors: () => noise(0.3, { vol: 0.12, freq: 600 }),
  hum: () => tone(110, 0.5, { type: 'triangle', vol: 0.05, to: 150 }),
  honk: () => { tone(350, 0.18, { type: 'square', vol: 0.07 }); tone(440, 0.18, { type: 'square', vol: 0.06 }); tone(350, 0.3, { type: 'square', vol: 0.07, when: 0.24 }); tone(440, 0.3, { type: 'square', vol: 0.06, when: 0.24 }); },
  bubble: () => { const f = 700 + Math.random() * 500; tone(f, 0.09, { vol: 0.16, to: f * 1.8 }); },
  whistle: () => { tone(880, 0.25, { type: 'sine', vol: 0.12, to: 1175 }); tone(1175, 0.55, { type: 'sine', vol: 0.12, when: 0.25, to: 1100 }); noise(0.7, { vol: 0.05, freq: 3000 }); },
  jingle: () => [659, 784, 880, 784, 659, 784, 988, 1046].forEach((f, i) => tone(f, 0.13, { type: 'triangle', vol: 0.12, when: i * 0.15 })),
  fanfare: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) =>
    tone(f, i === 5 ? 0.6 : 0.16, { type: 'square', vol: 0.07, when: i * 0.14 })),
};

// ---------- Speech ----------
// Lines are pre-recorded ElevenLabs clips in /voice (see scripts/voices.mjs).
// Anything without a clip falls back to the device's Polish voice.
let clips = null; // Set of available clip keys
const manifestReady = fetch('/voice/manifest.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((m) => { clips = new Set(m?.clips || []); })
  .catch(() => { clips = new Set(); });

const buffers = new Map();
const keyFor = (text) => clipKey(text, CONFIG);
function loadClip(key) {
  if (!buffers.has(key)) {
    const p = fetch(`/voice/${key}.mp3`)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)));
    p.catch(() => buffers.delete(key));
    buffers.set(key, p);
  }
  return buffers.get(key);
}

/** Warm up clips we're about to need (no-op before audio is unlocked). */
export async function preload(segments) {
  await manifestReady;
  if (!ctx) return;
  for (const s of segments.flat()) { const k = keyFor(s); if (clips.has(k)) loadClip(k).catch(() => {}); }
}

let voiceGain = null;
let current = null; // playing AudioBufferSourceNode
let speakToken = 0;

function playBuffer(buf, token) {
  return new Promise((resolve) => {
    if (token !== speakToken) return resolve();
    if (!voiceGain) { voiceGain = ctx.createGain(); voiceGain.gain.value = 1.3; voiceGain.connect(ctx.destination); }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(voiceGain);
    src.onended = () => { if (current === src) current = null; resolve(); };
    current = src;
    src.start();
  });
}

// device TTS fallback
let voice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  const lang = CONFIG.voiceLang, base = lang.slice(0, 2);
  voice = vs.find((v) => v.lang === lang && /zosia|ewa|paulina/i.test(v.name)) || vs.find((v) => v.lang === lang) ||
    vs.find((v) => v.lang.startsWith(base)) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}
function speakTTS(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = CONFIG.voiceLang;
    if (voice) u.voice = voice;
    u.rate = CONFIG.speechRate;
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(safety); resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    const safety = setTimeout(finish, 1500 + text.length * 85); // Safari sometimes never fires onend
    speechSynthesis.speak(u);
  });
}

/**
 * Say one line or a list of segments in order. Interrupts whatever is being said.
 * Resolves when finished (or cut off by a newer line).
 */
export async function say(segments) {
  const parts = [segments].flat().filter(Boolean);
  globalThis.__sayLog?.push(parts.join(' ')); // tests: what was said (set window.__sayLog = [])
  const token = ++speakToken;
  stopVoice();
  await manifestReady;
  for (let i = 0; i < parts.length; i++) {
    const text = parts[i];
    if (token !== speakToken) return;
    if (i > 0) { await new Promise((r) => setTimeout(r, CONFIG.voicePause)); if (token !== speakToken) return; }
    const key = keyFor(text);
    if (ctx && clips.has(key)) {
      try {
        const buf = await loadClip(key);
        await playBuffer(buf, token);
        continue;
      } catch {}
    }
    if (token !== speakToken) return;
    await speakTTS(text);
  }
}

function stopVoice() {
  if (current) { try { current.stop(); } catch {} current = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export function hush() {
  speakToken++;
  stopVoice();
}
