import { roundOrder } from './treats.js';

export const numbersIn = ([lo, hi]) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

export function moonRounds({ types, rounds, auto }, random = Math.random) {
  return roundOrder(types, rounds, { easy: ['jump'], random }).map((type, i) => ({
    type, auto: type === 'jump' && (auto || i === rounds - 1),
  }));
}

export const countVerdict = (count, target) => count < target ? 'few' : count > target ? 'many' : 'right';

export const neighbours = (n) => [n - 1, n, n + 1];
