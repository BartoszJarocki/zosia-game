import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { PLACES, placesIn, GAMES, homeArea } from '../src/places.js';
import { DOMAIN } from '../src/session/director.js';
import { SCHEMA, parseGame } from '../src/levels/parse.js';
import { EASIER } from '../src/levels/easier.js';
import { PLACE_TO, SPACE_TO, HOME_TASKS } from '../src/lang/pl.js';
import { MILESTONES, milestoneRewards } from '../src/adventure/world.js';

const ISLAND_GAMES = [
  'letters', 'balloons', 'name', 'cones', 'stones', 'counting',
  'lookout', 'delivery', 'picnic', 'garage',
];
const md = readFileSync(new URL('../GAME.md', import.meta.url), 'utf8');
const { levels, missions, errors } = parseGame(md, { childName: CONFIG.childName });

test('the island and space have all eighteen games in badge order', () => {
  assert.deepEqual(GAMES, [...ISLAND_GAMES, 'mercury', 'moon', 'mars', 'saturn', 'pluto', 'blackhole', 'stars', 'telescope']);
  assert.deepEqual(GAMES.filter((kind) => PLACES[kind].area === 'island'), ISLAND_GAMES);
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
  assert.equal(GAMES.length, 18);
  assert.deepEqual(errors, []);
  for (const kind of GAMES) {
    assert.ok(Object.keys(SCHEMA[kind]).length > 0, `${kind}: schema`);
    assert.equal(typeof EASIER[kind], 'function', `${kind}: easier settings`);
    assert.match((PLACES[kind].area === 'space' ? SPACE_TO : PLACE_TO)[kind], /\S/, `${kind}: destination`);
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
  assert.deepEqual(Object.keys(MILESTONES).sort(), [...ISLAND_GAMES].sort());
  const tables = { SCHEMA, EASIER, HOME_TASKS, levels, missions };
  for (const [name, table] of Object.entries(tables)) {
    assert.deepEqual(Object.keys(table).sort(), [...GAMES].sort(), name);
  }
});


test('the rocket connects the island to seven look-only places and eight space games', () => {
  assert.deepEqual(PLACES.rocket, { area: 'island', game: false, domain: 'space', leadsTo: 'space' });
  assert.deepEqual(placesIn('space'), ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'blackhole', 'comet', 'stars', 'telescope']);
  for (const kind of placesIn('space').filter((k) => !['mercury', 'moon', 'mars', 'saturn', 'pluto', 'blackhole', 'stars', 'telescope'].includes(k))) assert.deepEqual(PLACES[kind], { area: 'space', game: false, domain: 'space' });
  assert.deepEqual(PLACES.telescope, { area: 'space', game: true, domain: 'space', stop: false, badge: { label: '🔭', color: '#0d9488' } });
  assert.deepEqual(PLACES.mercury, { area: 'space', game: true, domain: 'numbers', badge: { label: '🪨', color: '#9ca3af' } });
  assert.deepEqual(PLACES.moon, { area: 'space', game: true, domain: 'numbers', badge: { label: '🌙', color: '#6366f1' } });
  assert.deepEqual(PLACES.mars, { area: 'space', game: true, domain: 'numbers', badge: { label: '🚙', color: '#c2410c' } });
  assert.deepEqual(PLACES.saturn, { area: 'space', game: true, domain: 'shapes', badge: { label: '🪐', color: '#d4a14a' } });
  assert.deepEqual(PLACES.pluto, { area: 'space', game: true, domain: 'shapes', badge: { label: '🤍', color: '#f9a8d4' } });
  assert.deepEqual(PLACES.blackhole, { area: 'space', game: true, domain: 'numbers', badge: { label: '✨', color: '#7c3aed' } });
  assert.deepEqual(PLACES.stars, { area: 'space', game: true, domain: 'numbers', badge: { label: '⭐', color: '#eab308' } });
  assert.deepEqual(placesIn('island'), [...ISLAND_GAMES, 'rocket']);
});

test('every game has a scene in the mission registry; only island places need island layouts', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const hub = readFileSync(new URL('../src/scenes/hub.js', import.meta.url), 'utf8');
  const registry = main.match(/const MISSIONS = \{([\s\S]*?)\n\};/)[1];
  const layout = hub.match(/const LAYOUT = \{([\s\S]*?)\n\};/)[1];
  for (const kind of GAMES) {
    const scene = registry.match(new RegExp(`\\b${kind}: (\\w+)`))?.[1];
    assert.ok(scene, `${kind}: scene registration`);
    assert.ok(main.includes(`import { ${scene} } from './scenes/${kind}.js'`), `${kind}: scene import`);
    assert.match(readFileSync(new URL(`../src/scenes/${kind}.js`, import.meta.url), 'utf8'), new RegExp(`export (class|function) ${scene}\\b`));
    if (PLACES[kind].area === 'island') assert.match(layout, new RegExp(`\\b${kind}:`));
  }
  assert.doesNotMatch(layout, /\bmercury:/);
  assert.equal(MILESTONES.mercury, undefined);
  assert.doesNotMatch(layout, /\bmoon:/);
  assert.equal(MILESTONES.moon, undefined);
  assert.doesNotMatch(layout, /\bstars:/);
  assert.equal(MILESTONES.stars, undefined);
  assert.doesNotMatch(layout, /\bpluto:/);
  assert.equal(MILESTONES.pluto, undefined);
  assert.doesNotMatch(layout, /\bblackhole:/);
  assert.equal(MILESTONES.blackhole, undefined);
});

test('home remembers the current map or the mission origin', () => {
  assert.equal(homeArea({ area: PLACES.letters.area }), 'island');
  assert.equal(homeArea({ area: PLACES.mercury.area }), 'space');
  assert.equal(homeArea({ area: PLACES.moon.area }), 'space');
  assert.equal(homeArea({ area: PLACES.pluto.area }), 'space');
  assert.equal(homeArea({ area: PLACES.blackhole.area }), 'space');
  assert.equal(homeArea({ kind: 'space-map', area: 'space' }), 'space');
  assert.equal(homeArea({ area: 'island' }), 'island');
  assert.equal(homeArea(null), 'island');
  assert.equal(homeArea({}), 'island');
});
