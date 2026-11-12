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

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const renderer = {};
    export const post = { tier: 'medium' };
    export const ease = { inOut: (x) => x, linear: (x) => x, out: (x) => x };
    export const animate = async (ms, fn) => {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t);
    };
    export const wait = () => new Promise(setImmediate);
    export const hop = async (obj) => { globalThis.__hops.push(obj.userData.place); }; 
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push(...[s].flat()); };
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

const { TelescopeMission } = await import('../src/scenes/telescope.js');
const { Space, checkLayout, ROAD_ORDER } = await import('../src/scenes/space.js');
const { itemsFor } = await import('../src/levels/telescope.js');
const { CONFIG } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/data.js');
const { NO } = await import('../src/lang/pl.js');
const { PLACES } = await import('../src/places.js');
const { learning } = await import('../src/learning/events.js');
const { startSession, getSession } = await import('../src/session/session.js');
const { suggestNext } = await import('../src/session/director.js');
const { optimizeScene } = await import('../src/fx/optimize.js');
const flush = () => new Promise(setImmediate);
const stop = (s) => { s.alive = false; s.exit(); };
const scene = (level) => {
  CONFIG.level = level;
  globalThis.__lines = [];
  globalThis.__hops = [];
  const s = new TelescopeMission({});
  s.build(); s.collect(); optimizeScene(s.scene);
  return s;
};

test('matching shows a painted copy and records recognition with the actual choices', async () => {
  const s = scene(1);
  s.pick = (skill, pool) => { assert.equal(skill, 'space'); assert.deepEqual(pool, ['sun', 'earth', 'moon', 'saturn']); return 'saturn'; };
  const round = s.round(0);
  assert.equal(s.last, 'saturn');
  assert.deepEqual(globalThis.__lines, ['Patrzymy przez teleskop!', 'Znajdź taki sam!']);
  assert.equal(s.scene.children.filter((o) => o.userData.place === 'saturn').length, 2);
  assert.equal(s.tappables.filter((o) => o.userData.place === 'saturn').length, 1);
  await s.choices.find((o) => o.userData.place === 'saturn').userData.onTap();
  await round;
  assert.deepEqual(globalThis.__hops, ['saturn']);
  assert.equal(globalThis.__lines.at(-1), 'Tak! To jest Saturn.');
  assert.deepEqual(s.answers.map((e) => [e.skill, e.item, e.options, e.firstTry]), [['space', 'saturn', 2, true]]);
  assert.equal(s.tappables.length, 0);
  assert.equal(s.choices.length, 0);
  stop(s);
});

test('a wrong choice uses the base help ladder, removes a foil and reveals the answer', async () => {
  const s = scene(3);
  s.pick = () => 'earth';
  const round = s.round(1);
  const wrong = s.choices.filter((o) => o.userData.place !== 'earth');
  await wrong[0].userData.onTap();
  assert.equal(s.learn.current.wrong, 1);
  assert.ok(NO.includes(globalThis.__lines.at(-2)));
  assert.equal(globalThis.__lines.at(-1), 'Gdzie jest Ziemia?');
  await wrong[1].userData.onTap();
  await flush();
  assert.equal(s.learn.current.assist, 2);
  assert.equal(wrong[1].parent, null);
  s.runAssist('reveal');
  const right = s.choices.find((o) => o.userData.place === 'earth');
  assert.equal(right.userData.hinting, true);
  await right.userData.onTap();
  await round;
  assert.equal(s.answers[0].firstTry, false);
  assert.equal(s.answers[0].assistLevel, 3);
  stop(s);
});

test('order picks namespaced sequence items and records the predecessor, exposing the answer for the walker', async () => {
  const s = scene(6);
  s.pick = (skill, pool) => { assert.equal(skill, 'sequence'); assert.deepEqual(pool, ['space:mercury', 'space:venus', 'space:earth', 'space:mars', 'space:jupiter', 'space:saturn', 'space:uranus']); return 'space:mars'; };
  const round = s.round(1);
  assert.equal(s.last, 'jupiter');
  assert.deepEqual(globalThis.__lines, ['Co jest po Marsie?']);
  await s.choices.find((o) => o.userData.place === s.last).userData.onTap();
  await round;
  assert.deepEqual(s.answers.map((e) => [e.skill, e.item, e.chosen]), [['sequence', 'space:mars', 'jupiter']]);
  stop(s);
});

const roadThings = (s) => s.scene.children.filter((o) => o.userData.road);
const roadOrder = (s) => roadThings(s).sort((a, b) => a.position.x - b.position.x).map((o) => o.userData.road);

test('an order round shows the road from the Sun with the asked place empty, and the choices below it', async () => {
  const s = scene(6);
  s.pick = () => 'space:venus';
  const round = s.round(1);
  assert.equal(s.last, 'earth');
  assert.deepEqual(roadOrder(s), ['sun', 'mercury', 'venus', 'gap', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  assert.ok(!roadOrder(s).includes('earth'), 'the answer is not on the road');
  const road = roadThings(s);
  assert.ok(road.every((o) => o.userData.place === undefined), 'a road place is never a choice');
  assert.equal(s.tappables.filter((o) => o.userData.place).length, 3, 'three choices');
  const top = Math.min(...s.choices.map((o) => o.position.y)), roadY = road[0].position.y;
  assert.ok(roadY - 1 > Math.max(...s.choices.map((o) => o.position.y)), 'the road is above the choices');
  assert.ok(road.every((o) => Math.hypot(o.position.x, o.position.y) < 7.5), 'inside the eyepiece');
  assert.ok(top < 0);
  assert.deepEqual(globalThis.__lines, ['Co jest po Wenus?']);
  await s.choices.find((o) => o.userData.place === 'earth').userData.onTap();
  await round;
  assert.equal(roadThings(s).length, 0, 'the road goes with the round');
  assert.equal(s.scene.children.filter((o) => o.userData.place).length, 0);
  assert.equal(globalThis.__lines.at(-1), 'Tak! To jest Ziemia.');
  stop(s);
});

test('the road follows the level\'s planets and puts the empty place at the asked one, wherever it is', async () => {
  const s = scene(6);
  for (const after of ['mercury', 'earth', 'uranus']) {
    s.pick = () => `space:${after}`;
    const round = s.round(1);
    const target = s.last;
    const order = roadOrder(s);
    assert.equal(order.length, 9);
    assert.equal(order[0], 'sun');
    assert.equal(order[order.indexOf('gap') - 1], after, 'the place before the gap is the one asked about');
    assert.equal(order.filter((k) => k === 'gap').length, 1);
    assert.ok(!order.includes(target));
    await s.choices.find((o) => o.userData.place === target).userData.onTap();
    await round;
  }
  stop(s);
});

test('the road is only there for order rounds', async () => {
  for (const level of [1, 2, 3, 4, 5]) {
    const s = scene(level);
    s.round(1);
    assert.equal(roadThings(s).length, 0, `level ${level}`);
    stop(s);
  }
});

test('a place on the road says its name when tapped, and is not an answer', async () => {
  const s = scene(6);
  s.pick = () => 'space:venus';
  const round = s.round(1);
  const venus = roadThings(s).find((o) => o.userData.road === 'venus');
  assert.ok(s.tappables.includes(venus));
  await venus.userData.onTap();
  assert.equal(globalThis.__lines.at(-1), 'To jest Wenus.');
  assert.equal(s.learn.current.wrong, 0);
  assert.equal(s.answers.length, 0);
  await roadThings(s).find((o) => o.userData.road === 'sun').userData.onTap();
  assert.equal(globalThis.__lines.at(-1), 'To jest Słońce.');
  await roadThings(s).find((o) => o.userData.road === 'gap').userData.onTap();
  assert.deepEqual(globalThis.__lines.slice(-1), ['Co jest po Wenus?'], 'the empty place asks the question again');
  await s.choices.find((o) => o.userData.place === 'earth').userData.onTap();
  await round;
  stop(s);
});

test('the clue for an order round walks the road from the Sun to the empty place, and never shows the answer', async () => {
  const s = scene(6);
  s.pick = () => 'space:venus';
  const round = s.round(1);
  const lit = [];
  const gap = roadThings(s).find((o) => o.userData.road === 'gap');
  const before = new Map(roadThings(s).map((o) => [o.userData.road, o.scale.x]));
  s.runAssist('hint');
  assert.deepEqual(globalThis.__lines.slice(-1), ['Co jest po Wenus?']);
  for (let i = 0; i < 80; i++) {
    for (const o of roadThings(s)) if (o.scale.x > before.get(o.userData.road) * 1.3) lit.push(o.userData.road);
    await flush();
  }
  const seen = [...new Set(lit)].filter((k) => k !== 'gap');
  assert.ok(seen.includes('sun') && seen.includes('venus'), `the walk lit ${seen.join(', ')}`);
  assert.ok(!seen.includes('earth') && !seen.includes('mars'));
  assert.equal(s.choices.filter((o) => o.userData.hinting).length, 0, 'no choice is shown');
  assert.ok(gap);
  await s.choices.find((o) => o.userData.place === 'earth').userData.onTap();
  await round;
  stop(s);
});

test('the road leaves room: the choices stay 120 px wide and apart, below the road, at both iPad sizes', async () => {
  for (const [width, height] of [[1180, 820], [1366, 1024]]) {
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    const s = scene(6);
    camera.position.copy(s.view.pos); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
    for (const after of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus']) {
      s.pick = () => `space:${after}`;
      const round = s.round(1);
      const roadBottom = Math.max(...roadThings(s).map((o) => bounds(o, camera, width, height).bottom));
      const placesWide = roadThings(s).map((o) => bounds(o, camera, width, height)).map((b) => b.right - b.left);
      assert.ok(Math.min(...placesWide) >= 44, `${width}: a road place is ${Math.min(...placesWide).toFixed(0)} px`);
      for (const obj of s.choices) {
        const b = bounds(obj, camera, width, height);
        assert.ok(b.right - b.left >= 120);
        assert.ok(b.top > roadBottom, `${width} ${after}: a choice reaches up to ${b.top.toFixed(0)} px, the road ends at ${roadBottom.toFixed(0)}`);
        for (const other of s.choices.filter((o) => o !== obj)) {
          const c = bounds(other, camera, width, height);
          assert.ok(b.right < c.left || b.left > c.right || b.bottom < c.top || b.top > c.bottom, 'choices overlap');
        }
      }
      await s.choices.find((o) => o.userData.place === s.last).userData.onTap();
      await round;
    }
    stop(s);
  }
});

test('every telescope level completes with the real picker, progress, session and base celebration', async () => {
  for (let level = 1; level <= 6; level++) {
    CONFIG.level = level;
    globalThis.__hops = [];
    startSession();
    let homes = 0;
    const again = [], events = [];
    const s = new TelescopeMission({ home() { homes++; }, startMission(kind) { again.push(kind); } });
    const off = learning.subscribe((e) => events.push(e));
    s.enter(); s.collect(); optimizeScene(s.scene);
    for (let step = 0; step < 250 && !globalThis.__celebration; step++) {
      const right = s.choices.find((o) => o.userData.place === s.last && o.userData.onTap);
      if (right) await right.userData.onTap();
      s.update(0.05, step * 0.05);
      await flush();
    }
    assert.equal(globalThis.__celebration?.kind, 'telescope');
    assert.deepEqual(globalThis.__progress, level < 3 ? [1, 2, 3, 4] : [1, 2, 3, 4, 5]);
    assert.equal(events.filter((e) => e.correct).length, LEVELS.telescope[level - 1].rounds);
    assert.ok(events.every((e) => e.skill === (level === 6 ? 'sequence' : 'space')));
    assert.equal(getSession().missionsCompleted, 1);
    assert.equal(globalThis.__lines.includes('Brawo! Znasz już kosmos!'), true);
    globalThis.__celebration.onAgain();
    assert.deepEqual(again, ['telescope']);
    globalThis.__celebration.onHome();
    globalThis.__hud.onHome();
    assert.equal(homes, 2);
    stop(s); off(); await flush();
  }
});

function bounds(obj, camera, width, height) {
  const points = [];
  obj.updateWorldMatrix(true, true);
  obj.traverseVisible((part) => {
    if (part.userData.decorative || part.material?.visible === false) return;
    if (part.isSprite) {
      const center = part.getWorldPosition(new THREE.Vector3());
      const scale = part.getWorldScale(new THREE.Vector3());
      for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) points.push(center.clone().add(new THREE.Vector3(x * scale.x, y * scale.y, 0)).project(camera));
      return;
    }
    if (!part.geometry) return;
    const pos = part.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(part.matrixWorld).project(camera));
  });
  const xs = points.map((p) => (p.x + 1) * width / 2), ys = points.map((p) => (1 - p.y) * height / 2);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

test('choices are separate, at least 120 px, and Jupiter is clearly larger for its feature question', async () => {
  for (const [width, height] of [[1180, 820], [1366, 1024]]) {
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    for (let level = 1; level <= 6; level++) {
      const s = scene(level);
      camera.position.copy(s.view.pos); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
      for (const kind of s.L.pool) {
        if (s.L.ask === 'order' && kind === 'neptune') continue;
        s.pick = () => s.L.ask === 'order' ? `space:${kind}` : kind;
        const round = s.round(1);
        for (const obj of s.choices) {
          const b = bounds(obj, camera, width, height);
          assert.ok(b.right - b.left >= 120, `${width} ${kind} ${obj.userData.place}: ${b.right - b.left}`);
          for (const other of s.choices.filter((o) => o !== obj)) {
            const c = bounds(other, camera, width, height);
            assert.ok(b.right < c.left || b.left > c.right || b.bottom < c.top || b.top > c.bottom, `${kind}: choices overlap`);
          }
        }
        if (level === 4 && kind === 'jupiter') {
          const widths = s.choices.map((obj) => { const b = bounds(obj, camera, width, height); return [obj.userData.place, b.right - b.left]; });
          const jupiter = widths.find(([k]) => k === 'jupiter')[1];
          assert.ok(widths.filter(([k]) => k !== 'jupiter').every(([, w]) => jupiter >= w * 1.4));
        }
        await s.choices.find((o) => o.userData.place === s.last).userData.onTap();
        await round;
      }
      stop(s);
    }
  }
});

test('the telescope has no shadows or point lights and stays below the medium draw budget', () => {
  const s = scene(3);
  s.L = { ...s.L, pool: ['saturn', 'uranus', 'blackhole', 'comet'], choices: 4 };
  s.pick = () => 'saturn';
  s.round(1);
  const choice = s.choices.find((o) => o.userData.place === 'saturn');
  s.success(choice.position, { big: true });
  let draws = 0;
  s.scene.traverseVisible((o) => {
    assert.equal(o.castShadow, false);
    assert.equal(o.receiveShadow, false);
    assert.ok(!o.isPointLight);
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.ok(draws + 20 < 100, `${draws} plus 20 medium post passes`);
  stop(s);
});

test('an order round with its whole road stays below the medium draw budget', () => {
  const s = scene(6);
  s.pick = () => 'space:saturn';
  s.round(1);
  let draws = 0;
  s.scene.traverseVisible((o) => {
    assert.equal(o.castShadow, false);
    assert.ok(!o.isPointLight);
    if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return;
    for (const m of [o.material].flat()) if (m.visible) draws += m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1;
  });
  assert.ok(draws + 20 < 100, `${draws} plus 20 medium post passes`);
  stop(s);
});

test('telescope is suggested as a space game, but is never a road stop', () => {
  assert.equal(PLACES.telescope.domain, 'space');
  assert.doesNotThrow(() => checkLayout(['telescope']));
  assert.equal(ROAD_ORDER.includes('telescope'), false);
  startSession();
  assert.equal(suggestNext(getSession(), ['telescope']), 'telescope');
  const starts = [];
  const map = new Space({ startMission(kind) { starts.push(kind); } }, { at: 'saturn' });
  const index = map.routeIndex;
  map.openTelescope();
  assert.deepEqual(starts, ['telescope']);
  assert.equal(map.routeIndex, index);
  assert.equal(map.at, 'saturn');
  map.state = 'flying';
  map.openTelescope();
  assert.deepEqual(starts, ['telescope']);
});

test('every painted choice can be hit at its centre, including four-choice matching', async () => {
  const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
  for (const ask of ['name', 'match']) {
    const s = scene(5);
    camera.position.copy(s.view.pos); camera.lookAt(s.view.look); camera.updateMatrixWorld(true);
    s.L = { ...s.L, ask, choices: 4 };
    for (const kind of itemsFor(s.L)) {
      s.pick = () => kind;
      const round = s.round(1);
      s.scene.updateMatrixWorld(true);
      for (const obj of s.choices) {
        const point = obj.getWorldPosition(new THREE.Vector3()).project(camera);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(point.x, point.y), camera);
        const hits = ray.intersectObjects(s.tappables, true);
        assert.ok(hits.length);
        let hit = hits[0].object;
        while (hit && !hit.userData.onTap) hit = hit.parent;
        assert.equal(hit, obj);
        const b = bounds(obj, camera, 1180, 820);
        assert.ok(b.right - b.left >= 120);
        for (const other of s.choices.filter((o) => o !== obj)) {
          const c = bounds(other, camera, 1180, 820);
          assert.ok(b.right < c.left || b.left > c.right || b.bottom < c.top || b.top > c.bottom);
        }
      }
      await s.choices.find((o) => o.userData.place === s.last).userData.onTap();
      await round;
    }
    stop(s);
  }
});
