// Can guessing fake mastery? Runs the real learning/mastery.js and scheduler categories on two kinds of player:
//   a random tapper (taps any option, never the same wrong one twice), and
//   a child right first time 90% of the time (otherwise she taps like the random tapper).
// The help ladder is the one in learning/assist.js: 2nd wrong = simplify (help 2, one wrong option leaves),
// 3rd wrong = reveal (help 3). Each answer says how many options there were (the question's `options`).
//
// Then, for each of the 25 missions, the improvement plan's check (B3): "a random tapper's clean share stays within
// 15 points of chance". The run each level asks is read from GAME.md's level rows (the same parser the game uses)
// and played by a random tapper through the real scoring (progress/levelup.js: scoreRun, GOOD_RUN, LEAP_RUN).
//   chance  what a blind tapper really earns per scored question: 1 / the things she can pick, or make (a count she toots or jumps)
//   share   the share of scored answers the random tapper gets clean (first try, no help), through the real scoring
//   gap     share - chance. FAIL when guessing pays: the share is more than 15 points above chance
//   told    chance as the scene tells the scorer (1 / its `options`); it differs where a count is made, with one option declared
//   good    the share of runs the tapper wins a level with (at least 65% clean: progress/levelup.js); clean = all clean in 3 or more questions
//   thin    a run with fewer than 2 scored questions says little (a run with none does not count at all)
// Each scene's questions per run and options are mirrored here (QUESTIONS below), as tools/learning/sim.mjs does for the island:
// read them again from src/scenes/*.js when a scene changes how many things she picks from.
//
// usage: [GAME_MD=path] node tools/learning/guesser.mjs [runs=2000] [--missions] [--levels]
//   --missions  only the 25-mission check (skip the mastery tables)   --levels  one line per level as well
import fs from 'node:fs';
import { applyEvent } from '../../src/learning/mastery.js';
import { makeEvent } from '../../src/learning/events.js';
import { categorize } from '../../src/learning/scheduler.js';
import { parseGame } from '../../src/levels/parse.js';
import { scoreRun, GOOD_RUN, LEAP_RUN } from '../../src/progress/levelup.js';
import { PLACES } from '../../src/places.js';

const ARGS = process.argv.slice(2);
const RUNS = Number(ARGS.find((a) => /^\d+$/.test(a)) || 2000);
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
function history(c, pFirst, n, rng, mission = 'm', skill = 'numeral', item = '1') {
  const skills = {}, out = [];
  for (let i = 0; i < n; i++) {
    const { wrongs, assist } = answer(c, pFirst, rng);
    const s = applyEvent(skills, makeEvent({ mission, skill, item, correct: true, firstTry: wrongs === 0, attempt: wrongs + 1, assistLevel: assist, options: c, at: i + 1 }));
    out.push({ m: s.mastery, kind: categorize(s) });
  }
  return out;
}

const pct = (k, n) => `${Math.round((100 * k) / n)}%`;
const mean = (v) => (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2);
const quant = (v, q) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]; };

if (!ARGS.includes('--missions')) {
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

  for (const c of [2, 3]) {
    const rng = mulberry(71 + c);
    const runs = Array.from({ length: RUNS }, () => history(c, 1 / c, 40, rng, 'telescope', 'space', 'saturn'));
    const at10 = runs.map((h) => h[9].m), at40 = runs.map((h) => h[39].m);
    const ever = runs.filter((h) => h.some((x) => x.m >= FAMILIAR)).length;
    console.log(`telescope, random tapping, ${c} choices: mastery after 10 ${mean(at10)}, after 40 ${mean(at40)} · below familiar after 40 ${pct(at40.filter((m) => m < FAMILIAR).length, RUNS)} · ever familiar in 40 ${pct(ever, RUNS)}`);
    const knowing = Array.from({ length: RUNS }, () => history(c, 0.9, 40, rng, 'telescope', 'space', 'saturn')[39]);
    console.log(`telescope, 90% right first time, ${c} choices: mastery after 40 ${mean(knowing.map((x) => x.m))} · familiar then ${pct(knowing.filter((x) => x.kind === 'familiar').length, RUNS)}`);
  }
}

// ---------- the 25 missions ----------

const GAME = fs.readFileSync(process.env.GAME_MD || new URL('../../GAME.md', import.meta.url), 'utf8'); // (GAME_MD: another copy of the level tables)
const { levels: LEVELS, errors } = parseGame(GAME, { childName: 'Zosia' });
if (errors.length) { console.error(errors); process.exit(1); }
const MISSIONS = Object.keys(PLACES).filter((kind) => PLACES[kind].game);
const WITHIN = 0.15;

/**
 * One scored (or not) question of a run. options: how many things she picks from, per right one, as the scene tells the scorer
 * (fractions when several answers are right at once). blind: how many different outcomes a blind tapper can produce, when
 * that is not the same (she makes a count, so a toot or a jump has as many outcomes as the numbers the level asks for).
 */
const ask = (options, { blind = options, scored = true } = {}) => ({ options, blind: Math.max(1, blind), scored });
const times = (n, question) => Array.from({ length: n }, () => question);
const size = (pool) => [...pool].length;
const span = ([lo, hi]) => hi - lo + 1;
const between = ([lo, hi], rng) => lo + Math.floor(rng() * (hi - lo + 1));
const cycle = (types, rounds) => Array.from({ length: rounds }, (_, r) => types[r % types.length]);
/** Balloons and comets: every round pops `targets` of `total`; each pop is a question with the balloons left over the ones still to find. */
const popping = (L) => Array.from({ length: L.rounds }, () => Array.from({ length: L.targets }, (_, t) => ask((L.total - t) / (L.targets - t)))).flat();
/** The Moon and the Black Hole: count the jumps (or drops) she makes, or say how many she saw. An automatic count is not scored. */
const counting = (production) => (L) => cycle(L.types, L.rounds).map((type) => (type === production
  ? ask(3, { blind: span(L[production]), scored: !L.auto }) : ask(3)));
const STRIPE_POTS = { AB: 3, ABB: 3, gap: 3, ABC: 4 }; // the row's colours and the red pot

/** The questions one run of a level asks, from its GAME.md row: [{ options, blind, scored }]. */
const QUESTIONS = {
  letters: (L) => times(L.rounds, ask(Math.min(L.choices, size(L.pool)))),
  balloons: popping,
  name: (L, rng) => {
    if (L.mode === 'whose') return times(3, ask(3));
    const word = L.words[Math.floor(rng() * L.words.length)];
    if (L.mode === 'missing') return Array.from({ length: L.gaps }, (_, r) => ask((L.gaps - r + L.extras) / (L.gaps - r)));
    return Array.from({ length: size(word) }, (_, r) => ask(size(word) - r + L.extras));
  },
  cones: (L) => times(L.rounds, ask(Math.min(L.choices, L.max))),
  stones: (L) => times(L.rounds, L.bubble === 'missing' ? [ask(2)] : times(L.n, ask(L.choices))).flat(),
  counting: (L) => cycle(L.types, L.rounds).map((type) => {
    if (type === 'give') return ask(3, { blind: span(L.give), scored: !L.auto });
    if (type === 'share') return ask(3, { scored: false });
    return ask(3);
  }),
  lookout: (L) => times(L.rounds, ask(L.max)),
  delivery: (L) => times(L.rounds, ask(Math.min(L.choices, size(L.pool)))),
  picnic: (L) => times(L.rounds, ask(2)),
  garage: (L) => cycle(L.modes, L.rounds).flatMap((mode) => (mode === 'shapes' ? [ask(3)] : mode === 'pattern' ? [ask(3)] : times(4, ask(2)))),
  mercury: (L) => times(L.rounds, ask(L.choices)),
  venus: (L) => times(L.rounds, ask(L.choices)),
  moon: counting('jump'),
  mars: (L) => times(L.rounds, ask(Math.min(L.choices, L.max))),
  jupiter: (L) => cycle(L.types, L.rounds).map((type) => ask(type === 'stripes' ? STRIPE_POTS[L.pattern] : 2)),
  saturn: (L) => times(L.pieces, ask(2)),
  pluto: (L) => times(L.rounds, ask(L.choices)),
  blackhole: counting('drop'),
  comet: popping,
  stars: (L, rng) => Array.from({ length: L.rounds }, () => { const n = between(L.stars, rng); return Array.from({ length: n - 1 }, (_, k) => ask(n - 1 - k)); }).flat(),
  telescope: (L) => times(L.rounds, ask(L.choices)),
  lighthouse: (L) => times(L.rounds, L.mode === 'make' || L.mode === 'more' ? ask(span(L.numbers)) : ask(L.choices)),
  shallows: (L) => times(L.rounds, ask(2)),
  reef: (L) => times(L.rounds, ask(L.choices)),
  port: (L) => times(L.rounds, L.mode === 'which' ? ask(3) : ask(span(L.syllables))),
};

/** One level: `runs` runs by a random tapper, scored by the game's own scoreRun. */
function checkLevel(kind, L, runs, rng) {
  let scored = 0, clean = 0, chance = 0, told = 0, good = 0, leaps = 0, unscored = 0;
  for (let r = 0; r < runs; r++) {
    const questions = QUESTIONS[kind](L, rng);
    const events = questions.map((q, i) => {
      const { wrongs, assist } = answer(Math.max(2, Math.ceil(q.blind)), 1 / q.blind, rng);
      if (q.scored) { chance += 1 / q.blind; told += 1 / q.options; } else unscored++;
      return makeEvent({ mission: kind, skill: 'quantity', item: String(i), correct: true, firstTry: wrongs === 0, attempt: wrongs + 1, assistLevel: assist, options: q.options, scored: q.scored, at: i + 1 });
    });
    const run = scoreRun(events);
    scored += run.scored;
    clean += run.clean;
    if (!run.scored) continue;
    if (run.clean / run.scored >= GOOD_RUN) good++;
    if (run.clean === run.scored && run.scored >= LEAP_RUN) leaps++;
  }
  const perRun = scored / runs;
  return { perRun, unscored: unscored / runs, chance: scored ? chance / scored : NaN, told: scored ? told / scored : NaN, share: scored ? clean / scored : NaN, good: good / runs, leaps: leaps / runs, thin: perRun < 2 };
}

const f2 = (x) => (Number.isNaN(x) ? '  - ' : x.toFixed(2));
const f0 = (x) => (Number.isNaN(x) ? ' -' : `${Math.round(x * 100)}%`.padStart(4));
const rows = [];
for (const kind of MISSIONS) {
  if (!QUESTIONS[kind]) { console.error(`guesser: no run structure for ${kind}`); process.exitCode = 1; continue; }
  const rng = mulberry(101 + kind.length * 7 + kind.charCodeAt(0));
  const levels = LEVELS[kind].map((L, i) => ({ level: i + 1, ...checkLevel(kind, L, RUNS, rng) }));
  const judged = levels.filter((l) => !Number.isNaN(l.share));
  const mean = (key) => judged.reduce((a, l) => a + l[key], 0) / (judged.length || 1);
  const gaps = judged.map((l) => l.share - l.chance);
  const worst = judged[gaps.indexOf(Math.max(...gaps))];
  const fail = judged.filter((l) => l.share - l.chance > WITHIN);
  rows.push({ kind, levels, chance: mean('chance'), share: mean('share'), worst, fail, told: judged.filter((l) => Math.abs(l.told - l.chance) > WITHIN).map((l) => l.level),
    good: Math.max(...levels.map((l) => l.good)), leaps: Math.max(...levels.map((l) => l.leaps)), thin: levels.filter((l) => l.thin).map((l) => l.level) });
}

const levelList = (list) => (list.length ? `L${list.join(',')}` : '-');
console.log(`\nrandom tapper in each of the ${MISSIONS.length} missions, ${RUNS} runs per level (pass: clean share at most ${WITHIN * 100} points above chance on every level)`);
console.log(['mission', 'levels', 'chance', 'share', 'worst gap', 'good run', 'clean run', 'thin', 'told differs', 'verdict'].map((h, i) => h.padEnd([11, 7, 7, 6, 12, 9, 10, 10, 13, 0][i])).join(''));
for (const r of rows) {
  const gap = r.worst ? r.worst.share - r.worst.chance : NaN;
  console.log([r.kind, r.levels.length, f2(r.chance), f2(r.share), `${gap >= 0 ? '+' : ''}${f2(gap)} L${r.worst?.level ?? '-'}`, f0(r.good), f0(r.leaps), levelList(r.thin), levelList(r.told), r.fail.length ? `FAIL ${levelList(r.fail.map((l) => l.level))}` : 'pass']
    .map((v, i) => String(v).padEnd([11, 7, 7, 6, 12, 9, 10, 10, 13, 0][i])).join(''));
  if (ARGS.includes('--levels')) {
    for (const l of r.levels) console.log(`   L${String(l.level).padEnd(2)} ${l.perRun.toFixed(1)} scored + ${l.unscored.toFixed(1)} not scored per run · chance ${f2(l.chance)} share ${f2(l.share)} told ${f2(l.told)} · good run ${f0(l.good)} clean run ${f0(l.leaps)}${l.thin ? ' · thin' : ''}`);
  }
}
console.log('good run / clean run: the largest share over the mission\'s levels of a blind tapper\'s runs that win a level / that are clean throughout');
const failing = rows.filter((r) => r.fail.length);
console.log(`\n${rows.length - failing.length} of ${rows.length} missions pass${failing.length ? `; guessing pays in ${failing.map((r) => r.kind).join(', ')}` : ''}`);
if (failing.length) process.exitCode = 1;
