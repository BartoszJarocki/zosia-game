import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

// The Lookout ride and the Treat House feast keep their length, and she can tap along to count (plan, rule 3).
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
globalThis.document.querySelectorAll = () => [];
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
const lines = (globalThis.__lines = []);
const sounds = (globalThis.__sfx = []);

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x, in: (x) => x, back: (x) => x, bounce: (x) => x };
    export const animate = async (ms, fn) => { await new Promise(setImmediate); for (const t of [0, 0.5, 1]) fn(t); };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: (o, k) => () => globalThis.__sfx.push(k) });`;
  if (url.endsWith('/src/ui.js')) source = `
    export const badges = { get: () => ({}), add: () => ({}) };
    export const missionHud = () => {}; export const bubble = () => {}; export const hideBubble = () => {}; export const nudgeBubble = () => {};
    export const setProgress = () => {}; export const setRounds = () => {}; export const celebrate = () => {};
    export const liftPanel = () => new Proxy({}, { get: () => () => {} });`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { LookoutMission } = await import('../src/scenes/lookout.js');
const { CountingMission } = await import('../src/scenes/counting.js');
const { makeBone } = await import('../src/models.js');
const { CONFIG } = await import('../src/config.js');
const flush = async (n = 3) => { for (let i = 0; i < n; i++) await new Promise(setImmediate); };

test('on a Lookout ride she can count along: a tap on the signs pops the floor the car is at; before and after, nothing to count', async () => {
  CONFIG.level = 1;
  const s = new LookoutMission({});
  s.build();
  const round = s.round(0);
  await flush();
  assert.equal(s.along, undefined, 'no ride yet');
  const target = s.last;
  const riding = s.onPress(target);
  const seen = [];
  for (let i = 0; i < 400 && !seen.includes(target); i++) {
    await flush(1);
    const sign = s.along?.();
    if (!sign || !s.floor || seen.includes(s.floor)) continue;
    seen.push(s.floor);
    assert.ok(sign === s.signs[s.floor - 1], 'the sign of the floor the car is at');
    sounds.length = 0;
    s.signs[0].userData.onTap();
    assert.deepEqual(sounds, ['pop'], `a tap on floor ${s.floor} pops`);
  }
  assert.deepEqual(seen, Array.from({ length: target }, (_, i) => i + 1), 'she can count every floor of the ride');
  await riding; await round;
  assert.equal(s.along, null, 'the ride is over');
  sounds.length = 0;
  s.signs[0].userData.onTap();
  assert.deepEqual(sounds, [], 'a tap on a sign counts nothing between rides');
  s.alive = false; s.exit();
  CONFIG.level = null;
});

test('in the Treat House feast a treat she taps is eaten at once, the rest at Chase\'s pace, and a counted feast says each number', async () => {
  const s = new CountingMission({});
  s.build();
  const tray = () => Array.from({ length: 3 }, (_, i) => { const b = makeBone(1); b.position.set(i, 0.2, 0.5); s.scene.add(b); return b; });
  const bones = tray();
  const eating = s.feast(bones);
  assert.ok(s.along() === bones[0], 'the next treat is the one to tap');
  sounds.length = 0;
  bones[2].userData.onTap();
  await flush(2);
  assert.ok(!bones[2].parent, 'the treat she tapped is eaten at once');
  assert.ok(bones[0].parent && bones[1].parent, 'the others wait for Chase');
  assert.ok(sounds.includes('crunch'));
  await eating; await flush(2);
  assert.ok(bones.every((b) => !b.parent), 'he eats them all');
  assert.equal(s.along, null);

  lines.length = 0;
  const counted = tray();
  const feast = s.feast(counted, { counted: true });
  counted[0].userData.onTap();
  await feast;
  assert.deepEqual(lines.filter((l) => /^(Jeden|Dwa|Trzy)!$/.test(l)), ['Jeden!', 'Dwa!', 'Trzy!'], 'one number a treat, the last one hers');
  s.alive = false; s.exit();
});
