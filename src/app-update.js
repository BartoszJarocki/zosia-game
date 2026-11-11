/**
 * May a downloaded new version replace the running one now? Only where reloading cannot interrupt her: the start
 * screen, or the island with nothing in flight (no swoop, drive or goodnight, no paw wipe, no grown-ups' page).
 * A mission (its celebration included) or a trip is never switched; the next look finds her back on the island.
 */
export function mayUpdateNow({ started, onIsland, busy }) {
  return !started || (onIsland && !busy);
}
