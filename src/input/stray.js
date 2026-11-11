// A tap that lands on nothing goes to the nearest thing she can tap, if one is close enough.
// The radius is a share of the screen's short side. The island asks for less, so a tap on the sea
// near the lighthouse does not start a drive to a place on the other side of the screen.

export const STRAY = { missions: 0.14, island: 0.05 };

/** spots: [{ x, y, target }] in screen pixels. The target of the nearest spot inside the radius, else null. */
export function strayTarget(spots, tap, shortSide, share = STRAY.missions) {
  let best = share * shortSide, hit = null;
  for (const s of spots) {
    const d = Math.hypot(s.x - tap.x, s.y - tap.y);
    if (d < best) { best = d; hit = s.target; }
  }
  return hit;
}
