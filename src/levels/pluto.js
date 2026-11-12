// Pluto's rounds as data: the shape asked each round, and the pieces on the ice around it. Pure (rng passed in), so
// tests/levels/pluto.test.js checks them and scenes/pluto.js only draws and animates what this decides.
import { shuffle } from '../util.js';

/** Every shape a piece can be (world/garage-props.js draws each, pl.js names each). */
export const SHAPES = ['heart', 'star', 'oval', 'rectangle', 'diamond', 'circle', 'square', 'triangle'];
/** The shape each is most easily taken for: they lie side by side only at the `similar` levels. */
export const TWIN = { oval: 'circle', circle: 'oval', rectangle: 'square', square: 'rectangle', diamond: 'square' };
/** How far a piece turns at the `turned` levels: the square never turns 45°, so it never becomes a diamond. */
const TURNS = {
  heart: [-0.35, 0.35], star: [-0.3, 0.3], oval: [Math.PI / 2, 0.4], rectangle: [Math.PI / 2, -0.35], diamond: [-0.2, 0.2],
  circle: [0], square: [-0.3, 0.3], triangle: [Math.PI, Math.PI / 2, -Math.PI / 2, 0.5],
};

const one = (a, rng) => a[Math.floor(rng() * a.length)];

/** The shape asked in each round of a visit: the level's shapes in a shuffled order, never the same one twice in a row. */
export function plutoAsks({ shapes, rounds }, rng = Math.random) {
  const out = [];
  while (out.length < rounds) {
    const bag = shuffle(shapes, rng);
    if (bag.length > 1 && bag[0] === out.at(-1)) bag.push(bag.shift());
    out.push(...bag);
  }
  return out.slice(0, rounds);
}

/** The pieces on the ice, left to right: the asked shape, its twin when `similar`, and others (never its twin otherwise). */
export function plutoRound({ choices, similar, turned }, answer, rng = Math.random) {
  const twin = TWIN[answer];
  const others = shuffle(SHAPES.filter((s) => s !== answer && s !== twin), rng);
  const shapes = [answer, ...(similar && twin ? [twin] : []), ...others].slice(0, choices);
  return {
    answer,
    pieces: shuffle(shapes, rng).map((shape) => (turned ? { shape, turn: one(TURNS[shape], rng), size: one([0.9, 1, 1.2], rng) } : { shape, turn: 0, size: 1 })),
  };
}
