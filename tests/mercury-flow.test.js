import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

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
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x, in: (x) => x, bounce: (x) => x, back: (x) => x };
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

const { MercuryMission } = await import('../src/scenes/mercury.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { startSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };

async function scene(level = 1, n = 3) {
  CONFIG.level = level;
  const s = new MercuryMission({});
  s.pick = () => n;
  s.build(); s.collect(); optimizeScene(s.scene);
  await s.landed;
  return s;
}

test('a stay round keeps the craters in view and scores the number tile', async () => {
  const s = await scene(1, 3);
  const round = s.craterRound();
  await until(() => s.phase === 'choosing');
  assert.equal(s.last, 3);
  assert.equal(s.craters.visible, true);
  assert.equal(s.blocks.length, 3);
  assert.ok(s.tappables.every((o) => typeof o.userData.num === 'number'));
  assert.ok(s.blocks.some((b) => b.userData.num === s.last));
  s.blocks.find((b) => b.userData.num === s.last).userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'quantity');
  assert.equal(s.answers[0].item, '3');
  assert.equal(s.answers[0].scored, true);
  assert.deepEqual(globalThis.__lines.filter((l) => ['Jeden!', 'Dwa!', 'Trzy!'].includes(l)).slice(-3), ['Jeden!', 'Dwa!', 'Trzy!']);
  assert.ok(globalThis.__lines.includes('Tak! Trzy kratery!'));
  stop(s);
});

test('a flash round hides the craters under pink dust, then counts them after a wrong tap', async () => {
  const s = await scene(3, 4);
  const round = s.craterRound();
  await until(() => s.phase === 'choosing');
  assert.equal(s.last, 4);
  assert.equal(s.craters.visible, false);
  assert.equal(globalThis.__lines.at(-1), 'Szybkie oko! Ile było kraterów?');
  const wrong = s.blocks.find((b) => b.userData.num !== s.last);
  wrong.userData.onTap();
  await until(() => s.busy === false);
  assert.ok(globalThis.__lines.includes('Popatrz jeszcze raz.'));
  assert.deepEqual(globalThis.__lines.filter((l) => ['Jeden!', 'Dwa!', 'Trzy!', 'Cztery!'].includes(l)).slice(-4), ['Jeden!', 'Dwa!', 'Trzy!', 'Cztery!']);
  assert.equal(s.craters.visible, true);
  assert.equal(s.answers.length, 0);
  s.blocks.find((b) => b.userData.num === s.last).userData.onTap();
  await round;
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.answers[0].scored, true);
  stop(s);
});

test('every Mercury level runs through base progress and celebration', async () => {
  for (let level = 1; level <= 5; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new MercuryMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    s.enter(); optimizeScene(s.scene);
    for (let step = 0; step < 500 && !globalThis.__celebration; step++) {
      if (s.phase === 'choosing') {
        const right = s.blocks.find((b) => b.userData.num === s.last);
        if (right) right.userData.onTap();
      }
      s.update(0.05, step * 0.05);
      await flush();
    }
    assert.ok(globalThis.__celebration, `level ${level}: ${s.phase}, round ${s.roundIndex}, ${s.answers.length} answers`);
    assert.equal(globalThis.__celebration.kind, 'mercury');
    assert.equal(s.answers.length, LEVELS.mercury[level - 1].rounds);
    assert.ok(s.answers.every((a) => a.skill === 'quantity' && a.scored));
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['mercury']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    stop(s);
    await flush();
  }
  CONFIG.level = null;
});
