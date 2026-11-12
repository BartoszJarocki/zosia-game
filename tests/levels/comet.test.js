import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cometLetters, cometPlan, skyEdge, COMET_LANES } from '../../src/levels/comet.js';
import * as THREE from 'three';
import { parseGame } from '../../src/levels/parse.js';
import { EASIER } from '../../src/levels/easier.js';
import { isLookalike } from '../../src/levels/lookalikes.js';
import { T, HOME_TASKS, allSegments } from '../../src/lang/pl.js';

const md = readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const { levels, letterSets, errors } = parseGame(md, { childName: 'Zosia' });

test('Comet level rows parse to the specified literal settings', () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(levels.comet, [
    { pool: letterSets.START, ask: 'match', targets: 2, total: 4, speed: [0.25, 0.4], similar: false, rounds: 3 },
    { pool: letterSets.START, ask: 'name', targets: 2, total: 5, speed: [0.25, 0.4], similar: false, rounds: 3 },
    { pool: letterSets.MORE, ask: 'name', targets: 3, total: 6, speed: [0.3, 0.5], similar: false, rounds: 2 },
    { pool: letterSets.ALL, ask: 'name', targets: 3, total: 6, speed: [0.3, 0.5], similar: true, rounds: 2 },
  ]);
});

test('only the first Comet level shows the letter; the others only say it', () => {
  assert.deepEqual(levels.comet.map((l) => l.ask), ['match', 'name', 'name', 'name']);
});

test('a comet round has the targets plus the wrong letters from the pool', () => {
  const letters = cometLetters(levels.comet[0], 'A', letterSets.START);
  assert.equal(letters.length, 4);
  assert.equal(letters.filter((l) => l === 'A').length, 2);
  assert.ok(letters.every((l) => letterSets.START.includes(l)));
});

test('lookalikes only join a round when the level asks for them', () => {
  const plain = cometLetters(levels.comet[2], 'A', letterSets.ALL);
  const tricky = cometLetters(levels.comet[3], 'A', letterSets.ALL);
  assert.ok(plain.filter((l) => l !== 'A').every((l) => !isLookalike('A', l)));
  assert.ok(tricky.filter((l) => l !== 'A').some((l) => isLookalike('A', l)));
});

const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ring = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };

test('cometPlan gives every comet one speed in the level range and its own place round the loop', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const row of levels.comet) {
      const plan = cometPlan(row, seeded(seed));
      assert.equal(plan.comets.length, row.total);
      assert.ok(plan.speed >= row.speed[0] && plan.speed <= row.speed[1]);
      assert.ok(plan.comets.every((c) => c.lane >= 0 && c.lane < COMET_LANES && c.phase >= 0 && c.phase < 1));
      const phases = plan.comets.map((c) => c.phase).sort((x, y) => x - y);
      phases.slice(1).forEach((p, i) => assert.ok(p - phases[i] > 0.5 / row.total, 'evenly spread, never on top of each other'));
    }
  }
});

test('comets in one lane are far apart round the loop and every lane is used while there are lanes to fill', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const total of [3, 4, 5, 6, 7, 8]) {
      const plan = cometPlan({ speed: [0.3, 0.3], total, targets: 2 }, seeded(seed));
      for (let i = 0; i < total; i++) for (let j = i + 1; j < total; j++) {
        if (plan.comets[i].lane === plan.comets[j].lane) assert.ok(ring(plan.comets[i].phase, plan.comets[j].phase) >= 0.33, `total ${total}, seed ${seed}: two comets share a lane too close`);
      }
      assert.equal(new Set(plan.comets.map((c) => c.lane)).size, Math.min(total, COMET_LANES));
    }
  }
});

test('the asked letter\'s comets are as far apart round the loop as they can be, so one is always in reach', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const row of levels.comet) {
      const plan = cometPlan(row, seeded(seed));
      const asked = plan.comets.slice(0, row.targets).map((c) => c.phase);
      for (let i = 0; i < asked.length; i++) for (let j = i + 1; j < asked.length; j++) {
        assert.ok(ring(asked[i], asked[j]) >= 0.28, `level with ${row.targets} of ${row.total}: asked comets ${ring(asked[i], asked[j]).toFixed(2)} of a loop apart`);
      }
    }
  }
});

test('skyEdge is half the screen at the comets\' height: at least half the width the view keeps, wider on a wider screen', () => {
  const view = { pos: new THREE.Vector3(0, 8, 14), look: new THREE.Vector3(0, 4.6, 0), minWidth: 15 };
  const landscape = skyEdge(view, 1180 / 820, 42, 4.75), wide = skyEdge(view, 16 / 9, 42, 4.75), portrait = skyEdge(view, 820 / 1180, 42, 4.75);
  assert.ok(landscape >= 7.5, `at least half of the 15 the view keeps: ${landscape}`);
  assert.ok(wide > landscape);
  assert.ok(portrait >= 7.4 && portrait < landscape, 'a narrow screen pulls the camera back until the view\'s width fits, and no further');
});

const table = (row) => `### Test · \`comet\`\n\n| Level | pool | ask | targets | total | speed | similar | rounds |\n|---|---|---|---|---|---|---|---|\n| 1 | ${row} |\n`;
const rowErrors = (row) => parseGame(table(row)).errors.filter((e) => e.includes('(Test'));

test('Comet schema checks ranges, letter pool, how it is asked and round count', () => {
  assert.deepEqual(rowErrors('START | match | 2 | 4 | 0.25-0.4 | no | 3'), []);
  assert.deepEqual(rowErrors('START | name | 2 | 4 | 0.25-0.4 | no | 3'), []);
  assert.deepEqual(rowErrors('START | match | 4 | 4 | 0.25-0.4 | no | 3'), ['GAME.md line 5 (Test, level 1): targets (4) must be fewer than total (4)']);
  assert.deepEqual(rowErrors('A | match | 2 | 4 | 0.25-0.4 | no | 3'), ['GAME.md line 5 (Test, level 1): pool needs at least 2 letters (got "A")']);
  for (const row of ['START | match | 0 | 4 | 0.25-0.4 | no | 3', 'START | match | 2 | 2 | 0.25-0.4 | no | 3',
    'START | match | 2 | 9 | 0.25-0.4 | no | 3', 'START | match | 2 | 10 | 0.25-0.4 | no | 3', 'START | match | 2 | 4 | 0.05-0.4 | no | 3',
    'START | match | 2 | 4 | 0.4-0.25 | no | 3', 'START | match | 2 | 4 | 0.25-0.4 | maybe | 3',
    'START | match | 2 | 4 | 0.25-0.4 | no | 0', 'START | match | 2 | 4 | 0.25-0.4 | no | 9',
    'START | sound | 2 | 4 | 0.25-0.4 | no | 3', 'START | 2 | 4 | 0.25-0.4 | no | 3']) {
    assert.ok(rowErrors(row).length > 0, row);
  }
});

test('a gentler comet run has two fewer comets, slower, without lookalikes, with the letter shown, and one wrong comet stays', () => {
  const easy = EASIER.comet(levels.comet[3]);
  assert.deepEqual({ ...easy, speed: easy.speed.map((v) => +v.toFixed(2)) }, {
    ...levels.comet[3], total: 4, speed: [0.21, 0.35], similar: false, ask: 'match',
  });
  assert.equal(levels.comet[3].total, 6);
  assert.equal(levels.comet[3].similar, true);
  for (const row of levels.comet) {
    const gentler = EASIER.comet(row);
    assert.ok(gentler.total > gentler.targets, `level with ${row.targets} of ${row.total}: a wrong comet stays`);
    assert.ok(gentler.total >= 3);
    assert.equal(gentler.ask, 'match');
  }
  assert.equal(EASIER.comet(levels.comet[0]).total, 3, 'level 1: two to catch and one wrong, not only the right ones');
});

test('Comet lines are whole Polish sentences and every new line reaches recording', () => {
  assert.deepEqual(T.cometStart(), ['Komety lecą! Kometa to kula lodu i pyłu.']);
  assert.deepEqual(T.cometAsk('A'), ['Złap komety z literą A!']);
  assert.deepEqual(T.cometRoundDone(), ['Mamy wszystkie!']);
  assert.deepEqual(T.cometDone(), ['Brawo! Złapałaś wszystkie komety!']);
  assert.deepEqual(T.cometFact(), ['Ogon komety rośnie blisko Słońca.']);
  assert.equal(HOME_TASKS.comet, 'Narysuj z mamą kometę z długim ogonem!');
  const recorded = allSegments(levels, letterSets.ALL);
  for (const line of [
    'Komety lecą! Kometa to kula lodu i pyłu.', 'Złap komety z literą A!', 'Mamy wszystkie!',
    'Brawo! Złapałaś wszystkie komety!', 'Ogon komety rośnie blisko Słońca.',
    'Narysuj z mamą kometę z długim ogonem!',
  ]) assert.ok(recorded.includes(line), line);
});
