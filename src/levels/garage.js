// The Garage's rounds as data: which shape pieces lie on the ground, which flags hang on the line, which blocks
// go into which basket. Pure (rng passed in), so tests/levels/garage.test.js checks them and scenes/garage.js
// only draws and animates what this decides.

export const SHAPES = ['circle', 'square', 'triangle'];
export const COLOURS = ['red', 'blue', 'yellow', 'green']; // far apart on purpose: never two shades of one colour
/** Each GAME.md column's values, easiest first. A gentler run steps every one down a rung. */
export const LADDERS = { shapes: ['shown', 'name', 'turned'], pattern: ['AB', 'gap', 'ABB'], sort: ['colour', 'size', 'switch'] };
/** Triangles that don't look like the textbook one (the `turned` level): a square corner, long and flat, tall and thin. */
export const ODD_TRIANGLES = ['right', 'flat', 'tall'];

const shuffle = (a, rng) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const one = (a, rng) => a[Math.floor(rng() * a.length)];

/** The same level row, one rung easier in every mode (after a rough run). */
export function easier(row) {
  const out = { ...row };
  for (const [key, ladder] of Object.entries(LADDERS)) if (row[key]) out[key] = ladder[Math.max(0, ladder.indexOf(row[key]) - 1)];
  return out;
}

/**
 * The three shape pieces on the ground, in the order they lie left to right: { shape, colour, turn, size, odd }.
 * shown / name: the textbook shapes, upright, all one size. turned: turned and resized, the square stood on a
 * corner, and the triangle one of ODD_TRIANGLES (its hole has the same odd shape, upright).
 */
export function shapePieces(mode, rng = Math.random) {
  const colours = shuffle(COLOURS, rng);
  return shuffle(SHAPES, rng).map((shape, i) => {
    const piece = { shape, colour: colours[i], turn: 0, size: 1, odd: null };
    if (mode !== 'turned') return piece;
    piece.size = one([0.8, 0.9, 1.15], rng);
    if (shape === 'square') piece.turn = Math.PI / 4;
    if (shape === 'triangle') { piece.odd = one(ODD_TRIANGLES, rng); piece.turn = one([Math.PI, Math.PI / 2, -Math.PI / 2, 0.5], rng); }
    return piece;
  });
}

/**
 * A row of flags with one missing: { row, gap, answer, choices, item }. row holds every flag (the one at `gap` is
 * the answer); choices are the two colours of the pattern and one that isn't in it.
 *   AB   red blue red blue ?   (5 or 6 long, so the answer isn't always the first colour)
 *   gap  red blue ? blue red blue: one missing in the middle
 *   ABB  red blue blue red blue blue red ?   (or red red blue…), 7 or 8 long
 * item names the pattern for the learning stats: AB · gap · ABB · AAB.
 */
export function patternRound(kind, rng = Math.random) {
  const [a, b, c] = shuffle(COLOURS, rng);
  const triple = kind === 'ABB';
  const unit = triple ? one([[a, b, b], [a, a, b]], rng) : [a, b];
  const length = triple ? one([7, 8], rng) : kind === 'gap' ? 6 : one([5, 6], rng);
  const row = Array.from({ length }, (_, i) => unit[i % unit.length]);
  const gap = kind === 'gap' ? one([2, 3], rng) : length - 1;
  const item = triple ? (unit[1] === unit[2] ? 'ABB' : 'AAB') : kind === 'gap' ? 'gap' : 'AB';
  return { row, gap, answer: row[gap], choices: shuffle([a, b, c], rng), item };
}

/**
 * Two baskets and four blocks in the order she gets them: { baskets: [{ colour, size }], blocks: [{ colour, size, rule }] }.
 * Every block carries the rule it is sorted by, so the switch is simply blocks whose rule changes halfway.
 *   colour  two baskets of one size in two colours, blocks of no particular size: only the colour differs
 *   size    a big and a small wicker basket (colour null), blocks all one colour: only the size differs
 *   switch  a big basket and a small one in two colours, blocks that are big in one colour and small in the
 *           other: the first two go by colour, the last two by size, and every block points the other way
 */
export function sortRound(kind, rng = Math.random) {
  const [a, b] = shuffle(COLOURS, rng);
  if (kind === 'colour') {
    return { baskets: [{ colour: a, size: 'big' }, { colour: b, size: 'big' }], blocks: shuffle([a, b, a, b], rng).map((colour) => ({ colour, size: null, rule: 'colour' })) };
  }
  if (kind === 'size') {
    return { baskets: shuffle([{ colour: null, size: 'big' }, { colour: null, size: 'small' }], rng), blocks: shuffle(['big', 'small', 'big', 'small'], rng).map((size) => ({ colour: a, size, rule: 'size' })) };
  }
  const mixed = [{ colour: a, size: 'small' }, { colour: b, size: 'big' }];
  return {
    baskets: shuffle([{ colour: a, size: 'big' }, { colour: b, size: 'small' }], rng),
    blocks: [...shuffle(mixed, rng).map((x) => ({ ...x, rule: 'colour' })), ...shuffle(mixed, rng).map((x) => ({ ...x, rule: 'size' }))],
  };
}

/** Which basket (index) a block goes into, by its rule. */
export const basketFor = (block, baskets) => baskets.findIndex((k) => k[block.rule] === block[block.rule]);
