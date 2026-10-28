// Skill mastery: one small record per skill + item (e.g. letterAudio / B), updated from learning events.
// Deliberately simple and inspectable: a moving average of how much each answer shows she knows it.
// Latency, help and confusions are kept as separate numbers, not folded into the score.
//
// Guessing is taken out. With n things to pick from, a random tap is right first time 1 time in n, so an
// answer counts +1 when it is clean and −1/(n−1) when it is not (the classic right − wrong/(n−1)).
// A random tapper then averages about 0 instead of looking like she knows it (she used to settle at 0.85
// on 2 options); a child who knows it climbs towards 1. tools/learning/guesser.mjs measures both.

/** How much one answer moves mastery once she has answered a few times (mastery += RATE * (evidence − mastery)). */
export const RATE = 0.15;
/** Before her first answer she counts as having given this many answers that showed nothing (evidence 0). */
export const PRIOR = 1.5;
/** How many options to assume when a question doesn't say. */
export const DEFAULT_OPTIONS = 3;

/** A solved question that shows she knows it: first try, without the clue or the reveal (a repeat is fine). */
export const isClean = (ev) => ev.correct && ev.firstTry && ev.assistLevel < 2;

/**
 * What one event shows about her knowing the item, from −1 to 1; null when it shows nothing
 * (not solved: she may simply have left; not scored; only one thing to pick).
 */
export function evidence(ev) {
  if (!ev.correct || ev.scored === false) return null;
  const n = ev.options ?? DEFAULT_OPTIONS;
  if (n < 2) return null;
  return isClean(ev) ? 1 : -1 / (n - 1);
}

/** The weight of the next answer after `answered` of them: a plain average at first (with PRIOR), then RATE. */
export const rateAfter = (answered) => Math.max(RATE, 1 / (answered + 1 + PRIOR));

/**
 * @typedef {object} SkillStat
 * @property {number} attempts         scored questions solved
 * @property {number} correctFirstTry  solved with no wrong choice before
 * @property {number} assisted         solved with some help shown
 * @property {number} wrong            wrong choices (incl. rapid random taps)
 * @property {number} missTaps         taps that hit nothing (motor slips, kept apart)
 * @property {number} timeouts         long silences
 * @property {number} mastery          0 (new / unknown, or guessing) … 1 (strongly mastered)
 * @property {number} avgLatencyMs     running average time to answer (correct answers)
 * @property {number} lastSeenAt       epoch ms of the last event
 * @property {Record<string, number>} confusions  what she picks instead, e.g. { P: 3 }
 */
export function emptyStat() {
  return { attempts: 0, correctFirstTry: 0, assisted: 0, wrong: 0, missTaps: 0, timeouts: 0, mastery: 0, avgLatencyMs: 0, latencyN: 0, lastSeenAt: 0, confusions: {} };
}

const round3 = (x) => Math.round(x * 1000) / 1000;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const MAX_CONFUSIONS = 8;

/** Fold one event into skills[skill][item]. Mutates and returns the stat. */
export function applyEvent(skills, ev) {
  const bySkill = (skills[ev.skill] ||= {});
  const s = (bySkill[ev.item] ||= emptyStat());
  s.lastSeenAt = Math.max(s.lastSeenAt || 0, ev.at || 0);
  if (ev.correct) {
    const x = evidence(ev);
    if (x === null) return s; // it couldn't be got wrong: she saw it, nothing more
    s.mastery = round3(clamp01(s.mastery + rateAfter(s.attempts) * (x - s.mastery)));
    s.attempts++;
    if (ev.firstTry) s.correctFirstTry++;
    if (ev.assistLevel > 0) s.assisted++;
    s.latencyN = Math.min((s.latencyN || 0) + 1, 20); // running mean, slowly forgetting old answers
    s.avgLatencyMs = Math.round(s.avgLatencyMs + (ev.latencyMs - s.avgLatencyMs) / s.latencyN);
  } else if (ev.errorType === 'wrongChoice' || ev.errorType === 'overTap') {
    s.wrong++;
    if (ev.chosen !== undefined && ev.errorType === 'wrongChoice') {
      s.confusions[ev.chosen] = (s.confusions[ev.chosen] || 0) + 1;
      const keys = Object.keys(s.confusions);
      if (keys.length > MAX_CONFUSIONS) {
        const least = keys.sort((a, b) => s.confusions[a] - s.confusions[b])[0];
        delete s.confusions[least];
      }
    }
  } else if (ev.errorType === 'missTap') s.missTaps++;
  else if (ev.errorType === 'timeout') s.timeouts++;
  return s;
}

/** The stat's mastery just before `ev` was folded in (for "what moved this session"). */
export function masteryBefore(stat, ev) {
  const x = evidence(ev);
  if (x === null || !stat.attempts) return stat.mastery;
  const r = rateAfter(stat.attempts - 1);
  return round3(clamp01((stat.mastery - r * x) / (1 - r)));
}

/** Mastery of one item (0 when never seen). */
export function masteryOf(skills, skill, item) {
  return skills?.[skill]?.[String(item)]?.mastery ?? 0;
}

/** Average mastery over a set of items (unseen items count as 0). */
export function averageMastery(skills, skill, items) {
  const list = [...items];
  if (!list.length) return 0;
  return list.reduce((sum, it) => sum + masteryOf(skills, skill, it), 0) / list.length;
}
