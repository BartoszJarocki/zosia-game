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
globalThis.__lines = [];

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x, in: (x) => x, back: (x) => x, bounce: (x) => x };
    export const animate = async (ms, fn) => { for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t); };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/world/portrait.js')) source = `export const portrait = () => ({ texture: null, dispose: () => {} });`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `
    export const badges = { get: () => ({}), add: (kind) => ({ [kind]: 1 }) };
    export const missionHud = () => {};
    export const bubble = () => {};
    export const hideBubble = () => {};
    export const nudgeBubble = () => {};
    export const setProgress = () => {};
    export const setRounds = () => {};
    export const celebrate = () => {};`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { PortMission } = await import('../src/scenes/port.js');
const { PLACES, GAMES } = await import('../src/places.js');
const { LEVELS } = await import('../src/levels/data.js');
const { parseGame } = await import('../src/levels/parse.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { CONFIG } = await import('../src/config.js');
const { SKILLS } = await import('../src/learning/events.js');
const { SYLLABLE_SKILLS, SYLLABLE_ITEMS, itemLabel } = await import('../src/parent/report.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 400; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};

async function scene(level = 3) {
  CONFIG.level = level;
  const s = new PortMission({ home() {}, startMission() {} });
  s.L = LEVELS.port[level - 1];
  s.rounds = s.L.rounds;
  s.build(); s.collect(); optimizeScene(s.scene);
  return s;
}

function cameraFor(s, width, height) {
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
  const dir = s.view.pos.clone().sub(s.view.look);
  dir.setLength(Math.max(dir.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
  camera.position.copy(s.view.look).add(dir);
  camera.lookAt(s.view.look);
  camera.updateMatrixWorld(true);
  return camera;
}

function screenBox(object, camera, width, height) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const xs = [], ys = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).project(camera);
    xs.push((p.x + 1) / 2 * width);
    ys.push((1 - p.y) / 2 * height);
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

const overlaps = (a, b) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

test('GAME.md parses the port levels exactly', () => {
  const md = readFileSync(new URL('../GAME.md', import.meta.url), 'utf8');
  const { levels, missions, errors } = parseGame(md, { childName: CONFIG.childName });
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.port, [
    { mode: 'together', syllables: [1, 2], rounds: 4 },
    { mode: 'alone', syllables: [1, 3], rounds: 4 },
    { mode: 'which', syllables: [1, 3], rounds: 4 },
  ]);
  assert.equal(missions.port.title, 'The Port');
});

test('the port is a sea game with the horn badge and syllables are on the parent page', () => {
  assert.ok(GAMES.includes('port'));
  assert.deepEqual(PLACES.port, { area: 'sea', game: true, domain: 'letters', badge: { label: '📯', color: '#7c3aed' } });
  assert.ok(SKILLS.includes('syllables'));
  assert.deepEqual(SYLLABLE_SKILLS, [['syllables', 'splits into syllables']]);
  assert.deepEqual(SYLLABLE_ITEMS, ['KOT', 'SŁOŃ', 'MEWA', 'FOKA', 'RYBKA', 'KACZKA', 'ŻYRAFA', 'MOTYLEK', 'BIEDRONKA']);
  assert.deepEqual(SYLLABLE_ITEMS.map((w) => itemLabel('syllables', w)), ['Kot', 'Słoń', 'Mewa', 'Foka', 'Rybka', 'Kaczka', 'Żyrafa', 'Motylek', 'Biedronka']);
});

test('the horn and the boat stay large, apart, on screen and clear of Chase at all three sizes', async () => {
  const s = await scene(1);
  s.pick = () => 'MEWA';
  const round = s.round(0);
  await until(() => s.phase === 'asking');
  const horn = s.tappables.find((o) => o.userData.choice === 'horn');
  const boat = s.tappables.find((o) => o.userData.choice === 'done');
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(s, width, height);
    const hb = screenBox(horn, camera, width, height);
    const bb = screenBox(boat, camera, width, height);
    const chase = screenBox(s.window, camera, width, height);
    assert.ok(hb.maxX - hb.minX >= 110, `${width}x${height}: horn ${hb.maxX - hb.minX} px`);
    assert.ok(bb.maxX - bb.minX >= 120, `${width}x${height}: boat ${bb.maxX - bb.minX} px`);
    for (const box of [hb, bb]) assert.ok(box.minX >= -0.5 && box.maxX <= width + 0.5 && box.minY >= -0.5 && box.maxY <= height + 0.5, `${width}x${height}: on screen`);
    assert.equal(overlaps(hb, bb), false, `${width}x${height}: horn and boat`);
    assert.equal(overlaps(hb, chase), false, `${width}x${height}: horn clears Chase`);
    assert.equal(overlaps(bb, chase), false, `${width}x${height}: boat clears Chase`);
  }
  for (let i = 0; i < s.target; i++) await horn.userData.onTap();
  await boat.userData.onTap();
  await round;
  s.alive = false; s.exit();
});

test('which boats and their ticks stay large, apart and clear of Chase at all three sizes', async () => {
  const s = await scene(3);
  s.pick = () => 2;
  const round = s.round(0);
  await until(() => s.phase === 'choosing');
  assert.equal(s.tappables.filter((o) => o.userData.num !== undefined).length, 3);
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(s, width, height);
    const boxes = s.tappables.filter((o) => o.userData.onTap && o.parent).map((o) => screenBox(o, camera, width, height));
    const chase = screenBox(s.window, camera, width, height);
    for (const boat of s.boats) assert.ok(screenBox(boat, camera, width, height).maxX - screenBox(boat, camera, width, height).minX >= 120, `${width}x${height}: boat`);
    for (const box of boxes) {
      assert.ok(box.minX >= -0.5 && box.maxX <= width + 0.5 && box.minY >= -0.5 && box.maxY <= height + 0.5, `${width}x${height}: on screen`);
      assert.equal(overlaps(box, chase), false, `${width}x${height}: clears Chase`);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.equal(overlaps(boxes[i], boxes[j]), false, `${width}x${height}: tappables ${i}/${j}`);
  }
  await s.tappables.find((o) => o.userData.num === 2).userData.onTap();
  await round;
  s.alive = false; s.exit();
});

test('the port has no shadows or point lights and leaves room for medium post passes', async () => {
  const s = await scene(3);
  s.pick = () => 2;
  const round = s.round(0);
  await until(() => s.phase === 'choosing');
  let shadows = 0, pointLights = 0, draws = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m?.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene draws plus 20`);
  await s.tappables.find((o) => o.userData.num === 2).userData.onTap();
  await round;
  s.alive = false; s.exit();
});
