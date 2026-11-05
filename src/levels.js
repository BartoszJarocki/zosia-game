// Difficulty design lives in GAME.md (one table row per level). This file adds the logic around it:
// lookalike distractors, number choices, and "assist" (a gentler run after a rough one).
import { levelFor, assistFor } from './progress.js';
import { LEVELS, maxLevel } from './levels/data.js';
import { shuffle } from './util.js';
import { EASIER } from './levels/easier.js';
import { isLookalike, distractors } from './levels/lookalikes.js';

export { LEVELS };
export { isLookalike, distractors };

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
