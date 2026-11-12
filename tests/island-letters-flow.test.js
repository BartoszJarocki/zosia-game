import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

// The island's letter places (docs/design/g5a-*.md): Kitty Park and Balloon Hill show the letter only in a `match`
// row, a drag of the Pup Delivery parcel posts only when the parcel is over a mailbox, a wrong Name Train says whose
// it is, and the next letter is asked while the last block is still in the air.

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
}, querySelector: () => null, querySelectorAll: () => [] };
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
globalThis.__lines = [];
globalThis.__held = null; // a promise: every animation waits for it (a block in the air)

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = new Proxy({}, { get: () => (x) => x });
    export const animate = async (ms, fn) => { if (globalThis.__held) await globalThis.__held; for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t); };
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
    export const missionHud = () => {};
    export const bubble = (options) => { globalThis.__bubble = options; };
    export const hideBubble = () => {};
    export const nudgeBubble = () => {};
    export const setProgress = () => {};
    export const setRounds = () => {};
    export const celebrate = () => {};`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const THREE = await import('three');
const { CONFIG } = await import('../src/config.js');
const { T } = await import('../src/lang/pl.js');
const { camera } = await import('../src/engine.js');
const { learning } = await import('../src/learning/events.js');
const { LEVELS } = await import('../src/levels/data.js');
const { LettersMission } = await import('../src/scenes/letters.js');
const { BalloonsMission } = await import('../src/scenes/balloons.js');
const { DeliveryMission } = await import('../src/scenes/delivery.js');
const { NameMission } = await import('../src/scenes/name.js');

const flush = () => new Promise(setImmediate);
let clock = 0;
const until = async (s, predicate, what) => {
  for (let i = 0; i < 400; i++) { if (predicate()) return; s.update(0.05, (clock += 0.05)); await flush(); }
  assert.fail(`never reached: ${what}`);
};
const tap = (o) => o.userData.onTap(o);
const make = async (Scene, level, setup = () => {}) => {
  CONFIG.level = level;
  const s = Scene.prototype ? new Scene({ home() {}, startMission() {} }) : Scene({ home() {}, startMission() {} });
  s.pick = (skill, pool) => pool[0];
  setup(s);
  s.build(); s.collect();
  await s.landed;
  return s;
};
/** A few turns of the event loop: whatever was going to settle without waiting for the held hop has settled. */
const sooner = async () => { for (let i = 0; i < 8; i++) await flush(); return 'still waiting'; };
const stop = (s) => { s.alive = false; s.exit?.(); };
const events = () => { const got = []; const off = learning.subscribe((e) => got.push(e)); return { got, off }; };

test('Kitty Park: only the first level shows the letter in the bubble; the others hold a picture and the voice names it', async () => {
  for (let level = 1; level <= LEVELS.letters.length; level++) {
    const row = LEVELS.letters[level - 1];
    const s = await make(LettersMission, level);
    globalThis.__lines = [];
    s.round(0);
    await until(s, () => s.learn.current && s.prompt?.length, `level ${level} asked`);
    const shown = globalThis.__bubble.big === s.last;
    assert.equal(shown, level === 1, `level ${level} (${row.ask}): the letter in the bubble`);
    assert.equal(s.learn.current.skill, { match: 'letterVisual', audio: 'letterAudio', word: 'letterAudio', sound: 'letterSound' }[row.ask], `level ${level} credits the skill it asks`);
    stop(s);
  }
});

test('Kitty Park: a gentler run shows the letter and names it (the help of a rough run)', async () => {
  for (const level of [2, 3, 7]) {
    const s = await make(LettersMission, level, (x) => { x.L = { ...x.L, assist: true, ask: 'name' }; });
    s.round(0);
    await until(s, () => s.learn.current && s.prompt?.length, 'asked');
    assert.equal(globalThis.__bubble.big, s.last, `level ${level}: the letter is shown again`);
    assert.equal(s.learn.current.skill, 'letterVisual');
    stop(s);
  }
});

test('Balloon Hill: the first two levels show the letter, the rest ask by name and credit the name', async () => {
  for (let level = 1; level <= LEVELS.balloons.length; level++) {
    const row = LEVELS.balloons[level - 1];
    const s = await make(BalloonsMission, level);
    s.round(0);
    await until(s, () => s.learn.current && s.balloons.length === row.total, `level ${level} balloons`);
    assert.equal(globalThis.__bubble.big === s.last, level <= 2, `level ${level} (${row.ask}): the letter in the bubble`);
    assert.equal(s.learn.current.skill, row.ask === 'match' ? 'letterVisual' : 'letterAudio');
    stop(s);
  }
});

test('Balloon Hill: after the last right balloon the others drift up, and one she taps pops for nothing', async () => {
  const s = await make(BalloonsMission, 3);
  const { got, off } = events();
  const round = s.round(0);
  await until(s, () => s.balloons.length === s.L.total, 'balloons');
  const target = s.last;
  const right = () => s.balloons.filter((b) => b.userData.letter === target);
  while (right().length > 1) await tap(right()[0]);
  globalThis.__held = new Promise((release) => { globalThis.__release = release; }); // (the drift takes its time)
  const lastTap = tap(right()[0]);
  await sooner();
  assert.equal(s.answers.length, s.L.targets, 'the last right balloon counted');
  const leftover = s.tappables.filter((o) => o.userData.letter && o.parent);
  assert.equal(leftover.length, s.L.total - s.L.targets, 'every wrong balloon is still there, and can be tapped');
  const before = got.length, answers = s.answers.length;
  await tap(leftover[0]);
  assert.equal(leftover[0].parent, null, 'the balloon popped');
  assert.equal(got.length, before, 'popping it logs nothing: no answer, no mistake');
  assert.equal(s.answers.length, answers);
  assert.equal(leftover[0].userData.onTap, undefined, 'and cannot be tapped again');
  globalThis.__held = null;
  globalThis.__release();
  await lastTap;
  await round;
  assert.equal(s.tappables.filter((o) => o.userData.letter).length, 0, 'none is left to tap once they have drifted away');
  off();
  stop(s);
});

test('Balloon Hill: help on a named level shows the letter in the bubble, as a clue', async () => {
  const s = await make(BalloonsMission, 4);
  s.round(0);
  await until(s, () => s.aid && s.balloons.length === s.L.total, 'balloons');
  assert.notEqual(globalThis.__bubble.big, s.last);
  for (const seconds of [6, 10, 17]) {
    s.speaking = false;
    s.aid.quietFrom = performance.now() - seconds * 1000 - 1;
    s.tickAssist();
    await flush();
    if (seconds < 17) assert.notEqual(globalThis.__bubble.big, s.last, `after ${seconds} s the letter is still hidden`);
  }
  assert.equal(globalThis.__bubble.big, s.last, 'the clue shows the letter');
  stop(s);
});

/** Where a point of the world is on the screen, in pixels (the engine points the camera at the scene's view). */
function screenOf(v) {
  const p = v.clone().project(camera);
  return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
}
async function deliveryScene(level = 3) {
  const s = await make(DeliveryMission, level);
  camera.position.copy(s.view.pos);
  camera.lookAt(s.view.look);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  s.round(0);
  await until(s, () => s.learn.current && s.tappables.some((o) => o.userData.drag), 'the parcel');
  const parcel = s.tappables.find((o) => o.userData.drag);
  const boxes = s.tappables.filter((o) => o.userData.letter && !o.userData.drag);
  return { s, parcel, boxes };
}
/** Put the parcel where its middle is on the screen at (x, y), in front of the mailboxes. */
function holdAt(parcel, x, y) {
  const ndc = new THREE.Vector3((x / innerWidth) * 2 - 1, 1 - (y / innerHeight) * 2, 0.5).unproject(camera);
  const ray = ndc.sub(camera.position).normalize();
  const k = (1 - camera.position.z) / ray.z; // (the plane z = 1, in front of the mailboxes)
  parcel.position.copy(camera.position).addScaledVector(ray, k).sub(new THREE.Vector3(0, 0.7 * parcel.scale.y, 0));
}

test('Pup Delivery: a parcel lifted a little and let go posts nothing and floats back', async () => {
  const { s, parcel } = await deliveryScene();
  const { got, off } = events();
  const home = screenOf(new THREE.Vector3(0, 0.7 * parcel.scale.y, parcel.position.z)); // (where it waits, once it has dropped in)
  for (const lift of [20, 60, 100, 150, 180]) {
    holdAt(parcel, home.x, home.y - lift - 55); // (the parcel leaps about 55 px when it is picked up)
    assert.equal(parcel.userData.drag.onDrop(parcel), false, `${lift} px up: not accepted, so it floats back`);
  }
  assert.equal(got.length, 0, 'no answer and no mistake was logged');
  off();
  stop(s);
});

test('Pup Delivery: a parcel dropped over a mailbox is posted into that mailbox, right or wrong', async () => {
  const { s, parcel, boxes } = await deliveryScene();
  const { got, off } = events();
  const [right, wrong] = [boxes.find((b) => b.userData.letter === s.last), boxes.find((b) => b.userData.letter !== s.last)];
  const middle = (b) => screenOf(new THREE.Vector3(b.position.x, 1.9, b.position.z + 0.55));
  holdAt(parcel, middle(wrong).x, middle(wrong).y);
  assert.equal(parcel.userData.drag.onDrop(parcel), true, 'a wrong mailbox takes it, and says no');
  assert.equal(got.filter((e) => !e.correct).length, 1);
  assert.equal(s.learn.current?.item, s.last, 'the question is still hers');
  holdAt(parcel, middle(right).x, middle(right).y);
  assert.equal(parcel.userData.drag.onDrop(parcel), true);
  assert.equal(got.filter((e) => e.correct).length, 1);
  off();
  stop(s);
});

test('Name Train, whose train: a wrong train says whose it is, and the question comes again', async () => {
  const s = await make(NameMission, 3);
  globalThis.__lines = [];
  s.round(0);
  await until(s, () => s.aid && s.trains?.length === 3, 'trains');
  const asked = s.last;
  const wrong = s.trains.find((t) => t.userData.word !== asked && t.userData.onTap);
  const whose = s.L.whose[wrong.userData.word];
  globalThis.__lines = [];
  await tap(wrong);
  await flush();
  assert.deepEqual(globalThis.__lines.slice(0, 2), [...T.whoseIs(whose), ...T.whoseAsk(s.L.whose[asked])]);
  assert.equal(s.learn.current.skill, 'wordVisual', 'the question is still open');
  assert.ok(s.learn.current.assist <= 1, 'one wrong train shows nothing more');
  stop(s);
});

test('Name Train, whose train: a second wrong train is still told whose it is', async () => {
  const s = await make(NameMission, 3);
  s.round(0);
  await until(s, () => s.aid && s.trains?.length === 3, 'trains');
  const wrongs = s.trains.filter((t) => t.userData.word !== s.last && t.userData.onTap);
  await tap(wrongs[0]);
  globalThis.__lines = [];
  await tap(wrongs[1]);
  await flush();
  assert.ok(globalThis.__lines.some((l) => l === T.whoseIs(s.L.whose[wrongs[1].userData.word])[0]), `heard ${JSON.stringify(globalThis.__lines)}`);
  stop(s);
});

test('Name Train, whose train: a board with a thing on it (KOT, DOM) says its word', async () => {
  let found = null;
  for (let seed = 1; seed < 60 && !found; seed++) {
    let x = seed;
    const rng = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
    const random = Math.random;
    Math.random = rng;
    const s = await make(NameMission, 9);
    Math.random = random;
    s.round(0);
    await until(s, () => s.aid && s.trains?.length === 3, 'trains');
    const thing = s.trains.find((t) => !s.L.whose[t.userData.word] && t.userData.onTap);
    if (!thing) { stop(s); continue; }
    found = { s, thing };
  }
  assert.ok(found, 'a round with a KOT or DOM train among the three');
  globalThis.__lines = [];
  await tap(found.thing);
  await flush();
  assert.deepEqual(globalThis.__lines.slice(0, 1), T.spellWord(found.thing.userData.word));
  stop(found.s);
});

/** The block for the letter the train wants next, tapped. */
const tapNext = async (s) => {
  const letter = s.word[s.open()[0]];
  await tap(s.blocks.find((b) => b.userData.letter === letter && b.parent && b.userData.onTap));
};

test('Name Train: the next letter is asked, and counted, while the last block is still in the air', async () => {
  const s = await make(NameMission, 1);
  const round0 = s.round(0);
  await until(s, () => s.aid && s.blocks.some((b) => b.userData.onTap), 'blocks');
  globalThis.__held = new Promise((release) => { globalThis.__release = release; }); // every hop waits
  await tapNext(s);
  const first = await Promise.race([round0.then(() => 'the round ended'), sooner()]);
  assert.equal(first, 'the round ended', 'the first letter does not wait for its hop');
  assert.equal(s.placed.length, 1, 'the wagon is taken at the tap');
  assert.equal(s.open()[0], 1, 'the train now wants its second letter');
  const round1 = s.round(1);
  await until(s, () => s.learn.current?.item === s.word[1] && s.blocks.some((b) => b.userData.letter === s.word[1] && b.userData.onTap), 'the second question');
  await tapNext(s);
  assert.equal(s.answers.length, 2, 'the second letter counted before the first block landed');
  globalThis.__held = null;
  globalThis.__release();
  await round1;
  stop(s);
});

test('Name Train: the last letter waits for its block to land before the ending starts', async () => {
  const s = await make(NameMission, 1);
  const rounds = s.fill.length;
  for (let r = 0; r < rounds; r++) {
    const round = s.round(r);
    await until(s, () => s.aid && s.blocks.some((b) => b.userData.letter && b.userData.onTap), `round ${r}`);
    if (r === rounds - 1) {
      globalThis.__held = new Promise((release) => { globalThis.__release = release; });
      const tapped = tapNext(s);
      assert.equal(await Promise.race([round.then(() => 'the round ended'), sooner()]), 'still waiting', 'the word is not done while its last block is in the air');
      globalThis.__held = null;
      globalThis.__release();
      await tapped;
      await round;
    } else {
      await tapNext(s);
      await round;
    }
  }
  assert.equal(s.placed.filter((p) => p.mine).length, rounds);
  stop(s);
});
