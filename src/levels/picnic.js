// Where the treats of one blanket (or Chase's plate) lie. Pure, so tests/levels/picnic.test.js can check that no two
// touch: a bone seen from above is a shaft 0.54 long with a knob at each end (models.js makeBone), so it is 0.9 long
// at the size the picnic uses.

export const BONE = { scale: 1.25, half: 0.27 * 1.25, knob: 0.09 * 1.25 }; // size, half the shaft, the knob's radius
export const ROW = 1.05;     // centre to centre along a row: a hand's width between two bones
const ROW_DEPTH = 1.0;       // centre to centre between two rows
const TURN = 0.25;           // how far a bone may lie crooked

/** n spots { x, z, turn }, relative to the middle: neat rows of up to five (one straight row when row is set). */
export function boneSpots(n, { row = false, rng = Math.random } = {}) {
  const perRow = row ? n : n > 4 ? Math.ceil(n / 2) : n;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, n - r * perRow);
    return { x: (col - (inRow - 1) / 2) * ROW, z: (r - 0.5 * (n > perRow ? 1 : 0)) * ROW_DEPTH, turn: row ? 0 : (rng() - 0.5) * 2 * TURN };
  });
}

const INNER = 1.4;           // a lined-up row starts this far from the middle and runs outwards
const LINED_DEPTH = 0.9;     // between two lined-up rows

/** The clue: treat k of n, lined up on its blanket in rows of five. x: outwards from the middle, z: across the blanket's middle. */
export function linedUp(k, n) {
  const rows = Math.ceil(n / 5);
  return { x: INNER + (k % 5) * ROW, z: (Math.floor(k / 5) - (rows - 1) / 2) * LINED_DEPTH };
}
