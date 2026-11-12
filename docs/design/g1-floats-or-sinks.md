# Floats or sinks (D1, with B3's scoring): see the water, guess once

For Zosia at 3.5. She drops things into water and learns that some float and some sink. Before, the water was a pale
band on sand that read as a beach, the shelves were marked by pictures about 20 px wide, level 1 said the answer before
it asked, and a wrong guess was never scored: four wrong guesses of four left a perfect run.

## What she sees

A side view through a glass pool set into the beach. Blue water fills it to a clear white surface line, sand lies on
its bottom. A plank crosses above the water and the thing waits on it. Two big shelves stand on the sand, each under a
large picture of the same pool: a duck sitting on the surface line ("pływa"), a stone lying on the bottom ("tonie").

```
 [bubble]                                              (Chase)
 +-----------+                                    +-----------+
 | ~~~🦆~~~  |            [ apple ]               | ~~~~~~~~  |
 |           |         ===============            |      🪨   |
 +-----------+   +----~~~~~~~~~~~~~~~~~~~~----+   +-----------+
 |  shelf    |   |      blue water            |   |  shelf    |
 |  🍎 ⚽    |   |                            |   |  🔑 🥄    |
 +-----------+   |......... sand .............|   +-----------+
 ~~~~~~~~~ beach ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

A floating thing rests half above the line. A sinking one settles on the sand at the bottom, seen through the blue.

## What she does, per level

| Level | Flow | What changes |
|---|---|---|
| 1 `watch` | "Wrzuć to do wody!" She taps the thing, it drops in and floats or sinks, silently. Then "Pływa czy tonie?" and she taps the shelf for what she saw. Right: "Brawo! Jabłko pływa!" and it hops onto the shelf. | Asks before it tells. Before, it said "Jabłko pływa!" and then asked where to put it. |
| 2 `guess` | "Pływa czy tonie?" before anything happens. She taps a shelf as her guess, then the thing drops in. Right: praise and the name. Wrong: no "no" sound; "Popatrz! Klucz tonie!" and it goes to its shelf. | A wrong guess is scored, once. There is no second try. |
| 3 `surprise` | As level 2, with the big log and the little coin. | The same scoring. |

## The guess is scored once

A guess is a prediction: one try, then the water shows the answer. The round counts it: a right guess is clean, a
wrong one counts against the run. Four wrong guesses of four is a rough run (the next run is gentler), not a perfect
one. The play check's rule 2 reads these rows as predictions, where the game showing the answer after the one guess
is the design, not a leak (`tools/playtest/playcheck-rules.mjs`, `PREDICTION`).

## Help

- Level 1, sorting what she saw: a wrong shelf gets "Nie, to nie ten." and the question again. A second wrong shelf
  makes the thing in the water bob with "Popatrz uważnie!". Then the right shelf pulses.
- Levels 2 and 3, a guess not yet made: after a long wait the thing wobbles ("Popatrz uważnie!"), then the right shelf
  pulses and her tap counts as helped.
- The drop step ("Wrzuć to do wody!") is no longer the same question as the sort, so a slow first tap no longer marks
  her sorting as helped (S11).

## A gentler run

After a rough run the next run is level 1's flow with the everyday things. If she was already at level 1, it also
says what the thing did before asking (the old level 1), so the gentler run differs from the normal one.

## Voice

No new line. "Popatrz uważnie!" and every thing's line exist.
