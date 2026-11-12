// Jupiter's rounds as data: the painted stripe row and the two balls to compare. Pure (rng passed in), so
// tests/levels/jupiter.test.js checks them and scenes/jupiter.js only draws and animates what this decides.
import { shuffle } from '../util.js';

export const JUPITER_COLOURS = { white: 'biały', orange: 'pomarańczowy', brown: 'brązowy', red: 'czerwony' };
const W = 'white', O = 'orange', B = 'brown', R = 'red';
export const PALETTE = [W, O, R, B];

/**
 * What repeats, by pattern. A row is the unit run on to a length (LENGTHS) with its last stripe blank, so which stripe
 * the blank is, and which colour, depends on where the unit starts and how long the row is. Every colour begins a
 * unit somewhere and ends a row somewhere, so every pot can be the right one.
 */
export const UNITS = {
  AB: [[W, O], [O, W], [R, W], [B, O]],
  ABB: [[W, O, O], [R, B, B], [W, W, O], [O, O, R]],
  ABC: [[W, O, B], [O, B, R]],
};
const LENGTHS = { AB: [6, 5], ABB: [7, 8], ABC: [7, 8, 9] };
/** A gap row: a row of this length with the stripe at one of these places blank (not the last one). */
const GAPS = { AB: { length: 6, at: [2, 3] }, ABB: { length: 8, at: [3, 4] } };

const run = (unit, length) => Array.from({ length }, (_, i) => unit[i % unit.length]);

/** Every row a kind of round can paint: [{ row, gap, item }]. The stripe at `gap` is blank and is the answer. */
export function stripeRows(kind) {
  if (kind === 'gap') {
    return ['AB', 'ABB'].flatMap((pattern) => UNITS[pattern].flatMap((unit) => GAPS[pattern].at.map((gap) => ({ row: run(unit, GAPS[pattern].length), gap, item: 'gap' }))));
  }
  const pattern = kind === 'AB' || kind === 'ABC' ? kind : 'ABB';
  return UNITS[pattern].flatMap((unit) => LENGTHS[pattern].map((length) => ({
    row: run(unit, length), gap: length - 1, item: pattern === 'ABB' ? (unit[1] === unit[2] ? 'ABB' : 'AAB') : pattern,
  })));
}

const one = (a, rng) => a[Math.floor(rng() * a.length)];

/** The stripes that repeat in a row (white orange · white orange orange · …): what is said after her answer. */
export function patternUnit(row) {
  for (let n = 1; n < row.length; n++) if (row.every((c, i) => c === row[i % n])) return row.slice(0, n);
  return row;
}

/** Which kind of round comes when. Extra rounds repeat stripes, away from another stripe when there is room. */
export function jupiterRounds({ types, rounds }, random = Math.random) {
  const kinds = [...new Set(types)];
  const out = kinds.slice(0, rounds);
  while (out.length < rounds) {
    const fits = [];
    for (let at = 0; at <= out.length; at++) {
      if (out[at - 1] !== 'stripes' && out[at] !== 'stripes') fits.push(at);
    }
    const at = fits.length ? fits[Math.floor(random() * fits.length)] : out.length;
    out.splice(at, 0, 'stripes');
  }
  return out;
}

/**
 * A stripe row with one blank: { row, gap, answer, choices, item }. row holds every stripe, the one at gap is
 * the answer. The pots are the row's colours plus, unless `foil` is off, one colour that is not in the row.
 *   AB   white orange white orange white ?          or one stripe shorter, starting with another colour
 *   ABB  white orange orange white orange orange white ?
 *   gap  an AB or ABB row with one stripe missing in the middle
 *   ABC  white orange brown white orange brown white ?
 */
export function stripeRound(kind, rng = Math.random, { foil = true } = {}) {
  const { row, gap, item } = one(stripeRows(kind), rng);
  const foils = PALETTE.filter((colour) => !row.includes(colour));
  return { row, gap, item, answer: row[gap], choices: shuffle([...new Set(row), ...(foil ? [one(foils, rng)] : [])], rng) };
}

/**
 * Two balls: { big, ask, left, right, answer, item }. Jupiter or the Sun is huge on one side, Earth on the
 * other. `big` asks for the bigger one; `both` asks bigger or smaller.
 */
export function biggerRound(kind, rng = Math.random) {
  const big = rng() < 0.5 ? 'jupiter' : 'sun';
  const ask = kind === 'both' && rng() < 0.5 ? 'smaller' : 'bigger';
  const earthLeft = rng() < 0.5;
  return {
    big, ask, item: ask,
    left: earthLeft ? 'earth' : big,
    right: earthLeft ? big : 'earth',
    answer: ask === 'bigger' ? big : 'earth',
  };
}
