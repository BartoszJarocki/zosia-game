// "Misja w domu": at the end of a session Chase gives one small real-world task tied to what she played
// ("Policz łyżki przy obiedzie!"). The tasks live in lang/pl.js (HOME_TASKS, keyed by mission); the parent page
// lists the same ones. Pure, so it is testable.
import { SESSION } from './director.js';

/** Today's task: from the last mission she finished that has one (the finale only when nothing else does). */
export function homeTaskKind(missions = [], tasks = {}) {
  const has = (k) => k in tasks;
  return missions.filter((k) => k !== SESSION.finale && has(k)).at(-1) || missions.filter(has).at(-1) || null;
}

/** The tasks of this week's finished sessions (finale or wound down), newest first, each once. */
export function weekTaskKinds(recent = [], tasks = {}, now = Date.now(), max = 3) {
  const kinds = recent
    .filter((s) => (s.finale || s.early) && now - s.startedAt < 7 * 86_400_000)
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((s) => homeTaskKind(s.missions, tasks))
    .filter(Boolean);
  return [...new Set(kinds)].slice(0, max);
}
