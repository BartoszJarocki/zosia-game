// Every tap answers (docs/IMPROVEMENT-PLAN.md, rule 1). A tap on something she can tap is never silent, also when
// the game cannot act on it yet: it is busy, or the tap waits its turn (Mission.inTurn). Then the thing she touched
// gives a short tick and a little bounce. That is not an answer: nothing is counted and no voice is cut.

/**
 * Run a tap's handler. When it started no sound of its own, tick() and bounce(). sounds() counts the sounds started
 * so far (audio.js), so a scene says nothing about it: an early return or a queued step is answered all the same.
 */
export function answer(handle, { sounds, tick, bounce }) {
  const before = sounds();
  const out = handle();
  if (sounds() === before) { tick(); bounce(); }
  return out;
}
