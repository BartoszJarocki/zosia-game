import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

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
globalThis.__shakes = [];

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const renderer = { getRenderTarget() {}, setRenderTarget() {}, render() {} };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x };
    export const animate = async (ms, fn) => {
      globalThis.__animations.push(ms);
      if (globalThis.__delay) await globalThis.__delay(ms);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) { fn(t); globalThis.__sample?.(ms, t); }
    };
    export const wait = (ms) => globalThis.__delay ? globalThis.__delay(ms) : new Promise(setImmediate);
    export const hop = async () => { throw new Error('No character hops in the black hole scene'); };
    export const shakeNo = (obj) => { globalThis.__shakes.push(obj); };
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => {
    globalThis.__lines.push(...[s].flat());
    if ([s].flat().includes(globalThis.__holdLine)) await new Promise((r) => { globalThis.__finishLine = r; });
  };
    export const hush = () => {}; export const unlockAudio = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `
    export const spaceHud = () => {}; export const launchHud = () => {};
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

const { BlackHoleMission } = await import('../src/scenes/blackhole.js');
const { MoonMission } = await import('../src/scenes/moon.js');
const { Space, parkedPosition } = await import('../src/scenes/space.js');
const { CONFIG } = await import('../src/config.js');
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

function clock(t) {
  let now = 0;
  const timers = [];
  globalThis.__delay = (ms) => new Promise((resolve) => timers.push({ at: now + ms, resolve }));
  t.after(() => { globalThis.__delay = null; globalThis.__holdLine = null; globalThis.__finishLine = null; });
  return async (ms) => {
    const end = now + ms;
    await flush();
    while (timers.some((timer) => timer.at <= end)) {
      timers.sort((a, b) => a.at - b.at);
      const timer = timers.shift();
      now = timer.at;
      timer.resolve();
      await flush();
    }
    now = end;
    await flush();
  };
}

async function scene(n = 3) {
  CONFIG.level = 4;
  const s = new BlackHoleMission({});
  s.pick = () => n;
  s.build(); s.collect(); optimizeScene(s.scene);
  return s;
}

test('five taps 100 ms apart light five beads immediately and queue all five numbers', async (t) => {
  const s = await scene(5), advance = clock(t);
  t.after(() => stop(s));
  globalThis.__lines = [];
  globalThis.__holdLine = 'Jeden!';
  let finished = false;
  const round = s.dropRound(true).then(() => { finished = true; });
  const launched = [];
  for (let i = 0; i < 5; i++) {
    if (i) await advance(100);
    const p = s.pebbles.find((p) => p.userData.pebble && p.userData.onTap);
    assert.ok(p, `a tray pebble is ready for tap ${i + 1}`);
    const tap = p.userData.onTap;
    tap(); launched.push(p);
    assert.equal(s.beads.length, i + 1);
    assert.ok(s.beads.every((b) => b.material.map === s.litMap));
    assert.ok(!s.tappables.includes(p));
    assert.ok(!p.userData.pebble);
    tap();
    assert.equal(s.beads.length, i + 1, 'the same flying pebble cannot count twice');
  }
  assert.equal(s.last, 5);
  assert.equal(s.phase, 'solved');
  assert.equal(s.answers.length, 1);
  assert.equal(s.answers[0].scored, false);
  assert.equal(finished, false);
  assert.ok(launched.every((p) => p.parent === s.scene));
  assert.deepEqual(globalThis.__lines.filter((line) => /^(Jeden|Dwa|Trzy|Cztery|Pięć)!$/.test(line)), ['Jeden!']);
  globalThis.__holdLine = null; globalThis.__finishLine();
  await flush();
  assert.deepEqual(globalThis.__lines.slice(-6), ['Jeden!', 'Dwa!', 'Trzy!', 'Cztery!', 'Pięć!', 'Czarna dziura świeci jak lampka!'], 'praised while the pebbles fly');
  await advance(2399);
  assert.equal(finished, false);
  assert.ok(launched.at(-1).parent);
  await advance(1); await round;
  assert.ok(launched.every((p) => !p.parent));
  assert.equal(finished, true, 'the round ends when her last pebble is in');
});

test('the manual button judges the lit beads while pebbles are still flying', async (t) => {
  const s = await scene();
  const advance = clock(t);
  t.after(() => stop(s));
  const round = s.dropRound(false);
  s.pebbles[0].userData.onTap();
  assert.equal(s.last, 3);
  assert.equal(s.beads.length, 1);
  s.button.userData.onTap();
  assert.equal(s.learn.current.wrong, 1);
  assert.equal(s.answers.length, 0);
  s.pebbles[1].userData.onTap();
  s.pebbles[2].userData.onTap();
  assert.equal(s.beads.length, 3);
  assert.equal(s.phase, 'drop');
  s.button.userData.onTap();
  assert.equal(s.phase, 'solved');
  assert.equal(s.answers[0].skill, 'counting');
  assert.equal(s.answers[0].item, '3');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  await advance(2400);
  assert.ok(globalThis.__lines.includes('Za mało! Wypuść jeszcze!'));
  await advance(650); await round;
});

test('the button comes with her first pebble; too few waits, too many puts every bead out and she sends them again', async () => {
  const s = await scene();
  const round = s.dropRound(false);
  assert.equal(s.button.visible, false, 'nothing to check before her first pebble');
  await s.pebbles[0].userData.onTap();
  assert.equal(s.button.visible, true);
  globalThis.__shakes = [];
  await s.button.userData.onTap();
  await flush();
  assert.deepEqual(globalThis.__lines.slice(-2), ['Za mało! Wypuść jeszcze!', 'Dotknij guzika, kiedy skończysz!']);
  assert.deepEqual(globalThis.__shakes, [s.button], 'the button shakes its head');
  assert.equal(s.answers.length, 0);
  for (let i = 0; i < 9; i++) await s.pebbles[i % 4].userData.onTap();
  assert.equal(s.beads.length, 10);
  const lit = [...s.beads];
  await s.button.userData.onTap();
  await flush();
  assert.deepEqual(globalThis.__lines.slice(-2), ['Za dużo! Policz jeszcze raz!', 'Trzy kamyki!']);
  assert.equal(s.beads.length, 0, 'the count starts again');
  assert.ok(lit.every((p) => p.material.map === s.outlineMap), 'no bead stays lit');
  assert.deepEqual(lit.map((p) => p.visible), [true, true, true, ...Array(7).fill(false)], 'the second miss shows three outlines, nothing more');
  assert.equal(s.answers.length, 0);
  assert.equal(s.phase, 'drop');
  assert.equal(s.learn.current.wrong, 2);
  for (let i = 0; i < 3; i++) await s.pebbles[i].userData.onTap();
  await s.button.userData.onTap(); await round;
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  stop(s);
});

test('a wrong count climbs the shared help: the outlines, then the pebble or the button pulses', async () => {
  const s = await scene();
  s.dropRound(false);
  await s.pebbles[0].userData.onTap();
  s.button.userData.onTap();
  assert.equal(s.aid.state.level, 1);
  assert.ok(s.lights.slice(1).every((p) => !p.visible), 'the first miss shows nothing more');
  s.button.userData.onTap();
  assert.equal(s.aid.state.level, 2);
  assert.ok(s.lights.slice(0, 3).every((p) => p.visible), 'the second miss shows the three outlines');
  assert.ok(!s.pebbles.some((p) => p.userData.hinting) && !s.button.userData.hinting, 'and nothing pulses');
  s.button.userData.onTap();
  assert.equal(s.aid.state.level, 3);
  assert.ok(s.pebbles[0].userData.hinting, 'the third pulses a pebble to send');
  assert.equal(s.learn.current.assist, 3);
  await flush();
  assert.equal(globalThis.__lines.at(-1), 'Tutaj!');
  stop(s);
});

test('too many during flights puts the beads out, and arrivals do not relight them', async (t) => {
  const s = await scene(), advance = clock(t);
  t.after(() => stop(s));
  const round = s.dropRound(false);
  const launched = [...s.pebbles];
  launched.forEach((p) => p.userData.onTap());
  assert.equal(s.beads.length, 4);
  const lit = s.lights.slice(0, 4);
  s.button.userData.onTap();
  assert.equal(s.beads.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  assert.equal(s.phase, 'drop');
  await advance(2400);
  assert.ok(lit.every((p) => p.material.map === s.outlineMap && !p.visible));
  assert.ok(launched.every((p) => !p.parent), 'her pebbles still reach the black hole');
  s.pebbles.slice(0, 3).forEach((p) => p.userData.onTap());
  s.button.userData.onTap();
  assert.equal(s.answers[0].firstTry, false);
  await advance(2400); await round;
  assert.equal(s.beads.length, 3);
});

test('auto finishes with the last pebble, praises after its number and does not score', async () => {
  const s = await scene(1);
  const round = s.dropRound(true);
  assert.equal(s.button.visible, false);
  globalThis.__holdLine = 'Jeden!';
  const tap = s.pebbles[0].userData.onTap();
  await until(() => globalThis.__finishLine);
  assert.equal(s.beads.length, 1);
  await s.pebbles[1].userData.onTap();
  assert.equal(s.beads.length, 1);
  globalThis.__holdLine = null; globalThis.__finishLine();
  await tap; await round; await s.talk;
  assert.equal(s.answers[0].scored, false);
  assert.deepEqual(scoreRun(s.answers), { scored: 0, clean: 0 });
  assert.deepEqual(globalThis.__lines.slice(-2), ['Jeden!', 'Czarna dziura świeci jak lampka!']);
  stop(s);
});

test('a drag towards the window sends a pebble; a drag within the tray is rejected', async () => {
  const s = await scene(1);
  const round = s.dropRound(true);
  const p = s.pebbles[0], drag = p.userData.drag;
  assert.equal(drag.onDrop(p, new THREE.Vector3(0, 0.35, 4.2)), false);
  assert.equal(s.beads.length, 0);
  assert.equal(drag.onDrop(p, new THREE.Vector3(0, 0.35, 2)), true);
  assert.equal(s.beads.length, 1);
  assert.ok(!p.userData.onTap);
  assert.equal(drag.onDrop(p, new THREE.Vector3(0, 0.35, 2)), false);
  await round;
  stop(s);
});

test('taking away: the shelf shows what there was, the last ones fall in, and she says how many are left', async () => {
  const s = await scene(2);
  s.L = { ...s.L, away: [4, 4], fall: [2, 2] };
  globalThis.__lines = [];
  const round = s.awayRound();
  await until(() => s.phase === 'choosing');
  assert.deepEqual(globalThis.__lines, ['Cztery kamyki!', 'Dwa wpadły.', 'Ile zostało?']);
  const shelf = s.stones.filter((o) => o.material.map === s.pebbleMap);
  assert.equal(shelf.length, 4);
  assert.deepEqual(shelf.map((p) => p.visible), [true, true, false, false], 'the last two fell in');
  assert.equal(s.stones.filter((o) => o.material.map === s.outlineMap).length, 2, 'each leaves an outline where it lay');
  assert.ok(s.pebbles.every((p) => !p.visible), 'nothing to send in a taking-away round');
  assert.deepEqual(s.blocks.map((b) => b.userData.num).sort(), [1, 2, 4], 'what is left, what there was, a neighbour');
  assert.equal(s.last, 2);
  shelf[1].userData.onTap(); shelf[1].userData.onTap(); shelf[0].userData.onTap();
  await until(() => globalThis.__lines.includes('Dwa!'));
  assert.deepEqual(globalThis.__lines.slice(-2), ['Jeden!', 'Dwa!'], 'each pebble left counts once');
  globalThis.__shakes = [];
  s.blocks.find((b) => b.userData.num === 4).userData.onTap();
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  assert.deepEqual(globalThis.__shakes.map((b) => b.userData.num), [4]);
  s.blocks.find((b) => b.userData.num === 2).userData.onTap();
  await round; await s.talk;
  assert.deepEqual(globalThis.__lines.slice(-2), ['Tak!', 'Dwa!'], 'her number, once');
  assert.equal(s.answers[0].skill, 'quantity');
  assert.equal(s.answers[0].item, '2');
  assert.equal(s.answers[0].options, 3);
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, false);
  assert.ok(shelf.every((p) => !p.userData.onTap));
  stop(s);
});

test('taking-away help: the clue lights the pebbles left without a number, then a wrong tile goes, then the right one pulses', async () => {
  const s = await scene(3);
  s.L = { ...s.L, away: [5, 5], fall: [2, 2] };
  s.awayRound();
  await until(() => s.phase === 'choosing');
  const before = globalThis.__lines.length;
  s.runAssist('hint');
  await flush();
  assert.deepEqual(globalThis.__lines.slice(before), ['Policzmy razem!']);
  const right = s.blocks.find((b) => b.userData.num === 3);
  s.blocks.find((b) => b.userData.num === 5).userData.onTap();
  s.blocks.find((b) => b.userData.num === 5).userData.onTap();
  assert.equal(s.blocks.filter((b) => b.userData.gone).length, 1, 'the second miss takes a wrong tile away');
  assert.ok(!right.userData.gone && !right.userData.hinting);
  s.blocks.find((b) => b !== right && !b.userData.gone).userData.onTap();
  assert.ok(right.userData.hinting, 'the third pulses the right tile');
  right.userData.onTap();
  stop(s);
});

test('taking-away pebbles fall 0.4 s apart, and the question is open from the start of the round', async (t) => {
  const s = await scene(1), advance = clock(t);
  t.after(() => stop(s));
  s.L = { ...s.L, away: [4, 4], fall: [3, 3] };
  globalThis.__animations = [];
  const round = s.awayRound();
  await flush();
  assert.equal(s.learn.current?.skill, 'quantity');
  assert.equal(s.learn.current?.item, '1');
  await advance(1);
  const shelf = s.stones.slice(0, 4);
  assert.equal(globalThis.__animations.filter((ms) => ms === 1600).length, 1, 'the first one lifts off');
  await advance(400);
  assert.equal(globalThis.__animations.filter((ms) => ms === 1600).length, 2);
  await advance(400);
  assert.equal(globalThis.__animations.filter((ms) => ms === 1600).length, 3);
  assert.equal(s.blocks.length, 0, 'no tiles while they fall');
  await advance(1600);
  assert.deepEqual(shelf.map((p) => p.visible), [true, false, false, false]);
  assert.equal(s.phase, 'choosing');
  s.blocks.find((b) => b.userData.num === 1).userData.onTap();
  await advance(350);
  assert.ok(shelf[0].visible, 'the pebble left stays in view, lit, a moment after her answer');
  await advance(500); await round;
});

test('Moon choices stay positive at one and keep neighbours above one', async () => {
  for (const n of [1, 2, 7, 9]) {
    const s = new MoonMission({});
    s.L = { ...s.L, howMany: [1, 2], slots: true };
    s.pick = () => n;
    s.build(); await s.landed;
    const round = s.howManyRound();
    await until(() => s.phase === 'choosing');
    assert.deepEqual(s.blocks.map((b) => b.userData.num).sort((a, b) => a - b),
      ({ 1: [1, 2, 3], 2: [1, 2, 3], 7: [6, 7, 8], 9: [8, 9, 10] })[n]);
    s.blocks.find((b) => b.userData.num === n).userData.onTap();
    await round; stop(s);
  }
});

test('all four levels reach the base celebration, ask two or more scored questions and end with auto drops', async () => {
  for (let level = 1; level <= 4; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [], events = [];
    const s = new BlackHoleMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 300 && !globalThis.__celebration; step++) {
      if (s.phase === 'drop') {
        if (s.beads.length < s.last) await s.pebbles[0].userData.onTap();
        else if (s.button.visible) await s.button.userData.onTap();
      } else if (s.phase === 'choosing' && s.blocks.length) s.blocks.find((b) => b.userData.num === s.last).userData.onTap();
      s.update(0.05, step * 0.05);
      await flush();
    }
    assert.equal(globalThis.__celebration?.kind, 'blackhole', `level ${level}, ${s.phase}, round ${s.roundIndex}`);
    assert.deepEqual(globalThis.__progress, [1, 2, 3, 4]);
    assert.deepEqual(s.task, { type: 'drop', auto: true });
    assert.equal(events.filter((e) => e.correct).length, LEVELS.blackhole[level - 1].rounds);
    assert.equal(scoreRun(s.answers).scored, [2, 2, 3, 3][level - 1]);
    assert.deepEqual(s.answers.filter((a) => a.skill === 'quantity').length, 2, 'two taking-away questions');
    assert.equal(getSession().missionsCompleted, 1);
    assert.deepEqual(s.doneLine(), ['Brawo! Czarna dziura świeci od twoich kamyków!']);
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['blackhole']);
    globalThis.__celebration.onHome(); globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});

test('winding down skips to the automatic final drop', async () => {
  const s = await scene(1);
  s.plan = [{ type: 'away', auto: false }, { type: 'drop', auto: false }, { type: 'away', auto: false }, { type: 'drop', auto: true }];
  s.windingDown = true; s.rounds = 2;
  const round = s.round(1);
  assert.deepEqual(s.task, { type: 'drop', auto: true });
  await s.pebbles[0].userData.onTap(); await round;
  assert.equal(s.answers[0].scored, false);
  assert.equal(s.beads.length, 0);
  assert.ok(s.lights.every((p) => !p.visible));
  stop(s);
});

test('a flight shrinks and spirals without moving the camera, black hole or Chase', async () => {
  const s = await scene(1), p = s.pebbles[0];
  const view = s.view.pos.clone(), hole = s.hole.position.clone(), chase = s.chase.position.clone();
  const samples = [];
  globalThis.__sample = (ms, t) => {
    if (ms !== 2400) return;
    samples.push({ t, x: p.position.x, z: p.position.z, scale: p.scale.x, opacity: p.material.opacity });
    assert.deepEqual(s.view.pos, view);
    assert.deepEqual(s.hole.position, hole);
    assert.deepEqual(s.chase.position, chase);
    assert.equal(s.hole.scale.x, 1);
    assert.equal(s.scene.background.getHexString(), 'a681dc');
  };
  const round = s.dropRound(true);
  await p.userData.onTap(); await round;
  globalThis.__sample = null;
  assert.deepEqual(samples.map((v) => v.t), [0, 0.25, 0.5, 0.75, 1]);
  assert.ok(samples.every((v, i) => !i || v.scale < samples[i - 1].scale));
  assert.ok(samples[2].x < hole.x && samples[3].x > hole.x && samples[4].x < hole.x);
  assert.equal(samples.at(-1).opacity, 0);
  assert.equal(s.beads.length, 1);
  assert.equal(p.parent, null);
  assert.notEqual(s.pebbles[0], p);
  assert.deepEqual(s.pebbles[0].position, p.userData.home);
  assert.equal(s.pebbles[0].material.opacity, 1);
  assert.equal(s.pebbles[0].scale.x, 1);
  assert.deepEqual(s.ring.material.color, s.ringColor);
  stop(s);
});

test('leaving during flights cancels queued numbers and tray refills', async (t) => {
  const s = await scene(), advance = clock(t);
  globalThis.__lines = [];
  globalThis.__holdLine = 'Jeden!';
  s.dropRound(true);
  const pebbles = [...s.pebbles];
  const first = s.pebbles[0].userData.onTap();
  await advance(100);
  const second = s.pebbles[1].userData.onTap();
  assert.equal(s.beads.length, 2);
  stop(s);
  globalThis.__holdLine = null; globalThis.__finishLine();
  await advance(4000); await Promise.all([first, second]);
  assert.equal(s.beads.length, 2);
  assert.equal(s.answers.length, 0);
  assert.deepEqual(s.pebbles, pebbles);
  assert.deepEqual(globalThis.__lines.filter((line) => /^(Jeden|Dwa)!$/.test(line)), ['Jeden!']);
  assert.ok(!globalThis.__lines.includes('Czarna dziura świeci jak lampka!'));
});

function bounds(obj, camera, width, height) {
  obj.updateWorldMatrix(true, true);
  const vertices = [];
  obj.traverseVisible((o) => {
    if (!o.geometry || o.material?.visible === false) return;
    const points = o.geometry.getAttribute('position');
    for (let i = 0; i < points.count; i++) vertices.push(new THREE.Vector3().fromBufferAttribute(points, i).applyMatrix4(o.matrixWorld).project(camera));
  });
  const xs = vertices.map((p) => (p.x + 1) * width / 2), ys = vertices.map((p) => (1 - p.y) * height / 2);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

test('all controls fit both iPads at 70 px or larger and the scene stays below the draw budget', async () => {
  const s = await scene(5);
  s.L = { ...s.L, away: [7, 7], fall: [2, 2] };
  const round = s.awayRound();
  await until(() => s.phase === 'choosing');
  s.showSlots(10); s.button.visible = true; s.pebbles.forEach((p) => { p.visible = true; });
  for (const [width, height] of [[1180, 820], [1366, 1024]]) {
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    const dir = s.view.pos.clone().sub(s.view.look);
    dir.setLength(Math.max(dir.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
    camera.position.copy(s.view.look).add(dir); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
    for (const obj of [...s.pebbles, ...s.lights, ...s.blocks, ...s.stones.filter((o) => o.visible), s.button]) {
      const b = bounds(obj, camera, width, height);
      const painted = obj.userData.bead || obj.material.map === s.outlineMap ? 224 / 256 : 1;
      assert.ok((b.right - b.left) * painted >= 70, `${width}x${height} target width: ${JSON.stringify(b)}`);
      assert.ok((b.bottom - b.top) * painted >= 70, `${width}x${height} target height: ${JSON.stringify(b)}`);
      assert.ok(b.left >= 0 && b.right <= width && b.top >= 0 && b.bottom <= height);
    }
    const hole = bounds(s.hole, camera, width, height);
    assert.ok(hole.right - hole.left < width * 0.2);
  }
  let draws = 0, shadows = 0, pointLights = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0); assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene calls plus 20 for medium postprocessing`);
  assert.equal(s.drift, 0);
  assert.deepEqual(s.post, { tilt: 0, ao: false });
  s.blocks.find((b) => b.userData.num === 5).userData.onTap(); await round; stop(s);
});

test('the black hole stop starts the mission and returning parks the rocket there', async () => {
  const missions = [];
  const s = new Space({ startMission(kind) { missions.push(kind); } });
  s.enter();
  await s.tapStop('blackhole');
  assert.deepEqual(missions, ['blackhole']);
  assert.equal(s.routeIndex, 11);
  s.exit();
  const returned = new Space({}, { at: 'blackhole' });
  returned.enter();
  assert.equal(returned.at, 'blackhole');
  assert.equal(returned.state, 'waiting');
  assert.deepEqual(returned.rocket.position, parkedPosition('blackhole'));
  stop(returned);
});

