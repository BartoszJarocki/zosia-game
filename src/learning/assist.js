// Unified help: one small state machine for every mission. Pure (no timers, no DOM) so it is testable.
// The mission feeds it "she's been quiet for N ms" and "she picked something else"; it answers with
// what to do. Scenes decide how each action looks and sounds (their assist hooks).
//
//   quiet ~6 s   → nudge        (the speech bubble bounces, no words: she may just be looking)
//   quiet ~10 s  → shortPrompt  ("Where is B?")          level 1
//   quiet ~17 s  → hint         ("B like banana")        level 2
//   quiet ~25 s  → reveal       (the answer pulses)      level 3, then silence: never endless repetition
//
//   1st wrong    → retry        (neutral "try again")    level 1
//   2nd wrong    → simplify     (e.g. one wrong option leaves) level 2
//   3rd+ wrong   → reveal       (the answer pulses)      level 3

export const TIMING = Object.freeze({ nudgeMs: 6000, shortPromptMs: 10000, hintMs: 17000, revealMs: 25000 });

const IDLE_STEPS = [
  ['nudgeMs', 'nudge', 0],
  ['shortPromptMs', 'shortPrompt', 1],
  ['hintMs', 'hint', 2],
  ['revealMs', 'reveal', 3],
];

/** @typedef {{ level: 0|1|2|3, wrongAttempts: number, idleStep: number, revealed: boolean }} AssistState */
export function createAssist() {
  return { level: 0, wrongAttempts: 0, idleStep: 0, revealed: false };
}

/**
 * She has been quiet for idleMs (since the prompt ended or her last tap).
 * Returns the action to run now, or null. Each idle step fires once per question; steps whose help
 * was already given by wrong taps are skipped (never step back down).
 */
export function onIdle(state, idleMs, timing = TIMING) {
  while (state.idleStep < IDLE_STEPS.length) {
    const [key, action, level] = IDLE_STEPS[state.idleStep];
    if (idleMs < timing[key]) return null;
    state.idleStep++;
    if (action === 'nudge') { if (state.level === 0) return 'nudge'; continue; } // no help given yet: just draw her eye
    if (level <= state.level) continue; // already that much help (e.g. after wrong taps)
    state.level = level;
    if (action === 'reveal') state.revealed = true;
    return action;
  }
  return null; // all done: stay quiet
}

/** She picked something else. Returns the action to run. */
export function onWrong(state) {
  state.wrongAttempts++;
  if (state.wrongAttempts >= 3 || state.revealed) {
    state.level = 3;
    state.revealed = true;
    return 'reveal';
  }
  if (state.wrongAttempts === 2) {
    state.level = Math.max(state.level, 2);
    return 'simplify';
  }
  state.level = Math.max(state.level, 1);
  return 'retry';
}

/** Restart the idle ladder after an interaction (but keep the help already given). */
export function onActivity(state) {
  // after a wrong tap she is trying again: resume idle help from the current level
  const next = IDLE_STEPS.findIndex(([, , level]) => level > state.level);
  state.idleStep = Math.max(state.idleStep, next === -1 ? IDLE_STEPS.length : next);
  return state;
}
