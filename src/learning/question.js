// Tracks one open question at a time and turns taps into learning events.
// Scenes say what is being asked (open) and what happened (correct / wrong / missTap / timeout);
// the tracker works out first-try, attempt numbers, latency and the help level.

export class QuestionTracker {
  /**
   * @param {import('./events.js').LearningBus} bus
   * @param {{ now?: () => number, clock?: () => number, overTapWindowMs?: number, overTapCount?: number }} [opts]
   *   now: monotonic ms for durations (performance.now) · clock: epoch ms for timestamps (Date.now)
   */
  constructor(bus, { now = () => performance.now(), clock = () => Date.now(), overTapWindowMs = 1200, overTapCount = 3 } = {}) {
    this.bus = bus;
    this.now = now;
    this.clock = clock;
    this.overTapWindowMs = overTapWindowMs;
    this.overTapCount = overTapCount;
    this.q = null;
  }

  get isOpen() { return Boolean(this.q); }
  get current() { return this.q; }

  /** Start a question. An unresolved previous question is dropped silently (e.g. the scene moved on). */
  open({ mission, skill, item, level, round }) {
    this.q = { mission, skill, item: String(item), level, round, openedAt: this.now(), promptEndAt: null, wrong: 0, assist: 0, taps: [] };
    return this.q;
  }

  /** The spoken question finished: latency is measured from here (only the first time counts). */
  promptEnded() {
    if (this.q && this.q.promptEndAt === null) this.q.promptEndAt = this.now();
  }

  /** Help was shown. Levels only go up: 1 question repeated · 2 clue · 3 answer revealed. */
  assist(level) {
    if (this.q) this.q.assist = Math.max(this.q.assist, Math.min(3, Math.max(0, level | 0)));
  }

  /** The question was solved. Closes it. */
  correct({ chosen } = {}) {
    if (!this.q) return null;
    this.tap();
    const ev = this.emit({ correct: true, firstTry: this.q.wrong === 0, attempt: this.q.wrong + 1, chosen });
    this.q = null;
    return ev;
  }

  /** Another option was picked. Rapid tapping is reported as overTap instead of wrongChoice. */
  wrong({ chosen } = {}) {
    if (!this.q) return null;
    const rushed = this.tap();
    this.q.wrong++;
    return this.emit({ correct: false, errorType: rushed ? 'overTap' : 'wrongChoice', attempt: this.q.wrong, chosen });
  }

  /** A tap that hit nothing. Motor slip: doesn't count as an attempt, so first-try is kept. */
  missTap() {
    if (!this.q) return null;
    this.tap();
    return this.emit({ correct: false, errorType: 'missTap', attempt: this.q.wrong + 1 });
  }

  /** Nothing happened for a long while (the idle repeat fired). Counts as help level 1. */
  timeout() {
    if (!this.q) return null;
    this.assist(1);
    return this.emit({ correct: false, errorType: 'timeout', attempt: this.q.wrong + 1 });
  }

  /** Drop the question without an event (scene left, round abandoned). */
  cancel() { this.q = null; }

  // ---- internals ----
  /** Note a tap; true when this tap is part of a rapid burst. */
  tap() {
    const t = this.now();
    const taps = this.q.taps;
    taps.push(t);
    while (taps.length && t - taps[0] > this.overTapWindowMs) taps.shift();
    return taps.length >= this.overTapCount;
  }

  emit(fields) {
    const q = this.q;
    const from = q.promptEndAt ?? q.openedAt;
    return this.bus.emit({
      mission: q.mission,
      skill: q.skill,
      item: q.item,
      level: q.level,
      round: q.round,
      latencyMs: this.now() - from,
      assistLevel: q.assist,
      at: this.clock(),
      ...fields,
    });
  }
}
