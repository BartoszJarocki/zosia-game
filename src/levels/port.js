import { shuffle } from '../util.js';

/** The port's boats, with the syllables she toots. */
export const BOATS = [
  { word: 'KOT', syllables: ['KOT'] },
  { word: 'SŁOŃ', syllables: ['SŁOŃ'] },
  { word: 'MEWA', syllables: ['ME', 'WA'] },
  { word: 'FOKA', syllables: ['FO', 'KA'] },
  { word: 'RYBKA', syllables: ['RYB', 'KA'] },
  { word: 'KACZKA', syllables: ['KACZ', 'KA'] },
  { word: 'ŻYRAFA', syllables: ['ŻY', 'RA', 'FA'] },
  { word: 'MOTYLEK', syllables: ['MO', 'TY', 'LEK'] },
  { word: 'BIEDRONKA', syllables: ['BIE', 'DRON', 'KA'] },
];

export const boatFor = (word) => BOATS.find((b) => b.word === word) || BOATS[0];
export const countOf = (word) => boatFor(word).syllables.length;

/** The names whose syllable count is inside the level's range. */
export const namesIn = ([lo, hi]) => BOATS.filter((b) => b.syllables.length >= lo && b.syllables.length <= hi).map((b) => b.word);

/** Three boats with different syllable counts; the asked one is always among them. */
export const whichBoats = (asked, [lo, hi] = [1, 3], random = Math.random) => {
  const counts = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  if (!counts.includes(asked)) counts.push(asked);
  const boats = counts.map((n) => shuffle(BOATS.filter((b) => b.syllables.length === n), random)[0]).filter(Boolean);
  return shuffle(boats, random);
};
