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

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x, in: (x) => x, back: (x) => x, bounce: (x) => x };
    export const animate = async (ms, fn) => { for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t); };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/world/portrait.js')) source = `export const portrait = () => ({ texture: null, dispose: () => {} });`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async () => {}; export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}), add: () => ({}) };
    export const missionHud = () => {}; export const bubble = () => {}; export const hideBubble = () => {};
    export const nudgeBubble = () => {}; export const setProgress = () => {}; export const setRounds = () => {};
    export const celebrate = () => {};`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { ShallowsMission } = await import('../src/scenes/shallows.js');
const { LEVELS } = await import('../src/levels/data.js');
const { thingById } = await import('../src/levels/shallows.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 300; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };

async function scene(level = 1, plan = null) {
  const s = new ShallowsMission({ home() {}, startMission() {} });
  s.L = LEVELS.shallows[level - 1];
  s.rounds = s.L.rounds;
  if (plan) { s.plan = plan; s.rounds = plan.length; }
  s.build();
  s.collect();
  optimizeScene(s.scene);
  return s;
}

function cameraFor(s, w, h) {
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 500);
  const direction = s.view.pos.clone().sub(s.view.look);
  direction.setLength(Math.max(direction.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
  camera.position.copy(s.view.look).add(direction);
  camera.lookAt(s.view.look);
  camera.updateMatrixWorld(true);
  return camera;
}

function rectOf(obj, camera, w, h) {
  const box = new THREE.Box3().setFromObject(obj);
  const points = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).project(camera);
    points.push({ x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h });
  }
  return {
    x0: Math.min(...points.map((p) => p.x)), x1: Math.max(...points.map((p) => p.x)),
    y0: Math.min(...points.map((p) => p.y)), y1: Math.max(...points.map((p) => p.y)),
  };
}

const separated = (a, b) => a.x1 + 0.5 < b.x0 || b.x1 + 0.5 < a.x0 || a.y1 + 0.5 < b.y0 || b.y1 + 0.5 < a.y0;
const size = (r) => [r.x1 - r.x0, r.y1 - r.y0];

test('shelves, the waiting thing and Chase\'s window never overlap at the three iPad sizes', async () => {
  const s = await scene(1, [thingById('jabłko')]);
  const round = s.round(0);
  await until(() => s.phase === 'dropping');
  assert.equal(s.last, 'drop');
  const drop = s.tappables.find((o) => o.userData.choice === 'drop');
  assert.ok(drop, 'the thing is tappable with choice "drop"');
  s.scene.updateMatrixWorld(true);

  for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(s, w, h);
    const float = rectOf(s.shelves.float, camera, w, h);
    const sink = rectOf(s.shelves.sink, camera, w, h);
    const thing = rectOf(s.thing, camera, w, h);
    const window = rectOf(s.window, camera, w, h);
    for (const [name, r] of [['float', float], ['sink', sink]]) {
      const [rw, rh] = size(r);
      assert.ok(rw >= 120 && rh >= 120, `${name} ${rw.toFixed(0)}x${rh.toFixed(0)} at ${w}x${h}`);
    }
    const [tw, th] = size(thing);
    assert.ok(tw >= 70 && th >= 70, `thing ${tw.toFixed(0)}x${th.toFixed(0)} at ${w}x${h}`);
    assert.ok(separated(float, sink), `shelves touch at ${w}x${h}`);
    assert.ok(separated(float, thing) && separated(sink, thing), `a shelf touches the thing at ${w}x${h}`);
    assert.ok(separated(float, window) && separated(sink, window) && separated(thing, window), `something covers Chase's window at ${w}x${h}`);
  }
  s.alive = false; s.exit();
});

test('the water surface and the sandy bottom are both visible, and a floating or sinking thing ends where it should', async () => {
  const s = await scene(1, [thingById('jabłko')]);
  const camera = cameraFor(s, 1180, 820);
  s.scene.updateMatrixWorld(true);
  const surfaceAhead = new THREE.Vector3(0, 1.75, 6.5).project(camera);
  const surfaceBehind = new THREE.Vector3(0, 1.75, 2.0).project(camera);
  const bottom = new THREE.Vector3(0, 0.04, 6.5).project(camera);
  assert.ok(Math.abs(surfaceAhead.y - surfaceBehind.y) * 820 / 2 > 10, 'the surface is visible from the camera');
  assert.ok(bottom.y < surfaceAhead.y, 'the sandy bottom sits below the surface on screen');

  const round = s.round(0);
  await until(() => s.phase === 'dropping');
  const item = s.thing;
  s.tappables.find((o) => o.userData.choice === 'drop').userData.onTap();
  await until(() => s.phase === 'placing');
  assert.ok(item.position.y < 1.75 && item.position.y + item.userData.half > 1.75, 'the apple rests at the surface');
  stop(s);

  const sink = await scene(1, [thingById('klucz')]);
  const b = sink.round(0);
  await until(() => sink.phase === 'dropping');
  const key = sink.thing;
  sink.tappables.find((o) => o.userData.choice === 'drop').userData.onTap();
  await until(() => sink.phase === 'placing');
  assert.ok(key.position.y <= 0.1, `the key ends on the bottom (y ${key.position.y})`);
  stop(sink);
  s.alive = false;
});

test('the beach has no shadows or point lights and stays under 100 draws at medium', async () => {
  const s = await scene(1, [thingById('jabłko')]);
  let shadows = 0, pointLights = 0, draws = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene draws`);
  s.alive = false; s.exit();
});
