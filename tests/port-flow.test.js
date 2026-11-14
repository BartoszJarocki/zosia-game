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
const { demoSeen, markDemoSeen, resetProgress } = await import('../src/progress.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 400; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };
const choice = (s, name) => s.tappables.find((o) => o.userData.choice === name && o.parent);
const count = (s, n) => s.tappables.find((o) => o.userData.num === n && o.parent);
const dots = (s) => s.boats[0].userData.board.userData.dots.children.length;
const lit = (s) => s.boats[0].userData.board.userData.blocks.filter((b) => b.material.emissiveIntensity > 0.5).length;
const toots = async (s, n = 1) => { for (let i = 0; i < n; i++) await choice(s, 'horn').userData.onTap(); };
/** She stops tooting for a while: the quiet-time help would count it from here. */
const pause = async (s, ms = 2000) => {
  s.speaking = false;
  s.aid.quietFrom = performance.now() - ms;
  s.update(0.05, 0);
  await flush();
};

/** A scene on a save that has seen Chase's demo, or (demo: false) a fresh save that has not. */
async function scene(level, { demo = true } = {}) {
  CONFIG.level = level;
  resetProgress();
  if (demo) markDemoSeen('port.together');
  const s = new PortMission({ home() {}, startMission() {} });
  s.L = LEVELS.port[level - 1];
  s.rounds = s.L.rounds;
  s.build(); s.collect(); optimizeScene(s.scene);
  return s;
}

test('together claps the name once first, each horn toot lights a block, and the boat says it once as it sails out', async () => {
  const s = await scene(1);
  s.pick = () => 'MEWA';
  const from = globalThis.__lines.length;
  const round = s.round(0);
  await until(() => globalThis.__lines.includes('Zatrąb jej imię po kawałku!', from));
  assert.equal(s.phase, 'asking');
  assert.equal(s.last, 2);
  assert.equal(s.target, 2);
  assert.equal(s.count, 0);
  assert.ok(globalThis.__lines.includes('W porcie łódki odpoczywają. Każda łódka ma imię.', from));
  assert.ok(!globalThis.__lines.includes('Ta łódka nazywa się Mewa.', from), 'Chase claps it instead');
  assert.deepEqual(globalThis.__lines.slice(-3), ['Me!', 'Wa!', 'Zatrąb jej imię po kawałku!']);
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
  assert.equal(s.answers[0].options, 2, 'level 1 names have one or two pieces: a blind tooter is right one time in two');
  assert.deepEqual(globalThis.__lines.slice(-2), ['Mewa!', 'Brawo! Łódka wypływa w morze!']);
  assert.equal(globalThis.__lines.filter((l, i) => i >= from && l === 'Me!').length, 1, 'no syllables sung back: the boat toots them');
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
  assert.equal(s.answers[0].options, 3, 'level 2 names have one to three pieces');
  stop(s);
});

test('a second wrong boat tap shows the horn to toot, not the pieces', async () => {
  const s = await scene(2);
  s.pick = () => 'FOKA';
  const round = s.round(0);
  await until(() => s.phase === 'asking');
  await choice(s, 'done').userData.onTap();
  await until(() => s.phase === 'asking');
  const before = globalThis.__lines.length;
  await choice(s, 'done').userData.onTap();
  await until(() => globalThis.__lines.length > before + 1);
  assert.ok(globalThis.__lines.slice(before).includes('Dotknij rogu i zatrąb raz na każdy kawałek!'));
  assert.equal(s.learn.current.assist, 2);
  assert.ok(s.boats[0].userData.board.userData.blocks.every((b) => b.material.emissiveIntensity < 0.9), 'no piece lit for her');
  s.alive = false;
  s.resolveRound?.();
  await round;
  s.exit();
});

const { applyEvent } = await import('../src/learning/mastery.js');
const { categorize } = await import('../src/learning/scheduler.js');
const { sectionReports, SYLLABLE_ITEMS } = await import('../src/parent/report.js');

test('together leaves the pieces on the board, so five copied names are five solves that leave the name new', async () => {
  const skills = {};
  for (let r = 0; r < 5; r++) {
    const s = await scene(1);
    s.pick = () => 'MEWA';
    try {
      const round = s.round(0);
      await until(() => s.phase === 'asking' && globalThis.__lines.at(-1) === 'Zatrąb jej imię po kawałku!');
      const blocks = s.boats[0].userData.board.userData.blocks;
      assert.equal(blocks.filter((b) => b.visible).length, 2, 'both pieces on the board before her first toot');
      while (blocks.some((b) => b.material.emissiveIntensity < 0.9)) await choice(s, 'horn').userData.onTap();
      await choice(s, 'done').userData.onTap();
      await round;
      applyEvent(skills, s.answers[0]);
    } finally { stop(s); }
  }
  const mewa = skills.syllables.MEWA;
  assert.deepEqual([mewa.solved, mewa.firstTry, mewa.attempts, mewa.mastery, categorize(mewa)], [5, 5, 0, 0, 'new']);
});

test('alone shows only the name, so a right count moves its mastery', async () => {
  const s = await scene(2);
  s.pick = () => 'FOKA';
  const skills = {};
  try {
    const round = s.round(0);
    await until(() => s.phase === 'asking' && globalThis.__lines.at(-1) === 'Zatrąb jej imię po kawałku!');
    assert.ok(s.boats[0].userData.board.userData.blocks.every((b) => !b.visible), 'no pieces on the board');
    await choice(s, 'horn').userData.onTap();
    await choice(s, 'horn').userData.onTap();
    await choice(s, 'done').userData.onTap();
    await round;
    applyEvent(skills, s.answers[0]);
  } finally { stop(s); }
  assert.deepEqual([skills.syllables.FOKA.solved, skills.syllables.FOKA.attempts, skills.syllables.FOKA.mastery], [1, 1, 0.4]);
});

const GOTOWE = 'Gotowe? Dotknij łódki!', ZATRAB = 'Zatrąb jej imię po kawałku!';
/** The lines said from a point on. */
const spoken = () => { const from = globalThis.__lines.length; return () => globalThis.__lines.slice(from); };
/** Hold every line the scene says until let go, so a test can tap while Chase is clapping. */
const holdLines = (s) => {
  const held = [], say = s.say.bind(s);
  s.say = (segments) => { say(segments); return new Promise((resolve) => held.push(resolve)); };
  return () => held.splice(0).forEach((go) => go());
};

test('on a fresh save level 2 opens with one guided boat, then a boat that asks one thing', async () => {
  const s = await scene(2, { demo: false });
  s.pick = (skill, pool) => pool[0];
  const said = spoken();
  const first = s.round(0);
  await until(() => said().includes(ZATRAB));
  assert.deepEqual(said(), ['W porcie łódki odpoczywają. Każda łódka ma imię.', 'Me!', 'Wa!', ZATRAB], 'Chase claps the name, then the one question');
  assert.equal(s.mode, 'together');
  assert.equal(s.step, 'toot');
  assert.equal(s.target, 2, 'the demo is a name of two pieces');
  await toots(s, 1);
  assert.equal(lit(s), 1);
  await pause(s);
  assert.deepEqual(said().slice(-2), [ZATRAB, GOTOWE]);
  await toots(s, 1);
  await choice(s, 'done').userData.onTap();
  await first;
  assert.equal(s.answers[0].answerOnScreen, true);
  assert.equal(demoSeen('port.together'), true);

  const next = spoken();
  const second = s.round(1);
  await until(() => next().includes(ZATRAB));
  assert.equal(s.mode, 'alone');
  assert.deepEqual(next(), [...T.portName(s.word), ZATRAB], 'the name, then one thing to do');
  assert.ok(s.boats[0].userData.board.userData.blocks.every((b) => !b.visible));
  await toots(s, s.target);
  await choice(s, 'done').userData.onTap();
  await second;
  assert.equal(s.answers[1].answerOnScreen, undefined);
  const skills = {};
  for (const answer of s.answers) applyEvent(skills, answer);
  assert.deepEqual([skills.syllables.MEWA.solved, skills.syllables.MEWA.attempts, skills.syllables.MEWA.mastery], [1, 0, 0], 'the guided boat is solved and leaves the name new');
  assert.equal(skills.syllables[s.answers[1].item].attempts, 1, 'her own boat counts');
  stop(s);
});

test('a save that has seen the demo opens level 2 with a boat that asks one thing, no clap', async () => {
  const s = await scene(2);
  s.pick = () => 'FOKA';
  const said = spoken();
  const round = s.round(0);
  await until(() => said().includes(ZATRAB));
  assert.deepEqual(said(), ['W porcie łódki odpoczywają. Każda łódka ma imię.', 'Ta łódka nazywa się Foka.', ZATRAB]);
  assert.equal(s.mode, 'alone');
  await toots(s, 2);
  await choice(s, 'done').userData.onTap();
  await round;
  stop(s);
});

test('the demo is in the save: a reloaded game knows it, a save from before it does not', async () => {
  resetProgress();
  markDemoSeen('port.together');
  const raw = JSON.parse(saved.get('pup-patrol-progress'));
  assert.deepEqual(raw.demos, ['port.together']);
  const reloaded = await import('../src/progress.js?reloaded');
  assert.equal(reloaded.demoSeen('port.together'), true);
  delete raw.demos;
  saved.set('pup-patrol-progress', JSON.stringify(raw));
  const older = await import('../src/progress.js?older');
  assert.equal(older.demoSeen('port.together'), false);
  saved.set('pup-patrol-progress', JSON.stringify({ ...raw, demos: 'broken' }));
  const broken = await import('../src/progress.js?broken');
  assert.equal(broken.demoSeen('port.together'), false);
  broken.markDemoSeen('port.together');
  assert.equal(broken.demoSeen('port.together'), true);
});

test('level 2 on a fresh save is one guided boat and three of her own, four paws', async () => {
  const s = await scene(2, { demo: false });
  CONFIG.level = 2;
  s.pick = (skill, pool) => pool[0];
  s.enter(); s.collect(); optimizeScene(s.scene);
  for (let step = 0; step < 800 && !globalThis.__celebration; step++) {
    if (s.phase === 'asking') {
      if (s.count < s.target) await choice(s, 'horn').userData.onTap();
      else if (choice(s, 'done')) await choice(s, 'done').userData.onTap();
    }
    s.update(0.05, step * 0.05);
    await flush();
  }
  assert.ok(globalThis.__celebration, 'the run ended');
  assert.deepEqual(globalThis.__progress, [1, 2, 3, 4]);
  assert.deepEqual(s.answers.map((a) => Boolean(a.answerOnScreen)), [true, false, false, false]);
  assert.equal(scoreRun(s.answers).scored, 4);
  stop(s); CONFIG.level = null;
});

test('the confirm line follows her first toot after a pause, whatever the count, and once', async () => {
  for (const made of [1, 2, 3]) { // (FOKA has two pieces: too few, right, too many)
    const s = await scene(2);
    s.pick = () => 'FOKA';
    const said = spoken();
    const round = s.round(0);
    await until(() => said().includes(ZATRAB));
    await pause(s);
    assert.ok(!said().includes(GOTOWE), 'nothing to confirm before a toot');
    await toots(s, made);
    s.update(0.05, 0); await flush();
    assert.ok(!said().includes(GOTOWE), `${made} toots: not in the middle of tooting`);
    await pause(s);
    assert.equal(said().filter((l) => l === GOTOWE).length, 1, `${made} toots: the confirm comes after the pause`);
    assert.equal(said().at(-1), GOTOWE);
    assert.equal(s.step, 'confirm');
    await toots(s, 1);
    await pause(s);
    assert.equal(said().filter((l) => l === GOTOWE).length, 1, 'once');
    s.alive = false; s.resolveRound?.(); await round; s.exit();
  }
});

test('a boat touched as soon as she has tooted needs no confirm', async () => {
  const s = await scene(2);
  s.pick = () => 'FOKA';
  const said = spoken();
  const round = s.round(0);
  await until(() => said().includes(ZATRAB));
  await toots(s, 2);
  s.update(0.05, 0); await flush();
  await choice(s, 'done').userData.onTap();
  s.update(0.05, 0); await flush();
  await round;
  assert.ok(!said().includes(GOTOWE));
  stop(s);
});

test('a wrong count says no, keeps the boat, clears her marks, and she toots again with the confirm after her first toot', async () => {
  const s = await scene(2);
  s.pick = () => 'FOKA';
  const said = spoken();
  const round = s.round(0);
  await until(() => said().includes(ZATRAB));
  const boat = s.boats[0];
  await toots(s, 3);
  assert.equal(dots(s), 3);
  await pause(s);
  const again = spoken();
  await choice(s, 'done').userData.onTap();
  await until(() => again().includes(ZATRAB) && s.phase === 'asking');
  assert.deepEqual(again(), ['Za dużo! Posłuchaj jeszcze raz.', ...T.portName('FOKA'), ZATRAB], 'no, then the question again');
  assert.equal(s.boats[0], boat, 'the same boat');
  assert.equal(s.count, 0);
  assert.equal(dots(s), 0);
  assert.equal(s.answers.length, 0);
  assert.equal(s.step, 'toot');
  const replayed = spoken();
  globalThis.__bubble.onTap();
  await flush();
  assert.deepEqual(replayed(), [...T.portName('FOKA'), ZATRAB], 'she has not tooted since the no: the replay has no confirm');
  await toots(s, 1);
  await pause(s);
  assert.equal(again().at(-1), GOTOWE);
  await toots(s, 1);
  await choice(s, 'done').userData.onTap();
  await round;
  assert.equal(s.answers[0].firstTry, false);
  stop(s);
});

test('her toot marks stay through a replay of the question', async () => {
  const s = await scene(2);
  s.pick = () => 'FOKA';
  const said = spoken();
  const round = s.round(0);
  await until(() => said().includes(ZATRAB));
  await toots(s, 2);
  const before = said().length;
  globalThis.__bubble.onTap();
  await flush();
  assert.deepEqual(said().slice(before), [...T.portName('FOKA'), ZATRAB], 'the question again');
  assert.equal(s.count, 2);
  assert.equal(dots(s), 2, 'both marks are still on the boat');
  await pause(s);
  const confirmed = said().length;
  globalThis.__bubble.onTap();
  await flush();
  assert.deepEqual(said().slice(confirmed), [...T.portName('FOKA'), ZATRAB, GOTOWE], 'once confirmed, a replay says all of it');
  assert.equal(dots(s), 2);
  assert.equal(s.learn.current.wrong, 0, 'a replay is not a wrong answer');
  await choice(s, 'done').userData.onTap();
  await round;
  assert.equal(s.answers[0].firstTry, true);
  stop(s);

  const t = await scene(1);
  t.pick = () => 'MEWA';
  const together = t.round(0);
  await until(() => t.phase === 'asking' && globalThis.__lines.at(-1) === ZATRAB);
  await toots(t, 1);
  globalThis.__bubble.onTap();
  await flush();
  assert.equal(lit(t), 1, 'the piece she lit stays lit');
  await toots(t, 1);
  await choice(t, 'done').userData.onTap();
  await together;
  stop(t);
});

test('the next boat starts clean: no marks, no confirm said, the steps from the top', async () => {
  const s = await scene(2);
  const names = ['FOKA', 'MEWA'];
  s.pick = () => names.shift();
  const first = s.round(0);
  await until(() => s.phase === 'asking' && s.step === 'toot');
  await toots(s, 2);
  await pause(s);
  assert.equal(s.step, 'confirm');
  await choice(s, 'done').userData.onTap();
  await first;
  assert.equal(s.step, null);
  assert.equal(s.count, 0);
  const said = spoken();
  const second = s.round(1);
  await until(() => said().includes(ZATRAB));
  assert.equal(s.word, 'MEWA');
  assert.equal(s.step, 'toot');
  assert.equal(s.count, 0);
  assert.equal(dots(s), 0);
  assert.equal(lit(s), 0);
  await pause(s);
  assert.ok(!said().includes(GOTOWE), 'the confirm waits for her first toot on this boat');
  s.alive = false; s.resolveRound?.(); await second; s.exit();
});

/** Let held lines go until done(), which turns true with the line that made it so still held. */
const letGoUntil = async (release, done) => { for (let i = 0; i < 400 && !done(); i++) { release(); await flush(); } };
const letGo = async (release) => { for (let i = 0; i < 10; i++) { release(); await flush(); } };

test('a demo she has seen ends at her first toot: the rest of the clap and the question are not said', async () => {
  const s = await scene(1);
  s.pick = () => 'MEWA';
  const release = holdLines(s), said = spoken();
  const round = s.round(0);
  await letGoUntil(release, () => said().includes('Me!'));
  assert.equal(s.step, 'demo');
  await toots(s, 1);
  assert.equal(s.step, 'toot', 'her toot ends the demo');
  await letGo(release);
  assert.ok(!said().includes('Wa!'), 'the rest of the clap is not said');
  assert.ok(!said().includes(ZATRAB), 'she is already tooting: no question');
  assert.equal(lit(s), 1);
  await pause(s);
  assert.equal(said().at(-1), GOTOWE);
  await toots(s, 1);
  await choice(s, 'done').userData.onTap();
  await letGo(release);
  await round;
  stop(s);
});

test('the first demo plays through even if she toots along, and counts as seen once she has solved the boat', async () => {
  const s = await scene(1, { demo: false });
  s.pick = () => 'MEWA';
  const release = holdLines(s), said = spoken();
  const round = s.round(0);
  await letGoUntil(release, () => said().includes('Me!'));
  await toots(s, 1);
  assert.equal(s.step, 'demo', 'a demo she has not seen goes on');
  await letGo(release);
  assert.deepEqual(said().slice(-2), ['Me!', 'Wa!']);
  assert.ok(!said().includes(ZATRAB), 'she tooted along: no question after the clap');
  assert.equal(s.step, 'toot');
  assert.equal(lit(s), 1, 'the piece she lit is lit again after the clap');
  assert.equal(demoSeen('port.together'), false, 'not before she has solved the boat');
  await pause(s);
  assert.equal(said().at(-1), GOTOWE);
  await toots(s, 1);
  await choice(s, 'done').userData.onTap();
  await letGo(release);
  await round;
  assert.equal(demoSeen('port.together'), true);
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
  const skills = {};
  applyEvent(skills, s.answers[0]);
  const card = sectionReports(skills, 'syllables', SYLLABLE_ITEMS).find((r) => r.seen);
  assert.deepEqual([card?.item, card?.rows[0].solved], ['2', 1], 'the grown-ups\' page has a row for it');
});

test('which: the ticks come with the question; a tap on a boat during the names says its name, then the question comes', async () => {
  const s = await scene(3);
  s.pick = () => 2;
  const held = [], say = s.say.bind(s);
  s.say = (segments) => { say(segments); return new Promise((resolve) => held.push(resolve)); }; // (each line plays until let go)
  const round = s.round(0);
  const naming = () => s.phase === 'choosing' && /^\p{Lu}\p{Ll}+!$/u.test(globalThis.__lines.at(-1));
  await until(() => naming() || (held.splice(0).forEach((go) => go()), false)); // (the start line plays; the first name holds)
  assert.ok(s.tickButtons.every((t) => !t.visible), 'nothing to answer before the question');
  const before = globalThis.__lines.length;
  await s.boats.at(-1).userData.onTap();
  held.splice(0).forEach((go) => go());
  await until(() => globalThis.__lines.at(-1) === 'Która łódka ma dwa kawałki?');
  held.splice(0).forEach((go) => go());
  const said = globalThis.__lines.slice(before);
  assert.equal(said.length, 2, `the tapped boat's name, then the question: ${said}`);
  assert.ok(s.tickButtons.every((t) => t.visible), 'the ticks came with the question');
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
