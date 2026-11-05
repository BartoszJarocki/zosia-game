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
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
globalThis.__plutoLines = [];
globalThis.__plutoDone = [];
const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const renderer = { getRenderTarget: () => null, setRenderTarget: () => {}, render: () => {} };
    export const ease = { linear: t => t, out: t => t, in: t => t, inOut: t => t };
    export const animate = async (ms, fn) => { for (let i = 0; i <= 20; i++) fn(i / 20); };
    export const wait = async () => {};
    export const hop = async () => {};
    export const addSkyAndLights = () => {};
    export const shakeNo = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async s => { globalThis.__plutoLines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}), add: kind => ({ [kind]: 1 }) };
    export const bubble = () => {}; export const hideBubble = () => {}; export const setProgress = () => {};
    export const setRounds = () => {}; export const nudgeBubble = () => {};
    export const missionHud = opts => { globalThis.__plutoHud = opts; };
    export const celebrate = opts => { globalThis.__plutoCelebration = opts; globalThis.__plutoScene.alive = false; };`;
  if (url.endsWith('/src/session/session.js')) source = `export const checkAttention = () => 'ok';
    export const replayed = () => {}; export const missionDone = kind => { globalThis.__plutoDone.push(kind); return { finale: false }; };`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { PlutoMission } = await import('../src/scenes/pluto.js');
const { plutoRound } = await import('../src/levels/pluto.js');
const { makeShapePiece } = await import('../src/world/garage-props.js');
const { LEVELS } = await import('../src/levels/data.js');
const { CONFIG } = await import('../src/config.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { T } = await import('../src/lang/pl.js');
const flush = () => new Promise(setImmediate);
const heart = (s) => s.tappables.find((o) => o.userData.choice === 'heart');

function view(s, width, height) {
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
  const direction = s.view.pos.clone().sub(s.view.look);
  direction.setLength(Math.max(direction.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
  camera.position.copy(s.view.look).add(direction);
  camera.lookAt(s.view.look);
  camera.updateMatrixWorld(true);
  return camera;
}

function rect(object, camera, width, height) {
  const box = new THREE.Box3().setFromObject(object);
  const xs = [], ys = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).project(camera);
    xs.push((p.x + 1) / 2 * width);
    ys.push((1 - p.y) / 2 * height);
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

const apart = (a, b) => a.x1 < b.x0 - 1 || b.x1 < a.x0 - 1 || a.y1 < b.y0 - 1 || b.y1 < a.y0 - 1;

async function build(level = 1) {
  CONFIG.level = level;
  const s = new PlutoMission({ home() {}, startMission() {} });
  s.build(); s.collect(); optimizeScene(s.scene);
  await s.landed;
  return s;
}

test('the heart is one extruded Garage-style piece used by the scene', async () => {
  const piece = makeShapePiece({ shape: 'heart', colour: '#f9a8d4' });
  assert.ok(piece.userData.body.geometry.getAttribute('position').count > 40);
  assert.equal(piece.userData.body.geometry.type, 'ExtrudeGeometry');
  const s = await build(4);
  assert.equal(s.heartBody.geometry.type, 'ExtrudeGeometry');
  assert.equal(s.heartBody.material.color.getHexString(), new THREE.Color('#b67f9c').getHexString());
  s.exit();
});

test('pieces are one colour, at least 70 px, never overlap, and keep clear of Chase', async () => {
  const s = await build(4);
  const pieces = s.makePieces(plutoRound(s.L, () => 0.5));
  pieces.forEach((o) => o.position.copy(o.userData.home));
  assert.equal(pieces.length, 4);
  assert.deepEqual(pieces.map((o) => o.userData.body.material.color.getHexString()), Array(4).fill('f9a8d4'));
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = view(s, width, height);
    const rects = pieces.map((o) => rect(o, camera, width, height));
    for (let i = 0; i < rects.length; i++) {
      assert.ok(rects[i].x1 - rects[i].x0 >= 70, `${width}x${height} piece ${i} width`);
      for (let j = i + 1; j < rects.length; j++) assert.ok(apart(rects[i], rects[j]), `${width}x${height} pieces ${i} and ${j} touch`);
    }
    const window = rect(s.window, camera, width, height);
    assert.ok(window.x0 >= 0 && window.x1 <= width && window.y0 >= 0 && window.y1 <= height, `${width}x${height} window on screen`);
    for (const r of rects) assert.ok(apart(r, window), `${width}x${height} a piece covers Chase's window`);
  }
  let shadows = 0, pointLights = 0, draws = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene calls plus 20 for medium postprocessing`);
  s.alive = false; s.exit();
});

test('every level runs to its celebration, scores every heart and finishes full', async () => {
  for (let level = 1; level <= 4; level++) {
    globalThis.__plutoCelebration = null;
    const s = new PlutoMission({ home() {}, startMission() {} });
    s.L = LEVELS.pluto[level - 1];
    s.rounds = s.L.rounds;
    globalThis.__plutoScene = s;
    s.enter();
    optimizeScene(s.scene);
    for (let step = 0; step < 200 && !globalThis.__plutoCelebration; step++) {
      await flush();
      if (s.phase === 'choosing' && heart(s)) await heart(s).userData.onTap();
    }
    assert.equal(globalThis.__plutoCelebration?.kind, 'pluto', `level ${level}`);
    assert.equal(globalThis.__plutoDone.at(-1), 'pluto');
    assert.equal(s.answers.length, LEVELS.pluto[level - 1].rounds);
    assert.ok(s.answers.every((a) => a.skill === 'shape' && a.item === 'heart' && a.scored));
    assert.ok(Math.abs(s.heartLevel - 1) < 1e-9, `level ${level} heart full`);
    assert.deepEqual(s.doneLine(), T.plutoDone());
    s.alive = false; s.exit(); await flush();
  }
});
