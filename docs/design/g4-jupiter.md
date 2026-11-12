# G4 · Jupiter's Stripes

Goal for Zosia: the right pot is not always orange. Any colour can be missing, so she has to read the row.

## What she sees and does, per level

Jupiter hangs behind a row of stripes with one stripe blank (glowing). Pots of paint stand below (tap one, or drag it
to the row). She paints the blank, hears the repeating stripes once ("Biały, pomarańczowy!"), then compares Jupiter or
the Sun with Earth.

```
   [ bubble: the row, small ]        ( Chase's window )
         ┌────────────┐
         │ white      │   a row of 5 to 9 stripes, top to bottom
         │ orange     │
         │ white      │
         │ orange     │
         │ ░ blank ░  │   <- the one she paints
         └────────────┘
      (pot) (pot) (pot)     the row's colours and one that is not in it
```

| Level | pattern | what a row can be |
|---|---|---|
| 1 | `AB` | two colours in turn. Starts with white, orange, red or brown; 5 or 6 stripes, so the blank is either colour |
| 2 | `ABB` | three-stripe units of two colours (white orange orange, red brown brown, white white orange, orange orange red), 7 or 8 stripes |
| 3 | `gap` | the same units with a stripe missing in the middle |
| 4 | `ABC` | white orange brown, or orange brown red, 7, 8 or 9 stripes |

Every colour is the right pot in some row of every level, and the pot that is not in the row is chosen from the other
colours, so no pot is always right and no pot is never right.

Help: a wrong pot shakes and "Ojej! Spróbuj jeszcze raz." Second wrong tap: the row said up to the blank ("Biały,
pomarańczowy, biały, i...?"). Third: the right pot pulses. A wrong pot dropped on the row floats back to its place
(today it stayed where it was dropped).

## What changes from today
- `src/levels/jupiter.js`: rows come from a table of units and lengths (`UNITS`, `stripeRows`); the same table lists the
  voice lines, so a row cannot exist without its clip.
- `GAME.md` Jupiter section.
- The speech bubble carried Jupiter's badge, an orange disc, next to the row. In a question about which colour comes
  next that is a colour in the question, and in the size question it points at Jupiter. It is now a palette (stripes)
  and a ruler (sizes).
- Nine-stripe rows sit 0.35 higher so the lowest stripe, which is the blank, is not under the pots in portrait.
- Gentler run: only the row's own two colours (two pots). Level 1's gentler run used to equal level 1.
- Voice: 31 new clips (rows that start with another colour, the help prefixes for them). Listed in the report.
