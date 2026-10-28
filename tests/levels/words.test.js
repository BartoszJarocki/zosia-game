import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGame } from '../../src/levels/parse.js';
import { WORDS, LETTER_NAMES } from '../../src/config.js';
import { T, allSegments } from '../../src/lang/pl.js';

const { levels, letterSets } = parseGame(readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8'), { childName: 'Zosia' });
const VOWELS = 'aąeęioóuy';

test('picture words: every letter has one, starting with its sound and then a vowel', () => {
  for (const l of letterSets.ALL) {
    assert.ok(WORDS[l]?.length, `${l} has no picture word`);
    for (const [w, pic] of WORDS[l]) {
      const s = w.toLowerCase();
      assert.equal(s[0], l.toLowerCase(), `${w} does not start with ${l}`);
      if (!VOWELS.includes(s[0])) assert.ok(VOWELS.includes(s[1]), `${w} starts with two consonants`);
      assert.ok(pic, `${w} has no picture`);
    }
  }
});

test('picture words: none starts with another letter\'s name (elf sounds like "el")', () => {
  const names = Object.entries(LETTER_NAMES).map(([k, n]) => [k, n.toLowerCase()]).filter(([, n]) => n.length > 1);
  for (const [l, words] of Object.entries(WORDS)) for (const [w] of words) {
    const clash = names.find(([k, n]) => k !== l && w.toLowerCase().startsWith(n));
    assert.equal(clash, undefined, `${w} (${l}) starts like the letter name "${clash?.[1]}"`);
  }
});

test('lines: the letter\'s own word, her name for her letter, and Delivery\'s word of the round', () => {
  assert.deepEqual(T.letterLike('B'), ['Be jak banan!']);
  assert.deepEqual(T.letterLike('Z'), ['Zet jak Zosia!']);
  assert.deepEqual(T.letterLike('K', 'kaczka'), ['Ka jak kaczka!']);
  assert.deepEqual(T.whichBox('kaczka'), ['Do której skrzynki pójdzie kaczka?']);
});

test('voice lines: Delivery needs every picture word of its letters, and never her name as a picture', () => {
  const lines = allSegments(levels, letterSets.ALL);
  assert.ok(lines.includes('Do której skrzynki pójdzie zebra?'));
  assert.ok(lines.includes('Do której skrzynki pójdzie zamek?'));
  assert.ok(lines.includes('Zet jak zamek!'));
  assert.ok(!lines.includes('Do której skrzynki pójdzie Zosia?'));
});
