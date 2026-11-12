# G4 · Comet Catch

Goal for Zosia: she catches comets because she knows the letter, not because she can copy the one in the bubble, and the
sky never jumps.

## What she sees and does, per level

| Level | letters | the bubble | the question | comets |
|---|---|---|---|---|
| 1 | Z O S I A M T | the letter, big | "Złap komety z literą Em!" | 2 of 4, slow |
| 2 | Z O S I A M T | `?` and a comet | the same line | 2 of 5, slow |
| 3 | + E U L D P K B W | `?` and a comet | the same line | 3 of 6, faster |
| 4 | all, lookalikes | `?` and a comet | the same line | 3 of 6, faster |

Only level 1 (`ask match`) shows the letter. From level 2 (`ask name`) she hears it and has to know it.
Level 2 keeps the letters she knows from her name and from MAMA and TATA, so naming is the only new thing;
new letters come at level 3 (they came at level 2 before).

Help on a `name` level, the shared ladder (`src/learning/assist.js`):
1. A wrong comet wobbles, a low "no", "Nie, to nie ten." and the question again. Nothing else changes.
2. Second wrong tap or about 17 s: "Em jak mama!" and the bubble shows the picture word. The comets slow down.
3. Third wrong tap or about 25 s: the right comets pulse, and the bubble shows the letter.
At the second step one wrong comet may float away instead; the clue comes first when only two comets are left to pick from.

## The sky

```
 bubble (top left)
 .  ?  ☄
                       (nothing here: the bubble's space)
        ☄ ≈≈≈     <- lane 4   comets glide right to left
  ≈≈≈ ☄          <- lane 3   (a comet's tail trails to its right)
      ☄ ≈≈≈      <- lane 2
 🚀 ☄ ≈≈≈          <- lane 1   rocket and net, bottom left
 |<--- left edge        right edge --->|
   leaves here, tail fading     comes in here, from beyond the edge
```

Today a comet reaching x = -6 is moved to x = 3.8 inside the picture: it jumps (review P10). Now:
- A comet leaves once its glow is past the left edge; its tail fades as it goes. It comes in from beyond the right
  edge. The edge is worked out per lane from the screen's shape, so it holds in landscape and portrait.
- All comets in a round share one speed, spread evenly round the loop. The asked letter's comets are as far apart as
  they can be, so one is almost always on screen.
- She can catch a comet while its whole letter is on screen. Outside that the comet flies up to seven times faster,
  so a comet that has left is back in about 6 s at the slowest speed (measured in `tests/comet-contract.test.js`).

## What changes from today
- Four lanes, not five, all below the speech bubble. The bubble fills the top left down to a third of the screen, so
  the two top lanes passed under it: it hid the comet and a tap on it replayed the question instead of catching the
  comet (seen in the first play check run: 8 of 14 taps lost on level 1). The lanes are 1.25 apart. A round holds at
  most 8 comets, two to a lane.
- `GAME.md`: a new `ask` column (`match`, `name`), the levels above, the loop described.
- The gentler run keeps one wrong comet (level 1: 3 comets, not 2, where every comet was right) and shows the letter.
- Comet scene: no teleport, one speed, tappable only while the letter is in view, level asks by name from level 2.
- Voice: none. The question line is the old one; the clue is the existing "Em jak mama!".
