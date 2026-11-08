import { numberChoices } from './numbers.js';

/** One kind of round per level: she watches the lamp, or makes it flash. */
export const lighthousePlan = (mode, rounds) => Array.from({ length: rounds }, () => mode);

/** How many flashes the lamp shows first, and how many she must make. */
export const flashRound = (mode, n) => ({ flashes: n, target: mode === 'more' ? n + 1 : n });

/** Numeral choices: the answer with its neighbours, then the other numbers, shuffled. */
export const lighthouseChoices = (target, max, count) => numberChoices(target, max, count, true);
