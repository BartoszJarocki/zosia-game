import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
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
globalThis.document.querySelectorAll = () => [];
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
globalThis.__marsLines = [];

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = { linear: t => t, out: t => t, in: t => t, inOut: t => t };
    export const animate = async (ms, fn) => { for (let i = 0; i <= 20; i++) fn(i / 20); };
    export const wait = async () => {};
    export const hop = async () => {};
    export const addSkyAndLights = () => {};
    export const shakeNo = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async s => { globalThis.__marsLines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}), add: kind => ({ [kind]: 1 }) };
    export const bubble = opts => { globalThis.__marsBubble = opts; }; export const hideBubble = () => {};
    export const setProgress = () => {}; export const setRounds = () => {}; export const nudgeBubble = () => {};
    export const missionHud = opts => { globalThis.__marsHud = opts; };
    export const celebrate = opts => { globalThis.__marsCelebration = opts; };`;
  if (url.endsWith('/src/session/session.js')) source = `export const checkAttention = () => 'ok';
    export const replayed = () => {}; export const missionDone = kind => { globalThis.__marsDone = kind; return { finale: false }; };`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { MarsMission } = await import('../src/scenes/mars.js');
const { LEVELS } = await import('../src/levels/data.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const rocks = (s) => s.tappables.filter((o) => o.userData.num !== undefined);

async function build(level = 1, target = 3) {
  const s = new MarsMission({ home() {}, startMission() {} });
  s.L = LEVELS.mars[level - 1];
  s.level = level;
  s.rounds = s.L.rounds;
  s.pick = () => target;
  s.build();
  await s.landed;
  optimizeScene(s.scene);
  return s;
}

test('every answer is a tappable rock with userData.num and last is the right number', async () => {
  const s = await build(2, 3);
  const task = s.round(0);
  await until(() => s.learn.isOpen && s.prompt.length);
  assert.equal(s.last, 3);
  assert.deepEqual(rocks(s).map((o) => o.userData.num).sort(), [2, 3, 4]);
  for (const rock of rocks(s)) assert.equal(typeof rock.userData.num, 'number');
  rocks(s).find((o) => o.userData.num === 2).userData.onTap();
  assert.equal(s.answers.length, 0);
  assert.equal(s.last, 3);
  const answerAt = globalThis.__marsLines.length;
  rocks(s).find((o) => o.userData.num === 3).userData.onTap();
  await task;
  assert.equal(s.answers.length, 1);
  assert.equal(s.answers[0].item, '3');
  assert.equal(s.answers[0].scored, true);
  assert.deepEqual(globalThis.__marsLines.slice(answerAt), ['Brawo! Łazik dojechał!']);
  s.alive = false; s.exit();
});

test('Mars has no shadows or point lights, keeps every rock large, and leaves room for medium post passes', async () => {
  const s = await build(5, 3);
  const task = s.round(0);
  await until(() => s.learn.isOpen && s.prompt.length);
  s.scene.updateMatrixWorld(true);
  for (const [w, h] of [[1180, 820], [1366, 1024]]) {
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 500);
    const direction = s.view.pos.clone().sub(s.view.look);
    direction.setLength(Math.max(direction.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
    camera.position.copy(s.view.look).add(direction); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
    for (const rock of rocks(s)) {
      const box = new THREE.Box3().setFromObject(rock);
      const xs = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) xs.push(new THREE.Vector3(x, y, z).project(camera).x);
      assert.ok((Math.max(...xs) - Math.min(...xs)) * w / 2 >= 70, `${w}x${h} rock ${rock.userData.num}`);
    }
  }
  let draws = 0, shadows = 0, pointLights = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene draws`);
  s.alive = false; s.exit();
  void task;
});
