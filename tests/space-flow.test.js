import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

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
const saved = new Map();
globalThis.localStorage = { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) };
globalThis.__attention = 'ok';
globalThis.__checks = 0;
globalThis.__lines = [];
globalThis.__numbers = [];
// Exercise the real Stage and scene builders without a WebGL context or audio device.
const engine = readFileSync(root + '/src/engine.js', 'utf8');
const base = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const renderer = { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: innerWidth, height: innerHeight }) }, info: { autoReset: true, render: { calls: 0 }, reset() {} }, getRenderTarget() { return null; }, setRenderTarget() {}, render() {} };
    export const ease = { inOut: (x) => x, linear: (x) => x };
    export const animate = async (ms, fn) => { for (let i = 0; i <= 20; i++) fn(i / 20); };
    export const hop = async () => {}; export const wait = async () => {};
    ${base}`;
  if (url.endsWith('/src/audio.js')) source = 'export const say = async (s) => { globalThis.__lines.push([s].flat().join(" ")); }; export const hush = () => {}; export const unlockAudio = () => {}; export const sfx = { pop() {}, whoosh() {} };';
  if (url.endsWith('/src/ui.js')) source = 'export const badges = { get: () => ({}) }; export const spaceHud = (opts) => { globalThis.__hud = opts; }; export const launchHud = () => ({ number(n) { globalThis.__numbers.push(n); }, start(fn) { globalThis.__start = fn; }, remove() {} });';
  if (url.endsWith('/src/session/session.js')) source = 'import { createSession } from "./director.js"; const s = createSession(1); export const getSession = () => s; export const checkAttention = () => { globalThis.__checks++; if (globalThis.__attention === "finish") s.endedEarly = true; return globalThis.__attention; };';
  if (url.endsWith('/src/fx/transition.js')) source = 'export const pawWipe = async (swap) => { await swap(); };';
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { Space, ROAD_ORDER, LAYOUT } = await import(root + '/src/scenes/space.js');
const { getSession } = await import(root + '/src/session/session.js');
const { getVisited } = await import(root + '/src/progress.js');
const { camera } = await import(root + '/src/engine.js');
const { optimizeScene } = await import(root + '/src/fx/optimize.js');
function frame(s) {
  s.resize?.();
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const d = s.view.pos.clone().sub(s.view.look);
  d.setLength(Math.max(d.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
  camera.position.copy(s.view.look).add(d); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
  s.scene.updateMatrixWorld(true); if (s.rocket) s.tick(0.03, 1);
}

function screenBounds(points) {
  const screen = points.map((p) => p.clone().project(camera));
  return { l: Math.min(...screen.map((p) => p.x)), r: Math.max(...screen.map((p) => p.x)),
    b: Math.min(...screen.map((p) => p.y)), t: Math.max(...screen.map((p) => p.y)) };
}

function visibleBounds(root) {
  root.updateWorldMatrix(true, true);
  const points = [];
  root.traverseVisible((o) => {
    if (!o.geometry || o.isSprite || o.material?.visible === false) return;
    const vertices = o.geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(o.matrixWorld));
  });
  return screenBounds(points);
}

const separate = (a, b) => a.l > b.r || a.r < b.l || a.b > b.t || a.t < b.b;
const margin = (b) => b.l >= -0.880001 && b.r <= 0.880001 && b.b >= -0.880001 && b.t <= 0.880001;

test('the built map keeps its rocket, discs and bouncing star inside the margins after resizing', () => {
  const s = new Space({});
  s.enter(); s.collect(); optimizeScene(s.scene);
  for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    globalThis.innerWidth = w; globalThis.innerHeight = h;
    for (const here of ROAD_ORDER) {
      s.routeIndex = ROAD_ORDER.indexOf(here);
      s.parkRocket();
      for (const suggested of ROAD_ORDER) {
        s.suggested = suggested;
        frame(s);
        const rocket = visibleBounds(s.rocket);
        assert.ok(margin(rocket), `${w}x${h} ${here}: rocket margin`);
        for (const [kind, { at, disc }] of Object.entries(LAYOUT)) {
          const points = Array.from({ length: 64 }, (_, i) => {
            const a = i / 64 * Math.PI * 2;
            return new THREE.Vector3(at[0] + Math.cos(a) * (disc + 0.18), -0.02, at[2] + Math.sin(a) * (disc + 0.18));
          });
          const pad = screenBounds(points);
          assert.ok(margin(pad), `${w}x${h} ${kind}: disc margin`);
          assert.ok(separate(rocket, pad), `${w}x${h} ${here}: rocket covers ${kind}`);
          assert.ok(margin(visibleBounds(s.bodies[kind])), `${w}x${h} ${kind}: body margin`);
        }
        for (const t of [0, 0.5, 1, 1.5, 2]) {
          s.updateSuggestion(t);
          const star = visibleBounds(s.suggestion);
          assert.ok(margin(star), `${w}x${h} ${suggested}: star margin`);
          assert.ok(separate(rocket, star), `${w}x${h} ${here}: rocket hides ${suggested} star`);
        }
        const targets = s.stopsOnScreen();
        for (const c of targets) {
          assert.ok(c.r >= 35 && c.x - c.r >= 0 && c.x + c.r <= w && c.y - c.r >= 0 && c.y + c.r <= h, `${w}x${h} ${c.kind}: target`);
          for (const other of targets) if (other !== c) assert.ok(Math.hypot(c.x - other.x, c.y - other.y) > c.r + other.r, `${c.kind} overlaps ${other.kind}`);
        }
      }
    }
  }
  s.exit();
});

test('the trip waits for START, visits every stop, leaves idle visits and returns home', async () => {
  let landed = 0;
  globalThis.__checks = 0;
  const started = [];
  const s = new Space({ hub() { landed++; }, startMission(kind) { started.push(kind); } });
  frame(s);
  s.enter(); s.collect(); optimizeScene(s.scene); frame(s);
  assert.equal(s.state, 'waiting');
  assert.ok(['moon', 'mars', 'saturn', 'pluto', 'blackhole', 'stars', 'telescope'].includes(s.suggested), `suggested ${s.suggested}`); // (the director picks among fresh games at random)
  assert.equal(globalThis.__checks, 1);
  let shadow = 0, pointLight = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadow++; if (o.isPointLight) pointLight++; });
  assert.equal(shadow, 0); assert.equal(pointLight, 0);
  let draws = 0;
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const material of [o.material].flat()) {
      if (!material.visible) continue;
      draws += material.transparent && material.side === THREE.DoubleSide && !material.forceSinglePass ? 2 : 1;
    }
  });
  assert.ok(draws + 20 < 100, `${draws} scene draws leave room for the medium post passes`);
  for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    globalThis.innerWidth = w; globalThis.innerHeight = h; frame(s);
    const circles = s.stopsOnScreen();
    assert.equal(circles.length, 14);
    for (const c of circles) assert.ok(c.r >= 35 && c.x - c.r >= 0 && c.x + c.r <= w && c.y - c.r >= 0 && c.y + c.r <= h, JSON.stringify(c));
  }
  for (const kind of ROAD_ORDER.filter((k) => !['earth', 'moon'].includes(k))) {
    await s.tapStop(kind); frame(s);
    assert.equal(s.visiting, kind);
    assert.equal(s.state, 'visiting');
    const gameStops = {
      mars: { started: ['mars'], routeIndex: 5 },
      saturn: { started: ['mars', 'saturn'], routeIndex: 7 },
      pluto: { started: ['mars', 'saturn', 'pluto'], routeIndex: 10 },
      blackhole: { started: ['mars', 'saturn', 'pluto', 'blackhole'], routeIndex: 11 },
      stars: { started: ['mars', 'saturn', 'pluto', 'blackhole', 'stars'], routeIndex: 13 },
    };
    if (gameStops[kind]) {
      assert.deepEqual(started, gameStops[kind].started);
      assert.equal(started.at(-1), kind);
      assert.equal(getVisited()[kind], 1);
      assert.equal(s.routeIndex, gameStops[kind].routeIndex);
      await s.backToMap(); frame(s);
      assert.equal(s.state, 'waiting');
      continue;
    }
    assert.equal(s.stopsOnScreen().length, 1);
    const visits = getVisited()[kind];
    assert.equal(visits, 1);
    assert.equal(JSON.parse(saved.get('pup-patrol-progress')).visited[kind], 1);
    s.fact();
    assert.equal(getVisited()[kind], visits);
    await s.backToMap(); frame(s);
    assert.equal(s.state, 'waiting'); assert.equal(s.visiting, null);
  }
  await s.tapStop('jupiter');
  s.idleAt = performance.now() - 1; frame(s);
  await new Promise(setImmediate);
  assert.equal(s.state, 'waiting');
  await s.tapStop('earth'); assert.equal(landed, 1); s.exit();
  const interrupted = new Space({ hub() { landed++; } });
  interrupted.enter(); frame(interrupted);
  const trip = interrupted.tapStop('comet');
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

test('a Moon arrival records its visit and starts the mission; returning parks there and asks what next', async () => {
  const missions = [];
  const before = getVisited().moon || 0;
  const s = new Space({ startMission(kind) { missions.push(kind); } });
  s.enter(); frame(s);
  await s.tapStop('moon');
  assert.deepEqual(missions, ['moon']);
  assert.equal(getVisited().moon, before + 1);
  assert.equal(getSession().visited.moon, 1);
  assert.equal(s.routeIndex, 4);
  assert.equal(s.road.visible, true);
  s.exit();
  const returned = new Space({}, { at: 'moon' });
  returned.enter(); frame(returned);
  assert.equal(returned.routeIndex, 4);
  assert.equal(returned.state, 'waiting');
  assert.equal(globalThis.__lines.at(-1), 'Lecimy dalej czy do domu?');
  returned.exit();
});

test('map entries check attention once; idle invitations never force a finale flight', async () => {
  const session = getSession();
  session.missionsCompleted = session.targetMissions;
  const s = new Space({});
  globalThis.__checks = 0;
  s.enter(); frame(s);
  assert.equal(globalThis.__checks, 1);
  assert.equal(s.state, 'waiting');
  assert.equal(s.suggested, 'earth');
  assert.equal(globalThis.__lines.at(-1), 'Czas wracać do domu! Polecimy na Ziemię?');
  s.nudgeAt = performance.now() - 1;
  s.activity();
  assert.ok(s.nudgeAt > performance.now() + 24000);
  const due = s.nudgeAt;
  s.resumed(10000);
  assert.equal(s.nudgeAt, due + 10000);
  for (let n = 1; n <= 2; n++) {
    s.nudgeAt = performance.now() - 1;
    frame(s);
    assert.equal(s.nudges, n);
    assert.equal(s.state, 'waiting');
  }
  assert.equal(s.nudgeAt, null);
  const lines = globalThis.__lines.length;
  for (let i = 0; i < 120; i++) s.tick(1, i);
  assert.equal(globalThis.__checks, 1);
  assert.equal(globalThis.__lines.length, lines);
  await s.tapStop('jupiter');
  assert.equal(s.visiting, 'jupiter');
  assert.equal(s.nudgeAt, null);
  assert.equal(globalThis.__checks, 1);
  await s.backToMap();
  assert.equal(globalThis.__checks, 2);
  assert.equal(s.suggested, 'earth');
  s.exit();

  session.missionsCompleted = 0;
  globalThis.__attention = 'tired';
  const tired = new Space({});
  tired.enter(); frame(tired);
  assert.equal(tired.state, 'waiting');
  assert.equal(tired.suggested, 'earth');
  tired.exit();

  globalThis.__attention = 'ok';
  session.finaleDone = true;
  const free = new Space({});
  free.enter(); frame(free);
  assert.equal(free.suggested, null);
  assert.equal(free.suggestion.visible, false);
  assert.equal(free.nudgeAt, null);
  free.exit();

  session.finaleDone = false;
  let landed = 0;
  globalThis.__attention = 'finish';
  const finish = new Space({ hub() { landed++; } });
  finish.enter();
  await new Promise(setImmediate);
  assert.equal(finish.state, 'returning');
  assert.equal(landed, 1);
  assert.equal(session.endedEarly, true);
  assert.ok(globalThis.__lines.includes('Robi się późno. Wracamy do domu!'));
  finish.exit();
});
