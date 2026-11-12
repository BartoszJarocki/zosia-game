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

// The camera (scenes/stones.js looks from here) and Zosia's body, to know which ground she hides from the child's
// eye. The camera backs off along the same line on a tall screen, so a landscape and a portrait iPad are both checked.
export const VIEW = { pos: [0, 12.5, 10.5], look: [0, 0, 0.3], minWidth: 16, fov: 42 };
const BODY = { halfX: 0.43, halfZ: 0.5, top: 2.0, onStone: 0.4 }; // measured on the model at scale 0.85, standing on a stone
const GROUND = 0.2;                                               // the stones' tops
const NUMERAL = 0.45;                                             // the part of a stone's radius that must stay in sight
const SCREENS = [1.33, 0.69];                                     // aspect ratios: a 4:3 iPad lying down, an iPad Air standing

/** Where the camera is on a screen of this shape (engine.js frameCamera). */
export function eyeFor(aspect) {
  const [px, py, pz] = VIEW.pos, [lx, ly, lz] = VIEW.look;
  const base = Math.hypot(px - lx, py - ly, pz - lz), need = VIEW.minWidth / (2 * Math.tan((VIEW.fov / 2) * Math.PI / 180) * aspect), k = Math.max(base, need) / base;
  return [lx + (px - lx) * k, ly + (py - ly) * k, lz + (pz - lz) * k];
}
const EYES = SCREENS.map(eyeFor);

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function hull(points) { // Andrew's monotone chain
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]), half = (list) => { const h = []; for (const q of list) { while (h.length > 1 && cross(h.at(-2), h.at(-1), q) <= 0) h.pop(); h.push(q); } return h.slice(0, -1); };
  return [...half(p), ...half(p.reverse())];
}
function distToPolygon(p, poly) {
  let inside = true, best = Infinity;
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ez = b[1] - a[1];
    if (ex * (p[1] - a[1]) - ez * (p[0] - a[0]) < 0) inside = false;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / (ex * ex + ez * ez)));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ez));
  });
  return inside ? 0 : best;
}

/** The ground she hides from the eye, one outline per screen shape, when she stands on the stone `at` (a bank: the ground). */
export function hiddenGround(at, bank = false) {
  const y0 = bank ? 0 : BODY.onStone, corners = [];
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) for (const y of [y0, y0 + BODY.top]) corners.push([at.x + dx * BODY.halfX, y, at.z + dz * BODY.halfZ]);
  return EYES.map((e) => hull(corners.map(([x, y, z]) => { const k = (e[1] - GROUND) / (e[1] - y); return [e[0] + (x - e[0]) * k, e[2] + (z - e[2]) * k]; })));
}

/** Is the numeral of a stone (radius r) in plain sight, not behind her? hidden: hiddenGround() of where she stands. */
export const inSight = (stone, hidden, r) => hidden.every((outline) => distToPolygon([stone.x, stone.z], outline) >= NUMERAL * r);

const shuffle = (a, rng) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Where row stones can reach in the first and the last row (x, edges included), so the reeds on each bank stay
// clear of them (river.test.js checks every level and its gentler run against these).
export const KEEP_CLEAR = { near: [-2.6, 4.5], far: [-4, 8.7] };

/**
 * The wrong stone of a "missing" river ("1 2 ? 4"): `near` is a neighbour of the gap (2 or 4: it could fit, only
 * the order says no, and the smaller one is right only half the time); `far` is past the end (5 or 6: never fits).
 */
export function missingFoil(missing, n, foils, rng = Math.random) {
  if (foils === 'near') return rng() < 0.5 ? missing - 1 : missing + 1;
  return n + 1 + Math.floor(rng() * 2);
}

/** The gentler run after a rough one: the same kind of river with less to tell apart. */
export function gentler(s) {
  if (s.bubble === 'missing') return { ...s, foils: 'far' };
  return { ...s, bubble: 'numeral', n: Math.max(2, s.n - 1), choices: 2, foils: 'far' };
}

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
  const offset = (j) => (j - (choices - 1) / 2) * step;
  const line = (z) => START.x + (LAND.x - START.x) * (START.z - z) / (START.z - LAND.z); // straight to Chase
  const rows = [];
  let from = START;
  for (let k = 0; k < n; k++) {
    const z = NEAR_Z - k * gap, last = k === n - 1;
    const hidden = hiddenGround(from, k === 0); // the ground behind her, where no number may lie
    const reach = SIDEWAYS * (from.z - z) * 0.97; // (a little under, so rounding never tips a hop over)
    const onward = SIDEWAYS * (z - LAND.z) * (last ? 0.97 : 0.85); // she can still get to Chase from here
    const lo = Math.max(from.x - reach, LAND.x - onward), hi = Math.min(from.x + reach, LAND.x + onward);
    let pick = null;
    for (const idx of shuffle([...Array(choices).keys()], rng)) {
      const want = line(z) + offset(idx) + (rng() - 0.5) * 0.8; // the row sits across the way, the right one anywhere in it
      const xs = [];
      for (let x = lo; x <= hi + 1e-9; x += 0.05) xs.push(x);
      xs.sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
      const x = xs.find((x) => [...Array(choices).keys()].every((j) => { const sx = x - offset(idx) + offset(j); return fits(sx, z) && inSight({ x: sx, z }, hidden, r); }));
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
