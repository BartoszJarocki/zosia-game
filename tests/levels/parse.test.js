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

const lettersTable = (head, row) => `## Letter sets\n\n| Set | Letters |\n|---|---|\n| ALL | ABCDEFGHIJKLMNOPRSTUWZ |\n\n### Test · \`letters\`\n\n| Level | ${head} |\n|${'---|'.repeat(head.split('|').length + 1)}\n| 1 | ${row} |\n`;

test('Kitty Park: six levels, each asking a different way; level 6 is gated on mastery', () => {
  const { levels } = parseGame(md, { childName: 'Zosia' });
  assert.deepEqual(levels.letters.map((l) => l.ask), ['match', 'name', 'audio', 'name', 'word', 'sound']);
  assert.deepEqual(levels.letters[5].needs, { skill: 'letterAudio', min: 0.6 });
  assert.equal(levels.letters[3].similar, true);
});

test('Kitty Park: older tables with "show" still work', () => {
  const { levels, errors } = only(parseGame(lettersTable('pool | choices | show | similar', 'ALL | 3 | picture | no'), {}));
  assert.deepEqual(errors, []);
  assert.equal(levels.letters[0].ask, 'word');
});

test('Kitty Park: "sound" only with letters you can hold', () => {
  const { errors } = only(parseGame(lettersTable('pool | choices | ask | similar', 'MSBT | 3 | sound | no'), {}));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /not BT/);
});

test('needs: a broken gate is explained', () => {
  const { errors } = only(parseGame(lettersTable('pool | choices | ask | similar | needs', 'ALL | 3 | name | no | reading 2'), {}));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /needs/);
});
