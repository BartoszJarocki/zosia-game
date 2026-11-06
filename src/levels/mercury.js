import { DICE } from '../textures.js';
import { numberChoices } from './numbers.js';

/** Die positions (0 = top left … 8 = bottom right) for 1 to 6 craters, seen at a glance. */
export const craterCells = (n) => DICE[n];

/** The biggest numeral a tile may show: one more than the craters, but never past six. */
export const craterMax = ([, hi], n) => Math.min(6, Math.max(hi, n + 1));

/** Number tiles for a crater count: from level 2 the wrong ones are its neighbours (±1). */
export const craterChoices = (n, craters, count, near) => numberChoices(n, craterMax(craters, n), count, near);

export const nearFromLevel = (level) => level >= 2;
