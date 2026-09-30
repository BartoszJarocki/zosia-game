// Difficulty design. Every mission goes: match what you see → recognise what you hear → think for yourself.
// Each step changes ONE thing, so it feels natural but still a little bit challenging.
import { CONFIG } from './config.js';
import { levelFor, assistFor } from './progress.js';
import { shuffle } from './util.js';

const uniq = (s) => [...new Set(s)].join('');
const name = (CONFIG.childName || '').toUpperCase();

// Letters are introduced gradually: her own name first, then MAMA/TATA letters, then the rest.
export const LETTERS_1 = uniq(name + 'AMTO').replace(/[^A-Z]/g, '');   // Z O S I A M T
export const LETTERS_2 = uniq(LETTERS_1 + 'EULDPKBW');                  // + the next most common
export const LETTERS_3 = uniq(LETTERS_2 + CONFIG.letters);              // everything

// Uppercase letters that are easy to confuse. Kept apart early, used on purpose later.
const LOOKALIKE = {
  E: 'FB', F: 'EP', M: 'WN', W: 'MV', N: 'MHZ', O: 'CGD', C: 'OG', G: 'CO', P: 'RBF', R: 'PBK', B: 'PRD',
  D: 'OB', I: 'LTJ', L: 'IT', T: 'IL', U: 'OW', K: 'R', H: 'N', Z: 'SN', S: 'Z', J: 'I', A: 'H',
};

/**
 * Pick `n` wrong answers for `target`.
 * similar=false: avoid lookalikes (fair for beginners). similar=true: include one or two on purpose.
 */
export function distractors(target, pool, n, similar = false) {
  const look = [...(LOOKALIKE[target] || '')];
  const others = shuffle([...pool].filter((l) => l !== target && !look.includes(l)));
  if (!similar) return others.slice(0, n);
  const tricky = shuffle(look.filter((l) => CONFIG.letters.includes(l))).slice(0, Math.min(2, n));
  return shuffle([...tricky, ...others.slice(0, n - tricky.length)]);
}

/** Wrong number choices: neighbours (±1) are the natural challenge once she can count. */
export function numberChoices(target, max, n, near = false) {
  const all = Array.from({ length: max }, (_, i) => i + 1).filter((x) => x !== target);
  const close = near ? shuffle(all.filter((x) => Math.abs(x - target) === 1)) : [];
  const rest = shuffle(all.filter((x) => !close.includes(x)));
  return shuffle([target, ...[...close, ...rest].slice(0, n - 1)]);
}

export const LEVELS = {
  // Kitty Park: find the letter.
  letters: [
    { pool: LETTERS_1, choices: 3, show: 'letter', similar: false },   // match the letter in the bubble
    { pool: LETTERS_2, choices: 3, show: 'letter', similar: false },   // more letters
    { pool: LETTERS_3, choices: 4, show: 'picture', similar: true },   // only hear it + picture clue
  ],
  // Balloon Hill: find every balloon with the letter, while they float.
  balloons: [
    { pool: LETTERS_1, targets: 2, total: 5, speed: [0.3, 0.45], similar: false },
    { pool: LETTERS_2, targets: 3, total: 7, speed: [0.45, 0.65], similar: false },
    { pool: LETTERS_3, targets: 3, total: 8, speed: [0.6, 0.85], similar: true },
  ],
  // Name Train: letters in order.
  name: [
    { words: [name], ghost: true, bubble: 'letter', extras: 0 },               // ghost letters on the wagons
    { words: [name, 'MAMA', 'TATA'], ghost: false, bubble: 'word', extras: 1 }, // whole word shown, next letter lit
    { words: [name, ...CONFIG.nameWords], ghost: false, bubble: 'word', extras: 2, similar: true },
  ],
  // Cone Road: numbers ↔ quantities.
  cones: [
    { max: 3, choices: 3, bubble: 'both', sign: 'both' },      // numeral + dots everywhere: match
    { max: 5, choices: 3, bubble: 'numeral', sign: 'both' },   // hear/see the numeral, dots help on the signs
    { max: 6, choices: 4, bubble: 'dots', sign: 'numeral' },   // count the dots, find the numeral
  ],
  // River: numbers in order.
  stones: [
    { n: 3, rounds: 3, bubble: 'numeral' },
    { n: 5, rounds: 3, bubble: 'numeral' },
    { n: 7, rounds: 3, bubble: 'next' },                        // "what comes after 3?"
  ],
  // Treat House: counting.
  counting: [
    { types: ['give'], give: [1, 3], auto: true },                                  // box stops at N
    { types: ['give', 'howMany'], give: [2, 5], howMany: [1, 4], auto: true },      // + "how many?"
    { types: ['give', 'howMany'], give: [3, 7], howMany: [2, 6], auto: false },     // she decides when to stop
  ],
};

/** What a mission easier by one notch looks like after a rough run. */
const ASSIST = {
  letters: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), show: 'letter', similar: false }),
  balloons: (s) => ({ ...s, total: s.total - 2, speed: s.speed.map((v) => v * 0.7), similar: false }),
  name: (s) => ({ ...s, ghost: true, extras: 0, similar: false }),
  cones: (s) => ({ ...s, choices: 3, bubble: 'both', sign: 'both' }),
  stones: (s) => ({ ...s, bubble: 'numeral' }),
  counting: (s) => ({ ...s, auto: true }),
};

export function settingsFor(kind) {
  const s = LEVELS[kind][levelFor(kind) - 1];
  return assistFor(kind) ? { ...ASSIST[kind](s), assist: true } : s;
}
export { levelFor };
