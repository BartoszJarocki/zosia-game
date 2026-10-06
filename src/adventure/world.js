// Adventure Bay remembers what she did: rescued kittens live near the park, a bridge appears at the
// river, a train starts touring the island, balloons gather at the Lookout, the Lookout lights up.
// Pure (no storage, no three.js), so it is testable. src/adventure/rewards.js applies and saves it;
// src/scenes/hub-world.js draws it.

export const MAX_KITTENS = 6;
export const MAX_BALLOONS = 5;

/**
 * @typedef {object} WorldState
 * @property {number} rescuedKittens
 * @property {boolean} bridgeBuilt
 * @property {boolean} trainUnlocked
 * @property {number} balloonsAtLookout
 * @property {boolean} lookoutLights
 * @property {string[]} completedEvents  hub events she has done (Phase 8)
 * @property {string[]} rewards          reward ids already applied (duplicate prevention)
 * @property {string[]} unseen           rewards the hub hasn't shown her yet
 */
export function emptyWorld() {
  return { rescuedKittens: 0, bridgeBuilt: false, trainUnlocked: false, balloonsAtLookout: 0, lookoutLights: false, completedEvents: [], rewards: [], unseen: [] };
}

/** Fill in anything missing or broken (hand-edited or partial saves). Returns a clean copy. */
export function normalizeWorld(w) {
  const base = emptyWorld();
  if (!w || typeof w !== 'object') return base;
  const int = (v, max) => (Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0);
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  return {
    rescuedKittens: int(w.rescuedKittens, MAX_KITTENS),
    bridgeBuilt: w.bridgeBuilt === true,
    trainUnlocked: w.trainUnlocked === true,
    balloonsAtLookout: int(w.balloonsAtLookout, MAX_BALLOONS),
    lookoutLights: w.lookoutLights === true,
    completedEvents: list(w.completedEvents),
    rewards: list(w.rewards),
    unseen: list(w.unseen),
  };
}

/** What each reward does. Ids: 'kitten-3' (the 3rd kitten), 'balloon-2', 'bridge', 'train', 'lookout-lights'. */
const EFFECTS = {
  kitten: (w) => { if (w.rescuedKittens >= MAX_KITTENS) return false; w.rescuedKittens++; return true; },
  balloon: (w) => { if (w.balloonsAtLookout >= MAX_BALLOONS) return false; w.balloonsAtLookout++; return true; },
  bridge: (w) => { if (w.bridgeBuilt) return false; w.bridgeBuilt = true; return true; },
  train: (w) => { if (w.trainUnlocked) return false; w.trainUnlocked = true; return true; },
  'lookout-lights': (w) => { if (w.lookoutLights) return false; w.lookoutLights = true; return true; },
};
export const rewardType = (id) => String(id).replace(/-\d+$/, '');

/**
 * Apply one reward (mutates world). Each id counts once, ever; unknown ids are ignored.
 * @returns {boolean} whether the world changed
 */
export function applyReward(world, id) {
  const effect = EFFECTS[rewardType(id)];
  if (!effect || world.rewards.includes(id)) return false;
  const changed = effect(world);
  if (changed) world.rewards.push(id);
  return changed;
}

/**
 * Which rewards finishing a mission earns. completions = how many times she has finished it (this one included).
 *   Kitty Park → one more rescued kitten each time (up to MAX_KITTENS)
 *   Balloon Hill → one more balloon at the Lookout each time (up to MAX_BALLOONS)
 *   The River (first time) → the bridge · Name Train (first time) → the island train
 *   the session finale (first time) → the Lookout's lights
 */
export function milestoneRewards(kind, { completions = 1, finale = false } = {}) {
  const ids = [];
  if (kind === 'letters' && completions <= MAX_KITTENS) ids.push(`kitten-${completions}`);
  if (kind === 'balloons' && completions <= MAX_BALLOONS) ids.push(`balloon-${completions}`);
  if (kind === 'stones') ids.push('bridge');
  if (kind === 'name') ids.push('train');
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
