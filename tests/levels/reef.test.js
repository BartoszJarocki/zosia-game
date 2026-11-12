import test from 'node:test';
import assert from 'node:assert/strict';
import { REEF_PLACES, reefWords, reefPlan, reefChoices, placeAt, placeKey } from '../../src/levels/reef.js';

const zero = () => 0;
const gap = (a, b) => Math.hypot(placeAt(a).x - placeAt(b).x, placeAt(a).y - placeAt(b).y, placeAt(a).z - placeAt(b).z);

test('the reef uses only places that make sense: na on the rock, w in the shell, never the same spot', () => {
  assert.deepEqual(REEF_PLACES.map(placeKey), ['na:rock', 'pod:rock', 'w:shell', 'obok:rock', 'obok:shell']);
  assert.ok(REEF_PLACES.filter((p) => p.word === 'w').every((p) => p.on === 'shell'));
  assert.ok(REEF_PLACES.filter((p) => p.word === 'pod').every((p) => p.on === 'rock'));
  assert.ok(REEF_PLACES.filter((p) => p.word === 'na').every((p) => p.on === 'rock'));
  for (let i = 0; i < REEF_PLACES.length; i++) for (let j = i + 1; j < REEF_PLACES.length; j++) {
    assert.ok(gap(REEF_PLACES[i], REEF_PLACES[j]) > 2.8, `${placeKey(REEF_PLACES[i])} / ${placeKey(REEF_PLACES[j])}`);
  }
  assert.ok(placeAt({ word: 'pod', on: 'rock' }).y < placeAt({ word: 'na', on: 'rock' }).y - 2.5, 'under is well below on');
});

test('words come at random, never the same one three times in a row', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const plan = reefWords(['na', 'pod'], 4);
    assert.equal(plan.length, 4);
    for (let at = 2; at < plan.length; at++) assert.ok(!(plan[at] === plan[at - 1] && plan[at] === plan[at - 2]), plan.join(','));
    seen.add(plan.join(','));
  }
  assert.ok(seen.size >= 6, `two words, four rounds: ${seen.size} different orders, not just na, pod, na, pod`);
  assert.deepEqual(reefWords(['na', 'pod'], 4, zero), ['na', 'na', 'pod', 'na']);
  assert.deepEqual(reefWords(['w'], 3, zero), ['w', 'w', 'w']);
});

test('the plan gives every round an animal and a real place', () => {
  const plans = reefPlan({ words: ['na', 'pod', 'w', 'obok'], rounds: 4 }, zero);
  assert.equal(plans.length, 4);
  assert.deepEqual(plans.map((p) => p.animal), ['crab', 'starfish', 'fish', 'octopus']);
  for (const plan of plans) {
    assert.equal(plan.place.word, plan.word);
    assert.ok(REEF_PLACES.some((p) => placeKey(p) === placeKey(plan.place)));
  }
});

test('choices: the answer once, one place per word, the level\'s words only, and a place on the same thing first', () => {
  assert.deepEqual(reefChoices({ word: 'na', on: 'rock' }, ['na', 'pod'], 2, zero).map(placeKey).sort(), ['na:rock', 'pod:rock']);
  for (let i = 0; i < 50; i++) {
    assert.ok(reefChoices({ word: 'na', on: 'rock' }, ['na', 'pod', 'w'], 3).some((p) => placeKey(p) === 'pod:rock'), 'na with pod: the rock alone does not tell');
    assert.ok(reefChoices({ word: 'w', on: 'shell' }, ['na', 'pod', 'w', 'obok'], 3).some((p) => placeKey(p) === 'obok:shell'), 'w with obok muszli');
    assert.ok(reefChoices({ word: 'pod', on: 'rock' }, ['na', 'pod', 'w', 'obok'], 3).some((p) => p.on === 'rock' && p.word !== 'pod'), 'pod with another place on the rock');
  }
  for (const words of [['na', 'pod'], ['na', 'pod', 'w'], ['na', 'pod', 'w', 'obok']]) {
    for (const target of REEF_PLACES.filter((p) => words.includes(p.word))) {
      const count = Math.min(3, words.length);
      const picks = reefChoices(target, words, count);
      assert.equal(picks.length, count);
      assert.ok(picks.some((p) => placeKey(p) === placeKey(target)));
      assert.ok(picks.every((p) => words.includes(p.word)));
      assert.equal(new Set(picks.map((p) => p.word)).size, count);
    }
  }
});
