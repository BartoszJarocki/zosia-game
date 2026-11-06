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
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x };
    export const animate = async (ms, fn) => {
      globalThis.__animations.push(ms);
      if (ms === 1400 && globalThis.__holdJump) await new Promise((resolve) => { globalThis.__land = resolve; });
      for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t);
    };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => { throw new Error('Moon must not use decorative hops'); };
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
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

const { MoonMission } = await import('../src/scenes/moon.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { learning } = await import('../src/learning/events.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };

async function scene(n = 3) {
  CONFIG.level = 4;
  const s = new MoonMission({});
  s.pick = () => n;
  s.build(); s.collect(); optimizeScene(s.scene);
  await s.landed;
  return s;
}

test('one tap makes one 1400 ms jump; taps and flag checks in the air are ignored', async () => {
  const s = await scene();
  const round = s.jumpRound(false);
  globalThis.__holdJump = true;
  const first = s.chase.userData.onTap();
  assert.equal(s.airborne, true);
  await s.chase.userData.onTap();
  await s.flag.userData.onTap();
  assert.equal(s.prints.length, 0);
  assert.equal(s.learn.current.wrong, 0);
  globalThis.__holdJump = false;
  globalThis.__land();
  await first;
  assert.equal(s.prints.length, 1);
  assert.equal(s.chase.position.y, 0);
  assert.equal(globalThis.__lines.at(-1), 'Jeden!');
  await flush();
  assert.equal(s.prints.length, 1);
  await s.chase.userData.onTap();
  await s.chase.userData.onTap();
  assert.equal(s.prints.length, 3);
  assert.deepEqual(s.prints.map((p) => Number(p.position.x.toFixed(2))), [-3.85, -2.8, -1.75]);
  assert.equal(s.phase, 'jump');
  await s.flag.userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'counting');
  assert.equal(s.answers[0].item, '3');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, true);
  assert.equal(globalThis.__animations.filter((ms) => ms === 1400).length, 3);
  stop(s);
});

test('too few continues; too many fades extras and waits for her second flag tap', async () => {
  const s = await scene();
  const round = s.jumpRound(false);
  await s.flag.userData.onTap();
  assert.equal(globalThis.__lines.at(-1), 'Za mało! Skacz dalej!');
  assert.equal(s.answers.length, 0);
  for (let i = 0; i < 5; i++) await s.chase.userData.onTap();
  const extras = s.prints.slice(3);
  await s.flag.userData.onTap();
  assert.equal(globalThis.__lines.at(-1), 'Za dużo! Teraz dobrze? Dotknij flagi!');
  assert.equal(s.prints.length, 3);
  assert.deepEqual(extras.map((p) => p.material.opacity), [0, 0]);
  assert.deepEqual(extras.map((p) => p.parent), [null, null]);
  assert.equal(s.answers.length, 0);
  assert.equal(s.phase, 'jump');
  await s.flag.userData.onTap();
  await round;
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.answers[0].scored, true);
  stop(s);
});

test('automatic jumps finish at N landings and do not score', async () => {
  const s = await scene(2);
  const round = s.jumpRound(true);
  assert.equal(s.flag.visible, false);
  await s.chase.userData.onTap();
  assert.equal(s.answers.length, 0);
  await s.chase.userData.onTap();
  await s.chase.userData.onTap();
  await round;
  assert.equal(s.prints.length, 2);
  assert.equal(s.answers[0].scored, false);
  assert.deepEqual(scoreRun(s.answers), { scored: 0, clean: 0 });
  stop(s);
});

test('howMany watches silently, touch-counts once per pair and scores the numeral choice', async () => {
  const s = await scene();
  globalThis.__lines = [];
  const round = s.howManyRound();
  await until(() => s.phase === 'choosing');
  assert.deepEqual(globalThis.__lines, ['Patrz, jak skacze!', 'Ile było skoków?']);
  assert.equal(s.prints.length, 3);
  assert.equal(s.ghosts.length, 0);
  assert.deepEqual(s.blocks.map((b) => b.userData.num).sort(), [2, 3, 4]);
  s.prints[1].userData.onTap(); s.prints[1].userData.onTap(); s.prints[0].userData.onTap();
  assert.deepEqual(globalThis.__lines.slice(-2), ['Jeden!', 'Dwa!']);
  s.blocks.find((b) => b.userData.num === 2).userData.onTap();
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  s.runAssist('hint');
  assert.equal(s.ghosts.length, 3);
  assert.ok(s.ghosts.every((p) => p.visible));
  s.blocks.find((b) => b.userData.num === 3).userData.onTap();
  await round;
  assert.deepEqual(globalThis.__lines.slice(-3), ['Jeden!', 'Dwa!', 'Trzy!']);
  assert.equal(s.answers[0].skill, 'quantity');
  assert.equal(s.answers[0].item, '3');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].options, 3);
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.prints.filter((p) => p.userData.onTap).length, 0);
  stop(s);
});

test('every Moon level runs through base progress and celebration, and counts for the session', async () => {
  for (let level = 1; level <= 4; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new MoonMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    const events = [];
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 250 && !globalThis.__celebration; step++) {
      if (s.phase === 'jump' && !s.airborne) {
        if (s.prints.length < s.last) await s.chase.userData.onTap();
        else if (s.flag.visible) await s.flag.userData.onTap();
      } else if (s.phase === 'choosing') s.blocks.find((b) => b.userData.num === s.last).userData.onTap();
      s.update(0.05, step * 0.05);
      await flush();
    }
    assert.ok(globalThis.__celebration, `level ${level} celebrated: ${s.phase}, round ${s.roundIndex}, ${s.prints.length}/${s.last}, ${s.answers.length} answers`);
    assert.deepEqual(globalThis.__progress, level < 3 ? [1, 2, 3] : [1, 2, 3, 4]);
    assert.equal(globalThis.__celebration.kind, 'moon');
    assert.deepEqual(s.task, { type: 'jump', auto: true });
    assert.equal(events.filter((e) => e.correct).length, LEVELS.moon[level - 1].rounds);
    assert.equal(scoreRun(s.answers).scored, [1, 1, 3, 3][level - 1]);
    assert.equal(getSession().missionsCompleted, 1);
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['moon']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});

test('Moon scene has no shadows or point lights; Chase is at least 70 px at both iPad sizes', async () => {
  const s = await scene(9);
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    const dir = s.view.pos.clone().sub(s.view.look);
    dir.setLength(Math.max(dir.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
    camera.position.copy(s.view.look).add(dir); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
    for (const x of [-4.9, 5.6]) {
      s.chase.position.x = x;
      s.chase.updateWorldMatrix(true, true);
      const points = [];
      s.chase.traverseVisible((o) => {
        if (!o.geometry || o.material?.visible === false) return;
        const p = o.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(camera));
      });
      const xs = points.map((p) => p.x);
      assert.ok((Math.max(...xs) - Math.min(...xs)) * width / 2 >= 70, `${width}x${height}`);
      assert.ok(points.every((p) => Math.abs(p.x) < 0.94 && Math.abs(p.y) < 0.94), 'Chase stays on screen');
    }
  }
  s.showSlots(9);
  for (let i = 0; i < 10; i++) s.prints.push(s.makePrint(i));
  s.flag.visible = true;
  s.success(s.chase.position.clone());
  let shadows = 0, pointLights = 0, draws = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene calls plus 20 reserved for medium postprocessing`);
  stop(s);
});
