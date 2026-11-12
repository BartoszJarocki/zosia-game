import { easier as easierGarage } from './garage.js';
import { gentler as gentlerRiver } from './river.js';

const lower = ([lo, hi]) => [lo, Math.max(lo, hi - 1)];

/** Order and feature fall back to names with one choice fewer; names with two choices left fall back to matching; matching with two choices is a shorter run. */
function gentlerTelescope(s) {
  const choices = Math.max(2, s.choices - 1);
  const ask = { order: 'name', feature: 'name' }[s.ask] ?? (s.ask === 'name' && choices === s.choices ? 'match' : s.ask);
  return { ...s, ask, choices, rounds: ask === s.ask && choices === s.choices ? Math.max(2, s.rounds - 1) : s.rounds };
}

/** What a mission easier by one notch looks like after a rough run. */
export const EASIER = {
  letters: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), similar: false, ask: { audio: 'name', word: 'name', sound: 'word' }[s.ask] || s.ask }),
  balloons: (s) => ({ ...s, ask: 'match', total: s.total - 2, speed: s.speed.map((v) => v * 0.7), similar: false }), // (the letter shown again)
  comet: (s) => ({ ...s, total: Math.max(s.targets + 1, s.total - 2), speed: s.speed.map((v) => v * 0.7), similar: false, ask: 'match' }), // (one wrong comet stays, the letter shown)
  name: (s) => ({ ...s, ...(s.mode === 'missing' ? { gaps: Math.max(1, (s.gaps ?? 2) - 1), extras: 1 } : { mode: s.mode === 'whose' ? 'whose' : 'ghost', extras: 0 }), similar: false }), // (whose: two trains)
  cones: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), bubble: 'both', sign: 'both' }), // one cone fewer: easier even where a level already shows both
  mars: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), ask: 'match', rock: 'both' }), // one rock fewer, numeral and dots shown
  stones: gentlerRiver,
  counting: (s) => ({ ...s, auto: true }),
  moon: (s) => ({ ...s, auto: true, slots: true, jump: lower(s.jump), howMany: s.howMany && lower(s.howMany) }), // (level 1 already has both on: one number fewer at the top)
  stars: (s) => ({ ...s, order: 'up', labels: 'both', stars: [s.stars[0], s.stars[0]], rounds: 1 }), // one smaller picture, counted up
  mercury: (s) => ({ ...s, show: 'stay', labels: 'both', choices: Math.max(2, s.choices - 1) }),
  telescope: gentlerTelescope,
  jupiter: (s) => ({ ...s, pattern: 'AB', bigger: 'big', foil: false }), // (the row's two colours only: no pot that is not in it)
  blackhole: (s) => ({ ...s, auto: true, slots: true, away: [s.away[0], Math.max(s.away[0], s.away[1] - 1)], fall: [s.fall[0], Math.max(s.fall[0], s.fall[1] - 1)] }), // (smaller numbers too: level 1 has auto and slots already)
  saturn: (s) => (s.sort === 'both' ? { ...s, sort: 'kind' } : { ...s, named: true, sizes: 'same', pieces: s.named ? Math.max(2, s.pieces - 2) : s.pieces }), // (named already: fewer pieces)
  venus: (s) => ({ ...s, reveal: 'full', turned: false }),
  lookout: (s) => ({ ...s, bubble: 'both', mode: 'go' }),
  delivery: (s) => ({ ...s, choices: Math.max(2, s.choices - 1), mode: 'pictureSound', similar: false, rounds: Math.min(3, s.rounds) }), // (level 1 has no fewer choices to give: a shorter run)
  picnic: (s) => ({ ...s, close: false, numerals: false }),
  garage: easierGarage,
  pluto: (s) => ({ ...s, shapes: s.shapes.slice(0, Math.max(2, s.shapes.length - 1)), ask: 'match', choices: Math.max(2, s.choices - 1), similar: false, turned: false }), // (the newest shape stays out)
  lighthouse: (s) => ({ ...s, choices: Math.max(2, (s.choices ?? 2) - 1), numbers: [s.numbers[0], Math.max(s.numbers[0], s.numbers[1] - 1)] }),
  shallows: (s) => ({ ...s, mode: 'watch', things: 'familiar', tell: s.mode === 'watch' }), // (already watching: it also says what it saw first)
  reef: (s) => ({ ...s, mode: 'see', choices: Math.max(2, s.choices - 1) }),
  port: (s) => ({ ...s, mode: 'together', syllables: [1, 2], rounds: Math.min(3, s.rounds) }),
};
