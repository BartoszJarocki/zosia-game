import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGame } from '../../src/levels/parse.js';
import { shapePieces, patternRound, sortRound, basketFor, easier, COLOURS, ODD_TRIANGLES } from '../../src/levels/garage.js';
import { createSession, completeMission, suggestNext } from '../../src/session/director.js';

/** A seeded generator (mulberry32), so a failure can be replayed. */
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const runs = (n, fn) => Array.from({ length: n }, (_, i) => fn(seeded(i + 1)));

test('pattern AB: two colours taking turns, the next one missing, and it is not always the first colour', () => {
  const rounds = runs(200, (rng) => patternRound('AB', rng));
  for (const p of rounds) {
    assert.ok(p.row.length === 5 || p.row.length === 6);
    assert.equal(p.gap, p.row.length - 1);
    p.row.forEach((c, i) => assert.equal(c, p.row[i % 2]));
    assert.notEqual(p.row[0], p.row[1]);
    assert.equal(p.answer, p.row[p.gap]);
    assert.equal(p.item, 'AB');
  }
  assert.deepEqual(new Set(rounds.map((p) => p.answer === p.row[0])), new Set([true, false]));
});

test('pattern choices: the two colours of the row and one that is not in it', () => {
  for (const kind of ['AB', 'gap', 'ABB']) {
    for (const p of runs(100, (rng) => patternRound(kind, rng))) {
      assert.equal(new Set(p.choices).size, 3);
      assert.ok(p.choices.includes(p.answer));
      assert.equal(p.choices.filter((c) => !p.row.includes(c)).length, 1);
      assert.ok(p.choices.every((c) => COLOURS.includes(c)));
    }
  }
});

test('pattern gap: one flag missing in the middle, with the pattern on both sides of it', () => {
  for (const p of runs(200, (rng) => patternRound('gap', rng))) {
    assert.equal(p.row.length, 6);
    assert.ok(p.gap === 2 || p.gap === 3);
    assert.equal(p.row[p.gap - 2], p.answer);
    assert.equal(p.row[p.gap + 2], p.answer);
    assert.notEqual(p.row[p.gap - 1], p.answer);
    assert.equal(p.item, 'gap');
  }
});

test('pattern ABB: the unit of three shows twice before the gap, and "not the same as the last" is not enough', () => {
  const rounds = runs(300, (rng) => patternRound('ABB', rng));
  for (const p of rounds) {
    assert.ok(p.row.length === 7 || p.row.length === 8);
    assert.equal(p.gap, p.row.length - 1);
    p.row.forEach((c, i) => assert.equal(c, p.row[i % 3]));
    assert.ok(p.item === 'ABB' || p.item === 'AAB');
    assert.equal(p.row[1] === p.row[2], p.item === 'ABB');
  }
  assert.ok(rounds.some((p) => p.answer === p.row[p.gap - 1]), 'some rows go on with the same colour as the last flag');
  assert.deepEqual(new Set(rounds.map((p) => p.item)), new Set(['ABB', 'AAB']));
});

test('sort by colour: two colours, one size, two blocks for each basket', () => {
  for (const s of runs(100, (rng) => sortRound('colour', rng))) {
    assert.notEqual(s.baskets[0].colour, s.baskets[1].colour);
    assert.equal(s.baskets[0].size, s.baskets[1].size);
    assert.equal(new Set(s.blocks.map((b) => b.size)).size, 1);
    assert.deepEqual(s.blocks.map((b) => basketFor(b, s.baskets)).sort(), [0, 0, 1, 1]);
    assert.ok(s.blocks.every((b) => b.rule === 'colour'));
  }
});

test('sort by size: a big and a small wicker basket, blocks all one colour', () => {
  for (const s of runs(100, (rng) => sortRound('size', rng))) {
    assert.deepEqual(s.baskets.map((k) => k.size).sort(), ['big', 'small']);
    assert.deepEqual(s.baskets.map((k) => k.colour), [null, null]);
    assert.equal(new Set(s.blocks.map((b) => b.colour)).size, 1);
    assert.deepEqual(s.blocks.map((b) => basketFor(b, s.baskets)).sort(), [0, 0, 1, 1]);
  }
});

test('sort switch: two blocks by colour, then two by size, and the two rules always point at different baskets', () => {
  for (const s of runs(100, (rng) => sortRound('switch', rng))) {
    assert.deepEqual(s.blocks.map((b) => b.rule), ['colour', 'colour', 'size', 'size']);
    for (const b of s.blocks) {
      const byColour = basketFor({ ...b, rule: 'colour' }, s.baskets), bySize = basketFor({ ...b, rule: 'size' }, s.baskets);
      assert.ok(byColour >= 0 && bySize >= 0);
      assert.notEqual(byColour, bySize);
    }
    assert.deepEqual(s.blocks.slice(2).map((b) => basketFor(b, s.baskets)).sort(), [0, 1]);
  }
});

test('basketFor follows the block\'s rule', () => {
  const baskets = [{ colour: 'red', size: 'big' }, { colour: 'blue', size: 'small' }];
  assert.equal(basketFor({ colour: 'red', size: 'small', rule: 'colour' }, baskets), 0);
  assert.equal(basketFor({ colour: 'red', size: 'small', rule: 'size' }, baskets), 1);
});

test('shape pieces: textbook shapes until "turned", then turned, resized and an odd triangle', () => {
  for (const mode of ['shown', 'name']) {
    for (const pieces of runs(50, (rng) => shapePieces(mode, rng))) {
      assert.deepEqual(pieces.map((p) => p.shape).sort(), ['circle', 'square', 'triangle']);
      assert.ok(pieces.every((p) => p.turn === 0 && p.size === 1 && p.odd === null));
      assert.equal(new Set(pieces.map((p) => p.colour)).size, 3);
    }
  }
  const turned = runs(100, (rng) => shapePieces('turned', rng));
  for (const pieces of turned) {
    const by = Object.fromEntries(pieces.map((p) => [p.shape, p]));
    assert.equal(by.square.turn, Math.PI / 4);
    assert.ok(ODD_TRIANGLES.includes(by.triangle.odd));
    assert.equal(by.circle.odd, null);
  }
  assert.deepEqual(new Set(turned.map((ps) => ps.find((p) => p.shape === 'triangle').odd)), new Set(ODD_TRIANGLES));
});

test('a gentler run is one rung easier in every mode, and the first rung stays', () => {
  assert.deepEqual(easier({ modes: ['shapes', 'pattern', 'sort'], shapes: 'turned', pattern: 'ABB', sort: 'switch', rounds: 3 }),
    { modes: ['shapes', 'pattern', 'sort'], shapes: 'name', pattern: 'gap', sort: 'size', rounds: 3 });
  assert.deepEqual(easier({ modes: ['shapes'], shapes: 'shown', rounds: 2 }), { modes: ['shapes'], shapes: 'shown', rounds: 2 });
});

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');

test('Garage: every level changes exactly one thing from the level before', () => {
  const { levels, errors } = parseGame(md, { childName: 'Zosia' });
  assert.deepEqual(errors, []);
  const rows = levels.garage;
  assert.ok(rows.length >= 5);
  for (let i = 1; i < rows.length; i++) {
    const changed = Object.keys(rows[i]).filter((k) => JSON.stringify(rows[i][k]) !== JSON.stringify(rows[i - 1][k]));
    assert.equal(changed.length, 1, `level ${i + 1} changes ${changed.join(', ') || 'nothing'}`);
  }
  assert.deepEqual(rows[0], { modes: ['shapes', 'pattern', 'sort'], shapes: 'shown', pattern: 'AB', sort: 'colour', rounds: 3 });
});

const garageTable = (row) => `### Test · \`garage\`\n\n| Level | modes | shapes | pattern | sort | rounds |\n|---|---|---|---|---|---|\n| 1 | ${row} |\n`;
const garageErrors = (row) => parseGame(garageTable(row), {}).errors.filter((e) => e.includes('(Test'));

test('Garage table: a mode needs its column, and an unused column may stay empty', () => {
  assert.deepEqual(garageErrors('shapes, sort | name | — | size | 2'), []);
  assert.match(garageErrors('shapes, pattern | name | — | — | 2')[0], /pattern/);
  assert.match(garageErrors('sort | — | — | sideways | 2')[0], /colour, size, switch/);
});

test('session: the Garage is its own kind of game, so it may follow a letter game or a number game', () => {
  const kinds = ['letters', 'balloons', 'cones', 'stones', 'garage'];
  for (const [last, other] of [['letters', ['cones', 'stones']], ['cones', ['letters', 'balloons']]]) {
    const s = createSession(0, { targetMissions: 10 });
    completeMission(s, last, 1);
    assert.deepEqual(new Set(runs(80, (rng) => suggestNext(s, kinds, rng))), new Set([...other, 'garage']));
  }
});
