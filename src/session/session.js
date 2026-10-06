// The live play session (one per sitting): wires the pure director into the game.
// Starts on the start button (or after a long break), hears every learning event, and saves a short
// summary after each finished mission (progress.sessions).
import { CONFIG } from '../config.js';
import { learning } from '../learning/events.js';
import { recordSession } from '../progress.js';
import { SESSION, createSession, isStale, noteEvent, completeMission, summary } from './director.js';

const staleAfter = () => ({ newSessionAfterMs: (CONFIG.session?.newAfterMinutes ?? 15) * 60 * 1000 });
let current = null;

/** A new session (the start button). */
export function startSession(now = Date.now()) {
  current = createSession(now, { targetMissions: CONFIG.session?.missions ?? SESSION.targetMissions });
  return current;
}

/** The current session; a long break (or none yet) starts a new one. */
export function getSession(now = Date.now()) {
  if (isStale(current, now, staleAfter())) startSession(now);
  return current;
}

/** A mission was finished. Returns { finale } (true = that was the session's finale). */
export function missionDone(kind, now = Date.now()) {
  const s = getSession(now);
  const result = completeMission(s, kind, now);
  recordSession(summary(s));
  return result;
}

learning.subscribe((ev) => noteEvent(getSession(ev.at || Date.now()), ev));
