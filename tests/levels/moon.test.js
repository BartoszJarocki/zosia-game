import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moonRounds, numbersIn, countVerdict, neighbours } from '../../src/levels/moon.js';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

test('Moon level rows parse to the specified literal settings', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.moon, [
    { types: ['jump', 'howMany'], jump: [1, 3], howMany: [1, 3], auto: true, slots: true, rounds: 3 },
    { types: ['jump', 'howMany'], jump: [1, 4], howMany: [1, 4], auto: true, slots: false, rounds: 3 },
    { types: ['jump', 'howMany'], jump: [2, 5], howMany: [2, 5], auto: false, slots: false, rounds: 4 },
    { types: ['jump', 'howMany'], jump: [3, 7], howMany: [3, 6], auto: false, slots: false, rounds: 4 },
  ]);
});

test('Moon rounds alternate when possible and always finish with automatic jumps', () => {
  const order = levels.moon.map((l) => moonRounds(l, () => 0));
  assert.deepEqual(order[0], [{ type: 'jump', auto: true }, { type: 'howMany', auto: false }, { type: 'jump', auto: true }]);
  assert.deepEqual(order[1], [{ type: 'jump', auto: true }, { type: 'howMany', auto: false }, { type: 'jump', auto: true }]);
  assert.deepEqual(order[3], [{ type: 'howMany', auto: false }, { type: 'jump', auto: false }, { type: 'howMany', auto: false }, { type: 'jump', auto: true }]);
  for (const l of levels.moon) for (const random of [() => 0, () => 0.49, () => 0.999]) {
    const plan = moonRounds(l, random);
    assert.equal(plan.length, l.rounds);
    assert.deepEqual([...new Set(plan.map((r) => r.type))].sort(), [...l.types].sort());
    assert.deepEqual(plan.at(-1), { type: 'jump', auto: true });
    if (l.types.length > 1) assert.ok(plan.every((r, i) => !i || r.type !== plan[i - 1].type));
  }
  assert.deepEqual(moonRounds({ types: ['jump'], rounds: 1, auto: false }), [{ type: 'jump', auto: true }]);
});

test('Moon ranges include both ends; neighbour choices include zero for one jump', () => {
  assert.deepEqual(numbersIn([1, 3]), [1, 2, 3]);
  assert.deepEqual(numbersIn([3, 7]), [3, 4, 5, 6, 7]);
  assert.deepEqual(numbersIn([9, 9]), [9]);
  assert.deepEqual(neighbours(1), [0, 1, 2]);
  assert.deepEqual(neighbours(6), [5, 6, 7]);
  assert.deepEqual(neighbours(9), [8, 9, 10]);
});

test('manual counts need another flag tap after extras have faded', () => {
  assert.equal(countVerdict(0, 3), 'few');
  assert.equal(countVerdict(2, 3), 'few');
  assert.equal(countVerdict(3, 3), 'right');
  assert.equal(countVerdict(5, 3), 'many');
  assert.equal(countVerdict(10, 9), 'many');
});

const table = (row) => `### Test · \`moon\`\n\n| Level | types | jump | howMany | auto | slots | rounds |\n|---|---|---|---|---|---|---|\n| 1 | ${row} |\n`;
const rowErrors = (row) => parseGame(table(row)).errors.filter((e) => e.includes('(Test'));

test('Moon schema checks ranges, listed types, flags and round count', () => {
  assert.deepEqual(rowErrors('jump | 1-3 | - | yes | yes | 3'), ['GAME.md line 5 (Test, level 1): needs a howMany round (automatic jumps do not count towards levelling)']);
  assert.deepEqual(rowErrors('jump, howMany | 1-9 | 1-9 | no | no | 8'), []);
  assert.deepEqual(rowErrors('jump, howMany | 1-3 | - | yes | yes | 3'), ['GAME.md line 5 (Test, level 1): types includes howMany, so set a howMany range']);
  assert.deepEqual(rowErrors('jump, howMany | - | 1-3 | yes | yes | 3'), ['GAME.md line 5 (Test, level 1): missing "jump"', 'GAME.md line 5 (Test, level 1): types includes jump, so set a jump range']);
  assert.deepEqual(rowErrors('howMany | 1-3 | 1-3 | yes | yes | 3'), ['GAME.md line 5 (Test, level 1): types needs jump for the easy last round']);
  assert.deepEqual(rowErrors('jump, howMany | 1-3 | 1-3 | yes | yes | 1'), ['GAME.md line 5 (Test, level 1): every kind of round comes up each time, so rounds must be at least 2']);
  for (const row of ['jump | 0-3 | - | yes | yes | 3', 'jump | 1-10 | - | yes | yes | 3', 'jump | 1.5-3 | - | yes | yes | 3',
    'jump | 3-1 | - | yes | yes | 3', 'jump, share | 1-3 | - | yes | yes | 3', 'jump | 1-3 | - | maybe | yes | 3',
    'jump | 1-3 | - | yes | - | 3', 'jump | 1-3 | - | yes | yes | 0', 'jump | 1-3 | - | yes | yes | 9']) assert.ok(rowErrors(row).length > 0, row);
});

test('a gentler Moon run turns on auto and slots without changing ranges or types', () => {
  assert.deepEqual(EASIER.moon(levels.moon[3]), {
    types: ['jump', 'howMany'], jump: [3, 7], howMany: [3, 6], auto: true, slots: true, rounds: 4,
  });
  assert.equal(levels.moon[3].auto, false);
  assert.equal(levels.moon[3].slots, false);
});

test('Moon instructions use Polish number forms and every new line reaches recording', () => {
  assert.deepEqual(T.moonJump(1), ['Skocz jeden raz!']);
  assert.deepEqual(T.moonJump(2), ['Skocz dwa razy!']);
  assert.deepEqual(T.moonJump(4), ['Skocz cztery razy!']);
  assert.deepEqual(T.moonJump(5), ['Skocz pięć razy!']);
  assert.deepEqual(T.moonJumpShort(1), ['Jeden raz!']);
  assert.deepEqual(T.moonJumpShort(9), ['Dziewięć razy!']);
  assert.deepEqual(T.moonHelp(), ['Dotknij Czejsa, to skoczy!']);
  assert.equal(HOME_TASKS.moon, 'Poszukaj z mamą Księżyca na niebie!');
  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [
    'Jesteśmy na Księżycu! Tu skacze się wysoko i powoli.', 'Dotknij Czejsa, to skoczy!',
    'Dotknij flagi, kiedy skończysz!', 'Za mało! Skacz dalej!', 'Za dużo! Teraz dobrze? Dotknij flagi!',
    'Patrz, jak skacze!', 'Ile było skoków?', 'Brawo! Ale wysoko skakaliśmy!',
    'Jeszcze raz czy lecimy dalej?', 'Poszukaj z mamą Księżyca na niebie!',
    ...Array.from({ length: 9 }, (_, i) => [...T.moonJump(i + 1), ...T.moonJumpShort(i + 1)]).flat(),
  ]) assert.ok(recorded.includes(line), line);
});
