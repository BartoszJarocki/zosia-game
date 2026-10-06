// Adventure Bay events: little stories on the island that point at a place ("Ojej! Kotek potrzebuje pomocy!").
// They are narrative recommendations, never locks: every place stays tappable, and an event is just a
// friendlier way to say what the session director suggests. Pure, so it is testable.
//
//   id                 mission    when
//   lookout-alarm      lookout    the session's finale is due (the alarm calls everyone to the Lookout)
//   lost-kitten        letters    the director suggests Kitty Park
//   balloons-escaping  balloons   the director suggests Balloon Hill

export const EVENTS = Object.freeze([
  { id: 'lookout-alarm', mission: 'lookout', line: 'eventAlarm', when: ({ step }) => step === 'finale' },
  { id: 'lost-kitten', mission: 'letters', line: 'eventKitten', when: ({ step, suggested }) => step === 'mission' && suggested === 'letters' },
  { id: 'balloons-escaping', mission: 'balloons', line: 'eventBalloons', when: ({ step, suggested }) => step === 'mission' && suggested === 'balloons' },
]);

/**
 * The event to show in the hub now, or null (at most one at a time).
 * @param {{ step: 'mission'|'finale'|'free', suggested: string|null }} ctx  from the session director
 */
export function pickEvent(ctx) {
  return EVENTS.find((e) => e.when(ctx)) || null;
}

export const eventById = (id) => EVENTS.find((e) => e.id === id) || null;

/** Remember a finished event (unique ids, newest last, capped). Mutates world. Returns whether it changed. */
export function recordEvent(world, id, max = 50) {
  if (!eventById(id)) return false;
  const list = world.completedEvents;
  const i = list.indexOf(id);
  if (i !== -1) list.splice(i, 1);
  list.push(id);
  if (list.length > max) list.splice(0, list.length - max);
  return i === -1;
}
