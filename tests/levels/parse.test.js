import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGame } from '../../src/levels/parse.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');

test('GAME.md parses without errors', () => {
  const { errors } = parseGame(md, { childName: 'Zosia' });
  assert.deepEqual(errors, []);
});

test('rounds: read from the table, short missions as in the brief', () => {
  const { levels } = parseGame(md, { childName: 'Zosia' });
  assert.ok(levels.letters.every((l) => l.rounds >= 3 && l.rounds <= 5));
  assert.ok(levels.stones.every((l) => l.rounds <= 2));
  assert.ok(levels.lookout.every((l) => l.rounds <= 2));
});

// a one-mission file: only look at that mission's errors (the rest of GAME.md is missing on purpose)
const only = ({ levels, errors }) => ({ levels, errors: errors.filter((e) => e.includes('(Test')) });
const table = (head, row) => `### Test · \`lookout\`\n\n| Level | ${head} |\n|${'---|'.repeat(head.split('|').length + 1)}\n| 1 | ${row} |\n`;

test('rounds: optional, with a per-mission default', () => {
  const { levels, errors } = only(parseGame(table('max | bubble | mode', '3 | both | go'), {}));
  assert.deepEqual(errors, []);
  assert.equal(levels.lookout[0].rounds, 1);
});

test('rounds: relative Lookout needs a normal first trip', () => {
  const { errors } = only(parseGame(table('max | bubble | mode | rounds', '5 | numeral | relative | 1'), {}));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /relative.*2 rounds/);
});

test('rounds: limits are checked', () => {
  const { errors } = only(parseGame(table('max | bubble | mode | rounds', '3 | both | go | 0'), {}));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /rounds/);
});
