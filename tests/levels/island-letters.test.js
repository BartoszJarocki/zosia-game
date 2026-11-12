import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGame, startLevel } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';

// The island's letter places (docs/design/g5a-*.md): GAME.md says how each level asks, and what a gentler run changes.

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, errors, starts } = parseGame(md, { childName: 'Zosia' });

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
