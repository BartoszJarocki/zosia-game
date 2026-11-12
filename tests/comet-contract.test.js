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
globalThis.__cometLines = [];
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
    export const hop = async () => {};
    export const wait = async () => {};
    export const addSkyAndLights = () => {};
    export const shakeNo = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async s => { globalThis.__cometLines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}), add: kind => ({ [kind]: 1 }) };
    export const bubble = () => {}; export const hideBubble = () => {}; export const setProgress = () => {};
    export const setRounds = () => {}; export const nudgeBubble = () => {};
    export const missionHud = opts => { globalThis.__cometHud = opts; };
    export const celebrate = opts => { globalThis.__cometCelebration = opts; };`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { CometMission } = await import('../src/scenes/comet.js');
const { camera } = await import('../src/engine.js');
const { LEVELS } = await import('../src/levels/data.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const flush = () => new Promise(setImmediate);

function frame(s, w, h) {
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const { pos, look, minWidth } = s.view;
  const direction = pos.clone().sub(look);
  const base = direction.length();
  direction.setLength(Math.max(base, minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
  camera.position.copy(look).add(direction);
  camera.lookAt(look);
  camera.updateMatrixWorld(true);
}

function visibleBox(obj) {
  obj.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  obj.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  return box;
}

function onScreen(obj) {
  const box = visibleBox(obj);
  const p = new THREE.Vector3();
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    p.set(x, y, z).project(camera);
    if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return false;
  }
  return true;
}

async function build(level = 1) {
  const s = new CometMission({ home() {}, startMission() {} });
  s.L = LEVELS.comet[level - 1];
  s.rounds = s.L.rounds;
  s.pick = (skill, pool) => pool[0];
  s.build();
  optimizeScene(s.scene);
  s.round(1);
  for (let i = 0; i < 100 && !(s.phase === 'catch' && s.comets.length); i++) await flush();
  return s;
}

test('every comet carries its letter, the asked letter is among them, and a comet is tappable only while its letter is in view', async () => {
  const s = await build(4);
  assert.equal(s.comets.length, 6);
  assert.ok(s.comets.every((o) => typeof o.userData.letter === 'string'));
  assert.equal(s.comets.filter((o) => o.userData.letter === s.last).length, 3);
  const tappable = s.tappables.filter((o) => o.userData.letter);
  assert.ok(tappable.length > 0 && tappable.length <= 6);
  assert.ok(tappable.every((o) => s.comets.includes(o)));
  assert.equal(s.learn.current.item, s.last);
  s.alive = false; s.exit();
});

test('Comet has no shadows or point lights, stays under 100 draws, and every comet is at least 70 px', async () => {
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
  const comet = s.comets[0];
  comet.position.set(0, 4, 0);
  comet.updateWorldMatrix(true, true);
  for (const [w, h] of [[1180, 820], [1366, 1024]]) {
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 500);
    const direction = s.view.pos.clone().sub(s.view.look);
    direction.setLength(Math.max(direction.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
    camera.position.copy(s.view.look).add(direction); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(comet.userData.body);
    const xs = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) xs.push(new THREE.Vector3(x, y, z).project(camera).x);
    assert.ok((Math.max(...xs) - Math.min(...xs)) * w / 2 >= 70, `${w}x${h} comet width`);
  }
  s.alive = false; s.exit();
});

test('a tappable comet shows its whole letter, one with the asked letter is always in reach, and the rocket stays on screen', async () => {
  for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const s = await build(4);
    frame(s, w, h);
    for (let i = 0; i < 400; i++) {
      s.update(0.1, i * 0.1);
      s.scene.updateMatrixWorld(true);
      const live = s.tappables.filter((o) => o.userData.letter);
      assert.ok(live.length > 0, `${w}x${h} step ${i}: no comet to tap`);
      for (const c of live) assert.ok(onScreen(c.userData.label), `${w}x${h} step ${i}: a tappable comet's letter is off screen`);
      assert.ok(live.some((c) => c.userData.letter === s.last), `${w}x${h} step ${i}: no asked-letter comet in reach`);
      assert.ok(onScreen(s.rocket), `${w}x${h} step ${i}: the rocket is off screen`);
      await flush();
    }
    s.alive = false; s.exit();
  }
});

test('a comet leaves past the left edge and comes in from the right edge: it never appears or disappears inside the sky', async () => {
  for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const s = await build(4);
    frame(s, w, h);
    const hidden = (c) => {
      const box = visibleBox(c), p = new THREE.Vector3(), xs = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) xs.push(p.set(x, y, z).project(camera).x);
      return Math.min(...xs) > 1 || Math.max(...xs) < -1;
    };
    const wraps = new Set();
    for (let i = 0; i < 700; i++) {
      const before = new Map(s.comets.map((c) => [c, c.position.x]));
      s.scene.updateMatrixWorld(true);
      const was = new Map(s.comets.map((c) => [c, hidden(c)]));
      s.update(0.1, i * 0.1);
      s.scene.updateMatrixWorld(true);
      for (const c of s.comets) {
        if (c.position.x > before.get(c)) {
          wraps.add(c);
          assert.ok(was.get(c) || c.position.x - before.get(c) > 5, `${w}x${h} step ${i}: a comet was still on screen when it jumped`);
          assert.ok(hidden(c), `${w}x${h} step ${i}: a comet turned up on screen`);
          const side = (c.position.x > 0) ? 'right' : 'left';
          assert.equal(side, 'right', 'it comes back from the right');
        } else assert.ok(before.get(c) - c.position.x <= s.pace * 7 * 0.1 + 1e-6, `${w}x${h} step ${i}: a comet moved ${(before.get(c) - c.position.x).toFixed(2)} in one step`);
      }
    }
    assert.ok(wraps.size >= 4, `${w}x${h}: ${wraps.size} comets went round in a minute`);
    s.alive = false; s.exit();
  }
});

test('a lone comet is out of reach for a few seconds at most between one pass and the next, even at the slowest speed', async () => {
  const s = await build(1);
  const [only] = s.comets.filter((c) => c.userData.letter === s.last);
  s.comets.filter((c) => c !== only).forEach((c) => { s.untap(c); c.removeFromParent(); });
  s.comets = [only];
  s.pace = 0.25;
  let gap = 0, longest = 0, passes = 0, was = Boolean(only.userData.onTap);
  for (let i = 0; i < 4000; i++) {
    s.update(0.05, i * 0.05);
    const now = Boolean(only.userData.onTap);
    if (now) { longest = Math.max(longest, gap); gap = 0; } else gap += 0.05;
    if (now && !was) passes++;
    was = now;
  }
  assert.ok(passes >= 2, `${passes} passes in 200 s`);
  assert.ok(longest <= 7, `out of reach for ${longest.toFixed(1)} s`);
  s.alive = false; s.exit();
});

test('every lane is below the speech bubble: the top lane\'s comets start a third of the way down the screen', async () => {
  const s = await build(4);
  const top = s.comets.find((c) => c.userData.lane === 3);
  assert.ok(top, 'a comet in the top lane');
  for (const [w, h, share] of [[1180, 820, 0.33], [1366, 1024, 0.33], [820, 1180, 0.2]]) {
    frame(s, w, h);
    top.position.set(0, 5.4 + 0.6, 0);
    top.updateWorldMatrix(true, true);
    const y = (1 - top.position.clone().project(camera).y) / 2 * h;
    assert.ok(y >= share * h, `${w}x${h}: the top of the highest comet is ${y.toFixed(0)} px down, the bubble ends near ${(share * h).toFixed(0)}`);
  }
  s.alive = false; s.exit();
});
