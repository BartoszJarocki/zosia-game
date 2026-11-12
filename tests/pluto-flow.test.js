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
    export const renderer = { getRenderTarget: () => null, setRenderTarget: () => {}, render: () => {} };
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

const { PlutoMission } = await import('../src/scenes/pluto.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { learning } = await import('../src/learning/events.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const { T } = await import('../src/lang/pl.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 250; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };
const asked = (s) => s.tappables.find((o) => o.userData.choice === s.last);

async function scene(level = 1) {
  CONFIG.level = level;
  const s = new PlutoMission({});
  s.build(); s.collect(); optimizeScene(s.scene);
  await s.landed;
  return s;
}

test('one wrong tap gets a "no" and the question again, and does not score or fill the heart', async () => {
  const s = await scene(1);
  const task = s.round(0);
  await until(() => s.phase === 'choosing' && s.tappables.length >= 2);
  assert.ok(['heart', 'star', 'oval'].includes(s.last));
  assert.equal(s.tappables.length, 2);
  assert.ok(asked(s));
  assert.match(globalThis.__bubble.big, /<svg/, 'level 1 matches: the bubble draws the shape');
  const wrong = s.tappables.find((o) => o.userData.choice !== s.last);
  const before = globalThis.__lines.length, glow = s.heartBody.material.emissiveIntensity;
  await wrong.userData.onTap();
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  assert.equal(s.aid.state.level, 1, 'help is at "try again"');
  assert.ok(s.learn.current.assist <= 1);
  assert.equal(s.heartLevel, 0);
  const said = globalThis.__lines.slice(before);
  assert.ok(/^Nie/.test(said[0]), said.join(' '));
  assert.equal(said.at(-1), T.plutoAsk(s.last)[0]);
  assert.equal(s.heartBody.material.emissiveIntensity, glow, "Pluto's own heart, which she cannot tap, does not light");
  assert.ok(!asked(s).userData.hinting);
  await asked(s).userData.onTap();
  await task;
  stop(s);
});

test('a right tap floats the shape into the heart, scores it, names it and brightens Pluto', async () => {
  const s = await scene(1);
  const task = s.round(0);
  await until(() => s.phase === 'choosing');
  const shape = s.last;
  await asked(s).userData.onTap();
  await task; await s.talk;
  assert.equal(s.answers.length, 1);
  assert.equal(s.answers[0].skill, 'shape');
  assert.equal(s.answers[0].item, shape);
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, true);
  assert.equal(s.answers[0].options, 2);
  assert.equal(globalThis.__lines.at(-1), T.plutoRight(shape)[0]);
  assert.ok(Math.abs(s.heartLevel - 1 / 3) < 1e-9);
  assert.equal(s.tappables.length, 0);
  assert.equal(s.pieces.length, 0);
  stop(s);
});

test('a named shape: the bubble keeps it, the clue draws it, the second miss takes a piece away, the third pulses it', async () => {
  const s = await scene(2);
  s.asks = ['oval'];
  s.round(0);
  await until(() => s.phase === 'choosing');
  assert.equal(globalThis.__bubble.big, '?', 'the question is hers');
  assert.equal(globalThis.__lines.at(-1), 'Gdzie jest owal?');
  assert.ok(!s.tappables.some((o) => o.userData.choice === 'circle'), 'no twin at a level without lookalikes');
  s.runAssist('hint');
  assert.match(globalThis.__bubble.big, /<svg/, 'the clue draws the shape in the bubble');
  const wrongs = s.tappables.filter((o) => o.userData.choice !== 'oval');
  await wrongs[0].userData.onTap();
  await wrongs[0].userData.onTap();
  assert.equal(s.pieces.filter((o) => o.userData.gone).length, 1);
  assert.ok(!asked(s).userData.hinting);
  await wrongs[1].userData.onTap();
  assert.ok(asked(s).userData.hinting, 'the third miss pulses the oval');
  stop(s);
});

test('a wrong first tap is remembered when the shape is found on the retry', async () => {
  const s = await scene(2);
  const task = s.round(0);
  await until(() => s.phase === 'choosing');
  await s.tappables.find((o) => o.userData.choice !== s.last).userData.onTap();
  await asked(s).userData.onTap();
  await task;
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.answers[0].scored, true);
  stop(s);
});

test('the asked shape changes every round, and every right answer fills the heart until it shines fully', async () => {
  const s = await scene(4);
  assert.equal(s.rounds, 4);
  const shapes = [];
  for (let r = 0; r < s.rounds; r++) {
    const task = s.round(r);
    await until(() => s.phase === 'choosing' && asked(s));
    shapes.push(s.last);
    assert.equal(s.tappables.length, 4);
    await asked(s).userData.onTap();
    await task;
  }
  assert.equal(new Set(shapes).size, 4, shapes.join(' '));
  assert.ok(Math.abs(s.heartLevel - 1) < 1e-9);
  assert.equal(s.pieces.length, 0);
  stop(s);
});

test('a visit cut short ends on the heart, and the heart shines fully before the goodbye', async () => {
  const s = await scene(3);
  s.asks = ['diamond', 'oval', 'star', 'rectangle'];
  s.windingDown = true; s.rounds = 2;
  const task = s.round(1);
  await until(() => s.phase === 'choosing');
  assert.equal(s.last, 'heart');
  await asked(s).userData.onTap();
  await task;
  assert.ok(s.heartLevel < 1);
  await s.outro();
  assert.equal(s.heartLevel, 1);
  stop(s);
});

test('every Pluto level runs through base progress and celebration, and counts for the session', async () => {
  for (let level = 1; level <= 4; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new PlutoMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    const events = [];
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 300 && !globalThis.__celebration; step++) {
      await flush();
      if (s.phase === 'choosing' && asked(s)) await asked(s).userData.onTap();
      s.update(0.05, step * 0.05);
    }
    assert.ok(globalThis.__celebration, `level ${level} celebrated: ${s.phase}, round ${s.roundIndex}, ${s.answers.length} answers`);
    const rounds = LEVELS.pluto[level - 1].rounds;
    assert.deepEqual(globalThis.__progress, Array.from({ length: rounds }, (_, i) => i + 1));
    assert.equal(globalThis.__celebration.kind, 'pluto');
    assert.equal(events.filter((e) => e.correct).length, LEVELS.pluto[level - 1].rounds);
    assert.equal(scoreRun(s.answers).scored, rounds);
    assert.ok(s.answers.every((a) => a.skill === 'shape' && LEVELS.pluto[level - 1].shapes.includes(a.item) && a.scored));
    assert.equal(getSession().missionsCompleted, 1);
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['pluto']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});
