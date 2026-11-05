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
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
globalThis.__lines = [];
globalThis.__animations = [];

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const renderer = { getRenderTarget: () => null, setRenderTarget: () => {}, render: () => {} };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x };
    export const animate = async (ms, fn) => {
      globalThis.__animations.push(ms);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t);
    };
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
    export const celebrate = (options) => { globalThis.__celebration = options; };`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { PlutoMission } = await import('../src/scenes/pluto.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { learning } = await import('../src/learning/events.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const { T } = await import('../src/lang/pl.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 250; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };
const heart = (s) => s.tappables.find((o) => o.userData.choice === 'heart');

async function scene(level = 1) {
  CONFIG.level = level;
  const s = new PlutoMission({});
  s.build(); s.collect(); optimizeScene(s.scene);
  await s.landed;
  return s;
}

test('one wrong tap names the shape and does not score or fill the heart', async () => {
  const s = await scene(1);
  const task = s.round(0);
  await until(() => s.phase === 'choosing' && s.tappables.length >= 2);
  assert.equal(s.last, 'heart');
  assert.equal(s.tappables.length, 2);
  assert.ok(heart(s));
  const wrong = s.tappables.find((o) => o.userData.choice !== 'heart');
  await wrong.userData.onTap();
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  assert.equal(s.heartLevel, 0);
  assert.ok(globalThis.__lines.includes(T.plutoWrong(wrong.userData.choice)[0]));
  await heart(s).userData.onTap();
  await task;
  stop(s);
});

test('a right tap floats one heart in, scores it and brightens Pluto', async () => {
  const s = await scene(1);
  const task = s.round(0);
  await until(() => s.phase === 'choosing');
  await heart(s).userData.onTap();
  await task;
  assert.equal(s.answers.length, 1);
  assert.equal(s.answers[0].skill, 'shape');
  assert.equal(s.answers[0].item, 'heart');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, true);
  assert.equal(s.answers[0].options, 2);
  assert.ok(Math.abs(s.heartLevel - 1 / 3) < 1e-9);
  assert.equal(s.tappables.length, 0);
  assert.equal(s.pieces.length, 0);
  stop(s);
});

test('a wrong first tap is remembered when the heart is found on the retry', async () => {
  const s = await scene(2);
  const task = s.round(0);
  await until(() => s.phase === 'choosing');
  await s.tappables.find((o) => o.userData.choice !== 'heart').userData.onTap();
  await heart(s).userData.onTap();
  await task;
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.answers[0].scored, true);
  stop(s);
});

test('every right answer fills the heart until the last one shines fully', async () => {
  const s = await scene(4);
  assert.equal(s.rounds, 3);
  for (let r = 0; r < s.rounds; r++) {
    const task = s.round(r);
    await until(() => s.phase === 'choosing' && s.tappables.some((o) => o.userData.choice === 'heart'));
    assert.equal(s.last, 'heart');
    assert.equal(s.tappables.length, 4);
    await heart(s).userData.onTap();
    await task;
  }
  assert.ok(Math.abs(s.heartLevel - 1) < 1e-9);
  assert.equal(s.pieces.length, 0);
  stop(s);
});

test('every Pluto level runs through base progress and celebration, and counts for the session', async () => {
  for (let level = 1; level <= 4; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new PlutoMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    const events = [];
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 300 && !globalThis.__celebration; step++) {
      await flush();
      if (s.phase === 'choosing' && heart(s)) await heart(s).userData.onTap();
      s.update(0.05, step * 0.05);
    }
    assert.ok(globalThis.__celebration, `level ${level} celebrated: ${s.phase}, round ${s.roundIndex}, ${s.answers.length} answers`);
    assert.deepEqual(globalThis.__progress, [1, 2, 3]);
    assert.equal(globalThis.__celebration.kind, 'pluto');
    assert.equal(events.filter((e) => e.correct).length, LEVELS.pluto[level - 1].rounds);
    assert.equal(scoreRun(s.answers).scored, 3);
    assert.ok(s.answers.every((a) => a.skill === 'shape' && a.item === 'heart' && a.scored));
    assert.equal(getSession().missionsCompleted, 1);
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['pluto']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});
