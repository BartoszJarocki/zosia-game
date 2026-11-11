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
    export const celebrate = (options) => { globalThis.__celebration = options; };`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { MarsMission } = await import('../src/scenes/mars.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { learning } = await import('../src/learning/events.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };
const rocks = (s) => s.tappables.filter((o) => o.userData.num !== undefined);

async function scene(level = 1, target = 3) {
  CONFIG.level = level;
  const s = new MarsMission({});
  s.pick = () => target;
  s.build(); s.collect(); optimizeScene(s.scene);
  await s.landed;
  return s;
}

test('a right rock scores, the rover drives over and the rock is scanned', async () => {
  const s = await scene(2, 3);
  const round = s.round(0);
  await until(() => s.learn.isOpen && s.prompt.length);
  assert.equal(s.last, 3);
  assert.deepEqual(rocks(s).map((o) => o.userData.num).sort(), [2, 3, 4]);
  const right = rocks(s).find((o) => o.userData.num === 3);
  right.userData.onTap();
  await round;
  assert.equal(s.answers.length, 1);
  assert.equal(s.answers[0].skill, 'numeral');
  assert.equal(s.answers[0].item, '3');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, true);
  assert.ok(Math.abs(s.rover.position.x - (right.userData.x - 1.75)) < 0.01);
  assert.ok(globalThis.__lines.includes('Brawo! Łazik dojechał!'));
  stop(s);
});

test('a wrong rock gets a "no" and the question again, the right one does not glow, and she tries again', async () => {
  const s = await scene(2, 3);
  const round = s.round(0);
  await until(() => s.learn.isOpen && s.prompt.length);
  const before = globalThis.__lines.length;
  rocks(s).find((o) => o.userData.num === 2).userData.onTap();
  assert.ok(/^Nie/.test(globalThis.__lines[before]), globalThis.__lines.slice(before).join(' '));
  assert.equal(globalThis.__lines.at(-1), 'Gdzie jest numer trzy?');
  for (let i = 0; i < 10; i++) { s.update(0.1, i * 0.1); await flush(); }
  assert.equal(rocks(s).find((o) => o.userData.num === 3).userData.rockMat.emissiveIntensity, 0);
  assert.equal(s.aid.state.level, 1, 'help is at "try again"');
  assert.ok(s.learn.current.assist <= 1);
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  assert.equal(s.last, 3);
  rocks(s).find((o) => o.userData.num === 3).userData.onTap();
  await round;
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.answers[0].scored, true);
  stop(s);
});

test('the dots level asks for an amount and keeps the answer hidden in the bubble', async () => {
  const s = await scene(4, 3);
  const round = s.round(0);
  await until(() => s.learn.isOpen && s.prompt.length);
  assert.equal(s.learn.current.skill, 'quantity');
  assert.equal(globalThis.__bubble.big, '');
  assert.equal(globalThis.__bubble.dots, 3);
  assert.equal(globalThis.__bubble.pic, '🚙');
  s.runAssist('hint');
  assert.equal(globalThis.__lines.at(-1), 'Policz kropki!');
  const before = globalThis.__lines.length;
  rocks(s).find((o) => o.userData.num !== 3).userData.onTap();
  assert.deepEqual(globalThis.__lines.slice(before + 1), ['Policz kropki! Do którego kamienia jedziemy?'], 'a wrong rock: no number is said');
  rocks(s).find((o) => o.userData.num === 3).userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'quantity');
  assert.equal(s.answers[0].item, '3');
  assert.equal(s.answers[0].options, 3);
  stop(s);
});

test('every Mars level runs through base progress and celebration, and counts for the session', async () => {
  for (let level = 1; level <= 5; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new MarsMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    s.pick = () => 3;
    const events = [];
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 400 && !globalThis.__celebration; step++) {
      if (s.learn?.isOpen) {
        const rock = rocks(s).find((o) => o.userData.num === s.last);
        if (rock) await rock.userData.onTap();
      }
      s.update(0.05, step * 0.05);
      await flush();
    }
    assert.ok(globalThis.__celebration, `level ${level} celebrated: round ${s.roundIndex}, ${s.answers.length} answers`);
    assert.deepEqual(globalThis.__progress, [1, 2, 3]);
    assert.equal(globalThis.__celebration.kind, 'mars');
    assert.equal(events.filter((e) => e.correct).length, LEVELS.mars[level - 1].rounds);
    assert.equal(scoreRun(s.answers).scored, 3);
    assert.equal(getSession().missionsCompleted, 1);
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['mars']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});
