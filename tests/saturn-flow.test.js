import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const noop = () => {};
globalThis.window = { addEventListener: noop, removeEventListener: noop };
globalThis.location = { search: '' };
globalThis.document = { createElement() {
  const canvas = { width: 0, height: 0 };
  const ctx = new Proxy({ canvas, createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 30 }) }, { get: (o, k) => k in o ? o[k] : noop });
  canvas.getContext = () => ctx;
  return canvas;
} };
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
globalThis.__lines = [];
globalThis.__animations = [];

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x, in: (x) => x };
    export const animate = async (ms, fn) => {
      globalThis.__animations.push(ms);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t);
    };
    export const wait = () => new Promise(setImmediate);
    export const hop = () => Promise.resolve();
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    export const renderer = { getRenderTarget() { return null; }, setRenderTarget() {}, render() {} };
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `
    const earned = {};
    export const badges = { get: () => earned, add: (kind) => { earned[kind] = (earned[kind] || 0) + 1; return earned; } };
    export const missionHud = (options) => { globalThis.__hud = options; globalThis.__progress = []; globalThis.__celebration = null; };
    export const bubble = (options) => { globalThis.__bubble = options; };
    export const hideBubble = () => {};
    export const nudgeBubble = () => {};
    export const setProgress = (n) => globalThis.__progress.push(n);
    export const setRounds = () => {};
    export const celebrate = (options) => { globalThis.__celebration = options; };`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { SaturnMission } = await import('../src/scenes/saturn.js');
const { camera } = await import('../src/engine.js');
const { saturnPieces } = await import('../src/levels/saturn.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { learning } = await import('../src/learning/events.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 300; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };
const ring = (s, kind) => s.tappables.find((o) => o.userData.choice === kind);
/** The camera where the engine puts it for this scene (engine.js frameCamera: wide enough for view.minWidth). */
function frame(s, cam = camera, width = 1180, height = 820) {
  cam.aspect = width / height; cam.updateProjectionMatrix();
  const direction = s.view.pos.clone().sub(s.view.look);
  direction.setLength(Math.max(direction.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * cam.aspect)));
  cam.position.copy(s.view.look).add(direction); cam.lookAt(s.view.look); cam.updateMatrixWorld(true);
  s.scene.updateMatrixWorld(true);
  return cam;
}

async function scene(level = 1, plan = null) {
  CONFIG.level = 4;
  const s = new SaturnMission({ home() {}, startMission() {} });
  s.L = LEVELS.saturn[level - 1];
  s.rounds = s.L.pieces;
  s.plan = plan || saturnPieces(s.L, () => 0.37);
  s.build(); s.collect(); optimizeScene(s.scene);
  await s.landed;
  return s;
}

test('a tap on the right ring flies the piece into its gap and scores the piece', async () => {
  const s = await scene(1, [{ kind: 'ice', size: 'same' }]);
  s.rounds = 1;
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  assert.equal(s.last, 'ice');
  assert.deepEqual(s.tappables.filter((o) => o.userData.choice).map((o) => o.userData.choice).sort(), ['ice', 'rock']);
  assert.ok(s.pieceObj.userData.drag, 'the piece can be dragged too');
  ring(s, 'ice').userData.onTap();
  await task;
  assert.equal(s.answers.length, 1);
  assert.equal(s.answers[0].skill, 'sorting');
  assert.equal(s.answers[0].item, 'ice');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, true);
  assert.equal(s.slot('ice').filled, 1);
  assert.equal(s.slot('ice').gap.visible, false);
  assert.equal(s.pieceObj, null);
  assert.ok(globalThis.__lines.includes('To jest lód.'));
  assert.ok(globalThis.__lines.includes('Lód do lodu!'));
  stop(s);
});

test('the wrong ring gets a gentle "no" and the question again, the right ring does not light, then she tries again', async () => {
  const s = await scene(1, [{ kind: 'rock', size: 'same' }]);
  s.rounds = 1;
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  const home = s.pieceObj.userData.home.clone();
  const before = globalThis.__lines.length;
  ring(s, 'ice').userData.onTap();
  await until(() => s.pieceObj.position.distanceTo(home) < 0.02);
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  assert.equal(s.phase, 'asking');
  assert.equal(s.last, 'rock');
  const said = globalThis.__lines.slice(before);
  assert.ok(/^Nie/.test(said[0]), said.join(' '));
  assert.ok(!said.some((l) => /tutaj/.test(l)), said.join(' '));
  for (let i = 0; i < 10; i++) { s.update(0.1, i * 0.1); await flush(); }
  assert.equal(s.rings.rock.mesh.material.emissiveIntensity, 0, 'the right ring does not light');
  assert.equal(s.aid.state.level, 1, 'help is at "try again"');
  assert.ok(s.learn.current.assist <= 1);
  ring(s, 'rock').userData.onTap();
  await task;
  assert.equal(s.answers[0].item, 'rock');
  assert.equal(s.answers[0].firstTry, false);
  assert.ok(globalThis.__lines.includes('Skała do skał!'));
  stop(s);
});

/** Put the piece where she would drag it (its home height) on the line from the eye to a point of Saturn, and let go. */
function dropOver(s, local) {
  const piece = s.pieceObj, target = s.saturn.localToWorld(local.clone()), dir = target.sub(camera.position);
  piece.position.copy(camera.position).addScaledVector(dir, (piece.userData.home.y + 0.35 - camera.position.y) / dir.y);
  return piece.userData.drag.onDrop(piece, piece.position.clone());
}

test('a drop counts on the ring drawn under the piece as she sees it; over the planet or empty sky it floats back', async () => {
  const s = await scene(1, [{ kind: 'rock', size: 'same' }]);
  s.rounds = 1;
  frame(s);
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  assert.equal(dropOver(s, new THREE.Vector3(0, 1.6, 0.8)), false, 'over the planet');
  assert.equal(dropOver(s, new THREE.Vector3(8, 0, 0)), false, 'in empty sky');
  assert.equal(s.learn.current.wrong, 0, 'neither is an answer');
  assert.equal(dropOver(s, new THREE.Vector3(0, 0, 3.47)), true, 'the front of the ice ring');
  assert.equal(s.learn.current.wrong, 1);
  await until(() => s.pieceObj.position.distanceTo(s.pieceObj.userData.home) < 0.02);
  assert.equal(dropOver(s, new THREE.Vector3(0, 0, 4.93)), true, 'the front of the rock ring, where the ring is drawn');
  await task;
  assert.equal(s.answers[0].item, 'rock');
  assert.equal(s.answers[0].firstTry, false);
  stop(s);
});

test('a tap on the planet is never an answer, also over the back of a ring', async () => {
  const s = await scene(2, [{ kind: 'ice', size: 'big' }]);
  s.rounds = 1;
  const cam = frame(s);
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  const ray = new THREE.Raycaster();
  for (const local of [new THREE.Vector3(0, 0.4, 0.5), new THREE.Vector3(-1.2, 0.9, 1.2), new THREE.Vector3(0, 0, -3.47)]) {
    const p = s.saturn.localToWorld(local).project(cam);
    ray.setFromCamera(new THREE.Vector2(p.x, p.y), cam);
    const hit = ray.intersectObjects(s.tappables, false)[0];
    assert.equal(hit?.object, s.planet, `the planet takes the tap at ${local.toArray()}`);
  }
  s.planet.userData.onTap(s.planet);
  assert.equal(s.learn.current.wrong, 0);
  assert.equal(s.answers.length, 0);
  ring(s, 'ice').userData.onTap();
  await task;
  stop(s);
});

test('named pieces ask for their ring; unnamed pieces ask what it is; the bubble shows the kind only when it is named', async () => {
  const named = await scene(1, [{ kind: 'rock', size: 'same' }]);
  named.rounds = 1;
  let task = named.round(0);
  await until(() => named.phase === 'asking');
  assert.ok(globalThis.__lines.includes('To jest skała.'));
  assert.ok(globalThis.__lines.includes('Gdzie jest skalny pierścień?'));
  assert.equal(globalThis.__bubble.big, '🪨');
  ring(named, 'rock').userData.onTap();
  await task;
  stop(named);

  globalThis.__lines = [];
  const plain = await scene(2, [{ kind: 'ice', size: 'small' }]);
  plain.rounds = 1;
  task = plain.round(0);
  await until(() => plain.phase === 'asking');
  assert.ok(globalThis.__lines.includes('Lód czy skała? Gdzie to pasuje?'));
  assert.equal(globalThis.__bubble.big, '?', 'the question is hers');
  plain.runAssist('hint');
  assert.ok(globalThis.__lines.includes('To jest lód.'));
  assert.ok(globalThis.__lines.includes('Gdzie jest lodowy pierścień?'));
  ring(plain, 'ice').userData.onTap();
  await task;
  stop(plain);
});

test('sorting by both: a big ice piece goes in the ice ring\'s big hole; the kind alone or the size alone is wrong', async () => {
  globalThis.__lines = [];
  const s = await scene(3, [{ kind: 'ice', size: 'big' }, { kind: 'rock', size: 'small' }]);
  s.rounds = 2;
  frame(s);
  let task = s.round(0);
  await until(() => s.phase === 'asking');
  assert.deepEqual(s.tappables.filter((o) => o.userData.choice).map((o) => o.userData.choice).sort(), ['ice:big', 'ice:small', 'rock:big', 'rock:small']);
  assert.equal(s.last, 'ice:big');
  assert.ok(globalThis.__lines.includes('Lód czy skała? Duży czy mały?'));
  assert.equal(globalThis.__bubble.big, '?');
  ring(s, 'ice:small').userData.onTap();
  await until(() => s.pieceObj.position.distanceTo(s.pieceObj.userData.home) < 0.02);
  ring(s, 'rock:big').userData.onTap();
  await until(() => s.pieceObj.position.distanceTo(s.pieceObj.userData.home) < 0.02);
  assert.equal(s.learn.current.wrong, 2);
  assert.equal(s.aid.state.level, 2);
  assert.equal(globalThis.__lines.at(-1), 'To duży kawałek lodu.', 'the middle step names the piece, not the hole');
  assert.equal(s.slot('ice:big').gap.userData.hinting, undefined, 'nothing glows yet');
  assert.equal(dropOver(s, new THREE.Vector3(-3.47, 0, 0)), true, 'the left half of the ice ring holds its big hole');
  await task;
  assert.equal(s.answers[0].item, 'ice:big');
  assert.equal(s.slot('ice:big').filled, 1);
  task = s.round(1);
  await until(() => s.phase === 'asking');
  assert.equal(s.last, 'rock:small');
  for (let i = 0; i < 3; i++) { ring(s, 'rock:big').userData.onTap(); await until(() => s.pieceObj.position.distanceTo(s.pieceObj.userData.home) < 0.02); }
  for (let i = 0; i < 5; i++) { s.update(0.05, 1 + i * 0.05); await flush(); }
  assert.ok(s.slot('rock:small').gap.userData.hinting, 'the third miss makes the right hole glow');
  assert.notEqual(s.slot('rock:small').gap.material.color.getHexString(), '7a58c4');
  ring(s, 'rock:small').userData.onTap();
  await task;
  for (let i = 0; i < 2; i++) { s.update(0.05, 2 + i * 0.05); await flush(); }
  assert.equal(s.slot('rock:small').gap.material.color.getHexString(), '7a58c4', 'the glow stops once she fills it');
  stop(s);
});

test('a run cut short still closes every hole before "naprawione!"', async () => {
  const s = await scene(4);
  await s.outro();
  assert.ok(s.slots.every((x) => !x.gap.visible));
  stop(s);
});

test('every Saturn level runs through base progress and celebration, and counts for the session', async () => {
  for (let level = 1; level <= 4; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new SaturnMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    s.L = LEVELS.saturn[level - 1];
    s.rounds = s.L.pieces;
    s.plan = saturnPieces(s.L, () => 0.37);
    const events = [];
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 600 && !globalThis.__celebration; step++) {
      if (s.phase === 'asking') await ring(s, s.last).userData.onTap();
      s.update(0.05, step * 0.05);
      await flush();
    }
    const pieces = LEVELS.saturn[level - 1].pieces;
    assert.ok(globalThis.__celebration, `level ${level} celebrated: ${s.phase}, round ${s.roundIndex}, ${s.answers.length} answers`);
    assert.deepEqual(globalThis.__progress, Array.from({ length: pieces }, (_, i) => i + 1));
    assert.equal(globalThis.__celebration.kind, 'saturn');
    assert.equal(events.filter((e) => e.correct).length, pieces);
    assert.equal(scoreRun(s.answers).scored, pieces);
    assert.ok(s.answers.every((a) => a.scored && a.skill === 'sorting'));
    assert.deepEqual([...new Set(s.answers.map((a) => a.item.split(':')[0]))].sort(), ['ice', 'rock']);
    if (s.L.sort === 'both') assert.deepEqual([...new Set(s.answers.map((a) => a.item.split(':')[1]))].sort(), ['big', 'small']);
    assert.equal(getSession().missionsCompleted, 1);
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['saturn']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});

test('Saturn has no shadows or point lights and its ring taps are big enough on both iPads', async () => {
  const s = await scene(4);
  let shadows = 0, pointLights = 0, draws = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene calls plus 20 reserved for medium postprocessing`);
  for (const [width, height] of [[1180, 820], [1366, 1024]]) {
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    const direction = s.view.pos.clone().sub(s.view.look);
    direction.setLength(Math.max(direction.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
    camera.position.copy(s.view.look).add(direction); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
    for (const { key: kind, tap } of s.slots) {
      tap.updateWorldMatrix(true, true);
      const points = [];
      const position = tap.geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(tap.matrixWorld).project(camera));
      const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
      assert.ok((Math.max(...xs) - Math.min(...xs)) * width / 2 >= 70, `${width}x${height} ${kind} width`);
      assert.ok((Math.max(...ys) - Math.min(...ys)) * height / 2 >= 70, `${width}x${height} ${kind} height`);
    }
  }
  stop(s);
});
