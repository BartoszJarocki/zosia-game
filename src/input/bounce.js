// A small finger often lands twice on the same thing (70 ms apart in a probe). The second landing is not a
// second answer: counted, it was a second "no", a second wrong attempt and the next step of help.

export const BOUNCE_MS = 600;

/** Is this wrong tap the last counted one again, too soon to be meant? last: { chosen, at } or null. */
export const isBounce = (last, chosen, at) => Boolean(last) && last.chosen === chosen && at - last.at < BOUNCE_MS;
