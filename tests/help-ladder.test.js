import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

// One help ladder in every mission (docs/IMPROVEMENT-PLAN.md, B2): one wrong answer gets "no" and the question
// again, nothing more; the second gets a step that is still not the answer; only the third (or a long wait) shows it.

const noop = () => {};
globalThis.window = { addEventListener: noop, removeEventListener: noop };
globalThis.location = { search: '' };
globalThis.innerWidth = 1180;
globalThis.innerHeight = 820;
globalThis.document = { createElement() {
  const canvas = { width: 0, height: 0 };
  const ctx = new Proxy({ canvas, createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 30 }) }, { get: (o, k) => k in o ? o[k] : noop });
  canvas.getContext = () => ctx;
  return canvas;
}, querySelectorAll: () => [] };
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
globalThis.__lines = [];
globalThis.__sfx = [];

const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const stage = engine.slice(engine.indexOf('export class Stage'), engine.indexOf('\nlet current'));
registerHooks({ load(url, context, next) {
  let source;
  if (url.endsWith('?raw')) source = `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`;
  if (url.endsWith('/src/engine.js')) source = `import * as THREE from 'three';
    export const camera = new THREE.PerspectiveCamera(42, 1180 / 820, 0.1, 500);
    export const post = { tier: 'medium' };
    export const ease = new Proxy({}, { get: () => (x) => x });
    export const animate = async (ms, fn) => { for (const t of [0, 0.25, 0.5, 0.75, 1]) fn(t); };
    export const wait = () => new Promise(setImmediate);
    export const hop = async () => {};
    export const shakeNo = () => {};
    export const addSkyAndLights = () => {};
    ${stage}`;
  if (url.endsWith('/src/world/portrait.js')) source = `export const portrait = () => ({ texture: null, dispose: () => {} });`;
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: (_, k) => () => { globalThis.__sfx.push(k); } });`;
  if (url.endsWith('/src/ui.js')) source = `
    const earned = {};
    export const badges = { get: () => earned, add: (kind) => { earned[kind] = (earned[kind] || 0) + 1; return earned; } };
    export const missionHud = () => {};
    export const bubble = (options) => { globalThis.__bubble = options; };
    export const hideBubble = () => {};
    export const nudgeBubble = () => {};
    export const setProgress = () => {};
    export const setRounds = () => {};
    export const celebrate = () => {};
    export const liftPanel = () => new Proxy({ hint: (f) => { globalThis.__panelHint = f; } }, { get: (o, k) => o[k] || (() => {}) });`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { CONFIG } = await import('../src/config.js');
const { T } = await import('../src/lang/pl.js');
const { answerNamed } = await import('../tools/playtest/playcheck-rules.mjs');
const { CometMission } = await import('../src/scenes/comet.js');
const { StarsMission } = await import('../src/scenes/stars.js');
const { VenusMission } = await import('../src/scenes/venus.js');
const { JupiterMission } = await import('../src/scenes/jupiter.js');
const { SaturnMission } = await import('../src/scenes/saturn.js');
const { MercuryMission } = await import('../src/scenes/mercury.js');
const { MarsMission } = await import('../src/scenes/mars.js');
const { PlutoMission } = await import('../src/scenes/pluto.js');
const { ReefMission } = await import('../src/scenes/reef.js');
const { NameMission } = await import('../src/scenes/name.js');
const { PortMission } = await import('../src/scenes/port.js');
const { LighthouseMission } = await import('../src/scenes/lighthouse.js');
const { LookoutMission } = await import('../src/scenes/lookout.js');
const { StonesMission } = await import('../src/scenes/stones.js');
const { CountingMission } = await import('../src/scenes/counting.js');
const { BOATS } = await import('../src/levels/port.js');

const flush = () => new Promise(setImmediate);
let clock = 0;
const settle = async (s, frames = 30) => { for (let i = 0; i < frames; i++) { s.update(0.05, (clock += 0.05)); await flush(); } };
const until = async (s, predicate, what) => {
  for (let i = 0; i < 400; i++) { if (predicate()) return; s.update(0.05, (clock += 0.05)); await flush(); }
  assert.fail(`never reached: ${what}`);
};
const tap = (o) => o.userData.onTap(o);
const choices = (s, key = 'choice') => s.tappables.filter((o) => o.userData[key] !== undefined && o.userData[key] !== null && o.parent);
const make = async (Scene, level, setup = () => {}) => {
  CONFIG.level = level;
  const s = typeof Scene === 'function' && Scene.prototype ? new Scene({ home() {}, startMission() {} }) : Scene({ home() {}, startMission() {} });
  setup(s);
  s.build(); s.collect();
  await s.landed;
  return s;
};

/** How the right options look (glow, colour, halo), to tell a lit answer from one left alone. */
const looks = (objs) => JSON.stringify(objs.map((o) => {
  const out = [];
  o.traverse((m) => {
    for (const mt of [m.material].flat().filter(Boolean)) out.push([m.visible, mt.emissive?.getHex(), mt.emissiveIntensity, mt.color?.getHex(), mt.opacity]);
  });
  return out;
}));

/**
 * Every place, as one row: open() a question; wrong(s) answers it wrongly once; right(s) the right options;
 * shown(s, since) names what else gives the answer away (a count clapped, flashes, the bowl lifted, the number in
 * the bubble). options(s), where only two are offered: what is left to pick from (one taken away leaves the answer). misses: false when a wrong count is answered in the scene's own words and only a wait reveals it.
 */
const PLACES = [
  {
    name: 'Comet Catch', open: async () => { const s = await make(CometMission, 2, (x) => { x.pick = (k, pool) => pool[0]; }); s.round(0); await until(s, () => s.phase === 'catch' && s.comets.length && s.prompt.length, 'comets'); return s; },
    wrong: (s) => tap(choices(s, 'letter').find((o) => o.userData.letter !== s.last && !o.userData.popped)),
    right: (s) => s.comets.filter((o) => o.userData.letter === s.last),
  },
  {
    name: 'Star Pictures', open: async () => { const s = await make(StarsMission, 4, (x) => { x.plan = [5]; }); s.round(0); await until(s, () => s.phase === 'choosing' && s.aid, 'a star'); return s; },
    wrong: (s) => tap(s.stars.find((x) => !x.userData.lit && x.userData.num !== s.last)),
    right: (s) => [s.stars[s.last - 1]],
  },
  {
    name: "Venus's Clouds (part)", open: async () => { const s = await make(VenusMission, 3); s.round(0); await until(s, () => s.phase === 'asking' && s.aid, 'tiles'); return s; },
    wrong: (s) => tap(choices(s).find((o) => o.userData.choice !== s.last)),
    right: (s) => choices(s).filter((o) => o.userData.choice === s.last),
  },
  {
    name: "Jupiter's Stripes", open: async () => { const s = await make(JupiterMission, 1, (x) => { x.random = () => 0; }); s.stripesRound(); await until(s, () => s.phase === 'stripes' && s.aid, 'pots'); return s; },
    wrong: (s) => tap(choices(s).find((o) => o.userData.choice !== s.last)),
    right: (s) => choices(s).filter((o) => o.userData.choice === s.last),
  },
  {
    name: 'Jupiter, bigger or smaller', open: async () => { const s = await make(JupiterMission, 1, (x) => { x.random = () => 0.9; }); s.sizeRound(); await until(s, () => s.phase === 'bigger' && s.aid, 'balls'); return s; },
    wrong: (s) => tap(choices(s).find((o) => o.userData.choice !== s.last)),
    right: (s) => choices(s).filter((o) => o.userData.choice === s.last),
    options: (s) => choices(s),
  },
  {
    name: "Saturn's Rings", open: async () => { const s = await make(SaturnMission, 1); s.round(0); await until(s, () => s.phase === 'asking' && s.aid, 'a piece'); return s; },
    wrong: (s) => s.choose(s.last === 'ice' ? 'rock' : 'ice'),
    right: (s) => [s.rings[s.last].mesh],
  },
  {
    name: 'Mercury (a quick look)', open: async () => { const s = await make(MercuryMission, 3, (x) => { x.pick = () => 3; }); s.craterRound(); await until(s, () => s.phase === 'choosing' && s.aid, 'tiles'); return s; },
    wrong: (s) => tap(s.blocks.find((b) => b.userData.num !== s.last && b.parent && !b.userData.gone)),
    right: (s) => s.blocks.filter((b) => b.userData.num === s.last),
  },
  {
    name: 'Mars Rover (dots)', open: async () => { const s = await make(MarsMission, 4, (x) => { x.pick = () => 3; }); s.round(0); await until(s, () => s.aid && s.prompt.length, 'rocks'); return s; },
    wrong: (s) => tap(choices(s, 'num').find((o) => o.userData.num !== s.last)),
    right: (s) => choices(s, 'num').filter((o) => o.userData.num === s.last),
  },
  {
    name: "Pluto's Heart", open: async () => { const s = await make(PlutoMission, 2); s.round(0); await until(s, () => s.phase === 'choosing' && s.aid, 'shapes'); return s; },
    wrong: (s) => tap(choices(s).find((o) => o.userData.choice !== 'heart')),
    right: (s) => choices(s).filter((o) => o.userData.choice === 'heart'),
  },
  {
    name: 'The Reef', open: async () => { const s = await make(ReefMission, 2); s.round(0); await until(s, () => s.phase === 'asking' && s.aid, 'scenes'); return s; },
    wrong: (s) => tap(choices(s).find((o) => o.userData.choice !== s.last)),
    right: (s) => choices(s).filter((o) => o.userData.choice === s.last),
  },
  {
    name: 'Name Train, whose train', open: async () => { const s = await make(NameMission, 3); s.round(0); await until(s, () => s.aid && s.trains?.length, 'trains'); return s; },
    wrong: (s) => tap(s.trains.find((x) => x.userData.word !== s.last && x.userData.onTap)),
    right: (s) => s.trains.filter((t) => t.userData.word === s.last).map((t) => t.userData.board), // (the trains puff steam all the time)
    shown: (s, since) => [since.sfx.includes('toot') && 'the right train toots', s.trains.some((t) => t.userData.word === s.last && t.userData.hinting) && 'the right train pulses'].filter(Boolean).join(', '),
  },
  {
    name: 'The Port, which boat', open: async () => { const s = await make(PortMission, 3); s.round(0); await until(s, () => s.phase === 'choosing' && s.aid, 'boats'); return s; },
    wrong: (s) => tap(s.tickButtons.find((t) => t.userData.num !== s.last && t.userData.onTap)),
    right: (s) => s.boats.filter((b) => b.userData.num === s.last),
    shown: (s) => (s.boards.some((b) => b.userData.hinting) ? "the right boat's name pulses" : ''),
  },
  {
    name: 'The Port, toot the name', open: async () => { const s = await make(PortMission, 2, (x) => { x.pick = () => 'FOKA'; }); s.round(0); await until(s, () => s.phase === 'asking' && s.aid, 'the horn'); return s; },
    wrong: (s) => tap(s.boats[0]),
    right: () => [],
    shown: (s, since) => (since.said.some((l) => BOATS.some((b) => b.syllables.some((y) => T.syllable(y)[0] === l))) ? 'Chase claps the name' : ''),
  },
  {
    name: 'Lighthouse, make the flashes', open: async () => { const s = await make(LighthouseMission, 3, (x) => { x.pick = () => 3; }); s.round(0); await until(s, () => s.phase === 'making' && s.aid, 'the lamp'); return s; },
    wrong: (s) => tap(s.boat), // (no flash made: too few)
    right: () => [],
    shown: (s, since) => (since.sfx.includes('ding') ? 'the lamp flashes the answer' : ''),
  },
  {
    name: 'Lighthouse, which buoy', open: async () => { const s = await make(LighthouseMission, 1, (x) => { x.pick = () => 2; }); s.round(0); await until(s, () => s.phase === 'choosing' && s.aid, 'buoys'); return s; },
    wrong: (s) => tap(choices(s, 'num').find((o) => o.userData.num !== s.last)),
    right: (s) => choices(s, 'num').filter((o) => o.userData.num === s.last),
    options: (s) => choices(s, 'num'),
  },
  {
    name: 'The Lookout, one floor up', open: async () => {
      const s = await make(LookoutMission, 4);
      s.round(0); await until(s, () => s.aid && s.onPress, 'the first ride');
      const ride = s.onPress(s.last); await ride; await settle(s, 60);
      globalThis.__panelHint = null;
      s.round(1); await until(s, () => s.aid && s.learn.current?.skill === 'sequence', 'the next-door ride');
      return s;
    },
    wrong: (s) => s.onPress(s.last === 1 ? 2 : 1),
    right: () => [],
    shown: (s) => [globalThis.__bubble?.big === String(s.last) && 'the number in the bubble', globalThis.__panelHint === s.last && 'its button pulses'].filter(Boolean).join(', '),
  },
  {
    name: 'The River, what comes next', open: async () => {
      const s = await make(StonesMission, 5);
      s.round(0); await until(s, () => s.aid && choices(s, 'num').some((o) => o.userData.num === 1), 'the first stones');
      await tap(choices(s, 'num').find((o) => o.userData.num === 1));
      await until(s, () => s.last === 2 && s.aid && s.learn.current?.skill === 'sequence', 'the second row');
      return s;
    },
    wrong: (s) => tap(choices(s, 'num').find((o) => o.userData.num !== s.last && !o.userData.gone)),
    right: (s) => choices(s, 'num').filter((o) => o.userData.num === s.last),
    options: (s) => choices(s, 'num').filter((o) => !o.userData.gone),
    shown: (s) => (globalThis.__bubble?.big === String(s.last) ? 'the number in the bubble' : ''),
  },
  {
    name: 'The River, the missing stone', open: async () => { const s = await make(StonesMission, 4); s.round(0); await until(s, () => s.aid && s.learn.current?.skill === 'sequence', 'the gap'); return s; },
    wrong: (s) => { const st = s.tappables.find((o) => o.userData.num !== undefined && o.userData.num !== s.last && o.userData.drag); return st.userData.drag.onTap(st); },
    right: (s) => s.tappables.filter((o) => o.userData.num === s.last && o.userData.drag),
    options: (s) => s.tappables.filter((o) => o.userData.num !== undefined && o.userData.drag),
    shown: () => (globalThis.__bubble?.word && !globalThis.__bubble.word.includes('?') ? 'the number in the gap' : ''),
  },
  {
    name: 'Treat House, a quick look', open: async () => { const s = await make(CountingMission, 5, (x) => { x.pick = () => 3; }); s.flashRound(); await until(s, () => s.aid && s.learn.current?.skill === 'quantity' && s.tappables.some((o) => o.userData.drag), 'the pile'); return s; },
    wrong: async (s) => {
      for (let i = 0; i < 2; i++) { const b = s.tappables.find((o) => o.userData.drag); b.userData.drag.onTap(b); }
      await tap(s.pup);
    },
    right: () => [],
    misses: false,
    shown: (s) => { let bowl = null; s.scene.traverse((o) => { if (o.userData.bowl?.userData.to) bowl = o.userData.bowl; }); return bowl && bowl.position.x < -1 ? 'the bowl lifts aside' : ''; },
  },
];

/** What gives the answer away since `snap`: a pulse, a glow, a spoken name, the scene's own show. */
function given(place, s, snap) {
  const right = place.right(s);
  const since = { said: globalThis.__lines.slice(snap.lines), sfx: globalThis.__sfx.slice(snap.sfx) };
  return [
    right.some((o) => { let h = false; o.traverse((m) => { h ||= Boolean(m.userData.hinting); }); return h; }) && 'the answer pulses',
    looks(right) !== snap.looks && 'the answer lights up',
    answerNamed(s.last, since.said, snap.prompt) && 'the answer is named',
    since.said.some((l) => /\btutaj\b/iu.test(l)) && 'it says where the answer is ("tutaj")',
    place.options && place.options(s).every((o) => right.includes(o)) && 'only the answer is left',
    place.shown?.(s, since),
  ].filter(Boolean);
}
const snapshot = (place, s) => ({ lines: globalThis.__lines.length, sfx: globalThis.__sfx.length, looks: looks(place.right(s)), prompt: globalThis.__lines.slice() });
const help = (s) => s.aid?.state.level ?? null;

for (const place of PLACES) {
  test(`${place.name}: one wrong answer gets "no" and the question again; the next is a step that is not the answer`, async () => {
    const s = await place.open();
    const q = s.learn.current;
    const snap = snapshot(place, s);
    await place.wrong(s);
    await settle(s);
    assert.equal(s.learn.current, q, 'the question is still hers');
    assert.equal(help(s), 1, 'help is at "try again"');
    assert.ok(s.learn.current.assist <= 1, `logged help ${s.learn.current.assist}`);
    assert.deepEqual(given(place, s, snap), [], 'one wrong answer shows nothing more');
    assert.ok(globalThis.__lines.length > snap.lines, 'she hears a "no"');

    await place.wrong(s);
    await settle(s, 60);
    assert.equal(s.learn.current, q);
    assert.equal(help(s), 2, 'the middle step');
    assert.deepEqual(given(place, s, snap), [], 'the middle step is not the answer');
    s.alive = false; s.exit?.();
  });

  if (place.misses !== false) {
    test(`${place.name}: a third wrong answer shows the answer, and the question is still hers to answer`, async () => {
      const s = await place.open();
      const q = s.learn.current, snap = snapshot(place, s);
      for (let i = 0; i < 3; i++) { await place.wrong(s); await settle(s, 60); }
      assert.equal(s.learn.current, q, 'the game does not answer for her');
      assert.equal(help(s), 3);
      assert.notDeepEqual(given(place, s, snap), [], 'the answer is shown');
      s.alive = false; s.exit?.();
    });
  }

  test(`${place.name}: when she waits, help climbs to the answer`, async () => {
    const s = await place.open();
    const q = s.learn.current, snap = snapshot(place, s);
    for (const seconds of [6, 10, 17, 25]) {
      s.speaking = false;
      s.aid.quietFrom = performance.now() - seconds * 1000 - 1;
      s.tickAssist();
      await settle(s, 60);
      if (seconds === 17) assert.deepEqual(given(place, s, snap), [], 'the clue is not the answer');
    }
    assert.equal(s.learn.current, q);
    assert.equal(help(s), 3);
    assert.notDeepEqual(given(place, s, snap), [], 'the answer is shown');
    s.alive = false; s.exit?.();
  });
}
