// Jupiter's rounds as data: the painted stripe row and the two balls to compare. Pure (rng passed in), so
// tests/levels/jupiter.test.js checks them and scenes/jupiter.js only draws and animates what this decides.
import { shuffle } from '../util.js';

export const JUPITER_COLOURS = { white: 'biały', orange: 'pomarańczowy', brown: 'brązowy', red: 'czerwony' };
export const EXTRA_POT = 'red';
const W = 'white', O = 'orange', B = 'brown';

/** Every row the mission can paint. The blank is not part of the row: it is the stripe at `gap`. */
export const STRIPE_ROWS = {
  AB: [[W, O, W, O, W, O]],
  ABB: [
    [W, O, O, W, O, O, W],
    [W, O, O, W, O, O, W, O],
    [W, W, O, W, W, O, W],
    [W, W, O, W, W, O, W, W],
  ],
  ABC: [
    [W, O, B, W, O, B, W],
    [W, O, B, W, O, B, W, O],
  ],
  gap: [
    [W, O, W, O, W, O],
    [W, O, O, W, O, O, W, O],
    [W, W, O, W, W, O, W, W],
  ],
};

const one = (a, rng) => a[Math.floor(rng() * a.length)];

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
 * the answer. The pots are the row's colours plus red, and red is never part of a row.
 *   AB   white orange white orange white ?
 *   ABB  white orange orange white orange orange white ?
 *   gap  an AB or ABB row with one stripe missing in the middle
 *   ABC  white orange brown white orange brown white ?
 */
export function stripeRound(kind, rng = Math.random) {
  let row, gap, item;
  if (kind === 'ABB') {
    row = one(STRIPE_ROWS.ABB, rng);
    gap = row.length - 1;
    item = row[1] === row[2] ? 'ABB' : 'AAB';
  } else if (kind === 'ABC') {
    row = one(STRIPE_ROWS.ABC, rng);
    gap = row.length - 1;
    item = 'ABC';
  } else if (kind === 'gap') {
    row = one(STRIPE_ROWS.gap, rng);
    gap = one(row.length === 6 ? [2, 3] : [3, 4], rng);
    item = 'gap';
  } else {
    row = STRIPE_ROWS.AB[0];
    gap = row.length - 1;
    item = 'AB';
  }
  return { row, gap, answer: row[gap], choices: shuffle([...new Set(row), EXTRA_POT], rng), item };
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
