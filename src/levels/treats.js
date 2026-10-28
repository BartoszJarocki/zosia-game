// Treat House: which kind of round comes when, and how the bowl's treats lie. Pure, so it is testable.

/**
 * The kinds of round for one mission, in play order. Every kind comes up (when there are rounds enough),
 * never the same kind twice in a row (when there is any other choice), and the last round is one of the
 * easy kinds, so the mission ends on a happy win.
 *   types: the level's round kinds · rounds: how many · easy: kinds that make a good ending
 */
export function roundOrder(types, rounds, { easy = [], random = Math.random } = {}) {
  const kinds = [...new Set(types)];
  if (rounds <= 0 || !kinds.length) return [];
  const ends = kinds.filter((k) => easy.includes(k));
  const last = ends.length ? ends[Math.floor(random() * ends.length)] : null;
  const pick = (list) => list[Math.floor(random() * list.length)];
  // every other kind once, shuffled (all different, so no repeats among them)…
  const seq = kinds.filter((k) => k !== last);
  for (let i = seq.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]]; }
  const body = last ? rounds - 1 : rounds;
  seq.length = Math.min(seq.length, body);
  // …then extra rounds go wherever they don't sit next to their own kind
  while (seq.length < body) {
    const fits = [];
    for (const k of kinds) for (let at = 0; at <= seq.length; at++) {
      const after = at === seq.length ? last : seq[at];
      if (seq[at - 1] !== k && after !== k) fits.push([k, at]);
    }
    const [k, at] = fits.length ? pick(fits) : [pick(kinds), seq.length];
    seq.splice(at, 0, k);
  }
  return last ? [...seq, last] : seq;
}

/** Where 1–4 treats lie on the bowl's plate (x, z): the patterns of a die, seen at a glance without counting. */
export const DICE = {
  1: [[0, 0]],
  2: [[-0.45, 0], [0.45, 0]],
  3: [[-0.45, -0.24], [0.45, -0.24], [0, 0.26]],
  4: [[-0.45, -0.24], [0.45, -0.24], [-0.45, 0.26], [0.45, 0.26]],
};
