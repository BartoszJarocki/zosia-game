/** Every number a Mars round may ask about. */
export const marsPool = (max) => Array.from({ length: max }, (_, i) => i + 1);

/** Matching numerals is numeral; counting dots or listening for the number is quantity. */
export const marsSkill = (ask) => (ask === 'dots' || ask === 'name' ? 'quantity' : 'numeral');

/** What the speech bubble shows: [big numeral, dots]. A match shows what the rocks show. */
export function marsBubble(ask, target, rock = 'both') {
  return { match: [String(target), rock === 'both' ? target : 0], dots: ['', target], name: ['', 0] }[ask];
}
