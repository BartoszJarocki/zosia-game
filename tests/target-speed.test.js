// The grown-ups' target speed for Balloon Hill and Comet Catch: "slow" halves how fast the targets move and changes
// nothing she is asked. Played through the real scenes with a seeded random, so one round at "auto" and the same
// round at "slow" have the same letters in the same places.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

const noop = () => {};
function element() {
  const selectors = new Map();
  return {
    innerHTML: '', children: [], events: {}, style: { setProperty() {} }, classList: { add() {}, remove() {} },
    append(child) { this.children.push(child); },
    appendChild(child) { this.children.push(child); },
    remove() {},
    querySelector(selector) { if (!selectors.has(selector)) selectors.set(selector, element()); return selectors.get(selector); },
    querySelectorAll() { return []; },
    addEventListener(event, fn) { this.events[event] = fn; },
  };
}
const canvas = () => {
  const c = { width: 0, height: 0 };
  const ctx = new Proxy({ canvas: c, createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 30 }) }, { get: (o, k) => (k in o ? o[k] : noop) });
  c.getContext = () => ctx;
  return c;
};
globalThis.window = { addEventListener: noop, removeEventListener: noop };
globalThis.location = { search: '', hash: '' };
globalThis.innerWidth = 1180;
globalThis.innerHeight = 820;
globalThis.document = {
  body: element(), getElementById: () => element(), addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], fonts: { load: async () => {} },
  createElement: (tag) => (tag === 'canvas' ? canvas() : element()),
};
const KEY = 'pup-patrol-progress';
const stored = new Map();
globalThis.localStorage = { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, String(v)), removeItem: (k) => stored.delete(k) };
globalThis.__lines = [];

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = new Proxy({}, { get: () => (x) => x });
    export const animate = async (ms, fn) => { for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t); };
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
    export const MISSIONS = { letters: {}, balloons: {}, comet: {} };
    export const buildLabel = () => 'test build';
    export const missionHud = () => {};
    export const bubble = (options) => { globalThis.__bubble = options; };
    export const hideBubble = () => {};
    export const nudgeBubble = () => {};
    export const setProgress = () => {};
    export const setRounds = () => {};
    export const celebrate = () => {};`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { EASIER, TARGET_SPEED, paced } = await import('../src/levels/easier.js');
const { learning } = await import('../src/learning/events.js');
const progress = await import('../src/progress.js');
const { migrate } = await import('../src/progress/migrations.js');
const { CometMission } = await import('../src/scenes/comet.js');
const { BalloonsMission } = await import('../src/scenes/balloons.js');
const { LettersMission } = await import('../src/scenes/letters.js');
const { showParentView } = await import('../src/parent/view.js');

const game = { home() {}, startMission() {} };
const flush = () => new Promise(setImmediate);
const stop = (s) => { s.alive = false; s.exit(); };
const close = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} against ${b}`);
const random = Math.random;
/** The same "random" every time it is seeded, so two rounds lay out the same letters in the same places. */
const seed = (x) => { Math.random = () => ((x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296); };
const settle = async (s, ready) => { for (let i = 0; i < 100 && !ready(); i++) await flush(); assert.ok(ready(), 'the round did not open'); };

/** One Comet round on this level at this setting: its letters, where each comet starts, and how far each moves in one frame. */
async function cometRound(level, targetSpeed) {
  CONFIG.level = level;
  progress.setTargetSpeed(targetSpeed);
  const s = new CometMission(game);
  s.pick = (skill, pool) => pool[0];
  s.build(); s.collect();
  seed(11);
  s.round(0);
  await settle(s, () => s.phase === 'catch' && s.comets.length === s.L.total);
  Math.random = random;
  const before = s.comets.map((c) => c.position.x);
  s.update(0.1, 0);
  const out = { L: s.L, target: s.last, letters: s.comets.map((c) => c.userData.letter), pace: s.pace, moved: s.comets.map((c, i) => before[i] - c.position.x) };
  stop(s);
  return out;
}

/** The same for one Balloon Hill round: each balloon's letter and how far it rises in one frame. */
async function balloonRound(level, targetSpeed) {
  CONFIG.level = level;
  progress.setTargetSpeed(targetSpeed);
  const s = new BalloonsMission(game);
  s.pick = (skill, pool) => pool[0];
  s.build(); s.collect();
  seed(23);
  s.round(0);
  await settle(s, () => s.balloons.length === s.L.total);
  Math.random = random;
  const before = s.balloons.map((b) => b.position.y);
  s.update(0.1, 0);
  const out = { L: s.L, target: s.last, letters: s.balloons.map((b) => b.userData.letter), rose: s.balloons.map((b, i) => (b.position.y - before[i]) / 0.1) };
  stop(s);
  return out;
}

const withoutSpeed = (L) => ({ ...L, speed: null });

test('Comet level 3 at half speed asks for the same letters, in the same places, and the comets cross at half the speed', async () => {
  const auto = await cometRound(3, 'auto'), slow = await cometRound(3, 'slow');
  const row = LEVELS.comet[2];
  assert.deepEqual(slow.letters, auto.letters, 'the same comets');
  assert.equal(slow.target, auto.target, 'the same letter is asked');
  assert.deepEqual(withoutSpeed(slow.L), withoutSpeed(auto.L), 'nothing but the speed differs: pool, ask, targets, total, lookalikes, rounds');
  assert.ok(auto.pace >= row.speed[0] && auto.pace <= row.speed[1], 'at auto the round flies at the level\'s own speed');
  close(slow.pace, auto.pace / 2, 'the round\'s speed');
  const moves = auto.moved.map((m, i) => [m, slow.moved[i]]).filter(([m]) => m > 0 && m < 1);
  assert.ok(moves.length >= row.total - 1, 'most comets were watched for one frame');
  for (const [m, h] of moves) close(h, m / 2, 'a comet\'s step');
});

test('Balloon Hill level 5 at half speed asks for the same letters, and the balloons rise at half the speed', async () => {
  const auto = await balloonRound(5, 'auto'), slow = await balloonRound(5, 'slow');
  const row = LEVELS.balloons[4];
  assert.deepEqual(slow.letters, auto.letters);
  assert.equal(slow.target, auto.target);
  assert.deepEqual(withoutSpeed(slow.L), withoutSpeed(auto.L));
  const rising = auto.rose.map((v, i) => [v, slow.rose[i]]).filter(([v, h]) => v > 0 && h > 0);
  assert.ok(rising.length >= row.total - 2, 'most balloons were watched for one frame');
  for (const [v, h] of rising) {
    assert.ok(v >= row.speed[0] - 1e-9 && v <= row.speed[1] + 1e-9, `at auto a balloon rises at the level's own speed (${v})`);
    close(h, v / 2, 'a balloon\'s rise');
  }
});

test('auto keeps what a run flew at before: the level\'s speed, and a gentler run\'s 0.7 of it', async () => {
  progress.setTargetSpeed('auto');
  CONFIG.level = 3;
  assert.deepEqual(new CometMission(game).L.speed, LEVELS.comet[2].speed);
  const row = LEVELS.comet[2], gentler = EASIER.comet(row);
  assert.deepEqual(paced(gentler, row, 'auto'), gentler);
  assert.deepEqual(gentler.speed.map((v) => +v.toFixed(3)), row.speed.map((v) => +(v * 0.7).toFixed(3)));
});

test('a gentler run at half speed flies at half the level\'s speed, not half of the gentler one, and is otherwise as gentle', async () => {
  for (const kind of ['comet', 'balloons']) {
    const Scene = kind === 'comet' ? CometMission : BalloonsMission, row = LEVELS[kind][2];
    CONFIG.level = null;
    progress.dev.setLevel(kind, 3);
    progress.recordMission(kind, { scored: 4, clean: 0 });
    assert.ok(progress.assistFor(kind), `${kind}: the last run was rough`);
    progress.setTargetSpeed('auto');
    const gentle = new Scene(game).L;
    progress.setTargetSpeed('slow');
    const both = new Scene(game).L;
    assert.equal(both.assist, true);
    gentle.speed.forEach((v, i) => close(v, row.speed[i] * 0.7, `${kind}: a gentler run at auto`));
    both.speed.forEach((v, i) => close(v, row.speed[i] * TARGET_SPEED.slow, `${kind}: a gentler run at half speed`));
    assert.deepEqual(withoutSpeed(both), withoutSpeed(gentle), `${kind}: the letter shown, fewer targets: the gentler run is the same`);
    assert.equal(both.ask, 'match');
    assert.ok(both.total < row.total);
  }
  CONFIG.level = 3;
});

test('a level-up keeps half speed: the next Comet level flies at half of its own speed', async () => {
  CONFIG.level = null;
  progress.dev.setLevel('comet', 1);
  progress.setTargetSpeed('slow');
  const run = progress.recordMission('comet', { scored: 4, clean: 4 });
  assert.ok(run.gained > 0 && run.level > 1, 'a clean run moves her up');
  const next = new CometMission(game);
  assert.equal(next.level, run.level);
  assert.equal(progress.getTargetSpeed(), 'slow');
  next.L.speed.forEach((v, i) => close(v, LEVELS.comet[run.level - 1].speed[i] / 2, 'the new level'));
  CONFIG.level = 3;
});

test('at half speed a tap on empty sky and a wrong letter are still different events, in both places', async () => {
  const seen = [];
  const off = learning.subscribe((e) => seen.push(e));
  for (const [kind, Scene, level] of [['comet', CometMission, 3], ['balloons', BalloonsMission, 5]]) {
    CONFIG.level = level;
    progress.setTargetSpeed('slow');
    seen.length = 0;
    const s = new Scene(game);
    s.pick = (skill, pool) => pool[0];
    s.build(); s.collect();
    s.round(0);
    const things = () => (kind === 'comet' ? s.comets.filter((c) => c.userData.onTap) : s.balloons);
    const reach = async (right) => {
      const find = () => things().find((o) => (o.userData.letter === s.last) === right);
      for (let i = 0; i < 600 && !(s.learn.current && find()); i++) { s.update(0.05, i * 0.05); await flush(); }
      assert.ok(find(), `${kind}: ${right ? 'a right' : 'a wrong'} one came into reach`);
      return find();
    };
    const first = await reach(true);
    s.onMissTap();
    await first.userData.onTap(first);
    const wrong = await reach(false);
    await wrong.userData.onTap(wrong);
    const second = await reach(true);
    await second.userData.onTap(second);
    assert.deepEqual(seen.map((e) => e.errorType ?? 'right'), ['missTap', 'right', 'wrongChoice', 'right'], `${kind}: the slip, an answer, the wrong letter, an answer`);
    assert.deepEqual(s.answers.map((a) => a.firstTry), [true, false], `${kind}: the slip leaves the first try, the wrong letter takes it`);
    stop(s);
  }
  off();
});

test('half speed moves nothing in Kitty Park', () => {
  CONFIG.level = 4;
  progress.setTargetSpeed('auto');
  const auto = new LettersMission(game).L;
  progress.setTargetSpeed('slow');
  assert.deepEqual(new LettersMission(game).L, auto);
  assert.deepEqual(auto, LEVELS.letters[3]);
});

test('the grown-ups\' page has one speed control for Balloon Hill and Comet Catch, and a tap saves it', () => {
  progress.setTargetSpeed('auto');
  const page = showParentView({ onClose() {} });
  assert.equal(page.innerHTML.match(/data-speed=/g).length, 2, 'two choices');
  assert.match(page.innerHTML, /<button class="pv-chip on" data-speed="auto">/);
  assert.match(page.innerHTML, /<b>Target speed<\/b><small class="pv-build">Balloon Hill, Comet Catch<\/small>/);
  page.querySelector('.pv-pace').events.click({ target: { closest: () => ({ dataset: { speed: 'slow' } }) } });
  assert.equal(progress.getTargetSpeed(), 'slow');
  assert.equal(JSON.parse(stored.get(KEY)).targetSpeed, 'slow', 'saved with her progress');
  const again = document.body.children.at(-1);
  assert.match(again.innerHTML, /<button class="pv-chip on" data-speed="slow">/, 'the page shows the choice');
  assert.doesNotMatch(again.innerHTML, /<button class="pv-chip on" data-speed="auto">/);
});

test('something that is not a speed is ignored', () => {
  progress.setTargetSpeed('slow');
  for (const bad of ['fast', 'toString', '', undefined, 0.5]) progress.setTargetSpeed(bad);
  assert.equal(progress.getTargetSpeed(), 'slow');
});

test('an old save reads auto, a save with half speed keeps it through an upgrade, and anything else reads auto', async () => {
  const v7 = { v: 7, age: 3.5, missions: { comet: { level: 3, good: 0, lastAcc: 1 } }, skills: {}, sessions: { count: 0, recent: [] }, visited: {}, world: null };
  const migrated = migrate(v7).state;
  assert.equal(migrated.targetSpeed, undefined, 'no speed was saved: nothing is made up');
  assert.equal(migrate({ ...migrated, targetSpeed: 'slow' }).state.targetSpeed, 'slow');
  let loads = 0;
  const reopen = async (save) => { stored.set(KEY, JSON.stringify(save)); return import(new URL(`../src/progress.js?reload=${++loads}`, import.meta.url)); };
  assert.equal((await reopen(v7)).getTargetSpeed(), 'auto');
  assert.equal((await reopen({ ...migrated, targetSpeed: 'turbo' })).getTargetSpeed(), 'auto');
  assert.equal((await reopen({ ...migrated, targetSpeed: 'slow' })).getTargetSpeed(), 'slow', 'after a reload');
});
