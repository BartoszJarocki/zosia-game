import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judge, everyTapAnswers, questionIsHers, playsMoreThanWatches, answerNamed } from '../tools/playtest/playcheck-rules.mjs';

const run = (kind, plan, { rounds = [], taps = [] } = {}) => ({ kind, level: 1, plan, rounds, taps });
const tap = (label, soundMs, { aim = 'thing', hit = true } = {}) => ({ t: 1000, label, aim, hit, soundMs });
const round = (fields) => ({ q: 'numeral:2', bubble: '?', right: null, answerMs: 900, waitNextMs: 3000, ...fields });
const waits = (...ms) => ms.map((w) => round({ waitNextMs: w }));
const tried = (wrongFirst) => round({ wrongFirst: { tapped: '1', help: 1, shown: [], closed: false, ...wrongFirst } });

test('rule 1 passes when every quick tap is counted and every tap on a thing sounds within 0.2 s', () => {
  const v = everyTapAnswers([
    run('lighthouse', 'quick', { rounds: [round({ quick: { made: 3, counted: 3, what: 'lamp' } })], taps: [tap('lamp', 15), tap('lamp', 180)] }),
  ]);
  assert.equal(v.pass, true);
});

test('rule 1 fails when quick taps are dropped: three taps on the lamp, one flash', () => {
  const v = everyTapAnswers([run('lighthouse', 'quick', { rounds: [round({ quick: { made: 3, counted: 1, what: 'lamp' } })], taps: [tap('lamp', 15)] })]);
  assert.equal(v.pass, false);
  assert.match(v.why, /1 of 3/);
});

test('rule 1 fails when a tap on a thing gets no sound, or gets it later than 0.2 s', () => {
  assert.equal(everyTapAnswers([run('moon', 'fast', { taps: [tap('Chase', 20), tap('Chase', null)] })]).pass, false);
  assert.equal(everyTapAnswers([run('moon', 'fast', { taps: [tap('Chase', 250)] })]).pass, false);
});

test('rule 1 does not count taps on empty space or taps that hit nothing', () => {
  const v = everyTapAnswers([run('letters', 'mash', { taps: [tap('B', 30), tap('empty', null, { aim: 'empty' }), tap('B', null, { hit: false })] })]);
  assert.equal(v.pass, true);
});

test('rule 2 passes a matching row whose bubble shows the letter (ask match)', () => {
  const v = questionIsHers([run('letters', 'fast', { rounds: [round({ q: 'letterVisual:M', bubble: 'M', right: 'M' })] })], { ask: 'match' });
  assert.equal(v.pass, true);
});

test('rule 2 fails a row not marked match whose bubble shows the right option', () => {
  const kitty = questionIsHers([run('letters', 'fast', { rounds: [round({ q: 'letterVisual:B', bubble: 'B', right: 'B' })] })], { ask: 'name' });
  assert.equal(kitty.pass, false);
  const stars = questionIsHers([run('stars', 'fast', { rounds: [round({ q: 'sequence:2', bubble: '2 ⭐', right: '2' })] })], { stars: [3, 4], labels: 'both' });
  assert.equal(stars.pass, false);
  assert.match(stars.why, /bubble shows the answer/);
});

test('rule 2 passes the rows GAME.md makes matching without an ask column (Name Train ghost), not the others', () => {
  const r = [run('name', 'fast', { rounds: [round({ q: 'letterVisual:Z', bubble: 'Z 🚂', right: 'Z' })] })];
  assert.equal(questionIsHers(r, { mode: 'ghost' }).pass, true);
  assert.equal(questionIsHers(r, { mode: 'word' }).pass, false);
});

test('rule 2 sees a bubble that shows the answer as a picture (Saturn)', () => {
  const v = questionIsHers([run('saturn', 'fast', { rounds: [round({ q: 'sorting:ice', bubble: '❄️ 🪐', right: 'ice' })] })], { pieces: 4, named: true, sizes: 'same' });
  assert.equal(v.pass, false);
});

test('rule 2 passes when one wrong tap leaves the help at "try again" and shows nothing', () => {
  const v = questionIsHers([run('letters', 'wrong-first', { rounds: [tried({}), tried({})] })], { ask: 'name' });
  assert.equal(v.pass, true);
});

test('rule 2 fails when one wrong tap raises the help above 1, shows the answer, or answers for her', () => {
  for (const w of [{ help: 3 }, { shown: ['glowed'] }, { shown: ['named aloud'] }, { closed: true }]) {
    const v = questionIsHers([run('mars', 'wrong-first', { rounds: [tried(w)] })], { ask: 'name' });
    assert.equal(v.pass, false, JSON.stringify(w));
    assert.match(v.why, /one wrong tap shows it/);
  }
});

test('the answer counts as named aloud only when the question had not named it', () => {
  assert.equal(answerNamed('circle', ['Popatrz jeszcze raz. To jest koło.'], ['Chmury się rozsuwają. Jaki to kształt?']), true);
  assert.equal(answerNamed('B', ['Nie, to nie ten.', 'Znajdź Be!'], ['Kotek się schował! Znajdź Be!']), false);
  assert.equal(answerNamed('3', ['To nie ten kamień. Szukamy numeru trzy.'], ['Policz kropki!']), true);
});

test('rule 3 passes when the middle wait is at most 4 s and the longest at most 8 s (the last answer waits for the badge)', () => {
  const v = playsMoreThanWatches([run('cones', 'fast', { rounds: waits(3000, 3500, 4000, 12000) })]);
  assert.equal(v.pass, true);
  assert.match(v.why, /middle 3\.5 s, longest 4\.0 s/);
});

test('rule 3 fails a middle wait over 4 s, or a longest wait over 8 s', () => {
  assert.equal(playsMoreThanWatches([run('port', 'fast', { rounds: waits(5000, 4500, 6000, 1000) })]).pass, false);
  assert.equal(playsMoreThanWatches([run('river', 'fast', { rounds: waits(2000, 3000, 9000, 1000) })]).pass, false);
});

test('rule 3 counts a ride or a feast she tapped along with as hers, not as watching', () => {
  const ride = (ms, along) => ({ q: 'numeral:3', answerMs: 1500, waitNextMs: ms, alongMs: along });
  const rounds = [ride(12000, 9000), ride(11000, 8000), ride(3000, 0), ride(5000, 0)];
  const v = playsMoreThanWatches([run('lookout', 'fast', { rounds })]);
  assert.equal(v.pass, true);
  assert.match(v.why, /middle 3\.0 s, longest 3\.0 s, not counting 17\.0 s she tapped along/);
  const watched = rounds.map((x) => ({ ...x, alongMs: 0 }));
  assert.equal(playsMoreThanWatches([run('lookout', 'fast', { rounds: watched })]).pass, false, 'the same rides watched');
});

test('rule 3 reads the fast run only', () => {
  const v = playsMoreThanWatches([run('moon', 'mash', { rounds: waits(20000, 20000, 1000) }), run('moon', 'fast', { rounds: waits(2000, 2000, 1000) })]);
  assert.equal(v.pass, true);
  assert.equal(playsMoreThanWatches([run('moon', 'mash', { rounds: waits(2000, 2000, 1000) })]).pass, null);
});

test('judge gives one verdict per rule', () => {
  const v = judge([run('cones', 'fast', { rounds: waits(3000, 3000, 1000), taps: [tap('2', 10)] })], { bubble: 'dots' });
  assert.deepEqual(v.map((x) => [x.id, x.pass]), [[1, true], [2, true], [3, true]]);
});
