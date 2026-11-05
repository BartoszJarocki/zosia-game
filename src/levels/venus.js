// Venus's rounds as data: which shape hides behind the clouds and which tiles she can pick.
// Pure (rng passed in), so tests/levels/venus.test.js checks it and scenes/venus.js only draws it.
import { shuffle } from '../util.js';
import { SHAPES, shapePieces } from './garage.js';

/**
 * The shapes for one mission, in play order: each of koło, kwadrat and trójkąt comes up before any repeats,
 * and the same shape never comes twice in a row.
 */
export function venusRounds(rounds, random = Math.random) {
  const out = [];
  while (out.length < rounds) {
    const bag = shuffle(SHAPES, random);
    if (bag[0] === out.at(-1)) [bag[0], bag[1]] = [bag[1], bag[0]];
    out.push(...bag.slice(0, rounds - out.length));
  }
  return out;
}

/** The tiles: the right shape and `choices - 1` other shapes, in a fresh order. */
export function venusChoices(target, choices, random = Math.random) {
  const others = shuffle(SHAPES.filter((shape) => shape !== target), random).slice(0, choices - 1);
  return shuffle([target, ...others], random);
}

/** The revealed shape's piece: textbook, or the Garage's turned and resized piece. */
export function venusPiece(shape, turned, random = Math.random) {
  return shapePieces(turned ? 'turned' : 'name', random).find((piece) => piece.shape === shape);
}
