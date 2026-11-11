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
  assert.equal(s.rings.ice.filled, 1);
  assert.equal(s.rings.ice.gap.visible, false);
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

test('dragging the piece onto a ring works, and a drop in empty space floats back', async () => {
  const s = await scene(1, [{ kind: 'ice', size: 'small' }]);
  s.rounds = 1;
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  const piece = s.pieceObj;
  assert.equal(piece.userData.drag.onDrop(piece, new THREE.Vector3(0, 2.5, 100)), false);
  assert.equal(piece.userData.drag.onDrop(piece, new THREE.Vector3(0, 2.5, s.saturn.position.z + 3.47)), true);
  await task;
  assert.equal(s.answers[0].item, 'ice');
  assert.equal(s.answers[0].scored, true);
  stop(s);
});

test('named pieces ask for their ring; unnamed pieces ask what it is', async () => {
  const named = await scene(2, [{ kind: 'rock', size: 'same' }]);
  named.rounds = 1;
  let task = named.round(0);
  await until(() => named.phase === 'asking');
  assert.ok(globalThis.__lines.includes('To jest skała.'));
  assert.ok(globalThis.__lines.includes('Gdzie jest skalny pierścień?'));
  ring(named, 'rock').userData.onTap();
  await task;
  stop(named);

  globalThis.__lines = [];
  const plain = await scene(3, [{ kind: 'ice', size: 'same' }]);
  plain.rounds = 1;
  task = plain.round(0);
  await until(() => plain.phase === 'asking');
  assert.ok(globalThis.__lines.includes('Lód czy skała? Gdzie to pasuje?'));
  plain.runAssist('hint');
  assert.ok(globalThis.__lines.includes('To jest lód.'));
  assert.ok(globalThis.__lines.includes('Gdzie jest lodowy pierścień?'));
  ring(plain, 'ice').userData.onTap();
  await task;
  stop(plain);
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
    assert.deepEqual([...new Set(s.answers.map((a) => a.item))].sort(), ['ice', 'rock']);
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
    for (const kind of ['ice', 'rock']) {
      const tap = ring(s, kind);
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
