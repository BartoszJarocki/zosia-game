// Saved-progress schema and upgrades. Pure: no localStorage here, so every path is testable.
// Rule: never lose progress. Old fields are kept as they are; new ones get defaults.
//
//   v1  { v, missions: { kind: { level, good, lastAcc } }, items: { 'L:B': { n, ok } } }
//   v2  + skills: { [skill]: { [item]: SkillStat } }  (seeded from the v1 item stats)

import { emptyStat } from '../learning/mastery.js';

export const VERSION = 2;

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
    s = { v: 1, missions: {}, items: {} };
    for (const [kind, n] of Object.entries(badges || {})) {
      if (n > 0) s.missions[kind] = { level: Math.min(maxLevel(kind), 1 + Math.floor(n / 2)), good: 0, lastAcc: 1 };
    }
  }
  if (s.v === 1) {
    s.skills = seedSkills(s.items);
    s.v = 2;
  }
  // defaults for anything missing (also protects against hand-edited or partial saves)
  if (!s.missions || typeof s.missions !== 'object') s.missions = {};
  if (!s.items || typeof s.items !== 'object') s.items = {};
  if (!s.skills || typeof s.skills !== 'object') s.skills = {};
  return { state: s, changed: JSON.stringify(s) !== before };
}
