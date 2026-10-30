import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { placesIn } from '../src/places.js';
import { allSegments, SPACE_LINES, SPACE_TO, SPACE_PASS, SPACE_FACTS, PLACE_LINES } from '../src/lang/pl.js';
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
    };
    const key = Object.keys(sources).find((suffix) => url.endsWith(suffix));
    return key ? { format: 'module', source: sources[key], shortCircuit: true } : next(url, context);
  },
});
const { Space, LAYOUT, ROAD_ORDER, MOVES, checkLayout, nextState, flightStops } = await import('../src/scenes/space.js');
boundary.deregister();

test('the road puts the Moon next to Earth and distant stops after Pluto', () => {
  assert.deepEqual(ROAD_ORDER, ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'blackhole', 'comet', 'stars']);
  assert.deepEqual(ROAD_ORDER.filter((k) => LAYOUT[k].far), ['blackhole', 'comet', 'stars']);
  assert.doesNotThrow(() => checkLayout(placesIn('space')));
  assert.throws(() => checkLayout(['moon', 'telescope']), { message: 'Missing space layout for telescope' });
  assert.throws(() => checkLayout(['moon'], {}), { message: 'Missing space layout for moon' });
});

test('flights name intermediate stops in both directions, including a return during flight', () => {
  assert.deepEqual(flightStops(3, 7), [4, 5, 6, 7]);
  assert.deepEqual(flightStops(10, 3), [9, 8, 7, 6, 5, 4, 3]);
  assert.deepEqual(flightStops(6.4, 3), [6, 5, 4, 3]);
  assert.deepEqual(flightStops(6.4, 9), [7, 8, 9]);
  assert.deepEqual(flightStops(3, 3), []);
});

test('space only permits the specified state changes', () => {
  assert.deepEqual(MOVES, {
    launch: ['waiting'], waiting: ['flying', 'returning'], flying: ['visiting', 'returning'],
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
  const lines = [...Object.values(SPACE_LINES).flat(), ...Object.values(SPACE_TO), ...Object.values(SPACE_PASS), ...Object.values(SPACE_FACTS).flat(), PLACE_LINES.rocket];
  for (const line of lines) {
    assert.ok(segments.includes(line), line);
    assert.match(line, /[.!?]$/, line);
    assert.ok(line.split(' ').length > 1, line);
  }
  assert.equal(PLACE_LINES.rocket, 'Jedziemy do rakiety!');
  assert.deepEqual(SPACE_LINES.countdown, ['Odliczamy! Pięć, cztery, trzy, dwa, jeden!']);
  assert.deepEqual(SPACE_FACTS.sun, ['To jest Słońce.', 'Słońce to gwiazda.', 'Nie patrzymy prosto na Słońce.']);
  assert.deepEqual(Object.keys(SPACE_FACTS), placesIn('space'));
});


test('all stops fit the requested iPads with separate targets at least 70 pixels across', () => {
  const stage = new Space({});
  for (const [width, height] of [[1180, 820], [1366, 1024], [820, 1180]]) {
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    const { pos, look, minWidth } = stage.view;
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
