// The Black Hole's taking away as data: how many pebbles were on the shelf, how many fell in, and the tiles to pick
// from. Pure (rng passed in), so tests/levels/blackhole.test.js checks it and scenes/blackhole.js only draws it.
import { numbersIn } from './moon.js';
import { shuffle } from '../util.js';

/** Every number that can be left: there were `away`, `fall` fell in, and at least one stays. */
export const leftNumbers = ({ away, fall }) => numbersIn([Math.max(1, away[0] - fall[1]), away[1] - fall[0]]);

/** A round that leaves `left`: { was, fell, left }, with was in the away range and fell in the fall range. */
export function takeAway({ away, fall }, left, random = Math.random) {
  const fells = numbersIn(fall).filter((k) => left + k >= away[0] && left + k <= away[1]);
  const fell = fells[Math.floor(random() * fells.length)];
  return { was: left + fell, fell, left };
}

/** Three tiles: what is left, what there was (she forgot to take away), and a neighbour of what is left. */
export function awayChoices({ was, left }, random = Math.random) {
  const near = [left - 1, left + 1, left + 2].find((n) => n >= 1 && n !== was);
  return shuffle([left, was, near], random);
}
