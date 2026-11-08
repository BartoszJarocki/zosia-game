import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../../src/session/director.js';
import { mapDecision, suggestStop } from '../../src/session/map.js';

const road = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'blackhole', 'comet', 'stars'];

test('the map director invites for the finale or tiredness and only forces a wind-down', () => {
  const s = createSession(1);
  assert.equal(mapDecision(s, 'ok'), 'suggest');
  assert.equal(mapDecision(s, 'tired'), 'invite');
  assert.equal(mapDecision(s, 'finish'), 'home');
  s.missionsCompleted = 2;
  assert.equal(mapDecision(s, 'ok'), 'invite');
  assert.equal(mapDecision(s, 'finish'), 'home');
  s.finaleDone = true;
  assert.equal(mapDecision(s, 'ok'), 'none');
  s.endedEarly = true;
  assert.equal(mapDecision(s, 'ok'), 'home');
  s.goodbyeSaid = true;
  assert.equal(mapDecision(s, 'ok'), 'none');
});

test('suggest the nearest unseen stop outward, then back toward the Sun', () => {
  const s = createSession(1);
  assert.equal(suggestStop(s, road, 'earth', {}), 'moon');
  assert.equal(suggestStop(s, road, 'earth', { moon: 2, mars: 1 }), 'jupiter');
  assert.equal(suggestStop(s, road, 'mars', { jupiter: 1 }), 'saturn');
  assert.equal(suggestStop(s, road, 'pluto', {}), 'blackhole');
  assert.equal(suggestStop(s, road, 'stars', {}), 'comet');
  assert.equal(suggestStop(s, road, 'moon', Object.fromEntries(road.slice(4).map((kind) => [kind, 1]))), 'venus');
});

test('once all stops are known, suggest the nearest one not visited this session', () => {
  const s = createSession(1);
  const visited = Object.fromEntries(road.map((kind) => [kind, 2]));
  s.visited = { moon: 1, mars: 1 };
  assert.equal(suggestStop(s, road, 'earth', visited), 'jupiter');
  s.visited = { ...visited, mercury: 0 };
  assert.equal(suggestStop(s, road, 'stars', visited), 'mercury');
  s.visited.mercury = 1;
  assert.equal(suggestStop(s, road, 'stars', visited), null);
});

test('a space game from the session director takes precedence over a look-only stop', () => {
  const s = createSession(1);
  assert.equal(suggestStop(s, road, 'earth', {}, ['blackhole']), 'blackhole');
  s.completed = ['blackhole'];
  assert.equal(suggestStop(s, road, 'earth', {}, ['moon', 'blackhole']), 'moon');
});
