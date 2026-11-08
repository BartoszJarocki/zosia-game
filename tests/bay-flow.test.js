import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

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
globalThis.__attention = 'ok';
globalThis.__checks = 0;
globalThis.__lines = [];
globalThis.__hornStart = null;
const engine = readFileSync(root + '/src/engine.js', 'utf8');
const base = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const renderer = { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: innerWidth, height: innerHeight }) }, info: { autoReset: true, render: { calls: 0 }, reset() {} }, getRenderTarget() { return null; }, setRenderTarget() {}, render() {} };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x };
    export const animate = async (ms, fn) => { for (let i = 0; i <= 20; i++) fn(i / 20); };
    export const hop = async () => {}; export const wait = async () => {};
    ${base}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push([s].flat().join(" ")); }; export const hush = () => {}; export const unlockAudio = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}) };
    export const spaceHud = (opts) => { globalThis.__hud = opts; };
    export const boatHud = () => ({ start(fn) { globalThis.__hornStart = fn; }, remove() {} });`;
  if (url.endsWith('/src/session/session.js')) source = 'import { createSession } from "./director.js"; const s = createSession(1); export const getSession = () => s; export const checkAttention = () => { globalThis.__checks++; if (globalThis.__attention === "finish") s.endedEarly = true; return globalThis.__attention; };';
  if (url.endsWith('/src/fx/transition.js')) source = 'export const pawWipe = async (swap) => { await swap(); };';
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { Bay, mapView } = await import(root + '/src/scenes/bay.js');
const { SEA_ORDER } = await import(root + '/src/levels/sea.js');
const { getSession } = await import(root + '/src/session/session.js');
const { getVisited } = await import(root + '/src/progress.js');
const { camera } = await import(root + '/src/engine.js');
const { optimizeScene } = await import(root + '/src/fx/optimize.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};

function frame(s) {
  s.resize?.();
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const d = s.view.pos.clone().sub(s.view.look);
  d.setLength(Math.max(d.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
  camera.position.copy(s.view.look).add(d); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
  s.scene.updateMatrixWorld(true); s.tick(0.03, 1);
}

test('the bay keeps every stop on screen, clear of each other, with no shadows and few draws', () => {
  const s = new Bay({});
  s.enter(); s.collect(); optimizeScene(s.scene);
  assert.equal(s.state, 'waiting');
  assert.equal(s.suggested, 'buoy');
  assert.equal(globalThis.__checks, 1);
  let shadow = 0, pointLight = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadow++; if (o.isPointLight) pointLight++; });
  assert.equal(shadow, 0); assert.equal(pointLight, 0);
  let draws = 0;
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const material of [o.material].flat()) {
      if (!material.visible) continue;
      draws += material.transparent && material.side === THREE.DoubleSide && !material.forceSinglePass ? 2 : 1;
    }
  });
  assert.ok(draws + 20 < 100, `${draws} scene draws leave room for the medium post passes`);
  for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    globalThis.innerWidth = w; globalThis.innerHeight = h; frame(s);
    const circles = s.stopsOnScreen();
    assert.equal(circles.length, SEA_ORDER.length);
    for (const c of circles) {
      assert.ok(c.r >= 35 && c.x - c.r >= 0 && c.x + c.r <= w && c.y - c.r >= 0 && c.y + c.r <= h, JSON.stringify(c));
      for (const other of circles) if (other !== c) assert.ok(Math.hypot(c.x - other.x, c.y - other.y) > c.r + other.r, `${c.kind} overlaps ${other.kind}`);
    }
  }
  s.exit();
});

test('the boat visits every look-only stop, comes back, leaves an idle visit and sails home', async () => {
  const landed = [];
  const s = new Bay({ hub() { landed.push(1); } });
  s.enter(); s.collect(); optimizeScene(s.scene); frame(s);
  for (const kind of SEA_ORDER.filter((k) => k !== 'island')) {
    await s.tapStop(kind); frame(s);
    assert.equal(s.state, 'visiting');
    assert.equal(s.visiting, kind);
    assert.equal(getVisited()[kind], 1);
    s.fact();
    await s.backToMap(); frame(s);
    assert.equal(s.state, 'waiting');
    assert.equal(s.visiting, null);
  }
  await s.tapStop('seal'); frame(s);
  s.idleAt = performance.now() - 1; frame(s);
  await flush();
  assert.equal(s.state, 'waiting');
  await s.tapStop('island');
  assert.equal(landed.length, 1);
  assert.equal(s.state, 'returning');
  s.exit();
  assert.equal(getSession().visited.port, 1);
});

test('the pier launch boards the crew, waits for the horn and then reaches the map', async () => {
  const launch = new Bay({ hub() {} }, { launch: true });
  launch.enter(); launch.collect(); optimizeScene(launch.scene);
  await until(() => globalThis.__hornStart);
  assert.equal(launch.state, 'launch');
  assert.ok(globalThis.__lines.includes('Zakładamy kamizelki!'));
  assert.ok(globalThis.__lines.includes('Zatrąb! Płyniemy!'));
  globalThis.__hornStart();
  await until(() => launch.state === 'waiting');
  assert.ok(globalThis.__lines.includes('Tuu-tuu! Płyniemy!'));
  frame(launch);
  assert.equal(launch.stopsOnScreen().length, SEA_ORDER.length);
  launch.exit();
  assert.equal(mapView(1180, 820).minWidth, 0);
});
