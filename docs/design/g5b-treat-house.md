# Treat House (`counting`), unit G5b (a favourite: the feast keeps its length)

**Fixes:** (1) "too many" in `flash` and `hidden` no longer leaves the answer on the tray. (2) A bone can be tapped only when it lies still. (3) The last help of a `give` round says what is left to do. (4) The gentler run of levels 1 to 3 is no longer the same as the level.

## What she sees and does
```
   [ box ]  pile of treats          [ Chase on his blue tray ]  [ plate + red bowl ]
   (she drags or taps treats over)   rows of five, a ten-frame   flash: lifts 2 s, hidden: one more slides in
   numeral blocks:  [ 2 ] [ 3 ] [ 4 ]   (howMany: she counts the tray, taps the number)
```
L1 to L3 give, count and share with the rings on; L4 adds "you decide when to stop"; L5 adds `flash`, L6 adds `hidden`, L7 and L8 go up to 7 and 10. The feast (Chase eats each treat, counted) is unchanged, and she can tap a treat to feed him.

## What changes from today
- Too many in `flash` and `hidden`: Chase gave back exactly the extra treats, which left the hidden number on the tray, so "give one, tap Chase, copy the row" solved every round. Now every treat hops back ("Oj, za dużo! Oddaję wszystkie smakołyki.") and "Daj Czejsowi tyle samo!" asks again. In `give` the number is in the bubble, so exactly the extra ones still go back.
- howMany: a bone is tappable at once, but a tap while it tumbles in only gets the tick (input/answer.js); it counts after it lands. Before, a hop in mid-air left it hanging.
- give, enough treats given and she waits: the last help said "Tutaj!" with nothing pulsing. It now says "Gotowe? Dotknij Czejsa!".
- Gentler run: auto and rings on, and one off the top of every range (give 1–3 becomes 1–2). Levels 1 to 3 used to repeat themselves.
- Levels 1 to 3 counted one question a run: the automatic give and the share can't be got wrong, so one lucky tap on a numeral was the whole run (G6's guessing check: a blind tapper moved up in 31 to 33% of runs). Their `types` now list `howMany` twice and `rounds` is 4: two counted questions, 10 to 12%. The extra round is a second "how many treats?" with its own feast; the feast keeps its length, the visit gets one round longer. `roundOrder` honours a kind listed twice (never twice in a row, the run still ends on an easy round).
