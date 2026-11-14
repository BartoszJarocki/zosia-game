import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// A page with just enough DOM for the HUD: classes, listeners, custom properties, sizes, and the markup each node was made from.
function element(html = '') {
  const found = new Map();
  const classes = new Set([...(html.match(/^<\w+[^>]*?class="([^"]*)"/)?.[1] ?? '').split(' ').filter(Boolean)]);
  const node = {
    html, children: [], listeners: {}, props: {}, size: { width: 0, height: 0 },
    classList: {
      add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c),
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
    },
    style: { setProperty: (name, value) => { node.props[name] = String(value); } },
    append(child) { node.children.push(child); },
    setAttribute() {},
    getBoundingClientRect() { return node.size; },
    querySelector(selector) { if (!found.has(selector)) found.set(selector, element()); return found.get(selector); },
    addEventListener(event, fn) { (node.listeners[event] ??= []).push(fn); },
    fire(event) { for (const fn of node.listeners[event] ?? []) fn({ preventDefault() {} }); },
  };
  return node;
}
const hud = element();
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.document = {
  body: element(), getElementById: () => hud,
  createElement: () => {
    const template = { content: {} };
    Object.defineProperty(template, 'innerHTML', { set(html) { template.content.firstElementChild = element(html); } });
    return template;
  },
};
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) };
registerHooks({ load(url, context, next) {
  if (url.endsWith('/src/audio.js')) return { format: 'module', source: 'export const say = async () => {}; export const sfx = { pop() {} }; export const soundsStarted = () => 0;', shortCircuit: true };
  if (url.endsWith('/src/textures.js')) return { format: 'module', source: 'export const DICE = {};', shortCircuit: true };
  return next(url, context);
} });
const { hubHud, spaceHud, setParentOpener } = await import('../src/ui.js');

let opened = 0;
setParentOpener(() => { opened++; });

const shelf = () => { hubHud(); return hud.children.at(-1); };
const parentButton = () => { spaceHud({ onHome() {} }); return hud.children.at(-1).querySelector('.space-parent'); };
const homeButton = (onHome) => { spaceHud({ onHome }); return hud.children.at(-1).querySelector('.space-home'); };
const holding = (node) => node.classList.contains('holding');

// Both of the grown-ups' places: the shelf on the island, and the paw on the space and the sea maps (one spaceHud serves both).
const PLACES = { 'the badge shelf': shelf, 'the grown-ups paw on the maps': parentButton };

for (const [place, make] of Object.entries(PLACES)) {
  test(`${place} opens the grown-ups page at 3 s and not before`, (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    opened = 0;
    const button = make();
    button.fire('pointerdown');
    assert.equal(holding(button), true, 'the ring starts to fill at once');
    assert.equal(button.props['--hold'], '3000ms', 'and fills in 3 s');
    t.mock.timers.tick(2999);
    assert.equal(opened, 0, 'nothing opens at 2.9 s');
    assert.equal(holding(button), true);
    t.mock.timers.tick(1);
    assert.equal(opened, 1, 'it opens at 3 s');
    assert.equal(holding(button), false, 'and the ring is empty again');
  });

  test(`${place}: letting go early resets the ring and opens nothing`, (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    for (const release of ['pointerup', 'pointerleave', 'pointercancel']) {
      opened = 0;
      const button = make();
      button.fire('pointerdown');
      t.mock.timers.tick(2000);
      assert.equal(holding(button), true);
      button.fire(release);
      assert.equal(holding(button), false, `${release} empties the ring`);
      t.mock.timers.tick(5000);
      assert.equal(opened, 0, `${release} at 2 s opens nothing`);
    }
  });

  test(`${place}: a short tap opens nothing, and a second hold starts from empty`, (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    opened = 0;
    const button = make();
    button.fire('pointerdown');
    t.mock.timers.tick(150);
    button.fire('pointerup');
    t.mock.timers.tick(10000);
    assert.equal(opened, 0, 'a tap of 0.15 s opens nothing');
    button.fire('pointerdown');
    t.mock.timers.tick(2000);
    assert.equal(opened, 0, 'the tap before does not count towards the next hold');
    t.mock.timers.tick(1000);
    assert.equal(opened, 1);
  });
}

test('the grown-ups buttons are labelled for adults and show no words to the child', () => {
  const label = /aria-label="[^"]*przytrzymaj 3 sekundy"/;
  assert.match(shelf().html, label);
  spaceHud({ onHome() {} });
  assert.match(hud.children.at(-1).html.match(/<button[^>]*space-parent[^>]*>/)[0], label);
  const written = (html) => html.replace(/<[^>]*>/g, '');
  assert.doesNotMatch(written(hud.children.at(-1).html), /przytrzymaj/, 'only the label says it, nothing is written on the screen');
  assert.doesNotMatch(written(shelf().html), /przytrzymaj/);
});

test('the shelf is still invisible when empty and shows its badges when she has some', () => {
  saved.clear();
  assert.match(shelf().html, /class="shelf bare"/);
  saved.set('pup-patrol-badges', JSON.stringify({ counting: 2 }));
  assert.doesNotMatch(shelf().html, /bare/);
  saved.clear();
});

test('the shelf ring is drawn to the size of the shelf it is held on', () => {
  const button = shelf();
  const ring = button.children.at(-1);
  const lengthFor = (width, height) => {
    ring.size = { width, height };
    button.fire('pointerdown');
    const length = Number(ring.props['--ring']);
    button.fire('pointerup');
    return length;
  };
  const small = lengthFor(110, 110), wide = lengthFor(310, 90);
  assert.ok(small > 0 && Number.isFinite(small), 'the outline has a length');
  assert.ok(wide > small * 1.5, `a wider shelf has a longer ring (${small.toFixed(0)} then ${wide.toFixed(0)})`);
  assert.ok(wide < 2 * (310 + 90), 'and it fits inside the shelf box');
});

test('the home button keeps its 0.8 s hold and its own ring', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let homes = 0;
  opened = 0;
  const button = homeButton(() => { homes++; });
  button.fire('pointerdown');
  assert.equal(button.props['--hold'], '800ms');
  t.mock.timers.tick(799);
  assert.equal(homes, 0, 'not yet at 0.7 s');
  t.mock.timers.tick(1);
  assert.equal(homes, 1, 'home at 0.8 s');
  assert.equal(opened, 0, 'and it does not open the grown-ups page');
});
