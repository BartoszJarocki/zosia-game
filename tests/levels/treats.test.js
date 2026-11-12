import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roundOrder } from '../../src/levels/treats.js';
import { parseGame } from '../../src/levels/parse.js';

const zero = () => 0;
// a small seeded generator, so the many-runs checks are the same every time
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

test('round order: two kinds in three rounds alternate and end on the easy one', () => {
  assert.deepEqual(roundOrder(['give', 'share'], 3, { easy: ['share'], random: zero }), ['share', 'give', 'share']);
  assert.deepEqual(roundOrder(['give', 'share'], 3, { easy: ['give', 'share'], random: zero }), ['give', 'share', 'give']);
});

test('round order: give, howMany, share no longer always in that order', () => {
  assert.deepEqual(roundOrder(['give', 'howMany', 'share'], 3, { easy: ['share'], random: zero }), ['howMany', 'give', 'share']);
  const seen = new Set();
  for (let s = 1; s < 60; s++) seen.add(roundOrder(['give', 'howMany', 'share'], 3, { easy: ['share'], random: seeded(s) }).join(' '));
  assert.deepEqual([...seen].sort(), ['give howMany share', 'howMany give share']);
});

test('round order: one kind only repeats; no easy kind leaves the ending open', () => {
  assert.deepEqual(roundOrder(['give'], 3, { random: zero }), ['give', 'give', 'give']);
  assert.deepEqual(roundOrder(['howMany', 'flash'], 2, { easy: ['share'], random: zero }), ['flash', 'howMany']);
});

test('round order: every Treat House level shows every kind, never twice in a row, and ends easy', () => {
  const { levels } = parseGame(readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8'), { childName: 'Zosia' });
  for (const [i, L] of levels.counting.entries()) {
    const easy = L.types.filter((t) => t === 'share' || (t === 'give' && L.auto));
    for (let s = 1; s <= 200; s++) {
      const order = roundOrder(L.types, L.rounds, { easy, random: seeded(s * 7 + i) });
      assert.equal(order.length, L.rounds);
      assert.deepEqual(new Set(order), new Set(L.types), `level ${i + 1}: ${order}`);
      assert.ok(order.every((k, j) => j === 0 || order[j - 1] !== k), `level ${i + 1} repeats: ${order}`);
      assert.ok(easy.includes(order.at(-1)), `level ${i + 1} ends on ${order.at(-1)}`);
    }
  }
});

test('round order: a kind listed twice comes up twice, never next to itself, and the run still ends easy', () => {
  const types = ['give', 'howMany', 'share', 'howMany'];
  const orders = new Set();
  for (let s = 1; s <= 300; s++) {
    const order = roundOrder(types, 4, { easy: ['give', 'share'], random: seeded(s * 7919003) });
    assert.deepEqual([...order].sort(), ['give', 'howMany', 'howMany', 'share'], order.join(' '));
    assert.ok(order.every((k, j) => j === 0 || order[j - 1] !== k), `repeats: ${order}`);
    assert.ok(['give', 'share'].includes(order.at(-1)), `ends on ${order.at(-1)}`);
    orders.add(order.join(' '));
  }
  assert.ok(orders.size > 1, 'the order changes from run to run');
});

test('a blind tapper cannot level up the Treat House on one lucky answer: every level counts at least two questions', () => {
  const { levels } = parseGame(readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8'), { childName: 'Zosia' });
  for (const [i, L] of levels.counting.entries()) {
    // a give with auto and a share can't be got wrong, so they are played but not counted (scenes/counting.js)
    const counted = L.types.filter((t) => ['howMany', 'flash', 'hidden'].includes(t) || (t === 'give' && !L.auto)).length;
    assert.ok(counted >= 2, `level ${i + 1} counts ${counted}`);
    assert.ok(L.rounds >= L.types.length);
  }
});
