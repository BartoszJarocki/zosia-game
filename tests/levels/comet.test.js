import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cometLetters, cometPlan } from '../../src/levels/comet.js';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { isLookalike } from '../../src/levels/lookalikes.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

test('Comet level rows parse to the specified literal settings', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.comet, [
    { pool: letterSets.START, targets: 2, total: 4, speed: [0.25, 0.4], similar: false, rounds: 3 },
    { pool: letterSets.MORE, targets: 2, total: 5, speed: [0.25, 0.4], similar: false, rounds: 3 },
    { pool: letterSets.MORE, targets: 3, total: 6, speed: [0.3, 0.5], similar: false, rounds: 2 },
    { pool: letterSets.ALL, targets: 3, total: 6, speed: [0.3, 0.5], similar: true, rounds: 2 },
  ]);
});

test('a comet round has the targets plus the wrong letters from the pool', () => {
  const letters = cometLetters(levels.comet[0], 'A', letterSets.START, () => 0);
  assert.equal(letters.length, 4);
  assert.equal(letters.filter((l) => l === 'A').length, 2);
  assert.ok(letters.every((l) => letterSets.START.includes(l)));
});

test('lookalikes only join a round when the level asks for them', () => {
  const plain = cometLetters(levels.comet[2], 'A', letterSets.ALL, () => 0);
  const tricky = cometLetters(levels.comet[3], 'A', letterSets.ALL, () => 0);
  assert.ok(plain.filter((l) => l !== 'A').every((l) => !isLookalike('A', l)));
  assert.ok(tricky.filter((l) => l !== 'A').some((l) => isLookalike('A', l)));
});

test('cometPlan fills five lanes and picks a speed and start inside the level range', () => {
  const plan = cometPlan({ speed: [0.25, 0.4], total: 6 }, () => 0);
  assert.deepEqual(plan.laneOf, [1, 2, 3, 4, 0, 1]);
  assert.deepEqual(plan.speeds, [0.25, 0.25, 0.25, 0.25, 0.25]);
  assert.deepEqual(plan.starts, [0, 0, 0, 0, 0]);
  const late = cometPlan({ speed: [0.3, 0.5], total: 4 }, () => 0.999);
  assert.deepEqual(late.laneOf, [0, 1, 2, 3]);
  assert.ok(late.speeds.every((v) => v > 0.49 && v <= 0.5));
  assert.ok(late.starts.every((v) => v > 0.99));
});

const table = (row) => `### Test · \`comet\`\n\n| Level | pool | targets | total | speed | similar | rounds |\n|---|---|---|---|---|---|---|\n| 1 | ${row} |\n`;
const rowErrors = (row) => parseGame(table(row)).errors.filter((e) => e.includes('(Test'));

test('Comet schema checks ranges, letter pool and round count', () => {
  assert.deepEqual(rowErrors('START | 2 | 4 | 0.25-0.4 | no | 3'), []);
  assert.deepEqual(rowErrors('START | 4 | 4 | 0.25-0.4 | no | 3'), ['GAME.md line 5 (Test, level 1): targets (4) must be fewer than total (4)']);
  assert.deepEqual(rowErrors('A | 2 | 4 | 0.25-0.4 | no | 3'), ['GAME.md line 5 (Test, level 1): pool needs at least 2 letters (got "A")']);
  for (const row of ['START | 0 | 4 | 0.25-0.4 | no | 3', 'START | 2 | 2 | 0.25-0.4 | no | 3',
    'START | 2 | 10 | 0.25-0.4 | no | 3', 'START | 2 | 4 | 0.05-0.4 | no | 3',
    'START | 2 | 4 | 0.4-0.25 | no | 3', 'START | 2 | 4 | 0.25-0.4 | maybe | 3',
    'START | 2 | 4 | 0.25-0.4 | no | 0', 'START | 2 | 4 | 0.25-0.4 | no | 9']) {
    assert.ok(rowErrors(row).length > 0, row);
  }
});

test('a gentler comet run has two fewer comets, slower, without lookalikes', () => {
  const easy = EASIER.comet(levels.comet[3]);
  assert.deepEqual({ ...easy, speed: easy.speed.map((v) => +v.toFixed(2)) }, {
    ...levels.comet[3], total: 4, speed: [0.21, 0.35], similar: false,
  });
  assert.equal(levels.comet[3].total, 6);
  assert.equal(levels.comet[3].similar, true);
});

test('Comet lines are whole Polish sentences and every new line reaches recording', () => {
  assert.deepEqual(T.cometStart(), ['Komety lecą! Kometa to kula lodu i pyłu.']);
  assert.deepEqual(T.cometAsk('A'), ['Złap komety z literą A!']);
  assert.deepEqual(T.cometRoundDone(), ['Mamy wszystkie!']);
  assert.deepEqual(T.cometDone(), ['Brawo! Złapałaś wszystkie komety!']);
  assert.deepEqual(T.cometFact(), ['Ogon komety rośnie blisko Słońca.']);
  assert.equal(HOME_TASKS.comet, 'Narysuj z mamą kometę z długim ogonem!');
  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [
    'Komety lecą! Kometa to kula lodu i pyłu.', 'Złap komety z literą A!', 'Mamy wszystkie!',
    'Brawo! Złapałaś wszystkie komety!', 'Ogon komety rośnie blisko Słońca.',
    'Narysuj z mamą kometę z długim ogonem!',
  ]) assert.ok(recorded.includes(line), line);
});
