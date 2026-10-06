// Micro-play rewards: a few seconds of pure play in the hub after a finished mission. No question, nothing to
// get wrong, no explanation needed: something on the island sparkles and does something fun when tapped.
// Pure (which one, and when), so it is testable; src/scenes/hub-micro.js makes them happen.

export const MICRO_REWARDS = Object.freeze([
  { type: 'HONK', available: () => true },              // tap the cruiser: horn + bounce
  { type: 'SIREN', available: () => true },             // tap the cruiser: siren + lights
  { type: 'BUBBLES', available: () => true },           // bubbles float up: pop them
  { type: 'CHASE_DANCE', available: () => true },       // tap Chase: he dances
  { type: 'PET_KITTEN', available: (w) => w.rescuedKittens > 0 }, // a rescued kitten comes over to be petted
  { type: 'TRAIN_WHISTLE', available: (w) => w.trainUnlocked },   // tap the island train: whistle + puff
]);

/** How long a micro reward invites play (it's optional: the hub works as usual meanwhile). */
export const MICRO_MS = 9000;

/**
 * Pick one she can have now (needs the kitten / train for those), not one of the last two.
 * @param {{ world: object, recent?: string[], rng?: () => number }} p
 */
export function pickMicroReward({ world, recent = [], rng = Math.random }) {
  const ok = MICRO_REWARDS.filter((r) => r.available(world || {})).map((r) => r.type);
  const fresh = ok.filter((t) => !recent.slice(-2).includes(t));
  const pool = fresh.length ? fresh : ok;
  return pool[Math.floor(rng() * pool.length)] ?? null;
}

/**
 * Should the hub play one now? After each newly finished mission, except right after the session's
 * finale (its own celebration and the thank-you are the reward).
 */
export function microDue({ completed = 0, rewardedUpTo = 0, finaleJustDone = false }) {
  return completed > rewardedUpTo && !finaleJustDone;
}
