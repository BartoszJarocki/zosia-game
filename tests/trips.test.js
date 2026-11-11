import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// The rocket and the boat with the real map logic; every animation waits until the test plays it.
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const noop = () => {};
globalThis.window = { addEventListener: noop, removeEventListener: noop };
globalThis.location = { search: '' };
globalThis.innerWidth = 1180;
globalThis.innerHeight = 820;
globalThis.document = { createElement() {
  const canvas = { width: 0, height: 0 };
  const ctx = new Proxy({ canvas, createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 30 }) }, { get: (o, k) => k in o ? o[k] : noop });
  canvas.getContext = () => ctx;
  return canvas;
} };
const saved = new Map();
globalThis.localStorage = { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) };
const anims = (globalThis.__anims = []);
const lines = (globalThis.__lines = []);
const engine = readFileSync(root + '/src/engine.js', 'utf8');
const base = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const renderer = { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: innerWidth, height: innerHeight }) }, info: { autoReset: true, render: { calls: 0 }, reset() {} }, getRenderTarget() { return null; }, setRenderTarget() {}, render() {} };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x };
    export const animate = (ms, fn) => new Promise((resolve) => globalThis.__anims.push({ ms, fn, resolve }));
    export const hop = async () => {}; export const wait = async () => {};
    ${base}`;
  if (url.endsWith('/src/audio.js')) source = 'export const say = async (s) => { globalThis.__lines.push(...[s].flat()); }; export const hush = () => {}; export const unlockAudio = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });';
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}) }; export const spaceHud = () => {};
    export const launchHud = () => ({ number() {}, start(fn) { globalThis.__start = fn; }, remove() {} });
    export const boatHud = () => ({ start(fn) { globalThis.__start = fn; }, remove() {} });`;
  if (url.endsWith('/src/session/session.js')) source = 'import { createSession } from "./director.js"; const s = createSession(1); export const getSession = () => s; export const checkAttention = () => "ok";';
  if (url.endsWith('/src/fx/transition.js')) source = 'export const pawWipe = async (swap) => { await swap(); };';
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { Space, ROAD_ORDER } = await import(root + '/src/scenes/space.js');
const { Bay } = await import(root + '/src/scenes/bay.js');
const { SEA_ORDER } = await import(root + '/src/levels/sea.js');
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };
/** Play an animation from `from` to `to` (0..1) in twenty steps; at 1 it ends. */
const play = (a, from = 0, to = 1) => { for (let i = 0; i <= 20; i++) a.fn(from + (to - from) * i / 20); if (to === 1) a.resolve(); };
/** Play every animation the scene starts until it waits for her. Returns the length of each. */
const settle = async () => {
  const ms = [];
  for (let i = 0; i < 40; i++) { await flush(); const a = anims.shift(); if (!a) break; ms.push(a.ms); play(a); }
  return ms;
};

test('the first trip of a session shows the whole launch; a later trip goes straight to START, quickly, to the map', async () => {
  const { createSession, firstTrip, noteTrip } = await import(root + '/src/session/director.js');
  const s = createSession(1);
  assert.equal(firstTrip(s, 'space'), true);
  noteTrip(s, 'space');
  assert.equal(firstTrip(s, 'space'), false);
  assert.equal(firstTrip(s, 'sea'), true, 'the boat has its own first trip');
  assert.equal(firstTrip(createSession(2), 'space'), true, 'a new session shows the launch again');

  for (const [Map, gear] of [[Space, 'Zakładamy kaski!'], [Bay, 'Zakładamy kamizelki!']]) {
    lines.length = 0; globalThis.__start = null;
    const first = new Map({ hub() {} }, { launch: true });
    first.enter();
    await settle();
    assert.ok(lines.includes(gear), `the first trip boards the crew: ${lines}`);
    assert.ok(globalThis.__start, 'then START');
    globalThis.__start();
    const firstLift = (await settle())[0];
    assert.equal(first.state, 'waiting');
    first.exit();

    lines.length = 0; globalThis.__start = null;
    const later = new Map({ hub() {} }, { launch: true });
    later.enter();
    await flush();
    assert.ok(globalThis.__start, 'a later trip offers START at once');
    assert.deepEqual(anims, [], 'nothing to watch before START');
    assert.ok(!lines.includes(gear), `no boarding again: ${lines}`);
    globalThis.__start();
    const lift = await settle();
    assert.equal(later.state, 'waiting', 'the map');
    assert.ok(lift[0] < firstLift && lift.reduce((a, b) => a + b, 0) <= 3000, `lift-off ${lift} ms`);
    assert.ok(!lines.includes('To nasza Ziemia!'));
    later.exit();
  }
});

test('a flight goes straight to the stop she tapped with one line, and a tap on another stop changes course', async () => {
  const started = [];
  const s = new Space({ startMission(kind) { started.push(kind); } });
  s.enter();
  await flush();
  const earth = ROAD_ORDER.indexOf('earth'), stars = ROAD_ORDER.indexOf('stars'), mars = ROAD_ORDER.indexOf('mars');
  assert.equal(s.routeIndex, earth);
  lines.length = 0;
  const trip = s.tapStop('stars');
  await flush();
  assert.equal(anims.length, 1, 'one glide');
  const glide = anims.shift();
  assert.ok(glide.ms <= 3000, `${glide.ms} ms to the far end of the road`);
  const path = [];
  for (let i = 0; i <= 10; i++) { glide.fn(i / 10); path.push(s.routeIndex); }
  assert.deepEqual(path.map((x, i) => i === 0 || x > path[i - 1]), path.map(() => true), 'never stops or turns back on the way');
  assert.equal(path.at(-1), stars);
  glide.resolve();
  await trip;
  assert.deepEqual(started, ['stars']);
  assert.deepEqual(lines, ['Lecimy do gwiazd!'], 'one line, no stop named on the way');

  const back = new Space({ startMission(kind) { started.push(kind); } });
  back.enter();
  await flush();
  const toStars = back.tapStop('stars');
  await flush();
  const first = anims.shift();
  play(first, 0, 0.5);
  const midway = back.routeIndex;
  assert.ok(midway > mars, 'already past Mars');
  lines.length = 0;
  const toMars = back.tapStop('mars');
  await flush();
  assert.equal(anims.length, 1, 'a new course');
  const turn = anims.shift();
  play(first, 0.5, 1); // (the old glide moves nothing any more)
  assert.equal(back.routeIndex, midway);
  turn.fn(0);
  assert.equal(back.routeIndex, midway, 'it turns where it is');
  play(turn);
  await Promise.all([toStars, toMars]);
  assert.equal(back.routeIndex, mars);
  assert.deepEqual(started, ['stars', 'mars']);
  assert.deepEqual(lines, ['Lecimy na Marsa!']);
  s.exit(); back.exit();
});

test('the way home is one glide from wherever the boat is', async () => {
  let home = 0;
  const s = new Bay({ hub() { home++; }, startMission() {} }, { at: SEA_ORDER.at(-1) });
  s.enter();
  await flush();
  lines.length = 0;
  const going = s.returnHome();
  const ms = [];
  for (let i = 0; i < 10 && !home; i++) { await flush(); const a = anims.shift(); if (a) { ms.push(a.ms); play(a); } }
  await going;
  assert.equal(home, 1);
  assert.equal(s.routeIndex, SEA_ORDER.indexOf('island'));
  assert.deepEqual(lines, ['Wracamy na wyspę!'], 'no stop named on the way');
  assert.ok(ms.reduce((a, b) => a + b, 0) <= 5000, `home in ${ms} ms`);
  s.exit();
});
