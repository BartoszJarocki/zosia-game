import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, completeMission, windDown, ending, sayGoodbye, nextStep } from '../../src/session/director.js';
import { homeTaskKind, weekTaskKinds } from '../../src/session/home-task.js';

test('ending: a finished finale is thanked once, then it is free play', () => {
  const s = createSession(0, { targetMissions: 1 });
  completeMission(s, 'counting', 1);
  assert.equal(ending(s), null);
  completeMission(s, 'lookout', 2);
  assert.equal(ending(s), 'thanks');
  sayGoodbye(s);
  assert.equal(ending(s), null);
  assert.equal(nextStep(s), 'free');
});

test('ending: wound down early → a goodnight once, then the island sleeps', () => {
  const s = createSession(0);
  completeMission(s, 'picnic', 1);
  windDown(s);
  assert.equal(ending(s), 'goodnight');
  sayGoodbye(s);
  assert.equal(ending(s), 'asleep');
  completeMission(s, 'cones', 2); // a grown-up started one anyway: still asleep afterwards
  assert.equal(ending(s), 'asleep');
});

const TASKS = { letters: 'a', counting: 'b', lookout: 'c', picnic: 'd' };

test('homeTaskKind: the last regular mission with a task; the finale only when nothing else has one', () => {
  assert.equal(homeTaskKind(['counting', 'letters', 'lookout'], TASKS), 'letters');
  assert.equal(homeTaskKind(['picnic', 'delivery'], TASKS), 'picnic');
  assert.equal(homeTaskKind(['delivery', 'lookout'], TASKS), 'lookout');
  assert.equal(homeTaskKind(['delivery'], TASKS), null);
  assert.equal(homeTaskKind([], TASKS), null);
});

test('weekTaskKinds: finished sessions of the last 7 days, newest first, no repeats', () => {
  const day = 86_400_000, now = 30 * day;
  const recent = [
    { startedAt: now - 10 * day, missions: ['counting', 'lookout'], finale: true },  // too old
    { startedAt: now - 3 * day, missions: ['letters', 'lookout'], finale: true },
    { startedAt: now - 2 * day, missions: ['picnic'], early: true },
    { startedAt: now - 1 * day, missions: ['counting'] },                          // never finished: no task said
    { startedAt: now - 0.5 * day, missions: ['letters', 'counting', 'lookout'], finale: true },
    { startedAt: now - 0.2 * day, missions: ['picnic', 'lookout'], finale: true },
  ];
  assert.deepEqual(weekTaskKinds(recent, TASKS, now), ['picnic', 'counting', 'letters']);
  assert.deepEqual(weekTaskKinds(recent, TASKS, now, 1), ['picnic']);
  assert.deepEqual(weekTaskKinds([], TASKS, now), []);
});
