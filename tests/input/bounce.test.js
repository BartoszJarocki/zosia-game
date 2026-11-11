import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBounce, freshTap } from '../../src/input/bounce.js';

const first = { t: 10_000, x: 500, y: 400 };

test('a finger landing again 70 ms later on the same spot is the same tap', () => {
  assert.equal(isBounce(first, { t: 10_070, x: 503, y: 398 }), true);
});

test('0.12 s: just under is the same tap, from 0.12 s on it is a new one', () => {
  assert.equal(isBounce(first, { t: 10_119, x: 500, y: 400 }), true);
  assert.equal(isBounce(first, { t: 10_120, x: 500, y: 400 }), false);
});

test('40 px: just inside is the same tap, from 40 px away it is a new one', () => {
  assert.equal(isBounce(first, { t: 10_050, x: 539, y: 400 }), true);
  assert.equal(isBounce(first, { t: 10_050, x: 540, y: 400 }), false);
  assert.equal(isBounce(first, { t: 10_050, x: 524, y: 432 }), false, '24 across and 32 down is 40 px');
});

test('the first tap is never a bounce', () => {
  assert.equal(isBounce(null, first), false);
});

test('pointer events: a quick second landing is dropped, an honest second tap a moment later counts', () => {
  const down = (timeStamp, clientX, clientY) => ({ timeStamp, clientX, clientY });
  assert.equal(freshTap(down(50_000, 300, 300)), true);
  assert.equal(freshTap(down(50_070, 302, 301)), false);
  assert.equal(freshTap(down(50_400, 302, 301)), true, 'a second tap 0.33 s after the bounce');
  assert.equal(freshTap(down(50_450, 600, 300)), true, 'another finger, somewhere else');
});
