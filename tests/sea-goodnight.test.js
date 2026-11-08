import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const noop = () => {};
globalThis.window = { addEventListener: noop, removeEventListener: noop, innerWidth: 1180, innerHeight: 820 };
globalThis.location = { search: '' };
globalThis.document = {
  addEventListener: noop, removeEventListener: noop, hidden: false,
  getElementById: () => null,
  createElement() {
    const canvas = { width: 0, height: 0 };
    const ctx = new Proxy({ canvas, createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 30 }) },
      { get: (o, k) => k in o ? o[k] : noop });
    canvas.getContext = () => ctx;
    return canvas;
  },
};
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };

registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const renderer = { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1180, height: 820 }) }, info: { autoReset: true, render: { calls: 0 }, reset() {} } };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x };
    export class Stage { constructor() { this.scene = new THREE.Scene(); this.tappables = []; } }
    export const animate = async () => {};
    export const wait = async () => {};
    export const hop = async () => {};
    export const addSkyAndLights = () => {};
    export const shakeNo = () => {};`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async () => {}; export const hush = () => {}; export const unlockAudio = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}), add: () => ({}) };
    export const spaceHud = () => {}; export const launchHud = () => ({ number() {}, start() {}, remove() {} });
    export const missionHud = () => {}; export const bubble = () => {}; export const hideBubble = () => {};
    export const setProgress = () => {}; export const setRounds = () => {}; export const nudgeBubble = () => {};
    export const celebrate = () => {};`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { makeShells, addShells, shellKinds, shellPlaces, SHELL_KINDS, SHELL_LAYOUT } = await import('../src/world/shells.js');
const { makeLighthouseBeam, lighthouseBeamLine, goodnightLines, BEAM_AT, BEAM_LAMP_Y, BEAM_LENGTH } = await import('../src/world/beam.js');
const { star } = await import('../src/models.js');
const { T, allSegments } = await import('../src/lang/pl.js');
const { LEVELS, ALL_LETTERS } = await import('../src/levels/data.js');

const HOME = { pos: new THREE.Vector3(0, 27, 31), look: new THREE.Vector3(0, 2.2, 1.2) };
const HARBOUR = [10.8, -23.1];
const TAP_RADIUS = 4.2;
const TAP_HEIGHT = 4;

function homeCamera(width, height) {
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
  const dir = HOME.pos.clone().sub(HOME.look);
  const need = 40 / (2 * Math.tan(THREE.MathUtils.degToRad(21)) * camera.aspect);
  dir.setLength(Math.max(dir.length(), need));
  camera.position.copy(HOME.look).add(dir);
  camera.lookAt(HOME.look);
  camera.updateMatrixWorld(true);
  return camera;
}

function drawCost(root) {
  let calls = 0;
  root.traverseVisible((o) => { if ((o.isMesh || o.isSprite || o.isPoints || o.isLine) && o.material?.visible !== false) calls++; });
  return calls;
}

function cornersOf(box) {
  const points = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z));
  return points;
}

function screenRect(points, camera, width, height) {
  const rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const p of points) {
    const q = p.clone().project(camera);
    const x = (q.x + 1) / 2 * width, y = (1 - q.y) / 2 * height;
    rect.x0 = Math.min(rect.x0, x); rect.x1 = Math.max(rect.x1, x);
    rect.y0 = Math.min(rect.y0, y); rect.y1 = Math.max(rect.y1, y);
  }
  return rect;
}

function roundRect(o, camera, width, height) {
  if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
  const centre = o.getWorldPosition(new THREE.Vector3());
  const q = centre.clone().project(camera);
  const focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const r = o.geometry.boundingSphere.radius * focal / centre.distanceTo(camera.position);
  const x = (q.x + 1) / 2 * width, y = (1 - q.y) / 2 * height;
  return { x0: x - r, x1: x + r, y0: y - r, y1: y + r };
}

const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function harbourTapRect(camera, width, height) {
  const points = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    for (const y of [0, TAP_HEIGHT]) points.push(new THREE.Vector3(HARBOUR[0] + Math.cos(a) * TAP_RADIUS, y, HARBOUR[1] + Math.sin(a) * TAP_RADIUS));
  }
  return screenRect(points, camera, width, height);
}

test('a visited sea stop leaves one shell, always in the same spot', () => {
  assert.deepEqual(SHELL_KINDS, ['scallop', 'spiral', 'starfish', 'pebble', 'crab']);
  assert.deepEqual(SHELL_LAYOUT.map((s) => s.place), ['buoy', 'shallows', 'seal', 'lighthouse', 'gulls', 'reef', 'port']);
  assert.deepEqual(shellPlaces({ island: 4, seal: 1, port: 2, letters: 1 }), ['seal', 'port']);
  assert.deepEqual(shellKinds({ island: 4, seal: 1, port: 2, shallows: 1 }), ['spiral', 'starfish', 'spiral']);

  const group = makeShells({ island: 4, shallows: 1, seal: 2, port: 1 });
  assert.deepEqual(group.userData.places, ['shallows', 'seal', 'port']);
  assert.deepEqual(group.userData.kinds, ['spiral', 'starfish', 'spiral']);
  assert.equal(group.userData.positions.length, 3);
  assert.deepEqual(group.userData.positions.map((p) => p.place), ['shallows', 'seal', 'port']);
  assert.deepEqual(makeShells({}).userData.positions, []);
  assert.equal(makeShells({}).children.length, 0);

  const again = makeShells({ island: 4, shallows: 1, seal: 2, port: 1 });
  assert.deepEqual(again.userData.positions.map(({ x, z }) => [x, z]), group.userData.positions.map(({ x, z }) => [x, z]));
});

test('all the shells are one mesh, at most two draw calls and no shadows', () => {
  const all = Object.fromEntries(['buoy', 'shallows', 'seal', 'lighthouse', 'gulls', 'reef', 'port'].map((place) => [place, 1]));
  const scene = new THREE.Scene();
  const before = drawCost(scene);
  const group = addShells(scene, HARBOUR, all);
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].isMesh, true);
  assert.ok(drawCost(scene) - before <= 2, `${drawCost(scene) - before} draw calls`);
  let shadows = 0;
  group.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; });
  assert.equal(shadows, 0);
});

test('the shells read 28 to 40 px at 1180x820, clear of the harbour and each other', () => {
  const all = Object.fromEntries(['buoy', 'shallows', 'seal', 'lighthouse', 'gulls', 'reef', 'port'].map((place) => [place, 1]));
  const width = 1180, height = 820;
  const camera = homeCamera(width, height);
  const scene = new THREE.Scene();
  const group = addShells(scene, HARBOUR, all);
  const marker = star('#fde047', 2, 0.28);
  marker.position.set(HARBOUR[0], 6.4, HARBOUR[1]);
  scene.add(marker);
  scene.updateMatrixWorld(true);

  const tap = harbourTapRect(camera, width, height);
  const starRect = roundRect(marker, camera, width, height);
  const rects = group.userData.positions.map((spot) => {
    const box = spot.box.clone().applyMatrix4(group.matrixWorld);
    const rect = screenRect(cornersOf(box), camera, width, height);
    const across = rect.x1 - rect.x0;
    assert.ok(across >= 28, `${spot.place}: ${across.toFixed(1)} px across`);
    assert.ok(across <= 40, `${spot.place}: ${across.toFixed(1)} px across`);
    assert.ok(Math.hypot(spot.x, spot.z) - spot.radius > TAP_RADIUS, `${spot.place} covers the harbour tap target`);
    assert.ok(!overlaps(rect, tap), `${spot.place} overlaps the harbour tap box`);
    assert.ok(!overlaps(rect, starRect), `${spot.place} overlaps the harbour star`);
    return rect;
  });
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    assert.ok(!overlaps(rects[i], rects[j]), `shells ${i} and ${j} touch`);
  }
});

test('the lighthouse beam only comes for a lighthouse visit, additive and depth-free', () => {
  assert.equal(makeLighthouseBeam({}), null);
  assert.equal(makeLighthouseBeam({ moon: 2, seal: 1 }), null);
  const group = makeLighthouseBeam({ lighthouse: 2 });
  assert.ok(group);
  assert.equal(group.userData.materials.length, 2);
  for (const m of group.userData.materials) {
    assert.equal(m.blending, THREE.AdditiveBlending);
    assert.equal(m.depthWrite, false);
    assert.equal(m.fog, false);
    assert.equal(m.transparent, true);
  }
  assert.equal(group.userData.beam.material, group.userData.materials[0]);
  assert.equal(group.userData.lamp.material, group.userData.materials[1]);
});

test('the beam crosses the visible sea at 1180x820 and in portrait, and leaves on restore', () => {
  for (const [width, height] of [[1180, 820], [820, 1180]]) {
    const camera = homeCamera(width, height);
    const scene = new THREE.Scene();
    const group = makeLighthouseBeam({ lighthouse: 1 }, { at: BEAM_AT });
    scene.add(group);
    scene.updateMatrixWorld(true);

    const mid = group.userData.pivot.localToWorld(new THREE.Vector3(0, 0, BEAM_LENGTH / 2)).project(camera);
    const x = (mid.x + 1) / 2 * width, y = (1 - mid.y) / 2 * height;
    assert.ok(x > 0 && x < width, `${width}x${height}: beam at x ${x.toFixed(1)}`);
    assert.ok(y > height * 0.1 && y < height * 0.9, `${width}x${height}: beam at y ${y.toFixed(1)}`);

    const near = group.userData.pivot.localToWorld(new THREE.Vector3(0, 0, BEAM_LENGTH * 0.8)).project(camera);
    const nx = (near.x + 1) / 2 * width, ny = (1 - near.y) / 2 * height;
    assert.ok(nx > 0 && nx < width && ny > 0 && ny < height, `${width}x${height}: beam end at ${nx.toFixed(1)}, ${ny.toFixed(1)}`);

    let geos = 0, mats = 0, maps = 0;
    const mesh = group.userData.beam;
    const gd = mesh.geometry.dispose.bind(mesh.geometry);
    mesh.geometry.dispose = () => { geos++; gd(); };
    for (const m of group.userData.materials) {
      const md = m.dispose.bind(m);
      m.dispose = () => { mats++; md(); };
    }
    const map = group.userData.lamp.material.map;
    const td = map.dispose.bind(map);
    map.dispose = () => { maps++; td(); };

    group.userData.remove();
    assert.equal(group.parent, null);
    assert.ok(geos >= 1 && mats >= 2 && maps >= 1, 'the beam frees its GPU objects');
  }
});

test('the lighthouse line comes right before the usual goodnight, and is ready to record', () => {
  const line = 'Latarnia świeci w nocy, żeby łódki trafiły do domu.';
  assert.deepEqual(T.lighthouseWhy(), [line]);
  assert.deepEqual(lighthouseBeamLine({ lighthouse: 1 }), [line]);
  assert.deepEqual(lighthouseBeamLine({ moon: 2, stars: 1 }), []);
  assert.deepEqual(goodnightLines({ lighthouse: 1 }, ['Misja w domu!', ...T.nightSky()]), ['Misja w domu!', ...T.nightSky(), line, ...T.goodnight()]);
  assert.deepEqual(goodnightLines({ moon: 1 }, ['Misja w domu!']), ['Misja w domu!', ...T.goodnight()]);
  assert.ok(allSegments(LEVELS, ALL_LETTERS).includes(line));
});
