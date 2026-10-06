// Tracks how Zosia is doing, so levels follow her skill instead of just play time.
//  - A mission levels up after CONFIG.goodRunsPerLevel "good" runs (most answers right first time).
//  - A rough run turns on "assist" next time (fewer choices, answer shown) without ever taking stars away.
//  - Per-letter / per-number stats make the ones she misses come up more often.
import { CONFIG } from './config.js';
import { badges } from './ui.js';
import { maxLevel } from './levels/data.js';

const KEY = 'pup-patrol-progress';

function load() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && p.v === 1) return p;
  } catch {}
  // first run with this version: start from the old badge counts so no stars are lost
  const b = badges.get();
  const missions = {};
  for (const [k, n] of Object.entries(b)) missions[k] = { level: Math.min(maxLevel(k), 1 + Math.floor(n / 2)), good: 0, lastAcc: 1 };
  return { v: 1, missions, items: {} };
}
let state = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
const mission = (kind) => (state.missions[kind] ||= { level: 1, good: 0, lastAcc: 1 });

export function levelFor(kind) {
  return Math.min(maxLevel(kind), CONFIG.level || mission(kind).level);
}

/** Last run went badly: make this one a bit gentler. */
export function assistFor(kind) {
  return !CONFIG.level && mission(kind).lastAcc < 0.45;
}

/** Call at the end of a mission. Returns { level, levelUp }. */
export function recordMission(kind, firstTry, rounds) {
  const m = mission(kind);
  const acc = rounds ? firstTry / rounds : 1;
  m.lastAcc = acc;
  let levelUp = false;
  if (acc >= 0.7) {
    m.good++;
    if (m.good >= CONFIG.goodRunsPerLevel && m.level < maxLevel(kind)) { m.level++; m.good = 0; levelUp = true; }
  }
  save();
  return { level: levelFor(kind), levelUp, acc };
}

/** Remember whether a letter/number was got right first time. */
export function recordItem(id, firstTry) {
  const it = (state.items[id] ||= { n: 0, ok: 0 });
  it.n++;
  if (firstTry) it.ok++;
  save();
}

/** Pick the next target: ones she misses (or hasn't seen much) come up more often; never the same twice running. */
export function pickTarget(pool, prefix, prev) {
  const options = pool.length > 1 ? pool.filter((x) => x !== prev) : pool;
  const weights = options.map((x) => {
    const it = state.items[prefix + x];
    if (!it || it.n < 2) return 1.6;              // new: show it
    return 0.6 + 2.4 * (1 - it.ok / it.n);        // mastered ≈ 0.6, struggling ≈ 3
  });
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) { r -= weights[i]; if (r <= 0) return options[i]; }
  return options[options.length - 1];
}

export function resetProgress() { state = { v: 1, missions: {}, items: {} }; save(); }
