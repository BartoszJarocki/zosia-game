import { easier as easierGarage } from './garage.js';
import { gentler as gentlerRiver } from './river.js';

const lower = (range) => range && [range[0], Math.max(range[0], range[1] - 1)];

/** What a mission easier by one notch looks like after a rough run. */
export const EASIER = {
  letters: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), similar: false, ask: { audio: 'name', word: 'name', sound: 'word' }[s.ask] || s.ask }),
  balloons: (s) => ({ ...s, total: s.total - 2, speed: s.speed.map((v) => v * 0.7), similar: false }),
  comet: (s) => ({ ...s, total: s.total - 2, speed: s.speed.map((v) => v * 0.7), similar: false }),
  name: (s) => ({ ...s, mode: ['missing', 'whose'].includes(s.mode) ? s.mode : 'ghost', extras: s.mode === 'missing' ? 1 : 0, similar: false }), // (whose: two trains)
  cones: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), bubble: 'both', sign: 'both' }), // one cone fewer: easier even where a level already shows both
  mars: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), ask: 'both', rock: 'both' }), // one rock fewer, numeral and dots shown
  stones: gentlerRiver,
  counting: (s) => ({ ...s, auto: true, slots: true, give: lower(s.give), howMany: lower(s.howMany), share: lower(s.share), flash: lower(s.flash), hidden: lower(s.hidden) }), // (rings, and one number less at the top of every range: the first levels are no longer the same as their gentler run)
  moon: (s) => ({ ...s, auto: true, slots: true }),
  stars: (s) => ({ ...s, labels: 'both', stars: [s.stars[0], s.stars[0]], rounds: 1 }), // one smaller picture
  mercury: (s) => ({ ...s, show: 'stay', labels: 'both', choices: Math.max(2, s.choices - 1) }),
  telescope: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), ask: ['feature', 'order'].includes(s.ask) ? 'name' : s.ask }),
  jupiter: (s) => ({ ...s, pattern: 'AB', bigger: 'big' }),
  blackhole: (s) => ({ ...s, auto: true, slots: true }),
  saturn: (s) => ({ ...s, named: true, sizes: 'same' }),
  venus: (s) => ({ ...s, reveal: 'full', turned: false }),
  lookout: (s) => (s.mode === 'pickup' && s.bubble === 'both' && s.max <= 3 ? { ...s, rounds: 1 } : { ...s, bubble: 'both', mode: 'go' }), // (the first level is already one easy kitten a ride: a gentler run is one ride)
  delivery: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), mode: 'pictureSound', similar: false }),
  picnic: (s) => ({ ...s, close: false, numerals: false, max: Math.max(4, s.max - 1) }), // (one treat fewer at the top, so the first levels have a gentler run too)
  garage: easierGarage,
  pluto: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), turned: false }),
  lighthouse: (s) => ({ ...s, choices: Math.max(2, (s.choices ?? 2) - 1), numbers: [s.numbers[0], Math.max(s.numbers[0], s.numbers[1] - 1)] }),
  shallows: (s) => ({ ...s, mode: 'watch', things: 'familiar' }),
  reef: (s) => ({ ...s, mode: 'see', choices: Math.max(2, s.choices - 1) }),
  port: (s) => ({ ...s, mode: 'together', syllables: [1, 2], rounds: Math.min(3, s.rounds) }),
};
