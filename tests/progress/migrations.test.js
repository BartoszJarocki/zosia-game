import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, seedSkills, rescaleMastery, VERSION } from '../../src/progress/migrations.js';

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
  assert.equal(state.v, 5);
  assert.deepEqual([state.skills.letterAudio.B.mastery, state.skills.letterAudio.M.mastery, state.skills.letterAudio.A.mastery, state.skills.numeral[3].mastery], [0.898, 0.464, 0, 0.4]);
  assert.deepEqual({ ...state.skills.letterAudio.B, mastery: 0.98 }, v4.skills.letterAudio.B, 'only mastery changes');
});

test('rescaleMastery: nothing seen stays nothing', () => {
  assert.equal(rescaleMastery(0, 0), 0);
  assert.equal(rescaleMastery(0.5, 0), 0);
});
