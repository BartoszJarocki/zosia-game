import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LearningBus } from '../../src/learning/events.js';
import { QuestionTracker } from '../../src/learning/question.js';

function setup() {
  let t = 0;
  const bus = new LearningBus({ onInvalid: (e) => { throw e; } });
  const q = new QuestionTracker(bus, { now: () => t, clock: () => t });
  q.open({ mission: 'cones', skill: 'numeral', item: 2, level: 1, round: 0 });
  return { q, advance: (ms) => (t += ms) };
}

test('the iPad locked for 40 s mid-question: her answer time leaves the 40 s out', () => {
  const { q, advance } = setup();
  advance(3000); q.promptEnded();
  advance(2000); advance(40000); q.paused(40000);
  advance(1500);
  assert.equal(q.correct({ chosen: '2' }).latencyMs, 3500);
});

test('locked before the prompt ended: counted from opening, minus the time away', () => {
  const { q, advance } = setup();
  advance(1000); advance(30000); q.paused(30000);
  advance(2000);
  assert.equal(q.correct().latencyMs, 3000);
});

test('a prompt that ended while the page was hidden counts from coming back', () => {
  const { q, advance } = setup();
  advance(1000);                 // hidden here, the line is cut…
  advance(500); q.promptEnded(); // …which ends the prompt while hidden
  advance(39500); q.paused(40000);
  advance(2500);
  assert.equal(q.correct().latencyMs, 2500);
});
