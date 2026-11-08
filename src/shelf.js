import { PLACES } from './places.js';

/** The one badge that stands in for every space game on the island shelf. */
export const ROCKET_BADGE = { label: '🚀', color: '#6d28d9' };
export const BOAT_BADGE = { label: '⛵', color: '#0284c7' };

/** Shelf rows: island games one by one, then one rocket and one boat with the map games added up. */
export function shelfItems(counts = {}) {
  const items = [];
  for (const [kind, place] of Object.entries(PLACES)) {
    if (place.area !== 'island' || !place.game) continue;
    const count = counts[kind] || 0;
    if (count) items.push({ kind, count, badge: place.badge });
  }
  const space = Object.entries(PLACES)
    .filter(([, place]) => place.area === 'space' && place.game)
    .reduce((sum, [kind]) => sum + (counts[kind] || 0), 0);
  if (space) items.push({ kind: 'rocket', count: space, badge: ROCKET_BADGE });
  const sea = Object.entries(PLACES)
    .filter(([, place]) => place.area === 'sea' && place.game)
    .reduce((sum, [kind]) => sum + (counts[kind] || 0), 0);
  if (sea) items.push({ kind: 'boat', count: sea, badge: BOAT_BADGE });
  return items;
}
