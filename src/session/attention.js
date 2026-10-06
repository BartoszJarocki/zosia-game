// Attention / tiredness: simple heuristics from how play is going. No AI, no labels about the child —
// just gameplay patterns, compared with how she played at the start of this session:
//   answers getting slower · bursts of random taps · long silences · asking to hear it again · needing more help
// Pure (no timers, no DOM), so it is testable. Thresholds live in CONFIG.attention.

export const ATTENTION = Object.freeze({
  tired: 0.6,       // below this: probably getting tired → no new items, finale after this mission
  finish: 0.35,     // below this: wind down → "one more!", an easy one, celebrate, end
  minQuestions: 5,  // don't judge before this many answers in the session
  window: 5,        // look at the last few answers
  weights: { slow: 0.3, randomTaps: 0.2, timeouts: 0.2, replays: 0.1, help: 0.2 },
});

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const mean = (xs) => (xs.length ? sum(xs) / xs.length : 0);
function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * @param {{ recentQuestions: Array<{ latencyMs: number, assist: number, overTap: number, timeout: number, replays: number }>,
 *           baseline: { latency: number[], assist: number[] } }} s   session (see director.js)
 * @returns {{ score: number, state: 'ok'|'tired'|'finish', factors: Record<string, number>, enough: boolean }}
 */
export function attention(s, opts = {}) {
  const o = { ...ATTENTION, ...opts, weights: { ...ATTENTION.weights, ...opts.weights } };
  const qs = s.recentQuestions || [];
  if (qs.length < o.minQuestions) return { score: 1, state: 'ok', factors: {}, enough: false };
  const recent = qs.slice(-o.window);

  const base = median(s.baseline?.latency || []);
  const factors = {
    // answers taking longer than at the start (30% slower counts a little, 2.5× counts fully)
    slow: base > 0 ? clamp01((median(recent.map((q) => q.latencyMs)) / base - 1.3) / 1.2) : 0,
    randomTaps: clamp01(sum(recent.map((q) => q.overTap || 0)) / 3),
    timeouts: clamp01(sum(recent.map((q) => q.timeout || 0)) / 3),
    replays: clamp01(sum(recent.map((q) => q.replays || 0)) / 4),
    // more help than at the start (a little help is normal, so the start counts as at least 0.5)
    help: clamp01((mean(recent.map((q) => q.assist || 0)) - Math.max(0.5, mean(s.baseline?.assist || []))) / 1.5),
  };
  const score = clamp01(1 - sum(Object.entries(factors).map(([k, f]) => f * (o.weights[k] || 0))));
  const state = score < o.finish ? 'finish' : score < o.tired ? 'tired' : 'ok';
  return { score: Math.round(score * 100) / 100, state, factors, enough: true };
}
