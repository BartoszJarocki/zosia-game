import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, solvedText, sectionReports, sectionOf, overview, maxNumber, FEW } from '../../src/parent/report.js';
import { emptyStat, applyEvent } from '../../src/learning/mastery.js';
import { makeEvent, SKILLS } from '../../src/learning/events.js';

const stat = (o) => ({ ...emptyStat(), ...o });

test('summarize: never seen → null', () => {
  assert.equal(summarize(undefined), null);
  assert.equal(summarize(emptyStat()), null);
});

test('summarize: solves apart, seconds, top confusions, little data flag', () => {
  const s = summarize(stat({ solved: 5, firstTry: 2, helped: 1, attempts: 4, correctFirstTry: 3, assisted: 1, avgLatencyMs: 2345, mastery: 0.61, wrong: 2, confusions: { P: 1, D: 3, B: 2, R: 1 } }));
  assert.deepEqual([s.solved, s.firstTry, s.afterError, s.helped], [5, 2, 2, 1]);
  assert.equal(solvedText(s), '5 solved (2 first try, 2 after an error, 1 after help)');
  assert.equal(s.avgLatencyS, 2.3);
  assert.deepEqual(s.confusions, ['D', 'B', 'P']);
  assert.equal(s.few, false);
  assert.equal(summarize(stat({ attempts: FEW - 1 })).few, true);
});

test('summarize: only wrong taps so far still shows up, as not solved yet', () => {
  const s = summarize(stat({ wrong: 2 }));
  assert.equal(s.attempts, 0);
  assert.equal(solvedText(s), 'not solved yet');
  assert.equal(s.avgLatencyS, null);
});

test('summarize: a solve that could not be got wrong shows up; an older save says since when it counts', () => {
  const lastStar = summarize(stat({ solved: 1, firstTry: 1 }));
  assert.equal(lastStar.attempts, 0, 'nothing for mastery');
  assert.equal(solvedText(lastStar), '1 solved (1 first try)');
  assert.equal(solvedText(summarize(stat({ attempts: 6, mastery: 0.7 })), '13 November 2026'), 'none solved since 13 November 2026');
  assert.equal(solvedText(summarize(stat({ wrong: 1 })), '13 November 2026'), 'none solved since 13 November 2026');
});

test('a section: one row per practised skill, unseen items marked', () => {
  const skills = { letterVisual: { B: stat({ attempts: 5, mastery: 0.9 }) }, letterAudio: { B: stat({ attempts: 1, mastery: 0.2 }) } };
  const [b, z] = sectionReports(skills, 'letters', ['B', 'Z']);
  assert.equal(b.seen, true);
  assert.deepEqual(b.rows.map((r) => r.skill), ['letterVisual', 'letterAudio']);
  assert.equal(b.rows[0].label, 'sees it');
  assert.equal(z.seen, false);
  assert.equal(z.rows.length, 0);
});

test('a section: numbers are matched by their string key', () => {
  const [four] = sectionReports({ numeral: { 4: stat({ attempts: 2, mastery: 0.4 }) } }, 'numbers', [4]);
  assert.equal(four.item, '4');
  assert.equal(four.seen, true);
});

test('overview: totals, weighted latency, difficult and recent items', () => {
  const skills = {
    letterVisual: {
      A: stat({ solved: 6, firstTry: 6, guessable: 6, guessableFirstTry: 6, attempts: 6, avgLatencyMs: 1000, mastery: 0.9, lastSeenAt: 30 }),
      P: stat({ solved: 4, helped: 4, guessable: 4, attempts: 4, avgLatencyMs: 4000, mastery: 0.2, lastSeenAt: 20 }),
    },
    numeral: { 3: stat({ solved: 2, firstTry: 1, guessable: 2, guessableFirstTry: 1, attempts: 2, avgLatencyMs: 2000, mastery: 0.5, lastSeenAt: 40 }) },
  };
  const o = overview(skills);
  assert.deepEqual(overview({ letterVisual: { A: stat({ solved: 3, firstTry: 2 }) }, sequence: { 6: stat({ solved: 2, firstTry: 1, helped: 1 }) } }).solves,
    { solved: 5, firstTry: 3, afterError: 1, helped: 1 }, 'every solve, scored or not');
  assert.equal(o.firstTryPct, 58);
  assert.equal(o.helpPct, 33);
  assert.equal(o.avgLatencyS, 2.2); // (6×1 + 4×4 + 2×2) / 12 = 2.17 s
  assert.deepEqual(o.difficult.map((x) => x.item), ['P']);
  assert.equal(o.familiar, 1);
  assert.deepEqual(o.recent.map((x) => x.item), ['3', 'A', 'P']);
});

test('overview: empty save', () => {
  const o = overview({});
  assert.deepEqual([o.solves.solved, o.firstTryPct, o.chancePct, o.helpPct], [0, null, null, null], 'no share of nothing');
  assert.equal(o.avgLatencyS, null);
  assert.deepEqual(o.difficult, []);
});

test('maxNumber: highest number any level can ask about', () => {
  assert.equal(maxNumber({ cones: [{ max: 3 }, { max: 6 }], stones: [{ n: 7 }], counting: [{ give: [1, 3] }, { give: [2, 5], howMany: [1, 4] }], lookout: [{ max: 5 }] }), 7);
  assert.equal(maxNumber({}), 3);
});

import { sessionStats, recentChanges } from '../../src/parent/report.js';

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

import { itemLabel, neverAsked, missionStatus, COMPARE_ITEMS } from '../../src/parent/report.js';

test('itemLabel: Picnic comparisons in words, numbers and letters as they are', () => {
  assert.equal(itemLabel('comparison', 'less'), 'less');
  assert.equal(itemLabel('comparison', 'same#'), 'the same (with numbers)');
  assert.equal(itemLabel('numeral', 4), '4');
  assert.equal(itemLabel('letterVisual', 'B'), 'B');
});

test('Picnic gets its own rows, and chips name comparisons in words', () => {
  const skills = { comparison: { 'more#': stat({ attempts: 4, mastery: 0.1, lastSeenAt: 5 }), less: stat({ attempts: 2, mastery: 0.6 }) } };
  const rows = sectionReports(skills, 'compare', COMPARE_ITEMS);
  assert.deepEqual(rows.filter((r) => r.seen).map((r) => r.item), ['less', 'more#']);
  assert.equal(rows[1].rows[0].label, 'compares');
  const o = overview(skills);
  assert.deepEqual(o.difficult.map((x) => x.name), ['more (with numbers)']);
});

test('overview: the guess figure comes from the options each answer had, whatever its skill', () => {
  const skills = {};
  const answer = (skill, item, options, more = {}) => applyEvent(skills, makeEvent({ mission: 'm', skill, item, correct: true, firstTry: true, options, ...more }));
  for (let i = 0; i < 4; i++) answer('counting', '3', 4); // a count she makes at the Lighthouse: 2 to 5
  answer('sequence', '2', 2);
  answer('syllables', 'FOKA', 3);
  answer('sequence', '6', 1); // the last star: a guess could not miss
  answer('syllables', 'MEWA', 2, { answerOnScreen: true }); // the pieces were on the board
  const o = overview(skills);
  assert.equal(o.solves.solved, 8);
  assert.equal(o.firstTryPct, 100);
  assert.equal(o.chancePct, 31, '(4 × 1/4 + 1/2 + 1/3) / 6');
});

test('neverAsked: letters no question has asked yet', () => {
  const skills = { letterVisual: { A: stat({ attempts: 2 }) }, letterSound: { M: stat({ wrong: 1 }) }, letterAudio: { B: emptyStat() } };
  assert.deepEqual(neverAsked(skills, 'ABMZ'), ['B', 'Z']);
  assert.deepEqual(neverAsked({}, 'AB'), ['A', 'B']);
});

test('missionStatus: good runs to the next star, the last run, gentler or not, played or not', () => {
  assert.deepEqual(missionStatus({ level: 2, max: 4, good: 1, lastAcc: 0.75, runs: 5, need: 2, gentle: false }),
    { level: 2, max: 4, top: false, gentle: false, played: 'Completed', next: '1 of 2 good runs to the next star', last: 'last run 75% right first time' });
  const top = missionStatus({ level: 3, max: 3, good: 0, lastAcc: 0.4, runs: 9, need: 2, gentle: true });
  assert.equal(top.next, 'top level');
  assert.equal(top.gentle, true);
  assert.equal(missionStatus({ level: 1, max: 4, lastAcc: 1, runs: 0 }).last, null);
  assert.equal(missionStatus({ level: 1, max: 4, lastAcc: 1, runs: 0, starts: 2 }).played, 'Started');
});

test('names and Garage items are listed as she meets them', () => {
  const skills = { wordVisual: { ZOSIA: stat({ attempts: 2 }), MAMA: stat({ attempts: 1 }) }, shape: { circle: stat({ attempts: 1 }) }, sorting: { red: stat({ attempts: 3 }) } };
  const items = (section, s = skills) => sectionReports(s, section).map((r) => r.item);
  assert.deepEqual([items('names'), items('garage'), items('names', {})], [['MAMA', 'ZOSIA'], ['circle', 'red'], []]);
});

test('every solve has a row: each skill has a section, and its items she met beyond the fixed lists are listed', () => {
  assert.deepEqual(SKILLS.filter((skill) => !sectionOf(skill, 'x')), [], 'a section for every skill');
  const skills = {
    syllables: { FOKA: stat({ solved: 1 }), 2: stat({ solved: 2 }) }, // the Port: a name, and level 3's "which boat has two pieces"
    comparison: { more: stat({ solved: 1 }), bigger: stat({ solved: 1 }), smaller: stat({ solved: 1 }) }, // Pup Picnic and Jupiter
    sequence: { 4: stat({ solved: 1 }), 'space:mars': stat({ solved: 1 }) }, // a star, and the Telescope's "after Mars"
    counting: { 12: stat({ solved: 1 }) },
  };
  const fixed = { syllables: ['FOKA', 'KOT'], compare: COMPARE_ITEMS, numbers: [1, 2, 3, 4] };
  const rows = ['letters', 'space', 'position', 'syllables', 'numbers', 'compare', 'names', 'garage']
    .flatMap((section) => sectionReports(skills, section, fixed[section]).flatMap((r) => r.rows.map((row) => ({ section, item: r.item, solved: row.solved }))));
  assert.equal(rows.reduce((n, r) => n + r.solved, 0), overview(skills).solves.solved);
  assert.deepEqual(rows.map((r) => `${r.section} ${r.item}`), ['space space:mars', 'syllables FOKA', 'syllables 2', 'numbers 4', 'numbers 12', 'compare more', 'compare bigger', 'compare smaller']);
  assert.deepEqual([itemLabel('syllables', '2'), itemLabel('comparison', 'bigger'), itemLabel('space', 'space:mars')], ['which boat has 2 syllables', 'the bigger planet', 'after Mars']);
});


test('Space lists met places with the usual per-item lines and English names', () => {
  const skills = { space: {
    saturn: stat({ attempts: 4, correctFirstTry: 3, assisted: 1, avgLatencyMs: 2000, mastery: 0.6, confusions: { moon: 2 }, lastSeenAt: 20 }),
    moon: stat({ wrong: 1 }),
  }, sequence: { 'space:mars': stat({ attempts: 1, mastery: 0.2 }) } };
  assert.deepEqual(sectionReports(skills, 'space').map((r) => r.item), ['moon', 'saturn', 'space:mars']);
  assert.deepEqual(sectionReports(skills, 'space')[1], {
    item: 'saturn', seen: true, rows: [{ skill: 'space', label: 'recognises it',
      mastery: 0.6, attempts: 4, solved: 0, firstTry: 0, afterError: 0, helped: 0, avgLatencyS: 2, wrong: 0,
      confusions: ['moon'], few: false, lastSeenAt: 20 }],
  });
  assert.equal(sectionReports(skills, 'space')[2].rows[0].label, 'order');
  assert.deepEqual(['saturn', 'moon', 'blackhole'].map((k) => itemLabel('space', k)), ['Saturn', 'the Moon', 'the black hole']);
  assert.equal(itemLabel('sequence', 'space:mars'), 'after Mars');
  assert.equal(overview(skills).recent[0].name, 'Saturn');
});
