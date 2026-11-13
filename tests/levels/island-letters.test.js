import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGame, startLevel, SOUNDABLE } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { WORDS, letterName } from '../../src/config.js';
import { T, LETTER_ROWS, letterRow, allSegments, PRAISE } from '../../src/lang/pl.js';

// The island's letter places (docs/design/g5a-*.md): GAME.md says how each level asks, and what a gentler run changes.

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, errors, starts, letterSets } = parseGame(md, { childName: 'Zosia' });

test('the level tables of the letter places parse', () => {
  assert.deepEqual(errors, []);
});

test('Kitty Park asks by name or by picture word on every level but the first, which is the only one that shows the letter', () => {
  assert.deepEqual(levels.letters.map((r) => r.ask), ['match', 'audio', 'word', 'audio', 'audio', 'word', 'audio', 'sound', 'word', 'word']);
  assert.ok(levels.letters.every((r) => r.ask !== 'name'), '`name` shows the letter: no level asks it');
});

test('Kitty Park: new letters come with their picture word, and the next level asks the same letters by name alone', () => {
  const rows = levels.letters;
  for (const level of [3, 6]) {
    assert.equal(rows[level - 1].ask, 'word', `level ${level} brings new letters`);
    assert.equal(rows[level].ask, 'audio', `level ${level + 1} asks them by name`);
    assert.notEqual(rows[level].pool, rows[level - 2].pool, `level ${level} has letters level ${level - 1} lacked`);
    assert.equal(rows[level].pool, rows[level - 1].pool);
  }
});

test('Kitty Park: no level repeats the one before it', () => {
  const rows = levels.letters;
  for (let i = 1; i < rows.length; i++) {
    const [a, b] = [rows[i - 1], rows[i]];
    assert.notDeepEqual({ ...a }, { ...b }, `level ${i + 1} differs from level ${i}`);
  }
});

test('Balloon Hill shows the letter on the first two levels only; the rest ask by name', () => {
  assert.deepEqual(levels.balloons.map((r) => r.ask), ['match', 'match', 'audio', 'audio', 'audio', 'audio', 'audio']);
});

test('Name Train: a missing-letters level has at least as many extra blocks as missing letters, so a guess is right half the time at most', () => {
  for (const row of levels.name.filter((r) => r.mode === 'missing')) {
    assert.ok(row.extras >= row.gaps, `${row.gaps} missing, ${row.extras} extra`);
  }
});

test('every gentler run of the letter places differs from the normal run', () => {
  for (const kind of ['letters', 'balloons', 'name', 'delivery']) {
    levels[kind].forEach((row, i) => {
      const gentler = { ...EASIER[kind]({ ...row }), assist: true }; // (settingsFor marks it: `whose` rows read the flag)
      assert.notDeepEqual(gentler, row, `${kind} level ${i + 1}: the gentler run is the normal run`);
    });
  }
});

test('a gentler run of Kitty Park and Balloon Hill shows the letter again; Name Train missing asks for one letter fewer', () => {
  assert.equal(EASIER.letters({ ...levels.letters[1] }).ask, 'name');
  assert.equal(EASIER.letters({ ...levels.letters[2] }).ask, 'name');
  assert.equal(EASIER.letters({ ...levels.letters[0] }).ask, 'match');
  for (const row of levels.balloons) assert.equal(EASIER.balloons({ ...row }).ask, 'match');
  const missing = levels.name.find((r) => r.mode === 'missing');
  const gentler = EASIER.name({ ...missing });
  assert.equal(gentler.gaps, missing.gaps - 1);
  assert.equal(gentler.mode, 'missing');
});

test('the first Pup Delivery level has a shorter gentler run, since it cannot offer fewer choices', () => {
  const one = levels.delivery[0];
  assert.equal(one.choices, 2);
  assert.ok(EASIER.delivery({ ...one }).rounds < one.rounds);
  assert.equal(EASIER.delivery({ ...levels.delivery[1] }).choices, 2);
});

test('where Kitty Park, Balloon Hill, Name Train and Pup Delivery start for each age is unchanged', () => {
  const at = (kind) => [3, 3.5, 4, 5].map((age) => startLevel(starts, kind, age));
  assert.deepEqual(at('letters'), [2, 4, 6, 7]);
  assert.deepEqual(at('balloons'), [1, 3, 5, 6]);
  assert.deepEqual(at('name'), [3, 4, 6, 8]);
  assert.deepEqual(at('delivery'), [1, 2, 4, 4]);
});

const spoken = (lines) => lines.flat().join(' ').toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
const says = (lines, token) => spoken(lines).includes(token);
const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());
const heldSound = (lines) => spoken(lines).find((t) => /^(\p{L})\1+$/u.test(t));
const rounds = (letters) => [...letters].flatMap((l) => WORDS[l].map(([w]) => [l, w]));
const holdable = [...letterSets.ALL].filter((l) => letterRow('sound', l) === LETTER_ROWS.sound);

test('Pup Delivery asked by the letter name: "na literę Es", the clue is "Es jak samolot", the praise is the word', () => {
  for (const [l, w] of rounds(letterSets.ALL)) {
    const row = letterRow('name', l);
    assert.deepEqual(row.ask(l, w), [`Co zaczyna się na literę ${cap(letterName(l))}?`], l);
    assert.deepEqual(row.hint(l, w), [`${cap(letterName(l))} jak ${w}!`], `${l}: the clue names the letter and the word`);
    assert.deepEqual(row.praise(l, w), ['Tak!', `${cap(w)}!`], `${l}: the praise is the word she found`);
  }
});

test('Pup Delivery asked by the held sound: no letter name and no extra vowel in the question, the clue or the praise', () => {
  assert.deepEqual([...holdable].sort(), [...SOUNDABLE].sort(), 'the letters with a held sound are the ones GAME.md allows for sound rows');
  for (const [l, w] of rounds(holdable)) {
    const row = letterRow('sound', l);
    const lines = { ask: row.ask(l, w), hint: row.hint(l, w), praise: row.praise(l, w) };
    for (const [what, segments] of Object.entries(lines)) assert.ok(!says(segments, letterName(l).toLowerCase()), `${l} ${what}: "${segments.join(' ')}" says the letter name`);
    const sound = heldSound(lines.ask);
    assert.ok(sound?.startsWith(l.toLowerCase()), `${l}: the question holds the sound, "${lines.ask}"`);
    assert.ok(!says(lines.ask, 'literę'), `${l}: a sound question does not speak of the letter`);
    assert.ok(says(lines.hint, sound), `${l}: the clue holds the same sound`);
  }
});

test('Pup Delivery at the mailboxes asks for the word, and names the letter in the clue and the praise', () => {
  for (const [l, w] of rounds(letterSets.ALL)) {
    const row = letterRow('written', l);
    assert.deepEqual(row.ask(l, w), [`Do której skrzynki pójdzie ${w}?`]);
    assert.ok(!says(row.ask(l, w), letterName(l).toLowerCase()), `${l}: the question does not name the letter`);
    assert.deepEqual(row.hint(l, w), [`${cap(letterName(l))} jak ${w}!`]);
    const praise = row.praise(l, w);
    assert.ok(PRAISE.includes(praise[0]), `${l}: a cheer first`);
    assert.deepEqual(praise.slice(1), [`${cap(letterName(l))} jak ${w}!`], `${l}: then the letter and the word`);
  }
});

test('a letter with no sound to hold is asked by its name whole, never half by name and half by sound', () => {
  for (const l of [...letterSets.ALL].filter((c) => !holdable.includes(c))) assert.equal(letterRow('sound', l), LETTER_ROWS.name, l);
  assert.equal(letterRow('sound', 'S'), LETTER_ROWS.sound);
  assert.equal(letterRow('name', 'S'), LETTER_ROWS.name);
  assert.equal(letterRow('written', 'S'), LETTER_ROWS.written);
});

test('Kitty Park level 8 still asks by the sound alone: no letter name and no extra vowel', () => {
  assert.equal(levels.letters[7].ask, 'sound');
  for (const l of levels.letters[7].pool) {
    const ask = T.whichSound(l);
    assert.ok(!says(ask, letterName(l).toLowerCase()), `${l}: "${ask}"`);
    assert.ok(heldSound(ask)?.startsWith(l.toLowerCase()), `${l}: the question holds the held sound`);
  }
});

test('the voice list holds what Pup Delivery says now, and not the old question that mixed the name with a sound', () => {
  const lines = new Set(allSegments(levels, letterSets.ALL));
  for (const [l, w] of rounds(letterSets.ALL)) {
    assert.ok(lines.has(`Co zaczyna się na literę ${cap(letterName(l))}?`), `the question for ${l}`);
    assert.ok(lines.has(`${cap(w)}!`), `the praise for ${w}`);
    assert.ok(!lines.has(`Co zaczyna się na ${cap(letterName(l))}?`), `the old question for ${l}`);
  }
  assert.ok(lines.has('Co zaczyna się na literę Es?') && lines.has('Samolot!') && lines.has('Tak!'));
});
