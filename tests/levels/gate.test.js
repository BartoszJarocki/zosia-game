import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNeeds, gateItems, meetsNeeds } from '../../src/levels/gate.js';

test('parseNeeds', () => {
  assert.deepEqual(parseNeeds('letterAudio 0.6'), { skill: 'letterAudio', min: 0.6 });
  assert.equal(parseNeeds('—'), null);
  assert.equal(parseNeeds(''), null);
  assert.throws(() => parseNeeds('letterAudio'), /letterAudio 0.6/);
  assert.throws(() => parseNeeds('reading 0.5'), /unknown skill/);
  assert.throws(() => parseNeeds('letterAudio 2'), /0–1/);
});

test('gateItems per mission', () => {
  assert.deepEqual(gateItems('letters', { pool: 'AMOA' }), ['A', 'M', 'O']);
  assert.deepEqual(gateItems('cones', { max: 3 }), ['1', '2', '3']);
  assert.deepEqual(gateItems('stones', { n: 2 }), ['1', '2']);
  assert.deepEqual(gateItems('counting', { give: [2, 4] }), ['2', '3', '4']);
  assert.deepEqual(gateItems('name', { words: ['MAMA', 'TATA'] }), ['M', 'A', 'T']);
});

test('meetsNeeds: average mastery over the level\'s items (unseen count as 0)', () => {
  const row = { pool: 'MS', needs: { skill: 'letterAudio', min: 0.6 } };
  assert.equal(meetsNeeds({}, 'letters', row), false);
  assert.equal(meetsNeeds({ letterAudio: { M: { mastery: 0.9 } } }, 'letters', row), false, 'S not known yet: (0.9 + 0) / 2');
  assert.equal(meetsNeeds({ letterAudio: { M: { mastery: 0.9 }, S: { mastery: 0.4 } } }, 'letters', row), true);
  assert.equal(meetsNeeds({}, 'letters', { pool: 'MS' }), true, 'no gate');
});
