import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { itemsFor, questionFor, SPACE_PLACES, PLANETS } from '../../src/levels/telescope.js';
import { allSegments, T } from '../../src/lang/pl.js';
import { makeEvent } from '../../src/learning/events.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const parsed = parseGame(md, { childName: 'ZOSIA' });
const levels = parsed.levels.telescope;
let seed = 17;
const rng = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
const featureAnswers = {
  saturn: ['saturn', 'uranus'], mars: ['mars', 'jupiter', 'sun'], earth: ['earth'],
  jupiter: ['jupiter'], comet: ['comet'], pluto: ['pluto'], sun: ['sun', 'comet', 'blackhole'],
};

test('all telescope levels parse with literal pools and settings', () => {
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(levels, [
    { pool: ['sun', 'earth', 'moon', 'saturn'], choices: 2, ask: 'match', rounds: 4 },
    { pool: ['sun', 'earth', 'moon', 'saturn', 'mars', 'jupiter'], choices: 2, ask: 'name', rounds: 4 },
    { pool: ['sun', 'earth', 'moon', 'saturn', 'mars', 'jupiter', 'comet', 'blackhole'], choices: 3, ask: 'name', rounds: 5 },
    { pool: ['sun', 'earth', 'saturn', 'mars', 'jupiter', 'comet', 'pluto'], choices: 3, ask: 'feature', rounds: 5 },
    { pool: ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'], choices: 3, ask: 'name', rounds: 5 },
    { pool: ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'], choices: 3, ask: 'order', rounds: 5 },
  ]);
});

test('every item in every level has exactly one right answer through repeated choices', () => {
  for (const level of levels.flatMap((l) => [l, EASIER.telescope(l)])) {
    const before = structuredClone(level);
    for (const item of itemsFor(level)) for (let i = 0; i < 200; i++) {
      const q = questionFor(level, item, rng);
      assert.equal(q.options.length, level.choices);
      assert.equal(new Set(q.options).size, level.choices);
      assert.ok(q.options.every((k) => level.pool.includes(k)));
      const correct = level.ask === 'feature' ? featureAnswers[q.target]
        : level.ask === 'order' ? [PLANETS[PLANETS.indexOf(q.after) + 1]] : [item];
      assert.deepEqual(q.options.filter((k) => correct.includes(k)), [q.target]);
      if (level.ask === 'feature' && q.target === 'jupiter') assert.ok(q.options.every((k) => ['jupiter', 'mercury', 'mars', 'moon', 'pluto'].includes(k)));
      assert.equal(q.skill, level.ask === 'order' ? 'sequence' : 'space');
      assert.equal(q.item, item);
    }
    assert.deepEqual(level, before);
  }
});

test('order asks only where the next planet is in the pool, including Pluto in a future pool', () => {
  assert.deepEqual(itemsFor(levels[5]), ['space:mercury', 'space:venus', 'space:earth', 'space:mars', 'space:jupiter', 'space:saturn', 'space:uranus']);
  const q = questionFor(levels[5], 'space:mars', rng);
  assert.equal(q.target, 'jupiter');
  assert.equal(q.after, 'mars');
  assert.equal(questionFor({ ...levels[5], pool: PLANETS }, 'space:neptune', rng).target, 'pluto');
});

test('all forbidden feature distractors are excluded even in a wider pool', () => {
  for (const target of Object.keys(featureAnswers)) for (let i = 0; i < 200; i++) {
    const q = questionFor({ pool: SPACE_PLACES, ask: 'feature', choices: 4 }, target, rng);
    assert.equal(q.options.length, 4);
    assert.deepEqual(q.options.filter((k) => featureAnswers[target].includes(k)), [target]);
    if (target === 'jupiter') assert.ok(q.options.every((k) => ['jupiter', 'mercury', 'mars', 'moon', 'pluto'].includes(k)));
  }
});

test('schema rejects unknown places, unsupported features, duplicate and ambiguous pools', () => {
  const row = '| 4 | sun, earth, saturn, mars, jupiter, comet, pluto | 3 | feature | 5 |';
  for (const [pool, ask, error] of [
    ['earth, letters, sun', 'name', 'not one of'],
    ['earth, telescope, sun', 'name', 'not one of'],
    ['earth, moon, sun', 'feature', 'feature pool'],
    ['saturn, uranus, sun', 'feature', 'unambiguous choices for saturn'],
    ['mars, jupiter, sun', 'feature', 'unambiguous choices for mars'],
    ['sun, comet, blackhole', 'feature', 'unambiguous choices for sun'],
    ['earth, earth, sun', 'name', 'distinct places'],
    ['sun, moon, earth', 'order', 'order needs'],
    ['mercury, mars, saturn', 'order', 'order needs'],
  ]) {
    assert.ok(parseGame(md.replace(row, `| 4 | ${pool} | 3 | ${ask} | 5 |`), { childName: 'ZOSIA' }).errors.some((s) => s.includes(error)), pool);
  }
});

test('easier keeps matching, reduces choices and falls back to names', () => {
  assert.deepEqual(levels.map((l) => { const s = EASIER.telescope(l); return [s.ask, s.choices]; }), [
    ['match', 2], ['name', 2], ['name', 2], ['name', 2], ['name', 2], ['name', 2],
  ]);
});

test('every telescope sentence reaches allSegments, with nominatives and locatives', () => {
  const segments = allSegments(parsed.levels, parsed.letterSets.ALL);
  const names = ['Słońce', 'Merkury', 'Wenus', 'Ziemia', 'Księżyc', 'Mars', 'Jowisz', 'Saturn', 'Uran', 'Neptun', 'Pluton', 'czarna dziura', 'kometa'];
  const kinds = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'blackhole', 'comet'];
  kinds.forEach((kind, i) => {
    assert.deepEqual(T.telescopeName(kind), [`Gdzie jest ${names[i]}?`]);
    assert.deepEqual(T.telescopeRight(kind), [`Tak! To jest ${names[i]}.`]);
  });
  assert.deepEqual(PLANETS.slice(0, 7).map((k) => T.telescopeOrder(k)[0]), [
    'Co jest po Merkurym?', 'Co jest po Wenus?', 'Co jest po Ziemi?', 'Co jest po Marsie?',
    'Co jest po Jowiszu?', 'Co jest po Saturnie?', 'Co jest po Uranie?',
  ]);
  const lines = ['Patrzymy przez teleskop!', 'Znajdź taki sam!', 'Brawo! Znasz już kosmos!',
    ...kinds.flatMap((k) => [...T.telescopeName(k), ...T.telescopeRight(k)]),
    ...PLANETS.slice(0, 7).flatMap((k) => T.telescopeOrder(k)),
    'Która planeta ma wielkie pierścienie?', 'Która planeta jest czerwona?', 'Gdzie jest nasz dom?',
    'Która planeta jest największa?', 'Co ma długi ogon?', 'Co ma jasne serduszko?', 'Co świeci i grzeje?',
    'Poszukaj z mamą w książeczce planety z pierścieniami!'];
  for (const line of lines) assert.ok(segments.includes(line), line);
});

test('recognition is a valid learning event, separate from order', () => {
  const ev = makeEvent({ mission: 'telescope', skill: 'space', item: 'saturn', correct: true, firstTry: true, options: 3, at: 1 });
  assert.equal(ev.skill, 'space');
  assert.equal(ev.item, 'saturn');
  assert.equal(ev.options, 3);
});
