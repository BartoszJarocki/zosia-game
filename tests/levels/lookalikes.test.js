import test from 'node:test';
import assert from 'node:assert/strict';
import { distractors } from '../../src/levels/lookalikes.js';

test('similar can pick a lookalike outside the pool but inside the alphabet', () => {
  assert.deepEqual(distractors('A', ['A', 'B'], 1, true, 'AH'), ['H']);
});

test('similar only uses lookalikes from the pool when no alphabet is given', () => {
  assert.deepEqual(distractors('A', ['A', 'B'], 1, true), ['B']);
});
