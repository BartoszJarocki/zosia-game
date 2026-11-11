import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

const noop = () => {};
globalThis.window = { addEventListener: noop, removeEventListener: noop };
globalThis.location = { search: '' };
globalThis.innerWidth = 1180;
globalThis.innerHeight = 820;
globalThis.document = { createElement() {
  const canvas = { width: 0, height: 0 };
  const context = new Proxy({ canvas, createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 30 }) }, { get: (o, k) => k in o ? o[k] : noop });
  canvas.getContext = () => context;
  return canvas;
} };
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
globalThis.__starLines = [];

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = { linear: t => t, out: t => t, in: t => t, inOut: t => t };
    export const animate = async (ms, fn) => { for (let i = 0; i <= 20; i++) fn(i / 20); };
    export const wait = async () => {};
    export const hop = async () => {};
    export const addSkyAndLights = () => {};
    export const shakeNo = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async s => { globalThis.__starLines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}), add: kind => ({ [kind]: 1 }) };
    export const bubble = () => {}; export const hideBubble = () => {}; export const setProgress = () => {};
    export const setRounds = () => {}; export const nudgeBubble = () => {};
    export const missionHud = opts => { globalThis.__starHud = opts; };
    export const celebrate = opts => { globalThis.__starCelebration = opts; };`;
  if (url.endsWith('/src/session/session.js')) source = `export const checkAttention = () => 'ok';
    export const replayed = () => {}; export const missionDone = kind => ({ finale: false });`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { StarsMission } = await import('../src/scenes/stars.js');
const { LEVELS } = await import('../src/levels/data.js');
const { PICTURES } = await import('../src/levels/stars.js');
const { T } = await import('../src/lang/pl.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const flush = () => new Promise(setImmediate);

function build(level = 1) {
  const s = new StarsMission({ home() {}, startMission() {} });
  s.L = LEVELS.stars[level - 1];
  s.rounds = s.L.rounds;
  s.build();
  optimizeScene(s.scene);
  return s;
}

test('every star is a walker hook with userData.num, and this.last is the next number', async () => {
  const s = build();
  for (const count of [3, 4, 5, 6, 7]) {
    s.makePicture(count);
    assert.equal(s.stars.length, count);
    assert.deepEqual(s.stars.map((o) => o.userData.num), Array.from({ length: count }, (_, i) => i + 1));
    assert.deepEqual(s.stars.map((o) => [o.position.x, o.position.y]), PICTURES[count].points.map(([x, y]) => [x * 1.25, y * 1.25]));
    assert.deepEqual(s.tappables.map((o) => o.userData.num).sort((a, b) => a - b), Array.from({ length: count - 1 }, (_, i) => i + 2));
    s.askNumber(2);
    assert.equal(s.last, 2);
    assert.equal(globalThis.__starLines.at(-1), 'Jeden, a co dalej?');
    s.stopIdle();
    s.clearPicture();
  }
  s.alive = false; s.exit();
});

test('the picture name is spoken after the last star, and the mission has its own done line', async () => {
  const s = build();
  for (const count of [3, 4, 5, 6, 7]) {
    s.makePicture(count);
    s.phase = 'choosing';
    for (let n = 2; n <= count; n++) {
      s.last = n;
      s.phase = 'choosing';
      await s.tapStar(s.stars[n - 1]);
    }
    await s.finishPicture();
    assert.equal(globalThis.__starLines.at(-1), T.starsPicture(PICTURES[count].id)[0]);
    s.clearPicture();
  }
  assert.deepEqual(s.doneLine(), ['Brawo! Gwiazdy świecą obrazki!']);
  s.alive = false; s.exit();
});

test('a wrong star never scores or draws, gets a "no", and the right star is not shown', async () => {
  const s = build(1);
  s.plan = [3];
  s.makePicture(3);
  s.phase = 'choosing';
  s.last = 2;
  s.question('sequence', 2, {}, { options: 2 });
  const wrong = s.stars[2], right = s.stars[1];
  await s.tapStar(wrong);
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  assert.equal(s.lines.length, 0);
  assert.match(globalThis.__starLines.at(-1), /^Nie/);
  await flush();
  assert.ok(!right.userData.hinting);
  assert.equal(s.aid.state.level, 1, 'help is at "try again"');
  assert.ok(s.learn.current.assist <= 1);
  await s.tapStar(right);
  assert.equal(s.answers.length, 1);
  assert.equal(s.answers[0].skill, 'sequence');
  assert.equal(s.answers[0].item, '2');
  assert.equal(s.answers[0].scored, true);
  assert.deepEqual(scoreRun(s.answers), { scored: 1, clean: 0 });
  s.alive = false; s.exit();
});

test('Star Pictures has no shadows or point lights and stays under the medium draw budget', async () => {
  const s = build(4);
  s.makePicture(7);
  let draws = 0, shadows = 0, pointLights = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene draws`);
  s.alive = false; s.exit();
});
