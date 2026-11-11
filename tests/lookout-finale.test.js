import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const noop = () => {};
globalThis.window = { addEventListener: noop, removeEventListener: noop };
globalThis.location = { search: '' };
globalThis.document = { createElement() {
  const canvas = { width: 0, height: 0 };
  const ctx = new Proxy({ canvas, createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 30 }) }, { get: (o, k) => k in o ? o[k] : noop });
  canvas.getContext = () => ctx;
  return canvas;
} };
globalThis.document.querySelectorAll = () => [];
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
globalThis.__lines = [];

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x, in: (x) => x };
    export const animate = async (ms, fn) => { for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t); };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `
    const earned = {};
    export const badges = { get: () => earned, add: (kind) => { earned[kind] = (earned[kind] || 0) + 1; return earned; } };
    export const missionHud = (options) => { globalThis.__hud = options; globalThis.__progress = []; globalThis.__celebration = null; };
    export const bubble = (options) => { globalThis.__bubble = options; };
    export const hideBubble = () => {};
    export const nudgeBubble = () => {};
    export const setProgress = (n) => globalThis.__progress.push(n);
    export const setRounds = () => {};
    export const celebrate = (options) => { globalThis.__celebration = options; };
    export const liftPanel = () => new Proxy({}, { get: () => () => {} });`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { LookoutMission } = await import('../src/scenes/lookout.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { T } = await import('../src/lang/pl.js');
const { dev } = await import('../src/progress.js');
const { startSession, getSession, missionDone } = await import('../src/session/session.js');
const { nextStep } = await import('../src/session/director.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const flush = () => new Promise(setImmediate);
const savedLevel = () => JSON.parse(saved.get('pup-patrol-progress')).missions.lookout.level;

/** The session's finale is due (two missions done), she is at this Lookout level; play it to the celebration. */
async function finale(level, { missFirstRide = false } = {}) {
  CONFIG.level = null;
  dev.setLevel('lookout', level);
  startSession();
  missionDone('letters');
  missionDone('cones');
  assert.equal(nextStep(getSession()), 'finale');
  globalThis.__lines = [];
  const s = new LookoutMission({ home() {}, startMission() {} });
  const bubbles = [];
  s.enter(); s.collect(); optimizeScene(s.scene);
  let missed = !missFirstRide;
  for (let step = 0; step < 2000 && !globalThis.__celebration; step++) {
    if (s.learn?.isOpen && s.onPress) {
      bubbles.push(globalThis.__bubble);
      if (!missed) { missed = true; s.onPress(s.last === 1 ? 2 : 1); }
      await s.onPress(s.last);
    }
    s.update(0.05, step * 0.05);
    await flush();
  }
  assert.ok(globalThis.__celebration, `celebrated: round ${s.roundIndex}, ${s.answers.length} answers`);
  s.alive = false; s.exit(); await flush();
  return { s, bubbles, lines: globalThis.__lines, celebration: globalThis.__celebration };
}

test('the finale rides at her Lookout level, and a perfect ride moves her up two levels', async () => {
  const { s, bubbles, lines, celebration } = await finale(3);
  assert.equal(s.finale, true);
  assert.equal(s.answers.length, LEVELS.lookout[2].rounds, 'every ride of her level, not one easy kitten');
  assert.equal(bubbles[0].big, '?', 'level 3 is find: the bubble keeps the floor to herself');
  assert.ok(lines.includes(T.finaleStart()[0]), 'the alarm still opens it');
  assert.ok(lines.includes(T.finaleDone()[0]), 'and the finale\'s own ending closes it');
  assert.ok(lines.includes(T.levelUp(5)[0]));
  assert.deepEqual([celebration.level, celebration.gained], [5, 2]);
  assert.equal(savedLevel(), 5);
  assert.equal(getSession().finaleDone, true);
});

test('a finale with one wrong tap still counts: one level up', async () => {
  const { s, celebration } = await finale(2, { missFirstRide: true });
  assert.equal(s.answers.length, 3);
  assert.equal(s.answers[0].firstTry, false);
  assert.deepEqual([celebration.level, celebration.gained], [3, 1]);
  assert.equal(savedLevel(), 3);
});
