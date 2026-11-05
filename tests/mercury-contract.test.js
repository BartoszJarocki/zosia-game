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
const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const renderer = { getRenderTarget: () => null, setRenderTarget: () => {}, render: () => {} };
    export const ease = { linear: t => t, out: t => t, in: t => t, inOut: t => t, bounce: t => t, back: t => t };
    export const animate = async (ms, fn) => { for (let i = 0; i <= 20; i++) fn(i / 20); };
    export const wait = async () => {};
    export const hop = async () => {};
    export const addSkyAndLights = () => {};
    export const shakeNo = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async () => {}; export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}), add: kind => ({ [kind]: 1 }) };
    export const bubble = () => {}; export const hideBubble = () => {}; export const setProgress = () => {};
    export const setRounds = () => {}; export const nudgeBubble = () => {};
    export const missionHud = opts => { globalThis.__mercuryHud = opts; };
    export const celebrate = opts => { globalThis.__mercuryCelebration = opts; };`;
  if (url.endsWith('/src/session/session.js')) source = `export const checkAttention = () => 'ok';
    export const replayed = () => {}; export const missionDone = kind => ({ finale: false });`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { MercuryMission } = await import('../src/scenes/mercury.js');
const { LEVELS } = await import('../src/levels/data.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};

function pointsRect(obj, camera, width, height) {
  obj.updateWorldMatrix(true, true);
  const xs = [], ys = [];
  obj.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position');
    if (!p) return;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(camera);
      xs.push((v.x + 1) / 2 * width);
      ys.push((1 - v.y) / 2 * height);
    }
  });
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function spriteRect(sprite, camera, width, height) {
  const p = sprite.getWorldPosition(new THREE.Vector3());
  const distance = p.distanceTo(camera.position);
  const half = sprite.scale.x / 2 * height / (2 * distance * Math.tan(Math.PI * 21 / 180));
  const screen = p.project(camera);
  const cx = (screen.x + 1) / 2 * width, cy = (1 - screen.y) / 2 * height;
  return { minX: cx - half, maxX: cx + half, minY: cy - half, maxY: cy + half };
}

const separate = (a, b) => a.maxX + 1 < b.minX || b.maxX + 1 < a.minX || a.maxY + 1 < b.minY || b.maxY + 1 < a.minY;
const onScreen = (r, width, height) => r.minX >= 0 && r.maxX <= width && r.minY >= 0 && r.maxY <= height;

function uiRects(width, height) {
  const btn = Math.min(0.11 * width, 0.11 * height, 96);
  const paw = Math.min(0.065 * width, 0.055 * height, 50);
  const gap = Math.min(0.014 * width, 12);
  const pawsW = 3 * paw + 2 * gap + 28;
  const free = (width - 32) - (2 * btn + pawsW);
  const pawsX = 16 + btn + free / 2;
  return {
    home: { minX: 16, maxX: 16 + btn, minY: 14, maxY: 14 + btn },
    paws: { minX: pawsX, maxX: pawsX + pawsW, minY: 14, maxY: 14 + paw + 12 },
    bubble: { minX: 16 + btn + 24, maxX: 16 + btn + 24 + 340, minY: 14 + btn + 0.016 * height, maxY: 14 + btn + 0.016 * height + 160 },
  };
}

test('Mercury keeps the craters, tiles, rocket, window and Sun clear and on screen', async () => {
  const s = new MercuryMission({ home() {}, startMission() {} });
  s.L = LEVELS.mercury[4];
  s.level = 5;
  s.rounds = s.L.rounds;
  s.pick = () => 6;
  s.build();
  await s.landed;
  optimizeScene(s.scene);
  s.craterRound();
  assert.equal(s.tappables.length, 0);
  await until(() => s.phase === 'choosing');
  assert.equal(s.last, 6);
  assert.equal(s.blocks.length, 4);
  assert.equal(s.tappables.length, s.blocks.length);
  assert.ok(s.tappables.every((o) => typeof o.userData.num === 'number'));
  assert.ok(s.blocks.some((b) => b.userData.num === s.last));

  let shadows = 0, pointLights = 0, draws = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene calls plus 20 reserved for medium postprocessing`);

  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    const dir = s.view.pos.clone().sub(s.view.look);
    dir.setLength(Math.max(dir.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
    camera.position.copy(s.view.look).add(dir); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
    const ui = uiRects(width, height);
    const tileRects = s.blocks.map((b) => pointsRect(b, camera, width, height));
    const craterRect = pointsRect(s.craters.userData.patch, camera, width, height);
    const dotRects = s.craterDots.map((d) => pointsRect(d.userData.rim, camera, width, height));
    const rocketRect = pointsRect(s.rocket, camera, width, height);
    const windowRect = pointsRect(s.chase, camera, width, height);
    const sunRect = spriteRect(s.sun, camera, width, height);

    for (const r of tileRects) {
      assert.ok(onScreen(r, width, height), `${width}x${height} tile on screen`);
      assert.ok(r.maxX - r.minX >= 70 && r.maxY - r.minY >= 70, `${width}x${height} tile at least 70 px`);
      for (const [name, u] of Object.entries(ui)) assert.ok(separate(r, u), `${width}x${height} tile covers the ${name}`);
      for (const [name, other] of Object.entries({ craterRect, rocketRect, windowRect, sunRect })) assert.ok(separate(r, other), `${width}x${height} tile covers the ${name}`);
    }
    for (let i = 0; i < tileRects.length; i++) for (let j = i + 1; j < tileRects.length; j++) {
      assert.ok(separate(tileRects[i], tileRects[j]), `${width}x${height} tiles ${i} and ${j} touch`);
    }

    for (const r of dotRects) {
      assert.ok(r.maxX - r.minX >= 70 && r.maxY - r.minY >= 70, `${width}x${height} crater at least 70 px`);
      for (const u of Object.values(ui)) assert.ok(separate(r, u), `${width}x${height} crater covers the HUD`);
      for (const other of [rocketRect, windowRect, sunRect]) assert.ok(separate(r, other), `${width}x${height} crater covers the scene`);
    }
    for (let i = 0; i < dotRects.length; i++) for (let j = i + 1; j < dotRects.length; j++) {
      assert.ok(separate(dotRects[i], dotRects[j]), `${width}x${height} craters ${i} and ${j} touch`);
    }
    const patch = s.craters.userData.patch;
    const patchNormal = patch.getWorldDirection(new THREE.Vector3());
    const toPatchCam = camera.position.clone().sub(patch.getWorldPosition(new THREE.Vector3())).normalize();
    assert.ok(patchNormal.dot(toPatchCam) > 0.99, `${width}x${height} craters face the camera`);

    for (const u of Object.values(ui)) assert.ok(separate(craterRect, u), `${width}x${height} craters cover the HUD`);
    for (const other of [rocketRect, windowRect, sunRect]) assert.ok(separate(craterRect, other), `${width}x${height} craters cover the scene`);
    assert.ok(separate(craterRect, { minX: tileRects[0].minX, maxX: tileRects.at(-1).maxX, minY: Math.min(...tileRects.map((r) => r.minY)), maxY: Math.max(...tileRects.map((r) => r.maxY)) }), `${width}x${height} craters cover the tiles`);

    assert.ok(windowRect.maxX - windowRect.minX >= 120 && windowRect.maxY - windowRect.minY >= 120, `${width}x${height} Chase window at least 120 px`);
    const disc = s.chase.userData.disc;
    const normal = disc.getWorldDirection(new THREE.Vector3());
    const toCam = camera.position.clone().sub(s.chase.getWorldPosition(new THREE.Vector3())).normalize();
    assert.ok(normal.dot(toCam) > 0.99, `${width}x${height} Chase window faces the camera`);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(disc.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(up.y > 0.8, `${width}x${height} Chase window is upright`);

    assert.ok(onScreen(sunRect, width, height), `${width}x${height} whole Sun on screen`);
    for (const u of Object.values(ui)) assert.ok(separate(sunRect, u), `${width}x${height} Sun covers the HUD`);
    for (const other of [craterRect, windowRect, ...tileRects]) assert.ok(separate(sunRect, other), `${width}x${height} Sun covers the scene`);
  }
  s.alive = false; s.exit();
});
