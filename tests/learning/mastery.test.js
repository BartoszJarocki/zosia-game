import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evidence, applyEvent, masteryBefore, masteryOf, averageMastery } from '../../src/learning/mastery.js';

const ev = (o) => ({ mission: 'letters', skill: 'letterAudio', item: 'B', correct: true, firstTry: true, assistLevel: 0, scored: true, latencyMs: 1000, attempt: 1, at: 1000, ...o });
const masteries = (events) => { const skills = {}; return events.map((e) => applyEvent(skills, e).mastery); };

test('evidence: clean +1, anything else −1/(options−1); nothing when it could not be got wrong', () => {
  assert.equal(evidence(ev({ options: 2 })), 1);
  assert.equal(evidence(ev({ options: 3, assistLevel: 1 })), 1, 'hearing it again is fine');
  assert.equal(evidence(ev({ options: 2, firstTry: false })), -1);
  assert.equal(evidence(ev({ options: 3, assistLevel: 2 })), -0.5, 'first tap right, but after the clue');
  assert.equal(evidence(ev({ assistLevel: 3, firstTry: false })), -0.5, 'no options given: 3 assumed');
  assert.equal(evidence(ev({ options: 5, firstTry: false })), -0.25);
  assert.equal(evidence(ev({ scored: false })), null);
  assert.equal(evidence(ev({ options: 1 })), null);
  assert.equal(evidence(ev({ correct: false, errorType: 'wrongChoice' })), null);
});

test('right first time every time: familiar (0.75) after 5 answers', () => {
  assert.deepEqual(masteries(Array.from({ length: 6 }, () => ev({ options: 3 }))), [0.4, 0.571, 0.666, 0.727, 0.769, 0.804]);
});

test('guessing between 2 things right half the time stays near nothing', () => {
  assert.deepEqual(masteries(Array.from({ length: 6 }, (_, i) => ev({ options: 2, firstTry: i % 2 === 0 }))), [0.4, 0, 0.222, 0, 0.154, 0]);
});

test('after the first few answers each one moves mastery by RATE (0.15) of the gap', () => {
  const skills = { letterAudio: { B: { attempts: 10, correctFirstTry: 9, assisted: 0, mastery: 0.5, latencyN: 1, avgLatencyMs: 1000, confusions: {} } } };
  assert.equal(applyEvent(skills, ev({ options: 3 })).mastery, 0.575);
  assert.equal(applyEvent(skills, ev({ options: 3, assistLevel: 2 })).mastery, 0.414);
  assert.equal(skills.letterAudio.B.attempts, 12);
  assert.equal(skills.letterAudio.B.assisted, 1);
});

test('mastery stays within 0–1', () => {
  assert.equal(masteries(Array.from({ length: 40 }, () => ev({ options: 2 }))).at(-1), 0.997, 'close to 1 (it is rounded to 3 places)');
  assert.equal(masteries(Array.from({ length: 40 }, () => ev({ options: 2, firstTry: false }))).at(-1), 0);
});

test('a question that could not be got wrong is seen, not scored', () => {
  const skills = {};
  const s = applyEvent(skills, ev({ scored: false, at: 5000 }));
  assert.deepEqual([s.attempts, s.correctFirstTry, s.mastery, s.lastSeenAt], [0, 0, 0, 5000]);
});

test('masteryBefore works the last answer back out', () => {
  const skills = {};
  const first = ev({ options: 3 });
  assert.equal(masteryBefore(applyEvent(skills, first), first), 0, 'a new item started at 0');
  const s = { attempts: 10, mastery: 0.5, correctFirstTry: 0, assisted: 0, latencyN: 0, avgLatencyMs: 0, confusions: {} };
  const clued = ev({ options: 3, assistLevel: 2 });
  applyEvent({ letterAudio: { B: s } }, clued);
  assert.equal(s.mastery, 0.35);
  assert.equal(masteryBefore(s, clued), 0.5);
  assert.equal(masteryBefore(s, ev({ scored: false })), 0.35, 'an unscored answer moved nothing');
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
  assert.equal(masteryOf(skills, 'letterVisual', 'B'), 0.4);
});

test('average mastery over a pool counts unseen items as 0', () => {
  const skills = {};
  applyEvent(skills, ev({ item: 'A' }));
  assert.equal(averageMastery(skills, 'letterAudio', 'AB'), 0.2);
  assert.equal(averageMastery(skills, 'letterAudio', ''), 0);
});

test('confusions are capped', () => {
  const skills = {};
  for (const c of 'ABCDEFGHIJKL') applyEvent(skills, ev({ correct: false, errorType: 'wrongChoice', chosen: c }));
  assert.ok(Object.keys(skills.letterAudio.B.confusions).length <= 8);
});
