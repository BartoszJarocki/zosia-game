import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWatch, judgeFrame } from '../../src/fx/quality.js';

/** Feed `seconds` of frames `ms` apart (full rate or calm); returns the verdicts given. */
function play(w, seconds, ms, full) {
  const out = [];
  for (let t = ms; t <= seconds * 1000; t += ms) { const v = judgeFrame(w, ms / 1000, full); if (v) out.push(v); }
  return out;
}

test('10 s of calm 30 fps frames (nothing moving) give no verdict; the same frames at full rate are slow', () => {
  assert.deepEqual(play(createWatch(), 10, 33.3, false), []);
  assert.deepEqual(play(createWatch(), 10, 33.3, true), ['slow', 'slow', 'slow']);
});

test('a fast device rendering at full rate: "fast" after two good windows, never "slow"', () => {
  assert.deepEqual(play(createWatch(), 10, 16.7, true), ['fast']);
});

test('a slow device rendering at full rate (30 fps): "slow" after 3 s', () => {
  assert.deepEqual(play(createWatch(), 3.5, 33.3, true), ['slow']);
});

test('calm frames between bursts of full-rate frames do not drag a fast device down', () => {
  const w = createWatch(), out = [];
  for (let burst = 0; burst < 6; burst++) out.push(...play(w, 2.5, 16.7, true), ...play(w, 5, 33.3, false));
  assert.deepEqual(out, ['fast', 'fast']);
});

test('one fast window, then a middling one: the count of fast windows starts again', () => {
  const w = createWatch();
  assert.deepEqual([...play(w, 3.1, 16.7, true), ...play(w, 3.1, 20, true), ...play(w, 3.1, 16.7, true)], []);
  assert.deepEqual(play(w, 3.1, 16.7, true), ['fast']);
});
