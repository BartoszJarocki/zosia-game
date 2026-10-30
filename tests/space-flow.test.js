import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const noop = () => {};
globalThis.window = { addEventListener: noop, removeEventListener: noop };
globalThis.location = { search: '' };
globalThis.innerWidth = 1180;
globalThis.innerHeight = 820;
globalThis.document = { createElement() {
  const canvas = { width: 0, height: 0 };
  const ctx = new Proxy({ canvas, createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 30 }) }, { get: (o, k) => k in o ? o[k] : noop });
  canvas.getContext = () => ctx;
  return canvas;
} };
globalThis.__lines = [];
globalThis.__numbers = [];
// Exercise the real Stage and scene builders without a WebGL context or audio device.
const engine = readFileSync(root + '/src/engine.js', 'utf8');
const base = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const renderer = { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: innerWidth, height: innerHeight }) }, info: { autoReset: true, render: { calls: 0 }, reset() {} }, getRenderTarget() { return null; }, setRenderTarget() {}, render() {} };
    export const ease = { inOut: (x) => x, linear: (x) => x };
    export const animate = async (ms, fn) => { for (let i = 0; i <= 20; i++) fn(i / 20); };
    export const hop = async () => {}; export const wait = async () => {};
    ${base}`;
  if (url.endsWith('/src/audio.js')) source = 'export const say = async (s) => { globalThis.__lines.push([s].flat().join(" ")); }; export const hush = () => {}; export const unlockAudio = () => {}; export const sfx = { pop() {}, whoosh() {} };';
  if (url.endsWith('/src/ui.js')) source = 'export const spaceHud = (opts) => { globalThis.__hud = opts; }; export const launchHud = () => ({ number(n) { globalThis.__numbers.push(n); }, start(fn) { globalThis.__start = fn; }, remove() {} });';
  if (url.endsWith('/src/session/session.js')) source = 'import { createSession } from "./director.js"; const s = createSession(1); export const getSession = () => s; export const checkAttention = () => "ok";';
  if (url.endsWith('/src/fx/transition.js')) source = 'export const pawWipe = async (swap) => { await swap(); };';
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { Space, ROAD_ORDER } = await import(root + '/src/scenes/space.js');
const { camera } = await import(root + '/src/engine.js');
const { optimizeScene } = await import(root + '/src/fx/optimize.js');
function frame(s) {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const d = s.view.pos.clone().sub(s.view.look);
  d.setLength(Math.max(d.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
  camera.position.copy(s.view.look).add(d); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
  s.scene.updateMatrixWorld(true); if (s.rocket) s.tick(0.03, 1);
}

test('the trip waits for START, visits every stop, leaves idle visits and returns home', async () => {
  let landed = 0;
  const s = new Space({ hub() { landed++; } });
  frame(s);
  s.enter(); s.collect(); optimizeScene(s.scene); frame(s);
  assert.equal(s.state, 'waiting');
  let shadow = 0, pointLight = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadow++; if (o.isPointLight) pointLight++; });
  assert.equal(shadow, 0); assert.equal(pointLight, 0);
  for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    globalThis.innerWidth = w; globalThis.innerHeight = h; frame(s);
    const circles = s.stopsOnScreen();
    assert.equal(circles.length, 14);
    for (const c of circles) assert.ok(c.r >= 35 && c.x - c.r >= 0 && c.x + c.r <= w && c.y - c.r >= 0 && c.y + c.r <= h, JSON.stringify(c));
  }
  for (const kind of ROAD_ORDER.filter((k) => k !== 'earth')) {
    await s.tapStop(kind); frame(s);
    assert.equal(s.visiting, kind);
    assert.equal(s.state, 'visiting');
    assert.equal(s.stopsOnScreen().length, 1);
    s.fact(); await s.backToMap(); frame(s);
    assert.equal(s.state, 'waiting'); assert.equal(s.visiting, null);
  }
  await s.tapStop('moon');
  s.idleAt = performance.now() - 1; frame(s);
  await new Promise(setImmediate);
  assert.equal(s.state, 'waiting');
  await s.tapStop('earth'); assert.equal(landed, 1); s.exit();
  const interrupted = new Space({ hub() { landed++; } });
  interrupted.enter(); frame(interrupted);
  const trip = interrupted.tapStop('stars');
  await interrupted.returnHome();
  await trip;
  assert.equal(interrupted.state, 'returning');
  assert.equal(interrupted.visiting, null);
  assert.equal(landed, 2);
  interrupted.exit();
  const launch = new Space({ hub() {} }, { launch: true });
  launch.enter(); launch.collect(); optimizeScene(launch.scene);
  await new Promise(setImmediate);
  assert.equal(launch.state, 'launch');
  assert.deepEqual(globalThis.__numbers, [5, 4, 3, 2, 1]);
  assert.ok(globalThis.__start);
  launch.inviteAt = performance.now() - 1; frame(launch);
  assert.equal(launch.state, 'launch');
  assert.ok(globalThis.__lines.includes('Naciśnij wielki guzik START!'));
  globalThis.__start();
  await new Promise(setImmediate);
  await new Promise(setImmediate);
  assert.equal(launch.state, 'waiting');
  assert.ok(globalThis.__lines.includes('To nasza Ziemia!'));
  launch.exit();
});
