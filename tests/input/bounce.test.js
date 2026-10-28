import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBounce } from '../../src/input/bounce.js';

const last = { chosen: 3, at: 10_000 };

test('the same wrong option again 70 ms later is one tap that bounced', () => {
  assert.equal(isBounce(last, 3, 10_070), true);
});

test('the same wrong option again after 600 ms is a new answer', () => {
  assert.equal(isBounce(last, 3, 10_599), true);
  assert.equal(isBounce(last, 3, 10_600), false);
});

test('a different option, however quick, is a new answer', () => {
  assert.equal(isBounce(last, 4, 10_070), false);
});

test('the first wrong tap of a question is never a bounce', () => {
  assert.equal(isBounce(null, 3, 10_070), false);
});
