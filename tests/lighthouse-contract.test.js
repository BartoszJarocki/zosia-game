import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const noop = () => {};
globalThis.window = { addEventListener: noop, removeEventListener: noop };
globalThis.location = { search: '' };
globalThis.innerWidth = 1180;
globalThis.innerHeight = 820;
globalThis.document = { createElement() {
  const canvas = { width: 0, height: 0 };
  const context = new Proxy({ canvas, createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 30 }) }, { get: (o, k) => k in o ? o[k] : noop });
  canvas.getContext = () => context;
  return canvas;
} };
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
globalThis.__lines = [];
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
    export const animate = async (ms, fn) => { for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t); };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/world/portrait.js')) source = `export const portrait = () => ({ texture: null, dispose: () => {} });`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: (_, k) => () => { globalThis.__sfx.push(k); } });`;
  if (url.endsWith('/src/ui.js')) source = `
    export const badges = { get: () => ({}), add: (kind) => ({ [kind]: 1 }) };
    export const missionHud = () => {};
    export const bubble = () => {};
    export const hideBubble = () => {};
    export const nudgeBubble = () => {};
    export const setProgress = () => {};
    export const setRounds = () => {};
    export const celebrate = () => {};`;
  if (url.endsWith('/src/session/session.js')) source = `export const checkAttention = () => 'ok';
    export const replayed = () => {}; export const missionDone = kind => ({ finale: false });`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { LighthouseMission } = await import('../src/scenes/lighthouse.js');
const { PLACES } = await import('../src/places.js');
const { LEVELS } = await import('../src/levels/data.js');
const { parseGame } = await import('../src/levels/parse.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { CONFIG } = await import('../src/config.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 500; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};

async function scene(level = 3, count = 3) {
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

function cameraFor(s, width, height) {
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
  const dir = s.view.pos.clone().sub(s.view.look);
  dir.setLength(Math.max(dir.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
  camera.position.copy(s.view.look).add(dir);
  camera.lookAt(s.view.look);
  camera.updateMatrixWorld(true);
  return camera;
}

function screenBox(obj, camera, width, height) {
  const points = [];
  obj.updateWorldMatrix(true, true);
  obj.traverseVisible((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position');
    if (!p) return;
    for (let i = 0; i < p.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(camera));
  });
  const xs = points.map((p) => (p.x + 1) / 2 * width);
  const ys = points.map((p) => (1 - p.y) / 2 * height);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

const apart = (a, b) => a.right + 1 < b.left || b.right + 1 < a.left || a.bottom + 1 < b.top || b.bottom + 1 < a.top;

test('the Lighthouse place and its level table match the GAME.md contract', () => {
  assert.deepEqual(PLACES.lighthouse, { area: 'sea', game: true, domain: 'numbers', badge: { label: '💡', color: '#0ea5e9' } });
  const md = readFileSync(new URL('../GAME.md', import.meta.url), 'utf8');
  const { levels, errors } = parseGame(md, { childName: CONFIG.childName });
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.lighthouse, [
    { mode: 'marks', numbers: [1, 3], choices: 2, rounds: 4 },
    { mode: 'flashes', numbers: [1, 4], choices: 3, rounds: 4 },
    { mode: 'make', numbers: [2, 5], choices: 2, rounds: 3 },
    { mode: 'more', numbers: [1, 4], choices: 2, rounds: 3 },
  ]);
});

test('make exposes the walker hooks: lamp, done boat and the right count', async () => {
  const s = await scene(3, 4);
  const round = s.round(0);
  await until(() => s.phase === 'making');
  assert.equal(s.last, 4);
  assert.equal(s.boat.userData.choice, 'done');
  assert.equal(s.lamp.userData.choice, 'lamp');
  assert.equal(s.boat.userData.numeral, 4);
  assert.ok(s.tappables.includes(s.lamp));
  assert.ok(s.tappables.includes(s.boat));
  assert.equal(s.lamp.userData.tapHeight, 0);
  assert.equal(s.boat.userData.tapHeight, 1);
  const right = s.tappables.find((o) => o.userData.choice === 'lamp');
  assert.ok(right);
  s.alive = false;
  s.exit();
  void round;
});

test('every tappable is at least 70 px, things do not touch, and the window stays clear at all iPad sizes', async () => {
  const make = await scene(3, 3);
  const makeRound = make.round(0);
  await until(() => make.phase === 'making');
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(make, width, height);
    const boxes = make.tappables.map((o) => ({ o, b: screenBox(o, camera, width, height) }));
    for (const { o, b } of boxes) {
      assert.ok(b.width >= 70, `${width}x${height} ${o.userData.choice} width ${b.width}`);
      assert.ok(b.height >= 70, `${width}x${height} ${o.userData.choice} height ${b.height}`);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      assert.ok(apart(boxes[i].b, boxes[j].b), `${width}x${height} ${boxes[i].o.userData.choice} and ${boxes[j].o.userData.choice} touch`);
    }
    const window = screenBox(make.window, camera, width, height);
    for (const { o, b } of boxes) assert.ok(apart(b, window), `${width}x${height} ${o.userData.choice} covers Chase's window`);
    assert.ok(window.width >= 70, `${width}x${height} Chase's window is ${window.width} px`);
  }
  make.alive = false;
  make.exit();
  void makeRound;

  const marks = await scene(1, 2);
  const marksRound = marks.round(0);
  await until(() => marks.phase === 'choosing');
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(marks, width, height);
    const boxes = marks.tappables.map((o) => ({ o, b: screenBox(o, camera, width, height) }));
    assert.equal(boxes.length, 2);
    for (const { o, b } of boxes) {
      assert.ok(b.width >= 70, `${width}x${height} buoy ${o.userData.num} width ${b.width}`);
      assert.ok(b.height >= 70, `${width}x${height} buoy ${o.userData.num} height ${b.height}`);
    }
    assert.ok(apart(boxes[0].b, boxes[1].b), `${width}x${height} buoys touch`);
    const window = screenBox(marks.window, camera, width, height);
    for (const { o, b } of boxes) assert.ok(apart(b, window), `${width}x${height} buoy ${o.userData.num} covers Chase's window`);
  }
  marks.alive = false;
  marks.exit();
  void marksRound;
});

test('Lighthouse has no shadows or point lights, and clears a round away', async () => {
  const s = await scene(3, 3);
  const round = s.round(0);
  await until(() => s.phase === 'making');
  let draws = 0, shadows = 0, pointLights = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene draws plus 20 for medium postprocessing`);
  s.clearRound();
  assert.equal(s.boat, null);
  assert.equal(s.dots.length, 0);
  assert.equal(s.tappables.length, 0);
  s.alive = false;
  s.exit();
  void round;
});
