import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { starRounds, PICTURES } from '../../src/levels/stars.js';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

test('Star Pictures level rows parse to the specified literal settings', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.stars, [
    { stars: [3, 4], labels: 'both', rounds: 2 },
    { stars: [4, 5], labels: 'both', rounds: 2 },
    { stars: [5, 6], labels: 'numeral', rounds: 2 },
    { stars: [6, 7], labels: 'numeral', rounds: 2 },
  ]);
});

test('each mission joins different pictures and level 4 always ends on the Wielki Wóz', () => {
  assert.deepEqual(starRounds({ stars: [3, 4], rounds: 2 }, () => 0), [4, 3]);
  assert.deepEqual(starRounds({ stars: [3, 4], rounds: 2 }, () => 0.999), [3, 4]);
  assert.deepEqual(starRounds({ stars: [4, 5], rounds: 2 }, () => 0), [5, 4]);
  assert.deepEqual(starRounds({ stars: [6, 7], rounds: 2 }, () => 0), [6, 7]);
  assert.deepEqual(starRounds({ stars: [6, 7], rounds: 2 }, () => 0.999), [6, 7]);
  assert.deepEqual(starRounds({ stars: [6, 6], rounds: 1 }, () => 0), [6]);
  for (const l of levels.stars) {
    const plan = starRounds(l, () => 0);
    assert.equal(plan.length, l.rounds);
    assert.equal(new Set(plan).size, plan.length);
  }
});

test('the five outlines have one star per corner', () => {
  assert.deepEqual(Object.entries(PICTURES).map(([n, p]) => [Number(n), p.points.length]), [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7]]);
  assert.equal(PICTURES[3].id, 'mountain');
  assert.equal(PICTURES[4].id, 'kite');
  assert.equal(PICTURES[5].id, 'house');
  assert.equal(PICTURES[6].id, 'rocket');
  assert.equal(PICTURES[7].id, 'dipper');
  assert.equal(PICTURES[7].closed, false);
  assert.ok([3, 4, 5, 6].every((n) => PICTURES[n].closed));
});

const table = (row) => `### Test · \`stars\`\n\n| Level | stars | labels | rounds |\n|---|---|---|---|\n| 1 | ${row} |\n`;
const rowErrors = (row) => parseGame(table(row)).errors.filter((e) => e.includes('(Test'));

test('Star Pictures schema checks the star range, labels and round count', () => {
  assert.deepEqual(rowErrors('3–4 | both | 2'), []);
  assert.deepEqual(rowErrors('3–7 | numeral | 4'), []);
  for (const row of ['2–4 | both | 2', '3–8 | both | 2', '1.5–4 | both | 2', '4–3 | both | 2',
    '3–4 | dots | 2', '3–4 | both | 5', '3–4 | both | 0']) assert.ok(rowErrors(row).length > 0, row);
});

test('a gentler Star Pictures run shows both labels and one smaller picture', () => {
  assert.deepEqual(EASIER.stars(levels.stars[3]), { stars: [6, 6], labels: 'both', rounds: 1 });
  assert.deepEqual(levels.stars[3], { stars: [6, 7], labels: 'numeral', rounds: 2 });
});

test('Star Pictures lines are full Polish sentences and every one reaches recording', () => {
  assert.deepEqual(T.starsStart(), ['Jesteśmy wśród gwiazd! Połączymy gwiazdki i zobaczymy obrazek.']);
  assert.deepEqual(T.starsAsk([1]), ['Jeden, a co dalej?']);
  assert.deepEqual(T.starsAsk([1, 2]), ['Jeden, dwa, a co dalej?']);
  assert.deepEqual(T.starsAsk([1, 2, 3]), ['Jeden, dwa, trzy, a co dalej?']);
  assert.deepEqual(T.starsHelp(3), ['Teraz numer trzy!']);
  assert.deepEqual(T.starsWrong(5, 3), ['To jest pięć. Szukamy numeru trzy.']);
  assert.deepEqual(T.starsPicture('mountain'), ['To góra!']);
  assert.deepEqual(T.starsPicture('kite'), ['To latawiec!']);
  assert.deepEqual(T.starsPicture('house'), ['To domek!']);
  assert.deepEqual(T.starsPicture('rocket'), ['To rakieta!']);
  assert.deepEqual(T.starsPicture('dipper'), ['To Wielki Wóz! Wielki Wóz to siedem gwiazd.']);
  assert.deepEqual(T.starsDone(), ['Brawo! Gwiazdy świecą obrazki!']);
  assert.equal(HOME_TASKS.stars, 'Poszukajcie wieczorem gwiazd na niebie!');

  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [
    'Jesteśmy wśród gwiazd! Połączymy gwiazdki i zobaczymy obrazek.',
    'Jeden, a co dalej?', 'Jeden, dwa, a co dalej?', 'Jeden, dwa, trzy, a co dalej?',
    'Teraz numer trzy!', 'To jest pięć. Szukamy numeru trzy.',
    'To góra!', 'To latawiec!', 'To domek!', 'To rakieta!',
    'To Wielki Wóz! Wielki Wóz to siedem gwiazd.', 'Brawo! Gwiazdy świecą obrazki!',
    'Poszukajcie wieczorem gwiazd na niebie!',
  ]) assert.ok(recorded.includes(line), line);
});
