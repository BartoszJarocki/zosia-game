// Pluto's rounds as data: the heart and the shapes around it. Pure (rng passed in), so tests/levels/pluto.test.js
// checks them and scenes/pluto.js only draws and animates what this decides.
import { shuffle } from '../util.js';
import { SHAPES } from './garage.js';

const one = (a, rng) => a[Math.floor(rng() * a.length)];

/** The pieces on the icy ground, left to right: one heart and the rest from koło, kwadrat, trójkąt. */
export function plutoRound({ choices, turned }, rng = Math.random) {
  const shapes = ['heart', ...shuffle(SHAPES, rng).slice(0, choices - 1)];
  return {
    answer: 'heart',
    pieces: shuffle(shapes, rng).map((shape) => {
      const piece = { shape, turn: 0, size: 1 };
      if (!turned) return piece;
      piece.size = one([0.9, 1, 1.2], rng);
      if (shape === 'square') piece.turn = Math.PI / 4;
      if (shape === 'triangle') piece.turn = one([Math.PI, Math.PI / 2, -Math.PI / 2, 0.5], rng);
      if (shape === 'heart') piece.turn = one([-0.35, 0.35], rng);
      return piece;
    }),
  };
}
