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
globalThis.__moonLines = [];
globalThis.__moonJumps = [];
globalThis.__moonDone = [];
globalThis.__holdMoonJump = false;
const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = { linear: t => t, out: t => t, in: t => t, inOut: t => t };
    export const animate = async (ms, fn) => {
      if (ms === 400) { // (her jumps)
        globalThis.__moonJumps.push(ms);
        if (globalThis.__holdMoonJump) await new Promise(r => { globalThis.__landMoonJump = r; });
      }
      for (let i = 0; i <= 20; i++) fn(i / 20);
    };
    export const hop = () => { throw new Error('An uncounted hop on the Moon'); };
    export const wait = async () => {};
    export const addSkyAndLights = () => {};
    export const shakeNo = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async s => {
    const lines = [s].flat();
    globalThis.__moonLines.push(...lines);
    if (lines.includes(globalThis.__holdMoonLine)) await new Promise(r => { globalThis.__finishMoonLine = r; });
  }; export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `export const badges = { get: () => ({}), add: kind => ({ [kind]: 1 }) };
    export const bubble = () => {}; export const hideBubble = () => {}; export const setProgress = () => {};
    export const setRounds = () => {}; export const nudgeBubble = () => {};
    export const missionHud = opts => { globalThis.__moonHud = opts; };
    export const celebrate = opts => { globalThis.__moonCelebration = opts; globalThis.__moonScene.alive = false; };`;
  if (url.endsWith('/src/session/session.js')) source = `export const checkAttention = () => 'ok';
    export const replayed = () => {}; export const missionDone = kind => { globalThis.__moonDone.push(kind); return { finale: false }; };`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { MoonMission } = await import('../src/scenes/moon.js');
const { LEVELS } = await import('../src/levels/data.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const { T } = await import('../src/lang/pl.js');
const flush = () => new Promise(setImmediate);
const jumper = s => s.tappables.find(o => o.userData.jumper);
const flag = s => s.tappables.find(o => o.userData.done);
const prints = s => {
  const out = [];
  s.scene.traverse(o => { if (o.userData.footprint) out.push(o); });
  return out;
};

async function build(level = 1, count = 3) {
  const s = new MoonMission({ home() {}, startMission() {} });
  s.L = LEVELS.moon[level - 1];
  s.rounds = s.L.rounds;
  s.pick = () => count;
  s.build();
  await s.landed;
  optimizeScene(s.scene);
  return s;
}

test('her taps jump one after another: taps in the air are counted, and an automatic round stops at the number', async () => {
  const s = await build();
  const task = s.jumpRound(true);
  assert.equal(s.last, 3);
  assert.ok(jumper(s));
  assert.ok(flag(s));
  globalThis.__holdMoonJump = true;
  const jumpsBefore = globalThis.__moonJumps.length, linesBefore = globalThis.__moonLines.length;
  const taps = [1, 2, 3, 4].map(() => jumper(s).userData.onTap());
  assert.equal(prints(s).length, 0, 'a footprint pair only after landing');
  assert.equal(globalThis.__moonJumps.length, jumpsBefore + 1, 'one jump at a time');
  globalThis.__holdMoonJump = false;
  globalThis.__landMoonJump();
  await Promise.all(taps);
  await task;
  assert.equal(prints(s).length, 3, 'the fourth tap came after the round was done');
  assert.equal(globalThis.__moonJumps.length, jumpsBefore + 3);
  const numbers = ['Jeden!', 'Dwa!', 'Trzy!', 'Cztery!'];
  assert.deepEqual(globalThis.__moonLines.slice(linesBefore).filter((l) => numbers.includes(l)), ['Jeden!', 'Dwa!', 'Trzy!'], 'each landing counted, in order');
  assert.equal(s.answers.length, 1);
  assert.equal(s.answers[0].skill, 'counting');
  assert.equal(s.answers[0].item, '3');
  assert.equal(s.answers[0].scored, false);
  assert.deepEqual(scoreRun(s.answers), { scored: 0, clean: 0 });
  s.alive = false; s.exit();
});

test('manual jumps reject too few, fade extras and require another flag tap', async () => {
  const s = await build(3);
  const task = s.jumpRound(false);
  assert.equal(flag(s).visible, true);
  await jumper(s).userData.onTap();
  await flag(s).userData.onTap();
  assert.equal(globalThis.__moonLines.at(-1), 'Za mało! Skacz dalej!');
  assert.equal(s.answers.length, 0);
  await jumper(s).userData.onTap();
  await jumper(s).userData.onTap();
  await jumper(s).userData.onTap();
  assert.equal(prints(s).length, 4);
  await flag(s).userData.onTap();
  assert.equal(prints(s).length, 3);
  assert.equal(globalThis.__moonLines.at(-1), 'Za dużo! Teraz dobrze? Dotknij flagi!');
  assert.equal(s.answers.length, 0);
  await flag(s).userData.onTap();
  await task;
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.answers[0].item, '3');
  s.alive = false; s.exit();
});

test('the last landing number finishes before an automatic round praises her', async () => {
  const s = await build(1, 1);
  let finished = false;
  const task = s.jumpRound(true).then(() => { finished = true; });
  globalThis.__holdMoonLine = 'Jeden!';
  const landing = jumper(s).userData.onTap();
  await flush();
  assert.equal(prints(s).length, 1);
  assert.equal(globalThis.__moonLines.at(-1), 'Jeden!');
  assert.equal(finished, false);
  await jumper(s).userData.onTap();
  assert.equal(prints(s).length, 1);
  globalThis.__holdMoonLine = null;
  globalThis.__finishMoonLine();
  await landing;
  await task;
  assert.equal(finished, true);
  s.alive = false; s.exit();
});

test('howMany jumps are silent, touch counting is distinct, and a numeral answer is scored', async () => {
  const s = await build(2);
  const linesBefore = globalThis.__moonLines.length;
  const task = s.howManyRound();
  await flush();
  assert.deepEqual(globalThis.__moonLines.slice(linesBefore), ['Patrz, jak skacze!', 'Ile było skoków?']);
  assert.equal(s.last, 3);
  assert.equal(prints(s).length, 3);
  assert.equal(s.ghosts.length, 0);
  assert.deepEqual(s.tappables.filter(o => o.userData.num !== undefined).map(o => o.userData.num).sort(), [2, 3, 4]);
  const [first, second] = prints(s);
  first.userData.onTap(); first.userData.onTap(); second.userData.onTap();
  assert.deepEqual(globalThis.__moonLines.slice(-2), ['Jeden!', 'Dwa!']);
  s.tappables.find(o => o.userData.num === 2).userData.onTap();
  assert.equal(s.answers.length, 0);
  const answerAt = globalThis.__moonLines.length;
  s.tappables.find(o => o.userData.num === 3).userData.onTap();
  await task;
  assert.deepEqual(globalThis.__moonLines.slice(answerAt).filter(line => ['Jeden!', 'Dwa!', 'Trzy!'].includes(line)), ['Jeden!', 'Dwa!', 'Trzy!']);
  assert.equal(s.answers[0].skill, 'quantity');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  s.alive = false; s.exit();
});

test('Moon has no shadows or point lights, keeps Chase large, and leaves room for medium post passes', async () => {
  const s = await build(4, 7);
  s.showSlots(9);
  for (let i = 0; i < 10; i++) s.prints.push(s.makePrint(i));
  let draws = 0, shadows = 0, pointLights = 0;
  s.scene.traverse(o => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible(o => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene draws`);
  for (const [w, h] of [[1180, 820], [1366, 1024]]) {
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 500);
    const direction = s.view.pos.clone().sub(s.view.look);
    direction.setLength(Math.max(direction.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
    camera.position.copy(s.view.look).add(direction); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(jumper(s));
    const xs = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) xs.push(new THREE.Vector3(x, y, z).project(camera).x);
    assert.ok((Math.max(...xs) - Math.min(...xs)) * w / 2 >= 70, `${w}x${h} Chase width`);
  }
  s.alive = false; s.exit();
});

test('every level runs through the real Mission loop to celebration and counts for the session', async () => {
  for (let level = 1; level <= 4; level++) {
    globalThis.__moonCelebration = null;
    const s = new MoonMission({ home() {}, startMission() {} });
    s.L = LEVELS.moon[level - 1]; s.rounds = s.L.rounds;
    s.pick = () => 3;
    globalThis.__moonScene = s;
    s.enter();
    optimizeScene(s.scene);
    for (let step = 0; step < 100 && !globalThis.__moonCelebration; step++) {
      await flush();
      if (s.phase === 'jump') {
        if (prints(s).length < s.last) await jumper(s).userData.onTap();
        else if (flag(s).visible) await flag(s).userData.onTap();
      } else if (s.phase === 'choosing') {
        s.tappables.find(o => o.userData.num === s.last).userData.onTap();
      }
    }
    assert.equal(globalThis.__moonCelebration?.kind, 'moon', `level ${level}`);
    assert.equal(globalThis.__moonDone.at(-1), 'moon');
    assert.ok(s.answers.some(a => a.skill === 'quantity' && a.scored));
    assert.equal(s.answers.at(-1).skill, 'counting');
    assert.equal(s.answers.at(-1).scored, false);
    assert.deepEqual(s.doneLine(), T.moonDone());
    s.exit();
  }
});
