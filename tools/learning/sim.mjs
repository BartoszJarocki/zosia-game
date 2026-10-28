// Progression simulator for Pup Patrol, using the game's own pure modules wherever they exist.
// Real modules: levels/parse.js (GAME.md tables), learning/mastery.js, learning/scheduler.js, learning/events.js,
// levels/gate.js (needs), session/director.js (which missions a session suggests).
// Re-implemented (they import DOM code): progress.recordMission / assistFor, levels.js ASSIST transforms,
// and each scene's round structure (questions per round, choices) — read from src/scenes/*.js.
//
// usage: node sim.mjs [model=A|B] [scenario=suggested|free] [children=300]
import fs from 'node:fs';
import { parseGame } from '../../src/levels/parse.js';
import { applyEvent, averageMastery } from '../../src/learning/mastery.js';
import { pickLearningItem } from '../../src/learning/scheduler.js';
import { makeEvent } from '../../src/learning/events.js';
import { meetsNeeds } from '../../src/levels/gate.js';
import * as D from '../../src/session/director.js';

const MD = fs.readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels: LEVELS, errors } = parseGame(MD, { childName: 'Zosia' });
if (errors.length) { console.error(errors); process.exit(1); }
const KINDS = ['letters', 'balloons', 'name', 'cones', 'stones', 'counting', 'delivery', 'picnic', 'lookout'];
const GOOD_RUNS = 2;

const MODEL = process.argv[2] || 'A';
const SCEN = process.argv[3] || 'suggested';
const CHILDREN = Number(process.argv[4] || 300);
const MAX_SESSIONS = 400;
const DAY = 86_400_000;

function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// copied from src/levels.js (ASSIST) — a gentler run after lastAcc < 0.45
const ASSIST = {
  letters: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), similar: false, ask: { audio: 'name', word: 'name', sound: 'word' }[s.ask] || s.ask }),
  balloons: (s) => ({ ...s, total: s.total - 2, speed: s.speed.map((v) => v * 0.7), similar: false }),
  name: (s) => ({ ...s, mode: s.mode === 'missing' ? 'missing' : 'ghost', extras: s.mode === 'missing' ? 1 : 0, similar: false }),
  cones: (s) => ({ ...s, choices: 3, bubble: 'both', sign: 'both' }),
  stones: (s) => ({ ...s, bubble: 'numeral' }),
  counting: (s) => ({ ...s, auto: true }),
  lookout: (s) => ({ ...s, bubble: 'both', mode: 'go' }),
  delivery: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), mode: 'pictureSound', similar: false }),
  picnic: (s) => ({ ...s, close: false, numerals: false }),
};
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/**
 * One question. Returns { firstTry, wrongs, assistLevel }.
 * Model A: flat first-try probability p, whatever the number of choices (the brief's "60/75/90%").
 * Model B: she knows it with probability k, otherwise guesses among `choices` (so 2-choice tasks are easier).
 * After a wrong tap: the next tap is right with the same chance, or by elimination; 2nd wrong = simplify (a wrong
 * option leaves, help level 2), 3rd wrong = reveal (help level 3) — as in learning/assist.js.
 * production=true (give N treats, no choices): Model B uses k + (1-k)*0.25.
 */
function answer(child, choices, rng, { free = false, production = false } = {}) {
  if (free) return { firstTry: true, wrongs: 0, assistLevel: 0 };
  const p = MODEL === 'A' ? child.p : production ? child.p + (1 - child.p) * 0.25 : child.p + (1 - child.p) / Math.max(1, choices);
  if (rng() < p) return { firstTry: true, wrongs: 0, assistLevel: 0 };
  let left = Math.max(1, choices - 1);
  // second tap
  const p2 = Math.max(p, 1 / left);
  if (rng() < p2) return { firstTry: false, wrongs: 1, assistLevel: 0 };
  // simplify: one more option leaves
  left = Math.max(1, left - 1);
  const p3 = Math.max(p, 1 / left);
  if (rng() < p3) return { firstTry: false, wrongs: 2, assistLevel: 2 };
  return { firstTry: false, wrongs: 3, assistLevel: 3 };
}

function newChild(p, seed) {
  return { p, rng: mulberry(seed), skills: {}, missions: Object.fromEntries(KINDS.map((k) => [k, { level: 1, good: 0, lastAcc: 1 }])), recent: {}, runs: Object.fromEntries(KINDS.map((k) => [k, 0])), reachedTop: {}, now: Date.UTC(2026, 10, 1), seenItems: {}, topLog: {} };
}

function pick(child, skill, pool, mix) {
  const recent = (child.recent[skill] ||= []);
  const m2 = mix || (process.env.NEWMIX ? { learning: 0.45, familiar: 0.25, difficult: 0.1, new: Number(process.env.NEWMIX) } : null);
  const item = pickLearningItem({ candidates: pool.map(String), stats: child.skills[skill] || {}, recent, now: child.now, rng: child.rng, ...(m2 ? { mix: m2 } : {}) });
  recent.push(item); if (recent.length > 8) recent.shift();
  return item;
}

function emit(child, mission, skill, item, res, level) {
  child.now += 9000;
  const ev = makeEvent({ mission, skill, item, correct: true, firstTry: res.firstTry, attempt: res.wrongs + 1, assistLevel: res.assistLevel, latencyMs: 3000, at: child.now, level });
  applyEvent(child.skills, ev);
}

/** One run of a mission: returns { firstTryRounds, rounds, items: [...] } — mirrors each scene's round()/question() calls. */
function playRun(child, kind, S, { finale = false } = {}) {
  const rng = child.rng, lvl = child.missions[kind].level;
  const mix = finale ? { familiar: 1, learning: 0.15 } : undefined;
  let ok = 0, rounds = S.rounds ?? 3;
  const asked = [];
  const q = (skill, item, choices, opts) => { const r = answer(child, choices, rng, opts); emit(child, kind, skill, item, r, lvl); asked.push(skill + ':' + item); return r.firstTry; };
  switch (kind) {
    case 'letters': {
      const skill = { match: 'letterVisual', name: 'letterVisual', audio: 'letterAudio', word: 'letterAudio', sound: 'letterSound' }[S.ask];
      for (let r = 0; r < rounds; r++) if (q(skill, pick(child, skill, [...S.pool], mix), Math.min(S.choices, S.pool.length))) ok++;
      break;
    }
    case 'balloons': {
      for (let r = 0; r < rounds; r++) {
        const it = pick(child, 'letterVisual', [...S.pool], mix);
        let clean = true;
        for (let t = 0; t < S.targets; t++) if (!q('letterVisual', it, Math.round((S.total - t) / (S.targets - t)))) clean = false;
        if (clean) ok++;
      }
      break;
    }
    case 'name': {
      const word = S.words[Math.floor(rng() * S.words.length)];
      const fill = S.mode === 'missing' ? [Math.floor(rng() * word.length)] : range(0, word.length - 1);
      rounds = fill.length;
      fill.forEach((idx, r) => { const blocksLeft = S.mode === 'missing' ? 1 + S.extras : word.length - r + S.extras; if (q('letterVisual', word[idx], blocksLeft)) ok++; });
      asked.push('word:' + word);
      break;
    }
    case 'cones': {
      const skill = S.bubble === 'dots' || S.bubble === 'name' ? 'quantity' : 'numeral';
      for (let r = 0; r < rounds; r++) if (q(skill, pick(child, skill, range(1, S.max), mix), Math.min(S.choices, S.max))) ok++;
      break;
    }
    case 'stones': {
      rounds = S.rounds;
      for (let r = 0; r < rounds; r++) {
        if (S.bubble === 'missing') { if (q('sequence', pick(child, 'sequence', range(2, S.n), mix), 2)) ok++; continue; }
        let clean = true;
        for (let k = 1; k <= S.n; k++) if (!q(S.bubble === 'next' && k > 1 ? 'sequence' : 'numeral', k, S.choices)) clean = false;
        if (clean) ok++;
      }
      break;
    }
    case 'counting': {
      for (let r = 0; r < rounds; r++) {
        const type = S.types[r % S.types.length];
        if (type === 'give') { if (q('counting', pick(child, 'counting', range(...S.give), mix), 1, { free: S.auto, production: true })) ok++; }
        else if (type === 'share') { const n = pick(child, 'counting', range(...S.share), mix); const fine = rng() < 0.95; emit(child, kind, 'counting', n, { firstTry: fine, wrongs: fine ? 0 : 1, assistLevel: 0 }, lvl); if (fine) ok++; }
        else if (q('quantity', pick(child, 'quantity', range(...S.howMany), mix), 3)) ok++;
      }
      break;
    }
    case 'lookout': {
      let floor = 0; const visited = [];
      for (let r = 0; r < rounds; r++) {
        let skill = 'numeral', target;
        if (S.mode === 'relative' && r > 0) { skill = 'sequence'; const up = floor <= 1 ? true : floor >= S.max ? false : rng() < 0.6; target = floor + (up ? 1 : -1); }
        else if (S.mode === 'pickup' || S.mode === 'find') { target = Number(pick(child, 'numeral', range(1, S.max).filter((f) => f !== floor && !visited.includes(f)), mix)); visited.push(target); }
        else target = Number(pick(child, 'numeral', finale ? range(1, Math.min(3, S.max)) : S.mode === 'relative' ? range(2, S.max - 1) : range(1, S.max), mix));
        if (q(skill, target, S.max)) ok++;
        floor = S.mode === 'relative' || S.mode === 'pickup' || S.mode === 'find' ? target : 0;
      }
      break;
    }
    case 'delivery': {
      for (let r = 0; r < rounds; r++) if (q('letterSound', pick(child, 'letterSound', [...S.pool], mix), Math.min(S.choices, S.pool.length))) ok++;
      break;
    }
    case 'picnic': {
      for (let r = 0; r < rounds; r++) { const mode = S.modes[r % S.modes.length]; if (q('comparison', mode + (S.numerals ? '#' : ''), 2)) ok++; }
      break;
    }
  }
  return { ok, rounds, asked };
}

/** progress.js recordMission, copied. */
function record(child, kind, ok, rounds) {
  const m = child.missions[kind];
  const acc = rounds ? ok / rounds : 1;
  m.lastAcc = acc;
  if (acc >= 0.65) {
    m.good++;
    if (m.good >= GOOD_RUNS && m.level < LEVELS[kind].length && (process.env.NOGATE || meetsNeeds(child.skills, kind, LEVELS[kind][m.level]))) { m.level++; m.good = 0; (child.levelAt ||= {})[kind + m.level] = child.runs[kind]; }
  }
}

function runMission(child, kind, { finale = false, session } = {}) {
  const m = child.missions[kind];
  let S = LEVELS[kind][m.level - 1];
  if (finale) S = { ...S, mode: 'go', bubble: 'both', rounds: 1 };
  else if (m.lastAcc < 0.45) S = { ...ASSIST[kind](S), assist: true };
  const res = playRun(child, kind, S, { finale });
  if (!finale) { child.runs[kind]++; record(child, kind, res.ok, res.rounds); }
  if (m.level === LEVELS[kind].length && !child.reachedTop[kind]) child.reachedTop[kind] = { runs: child.runs[kind], session };
  if (child.reachedTop[kind] && !finale) { (child.topLog[kind] ||= []).push(res.asked.join(' ')); }
  return res;
}

const FAV = { lookout: 3, counting: 3, name: 3 };
function freePick(rng) {
  const w = KINDS.map((k) => FAV[k] || 1), tot = w.reduce((a, b) => a + b, 0);
  let r = rng() * tot; for (let i = 0; i < KINDS.length; i++) { r -= w[i]; if (r <= 0) return KINDS[i]; }
  return KINDS.at(-1);
}

function simulateChild(p, seed) {
  const child = newChild(p, seed);
  for (let sIdx = 1; sIdx <= MAX_SESSIONS; sIdx++) {
    child.now += Math.round(1.75 * DAY);
    child.recent = {}; // recentBySkill is in-memory: a new page load starts it fresh
    const s = D.createSession(child.now);
    while (D.nextStep(s) === 'mission') {
      const kind = D.suggestNext(s, KINDS, child.rng);
      runMission(child, kind, { session: sIdx });
      D.completeMission(s, kind, child.now);
    }
    if (D.nextStep(s) === 'finale') { runMission(child, 'lookout', { finale: true, session: sIdx }); D.completeMission(s, 'lookout', child.now); }
    if (SCEN === 'free') for (let i = 0; i < 2; i++) runMission(child, freePick(child.rng), { session: sIdx });
    if (KINDS.every((k) => child.reachedTop[k])) break;
  }
  return child;
}

export { simulateChild, LEVELS, KINDS };
if (process.env.NOMAIN) { /* imported */ } else main();
function main() {
const PS = (process.env.PS || '0.6,0.75,0.9').split(',').map(Number);
const quant = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]; };
const out = {};
for (const p of PS) {
  const kids = Array.from({ length: CHILDREN }, (_, i) => simulateChild(p, 1000 + i * 7 + Math.round(p * 100)));
  out[p] = {};
  for (const k of KINDS) {
    const reached = kids.map((c) => c.reachedTop[k]).filter(Boolean);
    const runs = reached.map((r) => r.runs), sess = reached.map((r) => r.session);
    out[p][k] = { levels: LEVELS[k].length, reachedPct: Math.round((100 * reached.length) / kids.length), runsMed: quant(runs, 0.5), runsP10: quant(runs, 0.1), runsP90: quant(runs, 0.9), sessMed: quant(sess, 0.5), sessP10: quant(sess, 0.1), sessP90: quant(sess, 0.9) };
  }
  const all = kids.map((c) => Math.max(...KINDS.map((k) => c.reachedTop[k]?.session ?? MAX_SESSIONS)));
  out[p].ALL = { sessMed: quant(all, 0.5), sessP90: quant(all, 0.9) };
}
console.log(`model ${MODEL} · scenario ${SCEN} · ${CHILDREN} children each`);
console.log('mission     lv | ' + PS.map((p) => `p=${p}: runs med [p10-p90] / sessions med [p10-p90] (reach%)`).join(' | '));
for (const k of KINDS) {
  console.log(k.padEnd(10), String(LEVELS[k].length).padStart(2), '|', PS.map((p) => { const r = out[p][k]; if (!r.reachedPct) return "never (0%)"; return `${r.runsMed} [${r.runsP10}-${r.runsP90}] / ${r.sessMed} [${r.sessP10}-${r.sessP90}] (${r.reachedPct}%)`; }).join(' | '));
}
console.log('every mission at top: sessions median / p90:', PS.map((p) => `p=${p}: ${out[p].ALL.sessMed} / ${out[p].ALL.sessP90}`).join(' · '));
}
