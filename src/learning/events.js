// Learning events: the one place scenes report "what was asked, what happened".
// Pure JS (no DOM/three.js) so it runs in tests and tools. Later systems (mastery, scheduler,
// assist, session director, parent view) subscribe to the bus instead of reading scene internals.

/** What a question was testing. */
export const SKILLS = Object.freeze([
  'letterVisual', // match / find a letter she can see
  'letterAudio',  // find a letter from its spoken name only
  'letterSound',  // link a letter to its sound (first sounds)
  'numeral',      // recognise a written number
  'quantity',     // recognise how many (dots, objects)
  'counting',     // produce a count (give N)
  'sequence',     // order: what comes next / one more, one less
  'comparison',   // more / less / same
]);

/** Why an attempt didn't succeed. Only wrongChoice says something about knowledge. */
export const ERROR_TYPES = Object.freeze([
  'wrongChoice', // picked another valid option
  'timeout',     // no answer for a long while (the idle repeat fired)
  'missTap',     // tapped and hit nothing (motor slip, moving target)
  'overTap',     // rapid tapping, likely random
]);

/**
 * @typedef {object} LearningEvent
 * @property {string} mission      mission kind, e.g. 'letters'
 * @property {string} skill        one of SKILLS
 * @property {string} item         what was asked, e.g. 'B' or '4'
 * @property {boolean} correct     this attempt solved the question
 * @property {boolean} firstTry    solved with no wrong attempt before it (always false when correct is false)
 * @property {number} latencyMs    time from the end of the spoken question (or from opening it) to this attempt
 * @property {0|1|2|3} assistLevel strongest help shown so far: 0 none · 1 question repeated · 2 clue · 3 answer revealed
 * @property {number} attempt      1-based attempt number within the question (miss taps and timeouts don't count)
 * @property {string} [errorType]  one of ERROR_TYPES, only when correct is false
 * @property {string} [chosen]     what she picked instead (for confusions like B ↔ P)
 * @property {number} [level]      mission level
 * @property {number} [round]      0-based round within the mission
 * @property {number} at           epoch ms
 */

/** Validate + normalise an event. Throws with a readable message when something is wrong. */
export function makeEvent(e) {
  const fail = (m) => { throw new Error(`learning event: ${m} (${JSON.stringify(e)})`); };
  if (!e || typeof e !== 'object') fail('not an object');
  if (typeof e.mission !== 'string' || !e.mission) fail('mission is required');
  if (!SKILLS.includes(e.skill)) fail(`unknown skill "${e.skill}"`);
  if (e.item === undefined || e.item === null || e.item === '') fail('item is required');
  if (typeof e.correct !== 'boolean') fail('correct must be true/false');
  const assistLevel = e.assistLevel ?? 0;
  if (![0, 1, 2, 3].includes(assistLevel)) fail(`assistLevel must be 0–3 (got ${assistLevel})`);
  if (e.errorType !== undefined && !ERROR_TYPES.includes(e.errorType)) fail(`unknown errorType "${e.errorType}"`);
  if (e.correct && e.errorType) fail('a correct attempt has no errorType');
  if (!e.correct && !e.errorType) fail('an unsuccessful attempt needs an errorType');
  const out = {
    mission: e.mission,
    skill: e.skill,
    item: String(e.item),
    correct: e.correct,
    firstTry: e.correct ? Boolean(e.firstTry) : false,
    latencyMs: Math.max(0, Math.round(Number(e.latencyMs) || 0)),
    assistLevel,
    attempt: Math.max(1, Math.round(Number(e.attempt) || 1)),
    at: Number(e.at) || Date.now(),
  };
  if (e.errorType) out.errorType = e.errorType;
  if (e.chosen !== undefined && e.chosen !== null) out.chosen = String(e.chosen);
  if (Number.isInteger(e.level)) out.level = e.level;
  if (Number.isInteger(e.round)) out.round = e.round;
  return out;
}

/** A tiny pub/sub with a ring buffer of recent events. */
export class LearningBus {
  constructor({ limit = 200, onInvalid = (err) => console.warn(err.message) } = {}) {
    this.limit = limit;
    this.onInvalid = onInvalid;
    this.listeners = new Set();
    this.log = [];
  }

  /** Record an event. Invalid events are reported, never thrown into gameplay. Returns the event or null. */
  emit(raw) {
    let ev;
    try { ev = makeEvent(raw); } catch (err) { this.onInvalid(err); return null; }
    this.log.push(ev);
    if (this.log.length > this.limit) this.log.splice(0, this.log.length - this.limit);
    for (const fn of this.listeners) {
      try { fn(ev); } catch (err) { this.onInvalid(err); } // one bad listener must not break the others or the game
    }
    return ev;
  }

  /** Listen to every event. Returns an unsubscribe function. */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** The most recent events (oldest first). */
  recent(n = this.limit) { return this.log.slice(-n); }

  clear() { this.log = []; }
}

/** The game's bus. */
export const learning = new LearningBus();
