import { shuffle } from '../util.js';
import { distractors } from './lookalikes.js';

export const COMET_LANES = 4;

/** The letters in one round, the asked letter's comets first (`targets` of them), then the wrong ones. */
export function cometLetters({ targets, total, similar, alphabet }, target, pool) {
  const nOthers = Math.max(0, total - targets);
  const set = distractors(target, pool, Math.min(pool.length - 1, nOthers), similar, alphabet ?? pool);
  return [
    ...Array(targets).fill(target),
    ...Array.from({ length: nOthers }, (_, i) => set[i % set.length] || target),
  ];
}

/**
 * Where each comet starts, { lane, phase }, in the order of cometLetters (the asked letter's first): phase is how far
 * round the loop it is, 0 to 1. Every comet flies at one speed, so the spacing set here never changes. The comets
 * sit evenly round the loop and the asked letter's are as far from each other as they can be, so one is always in
 * reach. Two comets in one lane are half a loop apart or more, so they never touch.
 */
export function cometPlan({ speed: [lo, hi], total, targets }, random = Math.random) {
  const lanes = shuffle(Array.from({ length: COMET_LANES }, (_, i) => i), random);
  const offset = random();
  const laneOf = (j) => lanes[j < COMET_LANES ? j : (j + (total >> 1)) % total];
  const apart = Array.from({ length: targets }, (_, i) => Math.round((i * total) / targets));
  const between = shuffle(Array.from({ length: total }, (_, j) => j).filter((j) => !apart.includes(j)), random);
  return {
    speed: lo + random() * (hi - lo),
    comets: [...apart, ...between].map((j) => ({ lane: laneOf(j), phase: (offset + j / total) % 1 })),
  };
}

/**
 * Half the width of the screen at height y on the plane the comets fly in (z = 0), for a screen of this aspect:
 * the same framing the engine gives the view (its pos, look and the width it must keep).
 */
export function skyEdge({ pos, look, minWidth }, aspect, fov, y) {
  const tan = Math.tan((fov / 2) * Math.PI / 180);
  const ahead = [look.x - pos.x, look.y - pos.y, look.z - pos.z];
  const length = Math.hypot(...ahead);
  const back = Math.max(length, minWidth / (2 * tan * aspect));
  const eye = ahead.map((v, i) => [look.x, look.y, look.z][i] - (v / length) * back);
  const depth = ((0 - eye[0]) * ahead[0] + (y - eye[1]) * ahead[1] + (0 - eye[2]) * ahead[2]) / length;
  return depth * tan * aspect;
}
