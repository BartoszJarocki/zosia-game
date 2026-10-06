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
