import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

const noop = () => {};
globalThis.window = { addEventListener: noop, removeEventListener: noop };
globalThis.location = { search: '' };
globalThis.document = { createElement() {
  const canvas = { width: 0, height: 0 };
  const context = new Proxy({ canvas, createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 30 }) }, { get: (o, k) => k in o ? o[k] : noop });
  canvas.getContext = () => context;
  return canvas;
} };
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
globalThis.__saturnLines = [];
globalThis.__saturnDone = [];
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
    export const hop = () => Promise.resolve();
    export const wait = async () => {};
    export const addSkyAndLights = () => {};
    export const shakeNo = () => {};
    export const renderer = { getRenderTarget() { return null; }, setRenderTarget() {}, render() {} };
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async s => { globalThis.__saturnLines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}), add: kind => ({ [kind]: 1 }) };
    export const bubble = () => {}; export const hideBubble = () => {}; export const setProgress = () => {};
    export const setRounds = () => {}; export const nudgeBubble = () => {};
    export const missionHud = opts => { globalThis.__saturnHud = opts; };
    export const celebrate = opts => { globalThis.__saturnCelebration = opts; globalThis.__saturnScene.alive = false; };`;
  if (url.endsWith('/src/session/session.js')) source = `export const checkAttention = () => 'ok';
    export const replayed = () => {}; export const missionDone = kind => { globalThis.__saturnDone.push(kind); return { finale: false }; };`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { SaturnMission } = await import('../src/scenes/saturn.js');
const { saturnPieces } = await import('../src/levels/saturn.js');
const { LEVELS } = await import('../src/levels/data.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const { T } = await import('../src/lang/pl.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 400; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const ring = (s, kind) => s.tappables.find((o) => o.userData.choice === kind);

async function build(level = 1, plan = null) {
  const s = new SaturnMission({ home() {}, startMission() {} });
  s.L = LEVELS.saturn[level - 1];
  s.rounds = s.L.pieces;
  s.plan = plan || saturnPieces(s.L, () => 0.37);
  s.build();
  await s.landed;
  optimizeScene(s.scene);
  return s;
}

test('both rings are answer choices with string labels, and the piece is draggable too', async () => {
  const s = await build(1, [{ kind: 'ice', size: 'same' }]);
  s.rounds = 1;
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  assert.equal(s.last, 'ice');
  const choices = s.tappables.filter((o) => o.userData.choice !== undefined);
  assert.deepEqual(choices.map((o) => o.userData.choice).sort(), ['ice', 'rock']);
  assert.ok(choices.every((o) => typeof o.userData.choice === 'string'));
  assert.ok(choices.every((o) => o.visible));
  assert.ok(s.pieceObj.userData.drag);
  ring(s, 'ice').userData.onTap();
  await task;
  assert.equal(s.answers[0].skill, 'sorting');
  assert.equal(s.answers[0].item, 'ice');
  assert.equal(s.answers[0].scored, true);
  s.alive = false; s.exit();
});

test('a right piece shrinks its hole and every hole closes when the pieces are in', async () => {
  const s = await build(4);
  const plan = saturnPieces(LEVELS.saturn[3], () => 0.37);
  s.plan = plan;
  for (let r = 0; r < plan.length && s.alive; r++) {
    const task = s.round(r);
    await until(() => s.phase === 'asking');
    await ring(s, s.last).userData.onTap();
    await task;
  }
  for (const slot of s.slots) {
    assert.equal(slot.filled, plan.filter((p) => `${p.kind}:${p.size}` === slot.key).length);
    assert.equal(slot.gap.visible, false);
  }
  await s.outro();
  assert.equal(s.spin, true);
  s.alive = false; s.exit();
});

test('each gap lies in its ring plane and is visible before the first piece', async () => {
  const s = await build(4);
  s.scene.updateMatrixWorld(true);
  const normalOf = (obj) => {
    obj.updateWorldMatrix(true, true);
    const normal = new THREE.Vector3().fromBufferAttribute(obj.geometry.getAttribute('normal'), 0);
    return normal.applyMatrix3(new THREE.Matrix3().getNormalMatrix(obj.matrixWorld)).normalize();
  };
  for (const { key, kind, gap } of s.slots) {
    assert.equal(gap.visible, true, key);
    assert.ok(Math.abs(normalOf(s.rings[kind].mesh).dot(normalOf(gap))) > 0.999, `${key} hole is parallel to its ring`);
  }
  s.alive = false; s.exit();
});

test('the ring taps line up with the drawn rings at every iPad size, by kind and by both', async () => {
  for (const level of [1, 4]) {
    const s = await build(level);
    s.scene.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
      const direction = s.view.pos.clone().sub(s.view.look);
      direction.setLength(Math.max(direction.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
      camera.position.copy(s.view.look).add(direction); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
      for (const { key, tap, radii, angle: hole, size } of s.slots) {
        const radius = (radii[0] + radii[1]) / 2;
        // the hole, the front, and the side of the ring (or of its half); angles as the ring geometry draws them
        const angles = [hole, ...(size ? [size === 'big' ? Math.PI : 0] : [-Math.PI / 2, Math.PI, 0])];
        for (const angle of angles) {
          const world = s.saturn.localToWorld(new THREE.Vector3(Math.cos(angle) * radius, 0.01, -Math.sin(angle) * radius));
          const ndc = world.clone().project(camera);
          ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
          const hits = ray.intersectObjects(s.tappables, false);
          assert.ok(hits.length, `${width}x${height} ${key} ${angle}`);
          assert.equal(hits[0].object, tap, `${width}x${height} ${key} ${angle}`);
        }
      }
    }
    s.alive = false; s.exit();
  }
});

test('Saturn has no shadows or point lights and stays below the medium draw budget', async () => {
  const s = await build(4);
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
});

test('every level runs through the real Mission loop to celebration and counts for the session', async () => {
  for (let level = 1; level <= 4; level++) {
    globalThis.__saturnCelebration = null;
    const s = new SaturnMission({ home() {}, startMission() {} });
    s.L = LEVELS.saturn[level - 1];
    s.rounds = s.L.pieces;
    s.plan = saturnPieces(s.L, () => 0.37);
    globalThis.__saturnScene = s;
    s.enter();
    optimizeScene(s.scene);
    for (let step = 0; step < 600 && !globalThis.__saturnCelebration; step++) {
      if (s.phase === 'asking') await ring(s, s.last).userData.onTap();
      await flush();
    }
    const pieces = LEVELS.saturn[level - 1].pieces;
    assert.equal(globalThis.__saturnCelebration?.kind, 'saturn', `level ${level}`);
    assert.equal(globalThis.__saturnDone.at(-1), 'saturn');
    assert.equal(s.answers.length, pieces);
    assert.ok(s.answers.every((a) => a.scored && a.skill === 'sorting'));
    assert.equal(scoreRun(s.answers).scored, pieces);
    assert.deepEqual(s.doneLine(), T.saturnDone());
    s.exit();
  }
});
