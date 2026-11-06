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

// Reuse the real space looks without starting the WebGL engine or the HUD.
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

const { shelfItems, ROCKET_BADGE } = await import('../src/shelf.js');
const { makeKeepsakes, addKeepsakes, keepsakeKinds, KEEPSAKE_KINDS, KEEPSAKE_CLEAR } = await import('../src/world/keepsakes.js');
const { makeNightSky, nightSkyLine } = await import('../src/world/night-sky.js');
const { makeLaunchPad } = await import('../src/world/rocket.js');
const { T, allSegments } = await import('../src/lang/pl.js');
const { LEVELS, ALL_LETTERS } = await import('../src/levels/data.js');

const HOME = { pos: new THREE.Vector3(0, 27, 31), look: new THREE.Vector3(0, 2.2, 1.2) };
const PAD = [-6, -19];
const TAP_RADIUS = 3.2;

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

function roundRect(o, camera, width, height) {
  if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
  const centre = o.getWorldPosition(new THREE.Vector3());
  const q = centre.clone().project(camera);
  const focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const r = o.geometry.boundingSphere.radius * focal / centre.distanceTo(camera.position);
  const x = (q.x + 1) / 2 * width, y = (1 - q.y) / 2 * height;
  return { x0: x - r, x1: x + r, y0: y - r, y1: y + r };
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

function overlaps(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

test('the shelf keeps island badges and shows every space badge as one rocket', () => {
  const items = shelfItems({ letters: 1, cones: 2, moon: 1, stars: 1, comet: 1 });
  assert.deepEqual(items.map((i) => i.kind), ['letters', 'cones', 'rocket']);
  const rocket = items[2];
  assert.equal(rocket.count, 3);
  assert.deepEqual(rocket.badge, { label: '🚀', color: '#6d28d9' });
  assert.deepEqual(rocket.badge, ROCKET_BADGE);

  const islandOnly = shelfItems({ letters: 1, cones: 2 });
  assert.deepEqual(islandOnly.map((i) => i.kind), ['letters', 'cones']);
  assert.equal(islandOnly.some((i) => i.kind === 'rocket'), false);

  assert.deepEqual(shelfItems({}).map((i) => i.kind), []);
  assert.deepEqual(shelfItems({ mercury: 2 }).map((i) => [i.kind, i.count]), [['rocket', 2]]);
});

test('visited space places become keepsakes, unvisited ones leave nothing', () => {
  const all = Object.fromEntries(KEEPSAKE_KINDS.map((kind) => [kind, 1]));
  assert.deepEqual(keepsakeKinds(all), KEEPSAKE_KINDS);
  assert.deepEqual(keepsakeKinds({ moon: 2, stars: 1, letters: 4 }), ['moon', 'stars']);

  const group = makeKeepsakes({ moon: 2, stars: 1, telescope: 3 });
  assert.deepEqual(group.userData.kinds, ['moon', 'stars']);
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].isMesh, true);

  const empty = makeKeepsakes({ letters: 1, rocket: 1 });
  assert.deepEqual(empty.userData.kinds, []);
  assert.equal(empty.children.length, 0);
});

test('with every keepsake present the rocket tap target stays at least 70 px and clear', () => {
  const all = Object.fromEntries(KEEPSAKE_KINDS.map((kind) => [kind, 1]));
  for (const [width, height] of [[1180, 820], [1366, 1024]]) {
    const camera = homeCamera(width, height);
    const group = addKeepsakes(new THREE.Scene(), PAD, all);
    group.updateWorldMatrix(true, true);

    const centre = new THREE.Vector3(PAD[0], 2.75, PAD[1]).project(camera);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const edge = new THREE.Vector3(PAD[0], 2.75, PAD[1]).addScaledVector(right, TAP_RADIUS).project(camera);
    const diameter = Math.abs(edge.x - centre.x) * width;
    assert.ok(diameter >= 70, `${width}x${height}: ${diameter.toFixed(1)} px`);

    for (const spot of group.userData.positions) {
      const r = Math.hypot(spot.x, spot.z);
      assert.ok(r - spot.radius > TAP_RADIUS, `${spot.kind} covers the tap target`);
      assert.ok(r + spot.radius <= KEEPSAKE_CLEAR + 1e-6, `${spot.kind} leaves the pad clearing`);
    }
  }
});

test('every keepsake reads at least 28 px across and stays out of the tap area', () => {
  const all = Object.fromEntries(KEEPSAKE_KINDS.map((kind) => [kind, 1]));
  const width = 1180, height = 820;
  const camera = homeCamera(width, height);
  const scene = new THREE.Scene();
  const group = addKeepsakes(scene, PAD, all);
  scene.updateMatrixWorld(true);
  for (const spot of group.userData.positions) {
    const box = spot.box.clone().applyMatrix4(group.matrixWorld);
    const rect = screenRect(cornersOf(box), camera, width, height);
    assert.ok(rect.x1 - rect.x0 >= 28, `${spot.kind}: ${(rect.x1 - rect.x0).toFixed(1)} px across`);
    assert.ok(Math.hypot(spot.x, spot.z) - spot.radius > TAP_RADIUS, `${spot.kind} overlaps the rocket tap area`);
  }
});

test('all keepsakes together add at most four draw calls and cast no shadows', () => {
  const all = Object.fromEntries(KEEPSAKE_KINDS.map((kind) => [kind, 1]));
  const scene = new THREE.Scene();
  scene.add(makeLaunchPad());
  const before = drawCost(scene);
  const group = addKeepsakes(scene, PAD, all);
  const grown = drawCost(scene) - before;
  assert.ok(grown <= 4, `${grown} draw calls`);
  let shadows = 0;
  group.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; });
  assert.equal(shadows, 0);
});

test('after goodnight the Moon and seven stars sit high in the picture, over everything', () => {
  const shelf = { x0: 16, y0: 14, x1: 252, y1: 94 }; // the three-badge shelf at the top left
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = homeCamera(width, height);
    const scene = new THREE.Scene();
    const other = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    other.renderOrder = 6;
    scene.add(other);
    const sky = makeNightSky(camera, width, height);
    scene.add(sky);
    scene.updateMatrixWorld(true);

    for (const m of sky.userData.materials) {
      assert.equal(m.depthTest, false, `${width}x${height}: not on the glass`);
      assert.equal(m.depthWrite, false, `${width}x${height}: writes depth`);
      assert.equal(m.fog, false, `${width}x${height}: fogged`);
    }
    sky.traverse((o) => {
      if (!(o.isMesh || o.isSprite || o.isLine)) return;
      assert.ok(o.renderOrder > other.renderOrder, `${width}x${height}: drawn before the scene`);
    });

    const rectOf = (o) => roundRect(o, camera, width, height);
    const moon = rectOf(sky.userData.moon);
    assert.ok(moon.x0 >= 0 && moon.x1 <= width && moon.y0 >= 0 && moon.y1 <= height, `${width}x${height}: Moon on screen`);
    assert.ok(moon.y1 < height * 0.2, `${width}x${height}: Moon in the top band`);
    assert.ok(!overlaps(moon, shelf), `${width}x${height}: Moon over the shelf`);
    if (width === 1180) assert.ok(moon.x1 - moon.x0 >= 80 && moon.x1 - moon.x0 <= 110, `${width}x${height}: Moon ${(moon.x1 - moon.x0).toFixed(1)} px across`);

    assert.equal(sky.userData.stars.length, 7);
    const stars = sky.userData.stars.map((star) => {
      const rect = rectOf(star);
      assert.ok(rect.x0 >= 0 && rect.x1 <= width && rect.y0 >= 0 && rect.y1 <= height, `${width}x${height}: star on screen`);
      assert.ok(rect.y1 < height * 0.2, `${width}x${height}: star in the top band`);
      assert.ok(!overlaps(rect, shelf), `${width}x${height}: star over the shelf`);
      assert.ok(!overlaps(rect, moon), `${width}x${height}: star over the Moon`);
      if (width === 1180) assert.ok(rect.x1 - rect.x0 >= 24 && rect.x1 - rect.x0 <= 36, `${width}x${height}: star ${(rect.x1 - rect.x0).toFixed(1)} px across`);
      return rect;
    });
    for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) {
      assert.ok(!overlaps(stars[i], stars[j]), `${width}x${height}: stars ${i} and ${j} touch`);
    }

    sky.userData.remove();
    assert.equal(sky.parent, null);
  }
});

test('the night line is said only for a Moon or stars visit, and is ready to record', () => {
  const line = 'Popatrz! Na niebie świeci Księżyc i Wielki Wóz.';
  assert.deepEqual(T.nightSky(), [line]);
  assert.deepEqual(nightSkyLine({ moon: 1 }), [line]);
  assert.deepEqual(nightSkyLine({ stars: 2 }), [line]);
  assert.deepEqual(nightSkyLine({ sun: 1, mars: 3 }), []);
  assert.ok(allSegments(LEVELS, ALL_LETTERS).includes(line));
});
