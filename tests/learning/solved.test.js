// Every question she solves is counted for the grown-ups; only answers a guess could miss move mastery, and a step
// that is not her answer counts for nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LearningBus } from '../../src/learning/events.js';
import { QuestionTracker } from '../../src/learning/question.js';
import { applyEvent } from '../../src/learning/mastery.js';
import { categorize } from '../../src/learning/scheduler.js';

/** A question played through the real tracker; returns the events it sent. */
function play(steps, { skill = 'syllables', item = 'KACZKA', options = 3, scored = true, onScreen = false } = {}) {
  const bus = new LearningBus();
  const events = [];
  bus.subscribe((ev) => events.push(ev));
  let t = 0;
  const tracker = new QuestionTracker(bus, { now: () => (t += 2000), clock: () => t });
  tracker.open({ mission: 'port', skill, item, scored, options });
  if (onScreen) tracker.answerOnScreen();
  for (const step of steps) {
    if (step === 'right') tracker.correct();
    else if (step === 'wrong') tracker.wrong({ chosen: 1 });
    else tracker.assist(step);
  }
  return events;
}

const fold = (events, skills = {}) => { for (const ev of events) applyEvent(skills, ev); return skills; };
const counts = (s) => ({ solved: s.solved, firstTry: s.firstTry, helped: s.helped, attempts: s.attempts, mastery: s.mastery });

test('a right answer is solved, first try, and moves mastery', () => {
  const s = fold(play(['right'])).syllables.KACZKA;
  assert.deepEqual(counts(s), { solved: 1, firstTry: 1, helped: 0, attempts: 1, mastery: 0.4 });
});

test('an error then the right answer is solved, not first try', () => {
  const s = fold(play(['wrong', 1, 'right'])).syllables.KACZKA;
  assert.equal(s.solved, 1);
  assert.equal(s.firstTry, 0);
  assert.equal(s.helped, 0, 'hearing the question again after a wrong tap is not help');
  assert.equal(s.wrong, 1);
});

test('an answer after the clue or the answer shown is solved, after help', () => {
  for (const level of [2, 3]) {
    const s = fold(play([level, 'right'])).syllables.KACZKA;
    assert.deepEqual([s.solved, s.firstTry, s.helped], [1, 0, 1], `help level ${level}`);
  }
});

test('the last star (one left to tap) is solved, and leaves mastery as it was', () => {
  const skills = fold(play(['right'], { skill: 'sequence', item: '6', options: 3 }));
  const before = { ...skills.sequence['6'] };
  fold(play(['right'], { skill: 'sequence', item: '6', options: 1 }), skills);
  const s = skills.sequence['6'];
  assert.equal(s.solved, 2);
  assert.equal(s.firstTry, 2);
  assert.equal(s.attempts, before.attempts);
  assert.equal(s.mastery, before.mastery);
});

test('a step that is not her answer (the drop tap, an automatic give) is not solved and leaves no row', () => {
  const skills = fold([...play(['right'], { skill: 'sorting', item: 'drop', options: 1, scored: false }), ...play(['wrong', 'right'], { skill: 'counting', item: '3', scored: false })]);
  assert.deepEqual(skills, {});
});

test('an answer copied from the screen is solved, and five of them leave the item new, its mastery as it was', () => {
  const skills = {};
  for (let i = 0; i < 5; i++) fold(play(['right'], { item: 'MEWA', options: 2, onScreen: true }), skills);
  assert.deepEqual(counts(skills.syllables.MEWA), { solved: 5, firstTry: 5, helped: 0, attempts: 0, mastery: 0 });
  assert.equal(categorize(skills.syllables.MEWA), 'new');
  fold(play(['right'], { item: 'MEWA', options: 3 }), skills);
  assert.equal(skills.syllables.MEWA.mastery, 0.4, 'the same name asked without its pieces on the board does move it');
});

test('each answer a guess could miss keeps what a guess would have got: one in its options', () => {
  const s = fold([...play(['right'], { options: 4 }), ...play(['wrong', 'right'], { options: 4 }), ...play(['right'], { options: 2 }), ...play(['right'], { options: 1 })]).syllables.KACZKA;
  assert.deepEqual([s.guessable, s.guessableFirstTry, s.guessChance], [3, 2, 1 / 4 + 1 / 4 + 1 / 2]);
});

test('the same events folded into two fresh saves give the same counts', () => {
  const events = [...play(['right']), ...play(['wrong', 1, 'right']), ...play([3, 'right']), ...play(['right'], { options: 1 })];
  assert.deepEqual(fold(events), fold(structuredClone(events)));
  assert.deepEqual([fold(events).syllables.KACZKA.solved, fold(events).syllables.KACZKA.firstTry], [4, 2]);
});

test('five solves that could not be got wrong leave the item new, not difficult', () => {
  const skills = {};
  for (let i = 0; i < 5; i++) fold(play(['right'], { skill: 'sequence', item: '7', options: 1 }), skills);
  assert.equal(skills.sequence['7'].solved, 5);
  assert.equal(categorize(skills.sequence['7']), 'new');
});
