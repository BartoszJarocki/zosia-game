import test from 'node:test';
import assert from 'node:assert/strict';
import { REEF_PLACES, reefWords, reefPlan, reefChoices, reefSpots, placeAt, placeKey } from '../../src/levels/reef.js';

const zero = () => 0;
const gap = (a, b) => Math.hypot(placeAt(a).x - placeAt(b).x, placeAt(a).y - placeAt(b).y, placeAt(a).z - placeAt(b).z);

test('the reef uses only places that make sense', () => {
  assert.deepEqual(REEF_PLACES.map(placeKey), [
    'na:rock', 'na:shell', 'pod:rock', 'w:shell', 'obok:rock', 'obok:shell',
  ]);
  assert.ok(REEF_PLACES.filter((p) => p.word === 'w').every((p) => p.on === 'shell'));
  assert.ok(REEF_PLACES.filter((p) => p.word === 'pod').every((p) => p.on === 'rock'));
});

test('words take turns: every word before a repeat and never the same word next to itself', () => {
  assert.deepEqual(reefWords(['na', 'pod'], 4, zero), ['pod', 'na', 'pod', 'na']);
  assert.deepEqual(reefWords(['na', 'pod', 'w', 'obok'], 4, zero), ['pod', 'w', 'obok', 'na']);
  for (let i = 0; i < 100; i++) {
    const plan = reefWords(['na', 'pod', 'w', 'obok'], 7);
    for (let at = 1; at < plan.length; at++) assert.notEqual(plan[at], plan[at - 1]);
    assert.deepEqual(new Set(plan.slice(0, 4)), new Set(['na', 'pod', 'w', 'obok']));
  }
});

test('the plan gives every round an animal and a real place', () => {
  const plans = reefPlan({ words: ['na', 'pod'], rounds: 4 }, zero);
  assert.deepEqual(plans.map((p) => [p.word, p.animal, placeKey(p.place)]), [
    ['pod', 'crab', 'pod:rock'],
    ['na', 'starfish', 'na:rock'],
    ['pod', 'fish', 'pod:rock'],
    ['na', 'octopus', 'na:rock'],
  ]);
  for (const plane of plans) assert.ok(REEF_PLACES.some((p) => placeKey(p) === placeKey(plane.place)));
});

test('choices include the answer once, one per word, and only the level\'s words', () => {
  assert.deepEqual(reefChoices({ word: 'na', on: 'rock' }, ['na', 'pod'], 2, zero).map((p) => p.word), ['pod', 'na']);
  assert.deepEqual(reefChoices({ word: 'pod', on: 'rock' }, ['na', 'pod'], 2, zero).map((p) => p.word), ['na', 'pod']);
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

test('place spots are the answer plus two different, well-spaced words', () => {
  for (const target of REEF_PLACES) {
    const spots = reefSpots(target, ['na', 'pod', 'w', 'obok'], 3, zero);
    assert.equal(spots.length, 3);
    assert.ok(spots.some((p) => placeKey(p) === placeKey(target)));
    assert.deepEqual(new Set(spots.map((p) => p.word)).size, 3);
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) assert.ok(gap(spots[i], spots[j]) > 3.4, `${placeKey(spots[i])} / ${placeKey(spots[j])}`);
    }
  }
});
