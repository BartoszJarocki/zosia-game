import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

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
    export const renderer = { getRenderTarget() {}, setRenderTarget() {}, render() {} };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x };
    export const animate = async (ms, fn) => {
      globalThis.__animations.push(ms);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t);
    };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push(...[s].flat()); };
    export const hush = () => {}; export const unlockAudio = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `
    export const spaceHud = () => {}; export const launchHud = () => {};
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

const { JupiterMission } = await import('../src/scenes/jupiter.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { learning } = await import('../src/learning/events.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const flush = () => new Promise(setImmediate);
const stop = (s) => { s.alive = false; s.exit(); };
const seed = (n) => () => {
  n = (n + 0x6d2b79f5) | 0;
  let t = Math.imul(n ^ (n >>> 15), 1 | n);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

async function scene(level = 1, random = () => 0) {
  CONFIG.level = level;
  const s = new JupiterMission({});
  s.random = random;
  s.build(); s.collect(); optimizeScene(s.scene);
  await s.landed;
  return s;
}

test('a wrong pot wiggles back, the right one glows, then the row is said aloud', async () => {
  const s = await scene();
  const round = s.stripesRound();
  assert.equal(s.last, 'orange');
  const pots = s.tappables.filter((o) => o.userData.choice);
  assert.deepEqual(pots.map((o) => o.userData.choice).sort(), ['orange', 'red', 'white']);
  await pots.find((o) => o.userData.choice === 'red').userData.onTap();
  assert.equal(s.learn.current.wrong, 1);
  assert.equal(s.answers.length, 0);
  assert.ok(globalThis.__lines.includes('Ojej! Spróbuj jeszcze raz.'));
  await pots.find((o) => o.userData.choice === 'orange').userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'pattern');
  assert.equal(s.answers[0].item, 'AB');
  assert.equal(s.answers[0].options, 3);
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(globalThis.__lines.at(-1), 'Biały, pomarańczowy, biały, pomarańczowy, biały, pomarańczowy!');
  const blank = s.roundObjects.find((o) => o.userData.blank);
  assert.equal(blank.userData.inner.material.color.getHexString(), 'ef8b31');
  stop(s);
});

test('gap asks which stripe is missing and scores the pattern name', async () => {
  const s = await scene(3);
  s.L = { ...s.L, pattern: 'gap' };
  const round = s.stripesRound();
  assert.equal(s.last, 'white');
  assert.ok(globalThis.__lines.includes('Którego paska brakuje?'));
  await s.tappables.find((o) => o.userData.choice === 'white').userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'pattern');
  assert.equal(s.answers[0].item, 'gap');
  assert.equal(s.answers[0].scored, true);
  stop(s);
});

test('bigger: a wrong ball gets a promise to look again and the huge one is named', async () => {
  const s = await scene(1, () => 0.9);
  s.L = { ...s.L, bigger: 'big' };
  const round = s.sizeRound();
  assert.equal(s.last, 'sun');
  const earth = s.tappables.find((o) => o.userData.choice === 'earth');
  const sun = s.tappables.find((o) => o.userData.choice === 'sun');
  await earth.userData.onTap();
  assert.ok(globalThis.__lines.includes('Popatrz jeszcze raz. Ta jest większa.'));
  assert.equal(s.answers.length, 0);
  await sun.userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'comparison');
  assert.equal(s.answers[0].item, 'bigger');
  assert.equal(s.answers[0].options, 2);
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(globalThis.__lines.at(-1), 'Słońce jest dużo większe od Ziemi!');
  stop(s);
});

test('both can ask for the smaller one, and Earth is the right answer', async () => {
  const s = await scene(3);
  const answers = [0.9, 0, 0.9];
  s.random = () => answers.shift() ?? 0.9;
  s.L = { ...s.L, bigger: 'both' };
  const round = s.sizeRound();
  assert.equal(s.last, 'earth');
  assert.ok(globalThis.__lines.includes('Która jest mniejsza?'));
  await s.tappables.find((o) => o.userData.choice === 'earth').userData.onTap();
  await round;
  assert.equal(s.answers[0].item, 'smaller');
  assert.equal(globalThis.__lines.at(-1), 'Ziemia jest dużo mniejsza!');
  stop(s);
});

test('every Jupiter level runs through the real Mission loop to celebration and counts for the session', async () => {
  for (let level = 1; level <= 4; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [], events = [];
    const s = new JupiterMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    s.random = seed(level * 17);
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 300 && !globalThis.__celebration; step++) {
      if (s.phase === 'stripes' || s.phase === 'bigger') {
        const choice = s.tappables.find((o) => o.visible && o.userData.choice === s.last);
        if (choice) await choice.userData.onTap();
      }
      s.update(0.05, step * 0.05);
      await flush();
    }
    assert.equal(globalThis.__celebration?.kind, 'jupiter', `level ${level}, phase ${s.phase}, round ${s.roundIndex}`);
    assert.deepEqual(globalThis.__progress, level < 4 ? [1, 2, 3] : [1, 2, 3, 4]);
    assert.equal(events.filter((e) => e.correct).length, LEVELS.jupiter[level - 1].rounds);
    assert.equal(scoreRun(s.answers).scored, LEVELS.jupiter[level - 1].rounds);
    assert.equal(getSession().missionsCompleted, 1);
    assert.deepEqual(s.doneLine(), ['Brawo! Jowisz ma piękne paski!']);
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['jupiter']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});

test('the red spot appears after the last round and the mission ends on its fact', async () => {
  const s = await scene(1);
  assert.equal(s.redSpot.visible, false);
  await s.outro();
  assert.equal(s.redSpot.visible, true);
  assert.equal(s.redSpot.scale.x, 0.9);
  assert.equal(globalThis.__lines.at(-1), 'Czerwona plama to wielka burza.');
  stop(s);
});

test('Jupiter has no shadows or point lights and leaves room for medium post passes', async () => {
  const s = await scene(1);
  const round = s.stripesRound();
  let draws = 0, shadows = 0, pointLights = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene calls plus 20 for medium postprocessing`);
  await s.tappables.find((o) => o.userData.choice === s.last).userData.onTap();
  await round;
  stop(s);
});
