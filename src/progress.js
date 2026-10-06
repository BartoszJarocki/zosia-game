// Tracks how Zosia is doing.
//  - Mission levels (coarse): a mission levels up after CONFIG.goodRunsPerLevel "good" runs.
//  - A rough run turns on "assist" next time, without ever taking stars away.
//  - Skill mastery (precise): every learning event updates skills[skill][item] (see learning/mastery.js).
// The saved shape and its upgrades live in progress/migrations.js.
import { CONFIG } from './config.js';
import { badges } from './ui.js';
import { maxLevel } from './levels/data.js';
import { migrate } from './progress/migrations.js';
import { applyEvent } from './learning/mastery.js';
import { learning } from './learning/events.js';
import { pickLearningItem } from './learning/scheduler.js';

const KEY = 'pup-patrol-progress';

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  return migrate(raw, { badges: badges.get(), maxLevel });
}
const loaded = load();
let state = loaded.state;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
if (loaded.changed) save(); // keep the upgraded save

// every learning event updates mastery
learning.subscribe((ev) => { applyEvent(state.skills, ev); save(); });

/** All skill stats: { [skill]: { [item]: SkillStat } } (read-only use please). */
export const getSkills = () => state.skills;
const mission = (kind) => (state.missions[kind] ||= { level: 1, good: 0, lastAcc: 1 });

export function levelFor(kind) {
  return Math.min(maxLevel(kind), CONFIG.level || mission(kind).level);
}

/** Last run went badly: make this one a bit gentler. */
export function assistFor(kind) {
  return !CONFIG.level && mission(kind).lastAcc < 0.45;
}

/** Call at the end of a mission. Returns { level, levelUp }. */
export function recordMission(kind, firstTry, rounds) {
  const m = mission(kind);
  const acc = rounds ? firstTry / rounds : 1;
  m.lastAcc = acc;
  let levelUp = false;
  if (acc >= 0.65) { // two thirds right first time (2 of 3, 3 of 4, 4 of 5…)
    m.good++;
    if (m.good >= CONFIG.goodRunsPerLevel && m.level < maxLevel(kind)) { m.level++; m.good = 0; levelUp = true; }
  }
  save();
  return { level: levelFor(kind), levelUp, acc };
}

/** Remember whether a letter/number was got right first time. */
export function recordItem(id, firstTry) {
  const it = (state.items[id] ||= { n: 0, ok: 0 });
  it.n++;
  if (firstTry) it.ok++;
  save();
}

// recently asked items per skill (this session), so the scheduler can avoid repeats across missions too
const recentBySkill = {};

/**
 * Pick the next item to ask for a skill, from mastery (see learning/scheduler.js).
 * mix: optional bucket weights, e.g. { familiar: 1 } for an easy last question.
 */
export function pickItem(skill, candidates, { mix } = {}) {
  const recent = (recentBySkill[skill] ||= []);
  const item = pickLearningItem({ candidates, stats: state.skills[skill] || {}, recent, mix });
  recent.push(item);
  if (recent.length > 8) recent.shift();
  return item;
}

/** Save (or update) a play session's summary. Only sessions with a finished mission get here. */
export function recordSession(sum) {
  const ss = state.sessions;
  const i = ss.recent.findIndex((x) => x.id === sum.id);
  if (i === -1) {
    ss.count++;
    ss.recent.push(sum);
    if (ss.recent.length > 30) ss.recent.splice(0, ss.recent.length - 30);
  } else ss.recent[i] = sum;
  save();
}
/** { count, recent: [{ id, startedAt, endedAt, missions, finale }] } (read-only use please). */
export const getSessions = () => state.sessions;

export function resetProgress() { state = migrate(null).state; save(); }
