// Uppercase letters that are easy to confuse. Kept apart early, used on purpose later.
const LOOKALIKE = {
  E: 'FB', F: 'EP', M: 'WN', W: 'MV', N: 'MHZ', O: 'CGD', C: 'OG', G: 'CO', P: 'RBF', R: 'PBK', B: 'PRD',
  D: 'OB', I: 'LTJ', L: 'IT', T: 'IL', U: 'OW', K: 'R', H: 'N', Z: 'SN', S: 'Z', J: 'I', A: 'H',
};

export const lookalikes = (l) => [...(LOOKALIKE[l] || '')];

/** Easy to confuse with each other (B and P, E and F…). */
export const isLookalike = (a, b) => lookalikes(a).includes(b) || lookalikes(b).includes(a);
