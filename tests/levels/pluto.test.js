import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plutoRound } from '../../src/levels/pluto.js';
import { SHAPES } from '../../src/levels/garage.js';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

test('Pluto level rows parse to the specified literal settings', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.pluto, [
    { choices: 2, turned: false, rounds: 3 },
    { choices: 3, turned: false, rounds: 3 },
    { choices: 4, turned: false, rounds: 3 },
    { choices: 4, turned: true, rounds: 3 },
  ]);
});

test('every Pluto round has one heart and only the other Garage shapes around it', () => {
  for (const choices of [2, 3, 4]) for (const random of [() => 0, () => 0.49, () => 0.999]) {
    const round = plutoRound({ choices, turned: false }, random);
    assert.equal(round.answer, 'heart');
    assert.equal(round.pieces.length, choices);
    assert.equal(round.pieces.filter((p) => p.shape === 'heart').length, 1);
    assert.ok(round.pieces.every((p) => p.shape === 'heart' || SHAPES.includes(p.shape)));
    assert.equal(new Set(round.pieces.map((p) => p.shape)).size, choices);
    assert.ok(round.pieces.every((p) => p.turn === 0 && p.size === 1));
  }
});

test('turned pieces are bigger or smaller, and the square, triangle and heart turn', () => {
  for (const random of [() => 0, () => 0.3, () => 0.999]) {
    const { pieces } = plutoRound({ choices: 4, turned: true }, random);
    assert.ok(pieces.every((p) => [0.9, 1, 1.2].includes(p.size)));
    for (const p of pieces) {
      if (p.shape === 'square') assert.equal(p.turn, Math.PI / 4);
      if (p.shape === 'triangle') assert.notEqual(p.turn, 0);
      if (p.shape === 'heart') assert.ok(Math.abs(p.turn) <= 0.4, `heart turn ${p.turn}`);
    }
  }
  assert.equal(plutoRound({ choices: 2, turned: true }, () => 0).pieces.find((p) => p.shape === 'heart').size, 0.9);
});

const table = (row) => `### Test · \`pluto\`\n\n| Level | choices | turned | rounds |\n|---|---|---|---|\n| 1 | ${row} |\n`;
const rowErrors = (row) => parseGame(table(row)).errors.filter((e) => e.includes('(Test'));

test('Pluto schema checks the piece count, the turned flag and the round count', () => {
  assert.deepEqual(rowErrors('2 | no | 3'), []);
  assert.deepEqual(rowErrors('4 | yes | 6'), []);
  for (const row of ['1 | no | 3', '5 | no | 3', '2 | maybe | 3', '2 | no | 0', '2 | no | 7',
    '2.5 | no | 3', '- | no | 3']) assert.ok(rowErrors(row).length > 0, row);
});

test('a gentler Pluto run has one choice fewer and textbook shapes', () => {
  assert.deepEqual(EASIER.pluto(levels.pluto[3]), { choices: 3, turned: false, rounds: 3 });
  assert.deepEqual(EASIER.pluto(levels.pluto[0]), { choices: 2, turned: false, rounds: 3 });
  assert.equal(levels.pluto[3].choices, 4);
  assert.equal(levels.pluto[3].turned, true);
});

test('Pluto lines are full Polish sentences and every one reaches recording', () => {
  assert.equal(HOME_TASKS.pluto, 'Narysuj z mamą serduszko!');
  assert.deepEqual(T.plutoStart(), ['Jesteśmy na Plutonie! Pluton to planeta karłowata. Pluton ma jasne serduszko.']);
  assert.deepEqual(T.plutoAsk(), ['Gdzie jest serduszko?']);
  assert.deepEqual(T.plutoRight(), ['Tak! To jest serduszko!']);
  assert.deepEqual(T.plutoDone(), ['Brawo! Serduszko Plutona świeci!']);
  assert.deepEqual(T.plutoWrong('circle'), ['To jest koło. Serduszko jest tutaj.']);
  assert.deepEqual(T.plutoWrong('square'), ['To jest kwadrat. Serduszko jest tutaj.']);
  assert.deepEqual(T.plutoWrong('triangle'), ['To jest trójkąt. Serduszko jest tutaj.']);
  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [
    'Jesteśmy na Plutonie! Pluton to planeta karłowata. Pluton ma jasne serduszko.',
    'Gdzie jest serduszko?', 'Tak! To jest serduszko!', 'Brawo! Serduszko Plutona świeci!',
    'To jest koło. Serduszko jest tutaj.', 'To jest kwadrat. Serduszko jest tutaj.',
    'To jest trójkąt. Serduszko jest tutaj.', 'Narysuj z mamą serduszko!',
  ]) assert.ok(recorded.includes(line), line);
});
