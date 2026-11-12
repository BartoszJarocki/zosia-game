# G4 · Mercury's Craters

Goal for Zosia: nothing changes in how it plays. The review found it works; this unit checks that it still passes the
play check after the others changed around it, and fixes only what the check finds.

## What she sees and does, per level

```
   [ bubble: ? 🪨 ]                          ( Chase )
        . ● .                the craters laid out like a die
        ● . ●                (levels 3-5: they show for 2 s, then pink dust)
        . ● .
      [ 2 ] [ 3 ] [ 4 ]      number tiles (numeral, and dots on levels 1-3)
```

| Level | craters | shown | tiles |
|---|---|---|---|
| 1 | 1-3 | stay | numeral and dots |
| 2 | 1-4 | stay | numeral and dots, wrong tiles are neighbours |
| 3 | 1-4 | quick look | numeral and dots |
| 4 | 2-5 | quick look | numeral |
| 5 | 3-6 | quick look | numeral, four tiles |

The bubble never shows the answer. A wrong tile bounces, "Popatrz jeszcze raz." and the question again, nothing more.
The clue counts the craters by lighting them one by one; the answer pulses last.

## What changes from today
Nothing in the code or `GAME.md`. The play check of every level (fast, wrong-first, and mash on levels 1 and 5) passes
all three rules on the current base: every tap answers (no silent tap), the bubble is `?` and a stone at every level
and one wrong tile shows nothing more than "no" and the question again, and the wait from a right answer to the next
question is 1.4 s on the stay levels and 2.0 to 2.1 s on the quick-look levels. The review's other Mercury findings
(N7, N8, N12) were closed by the shared help ladder and the pacing work already on `main`: the right tile can be tapped
at once after a wrong one, the clue's count stops when she answers, and "Szybkie oko! Patrz!" is said before the craters
show.

The contact sheets of levels 1 and 3 were read: the craters are dark discs on a pale patch, the tiles carry big numerals.
