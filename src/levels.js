// Difficulty design lives in GAME.md (one table row per level). This file adds the logic around it:
// lookalike distractors, number choices, and "assist" (a gentler run after a rough one).
import { levelFor, assistFor } from './progress.js';
import { LEVELS, ALL_LETTERS, maxLevel } from './levels/data.js';
import { shuffle } from './util.js';
import { EASIER } from './levels/easier.js';

export { LEVELS };

// Uppercase letters that are easy to confuse. Kept apart early, used on purpose later.
const LOOKALIKE = {
  E: 'FB', F: 'EP', M: 'WN', W: 'MV', N: 'MHZ', O: 'CGD', C: 'OG', G: 'CO', P: 'RBF', R: 'PBK', B: 'PRD',
  D: 'OB', I: 'LTJ', L: 'IT', T: 'IL', U: 'OW', K: 'R', H: 'N', Z: 'SN', S: 'Z', J: 'I', A: 'H',
};

/** Easy to confuse with each other (B and P, E and F…). */
export const isLookalike = (a, b) => (LOOKALIKE[a] || '').includes(b) || (LOOKALIKE[b] || '').includes(a);

/**
 * Pick `n` wrong answers for `target`.
 * similar=false: avoid lookalikes (fair for beginners). similar=true: include one or two on purpose.
 */
export function distractors(target, pool, n, similar = false) {
  const look = [...(LOOKALIKE[target] || '')];
  const others = shuffle([...pool].filter((l) => l !== target && !look.includes(l)));
  if (!similar) return others.slice(0, n);
  const tricky = shuffle(look.filter((l) => ALL_LETTERS.includes(l))).slice(0, Math.min(2, n));
  return shuffle([...tricky, ...others.slice(0, n - tricky.length)]);
}

/** Wrong number choices: neighbours (±1) are the natural challenge once she can count. */
export function numberChoices(target, max, n, near = false) {
  const all = Array.from({ length: max }, (_, i) => i + 1).filter((x) => x !== target);
  const close = near ? shuffle(all.filter((x) => Math.abs(x - target) === 1)) : [];
  const rest = shuffle(all.filter((x) => !close.includes(x)));
  return shuffle([target, ...[...close, ...rest].slice(0, n - 1)]);
}

export function settingsFor(kind) {
  const s = LEVELS[kind][Math.min(levelFor(kind), maxLevel(kind)) - 1];
  return assistFor(kind) ? { ...EASIER[kind](s), assist: true } : s;
}
export { levelFor };
