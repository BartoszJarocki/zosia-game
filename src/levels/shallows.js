// Floats or sinks: the things on the beach and which shelf each belongs to. Pure, so it is testable.
import { shuffle } from '../util.js';

export const THINGS = [
  { id: 'jabłko', name: 'Jabłko', side: 'float' },
  { id: 'piłka', name: 'Piłka', side: 'float' },
  { id: 'kaczka', name: 'Kaczka', side: 'float' },
  { id: 'liść', name: 'Liść', side: 'float' },
  { id: 'klocek', name: 'Klocek', side: 'float' },
  { id: 'kłoda', name: 'Kłoda', side: 'float' },
  { id: 'kamień', name: 'Kamień', side: 'sink' },
  { id: 'klucz', name: 'Klucz', side: 'sink' },
  { id: 'moneta', name: 'Moneta', side: 'sink' },
  { id: 'łyżka', name: 'Łyżka', side: 'sink' },
];

export const FAMILIAR = ['jabłko', 'piłka', 'kaczka', 'kamień', 'klucz', 'łyżka'];

const BY_ID = Object.fromEntries(THINGS.map((thing) => [thing.id, thing]));
export const thingById = (id) => BY_ID[id];
export const familiarThings = () => FAMILIAR.map(thingById);

/**
 * The things one mission uses, in play order. Familiar rounds use only the six everyday things;
 * "all" rounds always include the big log and the little coin, among other things.
 */
export function shallowsPlan({ things = 'familiar', rounds = 4 } = {}, random = Math.random) {
  const pool = things === 'all' ? THINGS : familiarThings();
  const picked = shuffle(pool, random).slice(0, rounds);
  if (things === 'all') {
    for (const id of ['kłoda', 'moneta']) {
      const special = thingById(id);
      if (picked.includes(special)) continue;
      const at = picked.findIndex((thing) => thing.id !== 'kłoda' && thing.id !== 'moneta');
      if (at >= 0) picked[at] = special;
    }
  }
  return shuffle(picked, random);
}
