// Saturn's pieces and holes as data: which kind comes next, how big it is, and which hole in which ring it fills.
// Pure (rng passed in), so tests/levels/saturn.test.js checks the rules and scenes/saturn.js only draws what this decides.
import { shuffle } from '../util.js';

export const KINDS = ['ice', 'rock'];
/** How big a piece is drawn: big pieces are twice the small ones, so the size reads on its own. */
export const SCALE = { same: 1, big: 1.1, small: 0.55 };

const sizesOf = (n, sizes) => (sizes === 'mixed'
  ? [...Array(Math.ceil(n / 2)).fill('big'), ...Array(Math.floor(n / 2)).fill('small')]
  : Array(n).fill('same'));

/**
 * The pieces in the order they float in: [{ kind, size }]. Both kinds always come, their counts differ by at most
 * one, and no three of a kind are ever in a row. With mixed sizes each kind gets its own share of big and small, so
 * size never tells her the kind, and the same kind and size never come twice in a row, so copying the last answer
 * never works.
 */
export function saturnPieces({ pieces, sizes }, random = Math.random) {
  const left = new Map();
  KINDS.forEach((kind, i) => sizesOf(i ? Math.floor(pieces / 2) : Math.ceil(pieces / 2), sizes).forEach((size) => {
    const key = `${kind}:${size}`;
    left.set(key, (left.get(key) || 0) + 1);
  }));
  const order = [];
  const place = () => {
    if (order.length === pieces) return true;
    const last = order.at(-1), before = order.at(-2), kindOf = (key) => key?.split(':')[0];
    const open = shuffle([...left.keys()].filter((key) => left.get(key) > 0
      && !(kindOf(last) === kindOf(key) && kindOf(before) === kindOf(key))
      && !(sizes === 'mixed' && last === key)), random);
    for (const key of open) {
      order.push(key);
      left.set(key, left.get(key) - 1);
      if (place()) return true;
      order.pop();
      left.set(key, left.get(key) + 1);
    }
    return false;
  };
  place();
  return order.map((key) => { const [kind, size] = key.split(':'); return { kind, size }; });
}

/** The hole a piece fills: its ring's hole (sort `kind`), or its ring's big or small hole (sort `both`). */
export const slotOf = ({ kind, size }, sort) => (sort === 'both' ? `${kind}:${size}` : kind);

const FRONT = -Math.PI / 2, SIDE = 0.75;
/**
 * The holes, one per answer: { key, kind, size, angle, width, tap: [from, length] }, angles in the ring's own plane
 * (FRONT faces her). Sort `kind`: one hole at the front of each ring, and the whole ring takes the tap. Sort `both`:
 * each ring has a big hole at the front left and a small one at the front right, the same length on both rings, and
 * the half ring around a hole takes its taps.
 */
export function saturnSlots(sort) {
  if (sort !== 'both') return [
    { key: 'ice', kind: 'ice', size: null, angle: FRONT, width: 0.95, tap: [0, Math.PI * 2] },
    { key: 'rock', kind: 'rock', size: null, angle: FRONT, width: 1.05, tap: [0, Math.PI * 2] },
  ];
  const width = { ice: { big: 0.95, small: 0.5 }, rock: { big: 0.67, small: 0.35 } };
  return KINDS.flatMap((kind) => [
    { key: `${kind}:big`, kind, size: 'big', angle: FRONT - SIDE, width: width[kind].big, tap: [Math.PI / 2, Math.PI] },
    { key: `${kind}:small`, kind, size: 'small', angle: FRONT + SIDE, width: width[kind].small, tap: [-Math.PI / 2, Math.PI] },
  ]);
}

const TAU = Math.PI * 2;
/**
 * The slot whose band holds a point of the ring plane, or null in a gap or off the rings. The point is (x, z) around
 * Saturn's middle, x to her right and z toward her. A slot is { key, radii: [inner, outer], arc: [from, length] }: the
 * band the scene draws and takes a tap on (`arc` is the slot's `tap`).
 */
export function slotAtPoint(slots, x, z) {
  const radius = Math.hypot(x, z), angle = Math.atan2(-z, x);
  const hit = slots.find((slot) => radius >= slot.radii[0] && radius <= slot.radii[1] && (((angle - slot.arc[0]) % TAU) + TAU) % TAU <= slot.arc[1]);
  return hit?.key ?? null;
}
