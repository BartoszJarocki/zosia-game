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
globalThis.__animations = [];

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x, in: (x) => x };
    export const animate = async (ms, fn) => {
      globalThis.__animations.push(ms);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t);
    };
    export const wait = () => new Promise(setImmediate);
    export const hop = () => Promise.resolve();
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    export const renderer = { getRenderTarget() { return null; }, setRenderTarget() {}, render() {} };
    ${stage}`;
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

const { SaturnMission } = await import('../src/scenes/saturn.js');
const { camera } = await import('../src/engine.js');
const { saturnPieces, slotAtPoint } = await import('../src/levels/saturn.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { learning } = await import('../src/learning/events.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const { scoreRun } = await import('../src/progress/levelup.js');
const flush = () => new Promise(setImmediate);
const until = async (predicate) => {
  for (let i = 0; i < 300; i++) { if (predicate()) return; await flush(); }
  assert.fail('Scene did not reach the expected phase');
};
const stop = (s) => { s.alive = false; s.exit(); };
const ring = (s, kind) => s.tappables.find((o) => o.userData.choice === kind);
/** The camera where the engine puts it for this scene (engine.js frameCamera: wide enough for view.minWidth). */
function frame(s, cam = camera, width = 1180, height = 820) {
  cam.aspect = width / height; cam.updateProjectionMatrix();
  const direction = s.view.pos.clone().sub(s.view.look);
  direction.setLength(Math.max(direction.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * cam.aspect)));
  cam.position.copy(s.view.look).add(direction); cam.lookAt(s.view.look); cam.updateMatrixWorld(true);
  s.scene.updateMatrixWorld(true);
  return cam;
}

async function scene(level = 1, plan = null) {
  CONFIG.level = 4;
  const s = new SaturnMission({ home() {}, startMission() {} });
  s.L = LEVELS.saturn[level - 1];
  s.rounds = s.L.pieces;
  s.plan = plan || saturnPieces(s.L, () => 0.37);
  s.build(); s.collect(); optimizeScene(s.scene);
  await s.landed;
  return s;
}

test('a tap on the right ring flies the piece into its gap and scores the piece', async () => {
  const s = await scene(1, [{ kind: 'ice', size: 'same' }]);
  s.rounds = 1;
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  assert.equal(s.last, 'ice');
  assert.deepEqual(s.tappables.filter((o) => o.userData.choice).map((o) => o.userData.choice).sort(), ['ice', 'rock']);
  assert.ok(s.pieceObj.userData.drag, 'the piece can be dragged too');
  ring(s, 'ice').userData.onTap();
  await task;
  assert.equal(s.answers.length, 1);
  assert.equal(s.answers[0].skill, 'sorting');
  assert.equal(s.answers[0].item, 'ice');
  assert.equal(s.answers[0].scored, true);
  assert.equal(s.answers[0].firstTry, true);
  assert.equal(s.slot('ice').filled, 1);
  assert.equal(s.slot('ice').gap.visible, false);
  assert.equal(s.pieceObj, null);
  assert.ok(globalThis.__lines.includes('To jest lód.'));
  assert.ok(globalThis.__lines.includes('Lód do lodu!'));
  stop(s);
});

test('the wrong ring gets a gentle "no" and the question again, the right ring does not light, then she tries again', async () => {
  const s = await scene(1, [{ kind: 'rock', size: 'same' }]);
  s.rounds = 1;
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  const home = s.pieceObj.userData.home.clone();
  const before = globalThis.__lines.length;
  ring(s, 'ice').userData.onTap();
  await until(() => s.pieceObj.position.distanceTo(home) < 0.02);
  assert.equal(s.answers.length, 0);
  assert.equal(s.learn.current.wrong, 1);
  assert.equal(s.phase, 'asking');
  assert.equal(s.last, 'rock');
  const said = globalThis.__lines.slice(before);
  assert.ok(/^Nie/.test(said[0]), said.join(' '));
  assert.ok(!said.some((l) => /tutaj/.test(l)), said.join(' '));
  for (let i = 0; i < 10; i++) { s.update(0.1, i * 0.1); await flush(); }
  assert.equal(s.rings.rock.mesh.material.emissiveIntensity, 0, 'the right ring does not light');
  assert.equal(s.aid.state.level, 1, 'help is at "try again"');
  assert.ok(s.learn.current.assist <= 1);
  ring(s, 'rock').userData.onTap();
  await task;
  assert.equal(s.answers[0].item, 'rock');
  assert.equal(s.answers[0].firstTry, false);
  assert.ok(globalThis.__lines.includes('Skała do skał!'));
  stop(s);
});

/** Put the piece where she would drag it (its home height) on the line from the eye to a point of Saturn, and let go. */
function dropOver(s, local) {
  const piece = s.pieceObj, target = s.saturn.localToWorld(local.clone()), dir = target.sub(camera.position);
  piece.position.copy(camera.position).addScaledVector(dir, (piece.userData.home.y + 0.35 - camera.position.y) / dir.y);
  return piece.userData.drag.onDrop(piece, piece.position.clone());
}

test('a drop counts on the ring drawn under the piece as she sees it; over the planet or empty sky it floats back', async () => {
  const s = await scene(1, [{ kind: 'rock', size: 'same' }]);
  s.rounds = 1;
  frame(s);
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  assert.equal(dropOver(s, new THREE.Vector3(0, 1.6, 0.8)), false, 'over the planet');
  assert.equal(dropOver(s, new THREE.Vector3(8, 0, 0)), false, 'in empty sky');
  assert.equal(s.learn.current.wrong, 0, 'neither is an answer');
  assert.equal(dropOver(s, new THREE.Vector3(0, 0, 3.47)), true, 'the front of the ice ring');
  assert.equal(s.learn.current.wrong, 1);
  await until(() => s.pieceObj.position.distanceTo(s.pieceObj.userData.home) < 0.02);
  assert.equal(dropOver(s, new THREE.Vector3(0, 0, 4.93)), true, 'the front of the rock ring, where the ring is drawn');
  await task;
  assert.equal(s.answers[0].item, 'rock');
  assert.equal(s.answers[0].firstTry, false);
  stop(s);
});

const SIZES = [[1180, 820], [820, 1180]];
const pxOf = (s, local, width, height) => {
  const p = s.saturn.localToWorld(local.clone()).project(camera);
  return { x: (p.x + 1) / 2 * width, y: (1 - p.y) / 2 * height };
};
/** Put the piece where it is drawn at screen point (x, y), at its drag height, as dragging does. */
function pieceAt(s, x, y, width, height) {
  const piece = s.pieceObj, ray = new THREE.Raycaster(), at = new THREE.Vector3();
  ray.setFromCamera(new THREE.Vector2(x / width * 2 - 1, 1 - y / height * 2), camera);
  ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(piece.userData.home.y + 0.35)), at);
  piece.position.copy(at);
  return piece;
}
/** A ring's front band down the middle of the screen, in pixels: where it starts and ends, and its middle. */
function band(s, key, width, height) {
  const [inner, outer] = s.slot(key).radii;
  const at = (r) => pxOf(s, new THREE.Vector3(0, 0, r), width, height);
  return { x: at(inner).x, top: at(inner).y, bottom: at(outer).y, middle: at((inner + outer) / 2).y };
}
const glow = (s, key) => s.slot(key).tap.material.opacity;
/** Let a bit over half a second of frames pass from time t (the glow eases in and out), and return the new time. */
function settle(s, t) {
  for (let i = 1; i <= 12; i++) s.update(0.05, t + i * 0.05);
  return t + 0.6;
}

test('a piece drawn on a ring, or just off it, lands on that ring on both iPads in both orientations', async () => {
  const s = await scene(1, [{ kind: 'rock', size: 'same' }]);
  s.rounds = 1;
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  for (const [width, height] of SIZES) {
    frame(s, camera, width, height);
    const reach = 0.03 * Math.min(width, height);
    const ice = band(s, 'ice', width, height), rock = band(s, 'rock', width, height);
    const at = (x, y) => s.slotAt(pieceAt(s, x, y, width, height));
    const where = (what) => `${width}x${height} ${what}`;
    assert.equal(at(ice.x, ice.middle), 'ice', where('middle of the ice band'));
    assert.equal(at(ice.x, ice.top + 1.5), 'ice', where('inside the ice band, top edge'));
    assert.equal(at(ice.x, ice.bottom - 1.5), 'ice', where('inside the ice band, bottom edge'));
    assert.equal(at(rock.x, rock.middle), 'rock', where('middle of the rock band'));
    assert.equal(at(rock.x, rock.top + 1.5), 'rock', where('inside the rock band, top edge'));
    assert.equal(at(rock.x, rock.bottom - 1.5), 'rock', where('inside the rock band, bottom edge'));
    assert.equal(at(ice.x, ice.top - 0.6 * reach), 'ice', where('above the ice band, within reach'));
    assert.equal(at(rock.x, rock.bottom + 0.6 * reach), 'rock', where('below the rock band, within reach'));
    assert.equal(at(ice.x, ice.top - 1.6 * reach), null, where('well above the ice band'));
    assert.equal(at(rock.x, rock.bottom + 1.6 * reach), null, where('well below the rock band'));
    assert.ok(['ice', 'rock'].includes(at(ice.x, (ice.bottom + rock.top) / 2)), where('between the two rings it is one of them'));
    const planet = pxOf(s, new THREE.Vector3(0, 0, 0), width, height);
    assert.equal(at(planet.x, planet.y), null, where('on the middle of the planet'));
    assert.equal(at(planet.x, planet.y - 40), null, where('on the planet, above the middle'));
    const hidden = pxOf(s, new THREE.Vector3(0, 0, -3.5), width, height);
    assert.equal(at(hidden.x, hidden.y), null, where('on the planet, where the back of the ice ring is hidden behind it'));
    s.pieceObj.position.copy(s.pieceObj.userData.home);
    assert.equal(s.slotAt(s.pieceObj), null, where('the piece let go where it began'));
  }
  ring(s, 'rock').userData.onTap();
  await task;
  stop(s);
});

test('with the ring halves of "both", a piece lands on the half it is drawn over, and near it', async () => {
  const s = await scene(3, [{ kind: 'ice', size: 'big' }]);
  s.rounds = 1;
  s.round(0);
  await until(() => s.phase === 'asking');
  for (const [width, height] of SIZES) {
    frame(s, camera, width, height);
    for (const slot of s.slots) {
      const [inner, outer] = slot.radii, r = (inner + outer) / 2;
      const hole = pxOf(s, new THREE.Vector3(Math.cos(slot.angle) * r, 0, -Math.sin(slot.angle) * r), width, height);
      assert.equal(s.slotAt(pieceAt(s, hole.x, hole.y, width, height)), slot.key, `${width}x${height} ${slot.key}`);
      assert.equal(s.slotAt(pieceAt(s, hole.x, hole.y - 0.02 * Math.min(width, height), width, height)), slot.key, `${width}x${height} ${slot.key}, a little above`);
    }
  }
  stop(s);
});

test('while she drags, exactly the ring the piece would land in lights, and the light goes out when she lets go', async () => {
  const s = await scene(1, [{ kind: 'rock', size: 'same' }]);
  s.rounds = 1;
  const [width, height] = SIZES[0];
  frame(s, camera, width, height);
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  const drag = s.pieceObj.userData.drag;
  s.pieceObj.traverse((o) => { if (o.isMesh) assert.equal(o.material.depthTest, false, 'the piece is drawn over the rings and the planet, so she sees it while she aims'); });
  const ice = band(s, 'ice', width, height), rock = band(s, 'rock', width, height);
  const planet = pxOf(s, new THREE.Vector3(0, 0, 0), width, height);
  let t = 0;
  const lit = (x, y) => {
    drag.onMove(pieceAt(s, x, y, width, height));
    t = settle(s, t);
    return ['ice', 'rock'].filter((key) => glow(s, key) > 0.2);
  };
  assert.deepEqual(lit(ice.x, ice.middle), ['ice']);
  assert.deepEqual(lit(rock.x, rock.middle), ['rock']);
  assert.deepEqual(lit(rock.x, rock.bottom + 8), ['rock'], 'just below the rock ring, it is the ring the piece would land in');
  assert.deepEqual(lit(planet.x, planet.y), [], 'over the planet no ring lights');
  assert.deepEqual(lit(ice.x, ice.middle), ['ice']);
  const piece = pieceAt(s, rock.x, rock.middle, width, height);
  drag.onMove(piece);
  assert.equal(drag.onDrop(piece, piece.position.clone()), true);
  t = settle(s, t);
  assert.ok(glow(s, 'ice') + glow(s, 'rock') < 0.01, 'letting go puts the light out');
  await task;
  assert.equal(s.answers[0].item, 'rock');
  assert.equal(s.answers[0].firstTry, true, 'the ring that lit is the one that was answered');
  stop(s);
});

test('down the border between two rings the lit ring is the one a drop there picks', async () => {
  const s = await scene(1, [{ kind: 'rock', size: 'same' }]);
  s.rounds = 1;
  const [width, height] = SIZES[0];
  frame(s, camera, width, height);
  s.round(0);
  await until(() => s.phase === 'asking');
  const ice = band(s, 'ice', width, height), rock = band(s, 'rock', width, height);
  const drag = s.pieceObj.userData.drag;
  const seen = [];
  for (let y = ice.bottom - 10; y <= rock.top + 10; y += 0.5) {
    const piece = pieceAt(s, ice.x, y, width, height);
    drag.onMove(piece);
    assert.equal(s.lit, s.slotAt(piece), `at ${y.toFixed(1)}`);
    if (seen.at(-1) !== s.lit) seen.push(s.lit);
  }
  assert.deepEqual(seen, ['ice', 'rock'], 'it goes from one ring to the other once, never to none');
  stop(s);
});

test('a drop on no ring floats back with a glow on every ring, counts for nothing, and the piece can be dragged again', async () => {
  const s = await scene(1, [{ kind: 'ice', size: 'same' }]);
  s.rounds = 1;
  const [width, height] = SIZES[0];
  frame(s, camera, width, height);
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  const drag = s.pieceObj.userData.drag;
  let t = settle(s, 10);
  const sky = pieceAt(s, 90, 700, width, height);
  drag.onMove(sky);
  t = settle(s, t);
  assert.equal(glow(s, 'ice') + glow(s, 'rock'), 0, 'nothing lights over empty sky');
  assert.equal(drag.onDrop(sky, sky.position.clone()), false, 'it is not taken, so the drag floats it back');
  s.update(0.05, t + 0.05);
  for (let i = 1; i <= 8; i++) s.update(0.05, t + 0.05 + i * 0.03);
  assert.ok(glow(s, 'ice') > 0.15 && glow(s, 'rock') > 0.15, 'every ring glows, so no answer is shown');
  assert.ok(Math.abs(glow(s, 'ice') - glow(s, 'rock')) < 1e-9);
  t = settle(s, t + 0.5);
  assert.ok(glow(s, 'ice') + glow(s, 'rock') < 0.02, 'and the glow is gone again');
  const planet = pxOf(s, new THREE.Vector3(0, 0, 0), width, height);
  const onPlanet = pieceAt(s, planet.x, planet.y, width, height);
  assert.equal(drag.onDrop(onPlanet, onPlanet.position.clone()), false, 'on the planet');
  assert.equal(s.learn.current.wrong, 0, 'neither drop counts as an answer');
  assert.equal(s.phase, 'asking');
  assert.ok(s.tappables.includes(s.pieceObj), 'the piece can be taken again');
  const ice = band(s, 'ice', width, height);
  const again = pieceAt(s, ice.x, ice.middle, width, height);
  drag.onMove(again);
  assert.equal(s.lit, 'ice');
  assert.equal(drag.onDrop(again, again.position.clone()), true, 'and dropped on its ring');
  await task;
  assert.equal(s.answers[0].item, 'ice');
  stop(s);
});

test('a ring at rest is not drawn, and still takes a tap', async () => {
  const s = await scene(1, [{ kind: 'ice', size: 'same' }]);
  s.rounds = 1;
  const [width, height] = SIZES[0];
  frame(s, camera, width, height);
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  settle(s, 0);
  assert.equal(s.slots.some((slot) => slot.tap.material.visible), false);
  const ice = band(s, 'ice', width, height), ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(ice.x / width * 2 - 1, 1 - ice.middle / height * 2), camera);
  assert.equal(ray.intersectObjects(s.tappables, false)[0]?.object, s.slot('ice').tap, 'a tap on the ring finds it');
  ring(s, 'ice').userData.onTap();
  await task;
  assert.equal(s.answers[0].item, 'ice');
  stop(s);
});

test('the bands a drop is judged on are the bands a tap is taken on', async () => {
  for (const level of [1, 3]) {
    const s = await scene(level);
    frame(s);
    const ray = new THREE.Raycaster(), taps = s.slots.map((slot) => slot.tap);
    let agreed = 0;
    for (let radius = 2.5; radius < 6; radius += 0.1) {
      for (let angle = 0.05; angle < Math.PI * 2; angle += 0.1) {
        const edge = s.slots.some(({ radii: [inner, outer], arc: [from, length] }) => Math.min(Math.abs(radius - inner), Math.abs(radius - outer)) < 0.06
          || [from, from + length].some((end) => Math.abs((((angle - end) % (Math.PI * 2)) + Math.PI * 2 + Math.PI) % (Math.PI * 2) - Math.PI) * radius < 0.06));
        if (edge) continue;
        const x = Math.cos(angle) * radius, z = -Math.sin(angle) * radius;
        const seen = s.saturn.localToWorld(new THREE.Vector3(x, 0, z));
        ray.set(camera.position, seen.sub(camera.position).normalize());
        const tapped = ray.intersectObjects(taps, false)[0]?.object.userData.choice ?? null;
        assert.equal(slotAtPoint(s.slots, x, z), tapped, `level ${level}, radius ${radius.toFixed(1)}, angle ${angle.toFixed(2)}`);
        agreed++;
      }
    }
    assert.ok(agreed > 1000);
    stop(s);
  }
});

test('a tap on the planet is never an answer, also over the back of a ring', async () => {
  const s = await scene(2, [{ kind: 'ice', size: 'big' }]);
  s.rounds = 1;
  const cam = frame(s);
  const task = s.round(0);
  await until(() => s.phase === 'asking');
  const ray = new THREE.Raycaster();
  for (const local of [new THREE.Vector3(0, 0.4, 0.5), new THREE.Vector3(-1.2, 0.9, 1.2), new THREE.Vector3(0, 0, -3.47)]) {
    const p = s.saturn.localToWorld(local).project(cam);
    ray.setFromCamera(new THREE.Vector2(p.x, p.y), cam);
    const hit = ray.intersectObjects(s.tappables, false)[0];
    assert.equal(hit?.object, s.planet, `the planet takes the tap at ${local.toArray()}`);
  }
  s.planet.userData.onTap(s.planet);
  assert.equal(s.learn.current.wrong, 0);
  assert.equal(s.answers.length, 0);
  ring(s, 'ice').userData.onTap();
  await task;
  stop(s);
});

test('named pieces ask for their ring; unnamed pieces ask what it is; the bubble shows the kind only when it is named', async () => {
  const named = await scene(1, [{ kind: 'rock', size: 'same' }]);
  named.rounds = 1;
  let task = named.round(0);
  await until(() => named.phase === 'asking');
  assert.ok(globalThis.__lines.includes('To jest skała.'));
  assert.ok(globalThis.__lines.includes('Gdzie jest skalny pierścień?'));
  assert.equal(globalThis.__bubble.big, '🪨');
  ring(named, 'rock').userData.onTap();
  await task;
  stop(named);

  globalThis.__lines = [];
  const plain = await scene(2, [{ kind: 'ice', size: 'small' }]);
  plain.rounds = 1;
  task = plain.round(0);
  await until(() => plain.phase === 'asking');
  assert.ok(globalThis.__lines.includes('Lód czy skała? Gdzie to pasuje?'));
  assert.equal(globalThis.__bubble.big, '?', 'the question is hers');
  plain.runAssist('hint');
  assert.ok(globalThis.__lines.includes('To jest lód.'));
  assert.ok(globalThis.__lines.includes('Gdzie jest lodowy pierścień?'));
  ring(plain, 'ice').userData.onTap();
  await task;
  stop(plain);
});

test('sorting by both: a big ice piece goes in the ice ring\'s big hole; the kind alone or the size alone is wrong', async () => {
  globalThis.__lines = [];
  const s = await scene(3, [{ kind: 'ice', size: 'big' }, { kind: 'rock', size: 'small' }]);
  s.rounds = 2;
  frame(s);
  let task = s.round(0);
  await until(() => s.phase === 'asking');
  assert.deepEqual(s.tappables.filter((o) => o.userData.choice).map((o) => o.userData.choice).sort(), ['ice:big', 'ice:small', 'rock:big', 'rock:small']);
  assert.equal(s.last, 'ice:big');
  assert.ok(globalThis.__lines.includes('Lód czy skała? Duży czy mały?'));
  assert.equal(globalThis.__bubble.big, '?');
  ring(s, 'ice:small').userData.onTap();
  await until(() => s.pieceObj.position.distanceTo(s.pieceObj.userData.home) < 0.02);
  ring(s, 'rock:big').userData.onTap();
  await until(() => s.pieceObj.position.distanceTo(s.pieceObj.userData.home) < 0.02);
  assert.equal(s.learn.current.wrong, 2);
  assert.equal(s.aid.state.level, 2);
  assert.equal(globalThis.__lines.at(-1), 'To duży kawałek lodu.', 'the middle step names the piece, not the hole');
  assert.equal(s.slot('ice:big').gap.userData.hinting, undefined, 'nothing glows yet');
  assert.equal(dropOver(s, new THREE.Vector3(-3.47, 0, 0)), true, 'the left half of the ice ring holds its big hole');
  await task;
  assert.equal(s.answers[0].item, 'ice:big');
  assert.equal(s.slot('ice:big').filled, 1);
  task = s.round(1);
  await until(() => s.phase === 'asking');
  assert.equal(s.last, 'rock:small');
  for (let i = 0; i < 3; i++) { ring(s, 'rock:big').userData.onTap(); await until(() => s.pieceObj.position.distanceTo(s.pieceObj.userData.home) < 0.02); }
  for (let i = 0; i < 5; i++) { s.update(0.05, 1 + i * 0.05); await flush(); }
  assert.ok(s.slot('rock:small').gap.userData.hinting, 'the third miss makes the right hole glow');
  assert.notEqual(s.slot('rock:small').gap.material.color.getHexString(), '7a58c4');
  ring(s, 'rock:small').userData.onTap();
  await task;
  for (let i = 0; i < 2; i++) { s.update(0.05, 2 + i * 0.05); await flush(); }
  assert.equal(s.slot('rock:small').gap.material.color.getHexString(), '7a58c4', 'the glow stops once she fills it');
  stop(s);
});

test('a run cut short still closes every hole before "naprawione!"', async () => {
  const s = await scene(4);
  await s.outro();
  assert.ok(s.slots.every((x) => !x.gap.visible));
  stop(s);
});

test('every Saturn level runs through base progress and celebration, and counts for the session', async () => {
  for (let level = 1; level <= 4; level++) {
    CONFIG.level = level;
    startSession();
    let homes = 0;
    const again = [];
    const s = new SaturnMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    s.L = LEVELS.saturn[level - 1];
    s.rounds = s.L.pieces;
    s.plan = saturnPieces(s.L, () => 0.37);
    const events = [];
    const unsubscribe = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 600 && !globalThis.__celebration; step++) {
      if (s.phase === 'asking') await ring(s, s.last).userData.onTap();
      s.update(0.05, step * 0.05);
      await flush();
    }
    const pieces = LEVELS.saturn[level - 1].pieces;
    assert.ok(globalThis.__celebration, `level ${level} celebrated: ${s.phase}, round ${s.roundIndex}, ${s.answers.length} answers`);
    assert.deepEqual(globalThis.__progress, Array.from({ length: pieces }, (_, i) => i + 1));
    assert.equal(globalThis.__celebration.kind, 'saturn');
    assert.equal(events.filter((e) => e.correct).length, pieces);
    assert.equal(scoreRun(s.answers).scored, pieces);
    assert.ok(s.answers.every((a) => a.scored && a.skill === 'sorting'));
    assert.deepEqual([...new Set(s.answers.map((a) => a.item.split(':')[0]))].sort(), ['ice', 'rock']);
    if (s.L.sort === 'both') assert.deepEqual([...new Set(s.answers.map((a) => a.item.split(':')[1]))].sort(), ['big', 'small']);
    assert.equal(getSession().missionsCompleted, 1);
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['saturn']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    unsubscribe(); stop(s); await flush();
  }
  CONFIG.level = null;
});

test('Saturn has no shadows or point lights and its ring taps are big enough on both iPads', async () => {
  const s = await scene(4);
  let shadows = 0, pointLights = 0, draws = 0;
  s.scene.traverse((o) => { if (o.castShadow || o.receiveShadow) shadows++; if (o.isPointLight) pointLights++; });
  s.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.equal(shadows, 0);
  assert.equal(pointLights, 0);
  assert.ok(draws + 20 < 100, `${draws} scene calls plus 20 reserved for medium postprocessing`);
  for (const [width, height] of [[1180, 820], [1366, 1024]]) {
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    const direction = s.view.pos.clone().sub(s.view.look);
    direction.setLength(Math.max(direction.length(), s.view.minWidth / (2 * Math.tan(Math.PI * 21 / 180) * camera.aspect)));
    camera.position.copy(s.view.look).add(direction); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
    for (const { key: kind, tap } of s.slots) {
      tap.updateWorldMatrix(true, true);
      const points = [];
      const position = tap.geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(tap.matrixWorld).project(camera));
      const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
      assert.ok((Math.max(...xs) - Math.min(...xs)) * width / 2 >= 70, `${width}x${height} ${kind} width`);
      assert.ok((Math.max(...ys) - Math.min(...ys)) * height / 2 >= 70, `${width}x${height} ${kind} height`);
    }
  }
  stop(s);
});
