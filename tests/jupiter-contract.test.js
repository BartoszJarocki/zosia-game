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
globalThis.__jupiterLines = [];
globalThis.__jupiterHud = null;
globalThis.__jupiterCelebration = null;
const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const renderer = { getRenderTarget() {}, setRenderTarget() {}, render() {} };
    export const ease = { inOut: t => t, out: t => t, in: t => t, linear: t => t };
    export const animate = async (ms, fn) => { for (let i = 0; i <= 20; i++) fn(i / 20); };
    export const wait = async () => {};
    export const hop = async () => {};
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async s => { globalThis.__jupiterLines.push(...[s].flat()); };
    export const hush = () => {}; export const unlockAudio = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}), add: kind => ({ [kind]: 1 }) };
    export const bubble = () => {}; export const hideBubble = () => {}; export const setProgress = () => {};
    export const setRounds = () => {}; export const nudgeBubble = () => {};
    export const missionHud = opts => { globalThis.__jupiterHud = opts; };
    export const celebrate = opts => { globalThis.__jupiterCelebration = opts; globalThis.__jupiterScene.alive = false; };
    export const spaceHud = () => {}; export const launchHud = () => {};`;
  if (url.endsWith('/src/session/session.js')) source = `export const checkAttention = () => 'ok';
    export const replayed = () => {}; export const missionDone = () => ({ finale: false });`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { JupiterMission } = await import('../src/scenes/jupiter.js');
const { LEVELS } = await import('../src/levels/data.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const flush = () => new Promise(setImmediate);

async function build(level = 1) {
  const s = new JupiterMission({ home() {}, startMission() {} });
  s.L = LEVELS.jupiter[level - 1];
  s.rounds = s.L.rounds;
  s.random = () => 0;
  s.build();
  await s.landed;
  optimizeScene(s.scene);
  return s;
}

function bounds(obj, camera, width, height) {
  obj.updateWorldMatrix(true, true);
  const vertices = [];
  obj.traverseVisible((o) => {
    if (!o.geometry || o.material?.visible === false) return;
    const points = o.geometry.getAttribute('position');
    for (let i = 0; i < points.count; i++) vertices.push(new THREE.Vector3().fromBufferAttribute(points, i).applyMatrix4(o.matrixWorld).project(camera));
  });
  const xs = vertices.map((p) => (p.x + 1) * width / 2), ys = vertices.map((p) => (1 - p.y) * height / 2);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

function cameraFor(s, width, height) {
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
  const dir = s.view.pos.clone().sub(s.view.look);
  dir.setLength(Math.max(dir.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
  camera.position.copy(s.view.look).add(dir); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
  return camera;
}

/** Where a ball of world radius r lands on screen, as a disc: { x, y, r }. */
function disc(obj, radius, camera, width, height) {
  const centre = obj.getWorldPosition(new THREE.Vector3());
  const projected = centre.clone().project(camera);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const distance = centre.clone().sub(camera.position).dot(forward);
  const focal = (height / 2) / Math.tan(camera.fov * Math.PI / 360);
  return {
    x: (projected.x + 1) * width / 2,
    y: (1 - projected.y) * height / 2,
    r: focal * radius / Math.sqrt(Math.max(0.0001, distance * distance - radius * radius)),
  };
}

test('paint pots are walker choices, at least 70 px, and this.last stays the answer', async () => {
  const s = await build();
  const round = s.stripesRound();
  await flush();
  const pots = s.tappables.filter((o) => o.userData.choice);
  assert.deepEqual(pots.map((o) => o.userData.choice).sort(), ['orange', 'red', 'white']);
  assert.equal(s.last, 'orange');
  assert.ok(pots.some((o) => o.userData.choice === s.last));
  for (const [width, height] of [[1180, 820], [1366, 1024]]) {
    const camera = cameraFor(s, width, height);
    for (const pot of pots) {
      const b = bounds(pot, camera, width, height);
      assert.ok(b.right - b.left >= 70, `${width}x${height} pot width ${b.right - b.left}`);
      assert.ok(b.bottom - b.top >= 70, `${width}x${height} pot height ${b.bottom - b.top}`);
      assert.ok(b.left >= 0 && b.right <= width && b.top >= 0 && b.bottom <= height);
    }
  }
  await pots.find((o) => o.userData.choice === 'orange').userData.onTap();
  await round;
  assert.equal(s.answers[0].scored, true);
  s.alive = false; s.exit();
});

test('both balls are walker choices and Earth is about 90 px across at 1180x820', async () => {
  const s = await build();
  const answers = [0.9, 0, 0.9];
  s.random = () => answers.shift() ?? 0.9;
  s.L = { ...s.L, bigger: 'both' };
  const round = s.sizeRound();
  await flush();
  const balls = s.tappables.filter((o) => o.userData.choice);
  assert.deepEqual(balls.map((o) => o.userData.choice).sort(), ['earth', 'sun']);
  assert.equal(s.last, 'earth');
  assert.ok(balls.some((o) => o.userData.choice === s.last));
  const camera = cameraFor(s, 1180, 820);
  const earth = bounds(balls.find((o) => o.userData.choice === 'earth'), camera, 1180, 820);
  const sun = bounds(balls.find((o) => o.userData.choice === 'sun'), camera, 1180, 820);
  assert.ok(Math.abs((earth.right - earth.left) - 90) < 5, `Earth is ${earth.right - earth.left} px`);
  assert.ok(sun.right - sun.left > (earth.right - earth.left) * 3);
  await balls.find((o) => o.userData.choice === 'earth').userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'comparison');
  assert.equal(s.answers[0].scored, true);
  s.alive = false; s.exit();
});

test('a size round hides the background planet and keeps the big ball clear of Chase on every iPad', async () => {
  const s = await build();
  s.L = { ...s.L, bigger: 'big' };
  s.random = () => 0.9;
  const round = s.sizeRound();
  await flush();
  assert.equal(s.planet.visible, false);
  assert.equal(s.redSpot.visible, false);
  const balls = s.tappables.filter((o) => o.userData.choice && o.visible);
  assert.equal(balls.length, 2);
  const big = balls.find((o) => o.userData.choice === s.last);
  assert.ok(big);
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(s, width, height);
    const ball = disc(big, big.userData.radius, camera, width, height);
    const chase = disc(s.chase, 1.14, camera, width, height);
    assert.ok(ball.x - ball.r >= 0 && ball.x + ball.r <= width, `${width}x${height} big ball x`);
    assert.ok(ball.y - ball.r >= 0 && ball.y + ball.r <= height, `${width}x${height} big ball y`);
    const gap = Math.hypot(ball.x - chase.x, ball.y - chase.y) - ball.r - chase.r;
    assert.ok(gap > 0, `${width}x${height}: ${gap.toFixed(1)} px between the big ball and Chase`);
  }
  await big.userData.onTap();
  await round;
  assert.equal(s.planet.visible, false);
  s.clearRound();
  assert.equal(s.planet.visible, true);
  s.alive = false; s.exit();
});

test('the two balls keep a 50 px gap with Earth on either side at every iPad size', async () => {
  for (const earthLeft of [true, false]) {
    const s = await build();
    const answers = earthLeft ? [0.9, 0] : [0.9, 0.9];
    s.random = () => answers.shift() ?? 0.9;
    s.L = { ...s.L, bigger: 'big' };
    const round = s.sizeRound();
    await flush();
    const balls = s.tappables.filter((o) => o.userData.choice);
    const earth = balls.find((o) => o.userData.choice === 'earth');
    const big = balls.find((o) => o.userData.choice !== 'earth');
    assert.ok(earth && big);
    assert.equal(earth.position.x < big.position.x, earthLeft);
    for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
      const camera = cameraFor(s, width, height);
      const e = disc(earth, earth.userData.radius, camera, width, height);
      const b = disc(big, big.userData.radius, camera, width, height);
      const gap = Math.hypot(e.x - b.x, e.y - b.y) - e.r - b.r;
      assert.ok(gap >= 50, `Earth ${earthLeft ? 'left' : 'right'} ${width}x${height}: ${gap.toFixed(1)} px between the balls`);
    }
    await balls.find((o) => o.userData.choice === s.last).userData.onTap();
    await round;
    s.alive = false; s.exit();
  }
});

test('all controls stay inside both iPads and the scene stays below the draw budget', async () => {
  const s = await build();
  const round = s.stripesRound();
  await flush();
  for (const [width, height] of [[1180, 820], [1366, 1024]]) {
    const camera = cameraFor(s, width, height);
    for (const pot of s.tappables.filter((o) => o.userData.choice)) {
      const b = bounds(pot, camera, width, height);
      assert.ok(b.left >= 0 && b.right <= width && b.top >= 0 && b.bottom <= height, `${width}x${height}`);
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
  await s.tappables.find((o) => o.userData.choice === s.last).userData.onTap();
  await round;
  s.alive = false; s.exit();
});
