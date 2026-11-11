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
globalThis.__celebration = null;

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = { inOut: (x) => x, linear: (x) => x, in: (x) => x, out: (x) => x, bounce: (x) => x };
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
    export const missionHud = (options) => { globalThis.__hud = options; globalThis.__progress = []; };
    export const bubble = (options) => { globalThis.__bubble = options; };
    export const hideBubble = () => {};
    export const nudgeBubble = () => {};
    export const setProgress = (n) => globalThis.__progress.push(n);
    export const setRounds = () => {};
    export const celebrate = (options) => { globalThis.__celebration = options; };`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { VenusMission } = await import('../src/scenes/venus.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { T } = await import('../src/lang/pl.js');
const { learning } = await import('../src/learning/events.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await flush(); }
  assert.fail('Venus did not reach the expected phase');
};
const tiles = (s) => s.tappables.filter((o) => o.userData.choice !== undefined);

async function scene(level = 1) {
  CONFIG.level = level;
  const s = new VenusMission({ home() {}, startMission() {} });
  s.L = LEVELS.venus[level - 1];
  s.rounds = s.L.rounds;
  s.build(); s.collect(); optimizeScene(s.scene);
  return s;
}

test('a full round opens the clouds; a wrong tile gets a "no" and the question, the right one does not glow, and it scores', async () => {
  const s = await scene(1);
  globalThis.__lines = [];
  const round = s.round(0);
  await until(() => s.phase === 'asking' && tiles(s).length);
  assert.equal(tiles(s).length, 2);
  assert.ok(tiles(s).some((tile) => tile.userData.choice === s.last));
  assert.equal(s.clouds.userData.open, true);
  const wrong = tiles(s).find((tile) => tile.userData.choice !== s.last);
  const right = tiles(s).find((tile) => tile.userData.choice === s.last);
  const glow = () => [right.userData.body.material.emissive.getHex(), right.userData.body.material.emissiveIntensity];
  const unlit = glow(), before = globalThis.__lines.length;
  wrong.userData.onTap();
  await until(() => globalThis.__lines.at(-1) === T.venusAsk()[0]);
  assert.match(globalThis.__lines[before], /^Nie/);
  assert.ok(!globalThis.__lines.slice(before).includes(T.venusRight(s.last)[0]), 'the shape is not named');
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  assert.equal(s.aid.state.level, 1, 'help is at "try again"');
  assert.ok(s.learn.current.assist <= 1);
  s.update(0.016, 1);
  assert.deepEqual(glow(), unlit, 'the right tile does not glow');
  right.userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'shape');
  assert.equal(s.answers[0].item, s.last);
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  assert.deepEqual(globalThis.__lines.slice(-2), [T.venusRight(s.last)[0], T.shapeClue(s.last)[0]]);
  assert.equal(s.roundRoot, null);
  assert.equal(tiles(s).length, 0);
  s.alive = false; s.exit();
});

test('part rounds keep the clouds closed over all but a peek, then open them on an answer', async () => {
  const s = await scene(3);
  const round = s.round(0);
  await until(() => s.phase === 'asking' && tiles(s).length);
  assert.equal(s.L.reveal, 'part');
  assert.ok(s.clouds.userData.hole);
  assert.equal(s.clouds.userData.left.position.x, 0);
  assert.notEqual(s.clouds.userData.open, true);
  const clouds = s.clouds;
  tiles(s).find((tile) => tile.userData.choice === s.last).userData.onTap();
  await round;
  assert.equal(clouds.userData.open, true);
  assert.ok(clouds.userData.left.position.x <= -1.9);
  assert.ok(clouds.userData.left.scale.x <= 0.8);
  s.alive = false; s.exit();
});

test('a turned level shows a turned, resized Garage piece', async () => {
  const s = await scene(4);
  s.plan = ['square', 'triangle', 'circle'];
  const round = s.round(0);
  await until(() => s.phase === 'asking' && tiles(s).length);
  assert.equal(s.L.turned, true);
  assert.equal(s.piece.shape, 'square');
  assert.equal(s.piece.turn, Math.PI / 4);
  assert.ok([0.8, 0.9, 1.15].includes(s.piece.size));
  tiles(s).find((tile) => tile.userData.choice === s.last).userData.onTap();
  await round;
  s.alive = false; s.exit();
});

test('every Venus level runs through the real Mission loop to celebration and counts for the session', async () => {
  for (let level = 1; level <= 4; level++) {
    CONFIG.level = level;
    startSession();
    globalThis.__celebration = null;
    let homes = 0;
    const again = [];
    const s = new VenusMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    const events = [];
    const unsubscribe = learning.subscribe((event) => events.push(event));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 400 && !globalThis.__celebration; step++) {
      const right = tiles(s).find((tile) => tile.userData.choice === s.last);
      if (s.phase === 'asking' && right) right.userData.onTap();
      s.update(0.05, step * 0.05);
      await flush();
    }
    assert.ok(globalThis.__celebration, `level ${level}: phase ${s.phase}, round ${s.roundIndex}, answers ${s.answers.length}`);
    assert.equal(globalThis.__celebration.kind, 'venus');
    assert.equal(s.answers.length, LEVELS.venus[level - 1].rounds);
    assert.ok(s.answers.every((answer) => answer.skill === 'shape' && answer.scored));
    assert.equal(events.filter((event) => event.correct).length, LEVELS.venus[level - 1].rounds);
    assert.deepEqual(scoreRun(s.answers), { scored: LEVELS.venus[level - 1].rounds, clean: LEVELS.venus[level - 1].rounds });
    assert.equal(getSession().missionsCompleted, 1);
    assert.deepEqual(s.doneLine(), T.venusDone());
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['venus']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); s.alive = false; s.exit(); await flush();
  }
  CONFIG.level = null;
});
