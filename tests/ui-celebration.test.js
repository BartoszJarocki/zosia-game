import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

function element() {
  const selectors = new Map();
  return {
    isConnected: true, children: [], events: {}, style: { setProperty() {} }, classList: { add() {}, remove() {} },
    append(child) { this.children.push(child); },
    remove() { this.isConnected = false; },
    querySelector(selector) { if (!selectors.has(selector)) selectors.set(selector, element()); return selectors.get(selector); },
    addEventListener(event, fn) { this.events[event] = fn; },
  };
}
const hud = element();
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.document = {
  body: element(), getElementById: () => hud,
  createElement(tag) { return tag === 'template' ? { content: { firstElementChild: element() } } : element(); },
};
globalThis.__celebrationLines = [];
registerHooks({ load(url, context, next) {
  if (url.endsWith('/src/audio.js')) return { format: 'module', source: 'export const say = async (lines) => { globalThis.__celebrationLines.push(...lines); }; export const sfx = { pop() {} };', shortCircuit: true };
  if (url.endsWith('/src/textures.js')) return { format: 'module', source: 'export const DICE = {};', shortCircuit: true };
  return next(url, context);
} });
const { celebrate, CELEBRATION_IDLE_MS } = await import('../src/ui.js');

test('space celebrations ask to fly on; island celebrations still ask about the island', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const homes = [], agains = [];
  for (const kind of ['moon', 'counting', 'letters']) {
    celebrate({ kind, talk: Promise.resolve(), onHome: () => homes.push(kind), onAgain: () => agains.push(kind) });
    await new Promise(setImmediate);
    const card = hud.children.at(-1);
    assert.equal(globalThis.__celebrationLines.at(-1), kind === 'moon' ? 'Jeszcze raz czy lecimy dalej?' : 'Jeszcze raz czy na wyspę?');
    card.querySelector('.again').events.pointerdown({ preventDefault() {} });
  }
  assert.deepEqual(agains, ['moon', 'counting', 'letters']);
  assert.deepEqual(homes, []);
  celebrate({ kind: 'moon', talk: Promise.resolve(), onHome: () => homes.push('moon'), onAgain() {} });
  await new Promise(setImmediate);
  t.mock.timers.tick(CELEBRATION_IDLE_MS);
  assert.deepEqual(homes, ['moon']);
});
