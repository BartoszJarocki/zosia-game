import test from 'node:test';
import assert from 'node:assert/strict';
import { pickWord, gapsFor, pickExtras, whoseOrder, whoseTrains } from '../../src/levels/train.js';

const zero = () => 0;
/** A small seeded rng, so long runs are repeatable. */
const seeded = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const FAMILY = ['ZOSIA', 'MAMA', 'TATA', 'KOT', 'DOM', 'KASIA', 'BARTEK', 'RYSIEK', 'JUREK', 'BERNADKA', 'MIA', 'LAURA', 'JAGODA'];

test('pickWord: her own name first, never the same word twice in a row', () => {
  assert.equal(pickWord(['MAMA', 'ZOSIA', 'TATA'], { name: 'ZOSIA' }), 'ZOSIA');
  assert.equal(pickWord(['ZOSIA', 'MAMA', 'TATA'], { name: 'ZOSIA', last: 'ZOSIA', rng: zero }), 'MAMA');
  assert.equal(pickWord(['ZOSIA'], { name: 'ZOSIA', last: 'ZOSIA' }), 'ZOSIA', 'a one-word level just repeats');
  const rng = seeded(7);
  let last = null, hers = 0, repeats = 0;
  for (let i = 0; i < 3000; i++) {
    const w = pickWord(FAMILY, { name: 'ZOSIA', last, rng });
    if (w === last) repeats++;
    if (w === 'ZOSIA') hers++;
    last = w;
  }
  assert.equal(repeats, 0);
  assert.ok(hers / 3000 > 0.3 && hers / 3000 < 0.37, `her name in about a third of runs among 13 words (got ${hers / 3000})`);
});

test('gapsFor: two gaps, spread out; long words get a third; a letter always stays', () => {
  assert.deepEqual(gapsFor('ZOSIA', 2, zero), [0, 2]); // _ O _ I A
  assert.equal(gapsFor('BERNADKA', 2, zero).length, 3);
  assert.deepEqual(gapsFor('KOT', 2, zero), [0, 2]); // _ O _
  assert.deepEqual(gapsFor('MIA', 3, zero), [0, 2]);
  assert.deepEqual(gapsFor('MAMA', 3, zero), [0, 1, 2], 'too many to keep apart: still three, one letter left');
  const rng = seeded(3);
  for (let i = 0; i < 200; i++) {
    const g = gapsFor('JAGODA', 2, rng);
    assert.equal(g.length, 2);
    assert.ok(g[1] - g[0] > 1, `not side by side: ${g}`);
  }
});

test('pickExtras: no lookalike of any letter in the word, unless lookalikes are wanted', () => {
  const isLookalike = (a, b) => (a === 'I' && b === 'J') || (a === 'J' && b === 'I');
  assert.deepEqual(pickExtras('ZOSIA', 2, { pool: 'JMTZ', isLookalike, rng: zero }), ['M', 'T']);
  assert.deepEqual(pickExtras('ZOSIA', 2, { pool: 'JMTZ', similar: true, isLookalike, rng: zero }), ['J', 'M']);
  assert.deepEqual(pickExtras('RYSIEK', 3, { pool: 'RSJ', isLookalike, rng: zero }), [], 'Y is never an extra, J looks like I');
});

test('whoseOrder: her own name first, then mama or tata, then a family name', () => {
  const home = { ZOSIA: 'Zosi', MAMA: 'mamy', TATA: 'taty' };
  assert.deepEqual(whoseOrder(home, { name: 'ZOSIA', rounds: 3, rng: zero }), ['ZOSIA', 'TATA', 'MAMA']);
  const family = { ...home, KASIA: 'Kasi', BARTEK: 'Bartka' };
  assert.deepEqual(whoseOrder(family, { name: 'ZOSIA', rounds: 3, rng: zero }), ['ZOSIA', 'TATA', 'BARTEK']);
});

test('whoseTrains: the asked train and two others, all different', () => {
  const trains = whoseTrains(FAMILY, 'MAMA', 2, seeded(11));
  assert.equal(trains.length, 3);
  assert.ok(trains.includes('MAMA'));
  assert.equal(new Set(trains).size, 3);
  assert.deepEqual(whoseTrains(['ZOSIA', 'MAMA', 'TATA'], 'ZOSIA', 2, zero).sort(), ['MAMA', 'TATA', 'ZOSIA']);
});
