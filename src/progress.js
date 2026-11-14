// Tracks how Zosia is doing.
//  - Mission levels (coarse): a mission levels up after CONFIG.goodRunsPerLevel "good" runs, two levels after a
//    perfect one (progress/levelup.js).
//  - A rough run turns on "assist" next time, without ever taking stars away.
//  - A mission she has never played starts at the level for her age (GAME.md "Starting levels").
//  - Skill mastery (precise): every learning event updates skills[skill][item] (see learning/mastery.js).
// The saved shape and its upgrades live in progress/migrations.js.
import { CONFIG } from './config.js';
import { badges } from './ui.js';
import { maxLevel, LEVELS, STARTS } from './levels/data.js';
import { startLevel } from './levels/parse.js';
import { meetsNeeds } from './levels/gate.js';
import { migrate, placeForAge } from './progress/migrations.js';
import { applyRun } from './progress/levelup.js';
import { applyEvent, emptyStat } from './learning/mastery.js';
import { emptyWorld } from './adventure/world.js';
import { learning } from './learning/events.js';
import { pickLearningItem } from './learning/scheduler.js';

const KEY = 'pup-patrol-progress';
const start = (kind, age) => startLevel(STARTS, kind, age);

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  return migrate(raw, { badges: badges.get(), maxLevel, age: CONFIG.childAge, start });
}
const loaded = load();
let state = loaded.state;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
/** For modules that own part of the save (adventure/rewards.js): write it now. */
export const saveProgress = save;
if (loaded.changed) save(); // keep the upgraded save

// every learning event updates mastery
learning.subscribe((ev) => { applyEvent(state.skills, ev); save(); });

/** Adventure Bay's state (adventure/world.js). Change it only through adventure/rewards.js. */
export const getWorld = () => state.world;

/** All skill stats: { [skill]: { [item]: SkillStat } } (read-only use please). */
export const getSkills = () => state.skills;
/** How often she has arrived at each place: every mission start (main.js), and the look-only stops on a map. */
export const getVisited = () => state.visited;
/** When solved counts and mission starts began for a save that had play before them (null: they count from its first day). */
export const getCountsFrom = () => state.countsFrom ?? null;

export function recordVisit(kind) {
  state.visited[kind] = (state.visited[kind] || 0) + 1;
  save();
}

/** Demos a place has shown her in full, by name ('port.together'). An optional list in the save: a save without it has seen none. */
export const demoSeen = (id) => Array.isArray(state.demos) && state.demos.includes(id);
export function markDemoSeen(id) {
  if (demoSeen(id)) return;
  state.demos = [...(Array.isArray(state.demos) ? state.demos : []), id];
  save();
}

// A mission is saved once she plays it or a grown-up sets its level; until then it follows her age.
const fresh = (kind) => ({ level: start(kind, state.age), good: 0, lastAcc: 1 });
const saved = (kind) => state.missions[kind] ?? fresh(kind);
const mission = (kind) => (state.missions[kind] ||= fresh(kind));

export function levelFor(kind) {
  return Math.min(maxLevel(kind), CONFIG.level || saved(kind).level);
}

/** Last run went badly: make this one a bit gentler. */
export function assistFor(kind) {
  return !CONFIG.level && saved(kind).lastAcc < 0.45;
}

/** Her age band ("Zosia ma lat" on the grown-ups' page). */
export const getAge = () => state.age;
/** Where a mission starts at her age (GAME.md "Starting levels"). */
export const startFor = (kind) => start(kind, state.age);
/** An older age moves missions below their new start up to it; a younger one takes no stars away. */
export function setAge(age) {
  placeForAge(state, age, start);
  save();
}

/** Call at the end of a mission with its { scored, clean } questions (progress/levelup.js). Returns { level, gained, acc }. */
export function recordMission(kind, tally) {
  const m = mission(kind);
  // a level may also need a skill to be known well enough (GAME.md "needs"), not just good runs
  const { gained, acc } = applyRun(m, tally, { goodRuns: CONFIG.goodRunsPerLevel, top: maxLevel(kind), opens: (level) => meetsNeeds(state.skills, kind, LEVELS[kind]?.[level - 1]) });
  save();
  return { level: levelFor(kind), gained, acc };
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

export function resetProgress() { state = migrate(null, { maxLevel, age: CONFIG.childAge, start }).state; save(); }

/** Developer tools (the grown-ups' page). Everything saves at once. */
export const dev = {
  /** Set a mission's level (clamped to 1…max); returns the new level. */
  setLevel(kind, level) {
    const m = mission(kind);
    m.level = Math.max(1, Math.min(maxLevel(kind), level | 0));
    m.good = 0;
    save();
    return m.level;
  },
  /** Pretend a skill item is known this well (0–1); enough answers that it isn't "little data". */
  setMastery(skill, item, value) {
    const s = ((state.skills[skill] ||= {})[String(item)] ||= emptyStat());
    s.mastery = Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
    s.attempts = Math.max(s.attempts, 3);
    s.lastSeenAt = Date.now();
    save();
  },
  clearSkills() { state.skills = {}; save(); },
  clearWorld() { state.world = emptyWorld(); save(); },
  /** Everything: levels, mastery, sessions, the island, and the badges. */
  resetAll() { resetProgress(); try { localStorage.removeItem('pup-patrol-badges'); } catch {} },
};
