# G5a. Kitty Park: ask by name, show only in `match`

Goal: Zosia finds a kitten by hearing a letter's name, not by copying a letter shown in the bubble. Only the first level keeps the copy.

## What she sees and does

Three letter blocks stand in a row. A kitten hides behind one. She taps the block the voice asks for. The bubble shows a picture, never the letter, except in `match`.

```
 [home]        ( 🐱 / 🍌 / 🔊 )  <- bubble: a cat, or the picture word; the letter only in `match`
   Zosia      +-----+ +-----+ +-----+     Chase
              |  S  | |  I  | |  Z  |
              +-----+ +-----+ +-----+
                 kittens she found sit in a row in front
```

| Level | pool | ask | bubble | voice | new thing |
|---|---|---|---|---|---|
| 1 | START | match | the letter | "Znajdź taką samą literkę!" | the way in |
| 2 | START | audio | cat | "Znajdź Zet!" | no letter shown |
| 3 | MORE | word | the picture word | "Be jak banan! Znajdź Be!" | new letters, with their picture word |
| 4 | MORE | audio | cat | "Znajdź Be!" | the same letters, by name alone |
| 5 | MORE | audio | cat | "Znajdź Pe!" | lookalikes among the blocks |
| 6 | ALL | word | the picture word | "Ce jak cebula! Znajdź Ce!" | all the letters, with their picture word |
| 7 | ALL | audio | cat | "Znajdź Ce!" | all the letters, by name alone |
| 8 | SOUNDS | sound | cat | "Która literka robi: mmmm?" | the letter's sound (needs `letterAudio 0.4`) |
| 9 | ALL | word | the picture word | as 3 | lookalikes with the word |
| 10 | ALL, 4 blocks | word | the picture word | as 3 | a fourth block |

The rule of the ladder: new letters arrive with their picture word (3, 6), the next level asks them by name alone (4, 7).

## What changes from today

- Levels 2, 3, 5, 6 showed the letter next to its name. They now ask by name only. That was the plan's finding: five of ten levels were matching the bubble.
- Level 4 would have become the same as level 3, so level 3 now carries the picture word (the old level 7 job) and level 7 is the first level that asks every letter by name alone.
- Name rows now credit `letterAudio`, the skill level 8 waits for. Before, only level 4 did.
- A gentler run (after a rough one) still shows the letter and names it (`ask: name`, no level uses it otherwise): that is the "answer shown" help GAME.md promises.
- Start levels stay: 3 starts at 2, 3.5 at 4, 4 at 6, 5 at 7.
- Voice lines: none new.
