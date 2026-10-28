// Decides which letter / number to ask next, from mastery. Pure (rng and clock injectable).
// Intent from the roadmap: mostly things she is learning, plenty of easy wins, a few hard ones,
// a little new — and never the same item over and over. While much of a pool is still unseen (a new level
// with 22 letters), unseen items get about that share of turns, so she meets them all within a few runs.

/** Target share of each kind of item (renormalised over the kinds that exist). */
export const MIX = Object.freeze({ learning: 0.5, familiar: 0.3, difficult: 0.15, new: 0.05 });

/** Which bucket an item is in, from its SkillStat (or undefined when never seen). */
export function categorize(stat) {
  if (!stat || !stat.attempts) return 'new';
  if (stat.mastery >= 0.75) return 'familiar';
  if (stat.attempts >= 3 && stat.mastery < 0.3) return 'difficult';
  return 'learning';
}

function weightedPick(items, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

/**
 * @param {object} p
 * @param {Array<string|number>} p.candidates  allowed items (e.g. the level's letter pool)
 * @param {Record<string, import('./mastery.js').SkillStat>} [p.stats]  skills[skill]
 * @param {Array<string>} [p.recent]   recently asked items for this skill, oldest first
 * @param {number} [p.now]             epoch ms
 * @param {() => number} [p.rng]
 * @param {object} [p.mix]             override MIX (e.g. { familiar: 1 } for an easy "one more")
 * @returns {string}
 */
export function pickLearningItem({ candidates, stats = {}, recent = [], now = Date.now(), rng = Math.random, mix = MIX }) {
  const all = [...new Set(candidates.map(String))];
  if (all.length <= 1) return all[0];
  const last = recent[recent.length - 1];
  const pool = all.filter((c) => c !== last); // never twice in a row

  const groups = { learning: [], familiar: [], difficult: [], new: [] };
  for (const c of pool) groups[categorize(stats[c])].push(c);
  const window = recent.slice(-4);
  const bucketWindow = recent.slice(-5);
  const beforeLast = recent[recent.length - 2];
  // asked recently → less likely; the item from two picks ago much less (breaks "A B A B" ping-pong)
  const freshness = (c) => Math.pow(0.3, bucketWindow.filter((x) => x === c).length) * (c === beforeLast ? 0.25 : 1);
  // a bucket whose items were all just asked gives way (stops "T I T I T I" when a bucket is small)
  const kinds = Object.keys(groups).filter((k) => groups[k].length && (mix[k] ?? 0) > 0);
  const kindWeight = (k) => mix[k] * (groups[k].reduce((sum, c) => sum + freshness(c), 0) / groups[k].length);
  const kindWeights = kinds.map(kindWeight);
  const iNew = kinds.indexOf('new'), unseen = groups.new.length / pool.length;
  if (iNew !== -1 && unseen < 1) {
    const rest = kindWeights.reduce((a, b) => a + b, 0) - kindWeights[iNew];
    kindWeights[iNew] = Math.max(kindWeights[iNew], (rest * unseen) / (1 - unseen)); // new's share ≈ the unseen share
  }
  const kind = kinds.length ? weightedPick(kinds, kindWeights, rng) : null;
  const options = kind ? groups[kind] : pool;

  const weights = options.map((c) => {
    const s = stats[c];
    let w = 1;
    const seen = window.filter((x) => x === c).length;
    w *= Math.pow(0.25, seen) * (c === beforeLast ? 0.25 : 1);     // asked recently → much less likely
    if (s?.lastSeenAt) w *= 1 + Math.min(1, (now - s.lastSeenAt) / 86_400_000); // not seen for a day → up to 2×
    if (s && kind !== 'familiar') w *= 0.3 + (1 - s.mastery);      // weaker → a bit more often
    return w;
  });
  return weightedPick(options, weights, rng);
}
