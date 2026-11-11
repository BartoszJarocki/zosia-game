import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRun, applyRun } from '../../src/progress/levelup.js';
import { CONFIG } from '../../src/config.js';

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
  assert.deepEqual(applyRun(m, scoreRun(plan), { goodRuns: 1, top: 6 }), { gained: 0, acc: 0.25 });
  assert.deepEqual(m, { level: 1, good: 0, lastAcc: 0.25 });
});

test('one good run moves her up a level; two thirds is good, a half is not', () => {
  const opts = { goodRuns: CONFIG.goodRunsPerLevel, top: 6 };
  const m = { level: 1, good: 0, lastAcc: 1 };
  assert.deepEqual(applyRun(m, { scored: 3, clean: 2 }, opts), { gained: 1, acc: 2 / 3 });
  assert.deepEqual(m, { level: 2, good: 0, lastAcc: 2 / 3 });
  assert.deepEqual(applyRun(m, { scored: 2, clean: 1 }, opts), { gained: 0, acc: 0.5 });
  assert.deepEqual(m, { level: 2, good: 0, lastAcc: 0.5 });
  assert.deepEqual(applyRun(m, { scored: 5, clean: 4 }, opts), { gained: 1, acc: 0.8 }, 'almost perfect is one level');
  assert.equal(m.level, 3);
});

test('a perfect run of three or more questions moves her up two levels', () => {
  const opts = { goodRuns: CONFIG.goodRunsPerLevel, top: 8 };
  const m = { level: 2, good: 0, lastAcc: 1 };
  assert.deepEqual(applyRun(m, scoreRun([solved(), solved({ assistLevel: 1 }), solved()]), opts), { gained: 2, acc: 1 });
  assert.deepEqual(m, { level: 4, good: 0, lastAcc: 1 });
  assert.deepEqual(applyRun(m, { scored: 6, clean: 6 }, opts), { gained: 2, acc: 1 });
  assert.equal(m.level, 6);
  assert.deepEqual(applyRun(m, { scored: 2, clean: 2 }, opts), { gained: 1, acc: 1 }, 'two questions are too few for a leap');
  assert.equal(m.level, 7);
});

test('a perfect run just under the top stops at the top, and the top holds', () => {
  const opts = { goodRuns: 1, top: 5 };
  const m = { level: 4, good: 0, lastAcc: 1 };
  assert.deepEqual(applyRun(m, { scored: 4, clean: 4 }, opts), { gained: 1, acc: 1 });
  assert.equal(m.level, 5);
  assert.deepEqual(applyRun(m, { scored: 4, clean: 4 }, opts), { gained: 0, acc: 1 });
  assert.equal(m.level, 5);
});

test('a level whose gate is closed stops the leap below it, and holds her at a closed next level', () => {
  const asked = [];
  const shut4 = (level) => { asked.push(level); return level !== 4; };
  const m = { level: 2, good: 0, lastAcc: 1 };
  assert.deepEqual(applyRun(m, { scored: 3, clean: 3 }, { goodRuns: 1, top: 8, opens: shut4 }), { gained: 1, acc: 1 });
  assert.equal(m.level, 3);
  assert.deepEqual(asked, [3, 4], 'each level of the leap is asked about by its own number');
  assert.deepEqual(applyRun(m, { scored: 3, clean: 3 }, { goodRuns: 1, top: 8, opens: shut4 }), { gained: 0, acc: 1 });
  assert.deepEqual(m, { level: 3, good: 1, lastAcc: 1 }, 'the good run is kept for when the gate opens');
});

test('with more good runs per level, a weak run neither counts nor resets', () => {
  const m = { level: 1, good: 0, lastAcc: 1 };
  const opts = { goodRuns: 2, top: 3 };
  assert.deepEqual(applyRun(m, { scored: 3, clean: 2 }, opts), { gained: 0, acc: 2 / 3 });
  assert.deepEqual(applyRun(m, { scored: 2, clean: 1 }, opts), { gained: 0, acc: 0.5 });
  assert.equal(m.good, 1);
  assert.deepEqual(applyRun(m, { scored: 10, clean: 9 }, opts), { gained: 1, acc: 0.9 });
  assert.deepEqual(m, { level: 2, good: 0, lastAcc: 0.9 });
});

test('a run with no scored question does not count at all', () => {
  const m = { level: 2, good: 0, lastAcc: 0.3 };
  assert.deepEqual(applyRun(m, scoreRun([solved({ scored: false }), solved({ scored: false })]), { goodRuns: 1, top: 3 }), { gained: 0, acc: null });
  assert.deepEqual(m, { level: 2, good: 0, lastAcc: 0.3 }, 'not even lastAcc (it decides the gentler run)');
});
