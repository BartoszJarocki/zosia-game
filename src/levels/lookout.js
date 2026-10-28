// The Lookout's rides as plain numbers (no scene, so node tests can call them): where each ride may go.
// Floors are 1…N; the car starts on the ground (0).

const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

/** Floors a kitten can wait on: not where the car is, and not one already visited while fresh floors are left. */
export function kittenFloors(pool, here, visited) {
  const fresh = pool.filter((f) => f !== here && !visited.includes(f));
  return fresh.length ? fresh : pool.filter((f) => f !== here);
}

/** One floor up or one floor down from here, inside the building. */
export const nextDoor = (here, N) => [here + 1, here - 1].filter((f) => f >= 1 && f <= N);

/**
 * Where the die can send the car: lo…hi floors up from here, always leaving room for the rides still to come
 * (each of them goes up at least lo floors).
 */
export function diceFloors(here, N, ridesAfter, [lo, hi]) {
  const top = Math.min(here + hi, N - ridesAfter * lo);
  return top >= here + lo ? range(here + lo, top) : [Math.min(N, here + lo)];
}
