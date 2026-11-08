import { placesIn } from '../places.js';

// The bay: one loop from the island's harbour round to the port.
export const SEA_ORDER = ['island', 'buoy', 'shallows', 'seal', 'lighthouse', 'gulls', 'reef', 'port'];

// at: map position, r: round patch / tap footprint, height: top of the model above the water.
export const BAY_LAYOUT = {
  island: { at: [-20, 0, 15], r: 2.5, height: 2.2 },
  buoy: { at: [-10.5, 0, 17], r: 1.6, height: 1.4 },
  shallows: { at: [0, 0, 15], r: 2.3, height: 0.8 },
  seal: { at: [10, 0, 10], r: 2.1, height: 1.8 },
  lighthouse: { at: [19, 0, 1], r: 2.2, height: 7.4 },
  gulls: { at: [17, 0, -9], r: 2.1, height: 2.6 },
  reef: { at: [7, 0, -18], r: 2.3, height: 1.2 },
  port: { at: [-6, 0, -18], r: 2.4, height: 1.6 },
};

export function checkLayout(kinds = placesIn('sea'), layout = BAY_LAYOUT) {
  for (const kind of kinds) {
    if (!layout[kind]) throw new Error(`Missing sea layout for ${kind}`);
  }
}
checkLayout();
