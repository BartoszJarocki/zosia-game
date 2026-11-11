import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { PLACES, homeArea } from '../src/places.js';

// Keep the real map logic, with the browser and audio boundaries replaced.
const boundary = registerHooks({
  load(url, context, next) {
    const sources = {
      '/src/engine.js': 'export class Stage {} export const animate = () => Promise.resolve(); export const ease = {}; export const camera = {}; export const renderer = {};',
      '/src/audio.js': 'export const say = () => Promise.resolve(); export const hush = () => {};',
      '/src/session/session.js': 'export const getSession = () => ({}); export const checkAttention = () => "ok";',
      '/src/progress.js': 'export const getVisited = () => ({}); export const recordVisit = () => {};',
    };
    const key = Object.keys(sources).find((suffix) => url.endsWith(suffix));
    return key ? { format: 'module', source: sources[key], shortCircuit: true } : next(url, context);
  },
});
const { MOVES, nextState } = await import('../src/scenes/area-map.js');
boundary.deregister();

test('the map only permits the specified state changes', () => {
  assert.deepEqual(MOVES, {
    launch: ['waiting'], waiting: ['flying', 'returning'], flying: ['flying', 'visiting', 'returning'],
    visiting: ['waiting', 'returning'], returning: [],
  });
  assert.equal(nextState('launch', 'waiting'), 'waiting');
  assert.equal(nextState('waiting', 'flying'), 'flying');
  assert.equal(nextState('flying', 'visiting'), 'visiting');
  assert.equal(nextState('flying', 'flying'), 'flying'); // a tap on another stop on the way
  assert.equal(nextState('visiting', 'waiting'), 'waiting');
  for (const state of ['waiting', 'flying', 'visiting']) assert.equal(nextState(state, 'returning'), 'returning');
  assert.throws(() => nextState('launch', 'flying'), { message: 'Invalid space move: launch to flying' });
  assert.throws(() => nextState('returning', 'waiting'), { message: 'Invalid space move: returning to waiting' });
});

test('home returns to the area map only when the area has one', () => {
  assert.equal(homeArea({ area: PLACES.moon.area }), 'space');
  assert.equal(homeArea({ area: PLACES.letters.area }), 'island');
  assert.equal(homeArea(null), 'island');
});
