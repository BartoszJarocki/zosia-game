import test from 'node:test';
import assert from 'node:assert/strict';
import { venusRounds, venusChoices, venusPiece } from '../../src/levels/venus.js';

const zero = () => 0;

test('venus rounds use every shape before repeating and never repeat one next to itself', () => {
  assert.deepEqual(venusRounds(3, zero), ['square', 'triangle', 'circle']);
  assert.deepEqual(venusRounds(6, zero), ['square', 'triangle', 'circle', 'square', 'triangle', 'circle']);
  for (let i = 0; i < 50; i++) {
    const plan = venusRounds(6);
    assert.equal(plan.length, 6);
    assert.deepEqual([...plan.slice(0, 3)].sort(), ['circle', 'square', 'triangle']);
    plan.forEach((shape, at) => assert.notEqual(shape, plan[at - 1], `repeat at ${at}`));
  }
});

test('venus choices always include the answer, the asked count and no duplicates', () => {
  assert.deepEqual(venusChoices('circle', 2, zero), ['triangle', 'circle']);
  assert.deepEqual(venusChoices('square', 3, zero), ['triangle', 'circle', 'square']);
  for (const target of ['circle', 'square', 'triangle']) {
    const two = venusChoices(target, 2);
    assert.equal(two.length, 2);
    assert.ok(two.includes(target));
    assert.equal(new Set(two).size, 2);
    assert.deepEqual([...venusChoices(target, 3)].sort(), ['circle', 'square', 'triangle']);
  }
});

test('venus pieces are textbook or the Garage turned pieces', () => {
  assert.deepEqual(venusPiece('circle', false, zero), { shape: 'circle', colour: 'green', turn: 0, size: 1, odd: null });
  const square = venusPiece('square', true, zero);
  assert.equal(square.turn, Math.PI / 4);
  assert.equal(square.size, 0.8);
  assert.equal(square.odd, null);
  const triangle = venusPiece('triangle', true, zero);
  assert.ok(['right', 'flat', 'tall'].includes(triangle.odd));
  assert.ok([Math.PI, Math.PI / 2, -Math.PI / 2, 0.5].includes(triangle.turn));
  assert.ok([0.8, 0.9, 1.15].includes(triangle.size));
});
