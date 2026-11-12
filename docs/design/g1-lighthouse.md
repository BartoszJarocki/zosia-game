# The Lighthouse (D4): one more, with the flashes kept on the board

For Zosia at 3.5. The lamp counts with her: she counts its flashes, or makes them herself. Level 4 asked for "one
flash more" with nothing on screen to hold what the lamp did, so she had to remember a number, add one and tap it out.

## What she sees and does

| Level | What happens | What changes |
|---|---|---|
| 1 `marks` | The lamp flashes 1 to 3 times, a yellow dot stays on the board for each. Two buoys with numerals. She taps one. | Nothing. |
| 2 `flashes` | The same without dots, three buoys. The bubble replays the flashes. | Nothing. |
| 3 `make` | The sail shows 2 to 5. She taps the lamp that many times (a dot each), then the boat. | Nothing. |
| 4 `more` | The lamp flashes 1 to 4 times. A pale dot stays for each, and one empty ring waits after them. "Mrugnij o jeden raz więcej!" Each of her taps flashes the lamp and lights the next place, the ring last. Then she taps the boat. | The pale dots and the empty ring are new. Before, the board stayed empty. |

```
   lamp *                     board
   [==]          +-----------------------------+
   |  |          |  (o) (o) (o) ( )            |   level 4: three seen, one empty place
   |  |          +-----------------------------+
  /____\                  |
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ boat >
   (o) pale: a flash the lamp made   (*) lit: a flash she made   ( ) the "one more" place
```

## A wrong try

Every level follows the one help ladder (`src/learning/assist.js`):

1. First wrong: the boat bobs, "Nie, to nie ten." or "Za mało! Policz jeszcze raz!", her dots go out, the question again.
   Nothing else. The pale dots stay, because they are what she saw, not the answer.
2. Second wrong, or a long wait: a clue. At levels 1 and 2 the dots light one by one, or the flashes play again. At
   level 3 the lamp pulses. At level 4 the lamp replays what she saw, each pale dot glowing with its flash. The empty
   ring stays empty.
3. Third wrong: the answer. The right buoy pulses, or the lamp flashes the whole count ("Mrugnij trzy razy!") and she
   makes it herself.

GAME.md already says this for levels 1 and 2 since B2. This unit adds level 4's dots and words.

## Also fixed

- Level 4 asked for one number and recorded another (S14). It now picks the count she makes (2 to 5) and records the
  same, like every other `sequence` question.
- Replaying what she saw is no longer marked as showing the answer. Only the reveal is.

## Not changed

The four levels, their numbers, the boats, the pace (B4), the counted quick taps (B1). No new voice line.
