// Level gates: some levels open on skill, not on the number of runs (GAME.md "needs" column).
// e.g. Kitty Park level 6 (letter sounds) has `needs: letterAudio 0.4` — it opens once the average
// letterAudio mastery over that level's letters she has been asked is at least 0.4, and she has been asked
// at least half of them. (A letter she never met says nothing about her.) Pure, so it is testable.
import { averageMastery } from '../learning/mastery.js';
import { SKILLS } from '../learning/events.js';

/** "letterAudio 0.6" → { skill: 'letterAudio', min: 0.6 }; "—"/"" → null. Throws on nonsense. */
export function parseNeeds(text) {
  const s = String(text ?? '').trim();
  if (!s || s === '—' || s === '-') return null;
  const m = s.match(/^([A-Za-z]+)\s+(0(?:\.\d+)?|1(?:\.0+)?)$/);
  if (!m) throw new Error(`write it as "<skill> <0–1>", e.g. "letterAudio 0.6" (got "${s}")`);
  if (!SKILLS.includes(m[1])) throw new Error(`unknown skill "${m[1]}" (known: ${SKILLS.join(', ')})`);
  return { skill: m[1], min: Number(m[2]) };
}

const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => String(a + i));

/** The items a level asks about (what its gate is measured over). */
export function gateItems(kind, row) {
  switch (kind) {
    case 'letters': case 'balloons': case 'delivery': return [...new Set([...(row.pool || '')])];
    case 'name': return [...new Set((row.words || []).join(''))];
    case 'cones': case 'lookout': return range(1, row.max);
    case 'stones': return range(1, row.n);
    case 'counting': return range(...(row.give || [1, 1]));
    default: return [];
  }
}

/** May she move up to this level row? (No gate = yes.) */
export function meetsNeeds(skills, kind, row) {
  if (!row?.needs) return true;
  const { skill, min } = row.needs;
  const items = gateItems(kind, row);
  const asked = items.filter((it) => skills?.[skill]?.[it]?.attempts > 0);
  return asked.length > 0 && asked.length * 2 >= items.length && averageMastery(skills, skill, asked) >= min;
}
