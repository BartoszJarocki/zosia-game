# G5a. Name Train: no waiting between letters, a wrong train says whose it is

Goal: keep Zosia's favourite as it is (the loading, the clapped syllables, the word turning into its thing, the train driving off) and take out what is waiting: a block's hop that holds the next question, and a wrong train that only says "no". No level is cut.

## What she sees and does

```
          ( Z O S I A  🔊 )               <- bubble: the word, or one letter in `ghost`
   [home]   station, platform, lamps
   ============================================ track
   🚂 [Z] [O] [S] [I] [A]    <- wagons: filled left to right, the next one glows
   ============================================
   Zosia      [A] [S] [Z] [I] [O]          Chase      <- blocks on the grass
```

Levels 1, 2 `ghost`, 4 `highlight`, 5, 6 `word`: she taps the block for the next wagon. 7, 8 `missing`: the train arrives with gaps, she taps the missing letters. 3, 9 `whose`: three trains with name boards roll in, she taps the one asked for.

```
   ( ? 🚂 )
   ┌ MAMA ┐   🚂 [ ][ ][ ]
   ┌ ZOSIA ┐  🚂 [ ][ ][ ][ ]        "Który pociąg jest Zosi?"
   ┌ TATA ┐   🚂 [ ][ ][ ][ ]
```

## What changes from today

1. **The next letter is asked while the last block hops.** The wagon is taken at the tap: the block starts its hop, the glow and the bubble move to the next wagon, "Tak! Zet!" starts, and the round ends. Before, the round waited for the 0.65 s hop and then 0.45 s of the mission loop. Measured with `tools/playtest/name-dead-time.mjs` (a finger tapping the next block every 80 ms, level 1 ZOSIA): 1.3 to 1.5 s between two counted letters before, 0.5 to 0.7 s after. What is left is the mission loop's own 0.45 s pause between rounds (`mission.js`), which this unit does not touch. The last letter still waits for its block to land and for the voice, because the ending claps the blocks.
2. **A wrong train says whose it is.** "To pociąg mamy!" (the line the right train gets), then the question again. The second wrong train is told too (the clue used to say nothing aloud). A board that holds a thing (KOT, DOM at level 9) says its word, "Kot!". The ladder is unchanged: the first wrong tap shows nothing, the clue puts the name in the bubble, only the third step pulses the right board.
3. **`missing` is harder to guess.** Level 7 has 2 extra blocks (was 1), level 8 has 3 (was 1). A tap at random was right 2 of 3 times, then 1 of 2.
4. **A gentler `missing` run is a real step.** One letter fewer missing and one extra block. Before, level 7's gentler run was the normal run.

## Not in this unit

Deepening beyond this (building MA-MA from syllable blocks, small letters next to capitals) is plan unit E3 and needs new voice lines, so it waits for the parent's decision 5.

Voice lines: none new. "To pociąg mamy!" is `whoseIs`, "Kot!" is `spellWord`, both already recorded.
