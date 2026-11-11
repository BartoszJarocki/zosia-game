// The level the game gives her in each place (progress.js), on the real GAME.md, across reloads of the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { parseGame, startLevel } from '../../src/levels/parse.js';
import { VERSION } from '../../src/progress/migrations.js';

const KEY = 'pup-patrol-progress';
const stored = new Map();
globalThis.localStorage = { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v), removeItem: (k) => stored.delete(k) };
registerHooks({ load(url, context, next) {
  if (url.endsWith('?raw')) return { format: 'module', source: `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))};`, shortCircuit: true };
  if (url.endsWith('/src/ui.js')) return { format: 'module', source: 'export const badges = { get: () => ({}) };', shortCircuit: true };
  return next(url, context);
} });

const { starts } = parseGame(readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8'), { childName: 'Zosia' });
const start = (kind, age) => startLevel(starts, kind, age);
let loads = 0;
/** Open the game: progress.js reads the save as it is now. */
const open = () => import(new URL(`../../src/progress.js?load=${++loads}`, import.meta.url));
const seed = (save) => (save ? stored.set(KEY, JSON.stringify(save)) : stored.clear());
const savedAge = () => JSON.parse(stored.get(KEY)).age;

test('a place she has never played starts at the level for her age (3.5 from config)', async () => {
  seed(null);
  const p = await open();
  assert.equal(p.getAge(), 3.5);
  assert.equal(p.levelFor('mercury'), start('mercury', 3.5));
  assert.ok(p.levelFor('mercury') > 1);
  for (const kind of ['letters', 'cones', 'lookout', 'port']) assert.equal(p.levelFor(kind), p.startFor(kind), kind);
});

test('an old save: a level below the start moves up to it, a level above it is hers to keep', async () => {
  seed({ v: 6, missions: { mercury: { level: 1, good: 1, lastAcc: 1 }, cones: { level: 9, good: 0, lastAcc: 1 } }, skills: {}, sessions: { count: 0, recent: [] }, visited: {} });
  const p = await open();
  assert.equal(p.levelFor('mercury'), start('mercury', 3.5));
  assert.equal(p.levelFor('cones'), 9);
  assert.equal(JSON.parse(stored.get(KEY)).v, VERSION, 'the upgraded save is written');
});

test('the grown-ups can lower one place below its start, and it stays lowered', async () => {
  seed(null);
  let p = await open();
  assert.equal(p.dev.setLevel('mercury', 1), 1);
  assert.equal(p.levelFor('mercury'), 1);
  p = await open();
  assert.equal(p.levelFor('mercury'), 1, 'after a reload');
  p.setAge(p.getAge());
  assert.equal(p.levelFor('mercury'), 1, 'after choosing the same age again');
});

test('an older age moves places below the new start up; a younger one takes no stars away', async () => {
  seed(null);
  let p = await open();
  p.recordMission('stones', { scored: 2, clean: 1 }); // (played, not good enough to move up)
  assert.equal(p.levelFor('stones'), start('stones', 3.5));
  p.dev.setLevel('cones', 9);
  p.setAge(4);
  assert.ok(start('stones', 4) > start('stones', 3.5) && start('mercury', 4) > start('mercury', 3));
  assert.equal(p.levelFor('stones'), start('stones', 4), 'played, below the new start: moved up');
  assert.equal(p.levelFor('cones'), 9, 'above the new start: kept');
  assert.equal(p.levelFor('mercury'), start('mercury', 4), 'never played: the new start');
  assert.equal(savedAge(), 4);
  p.setAge(3);
  p = await open();
  assert.equal(p.getAge(), 3);
  assert.deepEqual([p.levelFor('stones'), p.levelFor('cones')], [start('stones', 4), 9], 'what she played keeps its stars');
  assert.equal(p.levelFor('mercury'), start('mercury', 3), 'a place she never played follows her age');
});

test('a rough run at a start that is too high makes the next run gentler, without taking the level away', async () => {
  seed(null);
  const p = await open();
  const at = p.levelFor('mercury');
  assert.equal(p.assistFor('mercury'), false);
  const { level, gained } = p.recordMission('mercury', { scored: 3, clean: 0 });
  assert.deepEqual([level, gained], [at, 0]);
  assert.equal(p.assistFor('mercury'), true);
});

test('the play-check seed: a save already on the current version is played at the level it was given', async () => {
  seed({ v: VERSION, missions: { mercury: { level: 1, good: 0, lastAcc: 1 } }, skills: {}, sessions: { count: 0, recent: [] } });
  assert.equal((await open()).levelFor('mercury'), 1);
  seed({ v: 4, missions: { mercury: { level: 1, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } });
  assert.equal((await open()).levelFor('mercury'), start('mercury', 3.5), 'an older seed is an old save: its level moves up to the start');
});
