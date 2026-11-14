// What the grown-ups' page says about each place, from the save as the game leaves it: not started, started,
// completed (a badge), and, in a save from before starts were recorded, not completed yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { GAMES } from '../src/places.js';

function element() {
  const selectors = new Map();
  return {
    innerHTML: '', textContent: '', hidden: false, children: [], events: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
    append(child) { this.children.push(child); },
    appendChild(child) { this.children.push(child); },
    remove() {},
    querySelector(selector) { if (!selectors.has(selector)) selectors.set(selector, element()); return selectors.get(selector); },
    querySelectorAll() { return []; },
    addEventListener(event, fn) { this.events[event] = fn; },
  };
}
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.location = { search: '', hash: '', reload() {} };
globalThis.document = {
  body: element(), getElementById: () => element(), addEventListener() {}, querySelector: () => null, hidden: false,
  fonts: { load: async () => {} },
  createElement(tag) {
    if (tag !== 'template') return element();
    const child = element();
    return { content: { firstElementChild: child }, set innerHTML(html) { child.innerHTML = html; } };
  },
};
const stored = new Map();
globalThis.localStorage = { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, String(v)), removeItem: (k) => stored.delete(k) };

// Each open of the game loads every src module afresh (?open=N), so the save is read again, as on a reload.
let opens = 0;
const SCENES = /\/src\/scenes\/(hub|space|bay|[a-z]+)\.js\?/;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'virtual:pwa-register') return { url: 'data:text/javascript,export const registerSW = () => () => {};', shortCircuit: true };
    const r = next(specifier, context);
    return r.url.includes('/src/') && !r.url.includes('?') ? { ...r, url: `${r.url}?open=${opens}` } : r;
  },
  load(url, context, next) {
    let source;
    if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
    else if (url.includes('.css')) source = 'export default {};';
    else if (url.includes('/src/audio.js?')) source = 'export const say = async () => {}; export const hush = () => {}; export const unlockAudio = () => {}; export const sfx = new Proxy({}, { get: () => () => {} }); export const soundsStarted = () => 0;';
    else if (url.includes('/src/textures.js?')) source = 'export const DICE = {};';
    else if (url.includes('/src/engine.js?')) source = 'let stage; export const setStage = (s) => { stage = s; }; export const getStage = () => stage; export const camera = {};';
    else if (url.includes('/src/fx/transition.js?')) source = 'export const pawWipe = async (fn) => fn(); export const wiping = () => false;';
    else if (SCENES.test(url) && !url.includes('/area-map.js') && !url.includes('/mission.js')) {
      const [, kind] = url.match(SCENES);
      source = `export class Scene { constructor() { this.kind = '${kind}'; } }; export { Scene as Hub, Scene as Space, Scene as Bay, Scene as ${kind[0].toUpperCase() + kind.slice(1)}Mission, Scene as BlackHoleMission };`;
    }
    return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
  },
});

/** Open the game on the save as it is now (a page load): its parts, freshly loaded. */
async function open() {
  opens++;
  await import(new URL(`../src/main.js?open=${opens}`, import.meta.url));
  await new Promise(setImmediate);
  const view = await import(new URL(`../src/parent/view.js?open=${opens}`, import.meta.url));
  return { game: window.__pup.game, learning: window.__pup.learning, page: () => view.showParentView({ onClose() {} }).innerHTML };
}
const seed = ({ progress = null, badges = null } = {}) => {
  stored.clear();
  if (progress) stored.set('pup-patrol-progress', JSON.stringify(progress));
  if (badges) stored.set('pup-patrol-badges', JSON.stringify(badges));
};
/** { kind: label } for every place card on the page. */
const labels = (html) => Object.fromEntries([...html.matchAll(/<div class="pv-mission" data-kind="(\w+)">[\s\S]*?<b class="pv-played">([^<]+)<\/b>/g)].map((m) => [m[1], m[2]]));
const others = (all, but) => Object.entries(all).filter(([k]) => !but.includes(k)).map(([, v]) => v);

test('a fresh save: every place reads not started, and nothing says when the counts began', async () => {
  seed();
  const html = (await open()).page();
  const all = labels(html);
  assert.deepEqual(Object.keys(all).sort(), [...GAMES].sort(), 'a card per place');
  assert.deepEqual([...new Set(Object.values(all))], ['Not started']);
  assert.doesNotMatch(html, /are counted from/);
});

test('a place she went into and left reads started, its round is counted, and both stay after a reload', async () => {
  seed();
  const { game, learning } = await open();
  await game.startMission('letters');
  learning.emit({ mission: 'letters', skill: 'letterVisual', item: 'B', correct: true, firstTry: true, options: 3 });
  const reload = (await open()).page();
  assert.equal(labels(reload).letters, 'Started');
  assert.deepEqual([...new Set(others(labels(reload), ['letters']))], ['Not started']);
  assert.match(reload, /<b class="pv-item">B<\/b>[\s\S]*?1 solved \(1 first try\)/);
});

test('a badge reads completed', async () => {
  seed({ badges: { cones: 1 } });
  const { game } = await open();
  await game.startMission('cones');
  await game.startMission('moon');
  const all = labels((await open()).page());
  assert.equal(all.cones, 'Completed');
  assert.equal(all.moon, 'Started');
});

test('an old version 7 save with two badges: those read completed, the rest not completed yet, and the page says when counts began', async () => {
  seed({
    progress: { v: 7, age: 3.5, missions: { letters: { level: 4, good: 0, lastAcc: 0.8 }, cones: { level: 4, good: 0, lastAcc: 1 } }, skills: { letterVisual: { B: { attempts: 6, correctFirstTry: 5, assisted: 0, wrong: 1, missTaps: 0, timeouts: 0, mastery: 0.7, avgLatencyMs: 1500, latencyN: 6, lastSeenAt: 1, confusions: {} } } }, sessions: { count: 2, recent: [] }, visited: {}, world: null },
    badges: { letters: 1, cones: 2 },
  });
  const html = (await open()).page();
  const all = labels(html);
  assert.deepEqual([all.letters, all.cones], ['Completed', 'Completed']);
  assert.deepEqual([...new Set(others(all, ['letters', 'cones']))], ['Not completed yet']);
  assert.match(html, /Solved questions and started places are counted from /);
  assert.match(html, /<b class="pv-item">B<\/b>[\s\S]*?none solved since /, 'earlier solves are not made up');
  assert.equal(JSON.parse(stored.get('pup-patrol-progress')).v, 8);
});

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tiles = (html) => text(html.match(/<section class="pv-sum">[\s\S]*?<\/section>/)[0]);
const section = (html, heading) => text(html.match(new RegExp(`<h2>${heading}[\\s\\S]*?</section>`))[0]);
const v7stat = (o) => ({ attempts: 0, correctFirstTry: 0, assisted: 0, wrong: 0, missTaps: 0, timeouts: 0, mastery: 0, avgLatencyMs: 0, latencyN: 0, lastSeenAt: 1, confusions: {}, ...o });

test('an old save where the Port was finished but its toots never counted: the boat reads none solved since then, and the note claims nothing more', async () => {
  seed({
    progress: { v: 7, age: 3.5, missions: { port: { level: 2, good: 0, lastAcc: 0.75 } }, skills: { syllables: { 'SŁOŃ': v7stat({ wrong: 1 }) } }, sessions: { count: 3, recent: [] }, visited: {}, world: null },
    badges: { port: 3 },
  });
  const html = (await open()).page();
  assert.equal(labels(html).port, 'Completed');
  assert.match(section(html, 'Syllables'), /^Syllables The Port, Name Train Słoń splits into syllables – none solved since /);
  assert.doesNotMatch(html, /not solved yet/, 'she solved it in each of the three runs');
  assert.doesNotMatch(html, /Earlier answers still shape mastery/, 'her toots never moved mastery');
});

/** Every "N solved" on the page's rows, added up, and the number in the first tile. */
const counted = (html) => ({
  rows: [...html.matchAll(/<span class="pv-meta">(\d+) solved/g)].reduce((n, m) => n + Number(m[1]), 0),
  tile: Number(html.match(/<b>(\d+)<\/b><span>questions solved/)[1]),
});

test('every solve counted at the top has a row: the Port\'s counts, Jupiter\'s bigger planet, the planets\' order', async () => {
  seed();
  const { learning } = await open();
  const solve = (mission, skill, item, options = 3) => learning.emit({ mission, skill, item, correct: true, firstTry: true, options });
  learning.emit({ mission: 'port', skill: 'syllables', item: 'FOKA', correct: false, errorType: 'wrongChoice', chosen: 1, options: 3 }); // one toot
  learning.emit({ mission: 'port', skill: 'syllables', item: 'FOKA', correct: true, firstTry: false, options: 3 });
  solve('port', 'syllables', 2);
  solve('jupiter', 'comparison', 'bigger', 2);
  solve('jupiter', 'comparison', 'smaller', 2);
  solve('telescope', 'sequence', 'space:mars');
  solve('stars', 'sequence', 4, 2);
  const html = (await open()).page();
  assert.deepEqual(counted(html), { rows: 6, tile: 6 });
  assert.match(section(html, 'Syllables'), /which boat has 2 syllables splits into syllables 40% 1 solved/);
  assert.match(section(html, 'Syllables'), /Foka splits into syllables 0% 1 solved \(1 after an error\) · – · mixes up with 1 /);
  assert.doesNotMatch(html, /mixes up with which boat/, 'her one toot is a count, not a boat');
  assert.match(section(html, 'Space'), /after Mars order 40% 1 solved/);
});

test('the summary means by help what the rows mean: a clue or the answer shown, not hearing the question again', async () => {
  for (const [assistLevel, first, right, help] of [[1, '1 first try', '100%', '0%'], [3, '1 after help', '0%', '100%']]) {
    seed();
    const { learning } = await open();
    learning.emit({ mission: 'letters', skill: 'letterVisual', item: 'B', correct: true, firstTry: true, assistLevel, options: 3 });
    const sum = tiles((await open()).page());
    assert.match(sum, new RegExp(`^1 questions solved \\(${first}\\) ${right} right first time where a guess could miss \\(a guess: 33%\\) ${help} needed some help`), `help level ${assistLevel}`);
  }
});

test('the guess figure follows the options the answers had: a count made at the Lighthouse is one of four', async () => {
  seed();
  const { learning } = await open();
  for (const item of [2, 3, 5]) learning.emit({ mission: 'lighthouse', skill: 'counting', item, correct: true, firstTry: true, options: 4 });
  assert.match(tiles((await open()).page()), /100% right first time where a guess could miss \(a guess: 25%\)/);
});

test('an item a guess could not miss shows a dash for mastery in Lately too, as in its row', async () => {
  seed();
  const { learning } = await open();
  learning.emit({ mission: 'stars', skill: 'sequence', item: 5, correct: true, firstTry: true, options: 2, at: 1 });
  learning.emit({ mission: 'stars', skill: 'sequence', item: 6, correct: true, firstTry: true, options: 1, at: 2 });
  const html = (await open()).page();
  assert.match(text(html.match(/<h2>Lately<\/h2>[\s\S]*?<\/div><\/div>/)[0]), /^Lately 6 order · – 5 order · 40%$/);
  assert.match(section(html, 'Numbers'), /6 order – 1 solved/);
});

test('the page explains the stars, the paws and the badges', async () => {
  seed();
  const html = (await open()).page();
  const explain = html.match(/<p class="pv-never pv-explain">([\s\S]*?)<\/p>/)?.[1] || '';
  for (const word of ['stars', 'paw prints', 'badge']) assert.match(explain, new RegExp(word), word);
});
