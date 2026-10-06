import test from 'node:test';
import assert from 'node:assert/strict';
import { attention, ATTENTION } from '../../src/session/attention.js';
import { createSession, noteEvent, noteReplay, nextStep, shorten, windDown, completeMission, summary } from '../../src/session/director.js';

let t = 0;
const ok = (s, latencyMs, assistLevel = 0) => noteEvent(s, { correct: true, latencyMs, assistLevel, at: ++t });
const err = (s, errorType) => noteEvent(s, { correct: false, errorType, at: ++t });

/** A session that started well: 4 quick answers. */
function goodStart() {
  const s = createSession(0);
  for (const l of [1500, 1800, 1600, 2000]) ok(s, l);
  return s;
}

test('too little to go on → ok', () => {
  const s = createSession(0);
  ok(s, 9000, 3); ok(s, 9000, 3);
  const a = attention(s);
  assert.equal(a.state, 'ok');
  assert.equal(a.enough, false);
});

test('steady play → ok, score near 1', () => {
  const s = goodStart();
  for (const l of [1700, 1900, 1500, 2100, 1800]) ok(s, l);
  const a = attention(s);
  assert.equal(a.state, 'ok');
  assert.ok(a.score > 0.9, a.score);
});

test('a slow child is judged against herself, not others', () => {
  const s = createSession(0);
  for (let i = 0; i < 9; i++) ok(s, 7000 + (i % 3) * 500);
  assert.equal(attention(s).state, 'ok');
});

test('one long pause does not count (median)', () => {
  const s = goodStart();
  for (const l of [1700, 30000, 1500, 2100, 1800]) ok(s, l);
  assert.equal(attention(s).factors.slow, 0);
});

test('slower answers + needing help → tired', () => {
  const s = goodStart();
  for (let i = 0; i < 5; i++) ok(s, 4500, 2);
  const a = attention(s);
  assert.equal(a.state, 'tired', JSON.stringify(a));
});

test('slower, silences, random taps and help → finish', () => {
  const s = goodStart();
  for (let i = 0; i < 5; i++) {
    err(s, 'timeout');
    if (i % 2) { err(s, 'overTap'); noteReplay(s); }
    ok(s, 6000, 3);
  }
  const a = attention(s);
  assert.equal(a.state, 'finish', JSON.stringify(a));
  assert.equal(a.factors.timeouts, 1);
});

test('random tap bursts alone are not enough to stop', () => {
  const s = goodStart();
  for (let i = 0; i < 5; i++) { err(s, 'overTap'); ok(s, 1700); }
  const a = attention(s);
  assert.equal(a.factors.randomTaps, 1);
  assert.equal(a.state, 'ok');
});

test('thresholds can be tuned', () => {
  const s = goodStart();
  for (let i = 0; i < 5; i++) ok(s, 4500, 2);
  assert.equal(attention(s, { tired: 0.3, finish: 0.1 }).state, 'ok');
  assert.equal(ATTENTION.tired, 0.6);
});

test('per-question records: what happened before each answer', () => {
  const s = createSession(0);
  err(s, 'wrongChoice'); err(s, 'missTap'); noteReplay(s); ok(s, 1234, 1);
  ok(s, 999);
  assert.deepEqual(s.recentQuestions[0], { wrongChoice: 1, overTap: 0, timeout: 0, missTap: 1, replays: 1, latencyMs: 1234, assist: 1 });
  assert.equal(s.recentQuestions[1].replays, 0);
  assert.deepEqual(s.baseline, { latency: [1234, 999], assist: [1, 0] });
});

test('shorten: the finale comes after the current mission', () => {
  const s = createSession(0, { targetMissions: 3 });
  shorten(s);
  assert.equal(s.targetMissions, 1);
  completeMission(s, 'letters', 1);
  assert.equal(nextStep(s), 'finale');
});

test('windDown: after this mission it is free play, saved as an early end', () => {
  const s = createSession(0);
  windDown(s);
  completeMission(s, 'lookout', 1);
  assert.equal(nextStep(s), 'free');
  assert.equal(s.finaleDone, false, 'the Lookout played while winding down is not a finale');
  assert.equal(summary(s).early, true);
});
