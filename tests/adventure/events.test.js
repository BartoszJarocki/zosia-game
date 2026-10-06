import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, pickEvent, eventById, recordEvent } from '../../src/adventure/events.js';
import { emptyWorld } from '../../src/adventure/world.js';

test('the finale is called by the Lookout alarm', () => {
  assert.equal(pickEvent({ step: 'finale', suggested: 'lookout' }).id, 'lookout-alarm');
});

test('events tell the director\'s suggestion as a story', () => {
  assert.equal(pickEvent({ step: 'mission', suggested: 'letters' }).id, 'lost-kitten');
  assert.equal(pickEvent({ step: 'mission', suggested: 'balloons' }).id, 'balloons-escaping');
  assert.equal(pickEvent({ step: 'mission', suggested: 'cones' }), null, 'no story: just the suggestion');
});

test('free play: no events', () => {
  for (const suggested of [null, 'letters', 'balloons', 'lookout']) assert.equal(pickEvent({ step: 'free', suggested }), null);
});

test('every event points at a mission and has a line', () => {
  for (const e of EVENTS) {
    assert.ok(e.mission && e.line && typeof e.when === 'function', e.id);
    assert.equal(eventById(e.id), e);
  }
  assert.equal(eventById('nope'), null);
});

test('recordEvent: unique ids, newest last, unknown ignored', () => {
  const w = emptyWorld();
  assert.equal(recordEvent(w, 'lost-kitten'), true);
  assert.equal(recordEvent(w, 'lookout-alarm'), true);
  assert.equal(recordEvent(w, 'lost-kitten'), false);
  assert.deepEqual(w.completedEvents, ['lookout-alarm', 'lost-kitten']);
  assert.equal(recordEvent(w, 'dragon'), false);
});
