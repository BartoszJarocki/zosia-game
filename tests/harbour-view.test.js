import test, { after } from 'node:test';
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
const all = ['buoy', 'shallows', 'seal', 'lighthouse', 'gulls', 'reef', 'port'];
saved.set('pup-patrol-progress', JSON.stringify({ v: 6, visited: Object.fromEntries(all.map((place) => [place, 1])), missions: {}, skills: {}, sessions: { count: 0, recent: [] } }));

registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const renderer = { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1180, height: 820 }) }, info: { autoReset: true, render: { calls: 0 }, reset() {} } };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x };
    export class Stage { constructor() { this.scene = new THREE.Scene(); this.tappables = []; this.updates = []; } tappable(o) { this.tappables.push(o); } onUpdate(fn) { this.updates.push(fn); } }
    export const animate = async () => {};
    export const wait = async () => {};
    export const hop = async () => {};
    export const addSkyAndLights = () => {};
    export const shakeNo = () => {};
    export const post = {};`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async () => {}; export const hush = () => {}; export const unlockAudio = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}), add: () => ({}) };
    export const spaceHud = () => {}; export const launchHud = () => ({ number() {}, start() {}, remove() {} });
    export const missionHud = () => {}; export const bubble = () => {}; export const hideBubble = () => {};
    export const setProgress = () => {}; export const setRounds = () => {}; export const nudgeBubble = () => {};
    export const celebrate = () => {}; export const confetti = () => {};`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { Hub } = await import('../src/scenes/hub.js');

const HOME = { pos: new THREE.Vector3(0, 27, 31), look: new THREE.Vector3(0, 2.2, 1.2) };

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

const hub = new Hub({ hub() {}, startMission() {}, map() {} }, { silent: true });
hub.enter();
hub.scene.updateMatrixWorld(true);
after(() => hub.exit());

test('from home every shell is the first thing on its ray, at both screen shapes', () => {
  const shell = hub.shells.children[0];
  for (const [width, height] of [[1180, 820], [820, 1180]]) {
    const camera = homeCamera(width, height);
    const ray = new THREE.Raycaster();
    ray.camera = camera;
    for (const spot of hub.shells.userData.positions) {
      const box = spot.box.clone().applyMatrix4(hub.shells.matrixWorld);
      const centre = box.getCenter(new THREE.Vector3());
      ray.set(camera.position, centre.clone().sub(camera.position).normalize());
      const hit = ray.intersectObjects(hub.scene.children, true)[0];
      assert.ok(hit, `${width}x${height}: ${spot.place} has nothing on its ray`);
      assert.equal(hit.object, shell, `${width}x${height}: ${spot.place} is hidden behind ${hit.object.geometry?.type || hit.object.type}`);
      if (width === 1180) {
        const rect = screenRect(cornersOf(box), camera, width, height);
        const across = rect.x1 - rect.x0;
        assert.ok(across >= 28 && across <= 40, `${width}x${height}: ${spot.place} is ${across.toFixed(1)} px across`);
      }
    }
  }
});

test('the moored boat stands at least 70 px tall from home', () => {
  const camera = homeCamera(1180, 820);
  const boat = hub.scene.getObjectByName('harbour-boat');
  assert.ok(boat, 'the harbour has a named boat');
  const box = new THREE.Box3().setFromObject(boat);
  const rect = screenRect(cornersOf(box), camera, 1180, 820);
  const tall = rect.y1 - rect.y0;
  assert.ok(tall >= 70, `the boat is ${tall.toFixed(1)} px tall`);
});
