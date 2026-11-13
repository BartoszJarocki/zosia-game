// What the parent view shows, worked out from the saved skill stats. Pure (no DOM), so it is testable.
// These are estimates from play, not a test: few answers = little to go on, and the view says so.
import { categorize } from '../learning/scheduler.js';
import { showLetter } from '../config.js';
import { BOATS } from '../levels/port.js';

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
/** Pup Picnic: more / less / the same (items: the mode, '#' when the groups showed numerals). */
export const COMPARE_SKILLS = [['comparison', 'compares']];
export const COMPARE_ITEMS = ['more', 'less', 'same', 'more#', 'less#', 'same#'];
/** Name Train "Który pociąg jest Zosi?": finding a whole name among others (items: the names). */
export const WORD_SKILLS = [['wordVisual', 'finds it']];
export const SPACE_SKILLS = [['space', 'recognises it']];
const SPACE_NAMES = { sun: 'the Sun', mercury: 'Mercury', venus: 'Venus', earth: 'Earth', moon: 'the Moon', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto', comet: 'a comet', blackhole: 'the black hole' };
/** The Reef: on, under, in and next to (items are the Polish words that were asked). */
export const POSITION_SKILLS = [['position', 'where it is']];
export const POSITION_ITEMS = ['na', 'pod', 'w', 'obok'];
/** The Port: the boat names she splits into syllables. */
export const SYLLABLE_SKILLS = [['syllables', 'splits into syllables']];
export const SYLLABLE_ITEMS = BOATS.map((b) => b.word);
/** The Garage: shapes, what comes next in a row, sorting by colour or size (items: what was asked). */
export const GARAGE_SKILLS = [['shape', 'shape'], ['pattern', 'pattern'], ['sorting', 'sorting']];
/** The items a skill group has actually met (names and Garage items aren't a fixed list). */
export const metItems = (skills, list) => [...new Set(list.flatMap(([skill]) => Object.keys(skills?.[skill] || {})))];
const COMPARE_WORDS = { more: 'more', less: 'less', same: 'the same' };
const LABEL = Object.fromEntries([...LETTER_SKILLS, ...NUMBER_SKILLS, ...COMPARE_SKILLS, ...WORD_SKILLS, ...GARAGE_SKILLS, ...SPACE_SKILLS, ...POSITION_SKILLS, ...SYLLABLE_SKILLS]);

/** How an item reads for a grown-up: 4, B, "less (with numbers)". */
export function itemLabel(skill, item) {
  const s = String(item);
  if (skill === 'space') return SPACE_NAMES[s] || s;
  if (skill === 'position') return s;
  if (skill === 'syllables') return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (skill === 'sequence' && s.startsWith('space:')) return `after ${SPACE_NAMES[s.slice(6)] || s.slice(6)}`;
  if (skill === 'comparison') return `${COMPARE_WORDS[s.replace('#', '')] || s}${s.endsWith('#') ? ' (with numbers)' : ''}`;
  return /^\d+$/.test(s) ? s : showLetter(s);
}

/**
 * How often a pure guess is right first time, per skill, from how the missions ask (GAME.md "choices"):
 * three things to pick from for letters and numbers, two for order and more/less. Giving a number of treats
 * can't be guessed. (An estimate: the saved stats don't keep how many options each question had.)
 */
// Telescope has two or three choices; use 1 / 3 like letters for the per-skill estimate.
export const GUESS = { space: 1 / 3, position: 1 / 3, syllables: 1 / 3, letterVisual: 1 / 3, letterAudio: 1 / 3, letterSound: 1 / 3, numeral: 1 / 3, quantity: 1 / 3, counting: 0, sequence: 1 / 2, comparison: 1 / 2, wordVisual: 1 / 3, shape: 1 / 3, pattern: 1 / 3, sorting: 1 / 2 };

/** Fewer answers than this: shown, but marked as "not much to go on yet". */
export const FEW = 3;

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

/** How her solves went, apart: right first time, right after a wrong tap, right after a clue or the answer shown. */
export function solves(stat) {
  const solved = stat.solved || 0, firstTry = stat.firstTry || 0, helped = stat.helped || 0;
  return { solved, firstTry, afterError: Math.max(0, solved - firstTry - helped), helped };
}

/** "2 first try, 1 after help": the kinds of solve she had, with how many of each. */
export const solvesHow = (s) => [[s.firstTry, 'first try'], [s.afterError, 'after an error'], [s.helped, 'after help']]
  .filter(([n]) => n).map(([n, how]) => `${n} ${how}`).join(', ');

/** A row's solves in words. Solves before these counts began (an older save) show only in mastery. */
export function solvedText(row) {
  if (row.solved) return `${row.solved} solved (${solvesHow(row)})`;
  return row.attempts ? 'solved before these counts began' : 'not solved yet';
}

/** One skill + item, in parent terms. null when it never came up. */
export function summarize(stat) {
  if (!stat || !(stat.solved || stat.attempts || stat.wrong || stat.timeouts)) return null;
  const confusions = Object.entries(stat.confusions || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  return {
    mastery: stat.mastery || 0,
    attempts: stat.attempts || 0,
    ...solves(stat),
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
  let attempts = 0, firstTry = 0, assisted = 0, latSum = 0, latN = 0, chance = 0;
  const all = [], solved = { solved: 0, firstTry: 0, afterError: 0, helped: 0 };
  for (const [skill, items] of Object.entries(skills || {})) {
    for (const [item, s] of Object.entries(items)) {
      for (const [k, n] of Object.entries(solves(s))) solved[k] += n;
      attempts += s.attempts || 0;
      chance += (s.attempts || 0) * (GUESS[skill] ?? 1 / 3);
      firstTry += s.correctFirstTry || 0;
      assisted += s.assisted || 0;
      if (s.avgLatencyMs && s.attempts) { latSum += s.avgLatencyMs * s.attempts; latN += s.attempts; }
      all.push({ skill, item, name: itemLabel(skill, item), label: LABEL[skill] || skill, mastery: s.mastery || 0, lastSeenAt: s.lastSeenAt || 0, kind: categorize(s) });
    }
  }
  return {
    attempts,
    solves: solved, // every solve, scored or not
    firstTryPct: pct(firstTry, attempts),
    chancePct: pct(chance, attempts), // what guessing alone would get right first time, on the same questions
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

/** Play sessions in parent terms (from progress.sessions). */
export function sessionStats(sessions, now = Date.now()) {
  const recent = sessions?.recent || [];
  const mins = recent.map((s) => Math.max(0, (s.endedAt - s.startedAt) / 60000)).filter((m) => m > 0);
  const week = recent.filter((s) => now - s.startedAt < 7 * 86_400_000).length;
  return {
    count: sessions?.count || 0,
    avgMinutes: mins.length ? Math.round((mins.reduce((a, b) => a + b, 0) / mins.length) * 10) / 10 : null,
    lastWeek: week,
    finales: recent.filter((s) => s.finale).length,
    early: recent.filter((s) => s.early).length,
  };
}

/** The biggest mastery changes in the last few sessions (each session saves what moved). */
export function recentChanges(sessions, { last = 3, top = 6 } = {}) {
  const changes = (sessions?.recent || []).slice(-last).flatMap((s) => s.changes || []);
  const byKey = new Map();
  for (const c of changes) {
    const k = c.skill + '|' + c.item;
    const prev = byKey.get(k);
    byKey.set(k, prev ? { ...prev, to: c.to } : { ...c }); // earliest "from", latest "to"
  }
  return [...byKey.values()]
    .map((c) => ({ ...c, name: itemLabel(c.skill, c.item), label: LABEL[c.skill] || c.skill, delta: Math.round((c.to - c.from) * 100) / 100 }))
    .filter((c) => Math.abs(c.delta) >= 0.05)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, top);
}

/** Total answers that needed some help (all skills). */
export function totalAssisted(skills) {
  let n = 0;
  for (const items of Object.values(skills || {})) for (const s of Object.values(items)) n += s.assisted || 0;
  return n;
}

/** Letters no question has asked yet (in any letter skill). */
export function neverAsked(skills, letters) {
  return [...letters].filter((l) => !LETTER_SKILLS.some(([skill]) => summarize(skills?.[skill]?.[l])));
}

/**
 * Whether she has played a place: a badge is a finished run, a start is any time she went in. A save from before
 * starts were recorded (older) cannot tell a place she never went into from one she left, so it says less.
 */
export function placeLabel({ runs = 0, starts = 0, older = false }) {
  if (runs) return 'Completed';
  if (starts) return 'Started';
  return older ? 'Not completed yet' : 'Not started';
}

/**
 * One mission for the grown-ups. saved: its record { level, good, lastAcc } (progress.js; may be missing),
 * runs: badges earned, starts: times she went in (progress.getVisited), older: the save predates start records,
 * need: good runs per level, gentle: is the next run gentler (progress.assistFor).
 */
export function missionStatus({ level = 1, max = 1, good = 0, lastAcc = null, runs = 0, starts = 0, older = false, need = 2, gentle = false }) {
  const top = level >= max;
  return {
    level, max, top, gentle,
    played: placeLabel({ runs, starts, older }),
    next: top ? 'top level' : `${Math.min(good, need)} of ${need} good runs to the next star`,
    last: runs && lastAcc != null ? `last run ${Math.round(lastAcc * 100)}% right first time` : null,
  };
}
