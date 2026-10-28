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

test('meetsNeeds: average mastery over the level\'s items she was asked, once she was asked half of them', () => {
  const row = { pool: 'MSAOZ', needs: { skill: 'letterAudio', min: 0.6 } };
  const asked = (mastery) => ({ attempts: 4, mastery });
  assert.equal(meetsNeeds({}, 'letters', row), false, 'nothing asked yet');
  assert.equal(meetsNeeds({ letterAudio: { M: asked(0.9), S: asked(0.9) } }, 'letters', row), false, '2 of 5 asked: not enough to go on');
  assert.equal(meetsNeeds({ letterAudio: { M: asked(0.9), S: asked(0.7), A: asked(0.3) } }, 'letters', row), true, '3 of 5 asked: (0.9 + 0.7 + 0.3) / 3 = 0.63; O and Z never met');
  assert.equal(meetsNeeds({ letterAudio: { M: asked(0.9), S: asked(0.5), A: asked(0.3) } }, 'letters', row), false, '(0.9 + 0.5 + 0.3) / 3 = 0.57');
  assert.equal(meetsNeeds({ letterAudio: { M: asked(0.9), S: asked(0.9), A: { attempts: 0, mastery: 0, wrong: 3 } } }, 'letters', row), false, 'A was never solved (she left): it does not count as asked');
  assert.equal(meetsNeeds({}, 'letters', { pool: 'MS' }), true, 'no gate');
});
