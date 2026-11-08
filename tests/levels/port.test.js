import test from 'node:test';
import assert from 'node:assert/strict';
import { BOATS, boatFor, countOf, namesIn, whichBoats } from '../../src/levels/port.js';

const zero = () => 0;

test('the port boats and their syllables are data', () => {
  assert.deepEqual(BOATS.map((b) => [b.word, b.syllables]), [
    ['KOT', ['KOT']],
    ['SŁOŃ', ['SŁOŃ']],
    ['MEWA', ['ME', 'WA']],
    ['FOKA', ['FO', 'KA']],
    ['RYBKA', ['RYB', 'KA']],
    ['KACZKA', ['KACZ', 'KA']],
    ['ŻYRAFA', ['ŻY', 'RA', 'FA']],
    ['MOTYLEK', ['MO', 'TY', 'LEK']],
    ['BIEDRONKA', ['BIE', 'DRON', 'KA']],
  ]);
});

test('every syllable list spells its word, and lookups agree', () => {
  for (const boat of BOATS) {
    assert.equal(boat.syllables.join(''), boat.word);
    assert.equal(countOf(boat.word), boat.syllables.length);
    assert.equal(boatFor(boat.word), boat);
  }
});

test('a level range keeps to its syllable counts', () => {
  assert.deepEqual(namesIn([1, 2]), ['KOT', 'SŁOŃ', 'MEWA', 'FOKA', 'RYBKA', 'KACZKA']);
  assert.deepEqual(namesIn([3, 3]), ['ŻYRAFA', 'MOTYLEK', 'BIEDRONKA']);
  assert.deepEqual(namesIn([1, 3]), BOATS.map((b) => b.word));
});

test('which gives three boats with one, two and three syllables, the asked one included', () => {
  const boats = whichBoats(2, [1, 3], zero);
  assert.equal(boats.length, 3);
  assert.deepEqual(boats.map((b) => b.syllables.length).sort(), [1, 2, 3]);
  assert.ok(boats.some((b) => b.syllables.length === 2));
  assert.ok(boats.every((b) => BOATS.includes(b)));
});
