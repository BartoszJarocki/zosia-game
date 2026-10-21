// The River's stepping stones, row by row from her bank to Chase's. Row k holds the next number (k + 1) beside
// one or two others, all one hop ahead of the last stone, so only the number says which one to step on.
// Pure (rng passed in): tests/levels/river.test.js checks the layouts, tools/playtest/river-census.mjs counts hops.

export const START = { x: 0, z: 5.6 };   // her bank (scenes/stones.js stands her here)
export const LAND = { x: 3.3, z: -5.3 }; // beside Chase on the far bank
const NEAR_Z = 3.1, FAR_Z = -3.9;        // the first and the last row, between the banks
const STONE_R = 0.95;                    // models.js makeStone at scale 1
export const SIDEWAYS = 1.4;             // a hop goes at most this far sideways per step forward
// What is on screen on a 4:3 iPad and wider, and the corner the left-docked speech bubble hides
// (both measured with tools/playtest/bubble-zone.mjs)
const halfWidth = (z) => 7.3 + (0.6 - z) * 0.32;
const UNDER_BUBBLE = { z: -1.9, x: -3.9 };

const shuffle = (a, rng) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** The other numbers in a row: "far" ones are easy to tell apart (2+ away), "near" ones are the neighbours. */
export function foilsFor(t, count, foils, n, rng = Math.random) {
  const top = Math.max(n + 1, 4);
  const pool = foils === 'near'
    ? [...shuffle([t - 1, t + 1], rng), ...shuffle([t - 2, t + 2], rng)].filter((f) => f >= 1)
    : shuffle(Array.from({ length: top }, (_, i) => i + 1).filter((f) => Math.abs(f - t) >= 2), rng);
  const spare = Array.from({ length: top + 2 }, (_, i) => i + 1).filter((f) => f !== t && !pool.includes(f)); // a short river: not enough far ones
  return [...pool, ...spare].slice(0, count);
}

/**
 * { scale, rows: [{ z, stones: [{ x, z, num, right }] }] }: n rows, nearest first. Stone k of the path is
 * row k's right one. Every hop (her bank → row 0 → … → the far bank) goes forward, at most SIDEWAYS to the side.
 */
export function riverRows({ n, choices = 2, foils = 'far', rng = Math.random }) {
  const gap = (NEAR_Z - FAR_Z) / (n - 1);
  const scale = Math.min(1, Math.max(0.62, gap / 2.1));
  const r = STONE_R * scale, step = 2 * r + 0.45;
  const fits = (x, z) => Math.abs(x) + r <= halfWidth(z) && !(z - r < UNDER_BUBBLE.z && x - r < UNDER_BUBBLE.x);
  const behind = 0.45 + 0.6 * r; // she hides the ground right behind her (up to ~1.6 deep): keep every number out of there
  const offset = (j) => (j - (choices - 1) / 2) * step;
  const line = (z) => START.x + (LAND.x - START.x) * (START.z - z) / (START.z - LAND.z); // straight to Chase
  const rows = [];
  let from = START;
  for (let k = 0; k < n; k++) {
    const z = NEAR_Z - k * gap, last = k === n - 1;
    const reach = SIDEWAYS * (from.z - z) * 0.97; // (a little under, so rounding never tips a hop over)
    const onward = SIDEWAYS * (z - LAND.z) * (last ? 0.97 : 0.85); // she can still get to Chase from here
    const lo = Math.max(from.x - reach, LAND.x - onward), hi = Math.min(from.x + reach, LAND.x + onward);
    let pick = null;
    for (const idx of shuffle([...Array(choices).keys()], rng)) {
      const want = line(z) + offset(idx) + (rng() - 0.5) * 0.8; // the row sits across the way, the right one anywhere in it
      const xs = [];
      for (let x = lo; x <= hi + 1e-9; x += 0.05) xs.push(x);
      xs.sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
      const x = xs.find((x) => [...Array(choices).keys()].every((j) => { const sx = x - offset(idx) + offset(j); return fits(sx, z) && Math.abs(sx - from.x) >= behind + 0.01; }));
      if (x !== undefined) { pick = { idx, x }; break; }
    }
    if (!pick) throw new Error(`river: no room for row ${k + 1} of ${n} with ${choices} stones`);
    const others = foilsFor(k + 1, choices - 1, foils, n, rng);
    const stones = [...Array(choices).keys()].map((j) => {
      const num = j === pick.idx ? k + 1 : others.pop();
      return { x: +(pick.x - offset(pick.idx) + offset(j)).toFixed(2), z: +z.toFixed(2), num, right: j === pick.idx };
    });
    rows.push({ z: +z.toFixed(2), stones });
    from = stones[pick.idx];
  }
  return { scale, rows };
}
