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
globalThis.__sfx = [];

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x, in: (x) => x, back: (x) => x };
    export const animate = async (ms, fn) => {
      globalThis.__animations.push(ms);
      if (globalThis.__holdFlash && ms < 200) await new Promise((resolve) => { globalThis.__flashed = resolve; }); // (a flash she makes)
      for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t);
    };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/world/portrait.js')) source = `export const portrait = () => ({ texture: null, dispose: () => {} });`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: (_, k) => () => { globalThis.__sfx.push(k); } });`;
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
  if (url.endsWith('/src/session/session.js')) source = `let completed = 0;
    export const startSession = () => { completed = 0; };
    export const getSession = () => ({ missionsCompleted: completed });
    export const checkAttention = () => 'ok';
    export const replayed = () => {}; export const missionDone = kind => { completed++; return { finale: false }; };`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { LighthouseMission } = await import('../src/scenes/lighthouse.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { learning } = await import('../src/learning/events.js');
const { T } = await import('../src/lang/pl.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 500; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };

async function scene(level = 1, count = 3) {
  CONFIG.level = level;
  const s = new LighthouseMission({ home() {}, startMission() {} });
  s.L = LEVELS.lighthouse[level - 1];
  s.rounds = s.L.rounds;
  s.pick = () => count;
  s.build();
  s.collect();
  optimizeScene(s.scene);
  return s;
}

test('marks: a dot stays for every flash and the numeral choice scores the count', async () => {
  const s = await scene(1, 3);
  const round = s.round(0);
  await until(() => s.phase === 'choosing');
  assert.equal(s.dots.length, 3);
  assert.equal(s.last, 3);
  assert.equal(globalThis.__sfx.filter((x) => x === 'ding').length, 3);
  const choices = s.tappables.filter((o) => o.userData.num !== undefined);
  assert.equal(choices.length, 2);
  assert.ok(choices.some((o) => o.userData.num === 3));
  const wrong = choices.find((o) => o.userData.num !== 3);
  wrong.userData.onTap();
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  const right = choices.find((o) => o.userData.num === 3);
  const boat = s.boat;
  await right.userData.onTap();
  assert.ok(boat.position.x < -4, 'the boat sailed into the harbour');
  await round;
  assert.equal(s.answers[0].skill, 'quantity');
  assert.equal(s.answers[0].item, '3');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.dots.length, 0);
  stop(s);
});

test('flashes: no dots, three choices, and the bubble replays the flashes', async () => {
  const s = await scene(2, 3);
  const round = s.round(0);
  await until(() => s.phase === 'choosing');
  assert.equal(s.dots.length, 0);
  assert.equal(s.tappables.filter((o) => o.userData.num !== undefined).length, 3);
  const before = globalThis.__sfx.filter((x) => x === 'ding').length;
  s.replay();
  await until(() => globalThis.__sfx.filter((x) => x === 'ding').length === before + 3 && !s.flashing);
  const right = s.tappables.find((o) => o.userData.num === s.last);
  right.userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'quantity');
  assert.equal(s.answers[0].item, '3');
  stop(s);
});

test('make: the boat waits, too few resets the dots, and the right count sails it home', async () => {
  const s = await scene(3, 3);
  const round = s.round(0);
  await until(() => s.phase === 'making');
  assert.equal(s.target, 3);
  assert.equal(s.last, 3);
  assert.equal(s.boat.userData.numeral, 3);
  assert.equal(s.lamp.userData.choice, 'lamp');
  assert.equal(s.boat.userData.choice, 'done');
  assert.ok(s.tappables.indexOf(s.lamp) < s.tappables.indexOf(s.boat));
  await s.lamp.userData.onTap();
  await s.lamp.userData.onTap();
  assert.equal(s.dots.length, 2);
  assert.equal(s.last, 3);
  await s.boat.userData.onTap();
  assert.equal(s.answers.length, 0);
  assert.equal(s.dots.length, 0);
  assert.equal(s.phase, 'making');
  assert.equal(s.last, 3);
  for (let i = 0; i < 3; i++) await s.lamp.userData.onTap();
  assert.equal(s.dots.length, 3);
  assert.equal(s.last, 'done');
  const boat = s.boat;
  await boat.userData.onTap();
  assert.ok(boat.position.x < -4, 'the boat sailed into the harbour');
  await round;
  assert.equal(s.answers[0].skill, 'counting');
  assert.equal(s.answers[0].item, '3');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  stop(s);
});

test('make: three quick taps give three flashes and three dots one after another, and the boat waits for them', async () => {
  const s = await scene(3, 3);
  const round = s.round(0);
  await until(() => s.phase === 'making');
  const dings = () => globalThis.__sfx.filter((x) => x === 'ding').length, before = dings();
  globalThis.__holdFlash = true;
  const taps = [s.lamp.userData.onTap(), s.lamp.userData.onTap(), s.lamp.userData.onTap()];
  const boat = s.boat.userData.onTap();
  assert.equal(dings() - before, 1, 'one flash at a time');
  assert.equal(s.dots.length, 1);
  assert.equal(s.learn.current.wrong, 0, 'the boat is judged after the flashes');
  assert.equal(s.lamp.userData.onTap(), undefined, 'a tap after the boat is not counted');
  globalThis.__holdFlash = false;
  globalThis.__flashed();
  await Promise.all(taps);
  assert.equal(dings() - before, 3);
  assert.equal(s.dots.length, 3);
  assert.equal(s.count, 3);
  await boat;
  await round;
  assert.equal(s.answers[0].skill, 'counting');
  assert.equal(s.answers[0].firstTry, true, 'three quick taps are three, not "Za mało!"');
  stop(s);
});

test('more: the lamp shows two, she makes three, and the sequence is scored', async () => {
  const before = globalThis.__sfx.filter((x) => x === 'ding').length;
  const s = await scene(4, 2);
  const round = s.round(0);
  await until(() => s.phase === 'making');
  assert.equal(s.target, 3);
  assert.equal(s.last, 3);
  assert.equal(s.boat.userData.numeral, undefined);
  assert.equal(globalThis.__sfx.filter((x) => x === 'ding').length - before, 2);
  for (let i = 0; i < 3; i++) await s.lamp.userData.onTap();
  assert.equal(s.last, 'done');
  await s.boat.userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'sequence');
  assert.equal(s.answers[0].item, '3');
  assert.equal(s.answers[0].scored, true);
  stop(s);
});

test('every Lighthouse level runs through base progress and celebration, and counts for the session', async () => {
  for (let level = 1; level <= 4; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new LighthouseMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    const events = [];
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 300 && !globalThis.__celebration; step++) {
      if (s.phase === 'choosing') {
        s.tappables.find((o) => o.userData.num === s.last)?.userData.onTap();
      } else if (s.phase === 'making') {
        if (s.count < s.target) await s.lamp.userData.onTap();
        else if (s.tappables.includes(s.boat)) await s.boat.userData.onTap();
      }
      s.update(0.05, step * 0.05);
      await flush();
    }
    assert.ok(globalThis.__celebration, `level ${level} celebrated: ${s.phase}, round ${s.roundIndex}`);
    assert.equal(globalThis.__celebration.kind, 'lighthouse');
    assert.deepEqual(globalThis.__progress, level < 3 ? [1, 2, 3, 4] : [1, 2, 3]);
    assert.equal(events.filter((e) => e.correct).length, LEVELS.lighthouse[level - 1].rounds);
    assert.equal(scoreRun(s.answers).scored, [4, 4, 3, 3][level - 1]);
    assert.equal(getSession().missionsCompleted, 1);
    assert.deepEqual(s.doneLine(), T.lighthouseDone());
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['lighthouse']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});

test('Lighthouse has no shadows or point lights and leaves room for medium post passes', async () => {
  const s = await scene(3, 3);
  const round = s.round(0);
  await until(() => s.phase === 'making');
  let shadows = 0, pointLights = 0, draws = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene calls plus 20 reserved for medium postprocessing`);
  s.alive = false;
  s.exit();
  void round;
});
