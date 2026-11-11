import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGame, startLevel } from '../../src/levels/parse.js';

// GAME.md with one three-level mission (level gateAt opens on "needs") and a "Starting levels" table
const game = (starts, { gateAt = 0 } = {}) => `## Letter sets

| Set | Letters |
|---|---|
| ALL | ABCDEFGHIJKLMNOPRSTUWZ |

## Starting levels

${starts}

### Test · \`letters\`

| Level | pool | choices | similar | needs |
|---|---|---|---|---|
${[1, 2, 3].map((n) => `| ${n} | AMTO | 3 | no | ${n === gateAt ? 'letterAudio 0.4' : '—'} |`).join('\n')}
`;
const table = (...rows) => ['| Mission | 3 | 3.5 | 4 |', '|---|---|---|---|', ...rows].join('\n');
const startErrors = (md) => parseGame(md, {}).errors.filter((e) => /Starting levels/.test(e));

test('Starting levels: one level per mission and age, looked up for any age', () => {
  const { starts, errors } = parseGame(game(table('| Test · `letters` | 1 | 2 | 3 |')), {});
  assert.deepEqual(errors.filter((e) => /Starting levels|Test/.test(e)), []);
  assert.deepEqual(starts.ages, [3, 3.5, 4]);
  assert.equal(startLevel(starts, 'letters', 3.5), 2);
  assert.equal(startLevel(starts, 'letters', 3.9), 2, 'between two columns: the younger one');
  assert.equal(startLevel(starts, 'letters', 6), 3, 'older than every column: the oldest');
  assert.equal(startLevel(starts, 'letters', 2), 1, 'younger than every column: level 1');
  assert.equal(startLevel(starts, 'letters', null), 1, 'no age: level 1');
  assert.equal(startLevel(starts, 'moon', 4), 1, 'a mission without a row: level 1');
});

test('Starting levels: the check names a missing table, a missing row, an unknown mission and a level out of range', () => {
  assert.match(parseGame(game('').replace('## Starting levels', ''), {}).errors.join('\n'), /missing the "## Starting levels" table/);
  assert.match(startErrors(game(table()))[0], /add a row for Test · `letters`/);
  assert.match(startErrors(game(table('| Test · `letters` | 1 | 2 | 3 |', '| Moon · `moooon` | 1 | 1 | 1 |')))[0], /moooon.*unknown mission/);
  assert.match(startErrors(game(table('| Test · `letters` | 1 | 2 | 4 |')))[0], /age 4 must start at level 1–3 \(got "4"\)/);
  assert.match(startErrors(game(table('| Test · `letters` | 0 | 2 | 3 |')))[0], /age 3 must start at level 1–3/);
  assert.match(startErrors(game(table('| Test · `letters` | 1 | 2 | 3 |', '| Test · `letters` | 1 | 1 | 1 |')))[0], /two rows/);
});

test('Starting levels: a start never skips a level that opens on "needs"', () => {
  const errors = startErrors(game(table('| Test · `letters` | 1 | 2 | 3 |'), { gateAt: 3 }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /age 4 must start at level 1–2 \(level 3 opens on "needs", so a start stays below it\)/);
  assert.deepEqual(startErrors(game(table('| Test · `letters` | 1 | 2 | 2 |'), { gateAt: 3 })), []);
});

test('Starting levels: ages go youngest first, and an older age never starts lower', () => {
  assert.match(startErrors(game(table('| Test · `letters` | 2 | 1 | 3 |')))[0], /an older age never starts lower \(got 2, 1, 3\)/);
  const backwards = ['| Mission | 4 | 3 |', '|---|---|---|', '| Test · `letters` | 1 | 1 |'].join('\n');
  assert.match(startErrors(game(backwards))[0], /ages, youngest first/);
});

test('GAME.md: every mission has a start for every age, and her default age starts no place at level 1', () => {
  const { levels, starts } = parseGame(readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8'), { childName: 'Zosia' });
  for (const kind of Object.keys(levels)) assert.equal(starts.levels[kind]?.length, starts.ages.length, kind);
  assert.ok(starts.ages.includes(3.5));
  assert.deepEqual(Object.keys(levels).filter((k) => startLevel(starts, k, 3.5) === 1), [], 'the review: every place started at the beginning');
});
