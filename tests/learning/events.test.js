import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent, LearningBus, SKILLS, ERROR_TYPES } from '../../src/learning/events.js';

const base = { mission: 'letters', skill: 'letterVisual', item: 'B', correct: true, firstTry: true, latencyMs: 812.4, assistLevel: 0, at: 1000 };

test('a valid event is normalised', () => {
  const e = makeEvent({ ...base, item: 4, level: 2, round: 0 });
  assert.equal(e.item, '4');
  assert.equal(e.latencyMs, 812);
  assert.equal(e.attempt, 1);
  assert.equal(e.level, 2);
  assert.equal(e.round, 0);
  assert.equal('errorType' in e, false);
});

test('rejects unknown skills, error types and missing fields', () => {
  assert.throws(() => makeEvent({ ...base, skill: 'spelling' }), /unknown skill/);
  assert.throws(() => makeEvent({ ...base, mission: '' }), /mission/);
  assert.throws(() => makeEvent({ ...base, item: '' }), /item/);
  assert.throws(() => makeEvent({ ...base, assistLevel: 5 }), /assistLevel/);
  assert.throws(() => makeEvent({ ...base, correct: false, errorType: 'sneeze' }), /errorType/);
});

test('correct and errorType are consistent', () => {
  assert.throws(() => makeEvent({ ...base, errorType: 'wrongChoice' }), /no errorType/);
  assert.throws(() => makeEvent({ ...base, correct: false }), /needs an errorType/);
  const wrong = makeEvent({ ...base, correct: false, firstTry: true, errorType: 'wrongChoice', chosen: 'P' });
  assert.equal(wrong.firstTry, false, 'an unsuccessful attempt is never a first-try success');
  assert.equal(wrong.chosen, 'P');
});

test('latency is never negative', () => {
  assert.equal(makeEvent({ ...base, latencyMs: -50 }).latencyMs, 0);
});

test('the skill and error vocabularies match the roadmap', () => {
  assert.deepEqual([...SKILLS], ['letterVisual', 'letterAudio', 'letterSound', 'numeral', 'quantity', 'counting', 'sequence', 'comparison', 'shape', 'pattern', 'sorting', 'wordVisual']);
  assert.deepEqual([...ERROR_TYPES], ['wrongChoice', 'timeout', 'missTap', 'overTap']);
});

test('bus: subscribe, unsubscribe and recent()', () => {
  const bus = new LearningBus();
  const got = [];
  const off = bus.subscribe((e) => got.push(e.item));
  bus.emit({ ...base, item: 'A' });
  off();
  bus.emit({ ...base, item: 'B' });
  assert.deepEqual(got, ['A']);
  assert.deepEqual(bus.recent().map((e) => e.item), ['A', 'B']);
  assert.deepEqual(bus.recent(1).map((e) => e.item), ['B']);
});

test('bus keeps only the last N events', () => {
  const bus = new LearningBus({ limit: 3 });
  for (const item of 'ABCDE') bus.emit({ ...base, item });
  assert.deepEqual(bus.recent().map((e) => e.item), ['C', 'D', 'E']);
});

test('bus never throws into gameplay: invalid events and failing listeners are reported', () => {
  const problems = [];
  const bus = new LearningBus({ onInvalid: (err) => problems.push(err.message) });
  assert.equal(bus.emit({ ...base, skill: 'nope' }), null);
  bus.subscribe(() => { throw new Error('listener broke'); });
  const seen = [];
  bus.subscribe((e) => seen.push(e.item));
  assert.doesNotThrow(() => bus.emit(base));
  assert.deepEqual(seen, ['B'], 'later listeners still run');
  assert.equal(problems.length, 2);
});

test('scored and options: scored unless marked otherwise; options kept only when it is a count', () => {
  assert.equal(makeEvent(base).scored, true);
  assert.equal(makeEvent({ ...base, scored: false }).scored, false);
  assert.equal(makeEvent({ ...base, options: 3 }).options, 3);
  for (const options of [0, 2.5, '3', null]) assert.equal('options' in makeEvent({ ...base, options }), false, String(options));
});
