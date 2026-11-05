// Difficulty design lives in GAME.md (one table row per level). This file adds the logic around it:
// lookalike distractors, number choices, and "assist" (a gentler run after a rough one).
import { levelFor, assistFor } from './progress.js';
import { LEVELS, ALL_LETTERS, maxLevel } from './levels/data.js';
import { shuffle } from './util.js';
import { EASIER } from './levels/easier.js';
import { isLookalike, distractors as pickDistractors } from './levels/lookalikes.js';

export { LEVELS };
export { numberChoices } from './levels/numbers.js';
export { isLookalike };

/** Island games take tricky letters from the whole alphabet, as they always have. */
export function distractors(target, pool, n, similar = false) {
  return pickDistractors(target, pool, n, similar, ALL_LETTERS);
}

export function settingsFor(kind) {
  const s = LEVELS[kind][Math.min(levelFor(kind), maxLevel(kind)) - 1];
  return assistFor(kind) ? { ...EASIER[kind](s), assist: true } : s;
}
export { levelFor };
