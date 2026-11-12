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

/** The speech bubble's screen area (style.css: top left, below the home button, with its tail). */
function bubbleBox(width, height) {
  const btn = Math.min(width * 0.11, height * 0.11, 96);
  const big = Math.min(width * 0.15, height * 0.14, 150);
  const left = 16 + btn + 24;
  const top = 14 + btn + height * 0.016;
  return { minX: left, maxX: left + 370, minY: top, maxY: top + big + height * 0.022 + 28 };
}

const showed = (hit) => {
  for (let o = hit.object; o; o = o.parent) if (o.visible === false) return false;
  return hit.object.material?.visible !== false;
};


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

/** A tick sits on its boat: the nearer one takes the tap (the next test checks the tick is first under the finger). */
const nested = (a, b) => { const inside = (x, y) => { for (let o = x.parent; o; o = o.parent) if (o === y) return true; return false; }; return inside(a, b) || inside(b, a); };

test('which boats and their ticks stay large, apart and clear of Chase at all three sizes', async () => {
  const s = await scene(3);
  s.pick = () => 2;
  const round = s.round(0);
  await until(() => s.phase === 'choosing');
  assert.equal(s.tappables.filter((o) => o.userData.num !== undefined).length, 3);
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(s, width, height);
    const live = s.tappables.filter((o) => o.userData.onTap && o.parent);
    const boxes = live.map((o) => screenBox(o, camera, width, height));
    const chase = screenBox(s.window, camera, width, height);
    for (const boat of s.boats) assert.ok(screenBox(boat, camera, width, height).maxX - screenBox(boat, camera, width, height).minX >= 120, `${width}x${height}: boat`);
    for (const box of boxes) {
      assert.ok(box.minX >= -0.5 && box.maxX <= width + 0.5 && box.minY >= -0.5 && box.maxY <= height + 0.5, `${width}x${height}: on screen`);
      assert.equal(overlaps(box, chase), false, `${width}x${height}: clears Chase`);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      if (!nested(live[i], live[j])) assert.equal(overlaps(boxes[i], boxes[j]), false, `${width}x${height}: tappables ${i}/${j}`);
    }
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

test('every board is one width and shows the animal until the clap: no syllable blocks in alone and which', async () => {
  const alone = await scene(2);
  alone.pick = () => 'MEWA';
  let splitAtSing = null;
  const sing = alone.tootBack.bind(alone);
  alone.tootBack = async (word, boat) => { await sing(word, boat); splitAtSing = boat.userData.board.userData.split; };
  const aloneRound = alone.round(0);
  await until(() => alone.phase === 'asking');
  const board = alone.boats[0].userData.board;
  assert.equal(board.userData.split, false);
  assert.equal(board.userData.whole.visible, true);
  assert.ok(board.userData.blocks.every((b) => b.visible === false));
  assert.equal(board.userData.dots.visible, true);
  assert.equal(board.userData.dots.children.length, 0);
  const horn = alone.tappables.find((o) => o.userData.choice === 'horn');
  await horn.userData.onTap();
  assert.equal(board.userData.dots.children.length, 1);
  assert.equal(board.userData.dots.children[0].material, alone.dotOn);
  assert.ok(board.userData.blocks.every((b) => b.visible === false));
  await horn.userData.onTap();
  await alone.tappables.find((o) => o.userData.choice === 'done').userData.onTap();
  await aloneRound;
  assert.equal(splitAtSing, true);
  alone.alive = false; alone.exit();

  const together = await scene(1);
  together.pick = () => 'MEWA';
  const togetherRound = together.round(0);
  await until(() => together.phase === 'asking' && together.boats[0].userData.board.userData.split); // (Chase's clap)
  assert.ok(together.boats[0].userData.board.userData.blocks.every((b) => b.visible));
  for (let i = 0; i < together.target; i++) await together.tappables.find((o) => o.userData.choice === 'horn').userData.onTap();
  await together.tappables.find((o) => o.userData.choice === 'done').userData.onTap();
  await togetherRound;
  together.alive = false; together.exit();

  const which = await scene(3);
  which.pick = () => 2;
  let whichSplit = null;
  const whichSing = which.tootBack.bind(which);
  which.tootBack = async (word, boat) => { await whichSing(word, boat); whichSplit = boat.userData.board.userData.split; };
  const whichRound = which.round(0);
  await until(() => which.phase === 'choosing');
  const widths = new Set([...which.boats, ...which.moored].map((b) => new THREE.Box3().setFromObject(b.userData.board).getSize(new THREE.Vector3()).x / b.scale.x).map((w) => w.toFixed(3)));
  assert.equal(widths.size, 1, `board widths ${[...widths]}: a board's width never tells how many pieces`);
  for (const boat of which.boats) {
    assert.equal(boat.userData.board.userData.split, false);
    assert.equal(boat.userData.board.userData.whole.visible, true);
  }
  await which.tappables.find((o) => o.userData.num === 1).userData.onTap();
  for (const boat of which.boats) assert.equal(boat.userData.board.userData.split, false);
  await which.tappables.find((o) => o.userData.num === 2).userData.onTap();
  await whichRound;
  assert.equal(whichSplit, true);
  which.alive = false; which.exit();
});

test('the alone tally starts empty and grows one lit dot per toot', async () => {
  const s = await scene(2);
  s.pick = () => 'MEWA';
  const round = s.round(0);
  await until(() => s.phase === 'asking');
  const board = s.boats[0].userData.board;
  const horn = s.tappables.find((o) => o.userData.choice === 'horn');
  assert.equal(board.userData.dots.children.length, 0);
  await horn.userData.onTap();
  assert.equal(board.userData.dots.children.length, 1);
  assert.equal(board.userData.dots.children[0].material, s.dotOn);
  await horn.userData.onTap();
  await horn.userData.onTap();
  assert.equal(s.target, 2);
  assert.equal(board.userData.dots.children.length, 3);
  await s.tappables.find((o) => o.userData.choice === 'done').userData.onTap();
  await until(() => s.phase === 'asking' && s.count === 0);
  assert.equal(board.userData.dots.children.length, 0);
  for (let i = 0; i < s.target; i++) await horn.userData.onTap();
  await s.tappables.find((o) => o.userData.choice === 'done').userData.onTap();
  await round;
  s.alive = false; s.exit();
});

test('no tappable overlaps another, the bubble, Chase or the HUD at all three sizes', async () => {
  for (const level of [1, 3]) {
    const s = await scene(level);
    s.pick = () => (level === 3 ? 2 : 'MEWA');
    const round = s.round(0);
    await until(() => s.phase === (level === 3 ? 'choosing' : 'asking'));
    if (level === 3) assert.equal(s.horn.visible, false);
    for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
      const camera = cameraFor(s, width, height);
      const bubble = bubbleBox(width, height);
      const chase = screenBox(s.window, camera, width, height);
      const btn = Math.min(width * 0.11, height * 0.11, 96);
      assert.ok(chase.minY > 14 + btn, `${width}x${height}: window below the HUD`);
      assert.equal(overlaps(chase, bubble), false, `${width}x${height}: window and bubble`);
      const live = s.tappables.filter((o) => o.userData.onTap && o.parent);
      const boxes = live.map((o) => screenBox(o, camera, width, height));
      boxes.forEach((box) => {
        assert.ok(box.minX >= -0.5 && box.maxX <= width + 0.5 && box.minY >= -0.5 && box.maxY <= height + 0.5, `${width}x${height}: on screen`);
        assert.equal(overlaps(box, bubble), false, `${width}x${height}: under the bubble`);
        assert.equal(overlaps(box, chase), false, `${width}x${height}: under Chase`);
      });
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        if (!nested(live[i], live[j])) assert.equal(overlaps(boxes[i], boxes[j]), false, `${width}x${height}: tappables ${i}/${j}`);
      }
    }
    if (level === 3) await s.tappables.find((o) => o.userData.num === 2).userData.onTap();
    else {
      for (let i = 0; i < s.target; i++) await s.tappables.find((o) => o.userData.choice === 'horn').userData.onTap();
      await s.tappables.find((o) => o.userData.choice === 'done').userData.onTap();
    }
    await round;
    s.alive = false; s.exit();
  }
});

test('every tick is on screen, above the quay and first under the camera ray', async () => {
  const s = await scene(3);
  s.pick = () => 2;
  const round = s.round(0);
  await until(() => s.phase === 'choosing');
  const ticks = s.tappables.filter((o) => o.userData.num !== undefined && o.userData.onTap);
  assert.equal(ticks.length, 3);
  s.scene.updateMatrixWorld(true);
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = cameraFor(s, width, height);
    for (const tick of ticks) {
      const box = screenBox(tick, camera, width, height);
      assert.ok(box.minX >= 0 && box.maxX <= width && box.minY >= 0 && box.maxY <= height, `${width}x${height}: tick on screen`);
      if (width !== 820) assert.ok(box.maxX - box.minX >= 70 && box.maxY - box.minY >= 70, `${width}x${height}: tick ${box.maxX - box.minX}`);
      const at = tick.getWorldPosition(new THREE.Vector3());
      const ray = new THREE.Raycaster(camera.position.clone(), at.clone().sub(camera.position).normalize());
      const hit = ray.intersectObjects(s.scene.children, true).filter(showed)[0];
      assert.ok(hit, `${width}x${height}: tick ${tick.userData.num} is in the way`);
      let o = hit.object;
      while (o && o !== tick) o = o.parent;
      assert.equal(o, tick, `${width}x${height}: tick ${tick.userData.num} is covered by ${hit.object.geometry?.type}`);
    }
  }
  await ticks.find((o) => o.userData.num === 2).userData.onTap();
  await round;
  s.alive = false; s.exit();
});
