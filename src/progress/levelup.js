// Levelling up from one finished run. Pure, so the tests and the simulator (tools/learning/sim.mjs) run this code.
// A run is scored per question: a question counts as right ("clean") when she answered it first try without
// the clue or the reveal (hearing the question again is fine). Questions that can't really be got wrong
// (question(..., { scored: false })) don't count either way.
import { isClean } from '../learning/mastery.js';

/** A good run: at least two thirds of its questions clean (2 of 3, 3 of 4, 4 of 5…). */
export const GOOD_RUN = 0.65;

/** { scored, clean } from the learning events of a run's solved questions. */
export function scoreRun(events) {
  let scored = 0, clean = 0;
  for (const ev of events) {
    if (!ev.correct || ev.scored === false) continue;
    scored++;
    if (isClean(ev)) clean++;
  }
  return { scored, clean };
}

/**
 * Fold a run into the mission's saved record { level, good, lastAcc } (mutated). A run without a scored
 * question doesn't count. opens(): may she move up from m.level (the next level's gate, GAME.md "needs")?
 * @returns {{ levelUp: boolean, acc: number|null }}
 */
export function applyRun(m, { scored, clean }, { goodRuns, top, opens = () => true }) {
  if (!scored) return { levelUp: false, acc: null };
  const acc = clean / scored;
  m.lastAcc = acc;
  if (acc < GOOD_RUN) return { levelUp: false, acc };
  m.good++;
  if (m.good < goodRuns || m.level >= top || !opens()) return { levelUp: false, acc };
  m.level++;
  m.good = 0;
  return { levelUp: true, acc };
}
