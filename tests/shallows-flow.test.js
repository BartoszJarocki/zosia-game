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
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x, in: (x) => x, back: (x) => x, bounce: (x) => x };
    export const animate = async (ms, fn) => {
      globalThis.__animations.push(ms);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t);
    };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/world/portrait.js')) source = `export const portrait = () => ({ texture: null, dispose: () => {} });`;
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

const { ShallowsMission, thingPicture } = await import('../src/scenes/shallows.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { thingById, THINGS } = await import('../src/levels/shallows.js');
const { learning } = await import('../src/learning/events.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const { T } = await import('../src/lang/pl.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 300; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };

async function scene(level = 1, plan = null) {
  CONFIG.level = level;
  const s = new ShallowsMission({ home() {}, startMission() {} });
  s.L = LEVELS.shallows[level - 1];
  s.rounds = s.L.rounds;
  if (plan) { s.plan = plan; s.rounds = plan.length; }
  s.build();
  s.collect();
  optimizeScene(s.scene);
  return s;
}

test('watch: tap the thing, it floats, then the right shelf scores the sort', async () => {
  const s = await scene(1, [thingById('jabłko')]);
  const round = s.round(0);
  await until(() => s.phase === 'dropping' && s.thing);
  assert.equal(s.last, 'drop');
  const drop = s.tappables.find((o) => o.userData.choice === 'drop');
  assert.ok(drop, 'the thing is the drop target');
  const item = s.thing;
  drop.userData.onTap();
  await until(() => s.phase === 'placing');
  assert.equal(s.last, 'float');
  assert.ok(globalThis.__lines.includes('Jabłko pływa!'));
  assert.ok(globalThis.__lines.includes('Gdzie to położymy?'));
  assert.equal(s.tappables.find((o) => o.userData.choice === 'sink').userData.choice, 'sink');

  s.tappables.find((o) => o.userData.choice === 'sink').userData.onTap();
  await flush();
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  assert.ok(globalThis.__lines.includes('Jabłko pływa!'));

  s.tappables.find((o) => o.userData.choice === 'float').userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'sorting');
  assert.equal(s.answers[0].item, 'float:jabłko');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(item.parent, s.shelves.float);
  assert.equal(item.userData.placed, true);
  stop(s);
});

test('guess: the shelf tap is scored, and settling on the right shelf shows the answer first', async () => {
  const right = await scene(2, [thingById('klucz')]);
  const a = right.round(0);
  await until(() => right.phase === 'guessing');
  assert.equal(right.last, 'sink');
  right.tappables.find((o) => o.userData.choice === 'sink').userData.onTap();
  await a;
  assert.equal(right.answers[0].item, 'sink:klucz');
  assert.equal(right.answers[0].scored, true);
  assert.equal(right.answers[0].firstTry, true);
  assert.ok(globalThis.__lines.includes('Klucz tonie!'));
  stop(right);

  const wrong = await scene(2, [thingById('klucz')]);
  const b = wrong.round(0);
  await until(() => wrong.phase === 'guessing');
  const key = wrong.thing;
  wrong.tappables.find((o) => o.userData.choice === 'float').userData.onTap();
  await b;
  assert.equal(wrong.answers.length, 0);
  assert.ok(globalThis.__lines.includes('Popatrz! Klucz tonie!'));
  assert.equal(key.parent, wrong.shelves.sink);
  stop(wrong);
});

test('surprise: the big log floats, the little coin sinks, and each gets its own line', async () => {
  const log = await scene(3, [thingById('kłoda')]);
  const a = log.round(0);
  await until(() => log.phase === 'guessing');
  assert.equal(log.last, 'float');
  log.tappables.find((o) => o.userData.choice === 'float').userData.onTap();
  await a;
  assert.ok(globalThis.__lines.includes('Kłoda pływa!'));
  assert.ok(globalThis.__lines.includes('Taka duża, a pływa!'));
  stop(log);

  const coin = await scene(3, [thingById('moneta')]);
  const b = coin.round(0);
  await until(() => coin.phase === 'guessing');
  assert.equal(coin.last, 'sink');
  coin.tappables.find((o) => o.userData.choice === 'sink').userData.onTap();
  await b;
  assert.ok(globalThis.__lines.includes('Moneta tonie!'));
  assert.ok(globalThis.__lines.includes('Taka mała, a tonie!'));
  stop(coin);
});

test('the bubble picture is the round\'s own thing for every thing, so it never hints at an answer', async () => {
  const seen = new Set();
  for (const thing of THINGS) {
    const s = await scene(1, [thingById(thing.id)]);
    s.round(0);
    await until(() => s.phase === 'dropping');
    const pic = globalThis.__bubble.pic;
    assert.equal(pic, thingPicture(thing.id));
    assert.ok(pic.includes(`data-thing="${thing.id}"`), `${thing.id} is drawn in the bubble`);
    seen.add(pic);
    stop(s);
    await flush();
  }
  assert.equal(seen.size, THINGS.length, 'every thing has its own picture');
});

test('every level runs through the base Mission loop to celebration and counts for the session', async () => {
  for (let level = 1; level <= 3; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new ShallowsMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    s.L = LEVELS.shallows[level - 1];
    s.rounds = s.L.rounds;
    const events = [];
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 400 && !globalThis.__celebration; step++) {
      if (s.phase === 'dropping') s.tappables.find((o) => o.userData.choice === 'drop')?.userData.onTap();
      else if (s.phase === 'placing' || s.phase === 'guessing') s.tappables.find((o) => o.userData.choice === s.last)?.userData.onTap();
      s.update(0.05, step * 0.05);
      await flush();
    }
    assert.ok(globalThis.__celebration, `level ${level} celebrated: ${s.phase}, round ${s.roundIndex}, ${s.answers.length} answers`);
    assert.equal(globalThis.__celebration.kind, 'shallows');
    assert.equal(events.filter((e) => e.correct).length, LEVELS.shallows[level - 1].rounds);
    assert.equal(scoreRun(s.answers).scored, LEVELS.shallows[level - 1].rounds);
    assert.equal(getSession().missionsCompleted, 1);
    assert.deepEqual(s.doneLine(), T.shallowsDone());
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['shallows']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});
