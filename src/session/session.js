// The live play session (one per sitting): wires the pure director into the game.
// Starts on the start button (or after a long break), hears every learning event, and saves a short
// summary after each finished mission (progress.sessions).
import { CONFIG } from '../config.js';
import { learning } from '../learning/events.js';
import { recordSession } from '../progress.js';
import { SESSION, createSession, isStale, noteEvent, noteReplay, completeMission, shorten, windDown, summary } from './director.js';
import { attention } from './attention.js';
import { eventById } from '../adventure/events.js';
import { completeEvent } from '../adventure/rewards.js';

const staleAfter = () => ({ newSessionAfterMs: (CONFIG.session?.newAfterMinutes ?? 15) * 60 * 1000 });
let current = null;

/** Developer overrides (tests, #parent dev tools): suggest: a place to suggest next instead of the director's pick. */
export const dev = { suggest: null };

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
  // the hub's story for this place ("the kitten needs help") is resolved by doing that mission
  if (s.pendingEvent && eventById(s.pendingEvent)?.mission === kind) { completeEvent(s.pendingEvent); s.pendingEvent = null; }
  return result;
}

/** She tapped the bubble to hear the question again. */
export function replayed() { noteReplay(getSession()); }

/**
 * How is she doing? Applies it to the session (tired → finale next; finish → wind down) and returns
 * 'ok' | 'tired' | 'finish'. Once winding down, it stays that way for the session.
 */
export function checkAttention(now = Date.now()) {
  const s = getSession(now);
  if (s.endedEarly) return 'finish';
  const a = (s.attention = attention(s, CONFIG.attention));
  if (a.state === 'finish') windDown(s);
  else if (a.state === 'tired') shorten(s);
  if (a.state !== 'ok' && /[?&]learnlog/.test(globalThis.location?.search || '')) console.info('[attention]', a.state, a.score, a.factors);
  return a.state;
}

learning.subscribe((ev) => noteEvent(getSession(ev.at || Date.now()), ev));
