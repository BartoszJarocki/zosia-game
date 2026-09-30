export const rand = (n) => Math.floor(Math.random() * n);
export const pick = (arr) => arr[rand(arr.length)];
export function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Pick from pool, avoiding the previous pick when possible. */
export function pickNew(pool, prev) {
  const options = pool.length > 1 ? pool.filter((x) => x !== prev) : pool;
  return pick(options);
}
export const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
