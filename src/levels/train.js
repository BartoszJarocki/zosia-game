// Name Train choices that don't need three.js (tested in tests/levels/train.test.js).

/** Fisher–Yates with an injectable rng (so the tests can pin the choices). */
function shuffle(a, rng) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** After any other word, her own name comes next this often (so about one run in three is hers). */
const NAME_NEXT = 0.5;
/** The grown-ups' words: asked right after her own name in `whose`. */
const PARENTS = ['MAMA', 'TATA'];

/** The next word: never the one just played, her own name often (and first), the others evenly. */
export function pickWord(words, { name, last = null, rng = Math.random }) {
  const pool = words.length > 1 ? words.filter((w) => w !== last) : words;
  const others = pool.filter((w) => w !== name);
  if (pool.includes(name) && (!others.length || last === null || rng() < NAME_NEXT)) return name;
  return others[Math.floor(rng() * others.length)];
}

/**
 * Which wagons arrive empty in `missing` mode: `gaps` of them (one more in a 7–8 letter word, at most 3),
 * always leaving a letter; never side by side when the word is long enough (Z O _ I _, not Z O _ _ A). Sorted.
 */
export function gapsFor(word, gaps, rng = Math.random) {
  const sets = subsets([...word].map((_, i) => i), gapCount(word, gaps));
  const apart = sets.filter((s) => s.every((i, k) => k === 0 || i - s[k - 1] > 1));
  const pool = apart.length ? apart : sets;
  return pool[Math.floor(rng() * pool.length)];
}
/** How many letters are missing from this word (see gapsFor). */
export const gapCount = (word, gaps) => Math.min(gaps + (word.length >= 7 ? 1 : 0), 3, word.length - 1);
const subsets = (items, n) => (n === 0 ? [[]] : items.flatMap((x, i) => subsets(items.slice(i + 1), n - 1).map((s) => [x, ...s])));

/**
 * Extra blocks that are not in the word. similar=false: none looks like any letter of the word (no J next to
 * the I of ZOSIA); similar=true: lookalikes first, on purpose.
 */
export function pickExtras(word, n, { pool, similar = false, isLookalike, rng = Math.random }) {
  const free = shuffle([...pool].filter((l) => !word.includes(l)), rng);
  const looks = free.filter((l) => [...word].some((w) => isLookalike(w, l)));
  const plain = free.filter((l) => !looks.includes(l));
  return (similar ? [...looks, ...plain] : plain).slice(0, n);
}

/**
 * Whose train to find in each `whose` round: her own name first, then MAMA or TATA, then the others
 * (family names). Only words with a whose form are asked. No word twice while others are left.
 */
export function whoseOrder(whose, { name, rounds, rng = Math.random }) {
  const asked = Object.keys(whose);
  const tiers = [asked.filter((w) => w === name), shuffle(asked.filter((w) => PARENTS.includes(w)), rng), shuffle(asked.filter((w) => w !== name && !PARENTS.includes(w)), rng)];
  const out = [];
  for (let r = 0; r < rounds; r++) {
    const tier = tiers.slice(Math.min(r, tiers.length - 1)).find((t) => t.length) || tiers.find((t) => t.length);
    if (!tier) break;
    out.push(tier.shift());
  }
  return out;
}

/** The trains in one `whose` round: the asked word and `others` more from the level's words, shuffled. */
export function whoseTrains(words, asked, others, rng = Math.random) {
  return shuffle([asked, ...shuffle(words.filter((w) => w !== asked), rng).slice(0, others)], rng);
}
