import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRAY, strayTarget } from '../../src/input/stray.js';

const SHORT = 820; // an iPad held sideways, 1180 x 820
const lighthouseSea = { x: 1062, y: 205 };
const treatHouse = { x: lighthouseSea.x - 70, y: lighthouseSea.y + 70 }; // 99 px away: 12% of the short side
const spots = [{ x: 500, y: 300, target: 'letters' }, { ...treatHouse, target: 'counting' }];
const tapAway = (spot, share) => ({ x: spot.x + share * SHORT, y: spot.y });

test('on the island a tap 4% of the short side from a star still reaches it', () => {
  assert.equal(strayTarget(spots, tapAway(spots[0], 0.04), SHORT, STRAY.island), 'letters');
});

test('on the island a tap 6% from a star reaches nothing', () => {
  assert.equal(strayTarget(spots, tapAway(spots[0], 0.06), SHORT, STRAY.island), null);
});

test('on the island a tap on the sea 12% from the Treat House drives nowhere', () => {
  assert.equal(strayTarget(spots, lighthouseSea, SHORT, STRAY.island), null);
});

test('in a mission, which asks for no radius, the same tap 12% away still finds the thing', () => {
  assert.equal(strayTarget(spots, lighthouseSea, SHORT), 'counting');
});

test('a mission gives up at 16%', () => {
  assert.equal(strayTarget(spots, tapAway(spots[0], 0.16), SHORT), null);
});

test('the nearer of two things wins', () => {
  const two = [{ x: 100, y: 100, target: 'far' }, { x: 130, y: 100, target: 'near' }];
  assert.equal(strayTarget(two, { x: 125, y: 100 }, SHORT), 'near');
});

test('with nothing to tap there is nothing to find', () => {
  assert.equal(strayTarget([], { x: 5, y: 5 }, SHORT), null);
});
