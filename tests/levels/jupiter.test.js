import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGame } from '../../src/levels/parse.js';
import { jupiterRounds, stripeRound, biggerRound, patternUnit, STRIPE_ROWS, EXTRA_POT, JUPITER_COLOURS } from '../../src/levels/jupiter.js';
import { EASIER } from '../../src/levels/easier.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

/** A seeded generator (mulberry32), so a failure can be replayed. */
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const runs = (n, fn) => Array.from({ length: n }, (_, i) => fn(seeded(i + 1)));

test('Jupiter table has the four specified levels', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.jupiter, [
    { types: ['stripes', 'bigger'], pattern: 'AB', bigger: 'big', rounds: 3 },
    { types: ['stripes', 'bigger'], pattern: 'ABB', bigger: 'big', rounds: 3 },
    { types: ['stripes', 'bigger'], pattern: 'gap', bigger: 'both', rounds: 3 },
    { types: ['stripes', 'bigger'], pattern: 'ABC', bigger: 'both', rounds: 4 },
  ]);
});

test('round order brings each kind once and fills extra rounds with stripes', () => {
  for (const random of [() => 0, () => 0.5, () => 0.999]) {
    assert.deepEqual(jupiterRounds({ types: ['stripes', 'bigger'], rounds: 3 }, random), ['stripes', 'bigger', 'stripes']);
  }
  const four = jupiterRounds({ types: ['stripes', 'bigger'], rounds: 4 }, () => 0);
  assert.equal(four.length, 4);
  assert.equal(four.filter((t) => t === 'bigger').length, 1);
  assert.equal(four.filter((t) => t === 'stripes').length, 3);
  assert.deepEqual(jupiterRounds({ types: ['stripes'], rounds: 3 }, () => 0.5), ['stripes', 'stripes', 'stripes']);
});

test('AB and ABB rows repeat their unit, with the blank at the end', () => {
  for (const p of runs(100, (rng) => stripeRound('AB', rng))) {
    assert.equal(p.row.length, 6);
    assert.equal(p.gap, 5);
    p.row.forEach((c, i) => assert.equal(c, p.row[i % 2]));
    assert.notEqual(p.row[0], p.row[1]);
    assert.equal(p.answer, p.row[5]);
    assert.equal(p.item, 'AB');
  }
  const rounds = runs(220, (rng) => stripeRound('ABB', rng));
  for (const p of rounds) {
    assert.ok(p.row.length === 7 || p.row.length === 8);
    assert.equal(p.gap, p.row.length - 1);
    p.row.forEach((c, i) => assert.equal(c, p.row[i % 3]));
    assert.ok(p.item === 'ABB' || p.item === 'AAB');
    assert.equal(p.row[1] === p.row[2], p.item === 'ABB');
  }
  assert.deepEqual(new Set(rounds.map((p) => p.item)), new Set(['ABB', 'AAB']));
});

test('the stripes said after her answer are the row\'s repeating unit, once', () => {
  assert.deepEqual(patternUnit(STRIPE_ROWS.AB[0]), ['white', 'orange']);
  assert.deepEqual(STRIPE_ROWS.ABB.map(patternUnit), [['white', 'orange', 'orange'], ['white', 'orange', 'orange'], ['white', 'white', 'orange'], ['white', 'white', 'orange']]);
  assert.deepEqual(STRIPE_ROWS.ABC.map(patternUnit), [['white', 'orange', 'brown'], ['white', 'orange', 'brown']]);
  assert.deepEqual(T.jupiterRow(patternUnit(STRIPE_ROWS.ABB[0])), ['Biały, pomarańczowy, pomarańczowy!']);
});

test('gap rows miss a stripe in the middle of an AB or ABB row', () => {
  const rounds = runs(200, (rng) => stripeRound('gap', rng));
  for (const p of rounds) {
    assert.ok(p.row.length === 6 || p.row.length === 8);
    assert.ok(p.gap > 0 && p.gap < p.row.length - 1);
    assert.equal(p.answer, p.row[p.gap]);
    assert.equal(p.item, 'gap');
    if (p.row.length === 6) {
      assert.equal(p.row[p.gap - 2], p.answer);
      assert.equal(p.row[p.gap + 2], p.answer);
      assert.notEqual(p.row[p.gap - 1], p.answer);
    } else {
      assert.equal(p.row[p.gap - 3], p.answer);
      assert.equal(p.row[p.gap + 3], p.answer);
    }
  }
  assert.deepEqual(new Set(rounds.map((p) => p.row.length)), new Set([6, 8]));
});

test('ABC rows use white, orange and brown, and red is only ever the extra pot', () => {
  for (const kind of ['AB', 'ABB', 'gap', 'ABC']) {
    for (const p of runs(100, (rng) => stripeRound(kind, rng))) {
      assert.ok(p.choices.includes(p.answer));
      assert.equal(p.choices.filter((c) => c === EXTRA_POT).length, 1);
      assert.ok(!p.row.includes(EXTRA_POT));
      assert.equal(p.choices.length, new Set(p.row).size + 1);
      assert.ok(p.choices.every((c) => JUPITER_COLOURS[c]));
    }
  }
  for (const p of runs(30, (rng) => stripeRound('ABC', rng))) {
    assert.deepEqual(new Set(p.row), new Set(['white', 'orange', 'brown']));
    assert.equal(p.choices.length, 4);
  }
});

test('bigger: the huge ball is Jupiter or the Sun, Earth is on the other side', () => {
  for (const p of runs(100, (rng) => biggerRound('big', rng))) {
    assert.equal(p.ask, 'bigger');
    assert.equal(p.item, 'bigger');
    assert.ok(p.big === 'jupiter' || p.big === 'sun');
    assert.deepEqual([p.left, p.right].sort(), ['earth', p.big].sort());
    assert.equal(p.answer, p.big);
  }
  const both = runs(200, (rng) => biggerRound('both', rng));
  assert.deepEqual(new Set(both.map((p) => p.ask)), new Set(['bigger', 'smaller']));
  for (const p of both) {
    assert.equal(p.answer, p.ask === 'bigger' ? p.big : 'earth');
    assert.ok([p.left, p.right].includes(p.answer));
    assert.ok([p.left, p.right].includes('earth'));
  }
  assert.deepEqual(new Set(both.map((p) => p.left)), new Set(['earth', 'jupiter', 'sun']));
});

test('a gentler Jupiter run uses the AB row and always asks for the bigger', () => {
  assert.deepEqual(EASIER.jupiter(levels.jupiter[3]), {
    types: ['stripes', 'bigger'], pattern: 'AB', bigger: 'big', rounds: 4,
  });
  assert.equal(levels.jupiter[3].pattern, 'ABC');
  assert.equal(levels.jupiter[3].bigger, 'both');
});

const rowErrors = (row) => parseGame(`### Test · \`jupiter\`\n\n| Level | types | pattern | bigger | rounds |\n|---|---|---|---|---|\n| 1 | ${row} |\n`).errors.filter((e) => e.includes('(Test'));

test('Jupiter schema checks both kinds, the pattern, the comparison and the rounds', () => {
  assert.deepEqual(rowErrors('stripes, bigger | AB | big | 3'), []);
  assert.match(rowErrors('stripes | AB | big | 3')[0], /both stripes and bigger/);
  assert.match(rowErrors('stripes, bigger | sideways | big | 3')[0], /AB, ABB, gap, ABC/);
  assert.match(rowErrors('stripes, bigger | AB | huge | 3')[0], /big, both/);
  assert.match(rowErrors('stripes, bigger | AB | big | 1')[0], /rounds must be at least 2/);
  assert.match(rowErrors('stripes, bigger | AB | big | 9')[0], /1–8/);
});

test('every Jupiter line is a full sentence and reaches the voice list', () => {
  assert.deepEqual(T.jupiterStart(), ['Jesteśmy przy Jowiszu! To największa planeta. Pomalujemy jej paski!']);
  assert.deepEqual(T.jupiterWhich(), ['Który kolor teraz?']);
  assert.deepEqual(T.jupiterGap(), ['Którego paska brakuje?']);
  assert.deepEqual(T.jupiterHelp(STRIPE_ROWS.AB[0], 3), ['Biały, pomarańczowy, biały, i...?']);
  assert.deepEqual(T.jupiterRow(patternUnit(STRIPE_ROWS.AB[0])), ['Biały, pomarańczowy!']);
  assert.deepEqual(T.jupiterTryAgain(), ['Ojej! Spróbuj jeszcze raz.']);
  assert.deepEqual(T.jupiterBigger(), ['Która jest większa?']);
  assert.deepEqual(T.jupiterSmaller(), ['Która jest mniejsza?']);
  assert.deepEqual(T.jupiterBig('jupiter'), ['Jowisz jest dużo większy od Ziemi!']);
  assert.deepEqual(T.jupiterBig('sun'), ['Słońce jest dużo większe od Ziemi!']);
  assert.deepEqual(T.jupiterSmall(), ['Ziemia jest dużo mniejsza!']);
  assert.deepEqual(T.jupiterLook('bigger'), ['Popatrz jeszcze raz. Ta jest większa.']);
  assert.deepEqual(T.jupiterLook('smaller'), ['Popatrz jeszcze raz. Ta jest mniejsza.']);
  assert.deepEqual(T.jupiterSpot(), ['Czerwona plama to wielka burza.']);
  assert.deepEqual(T.jupiterDone(), ['Brawo! Jowisz ma piękne paski!']);
  assert.equal(HOME_TASKS.jupiter, 'Znajdź w domu coś w paski!');

  const recorded = allSegments(levels, letterSets.ALL);
  const lines = [
    ...T.jupiterStart(), ...T.jupiterWhich(), ...T.jupiterGap(), ...T.jupiterTryAgain(), ...T.jupiterBigger(),
    ...T.jupiterSmaller(), ...T.jupiterBig('jupiter'), ...T.jupiterBig('sun'), ...T.jupiterSmall(),
    ...T.jupiterLook('bigger'), ...T.jupiterLook('smaller'), ...T.jupiterSpot(), ...T.jupiterDone(),
    HOME_TASKS.jupiter,
  ];
  Object.values(STRIPE_ROWS).flat().forEach((row) => {
    lines.push(...T.jupiterRow(patternUnit(row)));
    const gaps = row.length === 6 ? [2, 3, 5] : row.length === 7 ? [6] : [3, 4, 7];
    gaps.forEach((gap) => lines.push(...T.jupiterHelp(row, gap)));
  });
  for (const line of lines) {
    assert.ok(recorded.includes(line), line);
    assert.match(line, /[.!?]$/);
  }
});
