import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, seedSkills, rescaleMastery, placeForAge, VERSION } from '../../src/progress/migrations.js';

const v1 = {
  v: 1,
  missions: { letters: { level: 2, good: 1, lastAcc: 0.8 }, cones: { level: 3, good: 0, lastAcc: 0.4 } },
  items: { 'L:B': { n: 6, ok: 6 }, 'L:M': { n: 3, ok: 1 }, 'N:4': { n: 2, ok: 2 }, 'Q:3': { n: 1, ok: 1 }, 'H:2': { n: 4, ok: 2 }, 'X:?': { n: 9, ok: 9 } },
};

test('existing v1 save: levels and item stats kept, skills seeded, version bumped', () => {
  const { state, changed } = migrate(v1);
  assert.equal(state.v, VERSION);
  assert.equal(changed, true);
  assert.deepEqual(state.missions, v1.missions, 'mission levels untouched');
  assert.deepEqual(state.items, v1.items, 'old stats untouched');
  assert.equal(state.skills.letterVisual.B.mastery, 0.804, '6 of 6 right: what 6 clean answers give today');
  assert.equal(state.skills.letterVisual.M.mastery, 0, '1 of 3 right is what guessing among 3 gets');
  assert.equal(state.skills.numeral['4'].attempts, 2);
  assert.ok(state.skills.counting['3']);
  assert.ok(state.skills.quantity['2']);
  assert.equal(Object.keys(state.skills).includes('X'), false, 'unknown prefixes ignored');
});

test('the input object is never modified', () => {
  const copy = structuredClone(v1);
  migrate(v1);
  assert.deepEqual(v1, copy);
});

test('migrating twice changes nothing the second time', () => {
  const once = migrate(v1).state;
  const twice = migrate(once);
  assert.equal(twice.changed, false);
  assert.deepEqual(twice.state, once);
});

test('no save yet: levels rebuilt from badges, capped at the mission max', () => {
  const { state } = migrate(null, { badges: { letters: 3, balloons: 0, cones: 9 }, maxLevel: (k) => (k === 'cones' ? 3 : 4) });
  assert.equal(state.v, VERSION);
  assert.equal('items' in state, false, 'the old per-item stats are not written any more');
  assert.equal(state.missions.letters.level, 2);
  assert.equal(state.missions.cones.level, 3);
  assert.equal(state.missions.balloons, undefined);
  assert.deepEqual(state.skills, {});
});

test('broken or odd saves never crash and never lose what is there', () => {
  for (const bad of [undefined, 'oops', 42, [], { v: 'x' }, { v: 0 }]) {
    const { state } = migrate(bad);
    assert.equal(state.v, VERSION);
    assert.ok(state.missions && state.skills);
  }
  const partial = migrate({ v: 2, missions: { name: { level: 2, good: 0, lastAcc: 1 } } }).state;
  assert.equal(partial.missions.name.level, 2);
  assert.deepEqual(partial.skills, {});
});

test('a future version is not downgraded', () => {
  const { state } = migrate({ v: 99, missions: {}, items: {}, skills: {}, extra: true });
  assert.equal(state.v, 99);
  assert.equal(state.extra, true);
});

test('seedSkills skips empty stats', () => {
  assert.deepEqual(seedSkills({ 'L:A': { n: 0, ok: 0 } }), {});
});

test('v2 save (Phase 2–4): everything kept, sessions added, up to the current version', () => {
  const v2 = { v: 2, missions: { letters: { level: 2, good: 0, lastAcc: 1 } }, items: { 'L:B': { n: 1, ok: 1 } }, skills: { letterVisual: { B: { attempts: 1, mastery: 0.2 } } } };
  const { state, changed } = migrate(v2);
  assert.equal(changed, true);
  assert.equal(state.v, VERSION);
  assert.deepEqual(state.missions, v2.missions);
  assert.deepEqual(state.skills, { letterVisual: { B: { attempts: 1, mastery: 0.4 } } }, 'one right answer then is one right answer now');
  assert.deepEqual(state.sessions, { count: 0, recent: [] });
});

test('broken sessions field is repaired, sessions kept when valid', () => {
  assert.deepEqual(migrate({ v: 3, sessions: 'x' }).state.sessions, { count: 0, recent: [] });
  const rec = [{ id: 1, startedAt: 1, endedAt: 2, missions: ['letters'], finale: false }];
  assert.deepEqual(migrate({ v: 3, sessions: { recent: rec } }).state.sessions, { count: 1, recent: rec });
  const ok = { ...migrate({ v: 3 }).state, sessions: { count: 7, recent: rec } };
  assert.equal(migrate(ok).changed, false);
});

test('v4 → v5: mastery moves to the scale that takes guessing out, counts kept', () => {
  const stat = (mastery, attempts) => ({ attempts, correctFirstTry: attempts, assisted: 0, wrong: 2, mastery, confusions: { P: 1 } });
  const v4 = { v: 4, missions: {}, skills: { letterAudio: { B: stat(0.98, 10), M: stat(0.85, 40), A: stat(0.72, 40) }, numeral: { 3: stat(0.2, 1) } }, sessions: { count: 0, recent: [] } };
  const { state } = migrate(v4);
  assert.equal(state.v, VERSION);
  assert.deepEqual([state.skills.letterAudio.B.mastery, state.skills.letterAudio.M.mastery, state.skills.letterAudio.A.mastery, state.skills.numeral[3].mastery], [0.898, 0.464, 0, 0.4]);
  assert.deepEqual({ ...state.skills.letterAudio.B, mastery: 0.98 }, v4.skills.letterAudio.B, 'only mastery changes');
});

test('v4 → v5: what she already played shows on the island at once (the new keepsakes come from her badges)', () => {
  const world = { rescuedKittens: 6, bridgeBuilt: true, trainUnlocked: false, balloonsAtLookout: 0, lookoutLights: true, completedEvents: ['lost-kitten'], rewards: ['kitten-1', 'kitten-2', 'kitten-3', 'kitten-4', 'kitten-5', 'kitten-6', 'bridge'], unseen: [] };
  const v4 = { v: 4, missions: {}, skills: {}, sessions: { count: 3, recent: [] }, world };
  const { state } = migrate(v4, { badges: { letters: 14, stones: 2, counting: 12, cones: 1, lookout: 10 } });
  const w = state.world;
  assert.deepEqual([w.rescuedKittens, w.bridgeBuilt, w.lookoutLights, w.completedEvents], [6, true, true, ['lost-kitten']], 'what was there stays');
  assert.equal(w.trafficLight, true, 'one Cone Road run: the traffic light');
  assert.ok(w.treatsAtHouse > 0 && w.lookoutKittens > 0, 'Treat House and Lookout keepsakes from her badges');
  assert.equal(w.parcels, 0, 'no Delivery badges: no parcels');
  assert.deepEqual(w.unseen, [], 'already there, not announced');
  assert.deepEqual(migrate(state, { badges: { counting: 12 } }).changed, false, 'and it happens once');
});

test('rescaleMastery: nothing seen stays nothing', () => {
  assert.equal(rescaleMastery(0, 0), 0);
  assert.equal(rescaleMastery(0.5, 0), 0);
});

test('v5 save keeps every old field and adds empty visits in v6', () => {
  const v5 = { ...migrate(v1).state, v: 5, extra: { keep: ['this'] } };
  delete v5.visited;
  delete v5.age;
  delete v5.countsFrom;
  const before = structuredClone(v5);
  const { state, changed } = migrate(v5, { now: 5000 });
  assert.equal(state.v, VERSION);
  assert.equal(changed, true);
  assert.deepEqual(state, { ...before, v: VERSION, visited: {}, age: null, countsFrom: 5000 });
  assert.deepEqual(v5, before);
});

test('v7 → v8: a save with play says when its solved counts began; nothing else moves, and nothing is rebuilt', () => {
  const v7 = { ...migrate(v1, { age: 4, start }).state, v: 7, visited: { moon: 3 } };
  delete v7.countsFrom;
  const { state, changed } = migrate(v7, { age: 4, start, now: 1234 });
  assert.equal(changed, true);
  assert.equal(state.countsFrom, 1234);
  assert.deepEqual({ ...state, countsFrom: undefined, v: 7 }, { ...v7, countsFrom: undefined });
  assert.deepEqual([state.skills.letterVisual.B.attempts, state.skills.letterVisual.B.solved || 0], [6, 0], 'old solves are not made up');
  assert.equal(migrate(state, { age: 4, start, now: 9999 }).changed, false, 'and it happens once');
});

test('a first save counts from its first day; one rebuilt from badges had play before', () => {
  assert.equal(migrate(null, { now: 1 }).state.countsFrom, undefined);
  assert.equal(migrate(null, { badges: { letters: 0 }, now: 1 }).state.countsFrom, undefined);
  assert.equal(migrate(null, { badges: { letters: 2 }, now: 1 }).state.countsFrom, 1);
});

// where each mission starts for her age (GAME.md "Starting levels" looks like this)
const START = { 3: { letters: 2, cones: 3 }, 3.5: { letters: 4, cones: 4 }, 4: { letters: 6, cones: 6 } };
const start = (kind, age) => START[age]?.[kind] ?? 1;

test('v6 → v7: her age comes in, and each mission below its start for that age moves up to it', () => {
  const v6 = { ...migrate(v1).state, v: 6, visited: { moon: 3 }, missions: {
    letters: { level: 1, good: 1, lastAcc: 0.3 },
    cones: { level: 7, good: 1, lastAcc: 0.9 },
  } };
  delete v6.age;
  const { state, changed } = migrate(v6, { age: 3.5, start });
  assert.equal(changed, true);
  assert.equal(state.v, VERSION);
  assert.equal(state.age, 3.5);
  assert.deepEqual(state.missions.letters, { level: 4, good: 0, lastAcc: 0.3 }, 'moved up to the start; her last rough run still makes the next one gentler');
  assert.deepEqual(state.missions.cones, v6.missions.cones, 'above the start: kept as it was');
  assert.deepEqual(state.visited, { moon: 3 });
  assert.equal(migrate(state, { age: 3.5, start }).changed, false, 'and it happens once');
});

test('no save yet: her age sets the start, a level rebuilt from badges counts when it is higher', () => {
  const { state } = migrate(null, { badges: { letters: 11, cones: 1 }, maxLevel: () => 10, age: 3.5, start });
  assert.equal(state.age, 3.5);
  assert.equal(state.missions.letters.level, 6, '11 badges: level 6, above the start');
  assert.equal(state.missions.cones.level, 4, 'one badge: level 1, so the start');
});

test('a save already on v7 keeps its levels as written, even below the start (a play-check seed)', () => {
  const seed = { v: VERSION, missions: { letters: { level: 1, good: 0, lastAcc: 1 } }, skills: {}, sessions: { count: 0, recent: [] } };
  const { state } = migrate(seed, { age: 3.5, start });
  assert.equal(state.missions.letters.level, 1);
  assert.equal(state.age, 3.5, 'the age it was missing is filled in, nothing moves');
});

test('placeForAge: an older age moves missions below the new start up; the same or a younger age moves nothing', () => {
  const s = { age: 3.5, missions: { letters: { level: 1, good: 1, lastAcc: 1 }, cones: { level: 8, good: 1, lastAcc: 1 } } };
  placeForAge(s, 3.5, start);
  assert.equal(s.missions.letters.level, 1, 'a level a grown-up lowered stays lowered when the same age is chosen again');
  placeForAge(s, 3, start);
  assert.deepEqual([s.age, s.missions.letters.level, s.missions.cones.level], [3, 1, 8], 'a younger age takes no stars away');
  placeForAge(s, 4, start);
  assert.deepEqual(s.missions.letters, { level: 6, good: 0, lastAcc: 1 });
  assert.deepEqual(s.missions.cones, { level: 8, good: 1, lastAcc: 1 });
  assert.equal(s.age, 4);
});

test('v7 save is unchanged, including visit counts and her age', () => {
  const v7 = { ...migrate(v1, { age: 4, start }).state, visited: { moon: 3, mars: 1 }, extra: ['kept'] };
  const { state, changed } = migrate(v7, { age: 3.5, start });
  assert.equal(state.v, VERSION);
  assert.equal(changed, false);
  assert.deepEqual(state, v7);
});
