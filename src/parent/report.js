// What the parent view shows, worked out from the saved skill stats. Pure (no DOM), so it is testable.
// These are estimates from play, not a test: few answers = little to go on, and the view says so.
import { categorize } from '../learning/scheduler.js';

export const LETTER_SKILLS = [
  ['letterVisual', 'sees it'],
  ['letterAudio', 'hears its name'],
  ['letterSound', 'its sound'],
];
export const NUMBER_SKILLS = [
  ['numeral', 'numeral'],
  ['quantity', 'how many'],
  ['counting', 'counting out'],
  ['sequence', 'order'],
];
const LABEL = Object.fromEntries([...LETTER_SKILLS, ...NUMBER_SKILLS]);

/** Fewer answers than this: shown, but marked as "not much to go on yet". */
export const FEW = 3;

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

/** One skill + item, in parent terms. null when it never came up. */
export function summarize(stat) {
  if (!stat || !(stat.attempts || stat.wrong || stat.timeouts)) return null;
  const confusions = Object.entries(stat.confusions || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  return {
    mastery: stat.mastery || 0,
    attempts: stat.attempts || 0,
    firstTryPct: pct(stat.correctFirstTry || 0, stat.attempts || 0),
    assistPct: pct(stat.assisted || 0, stat.attempts || 0),
    avgLatencyS: stat.avgLatencyMs ? Math.round(stat.avgLatencyMs / 100) / 10 : null,
    wrong: stat.wrong || 0,
    confusions,
    few: (stat.attempts || 0) < FEW,
    lastSeenAt: stat.lastSeenAt || 0,
  };
}

/** Every item (letter or number) with a row per skill it was practised in. */
export function itemReports(skills, skillList, items) {
  return items.map((item) => {
    const rows = skillList
      .map(([skill, label]) => ({ skill, label, ...summarize(skills?.[skill]?.[String(item)]) }))
      .filter((r) => r.mastery !== undefined);
    return { item: String(item), rows, seen: rows.length > 0 };
  });
}

/** Totals over everything, plus what to practise and what came up lately. */
export function overview(skills) {
  let attempts = 0, firstTry = 0, assisted = 0, latSum = 0, latN = 0;
  const all = [];
  for (const [skill, items] of Object.entries(skills || {})) {
    for (const [item, s] of Object.entries(items)) {
      attempts += s.attempts || 0;
      firstTry += s.correctFirstTry || 0;
      assisted += s.assisted || 0;
      if (s.avgLatencyMs && s.attempts) { latSum += s.avgLatencyMs * s.attempts; latN += s.attempts; }
      all.push({ skill, item, label: LABEL[skill] || skill, mastery: s.mastery || 0, lastSeenAt: s.lastSeenAt || 0, kind: categorize(s) });
    }
  }
  return {
    attempts,
    firstTryPct: pct(firstTry, attempts),
    assistPct: pct(assisted, attempts),
    avgLatencyS: latN ? Math.round(latSum / latN / 100) / 10 : null,
    difficult: all.filter((x) => x.kind === 'difficult').sort((a, b) => a.mastery - b.mastery).slice(0, 8),
    familiar: all.filter((x) => x.kind === 'familiar').length,
    recent: all.filter((x) => x.lastSeenAt).sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 8),
  };
}

/** Highest number the level data can ask about (for the numbers grid). */
export function maxNumber(levels) {
  const tops = [
    ...(levels.cones || []).map((l) => l.max),
    ...(levels.stones || []).map((l) => l.n),
    ...(levels.counting || []).flatMap((l) => [l.give?.[1], l.howMany?.[1]]),
    ...(levels.lookout || []).map((l) => l.max),
  ].filter(Number.isFinite);
  return Math.max(3, ...tops);
}
