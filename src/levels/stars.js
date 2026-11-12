// Star Pictures: each picture is a fixed outline with one star on every corner. Joining the stars
// in number order draws it; the last picture of a mission that reaches 7 is always the Wielki Wóz.
export const STAR_COUNTS = [3, 4, 5, 6, 7];

/** How the numerals run along a picture: up from 1, down to 1 (a countdown), or by twos. */
export const ORDERS = ['up', 'down', 'twos'];

/** The numeral on each star of a picture with `count` stars, in the order she joins them. */
export function numerals(order, count) {
  return Array.from({ length: count }, (_, i) => (order === 'down' ? count - i : order === 'twos' ? 2 * (i + 1) : i + 1));
}

export const PICTURES = {
  3: {
    id: 'mountain', closed: true, color: '#93c5fd',
    points: [[0, 1.8], [-1.8, -1.3], [1.8, -1.3]],
  },
  4: {
    id: 'kite', closed: true, color: '#f9a8d4',
    points: [[0, 2], [1.5, 0.4], [0, -1.7], [-1.5, 0.4]],
  },
  5: {
    id: 'house', closed: true, color: '#fcd34d',
    points: [[0, 2], [1.7, 0.7], [1.7, -1.5], [-1.7, -1.5], [-1.7, 0.7]],
  },
  6: {
    id: 'rocket', closed: true, color: '#fca5a5',
    points: [[0, 2.2], [1.2, 0.8], [1.5, -1.6], [0, -1], [-1.5, -1.6], [-1.2, 0.8]],
  },
  7: {
    id: 'dipper', closed: false, color: '#c4b5fd',
    points: [[-1.9, 0.3], [-1.1, 1], [-0.2, 1.5], [0.9, 1.2], [1.7, 0.3], [1.4, -0.8], [0.3, -0.7]],
    fill: [[0.9, 1.2], [1.7, 0.3], [1.4, -0.8], [0.3, -0.7]],
    label: { 1: [0.1, -1.05], 3: [-0.1, -1.05], 4: [1.1, 0] }, // (tiles nudged off the neighbouring stars; the fifth goes beside its star: under it, it would cover the sixth)
  },
};

/** The pictures for a mission, one per round and never repeated. */
export function starRounds({ stars, rounds, order = 'up' }, random = Math.random) {
  const [lo, hi] = stars;
  const pool = STAR_COUNTS.filter((n) => n >= lo && n <= hi);
  const ending = hi >= 7 && order === 'up' && rounds > 0 ? 7 : null;
  const rest = pool.filter((n) => n !== ending);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const plan = rest.slice(0, rounds - (ending ? 1 : 0));
  if (ending) plan.push(ending);
  return plan;
}
