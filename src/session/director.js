// Session director: one play session = a couple of short missions → the Lookout as the finale → free play.
// Pure (no timers, no DOM, no storage), so it is testable. src/session/session.js wires it into the game.
//
//   mission  (fewer than targetMissions done)   the hub suggests a place, alternating letters / numbers
//   finale   (enough done)                      the hub suggests the Lookout
//   free     (finale done, or wound down early)  no more suggestions: she plays whatever she likes
//
// Suggestions never lock anything: any place can be tapped at any time.

export const SESSION = Object.freeze({
  targetMissions: 2,                 // regular missions before the finale (start conservatively)
  finale: 'lookout',
  recentLimit: 20,                   // how many recent answers to keep for fatigue checks (Phase 6)
  newSessionAfterMs: 15 * 60 * 1000, // this long without playing = a new session next time
});

/** Letter games and number games, for variety. */
export const DOMAIN = { letters: 'letters', balloons: 'letters', name: 'letters', cones: 'numbers', stones: 'numbers', counting: 'numbers', lookout: 'numbers', delivery: 'letters', picnic: 'numbers', garage: 'shapes' };

/**
 * @typedef {object} SessionState
 * @property {number} id / startedAt / lastActiveAt   epoch ms
 * @property {number} missionsCompleted   regular missions finished (the finale doesn't count)
 * @property {number} targetMissions
 * @property {string[]} completed         every mission finished, in order (finale included)
 * @property {number[]} recentLatency     ms, correct answers
 * @property {number[]} recentAssistLevels  help level of correct answers
 * @property {string[]} recentErrors      errorType of the other events
 * @property {Array<object>} recentQuestions  one record per solved question: latencyMs, assist, and what
 *                                     happened before it (wrongChoice, overTap, timeout, missTap, replays)
 * @property {{ latency: number[], assist: number[] }} baseline  the first few answers of the session
 * @property {boolean} finaleTriggered    the hub has called for the finale
 * @property {boolean} finaleDone
 * @property {boolean} endedEarly         wound down because she seemed tired (Phase 6)
 */
export function createSession(now, { targetMissions = SESSION.targetMissions } = {}) {
  return {
    id: now, startedAt: now, lastActiveAt: now,
    missionsCompleted: 0, targetMissions, completed: [],
    recentLatency: [], recentAssistLevels: [], recentErrors: [],
    recentQuestions: [], baseline: { latency: [], assist: [] }, pending: blankQuestion(),
    finaleTriggered: false, finaleDone: false, endedEarly: false,
  };
}

const blankQuestion = () => ({ wrongChoice: 0, overTap: 0, timeout: 0, missTap: 0, replays: 0 });
const BASELINE = 4; // answers

/** Long enough without playing that the next play is a new session. */
export function isStale(s, now, { newSessionAfterMs = SESSION.newSessionAfterMs } = {}) {
  return !s || now - s.lastActiveAt > newSessionAfterMs;
}

const push = (list, v, limit) => { list.push(v); if (list.length > limit) list.splice(0, list.length - limit); };

/** Fold one learning event into the session's recent history. */
export function noteEvent(s, ev, { limit = SESSION.recentLimit } = {}) {
  if (ev.at) s.lastActiveAt = Math.max(s.lastActiveAt, ev.at);
  s.pending ||= blankQuestion();
  if (ev.correct) {
    push(s.recentLatency, ev.latencyMs, limit);
    push(s.recentAssistLevels, ev.assistLevel, limit);
    push(s.recentQuestions, { ...s.pending, latencyMs: ev.latencyMs, assist: ev.assistLevel }, limit);
    if (s.baseline.latency.length < BASELINE) { s.baseline.latency.push(ev.latencyMs); s.baseline.assist.push(ev.assistLevel); }
    s.pending = blankQuestion();
  } else if (ev.errorType) {
    push(s.recentErrors, ev.errorType, limit);
    if (ev.errorType in s.pending) s.pending[ev.errorType]++;
  }
  return s;
}

/** She asked to hear the question again (tapped the bubble). */
export function noteReplay(s) {
  (s.pending ||= blankQuestion()).replays++;
  return s;
}

/** She seems to be getting tired: the finale comes after the current mission. */
export function shorten(s) {
  if (nextStep(s) === 'mission') s.targetMissions = Math.min(s.targetMissions, s.missionsCompleted + 1);
  return s;
}

/** Time to stop: after the current mission it's a gentle goodbye, then free play (no more suggestions). */
export function windDown(s) {
  if (!s.finaleDone) s.endedEarly = true;
  return s;
}

/** Where the session is: 'mission' | 'finale' | 'free'. */
export function nextStep(s) {
  if (s.finaleDone || s.endedEarly) return 'free';
  return s.missionsCompleted >= s.targetMissions ? 'finale' : 'mission';
}

/** The hub is calling for the finale. */
export function callFinale(s) {
  if (nextStep(s) === 'finale') s.finaleTriggered = true;
  return s;
}

/**
 * A mission finished (badge earned). The Lookout counts as the finale only once it is due;
 * played earlier it is an ordinary mission. Returns { finale } (true = the session's finale just ended).
 */
export function completeMission(s, kind, now) {
  const finale = kind === SESSION.finale && nextStep(s) === 'finale';
  s.completed.push(kind);
  s.lastActiveAt = Math.max(s.lastActiveAt, now);
  if (finale) { s.finaleDone = true; s.finaleTriggered = true; } else s.missionsCompleted++;
  return { finale };
}

/**
 * Which place the hub should gently suggest next (or null in free play).
 * Prefers places not played yet this session, and a letter game after a number game (and back).
 */
export function suggestNext(s, kinds, rng = Math.random) {
  const step = nextStep(s);
  if (step === 'free') return null;
  if (step === 'finale') return kinds.includes(SESSION.finale) ? SESSION.finale : null;
  const pool = kinds.filter((k) => k !== SESSION.finale);
  const last = s.completed.at(-1);
  const fresh = pool.filter((k) => !s.completed.includes(k));
  let cands = fresh.length ? fresh : pool.filter((k) => k !== last);
  if (last && DOMAIN[last]) {
    const other = cands.filter((k) => DOMAIN[k] && DOMAIN[k] !== DOMAIN[last]);
    if (other.length) cands = other;
  }
  if (!cands.length) cands = pool;
  return cands.length ? cands[Math.floor(rng() * cands.length)] : null;
}

/** What gets saved about a session (progress.sessions.recent). */
export function summary(s) {
  const changes = Object.values(s.changes || {})
    .filter((c) => Math.abs(c.to - c.from) >= 0.01)
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))
    .slice(0, 10);
  return { id: s.id, startedAt: s.startedAt, endedAt: s.lastActiveAt, missions: [...s.completed], finale: s.finaleDone, ...(s.endedEarly ? { early: true } : {}), ...(changes.length ? { changes } : {}) };
}
