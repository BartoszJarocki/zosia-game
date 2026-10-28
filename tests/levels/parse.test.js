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
  assert.deepEqual(levels.lookout.map((l) => [l.mode, l.rounds]), [['pickup', 2], ['pickup', 3], ['find', 3], ['relative', 2]]); // her favourite: a few more rides
});

test('Lookout kittens: each ride a different floor, so there must be more floors than rides', () => {
  assert.match(only(parseGame(table('max | bubble | mode | rounds', '3 | both | pickup | 3'), {})).errors[0], /more floors than rounds/);
  assert.deepEqual(only(parseGame(table('max | bubble | mode | rounds', '4 | numeral | find | 3'), {})).errors, []);
  assert.match(only(parseGame(table('max | bubble | mode | rounds', '5 | numeral | pickup | 4'), {})).errors[0], /at most 3 rides/);
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
  assert.deepEqual(levels.letters[5].needs, { skill: 'letterAudio', min: 0.4 });
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

test('Name Train: four modes; older ghost/bubble tables still work; gaps checked', () => {
  const { levels } = parseGame(md, { childName: 'Zosia' });
  assert.deepEqual(levels.name.map((l) => l.mode), ['ghost', 'word', 'missing', 'highlight']);
  assert.equal(levels.name[2].gaps, 1);
  const name = (head, row) => `## Letter sets\n\n| Set | Letters |\n|---|---|\n| ALL | ABCDEFGHIJKLMNOPRSTUWZ |\n\n### Test · \`name\`\n\n| Level | ${head} |\n|${'---|'.repeat(head.split('|').length + 1)}\n| 1 | ${row} |\n`;
  assert.equal(only(parseGame(name('words | ghost | bubble | extras', 'MAMA | no | word | 1'), {})).levels.name[0].mode, 'highlight');
  const { errors } = only(parseGame(name('words | mode | gaps | extras', 'KOT, DOM | missing | 3 | 1'), {}));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /more letters/);
});

test('Cone Road: dice, counting aloud only early, "which cone has N dots?" needs dots on the signs', () => {
  const { levels } = parseGame(md, { childName: 'Zosia' });
  assert.ok(levels.cones.every((l) => l.dots === 'dice'));
  assert.deepEqual(levels.cones.map((l) => l.count), [true, true, false, false]);
  assert.equal(levels.cones[2].bubble, 'name');
  const cones = (row) => `## Letter sets\n\n| Set | Letters |\n|---|---|\n| ALL | AB |\n\n### Test · \`cones\`\n\n| Level | max | choices | bubble | sign |\n|---|---|---|---|---|\n| 1 | ${row} |\n`;
  assert.match(only(parseGame(cones('5 | 3 | name | numeral'), {})).errors[0], /signs need dots/);
  assert.match(only(parseGame(cones('5 | 3 | dots | dots'), {})).errors[0], /signs need numerals/);
  assert.equal(only(parseGame(cones('5 | 3 | both | both'), {})).levels.cones[0].count, true, 'defaults: count aloud, line dots');
});

test('River: the missing stone needs 3–9 stones', () => {
  const { levels } = parseGame(md, { childName: 'Zosia' });
  assert.ok(levels.stones.some((l) => l.bubble === 'missing'));
  const stones = (row) => `## Letter sets\n\n| Set | Letters |\n|---|---|\n| ALL | AB |\n\n### Test · \`stones\`\n\n| Level | n | bubble |\n|---|---|---|\n| 1 | ${row} |\n`;
  assert.match(only(parseGame(stones('2 | missing'), {})).errors[0], /3–9 stones/);
});
