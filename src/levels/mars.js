/** Every number a Mars round may ask about. */
export const marsPool = (max) => Array.from({ length: max }, (_, i) => i + 1);

/** Matching numerals is numeral; counting dots or listening for the number is quantity. */
export const marsSkill = (ask) => (ask === 'dots' || ask === 'name' ? 'quantity' : 'numeral');

/** What the speech bubble shows: [big numeral, dots]. */
export function marsBubble(ask, target) {
  return { both: [String(target), target], numeral: [String(target), 0], dots: ['', target], name: ['', 0] }[ask];
}

