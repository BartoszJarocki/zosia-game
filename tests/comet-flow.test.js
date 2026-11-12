import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

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
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x, in: (x) => x };
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

const { CometMission } = await import('../src/scenes/comet.js');
const { CONFIG } = await import('../src/config.js');
const { T } = await import('../src/lang/pl.js');
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

async function scene(level = 1) {
  CONFIG.level = level;
  const s = new CometMission({ home() {}, startMission() {} });
  s.pick = (skill, pool) => pool[0];
  s.build();
  s.collect();
  optimizeScene(s.scene);
  return s;
}

const live = (s) => s.comets.filter((o) => o.userData.onTap);
/** Fly on until a comet with this letter can be tapped. */
async function reach(s, letter) {
  for (let i = 0; i < 1200; i++) {
    const c = live(s).find((x) => x.userData.letter === letter && !x.userData.popped);
    if (c) return c;
    s.update(0.1, i * 0.1);
    await flush();
  }
  assert.fail(`no comet with ${letter} came into reach`);
}

test('a right tap catches and counts; a wrong letter wobbles and gets a "no", and the answer is not shown', async () => {
  const s = await scene(2);
  globalThis.__lines = [];
  const round = s.round(0);
  await until(() => s.phase === 'catch' && s.comets.length === s.L.total);
  assert.equal(s.last, s.L.pool[0]);
  assert.ok(s.comets.every((o) => typeof o.userData.letter === 'string'));
  const target = s.last;
  s.update(0.01, 0);
  const wrong = live(s).find((o) => o.userData.letter !== target);
  const right = await reach(s, target);
  assert.ok(wrong && right);
  const linesBefore = globalThis.__lines.length;
  await wrong.userData.onTap();
  assert.equal(s.answers.length, 0);
  assert.equal(wrong.userData.wobble, 1);
  assert.ok(globalThis.__lines.slice(linesBefore).some((line) => /^Nie/.test(line)));
  assert.ok(!s.comets.some((o) => o.userData.hinting), 'no comet pulses after one wrong tap');
  assert.equal(s.aid.state.level, 1, 'help is at "try again"');
  assert.ok(s.learn.current.assist <= 1);
  await right.userData.onTap();
  assert.equal(s.answers.length, 1);
  assert.equal(s.answers[0].skill, 'letterAudio', 'a level that only says the letter asks for its name');
  assert.equal(s.answers[0].item, target);
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(globalThis.__lines.at(-1), 'Jeden!');
  while (s.comets.some((x) => x.userData.letter === target && !x.userData.popped)) await (await reach(s, target)).userData.onTap();
  await round;
  assert.equal(s.answers.length, s.L.targets);
  assert.ok(s.answers.slice(1).every((a) => a.firstTry));
  assert.equal(globalThis.__lines.at(-1), 'Mamy wszystkie!');
  stop(s);
});

test('the first level shows the asked letter in the bubble; the others show only a question mark and say the letter', async () => {
  for (const level of [1, 2, 3, 4]) {
    const s = await scene(level);
    globalThis.__lines = [];
    s.round(0);
    await until(() => s.phase === 'catch' && s.comets.length === s.L.total);
    await until(() => globalThis.__lines.includes(T.cometAsk(s.last)[0]));
    assert.equal(globalThis.__bubble.big, level === 1 ? s.last : '?', `level ${level}`);
    assert.equal(s.learn.current.skill, level === 1 ? 'letterVisual' : 'letterAudio', `level ${level}`);
    stop(s);
  }
});

test('a level that only says the letter helps with its picture word first, and shows the letter only with the answer', async () => {
  const s = await scene(2);
  s.round(0);
  await until(() => s.phase === 'catch' && s.comets.length === s.L.total);
  s.update(0.01, 0);
  const target = s.last;
  const wrong = live(s).find((o) => o.userData.letter !== target);
  await wrong.userData.onTap();
  assert.equal(globalThis.__bubble.big, '?', 'one wrong tap shows nothing more');
  s.runAssist('hint');
  assert.equal(globalThis.__bubble.big, '', 'the clue: the picture word, not the letter');
  assert.ok(globalThis.__bubble.pic);
  assert.ok(globalThis.__lines.at(-1).includes(' jak '), 'and says it: "Em jak mama"');
  s.runAssist('reveal');
  assert.equal(globalThis.__bubble.big, target, 'the answer shows the letter');
  assert.ok(s.comets.filter((o) => o.userData.letter === target).every((o) => o.userData.hinting));
  stop(s);
});

test('the next comet with the asked letter is a new question: the bubble goes back to a question mark', async () => {
  const s = await scene(2);
  s.round(0);
  await until(() => s.phase === 'catch' && s.comets.length === s.L.total);
  const target = s.last;
  s.runAssist('reveal');
  assert.equal(globalThis.__bubble.big, target, 'the answer shows the letter');
  await (await reach(s, target)).userData.onTap();
  assert.equal(s.learn.current.item, target, 'the same letter is asked again, for the next comet');
  assert.equal(globalThis.__bubble.big, '?', 'and it starts without the answer in the bubble');
  stop(s);
});

test('the comets go round and round: each flies off the left and comes back at the right, none is lost', async () => {
  const s = await scene(1);
  s.round(0);
  await until(() => s.phase === 'catch' && s.comets.length === s.L.total);
  const laps = new Map(s.comets.map((c) => [c, 0]));
  let last = new Map(s.comets.map((c) => [c, c.position.x]));
  for (let i = 0; i < 1500; i++) {
    s.update(0.1, i * 0.1);
    for (const c of s.comets) {
      if (c.position.x > last.get(c)) laps.set(c, laps.get(c) + 1);
      last.set(c, c.position.x);
    }
  }
  assert.ok([...laps.values()].every((n) => n >= 1), 'every comet went all the way round');
  assert.equal(s.comets.length, s.L.total, 'none was lost or added');
  stop(s);
});

test('every Comet level runs through the real Mission loop to celebration and counts for the session', async () => {
  for (let level = 1; level <= 4; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new CometMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    s.pick = (skill, pool) => pool[0];
    const events = [];
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter();
    optimizeScene(s.scene);
    for (let step = 0; step < 600 && !globalThis.__celebration; step++) {
      if (s.phase === 'catch' && s.last) {
        const c = s.comets.find((x) => x.userData.letter === s.last && !x.userData.popped && x.userData.onTap);
        if (c) await c.userData.onTap();
      }
      s.update(0.05, step * 0.05);
      await flush();
    }
    const rows = LEVELS.comet[level - 1];
    assert.ok(globalThis.__celebration, `level ${level} celebrated: ${s.phase}, round ${s.roundIndex}, ${s.comets.length} comets, ${s.answers.length} answers`);
    assert.deepEqual(globalThis.__progress, Array.from({ length: rows.rounds }, (_, i) => i + 1));
    assert.equal(globalThis.__celebration.kind, 'comet');
    assert.equal(s.answers.length, rows.rounds * rows.targets);
    assert.equal(scoreRun(s.answers).scored, rows.rounds * rows.targets);
    assert.equal(events.filter((e) => e.correct).length, s.answers.length);
    assert.equal(getSession().missionsCompleted, 1);
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['comet']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe();
    stop(s);
    await flush();
  }
  CONFIG.level = null;
});
