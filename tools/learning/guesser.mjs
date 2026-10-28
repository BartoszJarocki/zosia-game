// Can guessing fake mastery? Runs the real learning/mastery.js and scheduler categories on two kinds of player:
//   a random tapper (taps any option, never the same wrong one twice), and
//   a child right first time 90% of the time (otherwise she taps like the random tapper).
// The help ladder is the one in learning/assist.js: 2nd wrong = simplify (help 2, one wrong option leaves),
// 3rd wrong = reveal (help 3). Each answer says how many options there were (the question's `options`).
//
// usage: node tools/learning/guesser.mjs [runs=2000]
import { applyEvent } from '../../src/learning/mastery.js';
import { makeEvent } from '../../src/learning/events.js';
import { categorize } from '../../src/learning/scheduler.js';

const RUNS = Number(process.argv[2] || 2000);
const FAMILIAR = 0.75, GATE = 0.6;

function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** One question with c options (0 is right). Returns { wrongs, assist }. */
function answer(c, pFirst, rng) {
  if (rng() < pFirst) return { wrongs: 0, assist: 0 };
  const wrongOptions = Array.from({ length: c - 1 }, (_, j) => j + 1);
  let tap = wrongOptions[Math.floor(rng() * wrongOptions.length)], pool = [0, ...wrongOptions], wrongs = 0, assist = 0;
  for (;;) {
    if (tap === 0) return { wrongs, assist };
    wrongs++; pool = pool.filter((x) => x !== tap);
    if (wrongs === 2) { assist = 2; const w = pool.find((x) => x !== 0); if (w !== undefined) pool = pool.filter((x) => x !== w); }
    if (wrongs >= 3) { assist = 3; pool = [0]; }
    tap = pool[Math.floor(rng() * pool.length)];
  }
}

/** Mastery after each of n answers. */
function history(c, pFirst, n, rng) {
  const skills = {}, out = [];
  for (let i = 0; i < n; i++) {
    const { wrongs, assist } = answer(c, pFirst, rng);
    const s = applyEvent(skills, makeEvent({ mission: 'm', skill: 'numeral', item: '1', correct: true, firstTry: wrongs === 0, attempt: wrongs + 1, assistLevel: assist, options: c, at: i + 1 }));
    out.push({ m: s.mastery, kind: categorize(s) });
  }
  return out;
}

const pct = (k, n) => `${Math.round((100 * k) / n)}%`;
const mean = (v) => (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2);
const quant = (v, q) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]; };

console.log(`random tapper, ${RUNS} runs of 40 answers each`);
for (const c of [2, 3, 4, 5, 7]) {
  const rng = mulberry(9 + c);
  const runs = Array.from({ length: RUNS }, () => history(c, 1 / c, 40, rng));
  const at10 = runs.map((h) => h[9].m), at40 = runs.map((h) => h[39].m);
  const ever = runs.filter((h) => h.some((x) => x.m >= FAMILIAR)).length;
  const difficult = runs.filter((h) => h[39].kind === 'difficult').length;
  console.log(`  ${c} choices: mastery after 10 answers ${mean(at10)}, after 40 ${mean(at40)} · below ${GATE} after 10: ${pct(at10.filter((m) => m < GATE).length, RUNS)}, after 40: ${pct(at40.filter((m) => m < GATE).length, RUNS)} · below familiar after 40: ${pct(at40.filter((m) => m < FAMILIAR).length, RUNS)} (ever familiar in the 40: ${pct(ever, RUNS)}) · 'difficult' after 40: ${pct(difficult, RUNS)}`);
}

console.log(`child right first time 90% of the time, ${RUNS} runs`);
for (const c of [2, 3, 4]) {
  const rng = mulberry(31 + c);
  const firstFamiliar = Array.from({ length: RUNS }, () => { const h = history(c, 0.9, 40, rng); const i = h.findIndex((x) => x.m >= FAMILIAR); return i === -1 ? 99 : i + 1; });
  const at40 = Array.from({ length: RUNS }, () => history(c, 0.9, 40, rng)[39]);
  console.log(`  ${c} choices: answers until familiar median ${quant(firstFamiliar, 0.5)}, p90 ${quant(firstFamiliar, 0.9)} · familiar within 6 answers: ${pct(firstFamiliar.filter((n) => n <= 6).length, RUNS)} · mastery after 40 ${mean(at40.map((x) => x.m))}, familiar then ${pct(at40.filter((x) => x.kind === 'familiar').length, RUNS)}`);
}
