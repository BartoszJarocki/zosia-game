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

const { ShallowsMission, makeThing } = await import('../src/scenes/shallows.js');
const { LEVELS } = await import('../src/levels/data.js');
const { thingById, THINGS } = await import('../src/levels/shallows.js');
const PLANK = new THREE.Vector3(0, 5.66, -0.55); // where a thing waits, on the plank above the pool
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
  globalThis.innerWidth = w;
  globalThis.innerHeight = h;
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

/** The bubble body in style.css: left-anchored, below the home button, sized by its big glyph and picture. */
function bubbleRect(w, h) {
  const btn = Math.min(0.11 * w, 0.11 * h, 96);
  const left = Math.max(16, 0) + btn + 24;
  const top = Math.max(14, 0) + btn + 0.016 * h;
  const big = Math.min(0.15 * w, 0.14 * h, 150);
  const pic = Math.min(0.12 * w, 0.11 * h, 108);
  const wide = big + Math.min(0.03 * w, 26) + pic + 2 * Math.min(0.036 * w, 32) + 10;
  const tall = Math.max(big, pic) + 2 * 0.011 * h + 10;
  return { x0: left, x1: left + wide, y0: top, y1: top + tall };
}

/** Bounds of the drawn parts only: the invisible hit sphere is not what she sees. */
function drawnRect(obj, camera, w, h) {
  const part = new THREE.Box3();
  const points = [];
  obj.updateWorldMatrix(true, true);
  obj.traverseVisible((o) => {
    if (!o.isMesh || o.userData.zone || o.material?.visible === false) return;
    o.geometry.computeBoundingBox();
    part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    for (const x of [part.min.x, part.max.x]) for (const y of [part.min.y, part.max.y]) for (const z of [part.min.z, part.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(camera);
      points.push({ x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h });
    }
  });
  return {
    x0: Math.min(...points.map((p) => p.x)), x1: Math.max(...points.map((p) => p.x)),
    y0: Math.min(...points.map((p) => p.y)), y1: Math.max(...points.map((p) => p.y)),
  };
}

test('the bubble, the shelves, the waiting thing and Chase\'s window never overlap at the three iPad sizes', async () => {
  const s = await scene(1, [thingById('jabłko')]);
  s.round(0);
  await until(() => s.phase === 'dropping');
  assert.equal(s.last, 'drop');
  const drop = s.tappables.find((o) => o.userData.choice === 'drop');
  assert.ok(drop, 'the thing is tappable with choice "drop"');
  s.scene.updateMatrixWorld(true);

  for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(s, w, h);
    const bubble = bubbleRect(w, h);
    const float = rectOf(s.shelves.float, camera, w, h);
    const sink = rectOf(s.shelves.sink, camera, w, h);
    const thing = rectOf(s.thing, camera, w, h);
    const window = rectOf(s.window, camera, w, h);
    for (const [name, r] of [['float', float], ['sink', sink]]) {
      const [rw, rh] = size(r);
      assert.ok(rw >= 120 && rh >= 120, `${name} ${rw.toFixed(0)}x${rh.toFixed(0)} at ${w}x${h}`);
    }
    for (const [name, sign] of [['float', s.signs.float], ['sink', s.signs.sink]]) {
      const [rw] = size(rectOf(sign, camera, w, h));
      assert.ok(rw >= 160, `${name} sign ${rw.toFixed(0)} px at ${w}x${h}`);
    }
    const [tw, th] = size(thing);
    assert.ok(tw >= 70 && th >= 70, `thing ${tw.toFixed(0)}x${th.toFixed(0)} at ${w}x${h}`);
    assert.ok(separated(float, sink), `shelves touch at ${w}x${h}`);
    assert.ok(separated(float, thing) && separated(sink, thing), `a shelf touches the thing at ${w}x${h}`);
    assert.ok(separated(bubble, float) && separated(bubble, sink), `the bubble covers a shelf at ${w}x${h}`);
    assert.ok(separated(bubble, window), `the bubble covers Chase's window at ${w}x${h}`);
    assert.ok(separated(float, window) && separated(sink, window) && separated(thing, window), `something covers Chase's window at ${w}x${h}`);
  }
  s.alive = false; s.exit();
});

test('every shelf, its sign and the things on it sit 24 px inside the screen at the three iPad sizes', async () => {
  const s = await scene(1, [thingById('jabłko')]);
  const log = makeThing('kłoda', s.hitMat);
  s.shelves.float.attach(log);
  log.position.set(-1.5, 1.72, 0.35);
  log.rotation.set(0, 0, 0);
  log.scale.setScalar(log.userData.shelfScale);
  const coin = makeThing('moneta', s.hitMat);
  s.shelves.sink.attach(coin);
  coin.position.set(1.5, 0.52, 0.35);
  coin.rotation.set(0, 0, 0);
  coin.scale.setScalar(coin.userData.shelfScale);

  for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    s.scene.updateMatrixWorld(true);
    const camera = cameraFor(s, w, h);
    const parts = {
      floatShelf: drawnRect(s.shelves.float, camera, w, h),
      sinkShelf: drawnRect(s.shelves.sink, camera, w, h),
      floatSign: drawnRect(s.signs.float, camera, w, h),
      sinkSign: drawnRect(s.signs.sink, camera, w, h),
      log: drawnRect(log, camera, w, h),
      coin: drawnRect(coin, camera, w, h),
    };
    for (const [name, r] of Object.entries(parts)) {
      assert.ok(r.x0 >= 24, `${name} starts at x ${r.x0.toFixed(0)} at ${w}x${h}`);
      assert.ok(r.x1 <= w - 24, `${name} ends at x ${r.x1.toFixed(0)} of ${w} at ${w}x${h}`);
      assert.ok(r.y0 >= 24, `${name} starts at y ${r.y0.toFixed(0)} at ${w}x${h}`);
      assert.ok(r.y1 <= h - 24, `${name} ends at y ${r.y1.toFixed(0)} of ${h} at ${w}x${h}`);
    }
  }
  s.alive = false; s.exit();
});

test('side on: blue water under a white surface line, a floating apple across the line, a sunk key on the sand', async () => {
  const s = await scene(1, [thingById('jabłko')]);
  const camera = cameraFor(s, 1180, 820);
  s.scene.updateMatrixWorld(true);
  const water = s.surface.material;
  assert.equal(water.transparent, true, 'the things inside are seen through the water');
  assert.equal(water.depthWrite, false);
  assert.ok(s.surface.renderOrder > 0, 'the water is drawn over what is inside it');
  const top = new THREE.Vector3(0, 4.2, 1.3).project(camera), floor = new THREE.Vector3(0, 0.34, 1.3).project(camera);
  assert.ok((top.y - floor.y) * 820 / 2 > 150, `the water is ${((top.y - floor.y) * 410).toFixed(0)} px deep on screen`);
  const view = new THREE.Vector3().subVectors(s.view.look, s.view.pos).normalize();
  assert.ok(Math.abs(view.y) < 0.15, 'the camera looks from the side, not down');

  const round = s.round(0);
  await until(() => s.phase === 'dropping');
  const apple = s.thing;
  s.tappables.find((o) => o.userData.choice === 'drop').userData.onTap();
  await until(() => s.phase === 'sorting');
  assert.ok(apple.position.y < 4.2 && apple.position.y + apple.userData.half > 4.2, 'the apple rests across the surface line');
  assert.ok(Math.abs(apple.position.z) < 1.3, 'inside the pool, behind the glass');
  stop(s);

  const sink = await scene(1, [thingById('klucz')]);
  sink.round(0);
  await until(() => sink.phase === 'dropping');
  const key = sink.thing;
  sink.tappables.find((o) => o.userData.choice === 'drop').userData.onTap();
  await until(() => sink.phase === 'sorting');
  assert.ok(key.position.y <= 0.4, `the key ends on the sand (y ${key.position.y})`);
  for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const r = drawnRect(key, cameraFor(sink, w, h), w, h);
    assert.ok(r.x0 >= 0 && r.x1 <= w && r.y0 >= 0 && r.y1 <= h, `the sunk key stays on screen at ${w}x${h}`);
  }
  stop(sink);
  void round;
});

test('every thing is at least 90 px across on the plank and 60 px on a shelf', async () => {
  const s = await scene(1);
  for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(s, w, h);
    for (const thing of THINGS) {
      const obj = makeThing(thing.id, s.hitMat);
      obj.position.copy(PLANK);
      const onSand = drawnRect(obj, camera, w, h);
      const [sw, sh] = size(onSand);
      assert.ok(sw >= 90, `${thing.id} ${sw.toFixed(0)}x${sh.toFixed(0)} on the plank at ${w}x${h}`);
      obj.scale.setScalar(obj.userData.shelfScale);
      obj.position.set(-7.45, 1.72, 0.95);
      const onShelf = drawnRect(obj, camera, w, h);
      const [gw, gh] = size(onShelf);
      assert.ok(gw >= 60, `${thing.id} ${gw.toFixed(0)}x${gh.toFixed(0)} on a shelf at ${w}x${h}`);
    }
  }
  s.alive = false; s.exit();
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
