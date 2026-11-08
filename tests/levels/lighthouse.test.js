import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lighthousePlan, flashRound, lighthouseChoices } from '../../src/levels/lighthouse.js';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

test('Lighthouse level rows parse to the specified literal settings', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.lighthouse, [
    { mode: 'marks', numbers: [1, 3], choices: 2, rounds: 4 },
    { mode: 'flashes', numbers: [1, 4], choices: 3, rounds: 4 },
    { mode: 'make', numbers: [2, 5], choices: 2, rounds: 3 },
    { mode: 'more', numbers: [1, 4], choices: 2, rounds: 3 },
  ]);
});

test('the plan repeats the level mode and the target adds one for more', () => {
  assert.deepEqual(lighthousePlan('marks', 4), ['marks', 'marks', 'marks', 'marks']);
  assert.deepEqual(lighthousePlan('more', 3), ['more', 'more', 'more']);
  assert.deepEqual(flashRound('marks', 3), { flashes: 3, target: 3 });
  assert.deepEqual(flashRound('flashes', 4), { flashes: 4, target: 4 });
  assert.deepEqual(flashRound('make', 5), { flashes: 5, target: 5 });
  assert.deepEqual(flashRound('more', 1), { flashes: 1, target: 2 });
  assert.deepEqual(flashRound('more', 4), { flashes: 4, target: 5 });
});

test('numeral choices keep the answer and bring its neighbours', () => {
  for (const [target, max, count] of [[1, 4, 2], [2, 5, 3], [3, 4, 2], [5, 6, 4]]) {
    const choices = lighthouseChoices(target, max, count);
    assert.equal(choices.length, count);
    assert.ok(choices.includes(target));
    assert.equal(new Set(choices).size, count);
  }
  assert.deepEqual(lighthouseChoices(1, 4, 2).sort(), [1, 2]);
  assert.deepEqual(lighthouseChoices(2, 5, 3).sort(), [1, 2, 3]);
});

const table = (row) => `### Test · \`lighthouse\`\n\n| Level | mode | numbers | choices | rounds |\n|---|---|---|---|---|\n| 1 | ${row} |\n`;
const rowErrors = (row) => parseGame(table(row)).errors.filter((e) => e.includes('(Test'));

test('Lighthouse schema checks the mode, ranges, choices and rounds', () => {
  assert.deepEqual(rowErrors('marks | 1-3 | 2 | 4'), []);
  assert.deepEqual(rowErrors('make | 2-5 | - | 3'), []);
  assert.deepEqual(rowErrors('marks | 1-4 | 2 | 4'), ['GAME.md line 5 (Test, level 1): marks counts up to 3 (got 4)']);
  assert.deepEqual(rowErrors('more | 1-5 | - | 3'), ['GAME.md line 5 (Test, level 1): more counts up to 4 (got 5)']);
  assert.deepEqual(rowErrors('make | 1-5 | - | 3'), ['GAME.md line 5 (Test, level 1): "make" starts from 2 (a boat\'s sail shows the count)']);
  for (const row of ['marks | 1-3 | 1 | 4', 'marks | 1-3 | 2 | 2', 'marks | 1-3 | 2 | 6',
    'marks | 0-3 | 2 | 4', 'marks | 1-6 | 2 | 4', 'sideways | 1-3 | 2 | 4', 'marks | 3-1 | 2 | 4']) {
    assert.ok(rowErrors(row).length > 0, row);
  }
});

test('a gentler Lighthouse run uses smaller numbers and one buoy fewer', () => {
  assert.deepEqual(EASIER.lighthouse(levels.lighthouse[1]), {
    mode: 'flashes', numbers: [1, 3], choices: 2, rounds: 4,
  });
  assert.deepEqual(EASIER.lighthouse(levels.lighthouse[3]), {
    mode: 'more', numbers: [1, 3], choices: 2, rounds: 3,
  });
  assert.deepEqual(levels.lighthouse[1], { mode: 'flashes', numbers: [1, 4], choices: 3, rounds: 4 });
});

test('Lighthouse instructions are full sentences and every line reaches recording', () => {
  assert.deepEqual(T.lighthouseMake(1), ['Mrugnij jeden raz!']);
  assert.deepEqual(T.lighthouseMake(2), ['Mrugnij dwa razy!']);
  assert.deepEqual(T.lighthouseMake(5), ['Mrugnij pięć razy!']);
  assert.equal(HOME_TASKS.lighthouse, 'Policz z mamą, ile razy klaśniesz!');
  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [
    'Robi się wieczór. Łódki wracają do domu.',
    'Latarnia świeci w nocy, żeby łódki trafiły do domu.',
    'Każda latarnia mruga po swojemu.',
    'Ile razy mrugnęła latarnia?',
    'Mrugnij o jeden raz więcej!',
    'Gotowe? Dotknij łódki!',
    'Łódka bezpiecznie wróciła do domu!',
    'Za mało! Policz jeszcze raz!',
    'Za dużo! Policz jeszcze raz!',
    'Dotknij latarni i policz mrugnięcia!',
    'Brawo! Wszystkie łódki są w domu!',
    ...Array.from({ length: 5 }, (_, i) => T.lighthouseMake(i + 1)).flat(),
    HOME_TASKS.lighthouse,
  ]) assert.ok(recorded.includes(line), line);
});
