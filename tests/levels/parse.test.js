import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGame } from '../../src/levels/parse.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');

test('GAME.md parses without errors', () => {
  const { errors } = parseGame(md, { childName: 'Zosia' });
  assert.deepEqual(errors, []);
});

test('rounds: read from the table, short missions as in the brief', () => {
  const { levels } = parseGame(md, { childName: 'Zosia' });
  assert.ok(levels.letters.every((l) => l.rounds >= 3 && l.rounds <= 5));
  assert.ok(levels.stones.every((l) => l.rounds <= 2));
  assert.deepEqual(levels.lookout.map((l) => [l.mode, l.rounds]), [['pickup', 2], ['pickup', 3], ['find', 3], ['relative', 3], ['relative', 3], ['pickup', 3], ['dice', 3], ['dice', 3]]); // her favourite: a few more rides
});

test('Lookout kittens: each ride a different floor, so there must be more floors than rides', () => {
  assert.match(only(parseGame(table('max | bubble | mode | rounds', '3 | both | pickup | 3'), {})).errors[0], /more floors than rounds/);
  assert.deepEqual(only(parseGame(table('max | bubble | mode | rounds', '4 | numeral | find | 3'), {})).errors, []);
  assert.match(only(parseGame(table('max | bubble | mode | rounds', '5 | numeral | pickup | 4'), {})).errors[0], /rounds must be 1–3/);
});

test('Lookout dice: needs a dice range, and enough floors for every ride to go up', () => {
  assert.match(only(parseGame(table('max | bubble | mode | rounds', '9 | numeral | dice | 3'), {})).errors[0], /needs a dice range/);
  assert.match(only(parseGame(table('max | bubble | mode | rounds | dice', '5 | numeral | dice | 3 | 2–3'), {})).errors[0], /need 6\+ floors/);
  const { levels, errors } = only(parseGame(table('max | bubble | mode | rounds | dice', '9 | numeral | dice | 3 | 1–3'), {}));
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.lookout[0].dice, [1, 3]);
});

// a one-mission file: only look at that mission's errors (the rest of GAME.md is missing on purpose)
const only = ({ levels, errors }) => ({ levels, errors: errors.filter((e) => e.includes('(Test')) });
const table = (head, row) => `### Test · \`lookout\`\n\n| Level | ${head} |\n|${'---|'.repeat(head.split('|').length + 1)}\n| 1 | ${row} |\n`;

test('rounds: optional, with a per-mission default', () => {
  const { levels, errors } = only(parseGame(table('max | bubble | mode', '3 | both | go'), {}));
  assert.deepEqual(errors, []);
  assert.equal(levels.lookout[0].rounds, 1);
});

test('rounds: relative Lookout needs a normal first trip', () => {
  const { errors } = only(parseGame(table('max | bubble | mode | rounds', '5 | numeral | relative | 1'), {}));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /relative.*2 rounds/);
});

test('rounds: limits are checked', () => {
  const { errors } = only(parseGame(table('max | bubble | mode | rounds', '3 | both | go | 0'), {}));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /rounds/);
});

const lettersTable = (head, row) => `## Letter sets\n\n| Set | Letters |\n|---|---|\n| ALL | ABCDEFGHIJKLMNOPRSTUWZ |\n\n### Test · \`letters\`\n\n| Level | ${head} |\n|${'---|'.repeat(head.split('|').length + 1)}\n| 1 | ${row} |\n`;

test('Kitty Park: the sound level is gated on mastery, asks consonants, and is not the top', () => {
  const { levels, letterSets } = parseGame(md, { childName: 'Zosia' });
  const sound = levels.letters.findIndex((l) => l.ask === 'sound');
  assert.deepEqual(levels.letters[sound].needs, { skill: 'letterAudio', min: 0.4 });
  assert.equal([...levels.letters[sound].pool].filter((l) => 'AEIOUY'.includes(l)).length, 0);
  assert.equal(levels.letters.at(-1).pool, letterSets.ALL);
});

test('Kitty Park: older tables with "show" still work', () => {
  const { levels, errors } = only(parseGame(lettersTable('pool | choices | show | similar', 'ALL | 3 | picture | no'), {}));
  assert.deepEqual(errors, []);
  assert.equal(levels.letters[0].ask, 'word');
});

test('Kitty Park: "sound" only with letters you can hold', () => {
  const { errors } = only(parseGame(lettersTable('pool | choices | ask | similar', 'MSBT | 3 | sound | no'), {}));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /not BT/);
});

test('needs: a broken gate is explained', () => {
  const { errors } = only(parseGame(lettersTable('pool | choices | ask | similar | needs', 'ALL | 3 | name | no | reading 2'), {}));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /needs/);
});

test('Name Train: whose comes early, family names later, every word has syllables', () => {
  const { levels } = parseGame(md, { childName: 'Zosia' });
  assert.deepEqual(levels.name.map((l) => l.mode), ['ghost', 'ghost', 'whose', 'highlight', 'word', 'word', 'missing', 'missing', 'whose']);
  assert.equal(levels.name[6].gaps, 2);
  assert.deepEqual(levels.name[5].syllables.BERNADKA, ['BER', 'NAD', 'KA']);
  assert.deepEqual(levels.name[0].syllables, { ZOSIA: ['ZO', 'SIA'] });
  assert.deepEqual(levels.name[2].whose, { ZOSIA: 'Zosi', MAMA: 'mamy', TATA: 'taty' });
  assert.equal(levels.name[8].whose.RYSIEK, 'Ryśka');
  assert.equal(levels.name[8].whose.KOT, undefined, 'things are never asked whose they are');
});

const nameFile = (head, row, words = '| MAMA | MA-MA | mamy |\n| TATA | TA-TA | taty |\n| KOT | KOT | — |\n| DOM | DOM | — |\n| RYSIEK | RY-SIEK | Ryśka |') =>
  `## Letter sets\n\n| Set | Letters |\n|---|---|\n| ALL | ABCDEFGHIJKLMNOPRSTUWZ |\n\n### Test · \`name\`\n\n| Level | ${head} |\n|${'---|'.repeat(head.split('|').length + 1)}\n| 1 | ${row} |\n\n#### Name Train words\n\n| Word | syllables | whose |\n|---|---|---|\n${words}\n`;

test('Name Train: older ghost/bubble tables still work; gaps checked', () => {
  assert.equal(only(parseGame(nameFile('words | ghost | bubble | extras', 'MAMA | no | word | 1'), {})).levels.name[0].mode, 'highlight');
  const { errors } = only(parseGame(nameFile('words | mode | gaps | extras', 'KOT, DOM | missing | 3 | 1'), {}));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /more letters/);
});

test('Name Train: up to 8 letters, Y only in names, every word in the words table', () => {
  assert.deepEqual(only(parseGame(nameFile('words | mode | extras', 'RYSIEK | ghost | 1'), {})).errors, []);
  assert.match(only(parseGame(nameFile('words | mode | extras', 'BERNADKAS | ghost | 1'), {})).errors[0], /2–8 letters/);
  assert.match(only(parseGame(nameFile('words | mode | extras', 'QUIZ | ghost | 1'), {})).errors[0], /not in the ALL set \(or Y\): Q/);
  assert.match(only(parseGame(nameFile('words | mode | extras', 'MAMA, KASIA | ghost | 1'), {})).errors[0], /add KASIA to the "Name Train words" table/);
  const typo = parseGame(nameFile('words | mode | extras', 'MAMA | ghost | 1', '| MAMA | MA-NA | mamy |'), {});
  assert.match(typo.errors.find((e) => e.includes('Name Train words')), /"MA-NA" must spell MAMA/);
});

test('Name Train: whose needs three words it can ask about', () => {
  assert.match(only(parseGame(nameFile('words | mode', 'MAMA, TATA, KOT | whose'), {})).errors[0], /at least 3 words with a "whose" form \(got MAMA, TATA\)/);
  assert.deepEqual(only(parseGame(nameFile('words | mode', 'MAMA, TATA, RYSIEK, KOT | whose'), {})).errors, []);
});

test('Cone Road: "which cone has N dots?" and counting aloud need dots on the signs; dice only up to 6', () => {
  const cones = (row, head = 'max | choices | bubble | sign') => `## Letter sets\n\n| Set | Letters |\n|---|---|\n| ALL | AB |\n\n### Test · \`cones\`\n\n| Level | ${head} |\n|${'---|'.repeat(head.split('|').length + 1)}\n| 1 | ${row} |\n`;
  assert.match(only(parseGame(cones('5 | 3 | name | numeral | no', 'max | choices | bubble | sign | count'), {})).errors[0], /signs need dots/);
  assert.match(only(parseGame(cones('5 | 3 | dots | dots'), {})).errors[0], /signs need numerals/);
  assert.match(only(parseGame(cones('5 | 3 | numeral | numeral'), {})).errors[0], /count "yes" lights the sign's dots/);
  assert.deepEqual(only(parseGame(cones('5 | 3 | numeral | numeral | no', 'max | choices | bubble | sign | count'), {})).errors, []);
  assert.match(only(parseGame(cones('10 | 4 | dots | numeral | dice | no', 'max | choices | bubble | sign | dots | count'), {})).errors[0], /dice patterns go up to 6/);
  assert.equal(only(parseGame(cones('5 | 3 | both | both'), {})).levels.cones[0].count, true, 'defaults: count aloud, line dots');
});

test('River: the missing stone needs 3–9 stones', () => {
  const { levels } = parseGame(md, { childName: 'Zosia' });
  assert.ok(levels.stones.some((l) => l.bubble === 'missing'));
  const stones = (row) => `## Letter sets\n\n| Set | Letters |\n|---|---|\n| ALL | AB |\n\n### Test · \`stones\`\n\n| Level | n | bubble |\n|---|---|---|\n| 1 | ${row} |\n`;
  assert.match(only(parseGame(stones('2 | missing'), {})).errors[0], /3–9 stones/);
});

test('Treat House: new kinds of round come one level at a time; each level has a scored round; flash and hidden need ranges, auto no, rounds enough', () => {
  const { levels } = parseGame(md, { childName: 'Zosia' });
  const added = levels.counting.map((l, i) => l.types.filter((t) => !(levels.counting[i - 1]?.types || []).includes(t)));
  assert.deepEqual(added, [['give', 'howMany', 'share'], [], [], [], ['flash'], ['hidden'], [], []]);
  const treats = (row) => `## Letter sets\n\n| Set | Letters |\n|---|---|\n| ALL | AB |\n\n### Test · \`counting\`\n\n| Level | types | give | hidden | flash | auto | rounds |\n|---|---|---|---|---|---|---|\n| 1 | ${row} |\n`;
  assert.deepEqual(only(parseGame(treats('give, hidden, flash | 1–3 | 2–4 | 1–4 | no | 3'), {})).errors, []);
  assert.match(only(parseGame(treats('give, hidden | 1–3 | — | — | no | 3'), {})).errors[0], /set a hidden range/);
  assert.match(only(parseGame(treats('give, flash | 1–3 | — | 1–3 | yes | 3'), {})).errors[0], /flash need auto "no"/);
  assert.match(only(parseGame(treats('give, hidden, flash | 1–3 | 2–4 | 1–4 | no | 2'), {})).errors[0], /rounds must be at least 3/);
  assert.match(only(parseGame(treats('give, hidden | 1–3 | 1–4 | — | no | 3'), {})).errors[0], /hidden must stay within 2–4/);
  assert.match(only(parseGame(treats('give | 1–3 | — | — | no | 1'), {})).errors[0], /needs a howMany, flash or hidden round/);
});

// what a level can change, grouped the way a child feels it (targets and total together are "more balloons")
const STEPS = {
  balloons: { letters: (l) => l.pool, balloons: (l) => `${l.targets}/${l.total}`, speed: (l) => l.speed.join('–'), lookalikes: (l) => l.similar },
  delivery: { letters: (l) => l.pool, choices: (l) => l.choices, mode: (l) => l.mode, soundalikes: (l) => l.similar },
};
const changes = (kind, a, b) => Object.entries(STEPS[kind]).filter(([, f]) => f(a) !== f(b)).map(([k]) => k);

test('Balloon Hill and Pup Delivery: each level changes exactly one thing', () => {
  const { levels } = parseGame(md, { childName: 'Zosia' });
  for (const kind of Object.keys(STEPS)) {
    levels[kind].slice(1).forEach((row, i) => assert.equal(changes(kind, levels[kind][i], row).length, 1, `${kind} level ${i + 1} → ${i + 2} changes ${changes(kind, levels[kind][i], row).join(', ') || 'nothing'}`));
  }
  assert.deepEqual(changes('balloons', { pool: 'AB', targets: 2, total: 5, speed: [0.3, 0.45], similar: false }, { pool: 'ABC', targets: 3, total: 7, speed: [0.3, 0.45], similar: false }), ['letters', 'balloons']);
});
