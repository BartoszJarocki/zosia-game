import { shuffle } from '../util.js';

/** Every number a Mars round may ask about. */
export const marsPool = (max) => Array.from({ length: max }, (_, i) => i + 1);

/** Matching numerals is numeral; counting dots or listening for the number is quantity. */
export const marsSkill = (ask) => (ask === 'dots' || ask === 'name' ? 'quantity' : 'numeral');

/** What the speech bubble shows: [big numeral, dots]. */
export function marsBubble(ask, target) {
  return { both: [String(target), target], numeral: [String(target), 0], dots: ['', target], name: ['', 0] }[ask];
}

/** Pick the rocks: from level 2 the wrong ones are the neighbours (±1), as on Cone Road. */
export function marsChoices(target, { max, choices }, level = 1) {
  const n = Math.min(choices, max);
  const all = Array.from({ length: max }, (_, i) => i + 1).filter((x) => x !== target);
  const close = level >= 2 ? all.filter((x) => Math.abs(x - target) === 1) : [];
  const rest = all.filter((x) => !close.includes(x));
  return shuffle([target, ...[...close, ...rest].slice(0, n - 1)]);
}
