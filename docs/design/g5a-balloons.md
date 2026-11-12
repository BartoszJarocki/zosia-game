# G5a. Balloon Hill: ask by name, and the leftovers can be popped

Goal: Zosia pops the balloons whose letter she hears, not the ones that look like a big letter in the bubble. The balloons left over are hers to pop for fun.

## What she sees and does

Balloons rise in five lanes. The bubble (top left) holds a big letter in `match` levels and a balloon in `audio` levels. The voice always names the letter: "Przebij balony z literą Be! Ile ich znajdziesz?" Each right balloon pops and is counted ("Tak! Dwa!").

```
 [home]   +--------+                       (  paws  )        ( stars )
          |  B  🔊 |   <- level 1, 2          O    P
          | 🎈  🔊 |   <- level 3 to 7        |    |  B
          +--------+     B     I             |    O  |      windmill
    Zosia              |     |     B               Chase
```

| Level | pool | ask | targets / total | speed | similar |
|---|---|---|---|---|---|
| 1 | START | match | 2 / 5 | slow | no |
| 2 | MORE | match | 2 / 5 | slow | no |
| 3 | MORE | audio | 3 / 7 | slow | no |
| 4 | MORE | audio | 3 / 7 | faster | no |
| 5 | ALL | audio | 3 / 7 | faster | no |
| 6 | ALL | audio | 3 / 7 | faster | yes |
| 7 | ALL | audio | 4 / 9 | faster | yes |

New letters are shown first (2), then only named (3). A clue on an `audio` level (after a long wait, or the second step of the help ladder) puts the letter in the bubble.

When the last right balloon pops, the others no longer sit still for the praise or float off in under a second. They drift up and away over 1.6 s, starting slowly, and a tap pops one with the usual pop and sparkles. Nothing counts: no answer, no mistake. The next round opens when they are gone.

## What changes from today

- Every level showed the letter, so the whole mission was shape matching. Now only levels 1 and 2 do. Levels 3 to 7 credit `letterAudio`.
- Leftover balloons were untouchable (a tap did nothing) and left in under a second. Now they can be popped. This costs 0.7 s of the wait before the next round (1.6 s drift instead of 0.9 s). The play check's rule 3 reads that wait.
- The praise after the last right balloon was "Tak! Trzy! Wszystkie balony z literą Te! Te jak tort!", 6.7 s of voice, and the next question was only said after it. On a named level the bubble no longer holds the letter, so she could not play the next round before that: she waited about 6 s to hear which letter. A wrong balloon tapped meanwhile got "Znajdź Te!" as the first time she heard it, and the play check read that as a named answer. It is now "Tak! Trzy!", the same as for every balloon before the last, 2 s. The picture word ("Te jak tort!") is still the clue of the help ladder. The line `balloonDone` (4.7 s per letter and word) is gone from the voice list.
- A gentler run (after a rough one) shows the letter again, with two fewer balloons, slower.
- The `ask` column is new in GAME.md and in the table's schema (`src/levels/parse.js`).
- Start levels stay: 3 starts at 1, 3.5 at 3, 4 at 5, 5 at 6. A 3.5 child now meets her first named level at once.
- Voice lines: none new, one fewer family to record (`balloonDone`).
