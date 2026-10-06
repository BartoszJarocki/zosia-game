import test from 'node:test';
import assert from 'node:assert/strict';
import { MICRO_REWARDS, pickMicroReward, microDue } from '../../src/adventure/micro.js';
import { emptyWorld } from '../../src/adventure/world.js';

const all = MICRO_REWARDS.map((r) => r.type);

test('the six reward types from the roadmap', () => {
  assert.deepEqual([...all].sort(), ['BUBBLES', 'CHASE_DANCE', 'HONK', 'PET_KITTEN', 'SIREN', 'TRAIN_WHISTLE']);
});

test('kitten / train rewards only once they exist on the island', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(pickMicroReward({ world: emptyWorld() }));
  assert.equal(seen.has('PET_KITTEN'), false);
  assert.equal(seen.has('TRAIN_WHISTLE'), false);
  const w = { ...emptyWorld(), rescuedKittens: 1, trainUnlocked: true };
  for (let i = 0; i < 300; i++) seen.add(pickMicroReward({ world: w }));
  assert.equal(seen.has('PET_KITTEN') && seen.has('TRAIN_WHISTLE'), true);
});

test('not the same one as the last two times', () => {
  for (let i = 0; i < 100; i++) {
    const t = pickMicroReward({ world: emptyWorld(), recent: ['HONK', 'BUBBLES'] });
    assert.ok(t !== 'HONK' && t !== 'BUBBLES', t);
  }
});

test('if everything was just used, any is fine', () => {
  assert.ok(all.includes(pickMicroReward({ world: emptyWorld(), recent: ['HONK', 'SIREN', 'BUBBLES', 'CHASE_DANCE'] })));
});

test('due after each newly finished mission, not after the finale', () => {
  assert.equal(microDue({ completed: 1, rewardedUpTo: 0 }), true);
  assert.equal(microDue({ completed: 1, rewardedUpTo: 1 }), false, 'once per mission');
  assert.equal(microDue({ completed: 0, rewardedUpTo: 0 }), false, 'start of the session: the greeting');
  assert.equal(microDue({ completed: 3, rewardedUpTo: 2, finaleJustDone: true }), false);
});
