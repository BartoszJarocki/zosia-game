import test from 'node:test';
import assert from 'node:assert/strict';
import { kittenFloors, nextDoor, diceFloors } from '../../src/levels/lookout.js';
import { T } from '../../src/lang/pl.js';

test('a kitten waits on a fresh floor, never where the car already is', () => {
  assert.deepEqual(kittenFloors([1, 2, 3, 4, 5], 2, [2, 4]), [1, 3, 5]);
  assert.deepEqual(kittenFloors([1, 2, 3], 0, []), [1, 2, 3]);
});

test('with every floor visited (relative rides on 3 floors), a floor can have a second kitten', () => {
  assert.deepEqual(kittenFloors([1, 2, 3], 3, [2, 3, 1]), [1, 2]);
});

test('one floor up or down stays inside the building', () => {
  assert.deepEqual(nextDoor(1, 3), [2]);
  assert.deepEqual(nextDoor(2, 3), [3, 1]);
  assert.deepEqual(nextDoor(3, 3), [2]);
});

test('the die only says what fits: room is left for every ride still to come', () => {
  assert.deepEqual(diceFloors(0, 9, 2, [1, 3]), [1, 2, 3]);
  assert.deepEqual(diceFloors(3, 9, 1, [1, 3]), [4, 5, 6]);
  assert.deepEqual(diceFloors(4, 7, 1, [1, 2]), [5, 6]);
  assert.deepEqual(diceFloors(5, 7, 1, [1, 3]), [6]);
  assert.deepEqual(diceFloors(6, 7, 0, [1, 3]), [7]);
});

test('the die\'s floors are counted in good Polish', () => {
  assert.deepEqual(T.diceUp(1), ['Jedno piętro w górę! Na które piętro?']);
  assert.deepEqual(T.diceUp(3), ['Trzy piętra w górę! Na które piętro?']);
  assert.deepEqual(T.diceUp(5), ['Pięć pięter w górę! Na które piętro?']);
});
