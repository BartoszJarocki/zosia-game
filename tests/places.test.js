import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { PLACES, placesIn, GAMES, homeArea } from '../src/places.js';
import { DOMAIN } from '../src/session/director.js';
import { SCHEMA, parseGame } from '../src/levels/parse.js';
import { EASIER } from '../src/levels/easier.js';
import { PLACE_TO, HOME_TASKS } from '../src/lang/pl.js';
import { MILESTONES, milestoneRewards } from '../src/adventure/world.js';

const ISLAND_GAMES = [
  'letters', 'balloons', 'name', 'cones', 'stones', 'counting',
  'lookout', 'delivery', 'picnic', 'garage',
];
const md = readFileSync(new URL('../GAME.md', import.meta.url), 'utf8');
const { levels, missions, errors } = parseGame(md, { childName: CONFIG.childName });

test('the island has all ten games in badge order', () => {
  assert.deepEqual(GAMES, ISLAND_GAMES);
  assert.deepEqual([...GAMES].sort(), [...ISLAND_GAMES].sort());
  const games = placesIn('island').filter((kind) => PLACES[kind].game);
  assert.deepEqual(games.sort(), [...ISLAND_GAMES].sort());
});

test('every place has an area, game flag and domain; games also require badges', () => {
  for (const kind of Object.keys(PLACES)) {
    const place = PLACES[kind];
    assert.match(place.area, /^(island|space)$/, kind);
    assert.equal(typeof place.game, 'boolean', kind);
    assert.match(place.domain, /^(letters|numbers|shapes|space)$/, kind);
    if (ISLAND_GAMES.includes(kind)) {
      assert.equal(place.area, 'island', kind);
      assert.equal(place.game, true, kind);
      assert.match(place.domain, /^(letters|numbers|shapes)$/, kind);
    }
    if (!place.game) continue;
    assert.match(place.badge.label, /\S/, kind);
    assert.match(place.badge.color, /^#[0-9a-f]{6}$/i, kind);
  }
});

test('every game has a schema, easier settings, text and level rows', () => {
  assert.equal(GAMES.length, 10);
  assert.deepEqual(errors, []);
  for (const kind of GAMES) {
    assert.ok(Object.keys(SCHEMA[kind]).length > 0, `${kind}: schema`);
    assert.equal(typeof EASIER[kind], 'function', `${kind}: easier settings`);
    assert.match(PLACE_TO[kind], /\S/, `${kind}: destination`);
    assert.match(HOME_TASKS[kind], /\S/, `${kind}: home task`);
    assert.ok(Array.isArray(levels[kind]), `${kind}: level rows`);
    assert.ok(levels[kind].length > 0, `${kind}: level rows`);
  }
});

test('every island game rewards its first finished run', () => {
  for (const kind of ISLAND_GAMES) {
    const rewards = milestoneRewards(kind, { completions: 1 });
    assert.ok(Array.isArray(rewards), kind);
    assert.ok(rewards.length > 0, kind);
  }
});

test('place tables have no missing or unknown kinds', () => {
  assert.deepEqual(Object.keys(PLACE_TO).sort(), [...ISLAND_GAMES, 'rocket'].sort());
  assert.deepEqual(Object.keys(DOMAIN).sort(), Object.keys(PLACES).sort());
  const tables = { SCHEMA, EASIER, HOME_TASKS, MILESTONES, levels, missions };
  for (const [name, table] of Object.entries(tables)) {
    assert.deepEqual(Object.keys(table).sort(), [...ISLAND_GAMES].sort(), name);
  }
});


test('the rocket connects the island to fourteen look-only space places', () => {
  assert.deepEqual(PLACES.rocket, { area: 'island', game: false, domain: 'space', leadsTo: 'space' });
  assert.deepEqual(placesIn('space'), ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'blackhole', 'comet', 'stars']);
  for (const kind of placesIn('space')) assert.deepEqual(PLACES[kind], { area: 'space', game: false, domain: 'space' });
  assert.deepEqual(placesIn('island'), [...ISLAND_GAMES, 'rocket']);
});

test('home remembers the current map or the mission origin', () => {
  assert.equal(homeArea({ area: PLACES.letters.area }), 'island');
  assert.equal(homeArea({ area: PLACES.moon.area }), 'space');
  assert.equal(homeArea({ kind: 'space-map', area: 'space' }), 'space');
  assert.equal(homeArea({ area: 'island' }), 'island');
  assert.equal(homeArea(null), 'island');
  assert.equal(homeArea({}), 'island');
});
