import { roundOrder } from './treats.js';

export const numbersIn = ([lo, hi]) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

export function moonRounds({ types, rounds, auto }, random = Math.random) {
  const easy = types.includes('drop') ? 'drop' : 'jump';
  return roundOrder(types, rounds, { easy: [easy], random }).map((type, i) => ({
    type, auto: type === easy && (auto || i === rounds - 1),
  }));
}

export const countVerdict = (count, target) => count < target ? 'few' : count > target ? 'many' : 'right';
