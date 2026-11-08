import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

function element() {
  const selectors = new Map();
  return {
    innerHTML: '', children: [], events: {}, style: { setProperty() {} }, classList: { add() {}, remove() {} },
    append(child) { this.children.push(child); },
    appendChild(child) { this.children.push(child); },
    querySelector(selector) { if (!selectors.has(selector)) selectors.set(selector, element()); return selectors.get(selector); },
    querySelectorAll() { return []; },
    addEventListener(event, fn) { this.events[event] = fn; },
  };
}
const hud = element();
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.location = { search: '', hash: '' };
globalThis.document = {
  body: element(), getElementById: () => hud, addEventListener() {},
  fonts: { load: async () => {} },
  createElement(tag) {
    if (tag !== 'template') return element();
    const child = element();
    return { content: { firstElementChild: child }, set innerHTML(html) { child.innerHTML = html; } };
  },
};
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/audio.js')) source = 'export const say = async () => {}; export const hush = () => {}; export const unlockAudio = () => {}; export const sfx = { pop() {} };';
  if (url.endsWith('/src/textures.js')) source = 'export const DICE = {};';
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { spaceHud, ICON } = await import('../src/ui.js');
const { dev } = await import('../src/progress.js');
const { showParentView } = await import('../src/parent/view.js');

test('the drawn telescope button starts its action and disappears during a visit', () => {
  let opened = 0;
  spaceHud({ onHome() {}, onBack() {}, onTelescope() { opened++; }, suggested: true });
  const map = hud.children.at(-1);
  assert.match(map.innerHTML, /class="round-btn space-telescope suggested" aria-label="Teleskop"/);
  assert.ok(map.innerHTML.includes(ICON.telescope));
  assert.doesNotMatch(ICON.telescope, /🔭/);
  map.querySelector('.space-telescope').events.pointerdown({ preventDefault() {} });
  assert.equal(opened, 1);
  spaceHud({ visiting: true, onHome() {}, onBack() {} });
  assert.doesNotMatch(hud.children.at(-1).innerHTML, /space-telescope/);
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.space-telescope\s*\{[^}]*min-width: 100px; min-height: 100px;/);
});

test('the parent page renders the Space section with English place names and per-item lines', () => {
  dev.setMastery('space', 'saturn', 0.8);
  dev.setMastery('space', 'moon', 0.4);
  dev.setMastery('space', 'blackhole', 0.2);
  const page = showParentView({ onClose() {} });
  const section = page.innerHTML.match(/<section><h2>Space<\/h2>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(section);
  for (const name of ['Saturn', 'the Moon', 'the black hole']) assert.ok(section.includes(`<b class="pv-item">${name}</b>`), name);
  assert.match(section, /recognises it/);
  assert.match(section, /a guess: 33%/);
  assert.doesNotMatch(section, /Księżyc|czarna dziura/);
});

test('the mission router returns from the telescope and replay to the same parked stop', async () => {
  const scenes = {
    hub: 'Hub', space: 'Space', letters: 'LettersMission', counting: 'CountingMission', cones: 'ConesMission',
    name: 'NameMission', balloons: 'BalloonsMission', stones: 'StonesMission', lookout: 'LookoutMission',
    delivery: 'DeliveryMission', picnic: 'PicnicMission', garage: 'GarageMission', moon: 'MoonMission',
    mars: 'MarsMission', saturn: 'SaturnMission', pluto: 'PlutoMission', stars: 'StarsMission', blackhole: 'BlackHoleMission', mercury: 'MercuryMission', venus: 'VenusMission', telescope: 'TelescopeMission', jupiter: 'JupiterMission', comet: 'CometMission', lighthouse: 'LighthouseMission', shallows: 'ShallowsMission', reef: 'ReefMission',
  };
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'virtual:pwa-register') return { url: 'data:text/javascript,export const registerSW = () => () => {};', shortCircuit: true };
      return next(specifier, context);
    },
    load(url, context, next) {
      let source;
      if (url.endsWith('.css')) source = 'export default {};';
      if (url.endsWith('/src/engine.js')) source = 'let stage; export const setStage = (s) => { stage = s; }; export const getStage = () => stage; export const camera = {};';
      if (url.endsWith('/src/fx/transition.js')) source = 'export const pawWipe = async (fn) => fn();';
      const kind = url.match(/\/src\/scenes\/([a-z]+)\.js$/)?.[1];
      if (scenes[kind]) source = `export class ${scenes[kind]} {
        constructor(game, { at = 'earth' } = {}) {
          this.kind = '${kind}'; this.area = '${['space', 'telescope', 'moon', 'mars', 'jupiter', 'saturn', 'pluto', 'blackhole', 'stars', 'mercury', 'venus'].includes(kind) ? 'space' : 'island'}';
          if ('${kind}' === 'space' || '${kind}' === 'telescope') this.at = at;
        }
      }`;
      return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
    },
  });
  await import('../src/main.js');
  await new Promise(setImmediate);
  const { game, getStage } = window.__pup;
  for (const at of ['earth', 'saturn', 'blackhole']) {
    await game.map('space', { at });
    await game.startMission('telescope');
    assert.equal(getStage().kind, 'telescope');
    assert.equal(getStage().at, at);
    await game.startMission('telescope');
    assert.equal(getStage().at, at);
    await game.home();
    assert.equal(getStage().kind, 'space');
    assert.equal(getStage().at, at);
  }
  await game.startMission('moon');
  await game.home();
  assert.equal(getStage().at, 'moon');
});
