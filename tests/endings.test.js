import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';

const noop = () => {};
globalThis.window = { addEventListener: noop, removeEventListener: noop };
globalThis.location = { search: '' };
globalThis.innerWidth = 1180;
globalThis.innerHeight = 820;
globalThis.document = { createElement() {
  const canvas = { width: 0, height: 0 };
  const context = new Proxy({ canvas, createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 30 }) }, { get: (o, k) => k in o ? o[k] : noop });
  canvas.getContext = () => context;
  return canvas;
} };
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };

/** What the stubbed game does: the tests drive these. */
const heard = { said: [], sirens: 0, hushes: 0, celebration: null, pending: [] };
globalThis.__heard = heard;

const sources = (dir) => readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? sources(`${dir}${e.name}/`) : e.name.endsWith('.js') ? [`${dir}${e.name}`] : []));
/** Every name the game imports from a module (by name, or off a `* as` namespace), so a stand-in for it can offer all of them. */
const importedFrom = (module) => new Set(sources('../src/').flatMap((file) => {
  const text = readFileSync(new URL(file, import.meta.url), 'utf8');
  const named = [...text.matchAll(new RegExp(`import \\{([^}]*)\\} from '[./]*/${module}\\.js'`, 'g'))].flatMap((m) => m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean));
  const space = text.match(new RegExp(`import \\* as (\\w+) from '[./]*/${module}\\.js'`))?.[1];
  return [...named, ...(space ? [...text.matchAll(new RegExp(`\\b${space}\\.(\\w+)`, 'g'))].map((m) => m[1]) : [])];
}));
const standIns = (module, own) => [...importedFrom(module)].filter((n) => !own.includes(n)).map((n) => `export const ${n} = () => {};`).join('\n');

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = { linear: (t) => t, out: (t) => t, in: (t) => t, inOut: (t) => t };
    export const animate = async () => {};
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
    export const shakeNo = () => {};
    ${standIns('engine', ['camera', 'post', 'ease', 'animate', 'wait', 'hop', 'shakeNo', 'Stage'])}
    ${stage}`;
  if (url.endsWith('/src/audio.js')) source = `export const say = (segments) => new Promise((resolve) => { globalThis.__heard.said.push([segments].flat()); globalThis.__heard.pending.push(resolve); });
    export const hush = () => { globalThis.__heard.hushes++; };
    export const sfx = new Proxy({}, { get: (_, name) => () => { if (name === 'siren') globalThis.__heard.sirens++; } });
    ${standIns('audio', ['say', 'hush', 'sfx'])}`;
  if (url.endsWith('/src/ui.js')) source = `
    const earned = globalThis.__heard.earned = {};
    export const badges = { get: () => earned, add: (kind) => { earned[kind] = (earned[kind] || 0) + 1; return earned; } };
    export const celebrate = (options) => { globalThis.__heard.celebration = options; };
    export const missionHud = (options) => { globalThis.__heard.hud = options; };
    ${standIns('ui', ['badges', 'celebrate', 'missionHud'])}`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { T, allSegments } = await import('../src/lang/pl.js');
const { LEVELS, ALL_LETTERS } = await import('../src/levels/data.js');
const { GAMES } = await import('../src/places.js');
const { Mission } = await import('../src/scenes/mission.js');
const scenes = Object.fromEntries(await Promise.all(readdirSync(new URL('../src/scenes/', import.meta.url))
  .filter((file) => /extends Mission/.test(readFileSync(new URL(`../src/scenes/${file}`, import.meta.url), 'utf8')))
  .map(async (file) => [file, await import(`../src/scenes/${file}`)])));

const game = { home() {}, startMission() {} };
/** One mission of every place, as main.js builds them. */
const places = Object.values(scenes).flatMap((module) => Object.values(module)).filter((x) => typeof x === 'function')
  .map((make) => (make.prototype instanceof Mission ? new make(game) : make.name === 'NameMission' ? make(game) : null))
  .filter(Boolean);
const voiceList = new Set(allSegments(LEVELS, ALL_LETTERS));
const flush = () => new Promise(setImmediate);

const CAPITAL = /^[A-ZĄĆĘŁŃÓŚŹŻ]/;
/** The ending as she hears it: every sentence stands alone (no opening conjunction, no dangling "I"). */
function assertWhole(statement, where) {
  assert.ok(voiceList.has(statement), `${where}: "${statement}" is in the voice list`);
  for (const sentence of statement.split(/(?<=[.!?])\s+/)) {
    assert.match(sentence, CAPITAL, `${where}: "${sentence}" starts with a capital`);
    assert.match(sentence, /[.!?]$/, `${where}: "${sentence}" ends with a stop`);
    assert.doesNotMatch(sentence, /^I /, `${where}: "${sentence}" is not a continuation`);
    assert.doesNotMatch(sentence, /undefined|NaN|null/, `${where}: "${sentence}" says no leftovers`);
  }
}

test('every place that can be played has an ending built here', () => {
  assert.deepEqual(places.map((s) => s.kind).sort(), [...GAMES].sort());
});

test('every place ends in whole statements for 0, 1 and 2 levels, with and without a new badge', () => {
  for (const place of places) {
    for (const gained of [0, 1, 2]) {
      for (const badgeNew of [false, true]) {
        const where = `${place.kind} (${gained} levels, badge ${badgeNew ? 'new' : 'old'})`;
        const ending = place.ending({ gained, badgeNew });
        assert.ok(ending.length >= 1, `${where}: it says something`);
        for (const statement of ending) assertWhole(statement, where);
        const own = place.doneLine?.() || T.done();
        assert.deepEqual(ending.slice(0, own.length), own, `${where}: the place's line comes first`);
        assert.ok(ending.length - own.length <= 1, `${where}: one reward statement at most`);
      }
    }
  }
});

test('the reward says what she won: the badge only when it is new, one star or two', () => {
  const said = (gained, badgeNew) => T.reward(gained, badgeNew).join(' ');
  assert.equal(said(0, false), '', 'nothing won, nothing said');
  assert.equal(said(0, true), 'Zdobywasz odznakę!');
  assert.equal(said(1, false), 'Zdobywasz nową gwiazdkę!');
  assert.equal(said(2, false), 'Zdobywasz dwie nowe gwiazdki!');
  assert.equal(said(1, true), 'Zdobywasz odznakę i nową gwiazdkę!');
  assert.equal(said(2, true), 'Zdobywasz odznakę i dwie nowe gwiazdki!');
  assert.deepEqual(T.reward(3, false), T.reward(2, false), 'a bigger jump than the game allows still says two');
});

test('Star Pictures ends in a sentence she can follow, then the stars she won', () => {
  const stars = places.find((s) => s.kind === 'stars');
  assert.deepEqual(stars.ending({ gained: 1, badgeNew: false }), ['Brawo! Ułożyłaś obrazki z gwiazd!', 'Zdobywasz nową gwiazdkę!']);
  assert.deepEqual(stars.ending({ gained: 2, badgeNew: false }), ['Brawo! Ułożyłaś obrazki z gwiazd!', 'Zdobywasz dwie nowe gwiazdki!']);
});

test('the default ending thanks her once and no longer repeats the badge on every run', () => {
  const cones = places.find((s) => s.kind === 'cones');
  assert.deepEqual(cones.ending({ gained: 0, badgeNew: false }), T.done());
  assert.deepEqual(cones.ending({ gained: 0, badgeNew: true }), [...T.done(), 'Zdobywasz odznakę!']);
});

test('the Lookout finale and the question about playing on are whole as well', () => {
  assertWhole(T.finaleDone()[0], 'finale');
  for (const question of [T.againOrIsland(), T.againOrSpace(), T.againOrSea()]) for (const statement of question) assertWhole(statement, 'question');
});

const started = [];
afterEach(() => { for (const mission of started.splice(0)) mission.alive = false; }); // (a failing test must not leave the hop loop of a finished mission running)

/** A mission of this place on its mission screen (its rounds skipped), finished the way the game does after her last answer. The line it says stays open until a test ends it. */
async function ending(kind, { gained = 0 } = {}) {
  Object.assign(heard, { said: [], sirens: 0, hushes: 0, celebration: null, pending: [] });
  const calls = [];
  const mission = new (places.find((s) => s.kind === kind).constructor)({ home: () => calls.push('home'), startMission: (k) => calls.push(`start ${k}`) });
  Object.assign(mission, { build() {}, run() {}, answers: gained === 2 ? [1, 2, 3].map(() => ({ correct: true, firstTry: true, scored: true, assistLevel: 0 })) : [] });
  started.push(mission);
  mission.enter();
  mission.finish();
  await flush();
  return { mission, calls, ask: heard.celebration };
}

test('finish says the ending as one list, with the badge only the first time', async () => {
  for (const kind of Object.keys(heard.earned)) delete heard.earned[kind];
  await ending('stars');
  assert.equal(heard.said.length, 1, 'one list of statements, so a newer line cuts it as a whole');
  assert.deepEqual(heard.said[0], ['Brawo! Ułożyłaś obrazki z gwiazd!', 'Zdobywasz odznakę!'], 'her first run of the place: the badge is new');
  assert.ok(heard.celebration, 'the celebration is shown');
  await ending('stars');
  assert.deepEqual(heard.said[0], ['Brawo! Ułożyłaś obrazki z gwiazd!'], 'the second run: the badge is on her shelf already');
});

test('a clean run that leaps two levels says two stars', async () => {
  await ending('mercury', { gained: 2 });
  assert.equal(heard.celebration.gained, 2);
  assert.ok(heard.said[0].some((line) => line.includes('dwie nowe gwiazdki')), heard.said[0].join(' | '));
  assert.ok(!heard.said[0].some((line) => /^I /.test(line)));
});

test('the question about playing on waits for the praise, also when a newer line cut it short', async () => {
  const { ask } = await ending('telescope');
  let asked = false;
  ask.talk.then(() => { asked = true; });
  await flush();
  assert.equal(asked, false, 'not while the praise plays');
  heard.pending[0](); // (another line took over, or the praise ended)
  await flush();
  assert.equal(asked, true, 'the question follows');
});

test('holding the house during the ending leaves nothing of it to say, ask or sound', async () => {
  const { calls, ask } = await ending('stars');
  let asked = false;
  ask.talk.then(() => { asked = true; });
  heard.hud.onHome(); // (the held house button on the mission's screen)
  assert.equal(heard.hushes, 1, 'the voice stops');
  assert.deepEqual(calls, ['home']);
  heard.pending[0](); // (the cut line ends)
  await new Promise((resolve) => setTimeout(resolve, 1000));
  assert.equal(asked, false, 'no "again or on?" after she has gone');
  assert.equal(heard.sirens, 0, 'no siren in the next place');
  assert.equal(heard.said.length, 1, 'and nothing else is said');
});

test('starting a place again during the ending stops the ending too', async () => {
  const { calls, ask } = await ending('stars');
  let asked = false;
  ask.talk.then(() => { asked = true; });
  ask.onAgain();
  heard.pending[0]();
  await flush();
  assert.deepEqual(calls, ['start stars']);
  assert.equal(heard.hushes, 1);
  assert.equal(asked, false);
});

test('a mission she has already left never finishes into the next place', async () => {
  const { mission } = await ending('moon');
  Object.assign(heard, { said: [], sirens: 0, hushes: 0, celebration: null, pending: [] });
  mission.leave(() => {});
  mission.finish();
  await flush();
  assert.deepEqual(heard.said, [], 'her last answer came while the wipe covered the screen: nothing is said');
  assert.equal(heard.celebration, null);
});

test('no size of jump makes the ending say a leftover', () => {
  for (const gained of [0, 1, 2, 3, 11]) for (const badgeNew of [false, true]) {
    for (const statement of T.reward(gained, badgeNew)) assert.doesNotMatch(statement, /undefined/);
  }
});
