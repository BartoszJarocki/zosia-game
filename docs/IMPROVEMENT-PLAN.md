# Pup Patrol improvement plan

This plan fixes what `docs/REVIEW-2026-11.md` found, for Zosia at 3.5. It changes four things for her: the island reads clearly, her taps always count, she plays more than she watches, and the levels start where her skills are and go further. It adds no new place. The units run in this order: A1, A2, F1, C1, C2, B5, B1, B2, B3, B4, D1 to D12, E1 to E4, F2. Each release ends with the parent trying it with her.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. Check a box only when its evidence exists: a file, a test run, a row of the play check, a contact sheet, or the parent's word.

Tests alone are not sufficient verification. A unit is verified only when its unit, play and pace boxes are all checked. "Play" means the play check from unit A1, on the GPU at the iPad's graphics setting. "Pace" means the wait between her right answer and the next question.

The work follows the repo's usual way: one worktree per unit, a diff review, a merge to `main`, and a deploy by the parent. Nothing deploys without the parent.

## Rules every unit keeps

These five rules are the program. Unit A1 turns each into a check that fails today.

1. **Every tap answers.** A tap on something she can tap gets a sound and a movement within 0.2 s, also when the game cannot act on it yet. A counting tap is never dropped.
2. **The question is hers.** The answer is not on screen before she answers, except in rows marked `match`. The first wrong tap never shows it.
3. **She plays more than she watches.** From a right answer to the next question takes at most 4 s in the middle case and 8 s in the worst. A trip after the first one in a session takes at most 8 s. A ride or a feast she taps along with counts as hers.
4. **Levels follow what she knows.** A new place starts where her skills are. One clean run moves her up.
5. **The check sees what she sees.** Every unit is checked at `?q=high` on the GPU by the child-like player, and ends in contact sheets the parent can open.

## Before any code, four things from the parent

- [ ] **Her save.** On the island, hold the badge shelf (top left) for 3 seconds, then tap **Copy progress** and paste it into the chat. It shows her real levels, her accuracy and how often she plays. Units C1 and D use it. Evidence: the pasted JSON.
- [ ] **The build she runs.** Swipe the app away, open it again, and read the small label at the bottom right of the start screen. It must show the date of the last deploy (8.11). Evidence: the label.
- [ ] **A stopgap for "too easy", today.** On the same page open **Developer tools** and raise the levels with **+**, or hold **All missions to the top level**. This works in the deployed commit (measured on a local build of c5ff849 with `tools/playtest/parent.mjs`). Evidence: she plays a harder level.
- [ ] **Three photos from the iPad.** The island, one sea game, one space game. They confirm that the device shows what the GPU check shows. Evidence: the photos.

## Release 1. See it, start where she is, never lock her out

### Build the check that sees what she sees (A1)

**Depends on.** None.

**Files.**

- [ ] Keep `tools/playtest/kid.mjs`, `tour.mjs`, `probes.mjs`, `sheet.sh`, `pace.py`, `attention-sim.mjs` (written for the review).
- [ ] Create `tools/playtest/playcheck.mjs`.
- [ ] Edit `package.json` (script `playcheck`).

**Build.**

- [ ] Add two plans to `kid.mjs`. `wrong-first` taps one wrong option, then the right one. `quick` taps counting things every 300 ms.
- [ ] `playcheck.mjs` runs `fast`, `wrong-first` and `quick` on every level, and `mash` on the first and top level. It writes one row per level to `playcheck.tsv`.
- [ ] Rule 1 fails a row when `quick` taps are not all counted, or a tap gets no sound within 0.2 s.
- [ ] Rule 2 fails a row when the bubble's text equals the right option in a row not marked `match`, or when the help level is above 1 after one wrong tap.
- [ ] Rule 3 fails a row when the middle wait is over 4 s or the longest is over 8 s.
- [ ] Rule 5: every run uses `--use-angle=gl-egl` and `?q=high`, and `sheet.sh` writes a contact sheet per level.

**You see.**

- [ ] `npm run playcheck` prints a table with the failing rule per level. Today most rows fail. Evidence: the committed `tools/playtest/playcheck-baseline.tsv`.

**Verify.**

- [ ] Unit. `node --test tests/playcheck-rules.test.js` feeds each rule a passing and a failing summary.
- [ ] Play. The baseline reproduces the review's measured numbers: Lighthouse 3 counts 1 of 3 taps, Moon drops taps, Star Pictures fails rule 2.
- [ ] Pace. `pace.py` prints the same shares as the review's table, within 3 points.

### Make sure the iPad runs what was deployed (A2)

**Depends on.** None.

**Files.**

- [ ] Edit `src/main.js`, `src/parent/view.js`.

**Build.**

- [ ] Ask for a new version when the app comes back to the front on the island or the start screen, and switch to it there. Never switch inside a mission.
- [ ] Show the build label on the grown-ups' page.

**You see.**

- [ ] After a deploy, the suspended app shows the new label the next time it reaches the island. Evidence: the parent reads the label on the grown-ups' page.

**Verify.**

- [ ] Unit. A test of the "may we switch now" rule: yes on the island and the start screen, no in a mission.
- [ ] Play. A probe hides and shows the page with a waiting worker and reads the label.
- [ ] Pace. None. This unit changes no round.

### Make the island readable on the iPad (F1)

**Depends on.** A1.

**Files.**

- [ ] Edit `src/scenes/hub.js`, `src/fx/post.js`, `src/style.css`.

**Build.**

- [ ] Draw the place stars so the bloom pass cannot smear them: keep them below the bloom threshold, or draw them after the effects.
- [ ] Narrow the tilt-shift on the island so the rocket, the harbour and the lighthouse are in focus.
- [ ] Take the rows of small level stars off the island. They stay on the mission screen and the celebration.
- [ ] Give the suggested place one mark the others do not have, such as Chase's paw print bouncing above it.
- [ ] In portrait, frame the island so no place is cut and no mark covers a place.
- [ ] A tap that hits nothing on the island starts a drive only within 5% of the screen's short side, not 14%.

**You see.**

- [ ] Twelve crisp stars and one clearly different. Evidence: `island-tiers.jpg` remade, landscape and portrait.

**Verify.**

- [ ] Unit. The stray-tap radius has a test at 4% and 6%.
- [ ] Play. `tour.mjs island` at 1180x820 and 820x1180. The tap on the sea near the lighthouse no longer drives anywhere.
- [ ] Pace. None.

### Start each place where she is (C1)

**Depends on.** A1, and her save.

**Files.**

- [ ] Edit `GAME.md` (a new table, "Starting levels"), `src/levels/parse.js`, `src/progress.js`, `src/progress/migrations.js`, `src/parent/view.js`.

**Build.**

- [ ] The new table gives each mission a starting level for four bands: 3, 3.5, 4, 5.
- [ ] `levelFor` returns the higher of her saved level and the band's starting level.
- [ ] The grown-ups' page gets one control, "Zosia ma lat", and shows each mission's starting level next to her level.
- [ ] A rough run still gets the gentler run, so a start that is too high corrects itself.

Proposed starting levels for the 3.5 band, to be corrected from her save: Kitty Park 4, Balloon Hill 3, Name Train 4, Cone Road 4, River 4, Treat House 4, Lookout 3, Delivery 2, Picnic 3, Garage 2, Mercury 3, Venus 3, Moon 3, Mars 3, Jupiter 2, Saturn 3, Pluto 3, Black Hole 3, Comet 2, Stars 3, Telescope 2, Lighthouse 2, Floats or sinks 2, Reef 2, Port 2.

**You see.**

- [ ] Mercury opens with a quick look at up to four craters and numerals only. Evidence: the contact sheet of her first Mercury run.

**Verify.**

- [ ] Unit. Tests for the parser, for `levelFor` with a saved level above and below the start, and for the save migration.
- [ ] Play. `npm run check` accepts the table. `playcheck` runs each mission at its 3.5 start.
- [ ] Pace. None.

### Move her up after one clean run (C2)

**Depends on.** C1.

**Files.**

- [ ] Edit `src/config.js`, `src/progress/levelup.js`, `src/scenes/lookout.js`, `tools/learning/sim.mjs`.

**Build.**

- [ ] `goodRunsPerLevel` becomes 1.
- [ ] A run with three or more scored questions, all right first time and without help, moves her up two levels.
- [ ] The Lookout ride at the end of a session runs at her level and counts.

**You see.**

- [ ] A new star after one good visit. Evidence: the celebration sheet with "Poziom…".

**Verify.**

- [ ] Unit. Tests for one level, two levels, and the top level.
- [ ] Play. The simulator reports the visits needed to reach the top of each mission, before and after.
- [ ] Pace. None.

### Let her decide when to stop (B5)

**Depends on.** None.

**Files.**

- [ ] Edit `src/session/attention.js`, `src/session/director.js`, `src/scenes/hub.js`, `src/scenes/mission.js`.

**Build.**

- [ ] The tiredness score compares her answers with earlier answers in the same mission only.
- [ ] The goodnight stays as a soft ending. After it, a tap on a place wakes Chase with a yawn and starts a new session. Nothing is locked.
- [ ] "Jeszcze tylko jedno!" is said once per session.
- [ ] A tap on the bubble when no question is open does nothing. It cuts no praise and is not counted.
- [ ] After a tap on Chase on the island, the invitation is said again.

**You see.**

- [ ] She is never told "Czejs śpi… Do jutra!" and left with nothing to tap. Evidence: `probes.mjs asleep` starts a mission.

**Verify.**

- [ ] Unit. `attention-sim.mjs` cases as tests: no mistakes stays at 1.0 across a change of mission.
- [ ] Play. The session walk from the start screen through a goodnight and on.
- [ ] Pace. None.

**Parent's look for release 1.** The island is easy to read. A new place is not babyish. The game never refuses to play. Tell me any place that became too hard.

## Release 2. Every tap counts, and the waiting goes

### Answer every tap (B1)

**Depends on.** A1.

**Files.**

- [ ] Edit `src/engine.js`, `src/scenes/mission.js`, `src/input/bounce.js`, `src/ui.js`.
- [ ] Edit `src/scenes/moon.js`, `lighthouse.js`, `stars.js`, `name.js`, `mercury.js`, `venus.js`, `lookout.js`, `counting.js`, `balloons.js`.

**Build.**

- [ ] The engine ignores a second landing within 0.12 s and 40 px of the last one, for every tap, right or wrong.
- [ ] Counting taps queue. Three quick taps on the lamp give three flashes, played one after another. The same holds for jumps and toots.
- [ ] A tap that arrives while a scene is busy gets a small bounce and a tick. It is never silent.
- [ ] The next thing can be tapped as soon as the last answer lands: the next star, the next letter, the right tile after a wrong one.
- [ ] The house button needs the same 0.8 s hold on the maps as in missions.

**You see.**

- [ ] She taps the lamp three times fast and sees three flashes and three dots. Evidence: `probes.mjs lamp` reports 3 of 3.

**Verify.**

- [ ] Unit. Tests for the bounce rule and the tap queue.
- [ ] Play. Rule 1 passes on every level. `mash` finishes every run with no error.
- [ ] Pace. The Moon level 4 takes under 40 s (63 s today).

### Use one help ladder everywhere (B2)

**Depends on.** B1.

**Files.**

- [ ] Edit `src/scenes/venus.js`, `jupiter.js`, `saturn.js`, `comet.js`, `mercury.js`, `mars.js`, `stars.js`, `pluto.js`, `port.js`, `name.js`, `lookout.js`, `stones.js`, `counting.js`.

**Build.**

- [ ] Remove each scene's own "show the answer" from its wrong-tap branch. `Mission.wrong` already runs the ladder: try again, then one wrong option leaves, then the answer pulses.
- [ ] Where a scene has no middle step, add one that is not the answer. The Lookout lights the floors one by one. The River shows the row so far.
- [ ] Treat House compares the bowl with her treats only after a right answer.
- [ ] Pluto's clue pulses the heart she can tap.

**You see.**

- [ ] After one wrong tap she hears "Nie, to nie ten" and tries again. Evidence: the `wrong-first` sheets.

**Verify.**

- [ ] Unit. A test per scene family that one wrong answer leaves the help level at 1.
- [ ] Play. Rule 2's wrong-tap half passes on every level.
- [ ] Pace. None.

### Take the answer off the screen (B3)

**Depends on.** B2.

**Files.**

- [ ] Edit `GAME.md` (Balloon Hill, Comet and Kitty Park rows), `src/scenes/stars.js`, `saturn.js`, `letters.js`, `balloons.js`, `comet.js`, `port.js`, `lookout.js`, `shallows.js`, `moon.js`, `blackhole.js`.
- [ ] Edit `src/levels/jupiter.js`, `src/levels/reef.js`, `src/levels/easier.js`, `src/levels/moon.js`.

**Build.**

- [ ] Star Pictures shows the numbers so far and a question mark. Saturn's bubble shows a question mark when the piece is not named.
- [ ] In Kitty Park, Balloon Hill and Comet only the `match` rows show the letter. The other rows ask by name.
- [ ] Jupiter's rows vary in start colour and length, so every pot can be right.
- [ ] Port boards all have one width. Reef's two-word level picks at random.
- [ ] The Lookout's kitten for "one floor up" appears after her answer.
- [ ] Floats or sinks scores a wrong guess. The gentler Comet keeps one wrong comet. The gentler runs that equal the normal run get a real easier step.
- [ ] Moon and Black Hole levels 1 and 2 ask two scored questions. The flag appears after her first jump.

**You see.**

- [ ] Star Pictures asks "Jeden, dwa, a co dalej?" and the bubble does not tell. Evidence: the `fast` sheet.

**Verify.**

- [ ] Unit. Tests for the Jupiter rows, the Reef order, the Floats-or-sinks score, and each changed gentler run.
- [ ] Play. Rule 2's bubble half passes. A random tapper's clean share stays within 15 points of chance in every mission (`tools/learning/guesser.mjs`, extended to all 25).
- [ ] Pace. None.

### Cut the waiting (B4)

**Depends on.** B1.

**Files.**

- [ ] Edit the scenes named below, `src/scenes/area-map.js`, `space.js`, `bay.js`, `src/lang/pl.js`.

**Build.**

- [ ] Say a fact once per visit, not once per round. Let praise play while the next question arrives.
- [ ] Lighthouse: the next boat sails in during the praise. Port: the name is said once before and once after. Black Hole: the pebbles fall 0.4 s apart. Lookout and Treat House: the ride and the eating keep their length, because she loves them, and she can tap along to count (parent decision 6). Garage and Jupiter: the voice reads the pattern once, not the whole row. Star Pictures: the prompt stays one line. Mercury: "Szybkie oko!" comes before the look.
- [ ] The first trip of a session keeps the whole launch. Later trips go from the tap to START in 3 s.
- [ ] A flight goes straight to the stop she tapped, with one line. A tap on another stop during the flight changes course. The way home is direct.

**You see.**

- [ ] The second rocket trip of the day is a tap, START, and the map. Evidence: `probes.mjs maphome` reports under 8 s.

**Verify.**

- [ ] Unit. Tests for the "first trip of the session" rule and the flight path.
- [ ] Play. `fast` finishes every level. `tour.mjs space` and `sea` finish.
- [ ] Pace. Rule 3 passes on every level. The middle wait is 4 s or less in every mission (over 4 s in 16 of 25 today, 4.3 s overall).

**Parent's look for release 2.** Her quick taps all do something. She waits less. One wrong tap no longer shows her the answer.

## Release 3 and after. Repair the weak missions

Each mission below is one unit with the same shape: a one-page design with a drawn layout first, then the build, then the play check and the parent's look. No mission is removed. The order follows her save: the places she visits most come first. Without the save, the order is the one below.

| Unit | Mission | What changes |
|---|---|---|
| D1 | Floats or sinks | A side view with blue water and a clear surface line. Two big shelves with large pictures. The guess is scored. Level 1 asks before it tells. |
| D2 | Reef | One scene at a time, seen from the side. "Pod" is under a ledge with eyes showing. "Na" and "w" use different things. The spots in the top level are large and bright. |
| D3 | Port | Tapping a boat says its name. Level 3 says the three names before the question. |
| D4 | Lighthouse | Level 4 keeps a dot for each flash she saw and shows one empty place: "o jeden więcej". A wrong try replays what she saw, not the answer. |
| D5 | Saturn | Drops register where the ring is drawn. The planet itself is not an answer. The top levels sort by two things at once, kind and size. |
| D6 | Pluto | The asked shape changes each round and comes from a longer list: owal, prostokąt, gwiazda, romb. The heart is one of them. |
| D7 | Black Hole | The watching rounds become taking away: "Było pięć. Dwa wpadły. Ile zostało?". Parent decision 4. |
| D8 | Star Pictures | Top levels count backwards, then by twos. Labels are large. |
| D9 | Moon | Footprints large enough to tap and count. Chase larger on the screen. |
| D10 | Telescope | The order levels show the road from the Sun with one place missing. |
| D11 | Mercury, Venus, Mars, Jupiter, Comet | Contrast on Venus. Comets leave at the edge and come back from the other side. The rover drives back between rounds. |
| D12 | Island missions | Garage: a shape counts where she drops it. Delivery: a small lift posts nothing. Picnic: tapping the kitten is not an answer, and the bones never overlap. Treat House: a bone can be tapped only when it lies still. Name Train "whose": a wrong train says whose it is. Balloon Hill: leftover balloons can be popped. |

**Verify, for each.** Unit tests for the changed rules. Play: the four rules pass at every level of the mission. Pace: rule 3. Parent's look: one visit with her, and one sentence back.

## After the repairs. Raise the ceiling

New rows go on top of the missions that now work. Each needs new voice lines, so each waits for parent decision 5.

| Unit | What she gets | Where |
|---|---|---|
| E1 | Numbers 11 to 20: count, read, find | Cone Road, Mars, River |
| E2 | Adding and taking away with things, to 5, then to 10 | Treat House (hidden plus two or three), Black Hole, Picnic ("o ile więcej?") |
| E3 | From syllables to reading: build MA-MA from syllable blocks, the last sound, small letters next to capitals | Name Train, Port, Delivery, Kitty Park |
| E4 | Longer patterns (ABC, AABB), sorting by two things, what does not belong | Garage, Jupiter, Saturn |

**Verify, for each.** `npm run check` accepts the rows. Voice coverage is complete. The play check passes at the new levels. The simulator shows how many visits a child at 75% needs to reach them.

### Make the bay map as clear as the space map (F2)

**Depends on.** F1.

- [ ] Stops at least 110 px wide, each one recognisable. Game stops carry their badge. Look-only stops do not.
- [ ] Earth and the island show a small house, so "home" does not look like a place to play.
- [ ] Verify. `tour.mjs sea` and `space` sheets at both orientations, and the parent's look.

## Decisions only the parent can make

1. **The starting band.** 3.5 as proposed in C1, or higher. Her save settles most of it. The alternative to a band you set is automatic placement from her answers in other missions. It needs more code and is harder to check, so it is not in this plan.
2. **The goodnight.** Recommended: keep it as a soft ending that never locks (B5). The alternative is to remove it.
3. **Who writes the code.** The sea and space missions were written by a small, cheap model and passed a check that could not see their faults. With the play check from A1 that model can do the mechanical units (B2, B3, most of D11 and D12). The shared-code units (A1, B1, B5, C1, C2) and the redesigns (D1, D2, D5 to D7) need either a stronger model or me writing them. Recommended: I write those. It costs more tokens and fewer rounds.
4. **Places that change what they teach.** The Black Hole becomes taking away (D7). Pluto becomes "find the shape" (D6). Saturn becomes sorting by two things (D5). The places stay.
5. **Voices.** Phase E needs new lines: the numbers 11 to 20, the adding and taking-away sentences, the syllable blocks. A count comes with each unit before anything is recorded.
6. **Her favourites.** The Lookout, the Treat House and the Name Train get the first repairs in D12 and the first new rows in E, unless her save says otherwise. The Lookout's ride (12 s) and the Treat House's eating (11 s) are the longest waits in the game and may be what she loves. Recommended: keep their length and let her tap along. Tell me if she gets restless there.

## What I would not do

- Add a place, a planet or a stop before the 25 that exist pass the play check.
- Add levels on top of a mission whose answer is still on screen.
- Lock anything by time or by score.
- Trust a green run that was not made at the iPad's setting by the child-like player.

## Risks

- **The check is not the iPad.** The GPU run matches the iPad's effects, not its speed or its sound. The parent's photos and a look per release cover the gap.
- **Starting levels can be too high for one mission.** The gentler run after a rough one catches it, and the grown-ups' page can lower a level.
- **Faster levelling plus leaks.** C2 lands before B3, so for one release she can still level up where the answer is on screen. She is bored today, so that order is deliberate.
- **Changed pacing breaks the old walkers.** `walk.mjs` and `sweep.mjs` wait for fixed moments. A1 replaces them as the gate.
- **Voices.** A changed sentence means a new recording. Units B3 and B4 reuse existing clips where they can and list every new line first.

## Appendix. Every mission at a glance

"Keep" means only the shared fixes of release 2 apply. The findings behind each line are in `docs/REVIEW-2026-11.md` and `tools/playtest/after-review-2026-11/FINDINGS.md`.

| Mission | Verdict | Main reason |
|---|---|---|
| Kitty Park | Keep, start at 4 | Levels 1, 2, 3, 5, 6 are matching the bubble |
| Balloon Hill | Fix in B3 | The letter is shown at every level |
| Name Train | Fix in B1 and D12, deepen in E3 | 2.5 s of dead taps per letter |
| Cone Road | Keep, extend in E1 | Works. The top is 10 |
| The River | Keep, extend in E1 | Levels 1 to 3 are matching |
| Treat House | Fix in B2 and D12, deepen in E2 | The bowl shows the answer after one guess |
| The Lookout | Fix in B3 and B4, deepen in E | "One floor up" is answered by a sign. 16 s per ride |
| Pup Delivery | Fix in D12 | A small lift posts the parcel |
| Pup Picnic | Fix in D12 | Overlapping bones, tap zones |
| The Garage | Fix in D12, extend in E4 | The holes do not count |
| Mercury | Keep, small fixes in D11 | Works |
| Venus | Fix in D11 | Low contrast, one wrong tap names the shape |
| Moon | Fix in B1, B3, D9 | Dropped taps, tiny footprints |
| Mars | Fix in D11, extend in E1 | Levels 1 to 3 are matching |
| Jupiter | Fix in B3 | The answer is always orange |
| Saturn | Rebuild in D5 | No level asks anything |
| Pluto | Rebuild in D6 | Always the heart |
| Black Hole | Rebuild in D7 | The Moon's game with 25 s of watching |
| Comet | Fix in B3 and D11 | Matching, and comets jump |
| Star Pictures | Fix in B3, extend in D8 | The bubble shows the next number |
| Telescope | Fix in D10 | The order cannot be worked out |
| Lighthouse | Fix in B1 and D4 | Dropped taps, level 4 makes no sense |
| Floats or sinks | Rebuild in D1 | The water cannot be seen. Guesses are not scored |
| Reef | Rebuild in D2 | The scenes cannot be read |
| Port | Fix in B3 and D3 | Level 3 needs reading |
