import { placesIn } from '../places.js';

// The bay: one loop from the island's harbour round to the port, sailed counter-clockwise on a ring so the stops can be
// big on an iPad held either way.
export const SEA_ORDER = ['island', 'buoy', 'shallows', 'seal', 'lighthouse', 'gulls', 'reef', 'port'];

// at: map position, r: round pad / tap footprint, height: top of the model above the water.
// A stop's picture is about 2 r wide. The far (top) row is drawn larger: the map is seen from the south, so it is farther away.
export const BAY_LAYOUT = {
  island: { at: [-11, 0, 10], r: 3.3, height: 4.3 },
  buoy: { at: [0, 0, 14], r: 3, height: 5.6 },
  shallows: { at: [11, 0, 10], r: 3.2, height: 3.1 },
  seal: { at: [15.5, 0, 0], r: 3.3, height: 3.8 },
  lighthouse: { at: [11, 0, -10], r: 3.7, height: 10.4 },
  gulls: { at: [0, 0, -14], r: 3.8, height: 5.4 },
  reef: { at: [-11, 0, -10], r: 3.6, height: 3.6 },
  port: { at: [-15.5, 0, 0], r: 3.6, height: 3.3 },
};

export function checkLayout(kinds = placesIn('sea'), layout = BAY_LAYOUT) {
  for (const kind of kinds) {
    if (!layout[kind]) throw new Error(`Missing sea layout for ${kind}`);
  }
}
checkLayout();
