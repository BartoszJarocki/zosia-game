import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

const noop = () => {};
globalThis.window = { addEventListener: noop, removeEventListener: noop, innerWidth: 1180, innerHeight: 820 };
globalThis.innerWidth = 1180;
globalThis.innerHeight = 820;
globalThis.location = { search: '' };
globalThis.document = {
  addEventListener: noop, removeEventListener: noop, hidden: false,
  getElementById: () => ({ classList: { add: noop, remove: noop, toggle: noop } }),
  createElement() {
    const canvas = { width: 0, height: 0 };
    const ctx = new Proxy({ canvas, createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 30 }) },
      { get: (o, k) => k in o ? o[k] : noop });
    canvas.getContext = () => ctx;
    return canvas;
  },
};
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
    export const renderer = { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1180, height: 820 }) }, info: { autoReset: true, render: { calls: 0 }, reset() {} } };
    export const post = { tier: 'medium' };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x, in: (x) => x, back: (x) => x, bounce: (x) => x };
    export const animate = async (ms, fn) => { fn(1); };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
    export const shakeNo = () => {};
    export function addSkyAndLights(scene) {
      scene.background = new THREE.Color('#cfeeff');
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.ShaderMaterial({ uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } } })));
      scene.add(new THREE.HemisphereLight(), new THREE.DirectionalLight(), new THREE.DirectionalLight());
    }
    ${stage}`;
  if (url.endsWith('/src/world/portrait.js')) source = `export const portrait = () => ({ texture: null, dispose: () => {} });`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push(...[s].flat()); };
    export const hush = () => {}; export const unlockAudio = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `
    export const badges = { get: () => ({}), add: (kind) => ({ [kind]: 1 }) };
    export const missionHud = noop; export const hideBubble = noop; export const nudgeBubble = noop;
    export const setProgress = noop; export const setRounds = noop; export const celebrate = noop; export const confetti = noop;
    export const bubble = (options) => { globalThis.__bubble = options; };
    export const spaceHud = noop; export const boatHud = noop; export const launchHud = () => ({ number: noop, start: noop, remove: noop });
    export const MISSIONS = {};
    function noop() {}`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { Hub } = await import('../src/scenes/hub.js');
const { LettersMission } = await import('../src/scenes/letters.js');
const { startSession, getSession, missionDone, dev } = await import('../src/session/session.js');
const { noteEvent, windDown, ending, nextStep } = await import('../src/session/director.js');
const { getSessions } = await import('../src/progress.js');
const { T } = await import('../src/lang/pl.js');

const flush = () => new Promise(setImmediate);
const until = async (predicate, what) => {
  for (let i = 0; i < 2000; i++) { if (predicate()) return; await flush(); }
  assert.fail(`never happened: ${what}`);
};
const game = () => ({ opened: [], hub() {}, home() {}, startMission(kind) { this.opened.push(kind); }, map(area) { this.opened.push(area); } });
const stages = [];
const open = (s) => { stages.push(s); s.enter(); return s; };
afterEach(() => { for (const s of stages.splice(0)) { s.alive = false; s.exit(); } globalThis.__lines.length = 0; });

test('after the goodnight, a tap on a place wakes Chase and opens it in a new session', async () => {
  startSession();
  missionDone('letters');
  windDown(getSession());
  const g = game();
  const hub = open(new Hub(g));
  await until(() => hub.asleep, 'the island falls asleep after the goodnight');
  const before = getSessions().count;
  globalThis.__lines.length = 0;

  hub.markers.counting.marker.userData.onTap();
  await until(() => g.opened.length, 'the tapped place opens');

  assert.deepEqual(g.opened, ['counting']);
  assert.deepEqual(globalThis.__lines, T.go('counting'), 'Chase wakes and goes, he does not say he is asleep');
  assert.equal(ending(getSession()), null, 'no goodnight waits in the new session');
  assert.equal(nextStep(getSession()), 'mission', 'the hub suggests places again');
  missionDone('counting');
  assert.equal(getSessions().count, before + 1);
});

test('after a tap on Chase on the island, the invitation comes again', async () => {
  startSession();
  dev.suggestOnce = 'counting';
  const hub = open(new Hub(game()));
  const invite = [...T.suggest('counting'), ...T.tapStar()];
  assert.deepEqual(globalThis.__lines.slice(-2), invite, 'the hub invites her on arrival');
  globalThis.__lines.length = 0;

  hub.pup.userData.onTap();

  assert.ok(T.tapPup().includes(globalThis.__lines[0]), globalThis.__lines[0]);
  assert.deepEqual(globalThis.__lines.slice(1), invite);
});

const QUICK = { correct: true, latencyMs: 1500, assistLevel: 0 };
const LOST = [{ correct: false, errorType: 'timeout' }, { correct: false, errorType: 'overTap' }, { correct: false, errorType: 'overTap' }, { correct: true, latencyMs: 6000, assistLevel: 3 }];

test('"Jeszcze tylko jedno!" comes once a session: "again" after it plays the whole mission', async () => {
  startSession();
  for (let i = 0; i < 4; i++) noteEvent(getSession(), { mission: 'letters', ...QUICK });
  for (let i = 0; i < 5; i++) for (const ev of LOST) noteEvent(getSession(), { mission: 'letters', ...ev });

  const first = new LettersMission(game(), 'letters');
  first.rounds = 4;
  await first.checkAttention(0);
  assert.deepEqual(globalThis.__lines, T.oneMore());
  assert.equal(first.rounds, 2, 'the next round is the last');
  globalThis.__lines.length = 0;

  const again = new LettersMission(game(), 'letters');
  again.rounds = 4;
  await again.checkAttention(0);
  assert.deepEqual(globalThis.__lines, []);
  assert.equal(again.rounds, 4);
});

test('a tap on the bubble repeats an open question, and after the answer does nothing', async () => {
  startSession();
  const kitty = open(new LettersMission(game(), 'letters'));
  const asked = async () => {
    await until(() => kitty.learn.current && globalThis.__bubble, 'Kitty Park asks');
    await until(() => kitty.prompt.length, 'the question is spoken');
  };
  const answer = async () => {
    const q = kitty.learn.current;
    kitty.tappables.find((o) => o.userData.letter === q.item).userData.onTap();
    await until(() => kitty.learn.current !== q, 'the answer is taken');
  };

  await asked();
  globalThis.__lines.length = 0;
  globalThis.__bubble.onTap();
  assert.deepEqual(globalThis.__lines, kitty.prompt, 'the open question is said again');
  await answer();
  const praise = globalThis.__lines.length;
  globalThis.__bubble.onTap();
  assert.equal(globalThis.__lines.length, praise, 'nothing is said over the praise');
  await asked();
  await answer();

  const [first, second] = getSession().recentQuestions;
  assert.equal(first.replays, 1);
  assert.equal(second.replays, 0, 'the tap after the answer is not a replay');
});
