import { shuffle } from '../util.js';

// Uppercase letters that are easy to confuse. Kept apart early, used on purpose later.
const LOOKALIKE = {
  E: 'FB', F: 'EP', M: 'WN', W: 'MV', N: 'MHZ', O: 'CGD', C: 'OG', G: 'CO', P: 'RBF', R: 'PBK', B: 'PRD',
  D: 'OB', I: 'LTJ', L: 'IT', T: 'IL', U: 'OW', K: 'R', H: 'N', Z: 'SN', S: 'Z', J: 'I', A: 'H',
};

export const lookalikes = (l) => [...(LOOKALIKE[l] || '')];

/** Easy to confuse with each other (B and P, E and F…). */
export const isLookalike = (a, b) => lookalikes(a).includes(b) || lookalikes(b).includes(a);

/**
 * Pick `n` wrong answers for `target`.
 * similar=false: avoid lookalikes (fair for beginners). similar=true: include one or two on purpose,
 * drawn from `alphabet` (the letters a tricky lookalike may come from).
 */
export function distractors(target, pool, n, similar = false, alphabet = pool) {
  const look = lookalikes(target);
  const others = shuffle([...pool].filter((l) => l !== target && !look.includes(l)));
  if (!similar) return others.slice(0, n);
  const tricky = shuffle(look.filter((l) => alphabet.includes(l))).slice(0, Math.min(2, n));
  return shuffle([...tricky, ...others.slice(0, n - tricky.length)]);
}
