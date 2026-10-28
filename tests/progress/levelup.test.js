import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRun, applyRun } from '../../src/progress/levelup.js';

const solved = (o) => ({ correct: true, firstTry: true, assistLevel: 0, scored: true, ...o });

test('a question is clean when solved first try without the clue or the reveal', () => {
  const run = [
    solved(),                                      // right first time
    solved({ assistLevel: 1 }),                    // heard the question again, then right: still clean
    solved({ assistLevel: 2 }),                    // first tap right, but only after the clue
    solved({ assistLevel: 3 }),                    // after the answer pulsed
    solved({ firstTry: false }),                   // a wrong tap first
    { correct: false, errorType: 'wrongChoice' },  // the wrong tap itself is not a question
    solved({ scored: false }),                     // can't be got wrong: doesn't count either way
  ];
  assert.deepEqual(scoreRun(run), { scored: 5, clean: 2 });
});

test('the walker\'s Kitty Park plan scores 1 of 4: the 20 s wait reached the clue', () => {
  const plan = [solved(), solved({ firstTry: false }), solved({ assistLevel: 2 }), solved({ firstTry: false, assistLevel: 2 })];
  const m = { level: 1, good: 0, lastAcc: 1 };
  assert.deepEqual(applyRun(m, scoreRun(plan), { goodRuns: 2, top: 6 }), { levelUp: false, acc: 0.25 });
  assert.deepEqual(m, { level: 1, good: 0, lastAcc: 0.25 });
});

test('two good runs level up; two thirds is good, a half is not', () => {
  const m = { level: 1, good: 0, lastAcc: 1 };
  const opts = { goodRuns: 2, top: 3 };
  assert.deepEqual(applyRun(m, { scored: 3, clean: 2 }, opts), { levelUp: false, acc: 2 / 3 });
  assert.deepEqual(applyRun(m, { scored: 2, clean: 1 }, opts), { levelUp: false, acc: 0.5 });
  assert.equal(m.good, 1, 'a weak run neither counts nor resets');
  assert.deepEqual(applyRun(m, { scored: 10, clean: 9 }, opts), { levelUp: true, acc: 0.9 });
  assert.deepEqual(m, { level: 2, good: 0, lastAcc: 0.9 });
});

test('a run with no scored question does not count at all', () => {
  const m = { level: 2, good: 1, lastAcc: 0.3 };
  assert.deepEqual(applyRun(m, scoreRun([solved({ scored: false }), solved({ scored: false })]), { goodRuns: 2, top: 3 }), { levelUp: false, acc: null });
  assert.deepEqual(m, { level: 2, good: 1, lastAcc: 0.3 }, 'not even lastAcc (it decides the gentler run)');
});

test('a closed gate or the top level holds her where she is', () => {
  const m = { level: 1, good: 1, lastAcc: 1 };
  assert.deepEqual(applyRun(m, { scored: 4, clean: 4 }, { goodRuns: 2, top: 3, opens: () => false }), { levelUp: false, acc: 1 });
  assert.deepEqual(m, { level: 1, good: 2, lastAcc: 1 });
  assert.deepEqual(applyRun(m, { scored: 4, clean: 4 }, { goodRuns: 2, top: 3, opens: () => true }), { levelUp: true, acc: 1 });
  const top = { level: 3, good: 5, lastAcc: 1 };
  assert.deepEqual(applyRun(top, { scored: 4, clean: 4 }, { goodRuns: 2, top: 3 }), { levelUp: false, acc: 1 });
  assert.equal(top.level, 3);
});
