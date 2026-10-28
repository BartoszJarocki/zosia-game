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
