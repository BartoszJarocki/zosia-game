// Saved-progress schema and upgrades. Pure: no localStorage here, so every path is testable.
// Rule: never lose progress. Old fields are kept as they are; new ones get defaults.
//
//   v1  { v, missions: { kind: { level, good, lastAcc } }, items: { 'L:B': { n, ok } } }
//   v2  + skills: { [skill]: { [item]: SkillStat } }  (seeded from the v1 item stats; items is no longer written)
//   v3  + sessions: { count, recent: [{ id, startedAt, endedAt, missions: [kind], finale }] }
//   v4  + world: WorldState (adventure/world.js), seeded from badges so past play shows on the island
//   v5  mastery on the scale that takes guessing out (learning/mastery.js); old values rescaled; the island keepsakes added in v5 seeded from badges

import { emptyStat, rateAfter } from '../learning/mastery.js';
import { emptyWorld, normalizeWorld, applyReward, rewardsFromBadges } from '../adventure/world.js';

export const VERSION = 5;

/** Which skill the old item prefixes measured. */
const LEGACY_PREFIX = { 'L:': 'letterVisual', 'N:': 'numeral', 'Q:': 'counting', 'H:': 'quantity' };

/** Turn v1 per-item stats into starting mastery (confidence grows with how often she saw it). */
export function seedSkills(items = {}) {
  const skills = {};
  for (const [id, it] of Object.entries(items)) {
    const prefix = id.slice(0, 2), skill = LEGACY_PREFIX[prefix];
    if (!skill || !it || !it.n) continue;
    const item = id.slice(2);
    const s = emptyStat();
    s.attempts = it.n;
    s.correctFirstTry = Math.min(it.ok || 0, it.n);
    s.mastery = Math.round((s.correctFirstTry / it.n) * Math.min(1, it.n / 6) * 1000) / 1000;
    (skills[skill] ||= {})[item] = s;
  }
  return skills;
}

// Mastery until v4: a moving average from 0 at rate 0.2 of 1 / 0.7 / 0.45 / 0.2 per answer, where a random
// tapper on 3 options settled at 0.72 (tools/learning/guesser.mjs before the change).
const OLD_RATE = 0.2, OLD_GUESS_FLOOR = 0.72;

/** An old mastery value on the new scale: what her answers showed beyond guessing, with the new slow start. */
export function rescaleMastery(old, attempts) {
  if (!old || !attempts) return 0;
  const mean = Math.min(1, old / (1 - Math.pow(1 - OLD_RATE, attempts))); // the old average without its slow start
  const known = Math.max(0, (mean - OLD_GUESS_FLOOR) / (1 - OLD_GUESS_FLOOR));
  let prior = 1; // the share the new rule still gives to the start (PRIOR) after this many answers
  for (let a = 0; a < attempts; a++) prior *= 1 - rateAfter(a);
  return Math.round(known * (1 - prior) * 1000) / 1000;
}

/**
 * Bring any saved state (or nothing) up to the current version.
 * @param {any} raw            parsed JSON from storage (may be null, old or broken)
 * @param {{ badges?: Record<string, number>, maxLevel?: (kind: string) => number }} ctx
 * @returns {{ state: object, changed: boolean }}
 */
export function migrate(raw, { badges = {}, maxLevel = () => 3 } = {}) {
  let s = raw && typeof raw === 'object' && !Array.isArray(raw) ? structuredClone(raw) : null;
  const before = JSON.stringify(s);
  if (!s || !Number.isInteger(s.v) || s.v < 1) {
    // nothing usable (first run, or progress from before levels existed): rebuild levels from badges
    s = { v: 1, missions: {} };
    for (const [kind, n] of Object.entries(badges || {})) {
      if (n > 0) s.missions[kind] = { level: Math.min(maxLevel(kind), 1 + Math.floor(n / 2)), good: 0, lastAcc: 1 };
    }
  }
  if (s.v === 1) {
    s.skills = seedSkills(s.items);
    s.v = 2;
  }
  if (s.v === 2) {
    s.sessions = { count: 0, recent: [] }; // play sessions start being counted from here
    s.v = 3;
  }
  if (s.v === 3) {
    const w = emptyWorld();
    for (const id of rewardsFromBadges(badges)) applyReward(w, id); // already there, not "new" (no reveal)
    s.world = w;
    s.v = 4;
  }
  if (s.v === 4) {
    for (const items of Object.values(s.skills || {})) {
      for (const st of Object.values(items || {})) if (st && typeof st === 'object') st.mastery = rescaleMastery(st.mastery, st.attempts);
    }
    // the island's new keepsakes (Treat House, Cone Road, Lookout…) unlock at early completions she is already past,
    // so they come from her badges now, like v4's did; already there, not "new" (no reveal)
    s.world = normalizeWorld(s.world);
    for (const id of rewardsFromBadges(badges)) applyReward(s.world, id);
    s.v = 5;
  }
  // defaults for anything missing (also protects against hand-edited or partial saves)
  if (!s.missions || typeof s.missions !== 'object') s.missions = {};
  if (!s.skills || typeof s.skills !== 'object') s.skills = {};
  if (!s.sessions || typeof s.sessions !== 'object') s.sessions = { count: 0, recent: [] };
  if (!Array.isArray(s.sessions.recent)) s.sessions.recent = [];
  if (!Number.isInteger(s.sessions.count)) s.sessions.count = s.sessions.recent.length;
  if (JSON.stringify(normalizeWorld(s.world)) !== JSON.stringify(s.world)) s.world = normalizeWorld(s.world);
  return { state: s, changed: JSON.stringify(s) !== before };
}
