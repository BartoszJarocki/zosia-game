// Skill mastery: one small record per skill + item (e.g. letterAudio / B), updated from learning events.
// Deliberately simple and inspectable: an exponential moving average of how each question went.
// Latency, help and confusions are kept as separate numbers, not folded into the score.

/** How much one answer moves mastery (newMastery = old * (1 - RATE) + score * RATE). */
export const RATE = 0.2;

/** Score for a solved question. Unsolved questions don't produce a score (she may simply have left). */
export function resultScore(ev) {
  if (!ev.correct) return null;
  if (ev.assistLevel >= 3) return 0.2;              // the answer had to be revealed
  if (ev.assistLevel >= 2) return 0.45;             // solved after a clue
  if (!ev.firstTry || ev.assistLevel >= 1) return 0.7; // after a wrong try, or after the question was repeated
  return 1.0;                                        // right first time, no help
}

/**
 * @typedef {object} SkillStat
 * @property {number} attempts         questions solved
 * @property {number} correctFirstTry  solved with no wrong choice before
 * @property {number} assisted         solved with some help shown
 * @property {number} wrong            wrong choices (incl. rapid random taps)
 * @property {number} missTaps         taps that hit nothing (motor slips, kept apart)
 * @property {number} timeouts         long silences
 * @property {number} mastery          0 (new / unknown) … 1 (strongly mastered)
 * @property {number} avgLatencyMs     running average time to answer (correct answers)
 * @property {number} lastSeenAt       epoch ms of the last event
 * @property {Record<string, number>} confusions  what she picks instead, e.g. { P: 3 }
 */
export function emptyStat() {
  return { attempts: 0, correctFirstTry: 0, assisted: 0, wrong: 0, missTaps: 0, timeouts: 0, mastery: 0, avgLatencyMs: 0, latencyN: 0, lastSeenAt: 0, confusions: {} };
}

const round3 = (x) => Math.round(x * 1000) / 1000;
const MAX_CONFUSIONS = 8;

/** Fold one event into skills[skill][item]. Mutates and returns the stat. */
export function applyEvent(skills, ev) {
  const bySkill = (skills[ev.skill] ||= {});
  const s = (bySkill[ev.item] ||= emptyStat());
  s.lastSeenAt = Math.max(s.lastSeenAt || 0, ev.at || 0);
  if (ev.correct) {
    s.attempts++;
    if (ev.firstTry) s.correctFirstTry++;
    if (ev.assistLevel > 0) s.assisted++;
    s.mastery = round3(s.mastery * (1 - RATE) + resultScore(ev) * RATE);
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
