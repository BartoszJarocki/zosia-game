# Pup Patrol: where it stands and what to do next

Written 2026-10-28 from six parallel reviews of `main` (e4e8af4): two play-throughs of all 36 mission levels (about 46 runs with probes), one full session from the start screen to the goodbye, a curriculum audit with a progression simulator, a research review, and an independent plan from a second model (GPT). Every finding below is labelled **measured** (someone ran it or looked at it), **inferred** (follows from code), or **guess**. Items marked "checked" are ones I verified myself.

## 0. State today

- Production still runs b7e8cb3 (measured, Vercel). The feel pass from 2026-10-22 is merged into `main` and pushed, but was never deployed. The iPad has none of it.
- 9 missions, 36 levels, 0 page errors in any run (measured).
- With a guessed 4 sessions a week and 75% first-try accuracy, 7 of 9 missions reach their top level in about 5 weeks, River in about 11, Kitty Park in about 30 (measured in the simulation; the sessions per week are a guess). Kitty Park is slow because of a gate artefact, not skill (see 2.5).
- The island stops changing after about 1 to 2 weeks (inferred from `src/adventure/world.js` milestone rewards).

## 1. Broken today (fix first)

| # | Where | What she gets | Evidence |
|---|---|---|---|
| 1.1 | Lookout L2–L3 | Each kitten sits level with the sign of the floor below. In "find" mode ("Zobacz numer obok kotka!") the natural answer is one too low. | checked: `tools/playtest/after-audit-numbers/lookout-L3/04-r2-asked.png`; cause `lookout.js:75` sign at floorY+0.72, balcony and kitten at floorY |
| 1.2 | Treat House "how many" | The answer blocks stand in front of the bones. With 6 bones one is fully hidden; empty white spots look like bones. | checked: `after-audit-numbers/probe-howmany-occlusion/04-n6.png` |
| 1.3 | Picnic L1–L3 | The clue lines every treat up on the red blanket and empties the blue one. Tap zones stay put, so tapping the right row picks the wrong blanket. | checked: `after-audit-numbers/picnic-L2/07-r3-after-wait.png`, `picnic.js:115,161` |
| 1.4 | Everywhere | Nothing resumes audio after the iPad locks or she switches apps. In Chromium a suspended context stayed silent and the help ladder froze for 30+ s. | measured in Chromium; checked: no `visibilitychange`, only `resume()` is in the start-tap unlock (`audio.js:14`); iOS behaviour inferred |
| 1.5 | Everywhere | Auto graphics quality measures the 30 fps idle throttle (`engine.js:182`) as "slow device" (`post.js:136`, under 42 fps). It drops to low when calm and climbs on taps, rebuilding effects each switch. | checked by reading; effect on iPad inferred |
| 1.6 | Island | When the finale is due, the idle reminder repeats old news ("Zobacz! Uratowany kotek…" 3 times). | measured: `after-audit-session/session-full/transcript.txt`; checked `hub.js:241,249` |
| 1.7 | Every mission | Coming back after a pause fires the whole help ladder and logs a 42 s timeout, which the tiredness score counts. | measured (simulated 40 s absence) |
| 1.8 | Every mission | A double tap on a wrong option counts as two wrongs and jumps the help ladder. | measured: Lookout probe |
| 1.9 | Name Train L2 | "Następna literka!" is 11 of 28 lines, and after a wrong tap she hears "Nie, nie ten. Następna literka!", which sounds like "move on". | checked: `after-audit-literacy/name-L2/timeline.json` |
| 1.10 | Name Train L3 | One question per mission (`name.js:42`, gaps default 1): one tap, then 14 s of ending. One wrong tap makes the run "rough". | checked: transcript `QUESTION r1/1` |
| 1.11 | Pup Delivery drag | The parcel sinks behind the fence under her finger; a 55 px nudge already posts it. | measured: `after-audit-literacy/probes/delivery-L3-drag/` |
| 1.12 | Treat House overfeed | "Oj, za dużo! Jeden oddaję." then two go back, and the game finishes the round itself. | measured: L3 probe |
| 1.13 | River end | Zosia leaps back to her own bank before the celebration; "Udało się!" twice. | measured: `after-audit-numbers/stones-L4/20-end.png` |
| 1.14 | Balloon Hill | Middle balloons spend about 20% of their rise behind the bubble; at L3 neighbours overlap (F drawn over E). Zosia and Chase half off-screen. | measured: path projection, `after-audit-literacy/balloons-L3-full/14-r5-asked.png` |
| 1.15 | Lookout L4 | Signs overlap with 7 floors (0.64 floor gap vs 0.84 disc). | measured: `after-audit-numbers/lookout-L4/04-r2-asked.png` |
| 1.16 | Smaller | River L3 bubble reads "12?4" with no spaces; reeds drawn over River stones; landscape celebration buttons cover the Lookout heroes; trees move every island visit (`Math.random`); Lookout says "Jedziemy na samą górę!" when already at the top. | measured |

## 2. Levels that don't measure what she knows

Levelling up drives everything else (stars, the scheduler, the parent page). Today it can be passed without learning.

- 2.1 A round answered after the clue or the reveal still counts as "right first time" for level-ups (`mission.js:79,172`, `progress.js:55`). Mastery does weight help (`mastery.js:11-13`), level-ups don't. Agreed by both models; checked.
- 2.2 Guess floors: a random tapper's mastery settles at 0.85 on 2-choice tasks and 0.71 on 3-choice tasks, enough to pass the `letterAudio 0.6` gate; "Worth practising" can never fill (measured, `audit/curriculum/guesser.mjs`).
- 2.3 River L3 always has the smaller stone right (`stones.js:237`, foil is n+1 or n+2). Measured 4 of 4 rounds; checked.
- 2.4 River L2 is a wall: a whole river is one round, so a run needs 10 stones in a row right; the gentler run changes nothing at L1–L2 (`levels.js:44`). Simulation: about 18 runs at 75% (measured in sim).
- 2.5 Kitty Park L6 gate is measured over 9 SOUNDS letters while L5 asks 22, and new items get 5% of turns (`scheduler.js:6`). After 40 questions a median of 13 of 22 letters were never asked (measured in sim). The top level then *narrows* to 9 letters, 5 of them vowels whose sound is their name.
- 2.6 Treat House L1–L2 can't really be failed (auto-finish give, near-free share); it always maxes in 4 runs (measured in sim).
- 2.7 Cone Road L4: the first help says "Gdzie jest numer dwa?", which turns a dot-counting task into "find the 2" (measured, transcript).
- 2.8 The Lookout only levels up in free play: the director never suggests it and the finale doesn't count (`director.js:122`, `lookout.js:41`; checked).
- 2.9 Level steps change 3–4 things at once in Balloon Hill (every level), Cone Road L2→L3→L4, Picnic L3→L4, River L3→L4, Name Train L1→L2 (inferred from tables).

## 3. Her favourites, deeper

**The Lookout.**
- Fix 1.1 and 1.15. Keep kittens at every level: `relative` becomes "Kotek jest jedno piętro wyżej!" with 3 rides, and the finale picks up a kitten too (both models flagged that the best part disappears at the top).
- Count-along: a short beat before each floor number so she or her parent says it first; Chase fills it if nobody does. The elevator is already a vertical number line; Siegler and Ramani found that saying the numbers while moving along a linear board is what helps (research).
- New mode later: a big dot die (1–2, then 1–3) decides how many floors to ride, counting on from the current floor (age 4+).
- Island: rescued kittens wave from the balconies.

**Treat House.**
- Fix 1.2 and 1.12; at L2 stop auto-finishing the give round so she stops at the number herself; vary the round order (always give, howMany, share today).
- "Schowane smakołyki": two bones go into the bowl, a lid covers it, one more drops in; she builds the same amount on Chase's plate. Nonverbal adding is typical at 3 (Clements and Sarama), so this fits her age well.
- "Szybkie oko": 1–4 bones flash for 2 s, then she gives Chase the same number (subitizing, typical at 3–4).
- After a how-many answer, count the bones together as Chase eats them.
- Island: bones appear at Chase's house, his bowl fills.

**Name Train.**
- Fix 1.9 and 1.10: L2 lights the next wagon softly from the start and says "Teraz…?"; L3 gets 2 gaps.
- End on syllables, not letter names: the train honks per syllable while Chase claps, "Zo-sia!", "Ma-ma!". Polish methods (Cieszyńska) start from syllables, and research puts syllable awareness before sounds.
- "Który pociąg jest Zosi?": three trains with name boards (ZOSIA, MAMA, TATA, plus family names the parent types on `#parent`). This follows Majchrzak's name-first method, which the Name Train already resembles.
- Pick the word with the scheduler instead of at random; her name comes up only 1 time in 5 at L4.

## 4. Letters and sounds

- Pup Delivery asks a first-sound question with the letter name ("Co zaczyna się na Em?"). The names of F L M N R S start with an "e" sound, so "elf" is a defensible wrong answer at L4. Ask by sound instead, reusing the held-sound clips the game already has: "Co zaczyna się na sss… jak słoń?" (all three sources agree).
- Picture words: replace elf 🧝, indyk 🦃 and wieloryb 🐳 (she'll say "ryba"); let the parent edit them on `#parent`; add a second picture word per letter so Delivery tests hearing, not memorised pairs.
- Kitty Park: after round 1 shorten the intro to "Znajdź taką samą!" (6.8–8.6 s of talk per tap today, measured); gather the rescued kittens at the end; L6 weighted to consonants (M S Z L N F R).
- Reveal line: say "Tutaj!" instead of repeating the question (repeats flagged in 6 of 17 runs, measured).

## 5. The session and the island

- Say the suggestion in the greeting ("…Może do Domku ze Smakołykami? Dotknij gwiazdki!") and make the suggested star twice as big. Today it comes only after 25 s of silence (measured, 4 runs).
- Celebration: say "Jeszcze raz czy na wyspę?" and return to the island by itself after about 10 s (12–20 s of silence in all 4 celebrations, measured).
- Home button: hold to leave (a ring fills in 0.8 s), and move it away from the bubble, which sits 19 px below it in the River and Lookout (measured).
- A real goodbye: sunset, Chase yawns, the stars stop, taps get "Czejs śpi… Do jutra!". Today the goodbye leaves an island that looks like an invitation (measured). The tired path should include a short Lookout goodnight ride instead of skipping her favourite.
- Every mission leaves something on the island (Treat House bones, Cone Road traffic light, Delivery parcels at the houses, Picnic guests, Lookout kittens). Today 5 of 9 missions never change it (inferred).
- "Misja w domu" at the end of a session: one real-world task tied to today ("Pokaż mamie na paluszkach, ile kotków uratowałaś", "Znajdź w domu coś okrągłego"), also listed on `#parent`. The research review rates this the most learning per unit of work (Hirsh-Pasek's "meaningful" pillar, joint media engagement); that ranking is a guess.
- Parent page: per mission "1 of 2 good runs to the next star", last accuracy, gentler mode on/off; Picnic's comparison skill (missing today, `report.js:10`); letters never asked; first-try % shown against the guess rate; home tips; developer tools behind a link.

## 6. New levels and one new place

New levels come after section 2, because today a level can be passed without learning, so more levels on top would teach little.

**Bridge rows** (so each level changes one thing):
- Balloon Hill new L2 `| 2 | MORE | 2 | 5 | 0.3–0.45 | no | 3 |`
- Lookout new L4 `| 4 | 3 | numeral | relative | 3 |` (relative on 3 floors first)
- Treat House new L3 `| 3 | give, howMany, share | 1–3 | 1–4 | 2–4 | no | no | 3 |` (decide when to stop, small numbers)

**Top rows** (ceilings, for the months ahead):
- Kitty Park `| 7 | ALL | 4 | word | yes | 4 | — |` (the top stops narrowing)
- Name Train L5 with more words (her family's names first; CHASE has the "Ce"/"Czejs" problem)
- Lookout `| 5 | 9 | numeral | pickup | 3 |` (whether 9 floors fit on screen is untested)
- Treat House `| 4 | … | 5–10 | 4–9 | 3–4 | no | no | 3 |`, Cone Road L5 to 10 in rows of five, Delivery L5 ALL, Picnic L5.

The curriculum agent checked that these rows parse with the game's checker (`audit/curriculum/check-rows.mjs`, `GAME.proposed.md`). They need about 47 new voice lines, about 1,600 characters (measured, `voice-gap.mjs`).

**One new place: a garage (shapes, patterns, sorting).** Both models and the research picked the same gap: shapes, AB patterns, sorting by colour and size, and colour words are missing entirely. Drag a circle, square or triangle into the cruiser's hole; finish the red-blue-red-? bunting; tidy toys into baskets by colour, then by size. All typical at 3–4 (Clements and Sarama), all in the Polish preschool curriculum.

## 7. What I would not do now

- Numbers to 10 everywhere. Research and the GPT plan both say richer problems with 1–5 beat bigger numbers at 3 (guess for her specifically). The top rows above are for later.
- A separate board-game place ("Wyścig do Bazy"). The Lookout count-along gets most of the same benefit inside a favourite.
- Emotions, rhythm parade, lowercase letters, prepositions as their own mission. Each is reasonable at 3–4, but the core missions need finishing first.
- Rewards that pull her back (streaks, daily gifts). The research lists them as manipulative design.

## 8. Decisions only the parent can make

1. Deploy the feel pass (`vercel deploy --prod`), and later each unit.
2. Letter names or sounds: does her preschool say "Be" or "b"? The plan assumes names for letter identity (Kitty Park) and sounds for first-sound tasks (Delivery).
3. Her real progress: a screenshot of `#parent` on the iPad would show her actual levels and accuracy. Every progression number here comes from the simulation.
4. Family names for the Name Train and the "Który pociąg jest Zosi?" mode.
5. Whether to spend ElevenLabs characters on the new lines (about 1,600 characters for the new rows alone, more for new modes).

## 9. Order of work (each unit ends in a check)

1. Broken today (1.1–1.16). Check: replay each affected level with the walker, re-take the screenshots above, one probe per fix (audio resume, double tap, drag).
2. Honest levels (2.1–2.9). Check: unit tests on level-up and scheduler, rerun `guesser.mjs` and `sim.mjs`.
3. Favourites (section 3). Check: walker runs and screenshots per new mode.
4. Letters and sounds (section 4), after decision 2. Check: voice coverage (`npm run check`), Delivery walker runs.
5. Session and island (section 5). Check: the session walker from start screen to goodbye.
6. Bridge rows, then the garage, then top rows (section 6). Check: `npm run check`, walker runs, a simulation rerun.

## Evidence index

- Play-throughs: `tools/playtest/after-audit-literacy/`, `after-audit-numbers/`, `after-audit-session/` (gitignored)
- Scripts: `/tmp/claude-1000/-home-bjarocki-Work-game/d18f35fe-5ff2-467e-9470-4a9e1320853c/scratchpad/audit/{literacy,numbers,session,curriculum,research}/`

## Decisions from the parent (2026-10-28)

- "Implement it all": sections 1 to 6. Section 7 stays deferred.
- Her preschool names letters "Be", so every question keeps letter names. Pup Delivery keeps "Co zaczyna się na Be?"; the elf/E-L clash is fixed by replacing the word, not by switching to sounds.
- The feel pass was deployed by the parent (dpl_DvH18XVhw321HrgoYApKzHAk3r4S, e4e8af4).
- Name Train names: Kasia, Bartek, Rysiek, Jurek, Bernadka, Mia, Laura, Jagoda (plus MAMA and TATA). RYSIEK needs Y and BERNADKA has 8 letters, so names may use Y (shown and named, never asked elsewhere) and words may have up to 8 letters.
- New place kind: `garage` ("Garaż"): shapes, AB patterns, sorting by colour and size.
