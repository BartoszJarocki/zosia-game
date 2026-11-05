import test from 'node:test';
import assert from 'node:assert/strict';
import { craterCells, craterMax, craterChoices, nearFromLevel } from '../../src/levels/mercury.js';

test('craters are laid out like the dots on a die', () => {
  assert.deepEqual(craterCells(1), [4]);
  assert.deepEqual(craterCells(2), [0, 8]);
  assert.deepEqual(craterCells(3), [0, 4, 8]);
  assert.deepEqual(craterCells(4), [0, 2, 6, 8]);
  assert.deepEqual(craterCells(5), [0, 2, 4, 6, 8]);
  assert.deepEqual(craterCells(6), [0, 2, 3, 5, 6, 8]);
});

test('crater choices stay within six and use the neighbours from level 2', () => {
  assert.equal(craterMax([1, 3], 1), 3);
  assert.equal(craterMax([1, 3], 3), 4);
  assert.equal(craterMax([1, 4], 4), 5);
  assert.equal(craterMax([2, 5], 5), 6);
  assert.equal(craterMax([3, 6], 6), 6);
  assert.deepEqual([...craterChoices(3, [1, 4], 3, true)].sort((a, b) => a - b), [2, 3, 4]);
  assert.equal(nearFromLevel(1), false);
  assert.equal(nearFromLevel(2), true);
  assert.equal(nearFromLevel(5), true);
});

test('crater choices always include the answer and the requested number of tiles', () => {
  const choices = craterChoices(1, [1, 3], 3, false);
  assert.equal(choices.length, 3);
  assert.ok(choices.includes(1));
  assert.ok(choices.every((n) => n >= 1 && n <= 6));
});
