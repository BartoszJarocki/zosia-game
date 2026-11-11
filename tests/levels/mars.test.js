import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { marsBubble, marsPool, marsSkill } from '../../src/levels/mars.js';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

test('Mars level rows parse to the specified literal settings', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.mars, [
    { max: 3, choices: 3, ask: 'both', rock: 'both', rounds: 3 },
    { max: 5, choices: 3, ask: 'both', rock: 'numeral', rounds: 3 },
    { max: 5, choices: 3, ask: 'numeral', rock: 'numeral', rounds: 3 },
    { max: 6, choices: 3, ask: 'dots', rock: 'numeral', rounds: 3 },
    { max: 9, choices: 4, ask: 'name', rock: 'numeral', rounds: 3 },
  ]);
});

test('Mars rounds ask for a numeral or an amount', () => {
  assert.deepEqual(marsBubble('both', 3), ['3', 3]);
  assert.deepEqual(marsBubble('numeral', 3), ['3', 0]);
  assert.deepEqual(marsBubble('dots', 3), ['', 3]);
  assert.deepEqual(marsBubble('name', 3), ['', 0]);
  assert.equal(marsSkill('both'), 'numeral');
  assert.equal(marsSkill('numeral'), 'numeral');
  assert.equal(marsSkill('dots'), 'quantity');
  assert.equal(marsSkill('name'), 'quantity');
  assert.deepEqual(marsPool(3), [1, 2, 3]);
  assert.deepEqual(marsPool(9), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

const table = (row) => `### Test · \`mars\`\n\n| Level | max | choices | ask | rock | rounds |\n|---|---|---|---|---|---|\n| 1 | ${row} |\n`;
const rowErrors = (row) => parseGame(table(row)).errors.filter((e) => e.includes('(Test'));

test('Mars schema checks ranges, modes and round count', () => {
  assert.deepEqual(rowErrors('3 | 3 | both | both | 3'), []);
  assert.deepEqual(rowErrors('9 | 4 | name | numeral | 8'), []);
  for (const row of ['1 | 2 | both | both | 3', '10 | 3 | both | both | 3', '3 | 1 | both | both | 3',
    '3 | 5 | both | both | 3', '3 | 3 | count | both | 3', '3 | 3 | both | dots | 3',
    '3 | 3 | both | both | 0', '3 | 3 | both | both | 9']) assert.ok(rowErrors(row).length > 0, row);
  assert.deepEqual(rowErrors('3 | 4 | both | both | 3'), ['GAME.md line 5 (Test, level 1): choices (4) can\'t be more than max (3)']);
});

test('a gentler Mars run uses one rock fewer and shows numerals with dots', () => {
  assert.deepEqual(EASIER.mars(levels.mars[4]), {
    max: 9, choices: 3, ask: 'both', rock: 'both', rounds: 3,
  });
  assert.equal(levels.mars[4].choices, 4);
  assert.equal(levels.mars[4].ask, 'name');
  assert.equal(levels.mars[4].rock, 'numeral');
});

test('Mars instructions are full Polish sentences and every new line reaches recording', () => {
  assert.deepEqual(T.marsStart(), ['Jesteśmy na Marsie! Mars jest czerwony jak rdza. Pojedziemy łazikiem!']);
  assert.deepEqual(T.marsAsk(1), ['Jedziemy do kamienia z numerem jeden!']);
  assert.deepEqual(T.marsAsk(3), ['Jedziemy do kamienia z numerem trzy!']);
  assert.deepEqual(T.marsDots(), ['Policz kropki! Do którego kamienia jedziemy?']);
  assert.deepEqual(T.marsRepeat(3), ['Gdzie jest numer trzy?']);
  assert.deepEqual(T.marsRight(), ['Brawo! Łazik dojechał!']);
  assert.deepEqual(T.marsDone(), ['Brawo! Łazik zbadał wszystkie kamienie!']);
  assert.deepEqual(T.marsFact(), ['Mars ma dwa małe księżyce.']);
  assert.equal(HOME_TASKS.mars, 'Znajdź z mamą na spacerze czerwony kamyk!');
  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [
    'Jesteśmy na Marsie! Mars jest czerwony jak rdza. Pojedziemy łazikiem!',
    'Policz kropki! Do którego kamienia jedziemy?', 'Brawo! Łazik dojechał!',
    'Brawo! Łazik zbadał wszystkie kamienie!', 'Mars ma dwa małe księżyce.',
    'Znajdź z mamą na spacerze czerwony kamyk!',
    ...Array.from({ length: 9 }, (_, i) => [`Jedziemy do kamienia z numerem ${['jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'][i]}!`,
      `Gdzie jest numer ${['jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'][i]}?`]).flat(),
  ]) assert.ok(recorded.includes(line), line);
});
