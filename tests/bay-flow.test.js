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
const { SEA_ORDER, BAY_LAYOUT } = await import(root + '/src/levels/sea.js');
const { PLACES } = await import(root + '/src/places.js');
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
  assert.match(s.suggested, /^(shallows|lighthouse|reef|port)$/);
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

test('every stop is at least 110 px wide on an iPad held either way, wherever the boat is and whatever is suggested', () => {
  const s = new Bay({});
  s.enter();
  let narrowest = Infinity;
  for (const [w, h] of [[1180, 820], [820, 1180], [1366, 1024], [1024, 1366]]) {
    globalThis.innerWidth = w; globalThis.innerHeight = h;
    for (const here of SEA_ORDER) for (const suggested of [null, 'shallows', 'lighthouse', 'reef', 'port']) {
      s.routeIndex = SEA_ORDER.indexOf(here);
      s.suggested = suggested;
      frame(s);
      for (const c of s.stopsOnScreen()) {
        narrowest = Math.min(narrowest, c.width);
        assert.ok(c.width >= 110, `${w}x${h}, boat at ${here}: ${c.kind} is ${c.width.toFixed(0)} px wide`);
      }
    }
  }
  assert.ok(narrowest < 200, 'the stops are not just huge');
  s.exit();
});

test('a game stop carries its badge, a look-only stop none, and home shows a small house', () => {
  const s = new Bay({});
  s.enter();
  const badge = (kind) => s.bodies[kind].children.find((o) => o.isSprite);
  const house = (kind) => { let found = false; s.bodies[kind].traverse((o) => { if (o.userData.home) found = true; }); return found; };
  for (const kind of SEA_ORDER) {
    assert.equal(Boolean(badge(kind)), PLACES[kind].game, `${kind}: badge`);
    assert.equal(house(kind), kind === 'island', `${kind}: house`);
  }
  assert.deepEqual(SEA_ORDER.filter(badge), ['shallows', 'lighthouse', 'reef', 'port']);
  s.exit();
});

test('the parked boat stands inside the ring of stops, clear of every pad', () => {
  const s = new Bay({});
  s.enter();
  for (const kind of SEA_ORDER) {
    const boat = s.parkedPosition(kind);
    assert.ok(Math.hypot(boat.x, boat.z) < Math.hypot(BAY_LAYOUT[kind].at[0], BAY_LAYOUT[kind].at[2]), `boat at ${kind} is not inside the ring`);
    for (const other of SEA_ORDER) {
      const { at, r } = BAY_LAYOUT[other];
      const gap = Math.hypot(boat.x - at[0], boat.z - at[2]) - r;
      assert.ok(other === kind ? gap > 1 : gap > 1.4, `boat at ${kind} is ${gap.toFixed(1)} from the pad of ${other}`);
    }
  }
  s.exit();
});

test('the boat visits every look-only stop, starts the sea missions, comes back, leaves an idle visit and sails home', async () => {
  const landed = [];
  const missions = [];
  const s = new Bay({ hub() { landed.push(1); }, startMission(kind) { missions.push(kind); } });
  s.enter(); s.collect(); optimizeScene(s.scene); frame(s);
  for (const kind of SEA_ORDER.filter((k) => !['island', 'lighthouse', 'shallows', 'reef', 'port'].includes(k))) {
    await s.tapStop(kind); frame(s);
    assert.equal(s.state, 'visiting');
    assert.equal(s.visiting, kind);
    assert.equal(getVisited()[kind], 1);
    s.fact();
    await s.backToMap(); frame(s);
    assert.equal(s.state, 'waiting');
    assert.equal(s.visiting, null);
  }
  await s.tapStop('shallows'); frame(s);
  assert.deepEqual(missions, ['shallows']);
  assert.equal(s.state, 'visiting');
  assert.equal(s.visiting, 'shallows');
  await s.backToMap(); frame(s);
  assert.equal(s.state, 'waiting');
  await s.tapStop('lighthouse'); frame(s);
  assert.deepEqual(missions, ['shallows', 'lighthouse']);
  assert.equal(s.state, 'visiting');
  assert.equal(s.visiting, 'lighthouse');
  await s.backToMap(); frame(s);
  assert.equal(s.state, 'waiting');
  await s.tapStop('reef'); frame(s);
  assert.deepEqual(missions, ['shallows', 'lighthouse', 'reef']);
  assert.equal(s.state, 'visiting');
  assert.equal(s.visiting, 'reef');
  await s.backToMap(); frame(s);
  assert.equal(s.state, 'waiting');
  await s.tapStop('port'); frame(s);
  assert.deepEqual(missions, ['shallows', 'lighthouse', 'reef', 'port']);
  assert.equal(s.state, 'visiting');
  assert.equal(s.visiting, 'port');
  await s.backToMap(); frame(s);
  assert.equal(s.state, 'waiting');
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

test('every stop model covers at least half its patch', () => {
  const s = new Bay({});
  s.enter();
  for (const kind of SEA_ORDER) {
    const body = s.bodies[kind];
    body.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    body.traverse((o) => {
      if (!o.geometry || o === body.userData.hit || o.userData.patch) return;
      o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    });
    const cover = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    assert.ok(cover >= BAY_LAYOUT[kind].r, `${kind}: ${cover.toFixed(2)} covers less than its patch radius ${BAY_LAYOUT[kind].r}`);
  }
  s.exit();
});

test('every visit is a three-quarter view from above the water', () => {
  const s = new Bay({});
  s.enter();
  for (const kind of SEA_ORDER) {
    const view = s.visitView(kind);
    const ground = Math.hypot(view.pos.x - view.look.x, view.pos.z - view.look.z);
    const pitch = Math.atan2(view.pos.y - view.look.y, ground) * 180 / Math.PI;
    const aboveWater = Math.atan2(view.pos.y + 0.3, ground) * 180 / Math.PI;
    assert.ok(pitch >= 25 && pitch <= 40, `${kind}: ${pitch.toFixed(1)} degrees`);
    assert.ok(aboveWater >= 25 && aboveWater <= 40, `${kind}: ${aboveWater.toFixed(1)} degrees above the water`);
  }
  s.exit();
});

test('the launch floats the boat beside the pier with its hull under the water', () => {
  const launch = new Bay({}, { launch: true });
  launch.enter();
  const water = launch.launchRoot.userData.water;
  const island = launch.launchRoot.userData.island;
  launch.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(launch.cruiser);
  assert.ok(box.min.y < water, `hull bottom ${box.min.y} is not below the water ${water}`);
  const x = (box.min.x + box.max.x) / 2, z = (box.min.z + box.max.z) / 2;
  const reach = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  assert.ok(Math.hypot(x - island.x, z - island.z) > island.r + reach, 'the boat sits over the beach');
  launch.exit();
});
