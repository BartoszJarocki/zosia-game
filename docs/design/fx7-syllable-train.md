# FX7. The syllable train: build MAMA, TATA and LALA from syllables

Goal: Zosia knows the alphabet and is starting on syllables. The Name Train, one of her three favourites, gets three new levels where she builds a word from whole syllables instead of letters, with the help taken away one step at a time, as the review proposed (ROZ-01). This is the first part of unit E3 in `docs/IMPROVEMENT-PLAN.md`. Every level she has now stays as it is.

## How the Name Train works today

`src/scenes/name.js` holds two missions behind one factory. `NameMission(game)` reads the level's `mode` and builds a `WhoseTrain` for `whose` and a `LetterTrain` for everything else. Both extend `Mission` (`src/scenes/mission.js`), which runs the rounds, the help ladder, the ending and the leave paths.

- **LetterTrain.** One word per run. One round per letter she places, so `rounds` is the word's length (or its gaps in `missing`). The train is `makeTrain(n)` with `userData.slots`, one point per wagon. Letter blocks stand on the grass. A block carries `userData.letter`, and a tap compares that letter with the wagon to fill next (`open()[0]`, left to right). A right block hops onto its wagon and the next letter is asked at once, while the block is still in the air (G5a). A wrong block shakes and the shared ladder runs (`Mission.wrong`). The outro claps the word in syllables (`clapSyllables`), says it, shows its picture (`PICTURES`, a heart for people) and drives off.
- **WhoseTrain.** Three trains with name boards, three rounds, one tap each.
- **Pure parts.** `src/levels/train.js` picks the word, the gaps, the extras and the whose order, with an injectable rng. Its tests are `tests/levels/train.test.js`.
- **Level data.** The GAME.md level table and the "Name Train words" table (syllables, whose) are parsed by `src/levels/parse.js`. Every word needs a row there. The gentler run after a rough one is `EASIER.name` in `src/levels/easier.js`.
- **What the tools read.** `kid.mjs` finds the options through `s.tappables`, each option's `userData.letter`, `word` or `choice`, and `s.last` for the right one. The playcheck rules read the bubble's text.

Gotchas. A tap on the bubble is `Mission.replay`, which only says the question again. The question of a round opens before its prompt is said (`askAfter`), so she can tap at once. Mastery ignores an answer she could copy from the screen (`learn.answerOnScreen()`, FX1). `tests/endings.test.js` drives every Name Train level through its leave paths and names the train classes it met.

## What she sees and does

Each run builds the three words MAMA, TATA and LALA, one a round, in a shuffled order. The train has two wagons, one per syllable. Syllable blocks (MA, TA, LA, wider than a letter block) stand on the grass. A tap on a block says its whole syllable ("Ma!"). The right block hops onto the next empty wagon, left to right. A wrong block hops to the empty wagon, says its syllable, shakes its head and hops back to the grass, so it swaps out and the right block already on the train stays. The last block says only its syllable, and then the word is said ("Ma! Mama!") and shown: the bubble shows who or what it is (👩 Mama, 👨 Tata, 🪆 Lala) and a heart floats up ("Buziaczek dla mamy!"). The old blocks leave and the next word's blocks pop up in their places. After the third word the train toots and drives off.

Level 10, `match`: the whole word is shown in two pieces.

```
            ( M A   M A   🔊 )                <- bubble: the word in two pieces
   station, platform, lamps
   ==================================================== track
          🚂 [ ma ] [ ma ]                    <- faint MA on each empty wagon
   ====================================================
   Zosia      [MA]   [TA]   [MA]      Chase   <- blocks: two MA and one other
   "Ułóżmy słowo Mama! Znajdź Ma!"   then   "Teraz Ma!"
```

Level 11, `hear`: one syllable is already on the train, and she finds the other by its sound.

```
            ( 👩  🔊 )                         <- bubble: the picture, no letters
                                        ┌──────┐
   =====================================│  👩  │ <- the word card
          🚂 [ MA ] [    ]               │ ▢  ▢ │    (a tap shows the example)
   =====================================└──────┘
   Zosia      [LA]   [MA]   [TA]      Chase
   "Pociąg wiezie słowo Mama. Dołóż Ma!"
```

Level 12, `build`: the word is said and its picture shown. Nothing written shows until she answers.

```
            ( 👩  🔊 )
          🚂 [    ] [    ]                [card 👩 ▢ ▢]
   Zosia   [MA]  [TA]  [MA]  [LA]    Chase
   "Ułóżmy słowo Mama z kawałków!"   then   "Ma… i co dalej?"
```

On a portrait iPad the blocks are a little bigger, as the letter blocks are, and stay in one row (four at most).

## The three task kinds

| Mode | Shown before she answers | Asked | Recorded as | Mastery |
|---|---|---|---|---|
| `match` | the word in the bubble, a faint syllable on each empty wagon | "Znajdź Ma!", then "Teraz Ma!" | `syllableVisual` | moves, as matching (like `letterVisual` in `ghost`), where a guess could miss: the second block |
| `hear` | the picture; the other syllable on the train | "Pociąg wiezie słowo Mama. Dołóż Ma!" | `syllableAudio` | does not move while the piece on the train is the same text |
| `build` | the picture only | "Ułóżmy słowo Mama z kawałków!", then "Ma… i co dalej?" | `syllableBuild` | the first piece moves it; the second does not, since the first is on the train |

Each wagon she fills is one question, and its item is the syllable asked (MA). The three kinds are three skills, so the grown-ups' page lists them as three rows on each syllable's card ("Ma": matches it to the word shown, finds it by its sound, builds a word with it).

The rule for mastery is one rule, by text. An answer is on the screen when its syllable is written where she can see it as she answers: a faint syllable on a wagon, a piece on the train, or the example. Then the solve counts and mastery stays (`answerOnScreen`, FX1). In MAMA, TATA and LALA both syllables are the same, so the piece left on the train in `hear` shows the answer, and so does her own first piece in `build`. A word whose syllables differ would move mastery in both. `match` is matching a shown word by definition, as `ghost` is for letters, so it moves `syllableVisual`.

Help, the same ladder as every place (`src/learning/assist.js`):

- **Quiet.** The bubble bounces, then the question again, then the clue, then the right block pulses.
- **A wrong block.** It swaps out as above, with "Ta! Nie, to nie ten." and the question again. The first wrong block shows nothing more.
- **The clue.** `match`: the faint syllable on the empty wagon pulses and is said. `hear` and `build`: the word is said in its syllables ("Ma! Ma!"), so she still finds the piece herself.
- **The second wrong block.** A block that fits no empty wagon leaves. With two blocks left the clue comes instead.
- **The last step.** The right block pulses ("Tutaj!").

## The way back to the example

`hear` and `build` have a word card on a post by the train: the word's picture over two empty boxes. A tap on it shows the example of level 10 without starting anything again. The two syllables appear in the card's boxes, faint syllables appear on the empty wagons, the bubble shows the word in two pieces, and Chase says "Popatrz na słowo!". The blocks already on the train stay, the question stays open, and the round goes on. For the rest of that word the answers are on the screen, and the card counts as help (a clue), so the page reads "after help". The next word starts without the example again.

A tap on the bubble only says the question again. It moves no block.

## The data

```js
// a wagon she can tap: the syllable it carries, and the slot on the train it sits in (null: on the grass)
{ syllable: 'MA', slot: null }
// the word: the syllable each slot wants, left to right
['MA', 'MA']
```

The pure rules live in `src/levels/train.js`. `syllableWagons(syllables, { leave, extras, pool, rng })` makes one round's wagons: the ones left on the train (`hear`), the ones for the empty slots, and `extras` from the other words' syllables, never one the word has. `nextSlot(syllables, wagons)` is the first empty slot, or -1 when the word is built. `couple(syllables, wagons, wagon)` puts a waiting wagon into the next slot when its syllable equals that slot's text, and returns the slot, or -1 with nothing changed. Nothing compares ids or the order the wagons were made, so either MA fills either slot. The scene keeps one wagon per block (`block.userData.wagon`) and copies its syllable to `userData.choice`, the field the play tools read.

`src/scenes/name.js` adds `SyllableTrain`, a third class behind `NameMission`, chosen from a table of modes. A small table, `SYLLABLE_TASKS`, says per mode which skill it records, whether the example shows from the start, how many pieces arrive on the train, and whether the card stands by the track. The lines per mode come from one table in `src/lang/pl.js`, `SYLLABLE_ROWS` (ask, next), in the pattern of FX3's `LETTER_ROWS`.

## Where the new levels go

The open question: at 3.5 a new save starts the Name Train at level 4 of 9, so rows added after level 9 take some runs to meet.

Choice: the three rows go on top, as levels 10, 11 and 12. No level moves and the save is not migrated.

Why:

- **Her saved level is unknown.** The parent has not pasted her save yet. It is at least 4, since C1 moved every save up to its 3.5 start, and she has played her favourite for six weeks, so it is likely higher.
- **A row below her level is never met.** The ladder only goes up. Rows inserted after level 4, with a migration that keeps every save on its own exercise (old 5 to 9 becoming 8 to 12), would sit below any save at 5 to 9. Those saves would never see the syllable train. Rows on top are met from every save.
- **Woven rows get leapt over.** A perfect run moves her up two levels. A single syllable row between letter levels would often be skipped by a child who finds the letters easy.
- **Nothing she plays now changes.** No exercise moves under her saved level, and the starting levels stay 3, 4, 6, 8.

How soon, measured with the game's own scoring (`scoreRun`, `applyRun`, one good run a level, a perfect one two), by the level a save is at now. Name Train runs to reach level 10, median:

| Saved level | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|
| right first time 75% | 6 | 5 | 4 | 3 | 2 | 1 |
| right first time 90% | 4 | 4 | 3 | 3 | 2 | 1 |

A short script measured this: it plays each level's questions as the scenes ask them, 2000 runs a cell, through `src/progress/levelup.js`. To let her try the syllable train with a grown-up at once, the grown-ups' page can set the Name Train to level 10 (Developer tools, the level's +), as it can for any place.

A perfect run at level 9 (three trains) leaps to 11, so a child who finds the names easy can meet `hear` first. In MAMA, TATA and LALA the piece left on the train is the same as the missing one, so `hear` is close to `match`, and the card shows the example.

## The grown-ups' page

The three skills sit in the Syllables section (now labelled "The Port, Name Train"), one card per syllable met, with a row per task kind. The gentler run after a rough syllable run is `match` with one extra block at most. With none, both blocks would be right, and a run would win a level by itself. Every age still starts below level 10.

## Voice lines

Reused: "Ma!", "Ta!", "Mama!", "Tata!", "Buziaczek dla mamy!", "Buziaczek dla taty!", "Popatrz na słowo!", the praise and the "no" lines. New, 18 lines:

- "La!", "Lala!", "Buziaczek dla lali!"
- "Ułóżmy słowo Mama! Znajdź Ma!", "Ułóżmy słowo Tata! Znajdź Ta!", "Ułóżmy słowo Lala! Znajdź La!"
- "Teraz Ma!", "Teraz Ta!", "Teraz La!"
- "Pociąg wiezie słowo Mama. Dołóż Ma!", "Pociąg wiezie słowo Tata. Dołóż Ta!", "Pociąg wiezie słowo Lala. Dołóż La!"
- "Ułóżmy słowo Mama z kawałków!", "Ułóżmy słowo Tata z kawałków!", "Ułóżmy słowo Lala z kawałków!"
- "Ma… i co dalej?", "Ta… i co dalej?", "La… i co dalej?"

Until they are recorded they play in the device voice.

## Not in this unit

The last sound of a word, small letters next to capitals, and syllables at the Port, Pup Delivery and Kitty Park are the rest of E3. Words beyond MAMA, TATA and LALA wait for her play with these three (Appendix E, decision 4). No letter outside `ALL` is used.
