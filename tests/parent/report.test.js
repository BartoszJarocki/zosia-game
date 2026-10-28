import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, itemReports, overview, maxNumber, LETTER_SKILLS, FEW } from '../../src/parent/report.js';
import { emptyStat } from '../../src/learning/mastery.js';

const stat = (o) => ({ ...emptyStat(), ...o });

test('summarize: never seen → null', () => {
  assert.equal(summarize(undefined), null);
  assert.equal(summarize(emptyStat()), null);
});

test('summarize: percentages, seconds, top confusions, little data flag', () => {
  const s = summarize(stat({ attempts: 4, correctFirstTry: 3, assisted: 1, avgLatencyMs: 2345, mastery: 0.61, wrong: 2, confusions: { P: 1, D: 3, B: 2, R: 1 } }));
  assert.equal(s.firstTryPct, 75);
  assert.equal(s.assistPct, 25);
  assert.equal(s.avgLatencyS, 2.3);
  assert.deepEqual(s.confusions, ['D', 'B', 'P']);
  assert.equal(s.few, false);
  assert.equal(summarize(stat({ attempts: FEW - 1 })).few, true);
});

test('summarize: only wrong taps so far still shows up (no division by zero)', () => {
  const s = summarize(stat({ wrong: 2 }));
  assert.equal(s.attempts, 0);
  assert.equal(s.firstTryPct, 0);
  assert.equal(s.avgLatencyS, null);
});

test('itemReports: one row per practised skill, unseen items marked', () => {
  const skills = { letterVisual: { B: stat({ attempts: 5, mastery: 0.9 }) }, letterAudio: { B: stat({ attempts: 1, mastery: 0.2 }) } };
  const [b, z] = itemReports(skills, LETTER_SKILLS, ['B', 'Z']);
  assert.equal(b.seen, true);
  assert.deepEqual(b.rows.map((r) => r.skill), ['letterVisual', 'letterAudio']);
  assert.equal(b.rows[0].label, 'sees it');
  assert.equal(z.seen, false);
  assert.equal(z.rows.length, 0);
});

test('itemReports: numbers are matched by their string key', () => {
  const [four] = itemReports({ numeral: { 4: stat({ attempts: 2, mastery: 0.4 }) } }, [['numeral', 'numeral']], [4]);
  assert.equal(four.item, '4');
  assert.equal(four.seen, true);
});

test('overview: totals, weighted latency, difficult and recent items', () => {
  const skills = {
    letterVisual: {
      A: stat({ attempts: 6, correctFirstTry: 6, avgLatencyMs: 1000, mastery: 0.9, lastSeenAt: 30 }),
      P: stat({ attempts: 4, correctFirstTry: 0, assisted: 4, avgLatencyMs: 4000, mastery: 0.2, lastSeenAt: 20 }),
    },
    numeral: { 3: stat({ attempts: 2, correctFirstTry: 1, avgLatencyMs: 2000, mastery: 0.5, lastSeenAt: 40 }) },
  };
  const o = overview(skills);
  assert.equal(o.attempts, 12);
  assert.equal(o.firstTryPct, 58);
  assert.equal(o.assistPct, 33);
  assert.equal(o.avgLatencyS, 2.2); // (6×1 + 4×4 + 2×2) / 12 = 2.17 s
  assert.deepEqual(o.difficult.map((x) => x.item), ['P']);
  assert.equal(o.familiar, 1);
  assert.deepEqual(o.recent.map((x) => x.item), ['3', 'A', 'P']);
});

test('overview: empty save', () => {
  const o = overview({});
  assert.equal(o.attempts, 0);
  assert.equal(o.avgLatencyS, null);
  assert.deepEqual(o.difficult, []);
});

test('maxNumber: highest number any level can ask about', () => {
  assert.equal(maxNumber({ cones: [{ max: 3 }, { max: 6 }], stones: [{ n: 7 }], counting: [{ give: [1, 3] }, { give: [2, 5], howMany: [1, 4] }], lookout: [{ max: 5 }] }), 7);
  assert.equal(maxNumber({}), 3);
});

import { sessionStats, recentChanges, totalAssisted } from '../../src/parent/report.js';

test('sessionStats: count, average length, this week, finales and early ends', () => {
  const now = 10 * 86_400_000;
  const s = sessionStats({ count: 5, recent: [
    { startedAt: now - 9 * 86_400_000, endedAt: now - 9 * 86_400_000 + 6 * 60000, finale: true },
    { startedAt: now - 60000 * 30, endedAt: now - 60000 * 22, finale: false, early: true },
  ] }, now);
  assert.deepEqual(s, { count: 5, avgMinutes: 7, lastWeek: 1, finales: 1, early: 1 });
  assert.deepEqual(sessionStats(undefined, now), { count: 0, avgMinutes: null, lastWeek: 0, finales: 0, early: 0 });
});

test('recentChanges: earliest from, latest to, biggest first, tiny ones dropped', () => {
  const sessions = { recent: [
    { changes: [{ skill: 'letterVisual', item: 'B', from: 0.2, to: 0.4 }, { skill: 'numeral', item: '3', from: 0.5, to: 0.52 }] },
    { changes: [{ skill: 'letterVisual', item: 'B', from: 0.4, to: 0.7 }, { skill: 'quantity', item: '4', from: 0.6, to: 0.45 }] },
  ] };
  const c = recentChanges(sessions);
  assert.deepEqual(c.map((x) => [x.item, x.delta]), [['B', 0.5], ['4', -0.15]]);
  assert.equal(c[0].label, 'sees it');
});

test('totalAssisted adds up every skill', () => {
  assert.equal(totalAssisted({ letterVisual: { A: { assisted: 2 } }, numeral: { 1: { assisted: 3 }, 2: {} } }), 5);
  assert.equal(totalAssisted(undefined), 0);
});

import { itemLabel, neverAsked, missionStatus, COMPARE_SKILLS, COMPARE_ITEMS } from '../../src/parent/report.js';

test('itemLabel: Picnic comparisons in words, numbers and letters as they are', () => {
  assert.equal(itemLabel('comparison', 'less'), 'less');
  assert.equal(itemLabel('comparison', 'same#'), 'the same (with numbers)');
  assert.equal(itemLabel('numeral', 4), '4');
  assert.equal(itemLabel('letterVisual', 'B'), 'B');
});

test('Picnic gets its own rows, and chips name comparisons in words', () => {
  const skills = { comparison: { 'more#': stat({ attempts: 4, correctFirstTry: 1, mastery: 0.1, lastSeenAt: 5 }), less: stat({ attempts: 2, mastery: 0.6 }) } };
  const rows = itemReports(skills, COMPARE_SKILLS, COMPARE_ITEMS);
  assert.deepEqual(rows.filter((r) => r.seen).map((r) => r.item), ['less', 'more#']);
  assert.equal(rows[1].rows[0].label, 'compares');
  assert.equal(rows[1].rows[0].chancePct, 50);
  const o = overview(skills);
  assert.deepEqual(o.difficult.map((x) => x.name), ['more (with numbers)']);
  assert.equal(o.chancePct, 50);
});

test('overview: first-try % comes with what guessing alone would get on the same questions', () => {
  const o = overview({ letterVisual: { A: stat({ attempts: 6, correctFirstTry: 5 }) }, counting: { 3: stat({ attempts: 3, correctFirstTry: 3 }) }, sequence: { 2: stat({ attempts: 3, correctFirstTry: 2 }) } });
  assert.equal(o.firstTryPct, 83);
  assert.equal(o.chancePct, 29); // (6 × 1/3 + 3 × 0 + 3 × 1/2) / 12 = 3.5 / 12
});

test('neverAsked: letters no question has asked yet', () => {
  const skills = { letterVisual: { A: stat({ attempts: 2 }) }, letterSound: { M: stat({ wrong: 1 }) }, letterAudio: { B: emptyStat() } };
  assert.deepEqual(neverAsked(skills, 'ABMZ'), ['B', 'Z']);
  assert.deepEqual(neverAsked({}, 'AB'), ['A', 'B']);
});

test('missionStatus: good runs to the next star, the last run, gentler or not', () => {
  assert.deepEqual(missionStatus({ level: 2, max: 4, good: 1, lastAcc: 0.75, runs: 5, need: 2, gentle: false }),
    { level: 2, max: 4, top: false, gentle: false, next: '1 of 2 good runs to the next star', last: 'last run 75% right first time' });
  const top = missionStatus({ level: 3, max: 3, good: 0, lastAcc: 0.4, runs: 9, need: 2, gentle: true });
  assert.equal(top.next, 'top level');
  assert.equal(top.gentle, true);
  assert.equal(missionStatus({ level: 1, max: 4, lastAcc: 1, runs: 0 }).last, 'not played yet');
});
