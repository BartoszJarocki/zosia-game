import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

// The Name Train's syllable train (docs/design/fx7-syllable-train.md): MAMA, TATA and LALA built from whole syllables.
// Two MA wagons fill either slot, a wrong wagon swaps out and the right one stays, a replay moves nothing, the three
// task kinds are recorded apart, and the word card brings the example back without restarting the round.

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
}, querySelector: () => null, querySelectorAll: () => [] };
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) };
globalThis.__lines = [];

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
  if (url.endsWith('/src/audio.js')) source = `export const say = async (s) => { globalThis.__lines.push(...[s].flat()); };
    export const hush = () => {}; export const sfx = new Proxy({}, { get: () => () => {} });`;
  if (url.endsWith('/src/ui.js')) source = `
    const earned = {};
    export const badges = { get: () => earned, add: (kind) => { earned[kind] = (earned[kind] || 0) + 1; return earned; } };
    export const missionHud = () => {};
    export const bubble = (options) => { globalThis.__bubble = options; };
    export const hideBubble = () => {};
    export const nudgeBubble = () => {};
    export const setProgress = () => {};
    export const setRounds = () => {};
    export const celebrate = () => {};`;
  return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });

const { CONFIG } = await import('../src/config.js');
const { T, PRAISE, YES_STEP, NO, allSegments } = await import('../src/lang/pl.js');
const { LEVELS, ALL_LETTERS } = await import('../src/levels/data.js');
const { EASIER } = await import('../src/levels/easier.js');
const { learning } = await import('../src/learning/events.js');
const { applyEvent } = await import('../src/learning/mastery.js');
const { sectionReports } = await import('../src/parent/report.js');
const { syllableWagons, nextSlot, couple } = await import('../src/levels/train.js');
const { NameMission, WORD_PICS } = await import('../src/scenes/name.js');

const flush = () => new Promise(setImmediate);
const settle = async (n = 12) => { for (let i = 0; i < n; i++) await flush(); };
let clock = 0;
const until = async (s, predicate, what) => {
  for (let i = 0; i < 400; i++) { if (predicate()) return; s.update(0.05, (clock += 0.05)); await flush(); }
  assert.fail(`never reached: ${what}`);
};
const LEVEL = { match: 10, hear: 11, build: 12 };
/** A syllable level's mission, its first round built around `word`. */
const start = async (mode, word = 'MAMA') => {
  CONFIG.level = LEVEL[mode];
  const s = NameMission({ home() {}, startMission() {} });
  s.order = [word, ...s.order.filter((w) => w !== word)];
  s.build(); s.collect();
  globalThis.__lines = [];
  const round = s.round(0);
  await until(s, () => s.learn.current && s.prompt?.length, `${mode} asked`);
  return { s, round };
};
const stop = (s) => { s.alive = false; s.exit?.(); };
const events = () => { const got = []; const off = learning.subscribe((e) => got.push(e)); return { got, off }; };
const tap = (o) => o.userData.onTap(o);
/** The blocks waiting on the grass that carry this syllable. */
const waiting = (s, syllable) => s.blocks.filter((b) => b.userData.choice === syllable && b.userData.onTap);
const others = (s, syllable) => s.blocks.filter((b) => b.userData.choice && b.userData.choice !== syllable && b.userData.onTap);
const onTrain = (s) => s.wagons.filter((w) => w.slot !== null).map((w) => `${w.slot}:${w.syllable}`).sort();
const said = (line) => globalThis.__lines.includes(line);

test('two MA wagons fill either slot: the text decides, not which wagon came first', () => {
  for (const firstPick of [0, 1]) {
    const wagons = syllableWagons(['MA', 'MA'], { extras: 1, pool: ['MA', 'TA', 'LA'] });
    const ma = wagons.filter((w) => w.syllable === 'MA');
    assert.equal(ma.length, 2);
    assert.equal(couple(['MA', 'MA'], wagons, ma[firstPick]), 0, 'the wagon picked first takes the first slot');
    assert.equal(couple(['MA', 'MA'], wagons, ma[1 - firstPick]), 1, 'the other MA takes the second');
    assert.equal(nextSlot(['MA', 'MA'], wagons), -1, 'the word is built');
  }
  const wagons = [{ syllable: 'MA', slot: null }];
  assert.equal(couple(['MA', 'MA'], wagons, { syllable: 'MA', slot: null }), 0, 'a wagon made elsewhere with the same text fits as well');
});

test('a wrong wagon does not fit, and the right one stays where it is', () => {
  const word = ['TA', 'TA'];
  const wagons = [{ syllable: 'TA', slot: null }, { syllable: 'MA', slot: null }, { syllable: 'TA', slot: null }];
  assert.equal(couple(word, wagons, wagons[0]), 0);
  assert.equal(couple(word, wagons, wagons[1]), -1, 'MA is not TA');
  assert.deepEqual(wagons.map((w) => w.slot), [0, null, null], 'nothing moved');
  assert.equal(nextSlot(word, wagons), 1, 'the second wagon is still to fill');
  assert.equal(couple(word, wagons, wagons[0]), -1, 'a wagon already on the train is not put on again');
});

test('a round puts out the word\'s syllables, one left on the train when asked, and extras the word does not have', () => {
  for (let i = 0; i < 30; i++) {
    const wagons = syllableWagons(['LA', 'LA'], { leave: 1, extras: 2, pool: ['MA', 'MA', 'TA', 'LA'] });
    assert.equal(wagons.filter((w) => w.slot !== null).length, 1, 'one piece arrives on the train');
    assert.deepEqual(wagons.filter((w) => w.slot === null).map((w) => w.syllable).sort(), ['LA', 'MA', 'TA'], 'the missing LA and two others');
  }
});

test('GAME.md: three syllable levels on top of the nine, with MAMA, TATA and LALA and letters from ALL only', () => {
  const rows = LEVELS.name;
  assert.equal(rows.length, 12);
  assert.deepEqual(rows.slice(9).map((r) => r.mode), ['match', 'hear', 'build']);
  for (const row of rows.slice(9)) {
    assert.deepEqual(row.words, ['MAMA', 'TATA', 'LALA']);
    assert.ok(row.words.join('').split('').every((l) => ALL_LETTERS.includes(l)));
    assert.deepEqual(row.syllables.LALA, ['LA', 'LA']);
    for (const w of row.words) assert.ok(WORD_PICS[w], `${w} has a picture to show with it`);
  }
});

test('a gentler run of a syllable level shows the word in pieces, and still has a block to choose against', () => {
  for (const row of LEVELS.name.slice(9)) {
    const gentler = EASIER.name({ ...row });
    assert.equal(gentler.mode, 'match');
    assert.equal(gentler.extras, 1);
  }
});

test('the first syllable level: two wagons and MA blocks; each tap says "Ma!", and the joined word says "Mama!" and shows her', async () => {
  const { s, round } = await start('match');
  assert.equal(s.train.userData.slots.length, 2, 'two wagons');
  assert.equal(waiting(s, 'MA').length, 2, 'two MA blocks on the grass');
  assert.deepEqual(globalThis.__bubble.word, 'MA\u00a0MA', 'the bubble shows the word in two pieces');
  assert.equal(s.ghosts.filter(Boolean).length, 2, 'a faint MA on each wagon');
  for (let i = 0; i < 2; i++) {
    globalThis.__lines = [];
    await tap(waiting(s, 'MA')[0]);
    await settle();
    assert.ok(said('Ma!'), `the block says its syllable (heard ${JSON.stringify(globalThis.__lines)})`);
    assert.ok(!said('Em!') && !said('A!'), 'never its letters');
  }
  await round;
  assert.ok(said('Mama!'), 'the word is said');
  assert.equal(globalThis.__bubble.pic, WORD_PICS.MAMA, 'the bubble shows Mama');
  assert.ok(said('Buziaczek dla mamy!'));
  stop(s);
});

test('a wrong wagon swaps out: it says its syllable, goes back to the grass, and the right one stays on the train', async () => {
  const { s } = await start('match');
  const { got, off } = events();
  await tap(waiting(s, 'MA')[0]);
  await settle();
  assert.deepEqual(onTrain(s), ['0:MA']);
  const wrong = others(s, 'MA')[0], home = wrong.userData.home.clone();
  globalThis.__lines = [];
  await tap(wrong);
  await settle();
  assert.deepEqual(onTrain(s), ['0:MA'], 'the right one stays');
  assert.equal(wrong.userData.wagon.slot, null, 'the wrong one is not on the train');
  assert.ok(wrong.position.distanceTo(home) < 1e-6, 'it hopped back to where it stood');
  assert.equal(globalThis.__lines[0], T.syllable(wrong.userData.choice)[0], 'it says its own syllable');
  assert.ok(NO.includes(globalThis.__lines[1]), 'then the gentle no');
  assert.ok(s.learn.current.assist <= 1, 'one wrong wagon shows nothing more');
  await tap(wrong);
  await settle();
  off();
  assert.deepEqual(got.map((e) => [e.skill, e.correct, e.chosen]), [['syllableVisual', true, 'MA'], ['syllableVisual', false, wrong.userData.choice], ['syllableVisual', false, wrong.userData.choice]], 'back on the grass, it can be tried again');
  assert.equal(s.learn.current?.item, 'MA', 'the second wagon is still asked');
  stop(s);
});

test('a replay of the question moves no wagon', async () => {
  for (const mode of ['match', 'hear', 'build']) {
    const { s } = await start(mode);
    if (mode !== 'hear') { await tap(waiting(s, 'MA')[0]); await settle(); }
    const before = s.blocks.map((b) => b.getWorldPosition(b.position.clone()));
    const train = onTrain(s);
    globalThis.__lines = [];
    globalThis.__bubble.onTap();
    await settle();
    assert.deepEqual(globalThis.__lines, s.prompt, `${mode}: the question is said again`);
    assert.deepEqual(onTrain(s), train, `${mode}: the train holds what it held`);
    s.blocks.forEach((b, i) => assert.ok(b.getWorldPosition(b.position.clone()).distanceTo(before[i]) < 1e-6, `${mode}: block ${i} stayed`));
    stop(s);
  }
});

test('`hear` leaves one syllable on the train and asks only for the missing one, by its sound', async () => {
  const { s, round } = await start('hear', 'TATA');
  assert.equal(onTrain(s).length, 1, 'one piece arrived on the train');
  assert.deepEqual(globalThis.__lines, T.syllableHear('TATA', 'TA'));
  assert.equal(globalThis.__bubble.word, undefined, 'no word in the bubble');
  await tap(waiting(s, 'TA')[0]);
  await round;
  assert.ok(said('Tata!'), 'one piece built the word');
  stop(s);
});

test('`build` shows no written word before she answers: only the picture', async () => {
  const { s } = await start('build', 'LALA');
  assert.equal(globalThis.__bubble.word, undefined);
  assert.equal(globalThis.__bubble.pic, WORD_PICS.LALA);
  assert.equal(s.ghosts.filter(Boolean).length, 0, 'nothing faint on the wagons');
  assert.deepEqual(globalThis.__lines, T.buildStart('LALA'));
  await tap(waiting(s, 'LA')[0]);
  await settle();
  assert.deepEqual(s.prompt, T.buildNext('LA'), '"La… i co dalej?"');
  assert.equal(globalThis.__bubble.word, undefined, 'still no word');
  stop(s);
});

test('the three task kinds are recorded apart, and the grown-ups\' page lists them as three rows', async () => {
  const { got, off } = events();
  for (const mode of ['match', 'hear', 'build']) {
    const { s, round } = await start(mode);
    while (s.learn.current) { await tap(waiting(s, 'MA')[0]); await settle(); }
    await round;
    stop(s);
  }
  off();
  const solved = got.filter((e) => e.correct);
  assert.deepEqual(solved.map((e) => e.skill), ['syllableVisual', 'syllableVisual', 'syllableAudio', 'syllableBuild', 'syllableBuild']);
  assert.ok(solved.every((e) => e.item === 'MA' && e.mission === 'name'));
  assert.deepEqual(solved.map((e) => Boolean(e.answerOnScreen)), [false, false, true, false, true], 'a piece she could copy from the train moves no mastery');
  const skills = {};
  for (const e of got) applyEvent(skills, e);
  const card = sectionReports(skills, 'syllables').find((r) => r.item === 'MA');
  assert.deepEqual(card.rows.map((r) => [r.label, r.solved]), [['matches it to the word shown', 2], ['finds it by its sound', 1], ['builds a word with it', 2]]);
});

test('the word card brings the example back mid-question, and the round goes on', async () => {
  const { s, round } = await start('build');
  const { got, off } = events();
  await tap(waiting(s, 'MA')[0]);
  await settle();
  const asked = s.learn.current;
  globalThis.__lines = [];
  tap(s.card);
  await settle();
  assert.equal(s.learn.current, asked, 'the same question is still open');
  assert.deepEqual(onTrain(s), ['0:MA'], 'the piece on the train stays');
  assert.equal(globalThis.__bubble.word, 'MA\u00a0MA', 'the bubble shows the word in pieces');
  assert.ok(s.ghosts[1]?.visible, 'the empty wagon shows its syllable faintly');
  assert.deepEqual(globalThis.__lines, [...T.lookAtWord(), ...T.syllableNext('MA')]);
  await tap(waiting(s, 'MA')[0]);
  await round;
  off();
  const last = got.filter((e) => e.correct).at(-1);
  assert.ok(last.answerOnScreen, 'an answer with the example on the screen moves no mastery');
  assert.ok(last.assistLevel >= 2, 'the example counts as help');
  assert.ok(said('Mama!'), 'the word was built in the same round');
  stop(s);

  const plain = await start('match');
  assert.equal(plain.s.card, undefined, '`match` is the example itself: no card');
  stop(plain.s);
});

test('everything the syllable train says is in the voice list', async () => {
  const voice = new Set(allSegments(LEVELS, ALL_LETTERS));
  const heard = new Set();
  for (const mode of ['match', 'hear', 'build']) {
    for (const word of LEVELS.name[LEVEL[mode] - 1].words) {
      globalThis.__lines = [];
      const { s, round } = await start(mode, word);
      const syllable = s.L.syllables[word][0];
      if (s.card) tap(s.card);
      tap(others(s, syllable)[0]);
      await settle();
      while (s.learn.current) { await tap(waiting(s, syllable)[0]); await settle(); }
      await round;
      await settle();
      globalThis.__lines.forEach((l) => heard.add(l));
      stop(s);
    }
  }
  const missing = [...heard].filter((l) => !voice.has(l) && !PRAISE.includes(l) && !YES_STEP.includes(l));
  assert.deepEqual(missing, []);
  for (const line of ['La!', 'Lala!', 'Buziaczek dla lali!']) assert.ok(heard.has(line), `"${line}" is said`);
});
