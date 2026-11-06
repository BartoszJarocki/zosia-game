import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moonRounds } from '../../src/levels/moon.js';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

test('Black Hole table has the four specified levels', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.blackhole, [
    { types: ['drop', 'howMany'], drop: [1, 3], howMany: [1, 3], auto: true, slots: true, rounds: 3 },
    { types: ['drop', 'howMany'], drop: [1, 4], howMany: [1, 4], auto: true, slots: false, rounds: 3 },
    { types: ['drop', 'howMany'], drop: [2, 6], howMany: [2, 5], auto: false, slots: false, rounds: 4 },
    { types: ['drop', 'howMany'], drop: [3, 8], howMany: [3, 7], auto: false, slots: false, rounds: 4 },
  ]);
});

test('shared Moon rules alternate drops and quantities, with an automatic last drop', () => {
  for (const random of [() => 0, () => 0.49, () => 0.999]) {
    for (const level of levels.blackhole.slice(0, 2)) assert.deepEqual(moonRounds(level, random), [
      { type: 'drop', auto: true }, { type: 'howMany', auto: false }, { type: 'drop', auto: true },
    ]);
    for (const level of levels.blackhole.slice(2)) assert.deepEqual(moonRounds(level, random), [
      { type: 'howMany', auto: false }, { type: 'drop', auto: false },
      { type: 'howMany', auto: false }, { type: 'drop', auto: true },
    ]);
  }
  assert.deepEqual(moonRounds({ types: ['drop'], rounds: 1, auto: false }), [{ type: 'drop', auto: true }]);
});

const rowErrors = (row) => parseGame(`### Test · \`blackhole\`\n\n| Level | types | drop | howMany | auto | slots | rounds |\n|---|---|---|---|---|---|---|\n| 1 | ${row} |\n`).errors.filter((e) => e.includes('(Test'));

test('Black Hole schema requires both round types and validates ranges and flags', () => {
  assert.deepEqual(rowErrors('drop | 1-3 | - | yes | yes | 3'), ['GAME.md line 5 (Test, level 1): needs a howMany round (automatic drops do not count towards levelling)']);
  assert.deepEqual(rowErrors('drop, howMany | 1-9 | 1-9 | no | no | 8'), []);
  assert.deepEqual(rowErrors('drop, howMany | 1-3 | - | yes | yes | 3'), ['GAME.md line 5 (Test, level 1): types includes howMany, so set a howMany range']);
  assert.deepEqual(rowErrors('howMany | 1-3 | 1-3 | yes | yes | 3'), ['GAME.md line 5 (Test, level 1): types needs drop for the easy last round']);
  assert.deepEqual(rowErrors('drop, howMany | 1-3 | 1-3 | yes | yes | 1'), ['GAME.md line 5 (Test, level 1): every kind of round comes up each time, so rounds must be at least 2']);
  for (const row of ['drop | 0-3 | - | yes | yes | 3', 'drop | 1-10 | - | yes | yes | 3', 'drop | 1.5-3 | - | yes | yes | 3',
    'drop | 3-1 | - | yes | yes | 3', 'jump, howMany | 1-3 | 1-3 | yes | yes | 3', 'drop | 1-3 | - | maybe | yes | 3',
    'drop | 1-3 | - | yes | - | 3', 'drop | 1-3 | - | yes | yes | 0', 'drop | 1-3 | - | yes | yes | 9']) assert.ok(rowErrors(row).length > 0, row);
});

test('a gentler Black Hole run keeps its numbers and enables auto and slots', () => {
  assert.deepEqual(EASIER.blackhole(levels.blackhole[3]), {
    types: ['drop', 'howMany'], drop: [3, 8], howMany: [3, 7], auto: true, slots: true, rounds: 4,
  });
  assert.equal(levels.blackhole[3].auto, false);
  assert.equal(levels.blackhole[3].slots, false);
});

test('pebble forms from 1 to 10 and every sentence reach the voice list', () => {
  const prompts = [
    'Wypuść jeden kamyk!', 'Wypuść dwa kamyki!', 'Wypuść trzy kamyki!', 'Wypuść cztery kamyki!',
    'Wypuść pięć kamyków!', 'Wypuść sześć kamyków!', 'Wypuść siedem kamyków!', 'Wypuść osiem kamyków!',
    'Wypuść dziewięć kamyków!', 'Wypuść dziesięć kamyków!',
  ];
  const short = [
    'Jeden kamyk!', 'Dwa kamyki!', 'Trzy kamyki!', 'Cztery kamyki!', 'Pięć kamyków!',
    'Sześć kamyków!', 'Siedem kamyków!', 'Osiem kamyków!', 'Dziewięć kamyków!', 'Dziesięć kamyków!',
  ];
  prompts.forEach((line, i) => assert.deepEqual(T.blackholeDrop(i + 1), [line]));
  short.forEach((line, i) => assert.deepEqual(T.blackholeDropShort(i + 1), [line]));
  const lines = [
    'Patrzymy przez okno rakiety. Czarna dziura jest bardzo daleko.', 'Dotknij kamyka, to poleci!',
    'Czarna dziura świeci jak lampka!', 'Dotknij guzika, kiedy skończysz!',
    'Za mało! Wypuść jeszcze!', 'Za dużo! Teraz dobrze? Dotknij guzika!', 'Patrz, jak lecą!',
    'Ile kamyków wpadło?', 'Brawo! Czarna dziura świeci od twoich kamyków!',
  ];
  assert.deepEqual([T.blackholeStart, T.blackholeHelp, T.blackholeGlow, T.blackholeButton,
    T.blackholeTooFew, T.blackholeTooMany, T.blackholeWatch, T.blackholeHowMany, T.blackholeDone].flatMap((f) => f()), lines);
  assert.equal(HOME_TASKS.blackhole, 'Policz z mamą kamyki na spacerze!');
  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [...prompts, ...short, ...lines, 'Policz z mamą kamyki na spacerze!']) {
    assert.ok(recorded.includes(line), line);
    assert.doesNotMatch(line, /zjada|połyka|znika na zawsze/i);
  }
});
