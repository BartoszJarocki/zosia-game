import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION, DOMAIN, createSession, isStale, noteEvent, nextStep, callFinale, completeMission, suggestNext, summary } from '../../src/session/director.js';

const KINDS = ['letters', 'balloons', 'name', 'cones', 'stones', 'counting', 'lookout'];
const first = () => 0; // rng: always the first candidate

test('a session: 2 missions → finale (Lookout) → free play', () => {
  const s = createSession(1000);
  assert.equal(nextStep(s), 'mission');
  completeMission(s, 'letters', 2000);
  assert.equal(nextStep(s), 'mission');
  completeMission(s, 'cones', 3000);
  assert.equal(nextStep(s), 'finale');
  assert.equal(suggestNext(s, KINDS), 'lookout');
  callFinale(s);
  assert.equal(s.finaleTriggered, true);
  const r = completeMission(s, 'lookout', 4000);
  assert.equal(r.finale, true);
  assert.equal(nextStep(s), 'free');
  assert.equal(suggestNext(s, KINDS), null);
  assert.equal(s.missionsCompleted, 2, 'the finale is not a regular mission');
});

test('the Lookout played early is an ordinary mission', () => {
  const s = createSession(0);
  assert.deepEqual(completeMission(s, 'lookout', 1), { finale: false });
  assert.equal(s.missionsCompleted, 1);
  assert.equal(s.finaleDone, false);
});

test('ignoring the finale is fine: other missions still count, the finale stays suggested', () => {
  const s = createSession(0, { targetMissions: 1 });
  completeMission(s, 'letters', 1);
  completeMission(s, 'balloons', 2);
  assert.equal(nextStep(s), 'finale');
  assert.equal(s.missionsCompleted, 2);
  assert.equal(suggestNext(s, KINDS), 'lookout');
});

test('callFinale only when it is due', () => {
  const s = createSession(0);
  callFinale(s);
  assert.equal(s.finaleTriggered, false);
});

test('the Lookout is one of the places, but never the mission right before the finale', () => {
  const s = createSession(0); // 2 missions, then the finale
  const firsts = KINDS.map((_, i) => suggestNext(s, KINDS, () => (i + 0.5) / KINDS.length));
  assert.deepEqual(firsts, KINDS, 'first mission: every place equally, the Lookout too');
  completeMission(s, 'letters', 1);
  const seconds = new Set(Array.from({ length: 200 }, () => suggestNext(s, KINDS, Math.random)));
  assert.deepEqual([...seconds].sort(), ['cones', 'counting', 'stones'], 'a number game, but not the Lookout: the finale is next');
  completeMission(s, 'lookout', 2);
  assert.equal(s.missionsCompleted, 2, 'played as the 2nd mission anyway, it still counts as a mission');
  assert.equal(suggestNext(s, KINDS), 'lookout', 'then the finale');
});

test('suggestions: fresh places, letters ↔ numbers', () => {
  const s = createSession(0, { targetMissions: 10 });
  completeMission(s, 'letters', 1);
  for (let i = 0; i < 50; i++) {
    const k = suggestNext(s, KINDS, Math.random);
    assert.equal(DOMAIN[k], 'numbers', 'after a letter game: a number game');
  }
  completeMission(s, 'cones', 2);
  for (let i = 0; i < 50; i++) {
    const k = suggestNext(s, KINDS, Math.random);
    assert.equal(DOMAIN[k], 'letters');
    assert.notEqual(k, 'letters', 'already played this session');
  }
});

test('suggestions: when everything was played, anything but the last one', () => {
  const s = createSession(0, { targetMissions: 99 });
  for (const k of KINDS) completeMission(s, k, 1);
  completeMission(s, 'balloons', 2);
  for (let i = 0; i < 50; i++) assert.notEqual(suggestNext(s, KINDS, Math.random), 'balloons');
});

test('suggestions: only one place available', () => {
  const s = createSession(0);
  completeMission(s, 'letters', 1);
  assert.equal(suggestNext(s, ['letters', 'lookout'], first), 'letters');
  assert.equal(suggestNext(s, ['lookout'], first), null);
});

test('noteEvent keeps a short recent history for fatigue checks', () => {
  const s = createSession(0);
  for (let i = 0; i < SESSION.recentLimit + 5; i++) noteEvent(s, { correct: true, latencyMs: i, assistLevel: i % 4, at: 10 + i });
  noteEvent(s, { correct: false, errorType: 'timeout', at: 99 });
  assert.equal(s.recentLatency.length, SESSION.recentLimit);
  assert.equal(s.recentLatency[0], 5, 'oldest dropped');
  assert.equal(s.recentAssistLevels.length, SESSION.recentLimit);
  assert.deepEqual(s.recentErrors, ['timeout']);
  assert.equal(s.lastActiveAt, 99);
});

test('isStale: a long break starts a new session', () => {
  const s = createSession(0);
  assert.equal(isStale(s, SESSION.newSessionAfterMs), false);
  assert.equal(isStale(s, SESSION.newSessionAfterMs + 1), true);
  assert.equal(isStale(null, 0), true);
});

test('summary is what gets saved', () => {
  const s = createSession(100);
  completeMission(s, 'name', 500);
  assert.deepEqual(summary(s), { id: 100, startedAt: 100, endedAt: 500, missions: ['name'], finale: false });
});

test('summary keeps the biggest mastery changes of the session (for the grown-ups\' page)', () => {
  const s = createSession(0);
  s.changes = {
    'letterVisual|B': { skill: 'letterVisual', item: 'B', from: 0.2, to: 0.5 },
    'numeral|3': { skill: 'numeral', item: '3', from: 0.5, to: 0.505 }, // too small to mention
    'quantity|4': { skill: 'quantity', item: '4', from: 0.6, to: 0.4 },
  };
  completeMission(s, 'letters', 1);
  assert.deepEqual(summary(s).changes.map((c) => c.item), ['B', '4']);
  assert.equal(summary(createSession(0)).changes, undefined, 'nothing moved: no field');
});
