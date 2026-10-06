import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultScore, applyEvent, masteryOf, averageMastery, RATE } from '../../src/learning/mastery.js';

const ev = (o) => ({ mission: 'letters', skill: 'letterAudio', item: 'B', correct: true, firstTry: true, assistLevel: 0, latencyMs: 1000, attempt: 1, at: 1000, ...o });

test('scores follow the roadmap table', () => {
  assert.equal(resultScore(ev()), 1.0);
  assert.equal(resultScore(ev({ firstTry: false })), 0.7);
  assert.equal(resultScore(ev({ assistLevel: 1 })), 0.7);
  assert.equal(resultScore(ev({ assistLevel: 2 })), 0.45);
  assert.equal(resultScore(ev({ assistLevel: 3, firstTry: false })), 0.2);
  assert.equal(resultScore(ev({ correct: false, errorType: 'wrongChoice' })), null);
});

test('mastery is a moving average: new item, one right answer', () => {
  const skills = {};
  const s = applyEvent(skills, ev());
  assert.equal(s.mastery, RATE * 1.0);
  assert.equal(s.attempts, 1);
  assert.equal(s.correctFirstTry, 1);
  assert.equal(masteryOf(skills, 'letterAudio', 'B'), 0.2);
});

test('mastery climbs with repeated success and stays within 0–1', () => {
  const skills = {};
  for (let i = 0; i < 40; i++) applyEvent(skills, ev({ at: i }));
  const m = masteryOf(skills, 'letterAudio', 'B');
  assert.ok(m > 0.99 && m <= 1, m);
});

test('help pulls mastery down gently, never below 0', () => {
  const skills = {};
  for (let i = 0; i < 10; i++) applyEvent(skills, ev());
  const high = masteryOf(skills, 'letterAudio', 'B');
  applyEvent(skills, ev({ assistLevel: 3, firstTry: false }));
  const after = masteryOf(skills, 'letterAudio', 'B');
  assert.ok(after < high && after > 0, `${high} → ${after}`);
  assert.equal(skills.letterAudio.B.assisted, 1);
});

test('wrong choices are counted with confusions; motor slips and silences kept apart', () => {
  const skills = {};
  applyEvent(skills, ev({ correct: false, errorType: 'wrongChoice', chosen: 'P' }));
  applyEvent(skills, ev({ correct: false, errorType: 'wrongChoice', chosen: 'P' }));
  applyEvent(skills, ev({ correct: false, errorType: 'overTap', chosen: 'R' }));
  applyEvent(skills, ev({ correct: false, errorType: 'missTap' }));
  applyEvent(skills, ev({ correct: false, errorType: 'timeout' }));
  const s = skills.letterAudio.B;
  assert.equal(s.wrong, 3);
  assert.deepEqual(s.confusions, { P: 2 }, 'random fast taps are not real confusions');
  assert.equal(s.missTaps, 1);
  assert.equal(s.timeouts, 1);
  assert.equal(s.mastery, 0, 'only solved questions move mastery');
});

test('latency is a running average of correct answers', () => {
  const skills = {};
  applyEvent(skills, ev({ latencyMs: 1000 }));
  applyEvent(skills, ev({ latencyMs: 3000 }));
  assert.equal(skills.letterAudio.B.avgLatencyMs, 2000);
});

test('skills are separate: visual B and audio B do not mix', () => {
  const skills = {};
  applyEvent(skills, ev({ skill: 'letterVisual' }));
  assert.equal(masteryOf(skills, 'letterAudio', 'B'), 0);
  assert.equal(masteryOf(skills, 'letterVisual', 'B'), 0.2);
});

test('average mastery over a pool counts unseen items as 0', () => {
  const skills = {};
  applyEvent(skills, ev({ item: 'A' }));
  assert.equal(averageMastery(skills, 'letterAudio', 'AB'), 0.1);
  assert.equal(averageMastery(skills, 'letterAudio', ''), 0);
});

test('confusions are capped', () => {
  const skills = {};
  for (const c of 'ABCDEFGHIJKL') applyEvent(skills, ev({ correct: false, errorType: 'wrongChoice', chosen: c }));
  assert.ok(Object.keys(skills.letterAudio.B.confusions).length <= 8);
});
