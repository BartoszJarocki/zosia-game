import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riverRows, foilsFor, missingFoil, gentler, KEEP_CLEAR, START, LAND, SIDEWAYS } from '../../src/levels/river.js';
import { readFileSync } from 'node:fs';
import { parseGame } from '../../src/levels/parse.js';

const seeded = (seed) => () => { // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
};
const LEVELS = parseGame(readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8'), { childName: 'Zosia' }).levels;
// every level that lays out rows, and every gentler run (the same river after a rough one)
const rowLevels = [...LEVELS.stones, ...LEVELS.stones.map(gentler)].filter((l) => l.bubble !== 'missing')
  .filter((l, i, all) => all.findIndex((o) => o.n === l.n && o.choices === l.choices && o.foils === l.foils) === i);
const many = (L, count = 400) => Array.from({ length: count }, (_, i) => riverRows({ n: L.n, choices: L.choices, foils: L.foils, rng: seeded(i + 1) }));
const path = ({ rows }) => [START, ...rows.map((r) => r.stones.find((s) => s.right)), LAND];

test('the GAME.md River levels that use rows, and their gentler runs', () => {
  assert.deepEqual(rowLevels.map((l) => [l.n, l.choices, l.foils]), [
    [3, 2, 'far'], [5, 2, 'far'], [5, 3, 'far'], [7, 2, 'far'], [7, 2, 'near'], // GAME.md
    [2, 2, 'far'], [4, 2, 'far'], [6, 2, 'far'], // gentler
  ]);
});

test('the gentler run: 2 stones a row, far foils, one stone shorter, the number shown; "missing" keeps its gap', () => {
  assert.deepEqual(gentler({ n: 3, rounds: 2, bubble: 'numeral', choices: 2, foils: 'far' }), { n: 2, rounds: 2, bubble: 'numeral', choices: 2, foils: 'far' });
  assert.deepEqual(gentler({ n: 7, rounds: 1, bubble: 'next', choices: 2, foils: 'near' }), { n: 6, rounds: 1, bubble: 'numeral', choices: 2, foils: 'far' });
  assert.deepEqual(gentler({ n: 5, rounds: 2, bubble: 'missing', choices: 2, foils: 'near' }), { n: 5, rounds: 2, bubble: 'missing', choices: 2, foils: 'far' });
});

test('missing stone: a near foil is a neighbour of the gap, so "pick the smaller" wins only about half the time', () => {
  const foils = Array.from({ length: 200 }, (_, i) => missingFoil(3, 4, 'near', seeded(i + 1)));
  assert.deepEqual([...new Set(foils)].sort(), [2, 4]);
  const smallerRight = foils.filter((f) => f > 3).length / foils.length;
  assert.ok(smallerRight > 0.35 && smallerRight < 0.65, `smaller stone right in ${Math.round(smallerRight * 100)}% of rivers`);
  assert.deepEqual([...new Set(Array.from({ length: 200 }, (_, i) => missingFoil(5, 5, 'near', seeded(i + 1))))].sort(), [4, 6]);
  assert.deepEqual([...new Set(Array.from({ length: 200 }, (_, i) => missingFoil(3, 4, 'far', seeded(i + 1))))].sort(), [5, 6]);
});

for (const L of rowLevels) {
  test(`n=${L.n}, ${L.choices} choices, ${L.foils} foils: the first and last rows stay clear of the reeds`, () => {
    for (const river of many(L)) {
      const r = 0.95 * river.scale;
      for (const [bank, row] of [['near', river.rows[0]], ['far', river.rows.at(-1)]]) {
        for (const s of row.stones) assert.ok(s.x - r >= KEEP_CLEAR[bank][0] && s.x + r <= KEEP_CLEAR[bank][1], `${bank} row stone at x ${s.x} (radius ${r.toFixed(2)})`);
      }
    }
  });
}

for (const L of rowLevels) {
  test(`n=${L.n}, ${L.choices} choices, ${L.foils} foils: row k holds k+1 and ${L.choices - 1} other numbers`, () => {
    for (const river of many(L)) {
      assert.equal(river.rows.length, L.n);
      river.rows.forEach((row, k) => {
        assert.deepEqual(row.stones.filter((s) => s.right).map((s) => s.num), [k + 1]);
        assert.equal(new Set(row.stones.map((s) => s.num)).size, L.choices);
        for (const s of row.stones.filter((s) => !s.right)) {
          assert.ok(s.num >= 1, `a real number (${s.num})`);
          assert.ok(L.foils === 'near' ? Math.abs(s.num - (k + 1)) <= 2 : Math.abs(s.num - (k + 1)) >= 2, `${L.foils} foil ${s.num} for ${k + 1}`);
        }
      });
    }
  });

  test(`n=${L.n}: every hop goes forward, never more than ${SIDEWAYS}× sideways`, () => {
    let hops = 0;
    for (const river of many(L)) {
      const p = path(river);
      for (let i = 1; i < p.length; i++, hops++) {
        const dz = p[i - 1].z - p[i].z, dx = Math.abs(p[i].x - p[i - 1].x);
        assert.ok(dz > 0.5, `hop ${i} goes forward (dz ${dz})`);
        assert.ok(dx <= SIDEWAYS * dz + 1e-6, `hop ${i}: ${dx.toFixed(2)} sideways for ${dz.toFixed(2)} forward`);
      }
    }
    assert.equal(hops, 400 * (L.n + 1));
  });

  test(`n=${L.n}: stones never overlap, stay on screen and out from under the bubble`, () => {
    for (const river of many(L)) {
      const d = 2 * 0.95 * river.scale;
      river.rows.forEach((row, k) => {
        const prev = k ? row.stones.length && river.rows[k - 1].stones.find((s) => s.right) : null;
        for (const s of row.stones) {
          assert.ok(Math.abs(s.x) < 7.3 + (0.6 - s.z) * 0.32, `on screen: ${s.x}, ${s.z}`);
          assert.ok(!(s.z < -1.9 + d / 2 && s.x < -3.9 + d / 2), `not under the bubble: ${s.x}, ${s.z}`);
          for (const o of row.stones) if (o !== s) assert.ok(Math.abs(o.x - s.x) >= d, 'side by side, not on top of each other');
          if (prev) assert.ok(Math.hypot(prev.x - s.x, prev.z - s.z) >= d * 0.95, `clear of the stone she stands on (${prev.x},${prev.z}) → (${s.x},${s.z})`);
          assert.ok(Math.abs(s.x - (prev || START).x) >= 0.45 + 0.6 * (d / 2) - 1e-6, `not hidden behind her: she is at x ${(prev || START).x}, the stone at ${s.x}`);
        }
      });
    }
  });

  test(`n=${L.n}: where the right stone sits in its row says nothing`, () => {
    const at = Array(L.choices).fill(0);
    for (const river of many(L)) for (const row of river.rows) at[[...row.stones].sort((a, b) => a.x - b.x).findIndex((s) => s.right)]++;
    const total = at.reduce((a, b) => a + b);
    for (const c of at) assert.ok(c / total > 0.7 / L.choices, `slot shares ${at.map((c) => Math.round((100 * c) / total)).join('/')}%`);
  });
}

test('foils: far ones are 2+ away, near ones are the neighbours first', () => {
  assert.deepEqual(foilsFor(1, 2, 'far', 3, seeded(3)).sort(), [3, 4]);
  assert.deepEqual(foilsFor(4, 1, 'near', 7, seeded(5)).map((f) => Math.abs(f - 4)), [1]);
  assert.deepEqual(foilsFor(1, 2, 'near', 7, seeded(5)).sort(), [2, 3]);
  assert.deepEqual(foilsFor(2, 2, 'far', 3, seeded(9)).length, 2); // a short river tops up rather than leaving a gap
});
