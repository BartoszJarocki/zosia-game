// The play check's rules (docs/IMPROVEMENT-PLAN.md, "Rules every unit keeps"), judged from what the child-like
// player saw. Pure: judge() takes the summary.json of each run of one level (tools/playtest/kid.mjs) and that
// level's row from GAME.md, and returns pass or fail per rule with a short reason. Verification tooling.
//
// The parts of a summary the rules read:
//   plan       'fast' | 'wrong-first' | 'quick' | 'mash' | 'polite'
//   taps[]     { t, label, aim: 'thing' | 'empty' | 'bubble' | 'fingers', hit, soundMs }
//              soundMs: from the tap to the first sound it started, or null when none started within a second
//   rounds[]   { q: 'skill:item', bubble, right, answerMs, waitNextMs,
//                quick?: { made, counted, what },
//                wrongFirst?: { tapped, help, shown: [], closed } }
//              right: the label of the right option when the question opened (null when no option is right by itself)
import { T, TELESCOPE_NAMES } from '../../src/lang/pl.js';
import { letterName } from '../../src/config.js';

export const SOUND_MS = 200;
export const MIDDLE_WAIT_MS = 4000;
export const LONGEST_WAIT_MS = 8000;
export const HELP_AFTER_ONE_WRONG = 1; // the shared ladder's "try again"

/**
 * Rows of missions without an `ask` column where the bubble may show what the right option shows. Each is
 * grounded in GAME.md's words. A mission with an `ask` column is fair only where `ask` is `match`.
 * when(row, skill): skill is the question's (one river or one ride can mix kinds).
 */
export const FAIR_BUBBLE = {
  name: { when: (row) => row.mode === 'ghost', why: '`ghost`: faint letters on the wagons, match each block to its wagon' },
  cones: { when: (row) => row.bubble === 'both' || row.bubble === 'numeral', why: 'bubble `both` or `numeral` shows the numeral the signs show; only `dots` asks her to count and find it' },
  stones: { when: (row, skill) => row.bubble === 'numeral' || skill === 'numeral', why: '`numeral`: shows the next number; a river always starts at stone 1 (`next` and `missing` ask the rest)' },
  lookout: { when: (row, skill) => row.mode === 'pickup' || (row.mode === 'relative' && skill === 'numeral'), why: '`pickup`: "Kotek czeka na piętrze dwa!" (the number in the bubble); `relative`: the first ride is a `pickup`' },
  reef: { when: (row) => row.mode === 'see', why: '`see` shows a small picture of the asked position in the bubble, to match with what she sees' },
  delivery: { when: (row) => row.mode === 'pictureSound', why: '`pictureSound`: the bubble shows the asked letter and the parcels show pictures, so the letter is the question' },
};

/** Bubbles that show the answer as a picture, not as its label (saturn.js: the piece's kind is the ring to pick). */
export const BUBBLE_PICTURES = { saturn: { ice: '❄️', rock: '🪨' } };

const tokens = (text) => String(text ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const said = (segments) => [segments].flat().join(' ');

/** The words that name an answer aloud, from the game's own lines (numbers, shapes, letters, places). */
function spokenNames(right) {
  const r = String(right ?? '');
  if (/^\d+$/.test(r) && Number(r) <= 10) return tokens(said(T.number(Number(r))));
  if (['circle', 'square', 'triangle', 'heart'].includes(r)) return tokens(said(T.shape(r)));
  if (TELESCOPE_NAMES[r]) return [tokens(TELESCOPE_NAMES[r]).join(' ')];
  if (/^\p{Lu}$/u.test(r)) { const n = letterName(r).toLowerCase(); return n.length > 1 ? [n] : []; } // (a vowel's name is also a word: "a", "i", "o")
  return [];
}

/** The game said the answer's name after her wrong tap, and the question had not said it. */
export function answerNamed(right, saidAfter, prompt) {
  const after = ` ${tokens(said(saidAfter)).join(' ')} `, before = ` ${tokens(said(prompt)).join(' ')} `;
  return spokenNames(right).some((n) => after.includes(` ${n} `) && !before.includes(` ${n} `));
}

/** The bubble shows what the right option shows: its label as the bubble's only word, or its picture. */
export function bubbleShowsAnswer(kind, bubble, right) {
  if (right == null || !bubble) return false;
  const words = String(bubble).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (words.length === 1 && words[0].toUpperCase() === String(right).toUpperCase()) return true;
  const pic = BUBBLE_PICTURES[kind]?.[right];
  return Boolean(pic && String(bubble).includes(pic));
}

function fairBubble(kind, row, skill) {
  if (row && 'ask' in row) return row.ask === 'match';
  return Boolean(FAIR_BUBBLE[kind]?.when(row ?? {}, skill));
}

const verdict = (pass, why) => ({ pass, why });
const notMeasured = (why) => verdict(null, why);
const kindOf = (runs) => runs[0]?.kind;
const s1 = (ms) => `${(ms / 1000).toFixed(1)} s`;
const tally = (labels) => Object.entries(labels.reduce((m, l) => ({ ...m, [l]: (m[l] || 0) + 1 }), {})).map(([l, n]) => (n > 1 ? `${l} x${n}` : l)).join(', ');

/** 1. Every tap answers: quick counting taps are all counted, and a tap on a thing gets a sound within 0.2 s. */
export function everyTapAnswers(runs) {
  const quick = runs.filter((r) => r.plan === 'quick').flatMap((r) => r.rounds.filter((x) => x.quick));
  const taps = runs.flatMap((r) => (r.taps || []).filter((t) => t.aim === 'thing' && t.hit));
  if (!quick.length && !taps.length) return notMeasured('no taps on things');
  const made = quick.reduce((n, x) => n + x.quick.made, 0), counted = quick.reduce((n, x) => n + Math.min(x.quick.made, x.quick.counted), 0);
  const silent = taps.filter((t) => t.soundMs == null || t.soundMs > SOUND_MS);
  const why = [];
  if (counted < made) why.push(`quick: ${counted} of ${made} counted (${quick.filter((x) => x.quick.counted < x.quick.made).map((x) => `${x.quick.what} ${x.quick.counted}/${x.quick.made}`).join(', ')})`);
  if (silent.length) why.push(`${silent.length} of ${taps.length} taps silent (${tally(silent.map((t) => t.label))})`);
  if (why.length) return verdict(false, why.join('; '));
  return verdict(true, `${quick.length ? `quick ${counted}/${made} counted, ` : ''}${taps.length} taps answered`);
}

/** 2. The question is hers: the bubble does not show the answer (except matching rows), one wrong tap does not show it. */
export function questionIsHers(runs, row) {
  const kind = kindOf(runs);
  const rounds = runs.flatMap((r) => r.rounds);
  const shown = new Map();
  for (const x of rounds) {
    const skill = String(x.q ?? '').split(':')[0];
    if (bubbleShowsAnswer(kind, x.bubble, x.right) && !fairBubble(kind, row, skill)) shown.set(`"${x.bubble}" for ${x.right}`, true);
  }
  const tries = runs.filter((r) => r.plan === 'wrong-first').flatMap((r) => r.rounds.filter((x) => x.wrongFirst));
  const gave = tries.filter((x) => x.wrongFirst.help > HELP_AFTER_ONE_WRONG || x.wrongFirst.shown.length || x.wrongFirst.closed);
  const why = [];
  if (shown.size) why.push(`bubble shows the answer: ${[...shown.keys()].join(', ')}`);
  if (gave.length) {
    const what = gave.map((x) => {
      const w = x.wrongFirst;
      return [w.help > HELP_AFTER_ONE_WRONG && `help ${w.help}`, ...w.shown, w.closed && 'the game answered'].filter(Boolean).join('+');
    });
    why.push(`one wrong tap shows it in ${gave.length} of ${tries.length} (${tally(what)})`);
  }
  if (why.length) return verdict(false, why.join('; '));
  if (!tries.length) return verdict(true, 'bubble keeps the answer; no wrong option to try');
  return verdict(true, `bubble keeps the answer; ${tries.length} wrong taps showed nothing`);
}

/** 3. She plays more than she watches: from a right answer to the next question, middle at most 4 s, longest at most 8 s. */
export function playsMoreThanWatches(runs) {
  const fast = runs.find((r) => r.plan === 'fast');
  if (!fast) return notMeasured('no fast run');
  const answered = fast.rounds.filter((x) => x.answerMs != null && x.waitNextMs != null);
  const waits = answered.slice(0, -1).map((x) => x.waitNextMs).sort((a, b) => a - b); // (the last one waits for the badge)
  if (!waits.length) return notMeasured('one question');
  const h = waits.length >> 1, middle = waits.length % 2 ? waits[h] : (waits[h - 1] + waits[h]) / 2, longest = waits[waits.length - 1]; // (the median pace.py takes)
  const pass = middle <= MIDDLE_WAIT_MS && longest <= LONGEST_WAIT_MS;
  return verdict(pass, `middle ${s1(middle)}, longest ${s1(longest)}`);
}

export const RULES = [
  { id: 1, name: 'every tap answers', judge: everyTapAnswers },
  { id: 2, name: 'the question is hers', judge: questionIsHers },
  { id: 3, name: 'she plays more than she watches', judge: playsMoreThanWatches },
];

/** Every rule's verdict for one level: [{ id, name, pass: true | false | null (not measured), why }]. */
export function judge(runs, row) {
  return RULES.map(({ id, name, judge: rule }) => ({ id, name, ...rule(runs, row) }));
}
