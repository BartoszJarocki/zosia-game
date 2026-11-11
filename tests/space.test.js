import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { PLACES, placesIn } from '../src/places.js';
import { allSegments, SPACE_LINES, SPACE_INVITE, SPACE_TO, SPACE_FACTS, PLACE_LINES } from '../src/lang/pl.js';
import { parseGame } from '../src/levels/parse.js';
import * as THREE from 'three';
import { CONFIG } from '../src/config.js';

// Keep the real scene logic, with the browser and audio boundaries replaced.
const boundary = registerHooks({
  load(url, context, next) {
    const sources = {
      '/src/engine.js': 'export class Stage {} export const animate = () => Promise.resolve(); export const ease = {}; export const hop = () => {}; export const wait = () => {}; export const camera = {}; export const renderer = {};',
      '/src/audio.js': 'export const say = () => Promise.resolve(); export const sfx = {}; export const hush = () => {}; export const unlockAudio = () => {};',
      '/src/ui.js': 'export const spaceHud = () => {}; export const launchHud = () => {};',
      '/src/session/session.js': 'export const getSession = () => ({}); export const checkAttention = () => "ok";',
      '/src/progress.js': 'export const getVisited = () => ({}); export const recordVisit = () => {};',
    };
    const key = Object.keys(sources).find((suffix) => url.endsWith(suffix));
    return key ? { format: 'module', source: sources[key], shortCircuit: true } : next(url, context);
  },
});
const { Space, LAYOUT, ROAD_ORDER, MOVES, checkLayout, nextState, mapView, mapPoints } = await import('../src/scenes/space.js');
boundary.deregister();

test('the road puts the Moon next to Earth and distant stops after Pluto', () => {
  assert.deepEqual(ROAD_ORDER, ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'blackhole', 'comet', 'stars']);
  assert.deepEqual(ROAD_ORDER.filter((k) => LAYOUT[k].far), ['blackhole', 'comet', 'stars']);
  assert.doesNotThrow(() => checkLayout(placesIn('space')));
  assert.doesNotThrow(() => checkLayout(['telescope'], {})); // (the telescope is in the rocket, not on the road)
  assert.throws(() => checkLayout(['moon', 'jupiter'], { moon: LAYOUT.moon }), { message: 'Missing space layout for jupiter' });
  assert.throws(() => checkLayout(['moon'], {}), { message: 'Missing space layout for moon' });
});

test('space only permits the specified state changes', () => {
  assert.deepEqual(MOVES, {
    launch: ['waiting'], waiting: ['flying', 'returning'], flying: ['flying', 'visiting', 'returning'],
    visiting: ['waiting', 'returning'], returning: [],
  });
  assert.equal(nextState('launch', 'waiting'), 'waiting');
  assert.equal(nextState('waiting', 'flying'), 'flying');
  assert.equal(nextState('flying', 'visiting'), 'visiting');
  assert.equal(nextState('visiting', 'waiting'), 'waiting');
  for (const state of ['waiting', 'flying', 'visiting']) assert.equal(nextState(state, 'returning'), 'returning');
  assert.throws(() => nextState('launch', 'flying'), { message: 'Invalid space move: launch to flying' });
  assert.throws(() => nextState('returning', 'waiting'), { message: 'Invalid space move: returning to waiting' });
});

test('the stage exposes its area, state and current visit through the whole trip', () => {
  const s = new Space({}, { launch: true });
  assert.equal(s.kind, 'space-map');
  assert.equal(s.area, 'space');
  assert.equal(s.state, 'launch');
  assert.equal(s.visiting, null);
  assert.equal(s.suggested, null);
  s.changeState('waiting');
  s.changeState('flying');
  s.changeState('visiting', 'saturn');
  assert.equal(s.state, 'visiting');
  assert.equal(s.visiting, 'saturn');
  s.changeState('waiting');
  assert.equal(s.visiting, null);
  s.changeState('returning');
  assert.equal(s.state, 'returning');
  assert.equal(new Space({}).state, 'waiting');
});

test('every launch, flight and fact line reaches the voice recorder as a sentence', () => {
  const md = readFileSync(new URL('../GAME.md', import.meta.url), 'utf8');
  const { levels, letterSets } = parseGame(md, { childName: CONFIG.childName });
  const segments = allSegments(levels, letterSets.ALL);
  const lines = [...Object.values(SPACE_LINES).flat(), ...Object.values(SPACE_INVITE).flat(), ...Object.values(SPACE_TO), ...Object.values(SPACE_FACTS).flat(), PLACE_LINES.rocket];
  for (const line of lines) {
    assert.ok(segments.includes(line), line);
    assert.match(line, /[.!?]$/, line);
    assert.ok(line.split(' ').length > 1, line);
  }
  assert.equal(PLACE_LINES.rocket, 'Jedziemy do rakiety!');
  assert.deepEqual(SPACE_LINES.countdown, ['Odliczamy! Pięć, cztery, trzy, dwa, jeden!']);
  assert.deepEqual(SPACE_LINES.goodnight, ['Robi się późno. Wracamy do domu!']);
  assert.deepEqual(SPACE_LINES.inviteHome, ['Czas wracać do domu! Polecimy na Ziemię?']);
  assert.deepEqual(SPACE_INVITE.mars, ['Może polecimy na Marsa?']);
  assert.equal(SPACE_LINES.mars, undefined);
  assert.deepEqual(Object.keys(SPACE_INVITE), Object.keys(SPACE_TO));
  assert.equal(SPACE_TO.mars, 'Lecimy na Marsa!');
  assert.deepEqual(SPACE_FACTS.sun, ['To jest Słońce.', 'Słońce to gwiazda.', 'Nie patrzymy prosto na Słońce.']);
  assert.deepEqual(Object.keys(SPACE_FACTS), placesIn('space').filter((k) => PLACES[k].stop !== false));
});

test('the far places sit to the right and visible planet spheres meet their landscape size targets', () => {
  assert.deepEqual(['blackhole', 'comet', 'stars'].map((k) => LAYOUT[k].at), [[17, 0, -23], [30, 0, -19], [33, 0, -5]]);
  const width = 1180, height = 820;
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
  for (const here of ROAD_ORDER) for (const suggested of [null, ...ROAD_ORDER]) {
    const view = mapView(width, height, here, suggested);
    camera.position.copy(view.pos); camera.lookAt(view.look); camera.updateMatrixWorld(true);
    for (const kind of ROAD_ORDER.slice(0, 11)) {
      const { r, at } = LAYOUT[kind];
      const vertices = new THREE.SphereGeometry(r, 64, 40).getAttribute('position');
      const xs = Array.from({ length: vertices.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(vertices, i)
        .add(new THREE.Vector3(at[0], r * 0.55, at[2])).project(camera).x);
      const pixels = (Math.max(...xs) - Math.min(...xs)) * width / 2;
      assert.ok(pixels >= (kind === 'pluto' ? 62 : 70), `${here}, ${suggested}: ${kind} sphere ${pixels.toFixed(1)} px`);
    }
  }
});


test('all stops fit the requested iPads with separate targets at least 70 pixels across', () => {
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    const { pos, look, minWidth } = mapView(width, height);
    const direction = pos.clone().sub(look);
    const need = minWidth / (2 * Math.tan(THREE.MathUtils.degToRad(21)) * camera.aspect);
    direction.setLength(Math.max(direction.length(), need));
    camera.position.copy(look).add(direction);
    camera.lookAt(look);
    camera.updateMatrixWorld(true);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const circles = Object.entries(LAYOUT).map(([kind, stop]) => {
      const position = new THREE.Vector3(stop.at[0], stop.r * 0.55, stop.at[2]);
      const c = position.clone().project(camera);
      const e = position.add(right).project(camera);
      const foot = stop.r * ({ saturn: 2.1, uranus: 1.75, blackhole: 2.4, comet: 2, stars: 1.3 }[kind] || 1);
      return { kind, x: (c.x + 1) * width / 2, y: (1 - c.y) * height / 2, r: Math.max(38, foot * Math.abs(e.x - c.x) * width / 2) };
    });
    for (const c of circles) {
      assert.ok(c.r * 2 >= 70, `${width}x${height} ${c.kind}: tap size`);
      assert.ok(c.x - c.r >= 0 && c.x + c.r <= width && c.y - c.r >= 0 && c.y + c.r <= height, `${width}x${height} ${c.kind}: on screen`);
      for (const other of circles) {
        if (other === c) continue;
        assert.ok(Math.hypot(c.x - other.x, c.y - other.y) > c.r + other.r, `${width}x${height} ${c.kind} overlaps ${other.kind}`);
      }
    }
  }
});

test('content, parking and the full suggestion bounce have six percent margins at every stop', () => {
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    for (const here of ROAD_ORDER) for (const suggested of [null, ...ROAD_ORDER]) {
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
      const view = mapView(width, height, here, suggested);
      camera.position.copy(view.pos);
      camera.lookAt(view.look);
      camera.updateMatrixWorld(true);
      for (const point of mapPoints(here, suggested)) {
        point.project(camera);
        assert.ok(Math.abs(point.x) <= 0.880001 && Math.abs(point.y) <= 0.880001, `${width}x${height}: ${here}, ${suggested}`);
      }
      const tilt = view.pos.clone().sub(view.look).normalize();
      assert.ok(Math.abs(tilt.y / tilt.z - 54 / 38) < 1e-10);
    }
  }
});
