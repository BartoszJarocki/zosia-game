import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorld, normalizeWorld, applyReward, milestoneRewards, rewardsFromBadges, rewardType, MAX_KITTENS, MAX_BALLOONS } from '../../src/adventure/world.js';
import { migrate, VERSION } from '../../src/progress/migrations.js';

test('each reward counts once, ever', () => {
  const w = emptyWorld();
  assert.equal(applyReward(w, 'kitten-1'), true);
  assert.equal(applyReward(w, 'kitten-1'), false);
  assert.equal(w.rescuedKittens, 1);
  assert.equal(applyReward(w, 'bridge'), true);
  assert.equal(applyReward(w, 'bridge'), false);
  assert.equal(w.bridgeBuilt, true);
  assert.deepEqual(w.rewards, ['kitten-1', 'bridge']);
});

test('caps: no more kittens or balloons than there is room for', () => {
  const w = emptyWorld();
  for (let i = 1; i <= MAX_KITTENS + 3; i++) applyReward(w, `kitten-${i}`);
  for (let i = 1; i <= MAX_BALLOONS + 3; i++) applyReward(w, `balloon-${i}`);
  assert.equal(w.rescuedKittens, MAX_KITTENS);
  assert.equal(w.balloonsAtLookout, MAX_BALLOONS);
  assert.equal(w.rewards.length, MAX_KITTENS + MAX_BALLOONS, 'ids over the cap are not recorded either');
});

test('unknown reward ids are ignored', () => {
  const w = emptyWorld();
  assert.equal(applyReward(w, 'dragon-1'), false);
  assert.deepEqual(w, emptyWorld());
  assert.equal(rewardType('kitten-12'), 'kitten');
  assert.equal(rewardType('lookout-lights'), 'lookout-lights');
});

test('milestones per mission', () => {
  assert.deepEqual(milestoneRewards('letters', { completions: 2 }), ['kitten-2']);
  assert.deepEqual(milestoneRewards('letters', { completions: MAX_KITTENS + 1 }), []);
  assert.deepEqual(milestoneRewards('balloons', { completions: 1 }), ['balloon-1']);
  assert.deepEqual(milestoneRewards('stones', { completions: 5 }), ['bridge']);
  assert.deepEqual(milestoneRewards('name'), ['train']);
  assert.deepEqual(milestoneRewards('lookout', { completions: 1 }), ['lookout-kitten-1']);
  assert.deepEqual(milestoneRewards('lookout', { completions: 2, finale: true }), ['lookout-kitten-2', 'lookout-lights']);
  assert.deepEqual(milestoneRewards('lookout', { completions: 5 }), []);
  assert.deepEqual(milestoneRewards('cones', { completions: 1 }), ['traffic-light']);
  assert.deepEqual(milestoneRewards('cones', { completions: 3 }), ['cone-2']);
  assert.deepEqual(milestoneRewards('counting', { completions: 4 }), ['treat-4']);
  assert.deepEqual(milestoneRewards('delivery', { completions: 2 }), ['parcel-2']);
  assert.deepEqual(milestoneRewards('picnic', { completions: 1 }), ['guest-1']);
  assert.deepEqual(milestoneRewards('garage', { completions: 1 }), ['garage-car']);
  assert.deepEqual(milestoneRewards('garage', { completions: 2 }), ['bunting']);
  assert.deepEqual(milestoneRewards('dragon', { completions: 1 }), []);
});

test('every mission leaves something: a week of play changes the island for each of them', () => {
  const w = emptyWorld();
  const badges = { letters: 2, balloons: 1, name: 1, cones: 3, stones: 1, counting: 2, lookout: 3, delivery: 2, picnic: 1, garage: 2 };
  for (const id of rewardsFromBadges(badges)) applyReward(w, id);
  assert.deepEqual(
    { k: w.rescuedKittens, b: w.balloonsAtLookout, tr: w.trainUnlocked, br: w.bridgeBuilt, t: w.treatsAtHouse, l: w.trafficLight, c: w.roadCones, p: w.parcels, g: w.picnicGuests, lk: w.lookoutKittens, car: w.garageCar, bu: w.bunting },
    { k: 2, b: 1, tr: true, br: true, t: 2, l: true, c: 2, p: 2, g: 1, lk: 3, car: true, bu: true },
  );
});

test('rewards from badges: past play shows on the island', () => {
  const w = emptyWorld();
  for (const id of rewardsFromBadges({ letters: 3, stones: 2, balloons: 0, cones: 9 })) applyReward(w, id);
  assert.equal(w.rescuedKittens, 3);
  assert.equal(w.bridgeBuilt, true);
  assert.equal(w.trainUnlocked, false);
  assert.equal(w.balloonsAtLookout, 0);
});

test('normalizeWorld repairs broken saves', () => {
  assert.deepEqual(normalizeWorld(null), emptyWorld());
  const w = normalizeWorld({ rescuedKittens: 99, bridgeBuilt: 'yes', rewards: ['a', 3], unseen: 'x' });
  assert.equal(w.rescuedKittens, MAX_KITTENS);
  assert.equal(w.bridgeBuilt, false);
  assert.deepEqual(w.rewards, ['a']);
  assert.deepEqual(w.unseen, []);
});

test('migration v3 → v4: world seeded from badges, nothing marked as new, the rest kept', () => {
  const v3 = { v: 3, missions: { letters: { level: 2, good: 0, lastAcc: 1 } }, items: {}, skills: { numeral: {} }, sessions: { count: 2, recent: [] } };
  const { state, changed } = migrate(v3, { badges: { letters: 2, name: 1 } });
  assert.equal(changed, true);
  assert.equal(state.v, VERSION);
  assert.equal(state.world.rescuedKittens, 2);
  assert.equal(state.world.trainUnlocked, true);
  assert.deepEqual(state.world.unseen, []);
  assert.deepEqual(state.sessions, v3.sessions);
  assert.deepEqual(state.missions, v3.missions);
  assert.equal(migrate(state, { badges: { letters: 9 } }).changed, false, 'never re-seeded');
});

test('an old v4 save (before treats, parcels, guests…) loads: what she had stays, the new things start empty', () => {
  const old = { rescuedKittens: 3, bridgeBuilt: true, trainUnlocked: false, balloonsAtLookout: 2, lookoutLights: true, completedEvents: ['lost-kitten'], rewards: ['kitten-1', 'kitten-2', 'kitten-3', 'bridge', 'balloon-1', 'balloon-2', 'lookout-lights'], unseen: ['kitten-3'] };
  const v4 = { v: 4, missions: {}, items: {}, skills: {}, sessions: { count: 1, recent: [] }, world: old };
  const { state, changed } = migrate(v4);
  assert.equal(changed, true);
  const w = state.world;
  assert.deepEqual([w.rescuedKittens, w.bridgeBuilt, w.trainUnlocked, w.balloonsAtLookout, w.lookoutLights], [3, true, false, 2, true]);
  assert.deepEqual([w.treatsAtHouse, w.trafficLight, w.roadCones, w.parcels, w.picnicGuests, w.lookoutKittens, w.garageCar, w.bunting], [0, false, 0, 0, 0, 0, false, false]);
  assert.deepEqual(w.unseen, ['kitten-3']);
  assert.deepEqual(w.completedEvents, ['lost-kitten']);
  assert.equal(migrate(state).changed, false, 'stable after one upgrade');
  assert.equal(applyReward(w, 'treat-1'), true);
  assert.equal(w.treatsAtHouse, 1);
});

test('migration: a fresh player starts with an empty island', () => {
  assert.deepEqual(migrate(null).state.world, emptyWorld());
});
