import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAssist, onIdle, onWrong, onActivity, TIMING } from '../../src/learning/assist.js';

/** Feed onIdle every 250 ms up to `untilMs`, collecting actions with the time they fired. */
function idleRun(state, untilMs, from = 0) {
  const out = [];
  for (let t = from; t <= untilMs; t += 250) { const a = onIdle(state, t); if (a) out.push([a, t]); }
  return out;
}

test('quiet: short prompt → hint → reveal → one reminder → silence', () => {
  const s = createAssist();
  const acts = idleRun(s, 120000);
  assert.deepEqual(acts.map((a) => a[0]), ['shortPrompt', 'hint', 'reveal', 'remind']);
  assert.equal(acts[0][1], TIMING.shortPromptMs);
  assert.equal(acts[1][1], TIMING.hintMs);
  assert.equal(acts[2][1], TIMING.revealMs);
  assert.equal(acts[3][1], TIMING.remindMs);
  assert.equal(s.level, 3);
});

test('no endless repetition: nothing after the reminder, however long', () => {
  const s = createAssist();
  idleRun(s, 30000);
  assert.deepEqual(idleRun(s, 600000, 30250), []);
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
  const acts = idleRun(s, 40000).map((a) => a[0]);
  assert.deepEqual(acts, ['reveal', 'remind']);
});

test('one wrong tap, then quiet: hint comes next (the short prompt was already given)', () => {
  const s = createAssist();
  onWrong(s);            // retry, level 1
  onActivity(s);
  assert.deepEqual(idleRun(s, 40000).map((a) => a[0]), ['hint', 'reveal', 'remind']);
});

test('after an idle reveal, the next wrong tap keeps revealing', () => {
  const s = createAssist();
  idleRun(s, TIMING.revealMs);
  assert.equal(s.revealed, true);
  assert.equal(onWrong(s), 'reveal');
});

test('custom timing is respected', () => {
  const s = createAssist();
  const fast = { shortPromptMs: 100, hintMs: 200, revealMs: 300, remindMs: 400 };
  assert.equal(onIdle(s, 99, fast), null);
  assert.equal(onIdle(s, 100, fast), 'shortPrompt');
  assert.equal(onIdle(s, 450, fast), 'hint'); // one step per call
  assert.equal(onIdle(s, 450, fast), 'reveal');
  assert.equal(onIdle(s, 450, fast), 'remind');
  assert.equal(onIdle(s, 450, fast), null);
});
