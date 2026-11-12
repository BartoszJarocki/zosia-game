# G4 · The Mars Rover

Goal for Zosia: the bubble does not hand her the number in the levels where she is meant to know it, and the rover
never stands in front of the rocks she has to choose from.

## What she sees and does, per level

| Level | numbers | rocks | the bubble | how it is asked |
|---|---|---|---|---|
| 1 | 1-3 | numeral and dots | the numeral and its dots (`match`) | "Jedziemy do kamienia z numerem dwa!" |
| 2 | 1-5 | numeral and dots | the numeral and its dots (`match`) | same |
| 3 | 1-5 | numeral | only the rover (`name`) | same, she knows the numeral by its name |
| 4 | 1-6 | numeral | the dots (`dots`): count them | "Policz kropki! Do którego kamienia jedziemy?" |
| 5 | 1-9, four rocks | numeral | only the rover (`name`) | the number is spoken |

Levels 1 and 2 are the same task as Cone Road 1-3: find the same numeral. They are `match`, which the play check
accepts for a bubble that shows the number. Level 2 now also shows the dots on the rocks (they did not), so levels 2
and 3 no longer repeat each other. Level 3 was a numeral match; it is now the first level where she knows the number
by its name.

Help: a wrong rock shakes, "Nie, to nie ten." and the question again. The clue lights the dots in the bubble one by one
(`match`, `dots`) or shows the dots for a number that was only spoken (`name`). The answer pulses last.

## The rover

```
 before (round 2 and 3)               now
 [rock][rock][rock]                   [rock][rock][rock]
 [rover]  <- parks in front of rock    [rover] back at the start, left of every rock
```

After the scan the rover drives back to the start while the rocks roll away (0.6 s, at the same time, so no wait is
added). The next round's rocks come in clear of it.

## What changes from today
- `GAME.md` Mars section and the `ask` values (`match`, `dots`, `name`, replacing `both` and `numeral`).
- Level 2 rocks show dots, level 3 is `name`.
- Scene: the rover drives back to the start after each round; the clue for a `match` level lights the bubble's dots.
- The gentler run shows numeral and dots (`match`, rocks `both`), one rock fewer, as before.
- Voice: none.
