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
    export const badges = { get: () => ({}), add: (kind) => ({ [kind]: 1 }) };
    export const bubble = () => {}; export const hideBubble = () => {}; export const setProgress = () => {};
    export const setRounds = () => {}; export const nudgeBubble = () => {};
    export const missionHud = () => {};
    export const celebrate = () => {};`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { VenusMission } = await import('../src/scenes/venus.js');
const { LEVELS } = await import('../src/levels/data.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await flush(); }
  assert.fail('Venus did not reach the expected phase');
};
const tiles = (s) => s.tappables.filter((o) => o.userData.choice !== undefined);

async function build(level = 2) {
  const s = new VenusMission({ home() {}, startMission() {} });
  s.L = LEVELS.venus[level - 1];
  s.rounds = s.L.rounds;
  s.build(); s.collect(); optimizeScene(s.scene);
  return s;
}

async function ask(s) {
  const round = s.round(0);
  await until(() => s.phase === 'asking' && tiles(s).length);
  return { round };
}

function cameraFor(s, w, h) {
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 500);
  const dir = s.view.pos.clone().sub(s.view.look);
  dir.setLength(Math.max(dir.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
  camera.position.copy(s.view.look).add(dir);
  camera.lookAt(s.view.look);
  camera.updateMatrixWorld(true);
  return camera;
}

function screenRect(object, camera, w, h) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const xs = [], ys = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).project(camera);
    xs.push((p.x + 1) / 2 * w);
    ys.push((1 - p.y) / 2 * h);
  }
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

const separate = (a, b) => a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom;

test('every tile is a tappable group with a choice, and the right shape is last while the question is open', async () => {
  const s = await build(2);
  const { round } = await ask(s);
  assert.equal(s.L.choices, 3);
  assert.equal(tiles(s).length, 3);
  for (const tile of tiles(s)) {
    assert.ok(['circle', 'square', 'triangle'].includes(tile.userData.choice));
    assert.equal(tile.userData.body.parent, tile);
  }
  const right = tiles(s).find((tile) => tile.userData.choice === s.last);
  assert.ok(right, 'this.last names a tile on screen');
  assert.equal(s.clouds.userData.open, true);
  right.userData.onTap();
  await round;
  assert.equal(s.answers[0].item, s.last);
  s.alive = false; s.exit();
});

test('all tiles and Chase stay at least 70 px across, never touch, and keep clear of each other at three sizes', async () => {
  const s = await build(2);
  const { round } = await ask(s);
  for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(s, w, h);
    const rects = tiles(s).map((tile) => screenRect(tile, camera, w, h));
    for (const rect of rects) assert.ok(Math.min(rect.width, rect.height) >= 70, `${w}x${h} tile ${rect.width}x${rect.height}`);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      assert.ok(rects[i].right + 2 < rects[j].left || rects[j].right + 2 < rects[i].left || rects[i].bottom + 2 < rects[j].top || rects[j].bottom + 2 < rects[i].top, `${w}x${h} tiles ${i} and ${j} touch`);
    }
    const window = screenRect(s.window, camera, w, h);
    assert.ok(Math.min(window.width, window.height) >= 70, `${w}x${h} Chase window`);
    for (const rect of rects) assert.ok(separate(rect, window), `${w}x${h} a tile covers Chase's window`);
    for (const rect of [window, ...rects]) assert.ok(rect.left >= 0 && rect.right <= w && rect.top >= 0 && rect.bottom <= h, `${w}x${h} stays on screen`);
  }
  tiles(s).find((tile) => tile.userData.choice === s.last).userData.onTap();
  await round;
  s.alive = false; s.exit();
});

test('Venus has no shadows or point lights and leaves room for the medium post passes', async () => {
  const s = await build(2);
  const { round } = await ask(s);
  let shadows = 0, pointLights = 0, draws = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const material of [o.material].flat()) if (material.visible) draws += material.transparent && material.side === THREE.DoubleSide && !material.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene calls plus 20 reserved for medium postprocessing`);
  tiles(s).find((tile) => tile.userData.choice === s.last).userData.onTap();
  await round;
  assert.equal(s.roundRoot, null);
  assert.equal(tiles(s).length, 0);
  s.alive = false; s.exit();
});
