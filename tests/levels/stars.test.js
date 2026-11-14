import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { starRounds, numerals, PICTURES, ORDERS } from '../../src/levels/stars.js';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

test('Star Pictures level rows parse to the specified literal settings', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.stars, [
    { stars: [3, 4], order: 'up', labels: 'both', rounds: 2 },
    { stars: [4, 5], order: 'up', labels: 'both', rounds: 2 },
    { stars: [5, 6], order: 'up', labels: 'numeral', rounds: 2 },
    { stars: [6, 7], order: 'up', labels: 'numeral', rounds: 2 },
    { stars: [4, 5], order: 'down', labels: 'numeral', rounds: 2 },
    { stars: [3, 4], order: 'twos', labels: 'numeral', rounds: 2 },
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

const table = (row, head = 'stars | labels | rounds') => `### Test · \`stars\`\n\n| Level | ${head} |\n|${'---|'.repeat(head.split('|').length + 1)}\n| 1 | ${row} |\n`;
const rowErrors = (row, head) => parseGame(table(row, head)).errors.filter((e) => e.includes('(Test'));

test('Star Pictures schema checks the star range, labels and round count', () => {
  assert.deepEqual(rowErrors('3–4 | both | 2'), []);
  assert.deepEqual(rowErrors('3–7 | numeral | 4'), []);
  for (const row of ['2–4 | both | 2', '3–8 | both | 2', '1.5–4 | both | 2', '4–3 | both | 2',
    '3–4 | dots | 2', '3–4 | both | 5', '3–4 | both | 0']) assert.ok(rowErrors(row).length > 0, row);
});

test('the order column takes up, down or twos, and twos stop at four stars', () => {
  const head = 'stars | order | labels | rounds';
  for (const order of ORDERS) assert.deepEqual(rowErrors(`3–4 | ${order} | numeral | 2`, head), [], order);
  assert.ok(rowErrors('3–4 | backwards | numeral | 2', head).length > 0);
  assert.deepEqual(rowErrors('3–5 | down | numeral | 2', head), []);
  assert.ok(rowErrors('3–5 | twos | numeral | 2', head).length > 0, 'twos reach 10 with five stars');
  assert.deepEqual(rowErrors('3–4 | both | 2'), [], 'an older table without the column counts up');
});

test('the numerals run up from 1, down to 1, or by twos along the picture', () => {
  assert.deepEqual(numerals('up', 4), [1, 2, 3, 4]);
  assert.deepEqual(numerals('down', 5), [5, 4, 3, 2, 1]);
  assert.deepEqual(numerals('twos', 4), [2, 4, 6, 8]);
  assert.deepEqual(starRounds({ stars: [4, 5], rounds: 2, order: 'down' }, () => 0), [5, 4]);
  assert.deepEqual(starRounds({ stars: [6, 7], rounds: 2, order: 'down' }, () => 0), [7, 6], 'only counting up ends on the Wielki Wóz');
});

test('a gentler Star Pictures run counts up with both labels and one smaller picture', () => {
  assert.deepEqual(EASIER.stars(levels.stars[3]), { stars: [6, 6], order: 'up', labels: 'both', rounds: 1 });
  assert.deepEqual(EASIER.stars(levels.stars[4]), { stars: [4, 4], order: 'up', labels: 'both', rounds: 1 }, 'a countdown goes back to counting up');
  assert.deepEqual(EASIER.stars(levels.stars[5]), { stars: [3, 3], order: 'up', labels: 'both', rounds: 1 }, 'so does counting by twos');
  assert.deepEqual(levels.stars[3], { stars: [6, 7], order: 'up', labels: 'numeral', rounds: 2 });
});

test('Star Pictures lines are full Polish sentences and every one reaches recording', () => {
  assert.deepEqual(T.starsStart(), ['Jesteśmy wśród gwiazd! Połączymy gwiazdki i zobaczymy obrazek.']);
  assert.deepEqual(T.starsAsk([1]), ['Jeden, a co dalej?']);
  assert.deepEqual(T.starsAsk([1, 2]), ['Jeden, dwa, a co dalej?']);
  assert.deepEqual(T.starsAsk([1, 2, 3]), ['Jeden, dwa, trzy, a co dalej?']);
  assert.deepEqual(T.starsHelp(3), ['Teraz numer trzy!']);
  assert.deepEqual(T.starsPicture('mountain'), ['To góra!']);
  assert.deepEqual(T.starsPicture('kite'), ['To latawiec!']);
  assert.deepEqual(T.starsPicture('house'), ['To domek!']);
  assert.deepEqual(T.starsPicture('rocket'), ['To rakieta!']);
  assert.deepEqual(T.starsPicture('dipper'), ['To Wielki Wóz! Wielki Wóz to siedem gwiazd.']);
  assert.deepEqual(T.starsDone(), ['Brawo! Ułożyłaś obrazki z gwiazd!']);
  assert.equal(HOME_TASKS.stars, 'Poszukajcie wieczorem gwiazd na niebie!');
  assert.deepEqual(T.starsAsk([5, 4], 'down'), ['Pięć!', 'Cztery!', 'A dalej?']);
  assert.deepEqual(T.starsAsk([2, 4, 6, 8], 'twos'), ['Cztery!', 'Sześć!', 'Osiem!', 'A dalej?'], 'the last three numbers');
  assert.deepEqual(T.starsRule('down'), ['Liczymy od tyłu!']);
  assert.deepEqual(T.starsRule('twos'), ['Liczymy co dwa!']);

  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [
    'Jesteśmy wśród gwiazd! Połączymy gwiazdki i zobaczymy obrazek.',
    'Jeden, a co dalej?', 'Jeden, dwa, a co dalej?', 'Jeden, dwa, trzy, a co dalej?',
    'Teraz numer trzy!',
    'To góra!', 'To latawiec!', 'To domek!', 'To rakieta!',
    'To Wielki Wóz! Wielki Wóz to siedem gwiazd.', 'Brawo! Ułożyłaś obrazki z gwiazd!',
    'Poszukajcie wieczorem gwiazd na niebie!',
    'Liczymy od tyłu!', 'Liczymy co dwa!', 'Pięć!', 'Cztery!', 'Osiem!', 'A dalej?', 'Teraz numer osiem!',
  ]) assert.ok(recorded.includes(line), line);
});

test('every question a level can ask reaches recording, as a line or as clips of numbers', () => {
  const recorded = new Set(allSegments(levels, letterSets.ALL));
  for (const { stars: [lo, hi], order } of levels.stars) {
    for (const count of [3, 4, 5, 6, 7].filter((n) => n >= lo && n <= hi)) {
      const seq = numerals(order, count);
      for (let i = 1; i < count; i++) {
        for (const line of [...T.starsAsk(seq.slice(0, i), order), ...T.starsHelp(seq[i])]) assert.ok(recorded.has(line), `${order} ${count}: ${line}`);
        if (i === 1 && order !== 'up') for (const line of T.starsRule(order)) assert.ok(recorded.has(line), line);
      }
    }
  }
});
