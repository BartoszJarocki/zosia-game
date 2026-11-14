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

/** The syllable train's modes: the word shown in pieces, one piece left on the train, the word said with its picture. */
export const SYLLABLE_MODES = ['match', 'hear', 'build'];

/**
 * One syllable round's wagons. A wagon carries a syllable and sits in a slot of the train, or waits on the grass
 * (slot null). `leave` slots arrive filled; the word's other syllables wait, with `extras` wagons whose syllable the
 * word does not have (from `pool`), shuffled.
 */
export function syllableWagons(syllables, { leave = 0, extras = 0, pool = [], rng = Math.random } = {}) {
  const loaded = shuffle(syllables.map((_, i) => i), rng).slice(0, leave);
  const waiting = syllables.filter((_, i) => !loaded.includes(i));
  const others = shuffle([...new Set(pool)].filter((s) => !syllables.includes(s)), rng).slice(0, extras);
  return [...loaded.map((slot) => ({ syllable: syllables[slot], slot })), ...shuffle([...waiting, ...others], rng).map((syllable) => ({ syllable, slot: null }))];
}

/** The slot to fill next, left to right; -1 when the word is built. */
export const nextSlot = (syllables, wagons) => syllables.findIndex((_, i) => !wagons.some((w) => w.slot === i));

/** A waiting wagon fits the next slot when it carries that slot's syllable: the text decides, so either MA fills either slot. */
const fits = (syllables, wagons, wagon) => wagon.slot === null && wagon.syllable === syllables[nextSlot(syllables, wagons)];

/** Put a waiting wagon into the next slot when it fits. Returns the slot, or -1 with nothing changed. */
export function couple(syllables, wagons, wagon) {
  if (!fits(syllables, wagons, wagon)) return -1;
  wagon.slot = nextSlot(syllables, wagons);
  return wagon.slot;
}

/**
 * The Name Train one notch easier, after a rough run. A syllable level shows the word in pieces with one extra wagon at
 * most: with none, every wagon would be right and the run would win a level by itself.
 */
export function gentler(s) {
  if (SYLLABLE_MODES.includes(s.mode)) return { ...s, mode: 'match', extras: Math.min(s.extras, 1), similar: false };
  return { ...s, ...(s.mode === 'missing' ? { gaps: Math.max(1, (s.gaps ?? 2) - 1), extras: 1 } : { mode: s.mode === 'whose' ? 'whose' : 'ghost', extras: 0 }), similar: false }; // (whose: two trains)
}
