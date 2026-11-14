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
    export const bubble = opts => { globalThis.__starBubble = opts; }; export const hideBubble = () => {}; export const setProgress = () => {};
    export const setRounds = () => {}; export const nudgeBubble = () => {};
    export const missionHud = opts => { globalThis.__starHud = opts; };
    export const celebrate = opts => { globalThis.__starCelebration = opts; };`;
  if (url.endsWith('/src/session/session.js')) source = `export const checkAttention = () => 'ok';
    export const replayed = () => {}; export const missionDone = kind => ({ finale: false });`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { StarsMission } = await import('../src/scenes/stars.js');
const { LEVELS } = await import('../src/levels/data.js');
const { PICTURES, ORDERS, numerals } = await import('../src/levels/stars.js');
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
const starTaps = (s) => s.tappables.filter((o) => o.userData.num !== undefined);

test('every star is a walker hook with userData.num, and this.last is the next number', async () => {
  const s = build();
  for (const count of [3, 4, 5, 6, 7]) {
    s.makePicture(count);
    assert.equal(s.stars.length, count);
    assert.deepEqual(s.stars.map((o) => o.userData.num), Array.from({ length: count }, (_, i) => i + 1));
    assert.deepEqual(s.stars.map((o) => [o.position.x, o.position.y]), PICTURES[count].points.map(([x, y]) => [x * 1.25, y * 1.25]));
    assert.deepEqual(starTaps(s).map((o) => o.userData.num).sort((a, b) => a - b), Array.from({ length: count - 1 }, (_, i) => i + 2));
    s.askStep(1);
    assert.equal(s.last, 2);
    assert.equal(globalThis.__starLines.at(-1), 'Jeden, a co dalej?');
    s.stopIdle();
    s.clearPicture();
  }
  s.alive = false; s.exit();
});

test('a countdown puts the biggest numeral on the first star, counting by twos puts 2 there, and this.last follows', async () => {
  for (const [level, order, count, first, asked] of [[5, 'down', 5, 5, 4], [6, 'twos', 4, 2, 4]]) {
    const s = build(level);
    assert.equal(s.L.order, order);
    s.makePicture(count);
    assert.deepEqual(s.stars.map((o) => o.userData.num), numerals(order, count));
    assert.equal(s.stars[0].userData.lit, true);
    assert.equal(s.stars[0].userData.num, first);
    globalThis.__starLines.length = 0;
    s.askStep(1);
    await flush();
    assert.equal(s.last, asked);
    assert.deepEqual(globalThis.__starLines, [...T.starsRule(order), ...T.starsAsk([first], order)]);
    s.stopIdle();
    s.alive = false; s.exit();
  }
});

test('the rule is said with the first question of a picture, and the questions after it are just the numbers so far', async () => {
  const s = build(5);
  s.makePicture(4);
  s.askStep(1);
  await flush();
  assert.deepEqual(globalThis.__starLines.slice(-3), ['Liczymy od tyłu!', 'Cztery!', 'A dalej?']);
  await s.tapStar(s.stars[1]);
  globalThis.__starLines.length = 0;
  s.askStep(2);
  await flush();
  assert.deepEqual(globalThis.__starLines, ['Cztery!', 'Trzy!', 'A dalej?']);
  s.stopIdle();
  s.alive = false; s.exit();
});

test('the bubble shows the numbers so far and a question mark, never the number asked, in every order', async () => {
  for (const level of [1, 4, 5, 6]) {
    const s = build(level);
    const [, hi] = s.L.stars;
    s.makePicture(hi);
    const seq = numerals(s.L.order, hi);
    s.phase = 'choosing';
    for (let i = 1; i < hi; i++) {
      s.askStep(i);
      const shown = globalThis.__starBubble;
      assert.equal(shown.big ?? '', '');
      assert.equal(shown.dots ?? 0, 0);
      const numbers = shown.seq[0].split(/\s+/).filter((w) => /^\d+$/.test(w)).map(Number);
      assert.deepEqual(numbers, seq.slice(Math.max(0, i - 3), i), `${s.L.order} step ${i}`);
      assert.ok(!numbers.includes(seq[i]), `${seq[i]} is the answer`);
      assert.equal(shown.seq.length, 1, 'the arrow and the question mark are the bubble\'s own');
      s.stopIdle();
      await s.tapStar(s.stars[i]);
      s.phase = 'choosing';
    }
    s.alive = false; s.exit();
  }
});

test('the numeral tile is a tap too, at least 0.9 wide, and clear of the other stars', async () => {
  const s = build(4);
  for (const count of [3, 4, 5, 6, 7]) {
    s.makePicture(count);
    s.phase = 'choosing';
    const labels = s.stars.map((o) => o.userData.label);
    labels.forEach((label, i) => {
      assert.ok(label.geometry.parameters.width >= 0.9, 'a tile of 0.9 or more');
      s.stars.forEach((other, j) => {
        if (i === j) return;
        const dx = Math.max(Math.abs(label.position.x - other.position.x) - label.geometry.parameters.width / 2, 0);
        const dy = Math.max(Math.abs(label.position.y - other.position.y) - label.geometry.parameters.height / 2, 0);
        assert.ok(Math.hypot(dx, dy) >= 0.55, `${PICTURES[count].id}: the tile of star ${i + 1} covers part of star ${j + 1}`);
      });
      labels.forEach((tile, j) => {
        if (j > i) assert.ok(Math.abs(label.position.x - tile.position.x) >= 0.95 || Math.abs(label.position.y - tile.position.y) >= 0.95, `${PICTURES[count].id}: tiles ${i + 1} and ${j + 1} overlap`);
      });
    });
    assert.equal(s.tappables.filter((o) => labels.includes(o)).length, count - 1, 'every unlit star has a tile to tap');
    s.last = 2;
    s.question('sequence', 2, {}, { options: count - 1 });
    await labels[1].userData.onTap();
    assert.equal(s.answers.length, 1, 'tapping the tile joins star 2');
    assert.equal(s.stars[1].userData.lit, true);
    assert.ok(!s.tappables.includes(labels[1]) && !s.tappables.includes(s.stars[1]), 'a lit star and its tile stop being taps');
    s.clearPicture();
    s.answers.length = 0;
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
  assert.deepEqual(s.doneLine(), ['Brawo! Ułożyłaś obrazki z gwiazd!']);
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
