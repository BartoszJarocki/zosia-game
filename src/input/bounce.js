// A small finger often lands twice (70 ms apart in a probe). The second landing is not a second tap: counted, it
// was a second treat, a second "no" and the next step of help. One rule for every tap, right or wrong, so a scene
// needs no guard of its own and an honest second tap (a moment later, or somewhere else) always counts.

export const BOUNCE = { ms: 120, px: 40 };

/** Is this landing the last one again? Landings: { t (ms), x, y (px) }; last is null before the first. */
export const isBounce = (last, next) =>
  Boolean(last) && next.t - last.t < BOUNCE.ms && Math.hypot(next.x - last.x, next.y - last.y) < BOUNCE.px;

let last = null;
/** A pointerdown that is a new tap (false: the same finger landing again). Shared by the canvas and the lift panel. */
export function freshTap(e) {
  const landing = { t: e.timeStamp, x: e.clientX, y: e.clientY };
  const fresh = !isBounce(last, landing);
  last = landing;
  return fresh;
}
