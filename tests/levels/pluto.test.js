import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plutoAsks, plutoRound, SHAPES, TWIN } from '../../src/levels/pluto.js';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';
import { shapeSVG } from '../../src/world/garage-props.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });
const RANDOMS = [() => 0, () => 0.3, () => 0.49, () => 0.999];

test('Pluto level rows parse to the specified literal settings', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.pluto, [
    { shapes: ['heart', 'star', 'oval'], ask: 'match', choices: 2, similar: false, turned: false, rounds: 3 },
    { shapes: ['heart', 'star', 'oval', 'rectangle'], ask: 'name', choices: 3, similar: false, turned: false, rounds: 3 },
    { shapes: ['heart', 'star', 'oval', 'rectangle', 'diamond'], ask: 'name', choices: 3, similar: true, turned: false, rounds: 4 },
    { shapes: ['heart', 'star', 'oval', 'rectangle', 'diamond'], ask: 'name', choices: 4, similar: true, turned: true, rounds: 4 },
  ]);
});

test('the asked shape changes every round and comes from the level\'s shapes, the heart among them', () => {
  for (const level of levels.pluto) for (const random of RANDOMS) {
    const asks = plutoAsks(level, random);
    assert.equal(asks.length, level.rounds);
    assert.ok(asks.every((a) => level.shapes.includes(a)));
    assert.ok(asks.every((a, i) => i === 0 || a !== asks[i - 1]), asks.join(' '));
    assert.equal(new Set(asks).size, Math.min(level.rounds, level.shapes.length), 'no shape twice while the list lasts');
  }
  assert.ok(levels.pluto.every((l) => l.shapes.includes('heart')));
  assert.deepEqual(plutoAsks({ shapes: ['heart', 'star'], rounds: 5 }, () => 0).length, 5);
  const long = plutoAsks({ shapes: ['heart', 'star'], rounds: 6 }, () => 0.999);
  assert.ok(long.every((a, i) => i === 0 || a !== long[i - 1]), long.join(' '));
});

test('every round has the asked shape once, among different shapes, its twin only where the level asks for lookalikes', () => {
  for (const level of levels.pluto) for (const answer of level.shapes) for (const random of RANDOMS) {
    const { pieces } = plutoRound(level, answer, random);
    const shapes = pieces.map((p) => p.shape);
    assert.equal(shapes.length, level.choices);
    assert.equal(new Set(shapes).size, level.choices);
    assert.equal(shapes.filter((x) => x === answer).length, 1);
    assert.ok(shapes.every((x) => SHAPES.includes(x)));
    if (TWIN[answer]) assert.equal(shapes.includes(TWIN[answer]), level.similar, `${answer} at ${JSON.stringify(level)}`);
    if (!level.turned) assert.ok(pieces.every((p) => p.turn === 0 && p.size === 1));
  }
});

test('turned pieces are bigger or smaller and turn a little; the square never turns into a diamond', () => {
  for (const answer of SHAPES) for (const random of RANDOMS) {
    const { pieces } = plutoRound({ choices: 4, similar: true, turned: true }, answer, random);
    assert.ok(pieces.every((p) => [0.9, 1, 1.2].includes(p.size)));
    for (const p of pieces) if (p.shape === 'square') assert.ok(Math.abs(p.turn) < Math.PI / 8, `square turn ${p.turn}`);
  }
});

test('every shape has an outline for its piece and for the bubble', () => {
  for (const shape of SHAPES) assert.match(shapeSVG(shape, '#f9a8d4'), shape === 'circle' ? /<circle/ : /<polygon points="[-\d.]/, shape);
});

const table = (row) => `### Test · \`pluto\`\n\n| Level | shapes | ask | choices | similar | turned | rounds |\n|---|---|---|---|---|---|---|\n| 1 | ${row} |\n`;
const rowErrors = (row) => parseGame(table(row)).errors.filter((e) => e.includes('(Test'));

test('Pluto schema checks the shapes, the ask, the piece count, the flags and the round count', () => {
  assert.deepEqual(rowErrors('heart, star | match | 2 | no | no | 3'), []);
  assert.deepEqual(rowErrors('heart, diamond, circle | name | 4 | yes | yes | 6'), []);
  assert.deepEqual(rowErrors('heart, heart | name | 2 | no | no | 3'), ['GAME.md line 5 (Test, level 1): shapes must be distinct']);
  for (const row of ['heart, moon | name | 2 | no | no | 3', 'heart | look | 2 | no | no | 3', 'heart | name | 1 | no | no | 3',
    'heart | name | 5 | no | no | 3', 'heart | name | 2 | maybe | no | 3', 'heart | name | 2 | no | no | 0', 'heart | name | 2 | no | no | 7',
    '- | name | 2 | no | no | 3']) assert.ok(rowErrors(row).length > 0, row);
});

test('a gentler Pluto run draws the shape, has one choice fewer, no lookalikes, textbook pieces and leaves the newest shape out', () => {
  assert.deepEqual(EASIER.pluto(levels.pluto[3]), {
    shapes: ['heart', 'star', 'oval', 'rectangle'], ask: 'match', choices: 3, similar: false, turned: false, rounds: 4,
  });
  assert.deepEqual(EASIER.pluto(levels.pluto[0]), { shapes: ['heart', 'star'], ask: 'match', choices: 2, similar: false, turned: false, rounds: 3 });
});

test('Pluto lines are full Polish sentences and every one reaches recording', () => {
  assert.equal(HOME_TASKS.pluto, 'Narysuj z mamą serduszko!');
  assert.deepEqual(T.plutoStart(), ['Jesteśmy na Plutonie! Pluton to planeta karłowata. Pluton ma jasne serduszko.']);
  assert.deepEqual(['heart', 'star', 'oval', 'rectangle', 'diamond', 'circle'].map((s) => T.plutoAsk(s)[0]),
    ['Gdzie jest serduszko?', 'Gdzie jest gwiazda?', 'Gdzie jest owal?', 'Gdzie jest prostokąt?', 'Gdzie jest romb?', 'Gdzie jest koło?']);
  assert.deepEqual(['heart', 'star', 'oval', 'rectangle', 'diamond'].map((s) => T.plutoRight(s)[0]),
    ['To jest serduszko!', 'To jest gwiazda!', 'To jest owal!', 'To jest prostokąt!', 'To jest romb!']);
  assert.deepEqual(T.plutoDone(), ['Brawo! Serduszko Plutona świeci!']);
  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [
    'Jesteśmy na Plutonie! Pluton to planeta karłowata. Pluton ma jasne serduszko.',
    'Gdzie jest serduszko?', 'Gdzie jest gwiazda?', 'Gdzie jest owal?', 'Gdzie jest prostokąt?', 'Gdzie jest romb?',
    'To jest serduszko!', 'To jest gwiazda!', 'To jest owal!', 'To jest prostokąt!', 'To jest romb!',
    'Brawo! Serduszko Plutona świeci!', 'Narysuj z mamą serduszko!',
  ]) assert.ok(recorded.includes(line), line);
});
