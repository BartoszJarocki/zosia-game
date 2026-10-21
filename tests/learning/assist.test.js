import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAssist, onIdle, onWrong, onActivity } from '../../src/learning/assist.js';

/** Feed onIdle every 250 ms up to `untilMs`, collecting actions with the time they fired. */
function idleRun(state, untilMs, from = 0) {
  const out = [];
  for (let t = from; t <= untilMs; t += 250) { const a = onIdle(state, t); if (a) out.push([a, t]); }
  return out;
}

test('quiet: a silent nudge at 6 s, the short prompt at 10 s, a clue at 17 s, the answer at 25 s, then silence', () => {
  const s = createAssist();
  assert.deepEqual(idleRun(s, 120000), [['nudge', 6000], ['shortPrompt', 10000], ['hint', 17000], ['reveal', 25000]]);
  assert.equal(s.level, 3);
});

test('the nudge gives no help: the level stays 0', () => {
  const s = createAssist();
  assert.equal(onIdle(s, 6000), 'nudge');
  assert.equal(s.level, 0);
});

test('no endless repetition: nothing after the reveal, however long', () => {
  const s = createAssist();
  idleRun(s, 25000);
  assert.deepEqual(idleRun(s, 600000, 25250), []);
});

test('wrong taps: retry → simplify → reveal (and reveal again after that)', () => {
  const s = createAssist();
  assert.equal(onWrong(s), 'retry');
  assert.equal(s.level, 1);
  assert.equal(onWrong(s), 'simplify');
  assert.equal(s.level, 2);
  assert.equal(onWrong(s), 'reveal');
  assert.equal(onWrong(s), 'reveal');
  assert.equal(s.level, 3);
});

test('help never steps back down: after 2 wrong taps, idle goes straight to reveal', () => {
  const s = createAssist();
  onWrong(s); onWrong(s); // level 2
  onActivity(s);
  assert.deepEqual(idleRun(s, 40000), [['reveal', 25000]]);
});

test('one wrong tap, then quiet: the clue comes next (no nudge, no repeated short prompt)', () => {
  const s = createAssist();
  onWrong(s);
  onActivity(s);
  assert.deepEqual(idleRun(s, 40000), [['hint', 17000], ['reveal', 25000]]);
});

test('three wrong taps, then quiet: nothing more is said', () => {
  const s = createAssist();
  onWrong(s); onWrong(s); onWrong(s);
  onActivity(s);
  assert.deepEqual(idleRun(s, 120000), []);
});

test('after an idle reveal, the next wrong tap keeps revealing', () => {
  const s = createAssist();
  idleRun(s, 25000);
  assert.equal(s.revealed, true);
  assert.equal(onWrong(s), 'reveal');
});

test('custom timing is respected, one step per call', () => {
  const s = createAssist();
  const fast = { nudgeMs: 50, shortPromptMs: 100, hintMs: 200, revealMs: 300 };
  assert.equal(onIdle(s, 49, fast), null);
  assert.equal(onIdle(s, 50, fast), 'nudge');
  assert.equal(onIdle(s, 450, fast), 'shortPrompt');
  assert.equal(onIdle(s, 450, fast), 'hint');
  assert.equal(onIdle(s, 450, fast), 'reveal');
  assert.equal(onIdle(s, 450, fast), null);
});
