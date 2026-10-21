import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riverRows, foilsFor, START, LAND, SIDEWAYS } from '../../src/levels/river.js';
import { readFileSync } from 'node:fs';
import { parseGame } from '../../src/levels/parse.js';

const seeded = (seed) => () => { // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
};
const LEVELS = parseGame(readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8'), { childName: 'Zosia' }).levels;
const rowLevels = LEVELS.stones.filter((l) => l.bubble !== 'missing');
const many = (L, count = 400) => Array.from({ length: count }, (_, i) => riverRows({ n: L.n, choices: L.choices, foils: L.foils, rng: seeded(i + 1) }));
const path = ({ rows }) => [START, ...rows.map((r) => r.stones.find((s) => s.right)), LAND];

test('the GAME.md River levels that use rows', () => {
  assert.deepEqual(rowLevels.map((l) => [l.n, l.choices, l.foils]), [[3, 2, 'far'], [5, 3, 'far'], [7, 2, 'near']]);
});

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
