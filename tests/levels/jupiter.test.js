import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGame } from '../../src/levels/parse.js';
import { jupiterRounds, stripeRound, stripeRows, biggerRound, patternUnit, UNITS, PALETTE, JUPITER_COLOURS } from '../../src/levels/jupiter.js';
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

test('AB and ABB rows repeat their unit, with the blank at the end and the answer the stripe that comes next', () => {
  for (const p of runs(200, (rng) => stripeRound('AB', rng))) {
    assert.ok(p.row.length === 5 || p.row.length === 6);
    assert.equal(p.gap, p.row.length - 1);
    p.row.forEach((c, i) => assert.equal(c, p.row[i % 2]));
    assert.notEqual(p.row[0], p.row[1]);
    assert.equal(p.answer, p.row[p.gap]);
    assert.equal(p.item, 'AB');
  }
  const rounds = runs(300, (rng) => stripeRound('ABB', rng));
  for (const p of rounds) {
    assert.ok(p.row.length === 7 || p.row.length === 8);
    assert.equal(p.gap, p.row.length - 1);
    p.row.forEach((c, i) => assert.equal(c, p.row[i % 3]));
    assert.ok(p.item === 'ABB' || p.item === 'AAB');
    assert.equal(p.row[1] === p.row[2], p.item === 'ABB');
  }
  assert.deepEqual(new Set(rounds.map((p) => p.item)), new Set(['ABB', 'AAB']));
});

test('every row that ends in the blank has at least two full repeats before it', () => {
  for (const kind of ['AB', 'ABB', 'ABC']) {
    for (const { row, gap } of stripeRows(kind)) assert.ok(gap >= patternUnit(row).length * 2, `${kind}: ${row.join(' ')} blank at ${gap}`);
  }
});

test('the answer is not always orange: every colour is the right pot in some row of every kind of round', () => {
  for (const kind of ['AB', 'ABB', 'gap', 'ABC']) {
    const answers = new Set(stripeRows(kind).map(({ row, gap }) => row[gap]));
    assert.deepEqual([...answers].sort(), [...PALETTE].sort(), `${kind}: ${[...answers].join(', ')}`);
  }
  for (const kind of ['AB', 'ABB', 'gap', 'ABC']) {
    const seen = new Set(runs(400, (rng) => stripeRound(kind, rng).answer));
    assert.deepEqual([...seen].sort(), [...PALETTE].sort(), `${kind}: drawn ${[...seen].join(', ')}`);
  }
});

test('rows start with different colours and come in different lengths, so which pot is right cannot be read off the pots', () => {
  for (const kind of ['AB', 'ABB', 'ABC']) {
    const rows = stripeRows(kind);
    assert.ok(new Set(rows.map(({ row }) => row[0])).size >= (kind === 'ABC' ? 2 : 3), `${kind} starts`);
    assert.ok(new Set(rows.map(({ row }) => row.length)).size >= 2, `${kind} lengths`);
  }
  const first = stripeRows('AB').filter(({ row }) => row[0] === 'white' || row[0] === 'orange');
  assert.notEqual(new Set(first.map(({ row, gap }) => row[gap])).size, 1, 'a row of white and orange can end on either');
});

test('the stripes said after her answer are the row\'s repeating unit, once', () => {
  assert.deepEqual(patternUnit(['white', 'orange', 'white', 'orange', 'white']), ['white', 'orange']);
  assert.deepEqual(patternUnit(['red', 'brown', 'brown', 'red', 'brown', 'brown', 'red', 'brown']), ['red', 'brown', 'brown']);
  for (const kind of ['AB', 'ABB', 'ABC']) {
    for (const { row } of stripeRows(kind)) assert.ok(UNITS[kind === 'ABB' ? 'ABB' : kind].some((u) => u.join() === patternUnit(row).join()));
  }
  assert.deepEqual(T.jupiterRow(patternUnit(stripeRows('ABB')[0].row)), ['Biały, pomarańczowy, pomarańczowy!']);
  assert.deepEqual(T.jupiterRow(['red', 'white']), ['Czerwony, biały!']);
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

test('the pots are the row\'s colours and one colour that is not in the row, or only the row\'s colours when the foil is off', () => {
  for (const kind of ['AB', 'ABB', 'gap', 'ABC']) {
    for (const p of runs(150, (rng) => stripeRound(kind, rng))) {
      assert.ok(p.choices.includes(p.answer));
      assert.equal(p.choices.length, new Set(p.row).size + 1);
      assert.equal(p.choices.filter((c) => !p.row.includes(c)).length, 1);
      assert.ok(p.choices.every((c) => JUPITER_COLOURS[c]));
    }
    for (const p of runs(50, (rng) => stripeRound(kind, rng, { foil: false }))) {
      assert.deepEqual([...p.choices].sort(), [...new Set(p.row)].sort());
      assert.ok(p.choices.includes(p.answer));
    }
  }
  for (const p of runs(60, (rng) => stripeRound('ABC', rng))) assert.equal(p.choices.length, 4, 'three colours and the one left');
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

test('a gentler Jupiter run uses the AB row, always asks for the bigger and has no pot that is not in the row', () => {
  assert.deepEqual(EASIER.jupiter(levels.jupiter[3]), {
    types: ['stripes', 'bigger'], pattern: 'AB', bigger: 'big', foil: false, rounds: 4,
  });
  assert.notDeepEqual(EASIER.jupiter(levels.jupiter[0]), levels.jupiter[0], 'level 1\'s gentler run is easier than level 1');
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
  assert.deepEqual(T.jupiterHelp(stripeRows('gap')[0].row, 3), ['Biały, pomarańczowy, biały, i...?']);
  assert.deepEqual(T.jupiterRow(patternUnit(stripeRows('AB')[0].row)), ['Biały, pomarańczowy!']);
  assert.deepEqual(T.jupiterTryAgain(), ['Ojej! Spróbuj jeszcze raz.']);
  assert.deepEqual(T.jupiterBigger(), ['Która jest większa?']);
  assert.deepEqual(T.jupiterSmaller(), ['Która jest mniejsza?']);
  assert.deepEqual(T.jupiterBig('jupiter'), ['Jowisz jest dużo większy od Ziemi!']);
  assert.deepEqual(T.jupiterBig('sun'), ['Słońce jest dużo większe od Ziemi!']);
  assert.deepEqual(T.jupiterSmall(), ['Ziemia jest dużo mniejsza!']);
  assert.deepEqual(T.jupiterSpot(), ['Czerwona plama to wielka burza.']);
  assert.deepEqual(T.jupiterDone(), ['Brawo! Jowisz ma piękne paski!']);
  assert.equal(HOME_TASKS.jupiter, 'Znajdź w domu coś w paski!');

  const recorded = allSegments(levels, letterSets.ALL);
  const lines = [
    ...T.jupiterStart(), ...T.jupiterWhich(), ...T.jupiterGap(), ...T.jupiterTryAgain(), ...T.jupiterBigger(),
    ...T.jupiterSmaller(), ...T.jupiterBig('jupiter'), ...T.jupiterBig('sun'), ...T.jupiterSmall(),
    ...T.jupiterSpot(), ...T.jupiterDone(),
    HOME_TASKS.jupiter,
  ];
  ['AB', 'ABB', 'ABC', 'gap'].flatMap(stripeRows).forEach(({ row, gap }) => {
    lines.push(...T.jupiterRow(patternUnit(row)), ...T.jupiterHelp(row, gap));
  });
  for (const line of lines) {
    assert.ok(recorded.includes(line), line);
    assert.match(line, /[.!?]$/);
  }
});
