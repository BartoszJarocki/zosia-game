import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickLearningItem, categorize, MIX } from '../../src/learning/scheduler.js';

/** Deterministic random numbers. */
function rngFrom(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
const stat = (mastery, attempts = 5) => ({ mastery, attempts, lastSeenAt: 0 });

test('categories', () => {
  assert.equal(categorize(undefined), 'new');
  assert.equal(categorize({ attempts: 0, mastery: 0 }), 'new');
  assert.equal(categorize(stat(0.9)), 'familiar');
  assert.equal(categorize(stat(0.5)), 'learning');
  assert.equal(categorize(stat(0.1, 4)), 'difficult');
  assert.equal(categorize(stat(0.1, 2)), 'learning', 'too few tries to call it difficult');
});

test('one candidate: that one; never the same twice in a row', () => {
  assert.equal(pickLearningItem({ candidates: ['B'] }), 'B');
  const rng = rngFrom(1);
  for (let i = 0; i < 200; i++) assert.notEqual(pickLearningItem({ candidates: ['A', 'B'], recent: ['A'], rng }), 'A');
});

const shares = (candidates, stats, opts = {}) => {
  const rng = rngFrom(7), counts = { learning: 0, familiar: 0, difficult: 0, new: 0 }, N = 20000;
  for (let i = 0; i < N; i++) counts[categorize(stats[pickLearningItem({ candidates, stats, rng, ...opts })])]++;
  return Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, Math.round((100 * n) / N)]));
};

test('once nearly everything has been asked, the mix follows 50 / 30 / 15 / 5', () => {
  const stats = {};
  for (const c of 'ABCDEFG') stats[c] = stat(0.5);   // learning
  for (const c of 'HIJKLM') stats[c] = stat(0.9);    // familiar
  for (const c of 'NOPRST') stats[c] = stat(0.1);    // difficult
  // U is new (1 of 20)
  const s = shares([...'ABCDEFGHIJKLMNOPRSTU'], stats);
  for (const k of Object.keys(MIX)) assert.ok(Math.abs(s[k] - MIX[k] * 100) <= 3, `${k}: ${s[k]}% vs ${MIX[k] * 100}%`);
});

test('while much of the pool is unseen, unseen items get about that share of turns', () => {
  const stats = {};
  for (const c of 'ABCD') stats[c] = stat(0.5);   // learning
  for (const c of 'EFGH') stats[c] = stat(0.9);   // familiar
  for (const c of 'IJKL') stats[c] = stat(0.1);   // difficult
  // M N O P are new: a quarter of the pool
  assert.deepEqual(shares([...'ABCDEFGHIJKLMNOP'], stats), { learning: 39, familiar: 24, difficult: 12, new: 25 });
});

test('a tired mix asks nothing new, however much is unseen', () => {
  const stats = { A: stat(0.5), B: stat(0.9) };
  assert.deepEqual(shares([...'ABCDEFGHIJ'], stats, { mix: { learning: 0.6, familiar: 0.4 } }), { learning: 60, familiar: 40, difficult: 0, new: 0 });
});

test('easy successes stay frequent even when most items are weak', () => {
  const stats = { A: stat(0.9), B: stat(0.1), C: stat(0.1), D: stat(0.1), E: stat(0.1) };
  const rng = rngFrom(3);
  let easy = 0;
  for (let i = 0; i < 5000; i++) if (pickLearningItem({ candidates: 'ABCDE'.split(''), stats, rng }) === 'A') easy++;
  assert.ok(easy / 5000 > 0.25, `familiar item share ${(easy / 5000).toFixed(2)}`);
});

test('a weak item does not take over a session', () => {
  const stats = { B: stat(0.05, 10), M: stat(0.9), T: stat(0.85), A: stat(0.6) };
  const rng = rngFrom(11), recent = [];
  let maxRun = 0, run = 0, prev = null, bInWindow = 0;
  for (let i = 0; i < 300; i++) {
    const it = pickLearningItem({ candidates: ['B', 'M', 'T', 'A'], stats, recent: recent.slice(-6), rng });
    run = it === prev ? run + 1 : 1; maxRun = Math.max(maxRun, run); prev = it;
    recent.push(it);
    if (i >= 3) bInWindow = Math.max(bInWindow, recent.slice(-4).filter((x) => x === 'B').length);
  }
  assert.equal(maxRun, 1, 'never repeats back-to-back');
  assert.ok(bInWindow <= 2, `B appears at most twice in any 4 picks (got ${bInWindow})`);
});

test('a brand-new player just gets new items (any of them)', () => {
  const rng = rngFrom(5), seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(pickLearningItem({ candidates: ['Z', 'O', 'S', 'I', 'A'], rng }));
  assert.equal(seen.size, 5);
});

test('items not seen for a while are preferred within a bucket', () => {
  const now = 10 * 86_400_000;
  const stats = { A: { mastery: 0.5, attempts: 5, lastSeenAt: now - 60_000 }, B: { mastery: 0.5, attempts: 5, lastSeenAt: now - 3 * 86_400_000 } };
  const rng = rngFrom(9);
  let b = 0;
  for (let i = 0; i < 4000; i++) if (pickLearningItem({ candidates: ['A', 'B'], stats, now, rng }) === 'B') b++;
  assert.ok(b / 4000 > 0.6, `stale item share ${(b / 4000).toFixed(2)}`);
});

test('a custom mix can ask for only easy items (for "one more!")', () => {
  const stats = { A: stat(0.9), B: stat(0.1), C: stat(0.5) };
  const rng = rngFrom(2);
  for (let i = 0; i < 100; i++) assert.equal(pickLearningItem({ candidates: ['A', 'B', 'C'], stats, rng, mix: { familiar: 1 } }), 'A');
});

test('a small bucket does not ping-pong (no long A B A B runs)', () => {
  const stats = { T: stat(0.4), I: stat(0.45), Z: stat(0.9), O: stat(0.9), S: stat(0.85), A: stat(0.9) };
  const rng = rngFrom(21), recent = [];
  let longest = 0, run = 0;
  for (let i = 0; i < 400; i++) {
    const it = pickLearningItem({ candidates: Object.keys(stats), stats, recent: recent.slice(-6), rng });
    const pingPong = recent.length >= 2 && it === recent[recent.length - 2] && 'TI'.includes(it) && 'TI'.includes(recent[recent.length - 1]);
    run = pingPong ? run + 1 : 0; longest = Math.max(longest, run);
    recent.push(it);
  }
  assert.ok(longest <= 2, `longest T/I ping-pong ${longest}`);
});
