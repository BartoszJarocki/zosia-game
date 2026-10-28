import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LearningBus } from '../../src/learning/events.js';
import { QuestionTracker } from '../../src/learning/question.js';

function setup(opts) {
  let t = 0;
  const bus = new LearningBus({ onInvalid: (e) => { throw e; } });
  const q = new QuestionTracker(bus, { now: () => t, clock: () => 1_000_000 + t, ...opts });
  return { bus, q, advance: (ms) => (t += ms) };
}
const ask = (q) => q.open({ mission: 'letters', skill: 'letterVisual', item: 'B', level: 1, round: 2 });

test('right first time: one event with latency from the end of the spoken prompt', () => {
  const { bus, q, advance } = setup();
  ask(q);
  advance(3000); q.promptEnded();   // the question took 3 s to say
  advance(900); const e = q.correct({ chosen: 'B' });
  assert.equal(e.correct, true);
  assert.equal(e.firstTry, true);
  assert.equal(e.attempt, 1);
  assert.equal(e.latencyMs, 900);
  assert.equal(e.assistLevel, 0);
  assert.equal(e.level, 1);
  assert.equal(e.round, 2);
  assert.equal(e.at, 1_003_900);
  assert.equal(q.isOpen, false);
  assert.equal(bus.recent().length, 1);
});

test('answering before the prompt ends: latency measured from opening', () => {
  const { q, advance } = setup();
  ask(q);
  advance(1200);
  assert.equal(q.correct().latencyMs, 1200);
});

test('only the first prompt end counts (repeats do not reset latency)', () => {
  const { q, advance } = setup();
  ask(q); advance(2000); q.promptEnded();
  advance(5000); q.promptEnded(); // the question was said again
  advance(1000);
  assert.equal(q.correct().latencyMs, 6000);
});

test('wrong then right: wrongChoice with what she picked, then a non-first-try success', () => {
  const { bus, q, advance } = setup();
  ask(q); q.promptEnded();
  advance(2000); const w = q.wrong({ chosen: 'P' });
  advance(2000); const c = q.correct();
  assert.equal(w.correct, false);
  assert.equal(w.errorType, 'wrongChoice');
  assert.equal(w.chosen, 'P');
  assert.equal(w.attempt, 1);
  assert.equal(c.firstTry, false);
  assert.equal(c.attempt, 2);
  assert.deepEqual(bus.recent().map((e) => e.correct), [false, true]);
});

test('miss taps are recorded but do not cost the first try', () => {
  const { q, advance } = setup();
  ask(q); q.promptEnded();
  advance(1500); const m = q.missTap();
  advance(1500); const c = q.correct();
  assert.equal(m.errorType, 'missTap');
  assert.equal(m.attempt, 1);
  assert.equal(c.firstTry, true);
  assert.equal(c.attempt, 1);
});

test('rapid taps are flagged as overTap', () => {
  const { q, advance } = setup();
  ask(q); q.promptEnded();
  advance(2000);
  assert.equal(q.wrong({ chosen: 'M' }).errorType, 'wrongChoice');
  advance(200);
  assert.equal(q.wrong({ chosen: 'T' }).errorType, 'wrongChoice');
  advance(200);
  assert.equal(q.wrong({ chosen: 'M' }).errorType, 'overTap'); // third tap within 1.2 s
  advance(3000);
  assert.equal(q.wrong({ chosen: 'T' }).errorType, 'wrongChoice'); // calm again
});

test('timeout counts as help level 1 and is not an attempt', () => {
  const { q, advance } = setup();
  ask(q); q.promptEnded();
  advance(12000); const t = q.timeout();
  advance(1000); const c = q.correct();
  assert.equal(t.errorType, 'timeout');
  assert.equal(t.assistLevel, 1);
  assert.equal(c.firstTry, true);
  assert.equal(c.assistLevel, 1);
});

test('help level only goes up and is capped at 3', () => {
  const { q } = setup();
  ask(q);
  q.assist(2); q.assist(1);
  assert.equal(q.current.assist, 2);
  q.assist(9);
  assert.equal(q.current.assist, 3);
  assert.equal(q.correct().assistLevel, 3);
});

test('nothing happens without an open question; a question closes once', () => {
  const { bus, q } = setup();
  assert.equal(q.correct(), null);
  assert.equal(q.wrong(), null);
  assert.equal(q.missTap(), null);
  assert.equal(q.timeout(), null);
  ask(q);
  q.correct();
  assert.equal(q.correct(), null);
  assert.equal(bus.recent().length, 1);
});

test('opening a new question drops an unresolved one without an event', () => {
  const { bus, q } = setup();
  ask(q);
  q.open({ mission: 'cones', skill: 'numeral', item: 3 });
  const e = q.correct();
  assert.equal(e.mission, 'cones');
  assert.equal(e.item, '3');
  assert.equal(bus.recent().length, 1);
});

test('cancel drops the question', () => {
  const { bus, q } = setup();
  ask(q); q.cancel();
  assert.equal(q.isOpen, false);
  assert.equal(q.correct(), null);
  assert.equal(bus.recent().length, 0);
});

test('scored: false and options travel with every event of the question', () => {
  const { q } = setup();
  q.open({ mission: 'counting', skill: 'counting', item: 3, scored: false, options: 2 });
  const w = q.wrong({ chosen: 2 });
  const c = q.correct();
  assert.deepEqual([w.scored, w.options, c.scored, c.options], [false, 2, false, 2]);
  ask(q);
  const plain = q.correct();
  assert.equal(plain.scored, true);
  assert.equal('options' in plain, false);
});
