import { PLACES } from '../places.js';

export const SPACE_PLACES = Object.keys(PLACES).filter((kind) => PLACES[kind].area === 'space' && PLACES[kind].stop !== false && kind !== 'stars');
export const PLANETS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
export const FEATURES = ['saturn', 'mars', 'earth', 'jupiter', 'comet', 'pluto', 'sun'];
const EXCLUDE = { saturn: ['uranus'], mars: ['jupiter', 'sun'], sun: ['comet', 'blackhole'] };
const SMALL = ['mercury', 'mars', 'moon', 'pluto'];

export function distractors(level, target) {
  return level.pool.filter((kind) => kind !== target && (level.ask !== 'feature'
    || (target === 'jupiter' ? SMALL.includes(kind) : !EXCLUDE[target]?.includes(kind))));
}

export function itemsFor(level) {
  return level.ask === 'order'
    ? PLANETS.slice(0, -1).filter((kind, i) => level.pool.includes(kind) && level.pool.includes(PLANETS[i + 1])).map((kind) => `space:${kind}`)
    : level.pool;
}

export function questionFor(level, item, rng = Math.random) {
  const after = level.ask === 'order' ? item.slice('space:'.length) : null;
  const target = after ? PLANETS[PLANETS.indexOf(after) + 1] : item;
  const shuffled = (items) => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const options = shuffled([target, ...shuffled(distractors(level, target)).slice(0, level.choices - 1)]);
  return { skill: after ? 'sequence' : 'space', item, target, after, options };
}
