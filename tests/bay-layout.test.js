import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { PLACES, placesIn, homeArea } from '../src/places.js';
import { shelfItems, BOAT_BADGE } from '../src/shelf.js';
import { SEA_LINES, SEA_TO, SEA_PASS, SEA_INVITE, SEA_FACTS, allSegments } from '../src/lang/pl.js';
import { SEA_ORDER, BAY_LAYOUT, checkLayout } from '../src/levels/sea.js';

registerHooks({ load(url, context, next) {
  if (url.endsWith('?raw')) return { format: 'module', source: `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`, shortCircuit: true };
  return next(url, context);
} });
const { LEVELS, ALL_LETTERS } = await import('../src/levels/data.js');

const SEA_STOPS = ['island', 'buoy', 'shallows', 'seal', 'lighthouse', 'gulls', 'reef', 'port'];

test('the harbour is the island way to the sea, and the bay has its eight stops', () => {
  assert.deepEqual(PLACES.harbour, { area: 'island', game: false, domain: 'sea', leadsTo: 'sea' });
  assert.deepEqual(placesIn('sea'), SEA_STOPS);
  for (const kind of SEA_STOPS.filter((k) => k !== 'lighthouse')) assert.deepEqual(PLACES[kind], { area: 'sea', game: false, domain: 'sea' });
  assert.deepEqual(PLACES.lighthouse, { area: 'sea', game: true, domain: 'numbers', badge: { label: '💡', color: '#0ea5e9' } });
});

test('every sea place has a layout entry and the layout has no stray places', () => {
  assert.deepEqual(SEA_ORDER, SEA_STOPS);
  for (const kind of SEA_STOPS) {
    const entry = BAY_LAYOUT[kind];
    assert.ok(entry, kind);
    assert.equal(entry.at.length, 3, kind);
    assert.ok(entry.r > 0, kind);
    assert.ok(entry.height > 0, kind);
  }
  assert.deepEqual(Object.keys(BAY_LAYOUT).sort(), SEA_STOPS.slice().sort());
  assert.throws(() => checkLayout(['missing']), { message: 'Missing sea layout for missing' });
});

test('every sea stop has its facts and every stop but home has to, pass and invite lines', () => {
  assert.deepEqual(Object.keys(SEA_FACTS).sort(), SEA_STOPS.slice().sort());
  for (const kind of SEA_STOPS) {
    assert.ok(SEA_FACTS[kind].length > 0, kind);
    for (const line of SEA_FACTS[kind]) {
      assert.match(line, /^[A-ZĄĆĘŁŃÓŚŹŻ].*[.!]$/, `${kind}: ${line}`);
      assert.ok(line.includes(' '), `${kind}: full sentence`);
    }
    if (kind === 'island') continue;
    for (const table of [SEA_TO, SEA_PASS, SEA_INVITE]) {
      assert.ok([table[kind]].flat().length > 0, `${kind}: line`);
      for (const line of [table[kind]].flat()) assert.match(line, /^[A-ZĄĆĘŁŃÓŚŹŻ].*[.!?]$/, `${kind}: ${line}`);
    }
  }
  assert.equal(SEA_TO.island, 'Płyniemy na wyspę!');
});

test('the sea has its own map, launch and home lines, all ready to record', () => {
  for (const line of Object.values(SEA_LINES).flat()) assert.match(line, /^[A-ZĄĆĘŁŃÓŚŹŻ].*[.!?]$/, line);
  assert.equal(SEA_LINES.map[0], 'Gdzie popłyniemy?');
  assert.equal(SEA_LINES.again[0], 'Płyniemy dalej czy do domu?');
  assert.equal(SEA_LINES.home[0], 'Wracamy na wyspę!');
  assert.equal(SEA_LINES.goodnight[0], 'Robi się późno. Wracamy na wyspę.');
  assert.equal(SEA_LINES.inviteHome[0], 'Czas wracać na wyspę!');
  const segments = allSegments(LEVELS, ALL_LETTERS);
  for (const line of [...Object.values(SEA_LINES).flat(), ...Object.values(SEA_FACTS).flat(), ...Object.values(SEA_TO), ...Object.values(SEA_PASS), ...Object.values(SEA_INVITE).flat()]) {
    assert.ok(segments.includes(line), line);
  }
});

test('one boat badge adds up every sea game, as the rocket does for space', () => {
  assert.deepEqual(BOAT_BADGE, { label: '⛵', color: '#0284c7' });
  const savedReef = PLACES.reef.game;
  PLACES.reef.game = true;
  try {
    const items = shelfItems({ letters: 1, lighthouse: 1, reef: 2 });
    assert.deepEqual(items.map((i) => i.kind), ['letters', 'boat']);
    assert.deepEqual(items[1], { kind: 'boat', count: 3, badge: BOAT_BADGE });
    assert.deepEqual(shelfItems({ lighthouse: 1 }).map((i) => [i.kind, i.count]), [['boat', 1]]);
  } finally {
    PLACES.reef.game = savedReef;
  }
  assert.deepEqual(shelfItems({ letters: 1, lighthouse: 1 }).map((i) => [i.kind, i.count]), [['letters', 1], ['boat', 1]]);
});

test('home knows the sea map', () => {
  assert.equal(homeArea({ area: 'sea' }), 'sea');
  assert.equal(homeArea({ kind: 'sea-map', area: 'sea' }), 'sea');
});
