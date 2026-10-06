// Developer tools → the next trip to the island ('lost-kitten' | 'balloons-escaping' | 'finale').
// Kept in sessionStorage so it survives the reload when the page was opened with #parent.
const KEY = 'pup-patrol-dev-next';
export function setDevNext(v) { try { sessionStorage.setItem(KEY, v); } catch {} }
/** Read it once (and forget it). */
export function takeDevNext() {
  try { const v = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); return v; } catch { return null; }
}
