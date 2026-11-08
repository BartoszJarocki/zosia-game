export const REEF_WORDS = ['na', 'pod', 'w', 'obok'];
export const REEF_ANIMALS = ['crab', 'starfish', 'fish', 'octopus'];

/** Every place that makes sense: w is always in the shell, pod is always under the rock. */
export const REEF_PLACES = [
  { word: 'na', on: 'rock' },
  { word: 'na', on: 'shell' },
  { word: 'pod', on: 'rock' },
  { word: 'w', on: 'shell' },
  { word: 'obok', on: 'rock' },
  { word: 'obok', on: 'shell' },
];

const SPOT_AT = {
  'na:rock': { x: -3.8, y: 2.15, z: 0 },
  'na:shell': { x: 2.4, y: 1.0, z: 0.6 },
  'pod:rock': { x: -3.8, y: 0.2, z: 1.35 }, // just under the rock's overhanging front edge
  'w:shell': { x: 2.4, y: 0.95, z: 0.6 },
  'obok:rock': { x: -7.4, y: 0.2, z: 1.35 },
  'obok:shell': { x: 5.8, y: 0.2, z: 0.9 },
};

export const placeKey = (place) => `${place.word}:${place.on}`;
export const placeAt = (place) => SPOT_AT[placeKey(place)];
export const samePlace = (a, b) => a.word === b.word && a.on === b.on;

const distance = (a, b) => Math.hypot(placeAt(a).x - placeAt(b).x, placeAt(a).y - placeAt(b).y, placeAt(a).z - placeAt(b).z);

function shuffled(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Every word before any repeats, and never the same word twice in a row. */
export function reefWords(words, rounds, random = Math.random) {
  const pool = [...new Set(words)];
  if (!pool.length) return [];
  const out = [];
  while (out.length < rounds) {
    let cycle = shuffled(pool, random);
    if (out.length && pool.length > 1 && cycle[0] === out[out.length - 1]) cycle = [...cycle.slice(1), cycle[0]];
    out.push(...cycle);
  }
  return out.slice(0, rounds);
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

/** The right place and one scene per other word, in a shuffled row. */
export function reefChoices(target, words, count, random = Math.random) {
  const pool = shuffled(REEF_PLACES.filter((p) => words.includes(p.word) && p.word !== target.word), random);
  const picked = [];
  for (const place of pool) {
    if (picked.length >= count - 1) break;
    if (picked.some((p) => p.word === place.word)) continue;
    picked.push(place);
  }
  return shuffled([target, ...picked], random);
}

/** Three well-spaced spots, one per word, for the place round. */
export function reefSpots(target, words, count, random = Math.random) {
  const chosen = [target];
  const pool = shuffled(REEF_PLACES.filter((p) => words.includes(p.word) && !samePlace(p, target)), random);
  const MIN = 3.4;
  while (chosen.length < count) {
    let best = null, bestDistance = -1, fallback = null, fallbackDistance = -1;
    for (const place of pool) {
      if (chosen.some((p) => p.word === place.word)) continue;
      const gap = Math.min(...chosen.map((p) => distance(place, p)));
      if (gap > fallbackDistance) { fallback = place; fallbackDistance = gap; }
      if (gap > MIN && gap > bestDistance) { best = place; bestDistance = gap; }
    }
    const pick = best || fallback;
    if (!pick) break;
    chosen.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  return chosen;
}
