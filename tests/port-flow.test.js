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

const { PortMission, BOAT_PICTURES } = await import('../src/scenes/port.js');
const { BOATS } = await import('../src/levels/port.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { T } = await import('../src/lang/pl.js');
const { learning } = await import('../src/learning/events.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 400; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };
const choice = (s, name) => s.tappables.find((o) => o.userData.choice === name && o.parent);
const count = (s, n) => s.tappables.find((o) => o.userData.num === n && o.parent);

async function scene(level) {
  CONFIG.level = level;
  const s = new PortMission({ home() {}, startMission() {} });
  s.L = LEVELS.port[level - 1];
  s.rounds = s.L.rounds;
  s.build(); s.collect(); optimizeScene(s.scene);
  return s;
}

test('together claps the name once first, each horn toot lights a block, and the boat says it once as it sails out', async () => {
  const s = await scene(1);
  s.pick = () => 'MEWA';
  const round = s.round(0);
  await until(() => globalThis.__lines.includes('Zatrąb jej imię po kawałku!'));
  assert.equal(s.phase, 'asking');
  assert.equal(s.last, 2);
  assert.equal(s.target, 2);
  assert.equal(s.count, 0);
  assert.ok(globalThis.__lines.includes('W porcie łódki odpoczywają. Każda łódka ma imię.'));
  assert.ok(!globalThis.__lines.includes('Ta łódka nazywa się Mewa.'), 'Chase claps it instead');
  assert.deepEqual(globalThis.__lines.slice(-4), ['Me!', 'Wa!', 'Zatrąb jej imię po kawałku!', 'Gotowe? Dotknij łódki!']);
  const horn = choice(s, 'horn');
  const boat = choice(s, 'done');
  assert.ok(horn && boat);
  await horn.userData.onTap();
  assert.equal(s.count, 1);
  assert.equal(s.last, 2);
  assert.equal(s.boats[0].userData.board.userData.blocks[0].material.emissiveIntensity, 0.9);
  await horn.userData.onTap();
  assert.equal(s.count, 2);
  assert.equal(s.last, 'done');
  await boat.userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'syllables');
  assert.equal(s.answers[0].item, 'MEWA');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, true);
  assert.deepEqual(globalThis.__lines.slice(-2), ['Mewa!', 'Brawo! Łódka wypływa w morze!']);
  assert.equal(globalThis.__lines.filter((l) => l === 'Me!').length, 1, 'no syllables sung back: the boat toots them');
  stop(s);
});

test('too few toots get "Za mało!" and the name again, not the clap, then a fresh try counts as not first time', async () => {
  const s = await scene(2);
  s.pick = () => 'FOKA';
  const round = s.round(0);
  await until(() => s.phase === 'asking');
  assert.equal(s.last, 2);
  const before = globalThis.__lines.length;
  await choice(s, 'done').userData.onTap();
  await until(() => s.phase === 'asking');
  assert.deepEqual(globalThis.__lines.slice(before), ['Za mało! Posłuchaj jeszcze raz.', 'Ta łódka nazywa się Foka.', 'Zatrąb jej imię po kawałku!']);
  assert.equal(s.count, 0);
  assert.equal(s.last, 2);
  assert.equal(s.answers.length, 0);
  await choice(s, 'horn').userData.onTap();
  await choice(s, 'horn').userData.onTap();
  assert.equal(s.last, 'done');
  await choice(s, 'done').userData.onTap();
  await round;
  assert.equal(s.answers[0].item, 'FOKA');
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.answers[0].scored, true);
  stop(s);
});

test('every boat has its animal for its board', () => {
  for (const boat of BOATS) assert.ok(BOAT_PICTURES[boat.word], boat.word);
});

test('which says the three names first, each boat hopping, then asks for a count; a tapped boat says its name', async () => {
  const s = await scene(3);
  s.pick = () => 2;
  const before = globalThis.__lines.length;
  const round = s.round(0);
  await until(() => s.phase === 'choosing' && globalThis.__lines.at(-1) === 'Która łódka ma dwa kawałki?');
  const names = [...s.boats].sort((a, b) => a.position.x - b.position.x).map((b) => `${b.userData.boatName[0]}${b.userData.boatName.slice(1).toLowerCase()}!`);
  assert.deepEqual(globalThis.__lines.slice(before).slice(-4), [...names, 'Która łódka ma dwa kawałki?']);
  assert.equal(s.last, 2);
  const ticks = s.tappables.filter((o) => o.userData.num !== undefined && o.parent);
  assert.equal(ticks.length, 3);
  assert.deepEqual(ticks.map((o) => o.userData.num).sort(), [1, 2, 3]);

  const seal = s.boats[0];
  const said = globalThis.__lines.length;
  await s.tappables.find((o) => o === seal).userData.onTap();
  assert.deepEqual(globalThis.__lines.slice(said), [`${seal.userData.boatName[0]}${seal.userData.boatName.slice(1).toLowerCase()}!`]);
  assert.equal(s.learn.current.wrong, 0, 'a tap on a boat is not an answer');

  await ticks.find((o) => o.userData.num !== 2).userData.onTap();
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  assert.equal(s.last, 2);
  await count(s, 2).userData.onTap();
  await round;
  assert.equal(s.answers[0].skill, 'syllables');
  assert.equal(s.answers[0].item, '2');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.answers[0].options, 3);
  stop(s);
});

test('which: a tick tapped before the question is said is not an answer; a tap on a boat stops the names, then the question comes', async () => {
  const s = await scene(3);
  s.pick = () => 2;
  const held = [], say = s.say.bind(s);
  s.say = (segments) => { say(segments); return new Promise((resolve) => held.push(resolve)); }; // (each line plays until let go)
  const round = s.round(0);
  const naming = () => s.phase === 'choosing' && /^\p{Lu}\p{Ll}+!$/u.test(globalThis.__lines.at(-1));
  await until(() => naming() || (held.splice(0).forEach((go) => go()), false)); // (the start line plays; the first name holds)
  await count(s, 2).userData.onTap();
  assert.equal(s.answers.length, 0, 'not an answer yet');
  assert.equal(s.learn.current.wrong, 0);
  const before = globalThis.__lines.length;
  await s.boats.at(-1).userData.onTap();
  held.splice(0).forEach((go) => go());
  await until(() => globalThis.__lines.at(-1) === 'Która łódka ma dwa kawałki?');
  held.splice(0).forEach((go) => go());
  const said = globalThis.__lines.slice(before);
  assert.equal(said.length, 2, `the tapped boat's name, then the question: ${said}`);
  s.say = say;
  await count(s, 2).userData.onTap();
  await round;
  assert.equal(s.answers[0].firstTry, true);
  stop(s);
});

test('a done boat exposes only choice, and a which boat no answer, for the walker', async () => {
  const s = await scene(1);
  s.pick = () => 'MEWA';
  const round = s.round(0);
  await until(() => s.phase === 'asking');
  const boat = choice(s, 'done');
  assert.equal(boat.userData.choice, 'done');
  assert.equal(boat.userData.boatName, 'MEWA');
  assert.equal(boat.userData.word, undefined);
  assert.equal(boat.userData.letter, undefined);
  assert.equal(boat.userData.num, undefined);
  await choice(s, 'horn').userData.onTap();
  await choice(s, 'horn').userData.onTap();
  await boat.userData.onTap();
  await round;
  stop(s);

  const q = await scene(3);
  q.pick = () => 2;
  const which = q.round(0);
  await until(() => q.phase === 'choosing');
  assert.equal(q.boats.length, 3);
  for (const b of q.boats) { // (a boat says its name: nothing on it reads as an answer)
    assert.equal(b.userData.num, undefined);
    assert.equal(b.userData.word, undefined);
    assert.equal(b.userData.letter, undefined);
    assert.equal(b.userData.choice, undefined);
  }
  await count(q, 2).userData.onTap();
  await which;
  stop(q);
});

test('every Port level runs through base progress and celebration, and counts for the session', async () => {
  for (let level = 1; level <= 3; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new PortMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    s.pick = (skill, pool) => (typeof pool[0] === 'number' ? 2 : pool[0]);
    const events = [];
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 800 && !globalThis.__celebration; step++) {
      if (s.phase === 'asking') {
        const boat = choice(s, 'done');
        if (s.count < s.target) await choice(s, 'horn').userData.onTap();
        else if (boat) await boat.userData.onTap();
      } else if (s.phase === 'choosing') {
        const right = count(s, s.last);
        if (right) await right.userData.onTap();
      }
      s.update(0.05, step * 0.05);
      await flush();
    }
    assert.ok(globalThis.__celebration, `level ${level} celebrated: ${s.phase}, round ${s.roundIndex}`);
    assert.deepEqual(globalThis.__progress, [1, 2, 3, 4]);
    assert.equal(globalThis.__celebration.kind, 'port');
    assert.equal(events.filter((e) => e.correct).length, s.L.rounds);
    assert.equal(scoreRun(s.answers).scored, s.L.rounds);
    assert.equal(getSession().missionsCompleted, 1);
    assert.deepEqual(s.doneLine(), T.portFinished());
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['port']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});
