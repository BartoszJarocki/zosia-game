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
    export const bubble = (options) => { globalThis.__bubble = options; };
    export const hideBubble = () => {};
    export const nudgeBubble = () => {};
    export const setProgress = () => {};
    export const setRounds = () => {};
    export const celebrate = () => {};`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { ReefMission } = await import('../src/scenes/reef.js');
const { PLACES, GAMES } = await import('../src/places.js');
const { LEVELS } = await import('../src/levels/data.js');
const { REEF_PLACES } = await import('../src/levels/reef.js');
const { parseGame } = await import('../src/levels/parse.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { CONFIG } = await import('../src/config.js');
const { SKILLS } = await import('../src/learning/events.js');
const { POSITION_SKILLS, POSITION_ITEMS, itemLabel } = await import('../src/parent/report.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 400; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};

async function scene(level = 3) {
  CONFIG.level = level;
  const s = new ReefMission({ home() {}, startMission() {} });
  s.L = LEVELS.reef[level - 1];
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

/** The bubble body in style.css: left-anchored, below the home button, sized by its big glyph and picture. */
function bubbleBox(w, h) {
  const btn = Math.min(0.11 * w, 0.11 * h, 96);
  const left = 16 + btn + 24, top = 14 + btn + 0.016 * h;
  const big = Math.min(0.15 * w, 0.14 * h, 150), pic = Math.min(0.12 * w, 0.11 * h, 108);
  const wide = big + Math.min(0.03 * w, 26) + pic + 2 * Math.min(0.036 * w, 32) + 10, tall = Math.max(big, pic) + 2 * 0.011 * h + 10;
  return { minX: left, maxX: left + wide, minY: top, maxY: top + tall };
}

test('every place she can tap in the one scene stays clear of the bubble at all three sizes', async () => {
  const s = await scene(4);
  for (const target of REEF_PLACES) {
    const round = s.placeRound({ word: target.word, animal: 'octopus', place: target });
    await until(() => s.phase === 'asking');
    for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
      const camera = cameraFor(s, width, height);
      for (const spot of s.spots) assert.equal(overlaps(screenBox(spot, camera, width, height), bubbleBox(width, height)), false, `${width}x${height}: ${spot.userData.choice} under the bubble`);
      assert.equal(overlaps(screenBox(s.animalObj, camera, width, height), bubbleBox(width, height)), false, `${width}x${height}: the waiting animal under the bubble`);
    }
    await s.spots.find((o) => o.userData.choice === s.last).userData.onTap();
    await round;
    s.clearRound();
  }
  s.alive = false; s.exit();
});

test('GAME.md parses the reef levels exactly', () => {
  const md = readFileSync(new URL('../GAME.md', import.meta.url), 'utf8');
  const { levels, missions, errors } = parseGame(md, { childName: CONFIG.childName });
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.reef, [
    { mode: 'see', words: ['na', 'pod'], choices: 2, rounds: 4 },
    { mode: 'hear', words: ['na', 'pod', 'w'], choices: 3, rounds: 4 },
    { mode: 'hear', words: ['na', 'pod', 'w', 'obok'], choices: 3, rounds: 4 },
    { mode: 'place', words: ['na', 'pod', 'w', 'obok'], choices: 3, rounds: 3 },
  ]);
  assert.equal(missions.reef.title, 'The Reef');
});

test('the reef is a sea game with the crab badge and the position skill is on the parent page', () => {
  assert.ok(GAMES.includes('reef'));
  assert.deepEqual(PLACES.reef, { area: 'sea', game: true, domain: 'letters', badge: { label: '🦀', color: '#14b8a6' } });
  assert.ok(SKILLS.includes('position'));
  assert.deepEqual(POSITION_SKILLS, [['position', 'where it is']]);
  assert.deepEqual(POSITION_ITEMS, ['na', 'pod', 'w', 'obok']);
  assert.deepEqual(POSITION_ITEMS.map((w) => itemLabel('position', w)), ['na', 'pod', 'w', 'obok']);
});

test('choices and spots stay large, apart, on screen and clear of Chase at all three sizes', async () => {
  const s = await scene(3);
  const round = s.round(0);
  await until(() => s.phase === 'asking');
  const choices = s.tappables.filter((o) => o.userData.choice);
  assert.equal(choices.length, 3);
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(s, width, height);
    const boxes = choices.map((choice) => screenBox(choice.userData.hit, camera, width, height));
    const chase = screenBox(s.window, camera, width, height);
    for (const box of boxes) {
      assert.ok(box.maxX - box.minX >= 120, `${width}x${height}: ${box.maxX - box.minX} px wide`);
      assert.ok(box.minX >= -0.5 && box.maxX <= width + 0.5 && box.minY >= -0.5 && box.maxY <= height + 0.5, `${width}x${height}: on screen`);
      assert.equal(overlaps(box, chase), false, `${width}x${height}: clears Chase`);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.equal(overlaps(boxes[i], boxes[j]), false, `${width}x${height}: choices ${i}/${j}`);
  }
  await s.tappables.find((o) => o.userData.choice === s.last).userData.onTap();
  await round;
  s.alive = false; s.exit();
});

test('place spots are large, apart and clear of Chase at all three sizes', async () => {
  const s = await scene(4);
  for (const target of REEF_PLACES) {
    const round = s.placeRound({ word: target.word, animal: 'crab', place: target });
    await until(() => s.phase === 'asking');
    for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
      const camera = cameraFor(s, width, height);
      const boxes = s.spots.map((spot) => screenBox(spot, camera, width, height));
      const chase = screenBox(s.window, camera, width, height);
      for (const box of boxes) {
        assert.ok(box.maxX - box.minX >= 120, `${width}x${height}: spot ${box.maxX - box.minX} px wide`);
        assert.equal(overlaps(box, chase), false, `${width}x${height}: spot clears Chase`);
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.equal(overlaps(boxes[i], boxes[j]), false, `${width}x${height}: spots ${i}/${j} for ${target.word}:${target.on}`);
    }
    await s.spots.find((o) => o.userData.choice === s.last).userData.onTap();
    await round;
    s.clearRound();
  }
  s.alive = false; s.exit();
});

test('Chase window is fully on screen, below the HUD and clear of the bubble at all three sizes', async () => {
  const s = await scene(3);
  const round = s.round(0);
  await until(() => s.phase === 'asking');
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(s, width, height);
    const box = screenBox(s.window, camera, width, height);
    assert.ok(box.minX >= 0 && box.maxX <= width && box.minY >= 0 && box.maxY <= height, `${width}x${height}: Chase window on screen`);
    assert.ok(box.minX > width * 0.45, `${width}x${height}: Chase window clear of the left bubble`);
    assert.ok(box.minY > height * 0.1, `${width}x${height}: Chase window below the HUD`);
  }
  await s.tappables.find((o) => o.userData.choice === s.last).userData.onTap();
  await round;
  s.alive = false; s.exit();
});

test('every choice animal is at least 90 px across at 1180x820', async () => {
  const s = await scene(3);
  const camera = cameraFor(s, 1180, 820);
  for (const kind of ['crab', 'starfish', 'fish', 'octopus']) {
    const group = s.makeChoice({ word: 'na', on: 'rock' }, kind);
    s.scene.add(group);
    group.updateMatrixWorld(true);
    const box = screenBox(group.userData.animal, camera, 1180, 820);
    assert.ok(Math.max(box.maxX - box.minX, box.maxY - box.minY) >= 90, `${kind}: ${(box.maxX - box.minX).toFixed(0)}x${(box.maxY - box.minY).toFixed(0)} px`);
    group.removeFromParent();
  }
  s.alive = false; s.exit();
});

test('the place bubble draws the animal instead of using a starfish emoji', async () => {
  const s = await scene(4);
  const round = s.placeRound({ word: 'pod', animal: 'starfish', place: { word: 'pod', on: 'rock' } });
  await until(() => s.phase === 'asking');
  assert.match(globalThis.__bubble.pic, /<svg/);
  assert.match(globalThis.__bubble.pic, /#fb7185/);
  await s.spots.find((o) => o.userData.choice === s.last).userData.onTap();
  await round;
  s.alive = false; s.exit();
});

test('the reef has no shadows or point lights and leaves room for medium post passes', async () => {
  const s = await scene(3);
  const round = s.round(0);
  await until(() => s.phase === 'asking');
  let shadows = 0, pointLights = 0, draws = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m?.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene draws plus 20`);
  await s.tappables.find((o) => o.userData.choice === s.last).userData.onTap();
  await round;
  s.alive = false; s.exit();
});
