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
    export const animate = async (ms, fn) => { globalThis.__animations.push(ms); for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t); };
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

const { ReefMission } = await import('../src/scenes/reef.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { learning } = await import('../src/learning/events.js');
const { T } = await import('../src/lang/pl.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const { placeAt, placeKey } = await import('../src/levels/reef.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 400; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };
const pick = (s, word) => s.tappables.find((o) => o.userData.choice === word && o.parent);

async function scene(level) {
  CONFIG.level = level;
  const s = new ReefMission({ home() {}, startMission() {} });
  s.L = LEVELS.reef[level - 1];
  s.rounds = s.L.rounds;
  s.build(); s.collect(); optimizeScene(s.scene);
  return s;
}

test('see shows the word and a little position picture; a wrong tap gets a "no" and the question, not the answer', async () => {
  const s = await scene(1);
  const round = s.round(0);
  await until(() => s.phase === 'asking');
  assert.ok(s.plan);
  assert.equal(s.last, s.plan[0].word);
  assert.equal(globalThis.__bubble.big, s.last);
  assert.match(globalThis.__bubble.pic, /<svg/);
  const wrong = s.tappables.find((o) => o.userData.choice && o.userData.choice !== s.last && o.parent);
  await wrong.userData.onTap();
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  assert.equal(s.phase, 'asking');
  const right = pick(s, s.last);
  assert.ok(!right.userData.hinting, 'the right scene does not pulse after one wrong tap');
  assert.equal(s.aid.state.level, 1, 'help is at "try again"');
  assert.ok(s.learn.current.assist <= 1);
  await right.userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'position');
  assert.equal(s.answers[0].item, s.plan[0].word);
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.answers[0].options, 2);
  stop(s);
});

test('hear asks with words only, and every scene carries its word for the walker', async () => {
  const s = await scene(3);
  const round = s.round(0);
  await until(() => s.phase === 'asking');
  assert.equal(globalThis.__bubble.big, '?');
  assert.equal(globalThis.__bubble.pic, undefined);
  const words = s.tappables.filter((o) => o.userData.choice).map((o) => o.userData.choice).sort();
  assert.equal(words.length, 3);
  assert.deepEqual([...new Set(words)], words);
  assert.ok(words.includes(s.last));
  assert.ok(words.every((w) => LEVELS.reef[2].words.includes(w)));
  await pick(s, s.last).userData.onTap();
  await round;
  assert.equal(s.answers[0].options, 3);
  stop(s);
});

test('place shows three glowing spots and the animal swims to the right one', async () => {
  const s = await scene(4);
  const target = { word: 'pod', animal: 'crab', place: { word: 'pod', on: 'rock' } };
  const round = s.placeRound(target);
  await until(() => s.phase === 'asking');
  assert.equal(s.spots.length, 3);
  assert.deepEqual(s.spots.map((o) => o.userData.choice).sort(), [...new Set(s.spots.map((o) => o.userData.choice))].sort());
  const wrong = s.spots.find((o) => o.userData.choice !== target.word);
  await wrong.userData.onTap();
  assert.equal(s.answers.length, 0);
  assert.equal(s.phase, 'asking');
  const rightSpot = s.spots.find((o) => o.userData.choice === target.word);
  assert.ok(!rightSpot.userData.hinting, 'the right spot does not pulse after one wrong tap');
  assert.equal(globalThis.__lines.at(-1), T.reefPlaceAsk('crab', 'pod', 'rock')[0]);
  await rightSpot.userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'position');
  assert.equal(s.answers[0].item, target.word);
  assert.equal(s.answers[0].firstTry, false);
  assert.ok(s.animalObj.position.distanceTo(new THREE.Vector3(placeAt(target.place).x, placeAt(target.place).y, placeAt(target.place).z)) < 0.01, placeKey(target.place));
  stop(s);
});

test('every Reef level runs through base progress and celebration, and counts for the session', async () => {
  for (let level = 1; level <= 4; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new ReefMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    const events = [];
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 600 && !globalThis.__celebration; step++) {
      if (s.phase === 'asking') {
        const right = s.tappables.find((o) => o.userData.choice === s.last && o.parent);
        if (right) await right.userData.onTap();
      }
      s.update(0.05, step * 0.05);
      await flush();
    }
    assert.ok(globalThis.__celebration, `level ${level} celebrated: ${s.phase}, round ${s.roundIndex}`);
    assert.deepEqual(globalThis.__progress, LEVELS.reef[level - 1].rounds === 3 ? [1, 2, 3] : [1, 2, 3, 4]);
    assert.equal(globalThis.__celebration.kind, 'reef');
    assert.equal(events.filter((e) => e.correct).length, LEVELS.reef[level - 1].rounds);
    assert.equal(scoreRun(s.answers).scored, LEVELS.reef[level - 1].rounds);
    assert.equal(getSession().missionsCompleted, 1);
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['reef']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});

test('the intro gives one fact per mission in turn', async () => {
  const s = await scene(2);
  const round = s.round(0);
  await until(() => s.phase === 'asking');
  assert.ok(globalThis.__lines.some((line) => line === 'Krab chodzi bokiem.' || line === 'Ośmiornica ma osiem ramion.' || line === 'Pod wodą mieszkają kraby i rozgwiazdy.'));
  await pick(s, s.last).userData.onTap();
  await round;
  stop(s);
});
