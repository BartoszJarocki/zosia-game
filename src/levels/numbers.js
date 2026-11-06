import { shuffle } from '../util.js';

/** Wrong number choices: neighbours (±1) are the natural challenge once she can count. */
export function numberChoices(target, max, n, near = false) {
  const all = Array.from({ length: max }, (_, i) => i + 1).filter((x) => x !== target);
  const close = near ? shuffle(all.filter((x) => Math.abs(x - target) === 1)) : [];
  const rest = shuffle(all.filter((x) => !close.includes(x)));
  return shuffle([target, ...[...close, ...rest].slice(0, n - 1)]);
}
