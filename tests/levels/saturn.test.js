import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saturnPieces, KINDS } from '../../src/levels/saturn.js';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

test('Saturn level rows parse to the specified literal settings', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.saturn, [
    { pieces: 4, named: true, sizes: 'same' },
    { pieces: 6, named: true, sizes: 'same' },
    { pieces: 6, named: false, sizes: 'same' },
    { pieces: 8, named: false, sizes: 'mixed' },
  ]);
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
});

const table = (row) => `### Test · \`saturn\`\n\n| Level | pieces | named | sizes |\n|---|---|---|---|\n| 1 | ${row} |\n`;
const rowErrors = (row) => parseGame(table(row)).errors.filter((e) => e.includes('(Test'));

test('Saturn schema checks the piece count, the named flag and the size choice', () => {
  assert.deepEqual(rowErrors('4 | yes | same'), []);
  assert.deepEqual(rowErrors('8 | no | mixed'), []);
  for (const row of ['1 | yes | same', '9 | yes | same', '4 | maybe | same', '4 | yes | huge', '4 | yes']) {
    assert.ok(rowErrors(row).length > 0, row);
  }
});

test('a gentler Saturn run names the pieces and keeps every size the same', () => {
  assert.deepEqual(EASIER.saturn(levels.saturn[3]), { pieces: 8, named: true, sizes: 'same' });
  assert.equal(levels.saturn[3].named, false);
  assert.equal(levels.saturn[3].sizes, 'mixed');
});

test('Saturn lines are full Polish sentences and every one reaches recording', () => {
  assert.deepEqual(T.saturnNamed('ice'), ['To jest lód.', 'Gdzie jest lodowy pierścień?']);
  assert.deepEqual(T.saturnNamed('rock'), ['To jest skała.', 'Gdzie jest skalny pierścień?']);
  assert.deepEqual(T.saturnWhich(), ['Lód czy skała? Gdzie to pasuje?']);
  assert.deepEqual(T.saturnHint('ice'), ['To jest lód.', 'Gdzie jest lodowy pierścień?']);
  assert.deepEqual(T.saturnRight('ice'), ['Lód do lodu!']);
  assert.deepEqual(T.saturnRight('rock'), ['Skała do skał!']);
  assert.deepEqual(T.saturnWrong('ice'), ['Ojej! To jest lód. Lód jest tutaj.']);
  assert.deepEqual(T.saturnWrong('rock'), ['Ojej! To jest skała. Skały są tutaj.']);
  assert.deepEqual(T.saturnDone(), ['Brawo! Pierścienie Saturna są naprawione!']);
  assert.equal(HOME_TASKS.saturn, 'Zajrzyj z mamą do zamrażarki. Czy jest tam lód?');
  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [
    'Jesteśmy przy Saturnie! Pierścienie się rozsypały. Pomożesz je naprawić?',
    'To jest lód.', 'Gdzie jest lodowy pierścień?', 'To jest skała.', 'Gdzie jest skalny pierścień?',
    'Lód czy skała? Gdzie to pasuje?', 'Lód do lodu!', 'Skała do skał!',
    'Ojej! To jest lód. Lód jest tutaj.', 'Ojej! To jest skała. Skały są tutaj.',
    'Brawo! Pierścienie Saturna są naprawione!', 'Zajrzyj z mamą do zamrażarki. Czy jest tam lód?',
  ]) assert.ok(recorded.includes(line), line);
});
