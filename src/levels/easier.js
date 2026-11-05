import { easier as easierGarage } from './garage.js';
import { gentler as gentlerRiver } from './river.js';

/** What a mission easier by one notch looks like after a rough run. */
export const EASIER = {
  letters: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), similar: false, ask: { audio: 'name', word: 'name', sound: 'word' }[s.ask] || s.ask }),
  balloons: (s) => ({ ...s, total: s.total - 2, speed: s.speed.map((v) => v * 0.7), similar: false }),
  name: (s) => ({ ...s, mode: ['missing', 'whose'].includes(s.mode) ? s.mode : 'ghost', extras: s.mode === 'missing' ? 1 : 0, similar: false }), // (whose: two trains)
  cones: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), bubble: 'both', sign: 'both' }), // one cone fewer: easier even where a level already shows both
  mars: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), ask: 'both', rock: 'both' }), // one rock fewer, numeral and dots shown
  stones: gentlerRiver,
  counting: (s) => ({ ...s, auto: true }),
  moon: (s) => ({ ...s, auto: true, slots: true }),
  stars: (s) => ({ ...s, labels: 'both', stars: [s.stars[0], s.stars[0]], rounds: 1 }), // one smaller picture
  mercury: (s) => ({ ...s, show: 'stay', labels: 'both', choices: Math.max(2, s.choices - 1) }),
  telescope: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), ask: ['feature', 'order'].includes(s.ask) ? 'name' : s.ask }),
  blackhole: (s) => ({ ...s, auto: true, slots: true }),
  saturn: (s) => ({ ...s, named: true, sizes: 'same' }),
  venus: (s) => ({ ...s, reveal: 'full', turned: false }),
  lookout: (s) => ({ ...s, bubble: 'both', mode: 'go' }),
  delivery: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), mode: 'pictureSound', similar: false }),
  picnic: (s) => ({ ...s, close: false, numerals: false }),
  garage: easierGarage,
  pluto: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), turned: false }),
};
