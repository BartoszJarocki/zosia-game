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

/** A run with at least this many questions, every one clean, moves her up two levels instead of one. */
export const LEAP_RUN = 3;

/**
 * Fold a run into the mission's saved record { level, good, lastAcc } (mutated). A run without a scored
 * question doesn't count. opens(level): may she move up to that level (its gate, GAME.md "needs")?
 * Each level of a leap must open, so a closed gate stops her below it.
 * @returns {{ gained: number, acc: number|null }} gained: levels she moved up (0, 1 or 2)
 */
export function applyRun(m, { scored, clean }, { goodRuns, top, opens = () => true }) {
  if (!scored) return { gained: 0, acc: null };
  const acc = clean / scored;
  m.lastAcc = acc;
  if (acc < GOOD_RUN) return { gained: 0, acc };
  m.good++;
  if (m.good < goodRuns) return { gained: 0, acc };
  const from = m.level, steps = clean === scored && scored >= LEAP_RUN ? 2 : 1;
  while (m.level - from < steps && m.level < top && opens(m.level + 1)) m.level++;
  if (m.level > from) m.good = 0;
  return { gained: m.level - from, acc };
}
