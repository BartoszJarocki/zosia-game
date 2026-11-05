import { distractors } from './lookalikes.js';

export const COMET_LANES = 5;

const shuffle = (a, random = Math.random) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** The letters in one round: the asked letter `targets` times, the rest wrong ones. */
export function cometLetters({ targets, total, similar, alphabet }, target, pool, random = Math.random) {
  const nOthers = Math.max(0, total - targets);
  const set = distractors(target, pool, Math.min(pool.length - 1, nOthers), similar, alphabet ?? pool);
  return shuffle([
    ...Array(targets).fill(target),
    ...Array.from({ length: nOthers }, (_, i) => set[i % set.length] || target),
  ], random);
}

/** One lane per comet first, then a second comet in some lanes; each lane gets one speed and one offset. */
export function cometPlan({ speed, total }, random = Math.random) {
  const [lo, hi] = speed;
  const order = shuffle(Array.from({ length: COMET_LANES }, (_, i) => i), random);
  return {
    laneOf: Array.from({ length: total }, (_, i) => order[i % COMET_LANES]),
    speeds: Array.from({ length: COMET_LANES }, () => lo + random() * (hi - lo)),
    starts: Array.from({ length: COMET_LANES }, () => random()),
  };
}
