import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

// The island's number places (Cone Road, River, Treat House, Picnic, Garage, Lookout): small bugs she met, as she meets them.
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
}, querySelectorAll: () => [] };
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
const lines = (globalThis.__lines = []);

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = new Proxy({}, { get: () => (x) => x });
    export const animate = async (ms, fn) => { await new Promise(setImmediate); for (const t of [0, 0.5, 1]) fn(t); };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
    export const shakeNo = (o) => { (globalThis.__shakes ||= []).push(o.position.distanceTo(o.userData.home || o.position)); };
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push(...[s].flat()); await (globalThis.__gate || new Promise(setImmediate)); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `
    export const badges = { get: () => ({}), add: () => ({}) };
    export const missionHud = () => {}; export const bubble = (o) => { globalThis.__bubble = o; }; export const hideBubble = () => {}; export const nudgeBubble = () => {};
    export const setProgress = () => {}; export const setRounds = () => {}; export const celebrate = () => {};
    export const liftPanel = () => new Proxy({}, { get: () => () => {} });`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { LookoutMission } = await import('../src/scenes/lookout.js');
const { CountingMission } = await import('../src/scenes/counting.js');
const { GarageMission } = await import('../src/scenes/garage.js');
const { PicnicMission } = await import('../src/scenes/picnic.js');
const { StonesMission } = await import('../src/scenes/stones.js');
const { camera } = await import('../src/engine.js');
const { makeBone } = await import('../src/models.js');
const { CONFIG } = await import('../src/config.js');
const { EASIER } = await import('../src/levels/easier.js');
const { parseGame } = await import('../src/levels/parse.js');
const flush = async (n = 3) => { for (let i = 0; i < n; i++) await new Promise(setImmediate); };
const until = async (cond, tries = 400) => { for (let i = 0; i < tries && !cond(); i++) await flush(1); assert.ok(cond(), 'it happened'); };
const stop = (s) => { s.alive = false; s.exit(); CONFIG.level = null; };
const GAME = parseGame(readFileSync(new URL('../GAME.md', import.meta.url), 'utf8'), { childName: 'Zosia' }).levels;

/** What the engine would hand a tap that lands where the ray goes (engine.js: a real thing wins over a tap zone). */
function tapTarget(s, ray) {
  const live = s.tappables.filter((o) => o.visible);
  const hits = ray.intersectObjects(live, true).map((h) => { let o = h.object; while (o && !o.userData.onTap) o = o.parent; return o; }).filter(Boolean);
  return hits.find((o) => !o.userData.zone) || hits[0] || null;
}
function frame(s) {
  camera.position.copy(s.view.pos);
  camera.lookAt(s.view.look);
  camera.updateMatrixWorld(true);
  s.scene.updateMatrixWorld(true);
}
/** A tap on the screen point where world point p shows. */
function tapAt(s, p) {
  const v = p.clone().project(camera);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(v.x, v.y), camera);
  return tapTarget(s, ray);
}

test('Lookout, "one floor up": the kitten is not on the floor until she has answered (no sign beside it to read)', async () => {
  CONFIG.level = 4; // relative: the first ride is a pickup, then "one floor up or down"
  const s = new LookoutMission({});
  s.build();
  const waiting = () => s.scene.children.filter((o) => o.userData.kitten);
  const first = s.round(0);
  await flush();
  assert.equal(waiting().length, 1, 'a pickup ride: the kitten waits beside its sign');
  await s.onPress(s.last);
  await first;
  const from = s.floor, second = s.round(1);
  await flush();
  assert.equal(waiting().length, 0, 'the second ride has no kitten waiting yet');
  assert.ok(s.last === from + 1 || s.last === from - 1, 'one floor up or down');
  const riding = s.onPress(s.last);
  await until(() => waiting().length === 1 || s.kittens.length === 2);
  await riding; await second;
  assert.equal(s.kittens.length, 2, 'the kitten is waiting on that floor when the lift arrives, and hops in');
  stop(s);
});

test('Lookout, find the floor by its kitten: the kitten still waits beside the sign (the sign is what she reads)', async () => {
  CONFIG.level = 3;
  const s = new LookoutMission({});
  s.build();
  const ride = s.round(0);
  await flush();
  assert.equal(s.scene.children.filter((o) => o.userData.kitten).length, 1);
  stop(s);
  void ride;
});

test('Garage door: a shape counts where she drops it', async () => {
  CONFIG.level = 2; // a hole for each shape
  const s = new GarageMission({});
  s.build(); s.collect();
  const round = s.doorRound(false);
  const board = await (async () => { await until(() => s.scene.children.some((o) => o.userData.holes) && s.tappables.some((o) => o.userData.choice)); return s.scene.children.find((o) => o.userData.holes); })();
  const piece = (shape) => s.tappables.find((o) => o.userData.choice === shape);
  const holeX = (shape) => board.position.x + board.userData.holes.find((h) => h.shape === shape).at.x;
  const want = s.last, other = ['circle', 'square', 'triangle'].find((x) => x !== want), third = ['circle', 'square', 'triangle'].find((x) => x !== want && x !== other);
  const drop = (shape, x, z = 0) => piece(shape).userData.drag.onDrop(piece(shape), new THREE.Vector3(x, 0.72, z));
  const wrong = () => s.learn.current.wrong;

  globalThis.__shakes = [];
  assert.equal(drop(want, holeX(other)), true);
  assert.equal(wrong(), 1, 'the right piece over another shape\'s hole is a wrong try');
  assert.ok(!piece(want).userData.placed, 'it does not fit there');
  await flush(3);
  assert.equal(globalThis.__shakes.length, 2, 'Chase and the piece shake their heads');
  assert.ok(globalThis.__shakes.every((d) => d < 0.01), 'the piece floats back to its place first and shakes its head there');
  const said = lines.length;

  drop(other, holeX(other));
  assert.equal(wrong(), 2, 'a piece that fits its own hole but is not the one asked for is wrong too');
  assert.ok(lines.slice(said).some((l) => /^Nie, to /.test(l)), 'and it is named: "Nie, to …"');

  assert.equal(drop(want, -9), false, 'let go far from the door: it floats back');
  assert.equal(drop(want, holeX(want), 2.4), false, 'let go before it reached the door: it floats back');
  assert.equal(wrong(), 2, 'neither counts as a try');
  assert.equal(s.answers.length, 0);

  drop(want, holeX(want) + 0.4);
  await until(() => s.answers.length === 1);
  assert.equal(s.answers[0].firstTry, false);
  assert.ok(piece(want) === undefined || piece(want).userData.placed, 'over its own hole it goes in');
  void third; void round;
  stop(s);
});

test('Garage flags: the hint that says the row aloud stops the moment she answers (it never talks over the praise)', async () => {
  CONFIG.level = 1;
  const s = new GarageMission({});
  s.build(); s.collect();
  const round = s.flagsRound(false);
  await until(() => s.tappables.some((o) => o.userData.choice) && s.learn.current);
  const flags = s.scene.children.find((o) => o.userData.hooks)?.userData.line?.children ?? [];
  const row = Array.from({ length: 5 }, (_, i) => flags[i] ?? { scale: new THREE.Vector3(1, 1, 1), rotation: {} });
  const chanting = s.chant(['red', 'blue', 'red', 'blue', 'red'], row);
  await flush(2);
  s.say(['Brawo!']); // her answer is praised: a newer line
  const whole = await chanting;
  assert.equal(whole, false, 'the chant gave way');
  const after = lines.slice(lines.lastIndexOf('Brawo!') + 1);
  assert.deepEqual(after.filter((l) => /^(Czerwona|Niebieska)!$/.test(l)), [], 'no flag is called after the newer line');
  void round;
  stop(s);
});

test('Treat House, flash and hidden: too many takes every treat back, so the tray never shows how many were under the bowl', async () => {
  CONFIG.level = 5; // flash
  const s = new CountingMission({});
  s.build(); s.collect();
  s.plan = ['flash'];
  const round = s.flashRound();
  await until(() => s.onPup && s.tappables.some((o) => o.userData.drag));
  const pile = () => s.tappables.filter((o) => o.userData.drag);
  const size = pile().length, n = s.last;
  assert.ok(size > n + 1, 'there are treats to give too many');
  for (const b of pile().slice(0, n + 1)) b.userData.drag.onTap(b);
  await flush(4);
  assert.equal(pile().length, size - n - 1, 'she gave one too many');
  await s.onPup();
  await until(() => pile().length === size);
  assert.ok(lines.includes('Oj, za dużo! Oddaję wszystkie smakołyki.'));
  assert.equal(pile().length, size, 'every treat is back on the pile: none lies on the tray for her to read');
  assert.equal(s.learn.current.wrong, 1);
  await until(() => lines.at(-1) === 'Daj Czejsowi tyle samo!');
  void round;
  stop(s);
});

test('Treat House, give N: too many still gives back exactly the extra ones (the number is in the bubble)', async () => {
  CONFIG.level = 4; // give, with no automatic stop
  const s = new CountingMission({});
  s.build(); s.collect();
  s.plan = ['give'];
  const round = s.giveRound();
  await until(() => s.onPup && s.tappables.some((o) => o.userData.drag));
  const pile = () => s.tappables.filter((o) => o.userData.drag);
  const size = pile().length, n = s.last;
  for (const b of pile().slice(0, n + 1)) b.userData.drag.onTap(b);
  await flush(4);
  await s.onPup();
  await until(() => pile().length === size - n);
  assert.ok(lines.some((l) => /^Oj, za dużo! Oddaję jeden smakołyk\.$/.test(l)));
  void round;
  stop(s);
});

test('Treat House, how many: a treat still in the air does not count when it is tapped; once it lies still it does', async () => {
  CONFIG.level = 4;
  const s = new CountingMission({});
  s.build(); s.collect();
  const real = s.flyBone.bind(s), landings = new Map();
  s.flyBone = (to) => { const out = real(to); return { bone: out.bone, flight: new Promise((r) => landings.set(out.bone, () => out.flight.then(r))) }; };
  const round = s.howManyRound();
  await until(() => s.scene.children.some((o) => o.userData.onTap && o.userData.tapHeight === 0 && o.children.length === 5));
  const bone = s.scene.children.find((o) => o.userData.onTap && o.userData.tapHeight === 0 && o.children.length === 5);
  lines.length = 0;
  bone.userData.onTap(bone);
  assert.equal(lines.includes('Jeden!'), false, 'in the air: no count');
  assert.ok(!bone.userData.counted);
  landings.get(bone)();
  await flush(3);
  bone.userData.onTap(bone);
  assert.ok(lines.includes('Jeden!'), 'lying still: counted');
  void round;
  stop(s);
});

test('Picnic: a tap on the kitten or on Zosia is theirs, never the blanket behind them', async () => {
  CONFIG.level = 3; // more, less, same: the kitten comes for "less"
  const s = new PicnicMission({});
  s.build(); s.collect();
  const round = s.round(1); // a "less" round: the kitten and two blankets
  await flush(3);
  frame(s);
  const where = (obj, dx, ys) => ys.map((y) => obj.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(dx, 0, 0)).setY(y));
  for (const p of where(s.kitten, 0, [0.1, 0.25, 0.5])) assert.ok(tapAt(s, p) === s.kitten, `kitten at height ${p.y}`);
  for (const p of [...where(s.girl, 0.12, [0.1, 0.4]), ...where(s.girl, -0.12, [0.1, 0.4]), ...where(s.girl, 0, [0.8, 1.2])]) assert.ok(tapAt(s, p) === s.girl, `Zosia at height ${p.y}`);
  const blanket = s.tappables.find((o) => o.userData.zone);
  assert.ok(blanket, 'the blankets are tap zones');
  assert.ok(tapAt(s, new THREE.Vector3(blanket.position.x, 0.2, blanket.position.z)) === blanket, 'a tap on the blanket still chooses it');
  void round;
  stop(s);
});

test('River: a new river shows its first number at once, not the number the last river ended on', () => {
  CONFIG.level = 1;
  const s = new StonesMission({});
  s.build(); s.collect();
  globalThis.__bubble = { big: '3', dots: 3 }; // (the last river ended on 3)
  const round = s.round(1);
  assert.equal(globalThis.__bubble.big, '1');
  void round;
  stop(s);
});

test('River: the next number is asked while the one she landed on is still being said (she need not wait for the voice)', async () => {
  CONFIG.level = 1;
  const s = new StonesMission({});
  s.build(); s.collect();
  const round = s.round(0);
  await until(() => s.tappables.filter((o) => o.userData.num !== undefined).length === 2 && s.learn.current);
  globalThis.__gate = new Promise(() => {}); // the voice never finishes
  const right = s.tappables.find((o) => o.userData.num === 1);
  right.userData.onTap(right);
  await until(() => s.learn.current?.item === '2');
  assert.ok(s.tappables.some((o) => o.userData.num === 2), 'the next row is there to tap');
  globalThis.__gate = null;
  void round;
  stop(s);
});

test('River: Zosia never takes a tap a stone could take (a stone behind her is still the stone)', () => {
  CONFIG.level = 1;
  const s = new StonesMission({});
  s.build(); s.collect();
  frame(s);
  assert.ok(tapAt(s, s.girl.position.clone().setY(1.2)) === s.girl, 'a tap that lands only on her is still hers');
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 24), new THREE.MeshBasicMaterial());
  stone.position.set(s.girl.position.x, 0.18, s.girl.position.z - 0.9); // right behind her
  s.scene.add(stone);
  s.tappable(stone, noop);
  s.scene.updateMatrixWorld(true);
  const mid = stone.position.clone().add(new THREE.Vector3(0, 0.1, 0));
  assert.ok(tapAt(s, mid) === stone, 'the tap goes to the stone');
  assert.ok(tapAt(s, s.girl.position.clone().setY(1.2)) === stone, 'also where she stands in front of it');
  stop(s);
});

test('a gentler run is never the same as the run it follows, in the island\'s number places', () => {
  for (const kind of ['cones', 'stones', 'counting', 'lookout', 'picnic', 'garage']) {
    GAME[kind].forEach((row, i) => assert.notDeepEqual(EASIER[kind](row), row, `${kind} level ${i + 1}`));
  }
});

test('Treat House gentler run: a number less at the top of every range, the rings on, and the answer automatic', () => {
  const row = GAME.counting[5]; // flash and hidden
  const easy = EASIER.counting(row);
  assert.deepEqual([easy.give, easy.howMany, easy.share, easy.flash, easy.hidden], [[1, 2], [1, 3], [2, 3], [1, 2], [2, 2]]);
  assert.equal(easy.auto, true);
  assert.equal(easy.slots, true);
  for (const r of GAME.counting) for (const key of ['give', 'howMany', 'share', 'flash', 'hidden']) {
    const e = EASIER.counting(r)[key];
    if (r[key]) assert.ok(e[0] === r[key][0] && e[1] >= e[0] && e[1] <= r[key][1], `${key}: ${r[key]} → ${e}`);
    else assert.equal(e, undefined);
  }
});

test('Picnic gentler run: amounts are always farther apart than the level\'s, and the pile is never smaller than four', () => {
  for (const row of GAME.picnic) {
    const e = EASIER.picnic(row);
    assert.equal(e.close, false);
    assert.equal(e.numerals, false);
    assert.ok(e.max >= 4 && e.max <= row.max);
  }
  assert.equal(EASIER.picnic(GAME.picnic[0]).max, 4);
});

test('Lookout gentler run: the first level is one ride; the others are one easy kitten per ride on floors 1 to 3', () => {
  assert.deepEqual(EASIER.lookout(GAME.lookout[0]), { ...GAME.lookout[0], rounds: 1 });
  assert.equal(EASIER.lookout(GAME.lookout[3]).mode, 'go');
});

test('Picnic: the next question does not wait for Chase to trot back home from his treats', async () => {
  CONFIG.level = 1;
  const s = new PicnicMission({});
  s.build(); s.collect();
  const real = s.jumpTo.bind(s);
  let jumps = 0;
  s.jumpTo = (...args) => (++jumps === 1 ? real(...args) : new Promise(() => {})); // (the trot home never ends)
  const bone = makeBone(1);
  s.scene.add(bone);
  const eating = s.feast(s.pup, [bone], new THREE.Vector3(3.5, 0, 0.6));
  const done = await Promise.race([eating.then(() => true), (async () => { await flush(80); return false; })()]);
  assert.ok(done, 'the feast is over once he has eaten');
  assert.equal(jumps, 2, 'he does go home');
  stop(s);
});

test('Picnic: five questions a visit on every level, so a blind tap between two blankets does not level her up in half of the runs', () => {
  for (const [i, row] of GAME.picnic.entries()) assert.ok(row.rounds >= 5, `level ${i + 1} asks ${row.rounds}`);
  const clean = (n) => { // the chance a blind tapper (right half the time) gets at least 65% of n questions clean (progress/levelup.js)
    let p = 0;
    for (let k = 0; k <= n; k++) if (k / n >= 0.65) { let c = 1; for (let j = 0; j < k; j++) c = (c * (n - j)) / (j + 1); p += c / 2 ** n; }
    return p;
  };
  assert.ok(clean(5) < 0.2 && clean(3) >= 0.5);
});
