import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saturnPieces, saturnSlots, slotAtPoint, slotOf, KINDS, SCALE } from '../../src/levels/saturn.js';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

test('Saturn level rows parse to the specified literal settings', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.saturn, [
    { pieces: 4, named: true, sizes: 'same', sort: 'kind' },
    { pieces: 6, named: false, sizes: 'mixed', sort: 'kind' },
    { pieces: 6, named: false, sizes: 'mixed', sort: 'both' },
    { pieces: 8, named: false, sizes: 'mixed', sort: 'both' },
  ]);
});

test('mixed sizes never bring the same kind and size twice in a row, at any piece count', () => {
  for (let pieces = 2; pieces <= 8; pieces++) for (let i = 0; i < 60; i++) {
    const plan = saturnPieces({ pieces, sizes: 'mixed' }, () => (i * 0.61803398875) % 1);
    assert.equal(plan.length, pieces);
    assert.ok(plan.every((p, j) => j === 0 || p.kind !== plan[j - 1].kind || p.size !== plan[j - 1].size), JSON.stringify(plan));
    assert.ok(plan.every((p, j) => j < 2 || !(p.kind === plan[j - 1].kind && p.kind === plan[j - 2].kind)));
  }
});

test('pieces keep both kinds balanced and never put three of a kind in a row', () => {
  for (const level of levels.saturn) for (const random of [() => 0, () => 0.37, () => 0.999]) {
    const plan = saturnPieces(level, random);
    assert.equal(plan.length, level.pieces);
    assert.deepEqual([...new Set(plan.map((p) => p.kind))].sort(), [...KINDS].sort());
    const counts = Object.fromEntries(KINDS.map((kind) => [kind, plan.filter((p) => p.kind === kind).length]));
    assert.ok(Math.abs(counts.ice - counts.rock) <= 1, JSON.stringify(counts));
    assert.ok(plan.every((p, i) => i < 2 || !(p.kind === plan[i - 1].kind && p.kind === plan[i - 2].kind)));
  }
});

test('same pieces are all one size; mixed pieces give every kind big and small ones', () => {
  for (const level of levels.saturn) {
    const plan = saturnPieces(level, () => 0.21);
    if (level.sizes === 'same') {
      assert.ok(plan.every((p) => p.size === 'same'), JSON.stringify(level));
      continue;
    }
    for (const kind of KINDS) {
      const sizes = plan.filter((p) => p.kind === kind).map((p) => p.size);
      assert.ok(sizes.includes('big') && sizes.includes('small'), `${kind}: ${sizes}`);
    }
  }
  let bigIce = 0, smallIce = 0, bigRock = 0, smallRock = 0;
  for (let i = 0; i < 400; i++) {
    const plan = saturnPieces(levels.saturn[3], () => (i * 0.61803398875) % 1);
    for (const p of plan) {
      if (p.kind === 'ice' && p.size === 'big') bigIce++;
      if (p.kind === 'ice' && p.size === 'small') smallIce++;
      if (p.kind === 'rock' && p.size === 'big') bigRock++;
      if (p.kind === 'rock' && p.size === 'small') smallRock++;
    }
  }
  assert.ok(bigIce > 0 && smallIce > 0 && bigRock > 0 && smallRock > 0);
  assert.equal(bigIce, smallIce);
  assert.equal(bigRock, smallRock);
  assert.equal(SCALE.big, SCALE.small * 2, 'a big piece is twice a small one');
});

test('sorting by kind has a hole per ring; sorting by both has a big and a small hole in each ring', () => {
  assert.deepEqual(saturnSlots('kind').map((x) => x.key), ['ice', 'rock']);
  assert.deepEqual(saturnSlots('both').map((x) => x.key), ['ice:big', 'ice:small', 'rock:big', 'rock:small']);
  for (const kind of KINDS) {
    const [big, small] = saturnSlots('both').filter((x) => x.kind === kind);
    assert.ok(big.width > small.width * 1.8, `${kind}: the big hole is about twice the small one`);
    assert.ok(Math.cos(big.angle) < 0 && Math.cos(small.angle) > 0, `${kind}: big on the left, small on the right`);
  }
  for (const level of levels.saturn) {
    const keys = saturnSlots(level.sort).map((x) => x.key);
    const plan = saturnPieces(level, () => 0.37);
    assert.ok(plan.every((p) => keys.includes(slotOf(p, level.sort))), JSON.stringify(level));
    if (level.sort === 'both') assert.deepEqual([...new Set(plan.map((p) => slotOf(p, 'both')))].sort(), [...keys].sort(), 'every hole gets a piece');
  }
  assert.equal(slotOf({ kind: 'rock', size: 'small' }, 'kind'), 'rock');
  assert.equal(slotOf({ kind: 'rock', size: 'small' }, 'both'), 'rock:small');
});

const table = (row) => `### Test · \`saturn\`\n\n| Level | pieces | named | sizes | sort |\n|---|---|---|---|---|\n| 1 | ${row} |\n`;
const rowErrors = (row) => parseGame(table(row)).errors.filter((e) => e.includes('(Test'));

test('Saturn schema checks the piece count, the named flag, the size choice and the sort', () => {
  assert.deepEqual(rowErrors('4 | yes | same | kind'), []);
  assert.deepEqual(rowErrors('8 | no | mixed | both'), []);
  assert.deepEqual(rowErrors('8 | no | same | both'), ['GAME.md line 5 (Test, level 1): sort "both" sorts by size too, so it needs sizes "mixed"']);
  assert.deepEqual(rowErrors('8 | yes | mixed | both'), ['GAME.md line 5 (Test, level 1): sort "both" asks her to judge the piece, so named must be "no"']);
  for (const row of ['1 | yes | same | kind', '9 | yes | same | kind', '4 | maybe | same | kind', '4 | yes | huge | kind', '4 | yes | same | colour', '4 | yes | same']) {
    assert.ok(rowErrors(row).length > 0, row);
  }
});

test('a gentler Saturn run is one step easier: by kind only, then named and one size, then fewer pieces', () => {
  assert.deepEqual(EASIER.saturn(levels.saturn[3]), { pieces: 8, named: false, sizes: 'mixed', sort: 'kind' });
  assert.deepEqual(EASIER.saturn(levels.saturn[1]), { pieces: 6, named: true, sizes: 'same', sort: 'kind' });
  assert.deepEqual(EASIER.saturn(levels.saturn[0]), { pieces: 2, named: true, sizes: 'same', sort: 'kind' });
});

test('Saturn lines are full Polish sentences and every one reaches recording', () => {
  assert.deepEqual(T.saturnNamed('ice'), ['To jest lód.', 'Gdzie jest lodowy pierścień?']);
  assert.deepEqual(T.saturnNamed('rock'), ['To jest skała.', 'Gdzie jest skalny pierścień?']);
  assert.deepEqual(T.saturnWhich(), ['Lód czy skała? Gdzie to pasuje?']);
  assert.deepEqual(T.saturnHint('ice'), ['To jest lód.', 'Gdzie jest lodowy pierścień?']);
  assert.deepEqual(T.saturnRight('ice'), ['Lód do lodu!']);
  assert.deepEqual(T.saturnRight('rock'), ['Skała do skał!']);
  assert.deepEqual(T.saturnWhichBoth(), ['Lód czy skała? Duży czy mały?']);
  assert.deepEqual(['big', 'small'].flatMap((size) => KINDS.flatMap((kind) => T.saturnHintBoth(kind, size))),
    ['To duży kawałek lodu.', 'To duży kawałek skały.', 'To mały kawałek lodu.', 'To mały kawałek skały.']);
  assert.deepEqual(T.saturnDone(), ['Brawo! Pierścienie Saturna są naprawione!']);
  assert.equal(HOME_TASKS.saturn, 'Zajrzyj z mamą do zamrażarki. Czy jest tam lód?');
  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [
    'Jesteśmy przy Saturnie! Pierścienie się rozsypały. Pomożesz je naprawić?',
    'To jest lód.', 'Gdzie jest lodowy pierścień?', 'To jest skała.', 'Gdzie jest skalny pierścień?',
    'Lód czy skała? Gdzie to pasuje?', 'Lód do lodu!', 'Skała do skał!',
    'Brawo! Pierścienie Saturna są naprawione!', 'Zajrzyj z mamą do zamrażarki. Czy jest tam lód?',
    'Lód czy skała? Duży czy mały?', 'To duży kawałek lodu.', 'To mały kawałek lodu.', 'To duży kawałek skały.', 'To mały kawałek skały.',
  ]) assert.ok(recorded.includes(line), line);
});

const RADII = { ice: [2.9, 4.05], rock: [4.2, 5.65] };
const bands = (sort) => saturnSlots(sort).map((slot) => ({ key: slot.key, radii: RADII[slot.kind], arc: slot.tap }));
const around = (radius, angle) => [Math.cos(angle) * radius, -Math.sin(angle) * radius]; // (x to her right, z toward her)

test('a point of the ring plane belongs to the ring whose band holds it, and to none in a gap or off the rings', () => {
  const rings = bands('kind');
  for (const angle of [0, 1, 2.5, Math.PI, 4, -Math.PI / 2, 6]) {
    assert.equal(slotAtPoint(rings, ...around(3.5, angle)), 'ice', `ice at ${angle}`);
    assert.equal(slotAtPoint(rings, ...around(4.9, angle)), 'rock', `rock at ${angle}`);
    assert.equal(slotAtPoint(rings, ...around(4.12, angle)), null, 'the gap between them');
    assert.equal(slotAtPoint(rings, ...around(2.5, angle)), null, 'inside the ice ring');
    assert.equal(slotAtPoint(rings, ...around(5.9, angle)), null, 'outside the rock ring');
  }
  assert.equal(slotAtPoint(rings, 0, 0), null, 'Saturn itself');
});

test('with "both", the half ring on her left takes the big hole and the one on her right the small hole, in each ring', () => {
  const halves = bands('both');
  assert.equal(slotAtPoint(halves, -3.5, 0.4), 'ice:big');
  assert.equal(slotAtPoint(halves, 3.5, 0.4), 'ice:small');
  assert.equal(slotAtPoint(halves, -4.9, -1), 'rock:big');
  assert.equal(slotAtPoint(halves, 4.9, -1), 'rock:small');
  assert.equal(slotAtPoint(halves, -3.5, -2), 'ice:big', 'the back of the ring too');
  assert.equal(slotAtPoint(halves, 0.01, 4.9), 'rock:small', 'a hair right of the middle at the front');
  assert.equal(slotAtPoint(halves, -0.01, 4.9), 'rock:big', 'a hair left of the middle at the front');
});
