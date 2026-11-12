import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moonRounds } from '../../src/levels/moon.js';
import { leftNumbers, takeAway, awayChoices } from '../../src/levels/blackhole.js';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

test('Black Hole table has the four specified levels', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.blackhole, [
    { types: ['drop', 'away'], drop: [1, 3], away: [2, 3], fall: [1, 1], auto: true, slots: true, rounds: 4 },
    { types: ['drop', 'away'], drop: [1, 4], away: [3, 4], fall: [1, 2], auto: true, slots: false, rounds: 4 },
    { types: ['drop', 'away'], drop: [2, 6], away: [3, 5], fall: [1, 2], auto: false, slots: false, rounds: 4 },
    { types: ['drop', 'away'], drop: [3, 8], away: [4, 6], fall: [1, 3], auto: false, slots: false, rounds: 4 },
  ]);
});

test('every level takes away twice and ends on an automatic drop', () => {
  for (const random of [() => 0, () => 0.49, () => 0.999]) {
    for (const level of levels.blackhole) {
      const plan = moonRounds(level, random);
      assert.deepEqual(plan.map((r) => r.type), ['away', 'drop', 'away', 'drop']);
      assert.deepEqual(plan.at(-1), { type: 'drop', auto: true });
      assert.equal(plan[1].auto, level.auto);
    }
  }
});

test('taking away always leaves at least one, within the level\'s numbers', () => {
  assert.deepEqual(levels.blackhole.map(leftNumbers), [[1, 2], [1, 2, 3], [1, 2, 3, 4], [1, 2, 3, 4, 5]]);
  for (const level of levels.blackhole) for (const left of leftNumbers(level)) for (const random of [() => 0, () => 0.5, () => 0.999]) {
    const { was, fell } = takeAway(level, left, random);
    assert.equal(was - fell, left);
    assert.ok(was >= level.away[0] && was <= level.away[1], `${was} there were at ${JSON.stringify(level)}`);
    assert.ok(fell >= level.fall[0] && fell <= level.fall[1], `${fell} fell in`);
  }
  assert.deepEqual(takeAway({ away: [3, 5], fall: [1, 2] }, 1, () => 0), { was: 3, fell: 2, left: 1 }, 'one left from three: two fell');
});

test('the tiles are what is left, what there was, and a neighbour, all positive', () => {
  assert.deepEqual(awayChoices({ was: 5, left: 3 }, () => 0).sort(), [2, 3, 5]);
  assert.deepEqual(awayChoices({ was: 2, left: 1 }, () => 0).sort(), [1, 2, 3]);
  assert.deepEqual(awayChoices({ was: 4, left: 3 }, () => 0).sort(), [2, 3, 4]);
  for (const level of levels.blackhole) for (const left of leftNumbers(level)) {
    const round = takeAway(level, left, () => 0.5);
    const tiles = awayChoices(round);
    assert.equal(new Set(tiles).size, 3);
    assert.ok(tiles.includes(left) && tiles.includes(round.was) && tiles.every((n) => n >= 1));
  }
});

const rowErrors = (row) => parseGame(`### Test · \`blackhole\`\n\n| Level | types | drop | away | fall | auto | slots | rounds |\n|---|---|---|---|---|---|---|---|\n| 1 | ${row} |\n`).errors.filter((e) => e.includes('(Test'));

test('Black Hole schema requires both round types and validates ranges and flags', () => {
  assert.deepEqual(rowErrors('drop, away | 1-9 | 2-7 | 1-5 | no | no | 8'), []);
  assert.deepEqual(rowErrors('drop | 1-3 | - | - | yes | yes | 3'), ['GAME.md line 5 (Test, level 1): needs an away round (automatic drops do not count towards levelling)']);
  assert.deepEqual(rowErrors('drop, away | 1-3 | 2-3 | - | yes | yes | 3'), ['GAME.md line 5 (Test, level 1): types includes away, so set a fall range']);
  assert.deepEqual(rowErrors('away | 1-3 | 2-3 | 1-1 | yes | yes | 3'), ['GAME.md line 5 (Test, level 1): types needs drop for the easy last round']);
  assert.deepEqual(rowErrors('drop, away | 1-3 | 2-3 | 1-1 | yes | yes | 1'), ['GAME.md line 5 (Test, level 1): every kind of round comes up each time, so rounds must be at least 2']);
  assert.deepEqual(rowErrors('drop, away | 1-3 | 2-3 | 3-3 | yes | yes | 3'), ['GAME.md line 5 (Test, level 1): at least one pebble has to stay, so fall must start below the most there were (3)']);
  for (const row of ['drop, away | 0-3 | 2-3 | 1-1 | yes | yes | 3', 'drop, away | 1-10 | 2-3 | 1-1 | yes | yes | 3', 'drop, away | 1-3 | 1-3 | 1-1 | yes | yes | 3',
    'drop, away | 1-3 | 2-8 | 1-1 | yes | yes | 3', 'drop, away | 3-1 | 2-3 | 1-1 | yes | yes | 3', 'drop, howMany | 1-3 | 2-3 | 1-1 | yes | yes | 3',
    'drop, away | 1-3 | 2-3 | 1-1 | maybe | yes | 3', 'drop, away | 1-3 | 2-3 | 1-1 | yes | - | 3', 'drop, away | 1-3 | 2-3 | 1-1 | yes | yes | 9']) assert.ok(rowErrors(row).length > 0, row);
});

test('a gentler Black Hole run turns on auto and slots and takes the smallest numbers', () => {
  assert.deepEqual(EASIER.blackhole(levels.blackhole[3]), {
    types: ['drop', 'away'], drop: [3, 8], away: [4, 5], fall: [1, 2], auto: true, slots: true, rounds: 4,
  });
  const first = EASIER.blackhole(levels.blackhole[0]);
  assert.notDeepEqual(first, levels.blackhole[0], 'level 1 gets a real easier step too');
  assert.deepEqual(leftNumbers(first), [1]);
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
  assert.deepEqual([1, 2, 3, 5].map((k) => T.blackholeFell(k)[0]), ['Jeden wpadł.', 'Dwa wpadły.', 'Trzy wpadły.', 'Pięć wpadło.']);
  const lines = [
    'Patrzymy przez okno rakiety. Czarna dziura jest bardzo daleko.', 'Dotknij kamyka, to poleci!',
    'Czarna dziura świeci jak lampka!', 'Dotknij guzika, kiedy skończysz!',
    'Za mało! Wypuść jeszcze!', 'Za dużo! Policz jeszcze raz!', 'Ile zostało?',
    'Brawo! Czarna dziura świeci od twoich kamyków!',
  ];
  assert.deepEqual([T.blackholeStart, T.blackholeHelp, T.blackholeGlow, T.blackholeButton,
    T.blackholeTooFew, T.blackholeTooMany, T.blackholeLeft, T.blackholeDone].flatMap((f) => f()), lines);
  assert.equal(HOME_TASKS.blackhole, 'Policz z mamą kamyki na spacerze!');
  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [...prompts, ...short, ...lines, 'Jeden wpadł.', 'Dwa wpadły.', 'Trzy wpadły.', 'Policz z mamą kamyki na spacerze!']) {
    assert.ok(recorded.includes(line), line);
    assert.doesNotMatch(line, /zjada|połyka|znika na zawsze/i);
  }
  assert.ok(!recorded.includes('Cztery wpadły.'), 'only the falls a level uses are recorded');
});
