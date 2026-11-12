export const REEF_WORDS = ['na', 'pod', 'w', 'obok'];
export const REEF_ANIMALS = ['crab', 'starfish', 'fish', 'octopus'];

/** Every place that makes sense: na only on the rock and w only in the shell, so the two never share a spot. */
export const REEF_PLACES = [
  { word: 'na', on: 'rock' },
  { word: 'pod', on: 'rock' },
  { word: 'w', on: 'shell' },
  { word: 'obok', on: 'rock' },
  { word: 'obok', on: 'shell' },
];

/** Where an animal sits in the one side-on scene: x across, y its underside, z towards her. */
const PLACE_AT = {
  'na:rock': { x: -3.3, y: 3.15, z: 0.3 },  // on top of the rock
  'pod:rock': { x: -3.3, y: 0.08, z: 0.35 }, // in the hollow under the rock's ledge
  'obok:rock': { x: -7.3, y: 0.08, z: 0.9 }, // on the sand beside it
  'w:shell': { x: 3.4, y: 0.95, z: 0.45 },   // inside the open shell, peeking out over its rim
  'obok:shell': { x: 7.3, y: 0.08, z: 0.9 },
};

export const placeKey = (place) => `${place.word}:${place.on}`;
export const placeAt = (place) => PLACE_AT[placeKey(place)];

function shuffled(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A word at random each round, never the same one three times in a row. */
export function reefWords(words, rounds, random = Math.random) {
  const pool = [...new Set(words)];
  const out = [];
  while (pool.length && out.length < rounds) {
    const thrice = out.length >= 2 && out.at(-1) === out.at(-2) ? out.at(-1) : null;
    const from = pool.length > 1 ? pool.filter((w) => w !== thrice) : pool;
    out.push(from[Math.floor(random() * from.length)]);
  }
  return out;
}

export function reefPlan({ words, rounds }, random = Math.random) {
  const order = reefWords(words, rounds, random);
  const offset = Math.floor(random() * REEF_ANIMALS.length);
  return order.map((word, i) => {
    const places = REEF_PLACES.filter((p) => p.word === word);
    const place = places[Math.floor(random() * places.length)];
    return { word, animal: REEF_ANIMALS[(offset + i) % REEF_ANIMALS.length], place };
  });
}

/**
 * The places one round's scene offers (where the animals sit, or the rings at the top level): the right place and one
 * place for each of the other words. A place on the same thing as the answer comes first, so the thing alone
 * ("kamień") does not tell which. Every place is far enough from every other to tap (tests/levels/reef.test.js).
 */
export function reefChoices(target, words, count, random = Math.random) {
  const others = shuffled(REEF_PLACES.filter((p) => words.includes(p.word) && p.word !== target.word), random);
  const picked = [];
  for (const place of [...others.filter((p) => p.on === target.on), ...others.filter((p) => p.on !== target.on)]) {
    if (picked.length >= count - 1) break;
    if (picked.some((p) => p.word === place.word)) continue;
    picked.push(place);
  }
  return shuffled([target, ...picked], random);
}
