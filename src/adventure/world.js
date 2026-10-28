// Adventure Bay remembers what she did: every mission leaves something on the island (rescued kittens near the
// park, a bridge at the river, treats in Chase's bowl, parcels at the houses, guests at the picnic…).
// Pure (no storage, no three.js), so it is testable. src/adventure/rewards.js applies and saves it;
// src/scenes/hub-world.js draws it.

/**
 * Every kind of reward and the world field it grows: a count up to max, or a flag (max 1, saved as true/false).
 * Ids are the type, plus "-n" for counted ones ('kitten-3' = the 3rd kitten); each id counts once, ever.
 */
export const REWARDS = Object.freeze({
  kitten: { field: 'rescuedKittens', max: 6 },        // Kitty Park: kittens potter about on the lawn
  balloon: { field: 'balloonsAtLookout', max: 5 },    // Balloon Hill: balloons tied to the Lookout
  bridge: { field: 'bridgeBuilt', flag: true },       // the River (first time)
  train: { field: 'trainUnlocked', flag: true },      // Name Train (first time): a train round the island
  'lookout-lights': { field: 'lookoutLights', flag: true }, // the first session finale
  treat: { field: 'treatsAtHouse', max: 5 },          // Treat House: Chase's bowl fills up
  'traffic-light': { field: 'trafficLight', flag: true }, // Cone Road (first time)
  cone: { field: 'roadCones', max: 4 },               // Cone Road (after that): cones along the road
  parcel: { field: 'parcels', max: 4 },               // Pup Delivery: a parcel at each house
  guest: { field: 'picnicGuests', max: 4 },           // Pup Picnic: guests on the blanket
  'lookout-kitten': { field: 'lookoutKittens', max: 4 }, // the Lookout: kittens waving from its balconies
  'garage-car': { field: 'garageCar', flag: true },   // the Garage (first time): a shiny repaired car
  bunting: { field: 'bunting', flag: true },          // the Garage (after that): bunting
});
export const MAX_KITTENS = REWARDS.kitten.max;
export const MAX_BALLOONS = REWARDS.balloon.max;

/** What the c-th finished run of each mission earns (ids over a type's max earn nothing). */
const MILESTONES = {
  letters: (c) => `kitten-${c}`,
  balloons: (c) => `balloon-${c}`,
  stones: () => 'bridge',
  name: () => 'train',
  counting: (c) => `treat-${c}`,
  cones: (c) => (c === 1 ? 'traffic-light' : `cone-${c - 1}`),
  delivery: (c) => `parcel-${c}`,
  picnic: (c) => `guest-${c}`,
  lookout: (c) => `lookout-kitten-${c}`,
  garage: (c) => (c === 1 ? 'garage-car' : 'bunting'),
};

/**
 * @typedef {object} WorldState
 * @property {number|boolean} [field]   one per REWARDS row (rescuedKittens, bridgeBuilt, treatsAtHouse…)
 * @property {string[]} completedEvents  hub events she has done (Phase 8)
 * @property {string[]} rewards          reward ids already applied (duplicate prevention)
 * @property {string[]} unseen           rewards the hub hasn't shown her yet
 */
export function emptyWorld() {
  const w = {};
  for (const r of Object.values(REWARDS)) w[r.field] = r.flag ? false : 0;
  return { ...w, completedEvents: [], rewards: [], unseen: [] };
}

/** Fill in anything missing or broken (old, hand-edited or partial saves). Returns a clean copy. */
export function normalizeWorld(w) {
  const base = emptyWorld();
  if (!w || typeof w !== 'object') return base;
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  for (const r of Object.values(REWARDS)) {
    const v = w[r.field];
    base[r.field] = r.flag ? v === true : Number.isInteger(v) && v >= 0 ? Math.min(v, r.max) : 0;
  }
  return { ...base, completedEvents: list(w.completedEvents), rewards: list(w.rewards), unseen: list(w.unseen) };
}

export const rewardType = (id) => String(id).replace(/-\d+$/, '');

/**
 * Apply one reward (mutates world). Each id counts once, ever; unknown ids are ignored.
 * @returns {boolean} whether the world changed
 */
export function applyReward(world, id) {
  const r = REWARDS[rewardType(id)];
  if (!r || world.rewards.includes(id)) return false;
  if (r.flag ? world[r.field] : world[r.field] >= r.max) return false;
  world[r.field] = r.flag ? true : world[r.field] + 1;
  world.rewards.push(id);
  return true;
}

/**
 * Which rewards finishing a mission earns. completions = how many times she has finished it (this one included).
 * The session finale (first time) also lights up the Lookout.
 */
export function milestoneRewards(kind, { completions = 1, finale = false } = {}) {
  const ids = [];
  const id = MILESTONES[kind]?.(completions);
  if (id) {
    const r = REWARDS[rewardType(id)];
    const n = Number(id.match(/-(\d+)$/)?.[1] || 1);
    if (r.flag || n <= r.max) ids.push(id);
  }
  if (finale) ids.push('lookout-lights');
  return ids;
}

/** Rewards for everything already played (from badge counts), so an existing player isn't starting from zero. */
export function rewardsFromBadges(badges = {}) {
  const ids = [];
  for (const [kind, n] of Object.entries(badges || {})) {
    for (let c = 1; c <= Math.min(n | 0, 20); c++) ids.push(...milestoneRewards(kind, { completions: c }));
  }
  return [...new Set(ids)];
}
