import test from 'node:test';
import assert from 'node:assert/strict';
import { THINGS, FAMILIAR, shallowsPlan, thingById } from '../../src/levels/shallows.js';

/** A seeded generator (mulberry32), so a failure can be replayed. */
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const runs = (n, fn) => Array.from({ length: n }, (_, i) => fn(seeded(i + 1)));

test('every thing is on its true side, exactly these ten', () => {
  assert.deepEqual(Object.fromEntries(THINGS.map((thing) => [thing.id, thing.side])), {
    'jabłko': 'float',
    'piłka': 'float',
    'kaczka': 'float',
    'liść': 'float',
    'klocek': 'float',
    'kłoda': 'float',
    'kamień': 'sink',
    'klucz': 'sink',
    'moneta': 'sink',
    'łyżka': 'sink',
  });
  assert.deepEqual(THINGS.map((thing) => thing.name), ['Jabłko', 'Piłka', 'Kaczka', 'Liść', 'Klocek', 'Kłoda', 'Kamień', 'Klucz', 'Moneta', 'Łyżka']);
});

test('familiar rounds use only the six everyday things', () => {
  assert.deepEqual(FAMILIAR, ['jabłko', 'piłka', 'kaczka', 'kamień', 'klucz', 'łyżka']);
  for (const plan of runs(200, (rng) => shallowsPlan({ things: 'familiar', rounds: 4 }, rng))) {
    assert.equal(plan.length, 4);
    assert.equal(new Set(plan.map((thing) => thing.id)).size, 4);
    assert.ok(plan.every((thing) => FAMILIAR.includes(thing.id)));
    assert.ok(plan.every((thing) => !['liść', 'klocek', 'kłoda', 'moneta'].includes(thing.id)));
  }
});

test('all rounds always include the big log and the little coin, among distinct things', () => {
  for (const plan of runs(200, (rng) => shallowsPlan({ things: 'all', rounds: 5 }, rng))) {
    assert.equal(plan.length, 5);
    assert.equal(new Set(plan.map((thing) => thing.id)).size, 5);
    const ids = plan.map((thing) => thing.id);
    assert.ok(ids.includes('kłoda'));
    assert.ok(ids.includes('moneta'));
    assert.equal(thingById('kłoda').side, 'float');
    assert.equal(thingById('moneta').side, 'sink');
  }
  for (const plan of runs(100, (rng) => shallowsPlan({ things: 'all', rounds: 2 }, rng))) {
    assert.deepEqual(plan.map((thing) => thing.id).sort(), ['kłoda', 'moneta'].sort());
  }
});

test('a plan never repeats a thing and keeps the level\'s count', () => {
  for (const rounds of [1, 2, 3, 4, 5, 6]) {
    for (const things of ['familiar', 'all']) {
      const plan = shallowsPlan({ things, rounds }, seeded(rounds + (things === 'all' ? 20 : 0)));
      assert.equal(plan.length, rounds);
      assert.equal(new Set(plan.map((thing) => thing.id)).size, rounds);
    }
  }
});
