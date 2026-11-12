import test from 'node:test';
import assert from 'node:assert/strict';
import { boneSpots, linedUp, BONE } from '../../src/levels/picnic.js';

const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** The shaft of a bone seen from above, as two end points. */
const shaft = (x, z, turn) => [[x - Math.cos(turn) * BONE.half, z + Math.sin(turn) * BONE.half], [x + Math.cos(turn) * BONE.half, z - Math.sin(turn) * BONE.half]];
const segDist = ([a, b], [c, d]) => { // the closest two points of two segments (checked at their ends, they never cross here)
  const point = (p, [s, e]) => { const ex = e[0] - s[0], ez = e[1] - s[1], t = Math.max(0, Math.min(1, ((p[0] - s[0]) * ex + (p[1] - s[1]) * ez) / (ex * ex + ez * ez))); return Math.hypot(p[0] - s[0] - t * ex, p[1] - s[1] - t * ez); };
  return Math.min(point(a, [c, d]), point(b, [c, d]), point(c, [a, b]), point(d, [a, b]));
};
const touching = (bones) => bones.flatMap((p, i) => bones.slice(i + 1).map((q) => segDist(shaft(...p), shaft(...q)))).filter((d) => d < 2 * BONE.knob + 0.05);

test('no two treats on a blanket touch, whatever the amount and however crooked they lie', () => {
  for (let n = 1; n <= 10; n++) for (let seed = 1; seed <= 200; seed++) {
    const spots = boneSpots(n, { rng: seeded(seed) });
    assert.equal(spots.length, n);
    assert.deepEqual(touching(spots.map((s) => [s.x, s.z, s.turn])), [], `${n} treats, seed ${seed}`);
  }
});

test('Chase\'s treats in one straight row do not touch either', () => {
  for (let n = 1; n <= 5; n++) assert.deepEqual(touching(boneSpots(n, { row: true }).map((s) => [s.x, s.z, s.turn])), [], `${n} treats`);
});

test('the lined-up clue never makes two treats touch, and keeps them on the blanket', () => {
  for (let n = 1; n <= 10; n++) {
    const bones = Array.from({ length: n }, (_, k) => { const at = linedUp(k, n); return [at.x, at.z, 0]; });
    assert.deepEqual(touching(bones), [], `${n} treats`);
    for (const [x, z] of bones) {
      assert.ok(x - 0.45 >= 3.5 - 2.6 && x + 0.45 <= 3.5 + 2.6, `x ${x} is on the blanket (centre 3.5, 5.2 wide)`);
      assert.ok(Math.abs(z) + 0.2 <= 1.5, `z ${z} is on the blanket (3 deep)`);
    }
  }
});

test('treats lie on their blanket: rows of up to five, inside its 5.2 by 3', () => {
  for (let n = 1; n <= 10; n++) for (const s of boneSpots(n, { rng: seeded(n) })) {
    assert.ok(Math.abs(s.x) + 0.5 <= 2.6, `${n} treats: x ${s.x}`);
    assert.ok(Math.abs(s.z) + 0.3 <= 1.5, `${n} treats: z ${s.z}`);
  }
});
