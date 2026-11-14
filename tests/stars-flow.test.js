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
      for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t);
    };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
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

const { StarsMission } = await import('../src/scenes/stars.js');
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
  const s = new StarsMission({});
  s.build(); s.collect(); optimizeScene(s.scene);
  return s;
}

test('joining a picture in order scores each star; a wrong tap gets a "no" and the question again, not the answer', async () => {
  const s = await scene();
  s.plan = [3];
  const round = s.round(0);
  await until(() => s.phase === 'choosing');
  assert.equal(s.last, 2);
  assert.deepEqual(s.stars.map((x) => x.userData.num), [1, 2, 3]);
  assert.deepEqual(s.stars.filter((x) => x.userData.lit).map((x) => x.userData.num), [1]);
  assert.deepEqual(s.tappables.filter((o) => o.userData.num !== undefined).map((o) => o.userData.num).sort(), [2, 3]);
  assert.equal(globalThis.__lines.at(-1), 'Jeden, a co dalej?');

  const wrong = s.stars.find((x) => x.userData.num === 3);
  const before = globalThis.__lines.length;
  await wrong.userData.onTap();
  assert.equal(s.answers.length, 0);
  assert.equal(s.lines.length, 0);
  assert.match(globalThis.__lines[before], /^Nie/);
  assert.equal(globalThis.__lines.at(-1), 'Jeden, a co dalej?');
  const right = s.stars.find((x) => x.userData.num === 2);
  for (let i = 0; i < 20; i++) { s.update(0.05, i * 0.05); await flush(); }
  assert.ok(!right.userData.hinting, 'the right star does not pulse after one wrong tap');

  await right.userData.onTap();
  assert.equal(s.answers.length, 1);
  assert.equal(s.answers[0].skill, 'sequence');
  assert.equal(s.answers[0].item, '2');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.lines.length, 1);
  assert.ok(globalThis.__lines.includes('Dwa!'));
  assert.deepEqual(s.tappables.filter((o) => o.userData.num !== undefined).map((o) => o.userData.num), [3]);

  await until(() => s.last === 3 && s.phase === 'choosing');
  assert.equal(globalThis.__lines.at(-1), 'Jeden, dwa, a co dalej?');
  await s.stars.find((x) => x.userData.num === 3).userData.onTap();
  await round;
  assert.equal(s.answers.length, 2);
  assert.equal(s.answers[1].item, '3');
  assert.equal(s.answers[1].scored, true);
  assert.ok(globalThis.__lines.includes('To góra!'));
  assert.equal(s.phase, 'idle');
  stop(s);
});

test('a countdown asks "Pięć! A dalej?", says no to a wrong star and asks again, and only the third miss shows the star', async () => {
  const s = await scene();
  s.L = LEVELS.stars[4];
  s.plan = [5];
  const round = s.round(0);
  await until(() => s.phase === 'choosing');
  assert.deepEqual(s.stars.map((x) => x.userData.num), [5, 4, 3, 2, 1]);
  assert.equal(s.last, 4);
  assert.deepEqual(globalThis.__lines.slice(-3), ['Liczymy od tyłu!', 'Pięć!', 'A dalej?']);
  const right = s.stars.find((x) => x.userData.num === 4);
  for (const misses of [1, 2, 3]) {
    globalThis.__lines.length = 0;
    const wrong = s.stars.find((x) => x.userData.num === 1);
    await wrong.userData.onTap();
    for (let i = 0; i < 6; i++) { s.update(0.05, i * 0.05); await flush(); }
    assert.equal(s.answers.length, 0);
    assert.equal(!!right.userData.hinting, misses >= 3, `the star is shown after ${misses} misses: ${!!right.userData.hinting}`);
    if (misses === 1) assert.deepEqual(globalThis.__lines.slice(-2), ['Pięć!', 'A dalej?']);
    if (misses === 3) assert.ok(globalThis.__lines.includes('Teraz numer cztery!'));
  }
  for (const n of [4, 3, 2, 1]) {
    await until(() => s.last === n && s.phase === 'choosing');
    await s.stars.find((x) => x.userData.num === n).userData.onTap();
  }
  await round;
  assert.deepEqual(s.answers.map((a) => a.item), ['4', '3', '2', '1']);
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.answers[1].firstTry, true);
  stop(s);
});

test('a closed picture draws its closing line and fills with colour; the Big Dipper stays open', async () => {
  const s = await scene();
  s.makePicture(3);
  s.phase = 'choosing';
  s.last = 2;
  await s.tapStar(s.stars[1]);
  s.last = 3;
  s.phase = 'choosing';
  await s.tapStar(s.stars[2]);
  assert.equal(s.lines.length, 2);
  await s.finishPicture();
  assert.equal(s.lines.length, 3);
  assert.ok(s.fill.material.opacity > 0.3);
  assert.equal(globalThis.__lines.at(-1), 'To góra!');
  s.clearPicture();

  s.makePicture(7);
  s.phase = 'choosing';
  for (let n = 2; n <= 7; n++) {
    s.last = n;
    s.phase = 'choosing';
    await s.tapStar(s.stars[n - 1]);
  }
  assert.equal(s.lines.length, 6);
  await s.finishPicture();
  assert.equal(s.lines.length, 6);
  assert.ok(s.fill.material.opacity > 0.3);
  assert.equal(globalThis.__lines.at(-1), 'To Wielki Wóz! Wielki Wóz to siedem gwiazd.');
  stop(s);
});

test('every Star Pictures level runs through base progress and celebration, and counts for the session', async () => {
  for (let level = 1; level <= 6; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new StarsMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    const events = [];
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 800 && !globalThis.__celebration; step++) {
      if (s.phase === 'choosing') {
        const star = s.stars.find((o) => o.userData.num === s.last && !o.userData.lit);
        if (star?.userData.onTap) await star.userData.onTap();
      }
      s.update(0.05, step * 0.05);
      await flush();
    }
    assert.ok(globalThis.__celebration, `level ${level} celebrated: ${s.phase}, round ${s.roundIndex}, ${s.answers.length} answers`);
    assert.deepEqual(globalThis.__progress, [1, 2]);
    assert.equal(globalThis.__celebration.kind, 'stars');
    const questions = [5, 7, 9, 11, 7, 5][level - 1];
    assert.equal(events.filter((e) => e.correct && e.skill === 'sequence').length, questions);
    assert.equal(scoreRun(s.answers).scored, questions);
    assert.equal(getSession().missionsCompleted, 1);
    assert.deepEqual(s.doneLine(), ['Brawo! Ułożyłaś obrazki z gwiazd!']);
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['stars']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});

test('Star Pictures has no shadows or point lights, keeps stars large, and leaves room for medium post passes', async () => {
  const s = await scene(7);
  s.makePicture(7);
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
    const dir = s.view.pos.clone().sub(s.view.look);
    dir.setLength(Math.max(dir.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
    camera.position.copy(s.view.look).add(dir); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s.stars[0]);
    const xs = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) xs.push(new THREE.Vector3(x, y, z).project(camera).x);
    assert.ok((Math.max(...xs) - Math.min(...xs)) * width / 2 >= 70, `${width}x${height} star width`);
  }
  stop(s);
});
