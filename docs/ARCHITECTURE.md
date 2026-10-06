# Architecture (audit before the learning-system roadmap)

Snapshot of how the game works today, written before Phase 1 of `docs/ROADMAP.md`.
Plain JavaScript (ES modules) + three.js r186, built with Vite 8, deployed to Vercel as a PWA.
Tests: `npm test` (Node's built-in runner, `tests/`).

## Map of the code

| Area | Files |
|---|---|
| Boot, routing, PWA registration | `src/main.js` |
| Renderer, frame loop, tweens, taps, `Stage` base | `src/engine.js` |
| Post-processing (bloom, tilt-shift, grade, quality tiers) | `src/fx/post.js` |
| Draw-call merging | `src/fx/optimize.js` |
| Particles, paw-wipe transition | `src/fx/particles.js`, `src/fx/transition.js` |
| Missions | `src/scenes/mission.js` (base) + `letters.js` (Kitty Park), `balloons.js`, `name.js` (Name Train), `cones.js`, `stones.js` (River), `counting.js` (Treat House), `lookout.js` |
| Hub (Adventure Bay) | `src/scenes/hub.js` |
| Characters / models / world | `src/characters.js`, `src/models.js`, `src/world/*.js`, `src/textures.js`, `src/scenery.js` |
| Levels (data from `GAME.md`) | `src/levels/parse.js` (pure parser + schema), `src/levels/data.js` (loads GAME.md), `src/levels.js` (assist, distractors, number choices) |
| Progress / adaptivity | `src/progress.js` |
| UI overlay (HTML) | `src/ui.js`, `src/style.css` |
| Audio + speech | `src/audio.js`, `src/voice-key.js`, `src/lang/pl.js` (every spoken line) |
| Settings | `src/config.js` |
| Tooling | `scripts/check-levels.mjs` (`npm run check`, runs before build), `scripts/voices.mjs` (`npm run voices`) |

## Scene lifecycle

- `engine.setStage(stage)`: marks the old stage `alive = false`, calls `exit()`, disposes its geometry,
  clears all tweens, then `enter()` → `collect()` (finds `userData.tick` objects) → `optimizeScene()` → post-processing setup.
- `main.js` wraps every switch in `pawWipe()` (`game.hub()`, `game.startMission(kind)`); the wipe ignores requests while running.
- **Stage** (engine.js): `scene`, `view {pos, look, minWidth}` (camera framing, read every frame), `post` (tilt-shift settings),
  `tappable(obj, fn)` / `untap`, `onUpdate(fn)` (returns an unsubscribe), `update(dt, t)`.
- Async flows check `this.alive` after every `await`; tweens of a dead stage never resolve, which ends those flows.

## Mission interface (`src/scenes/mission.js`)

```
constructor(game, kind)   level = levelFor(kind); L = settingsFor(kind); rounds = L.rounds (GAME.md "rounds" column)
enter()                   build() → missionHud() → character idle updater → run()
run()                     for r in rounds: missed=false; roundItem=null; await round(r);
                          firstTry += !missed; recordItem(roundItem, !missed); paw fills
                          → await outro() → finish()
finish()                  badge + recordMission(kind, firstTry, rounds) → level up? → celebrate
```

Subclasses implement `build()`, `round(r) → Promise` (resolves when solved) and optionally `outro()`.
Every round follows the same pattern today:

1. pick a target with `pickTarget(pool, prefix, this.last)` and call `this.item(prefix + target)`
2. show the bubble (`ui.bubble`) and `this.ask(T.…)`
3. on a tap: `this.poke()` (reset idle timer), `this.lookAt(obj)`
4. right → `stopIdle()`, animation, `this.success(pos)`, `say(...)`, `resolve()`
5. wrong → `wrong++`, `this.miss()`, `sfx.oops()`, wiggle, `say(thatsX + whereY)`, and after 2 wrong `this.hint(obj)` (pulse)
   (River "next" mode and Lookout "relative" mode also *reveal* the number after the first slip)

Helpers on the base: `ask/poke/stopIdle` (prompt + idle repeat every `idleRepeatSeconds` = 12 s, **verbatim, forever**; replaced in Phase 4),
`success` (sparkles, happy faces, camera push), `hint` (pulse), `dropIn`, `shrinkAway`, `jumpTo`, `shadowUnder`,
`lookAt`, `cheer`, `praise`, `meadow` (shared world), `addHeroes`.

Item prefixes in use: `L:` letters (Kitty Park, Balloon Hill, Name Train), `N:` numerals (Cone Road, Lookout),
`Q:` give-N (Treat House), `H:` how-many (Treat House). The River records no items.

## Persistence model (localStorage, per device)

| Key | Shape | Owner |
|---|---|---|
| `pup-patrol-progress` | `{ v: 3, missions: { [kind]: { level, good, lastAcc } }, items: { [prefix+item]: { n, ok } }, skills, sessions }` (see `progress/migrations.js`) | `progress.js` |
| `pup-patrol-badges` | `{ [kind]: count }` | `ui.js` (`badges`) |
| `pup-patrol-quality` | `'low' / 'medium' / 'high' / 'medium-locked'` | `fx/post.js` |

- Migration exists once: a missing/old `progress` is rebuilt from badge counts (`level = 1 + badges / 2`), so stars are never lost.
- Writes are synchronous on every change, wrapped in try/catch (private mode etc.).
- `#reset` clears progress and badges.

## Progression and adaptivity (today)

- **Mission level** (`progress.js`): a run is "good" at ≥ 70% first-try rounds; `goodRunsPerLevel` (2) good runs → next level
  (up to the number of rows in GAME.md). Never goes down.
- **Assist** (`levels.js` ASSIST): if the last run was < 45% first-try, the next run uses gentler settings
  (fewer choices, answer shown…). Per mission, coarse.
- **Item selection** (`progress.pickTarget`): weighted random over the pool; weight 1.6 for new (seen < 2),
  0.6–3 by miss rate otherwise; never the same item twice in a row.
- **Level data**: `GAME.md` tables → `parse.js` (schema, limits, cross-checks) → `LEVELS`. `npm run check` validates
  and lists unrecorded voice lines; the build fails on errors.

## Audio

- `sfx.*`: synthesised Web Audio effects (no files): pop, good, oops, bark, meow, ding, siren, fanfare…
- `say(segments)`: plays pre-recorded ElevenLabs clips (`public/voice/<key>.mp3`, key = hash of text + voice + model + settings)
  through Web Audio, with `CONFIG.voicePause` between segments; falls back to the device's Polish TTS for anything unrecorded.
  A newer `say()` interrupts the current one. `hush()` stops everything.
- Every line lives in `src/lang/pl.js` (`T.*`); `allSegments(levels, letters)` lists everything the level data can make the
  game say, which `npm run voices` records.

## Input

- 3D taps: one `pointerdown` listener on the canvas. Raycast against `stage.tappables`; if nothing is hit, the nearest
  tappable within 14% of the screen (projected position + `userData.tapHeight`) is chosen. **Taps that hit nothing are
  currently ignored** (no signal).
- HTML: overlay in `#ui` (`:where(#ui > *)` catches taps by default; the top bar and passthrough bubbles let them through).
  Elevator panel buttons (`ui.liftPanel`), home/again buttons, the bubble (tap = repeat the question).
- Drag and drop since Phase 13 (`stage.draggable`). No multi-touch handling (every pointerdown is a tap or a drag).

## Reusable helpers worth keeping

`animate(ms, fn, ease)`, `wait`, `hop` (squash & stretch), `wiggle`, `Mission.success/hint/jumpTo/dropIn`,
`sparkle/fireworks/dust`, `ui.bubble` modes (big, dots, word+at, seq, passthrough), `pickTarget`, `distractors`
(lookalike-aware), `numberChoices` (±1 neighbours), `parseGame` (pure, testable).

## Debug routes

`#letters #balloons #name #cones #stones #counting #lookout` (jump straight into a mission), `#avatar` (character close-up),
`#reset`, `#parent` (read-only progress page for grown-ups: `src/parent/`), `?q=low|medium|high` (force graphics tier), `?perf` (draw calls/frame stats in `window.__perf`),
`window.__pup` (`game`, `getStage()`, `camera`, `allSegments()`).

## Learning events (Phase 1)

```
scene ── question(skill, item) / correct(chosen) / wrong(chosen) / helped(level) ──▶ Mission base
engine tap that hits nothing ── onMissTap() ──────────────────────────────────────▶ Mission base
Mission.ask() → prompt finished │ idle repeat → timeout │ bubble tap → replay (help 1) │ hint() → help 3
                                       ▼
                        QuestionTracker (src/learning/question.js)
                        first try · attempt · latency · help level · overTap detection
                                       ▼
                        LearningBus `learning` (src/learning/events.js) ──▶ subscribers (Phase 2+)
```

- **One open question at a time** per mission. Re-asking the same skill + item keeps its timer.
- **Latency** is measured from the end of the first spoken prompt (or from opening, if she answers earlier).
- **firstTry** = solved with no wrong choice before it. Miss taps and timeouts are recorded but don't cost the first try.
- **Help levels:** 1 question repeated (short prompt, retry line or bubble tap) · 2 clue (hint / simplify)
  · 3 answer revealed (pulse). See *Unified help* below.
- **overTap:** 3+ taps within 1.2 s (the burst's wrong taps still count as attempts).
- Events live in memory only (last 200), on `window.__pup.learning`; `?learnlog` prints them to the console.
  The legacy `items` stats and mission levels are unchanged and still drive the game.

| Mission | Skill | Item |
|---|---|---|
| Kitty Park (`letters`) | `letterVisual`; `letterAudio` when only the picture is shown | letter |
| Balloon Hill | `letterVisual`, one question per balloon to find | letter |
| Name Train | `letterVisual` | letter |
| Cone Road | `numeral`; `quantity` when the bubble shows only dots | number |
| River (`stones`) | `numeral`; `sequence` for "what comes next" steps | number |
| Treat House (`counting`) | `counting` (give N); `quantity` (how many?) | number |
| Lookout | `numeral`; `sequence` for "one floor up/down" | floor |

## Unified help (Phase 4)

One pure state machine (`src/learning/assist.js`) drives help in every mission; the `Mission` base runs it
(`tickAssist` every frame, `wrong()` on a wrong pick) and scenes only say *how* help looks via hooks:

```js
this.question(skill, item, {
  short,       // segments (or a function) for the short prompt: "Gdzie jest Be?"
  hint(),      // a clue; may return segments to say ("Be jak banan!") or a promise if it speaks itself
  simplify(),  // make it easier (e.g. this.removeOption(wrongBlock))
  reveal(),    // show the answer (this.hint(obj) pulses it); she still taps it herself
});
this.wrong(chosen, T.thatsLetter(chosen));   // the base says it, then the next help step
```

| Quiet (since the prompt ended or her last tap) | Action | Level |
|---|---|---|
| ~5 s | short prompt | 1 |
| ~11 s | hint (also logged as a `timeout`) | 2 |
| ~18 s | reveal + short prompt | 3 |
| ~30 s | one last short prompt, then silence | – |

| Wrong pick | Action | Level |
|---|---|---|
| 1st | "To jest X. Spróbuj jeszcze raz!" | 1 |
| 2nd | simplify + short prompt | 2 |
| 3rd+ | reveal + short prompt | 3 |

- Steps already covered by wrong taps are skipped (help never steps back down); no help fires while the game is speaking.
- Timings: `CONFIG.assistSeconds`. Wrong taps play a soft "hm?" (`sfx.oops`) and a wobble; nothing red.

| Mission | hint | simplify | reveal |
|---|---|---|---|
| Kitty Park | letter shown in the bubble + "Be jak banan!" | the block she picked leaves | block pulses |
| Balloon Hill | balloons slow down + "Be jak banan!" | a wrong balloon floats away | target balloons pulse |
| Name Train | ghost letter on the wagon + "Zet jak Zosia!" | an extra block leaves (or the right one steps forward) | block pulses |
| Cone Road | bubble shows numeral + dots, "Trzy kropki!" | a wrong cone leaves | sign pulses |
| River | number shown (in "what's next?" mode) or "Trzy kropki!" | number shown | stone pulses |
| Treat House | give: the N spots light up · how many: count together | how many: a wrong block leaves + count together | box pulses / block pulses |
| Lookout | number + dots in the bubble, "Trzy kropki!" | number shown | button pulses |

Tests: `tests/learning/assist.test.js` (state machine). `window.__sayLog = []` collects every spoken line, for browser tests.

## Sessions (Phase 5)

```
start button ─▶ startSession()            src/session/session.js (live state) + director.js (pure rules)
learning events ─▶ noteEvent()             recent latency / help / errors (for Phase 6 fatigue checks)
Mission.finish() ─▶ missionDone(kind) ─▶ progress.recordSession(summary)   (saved: sessions.count, recent ≤ 30)
Hub.enter() ─▶ nextStep() / suggestNext()  'mission' → suggest a place · 'finale' → the Lookout · 'free' → nothing
```

- A session = `CONFIG.session.missions` (2) regular missions → the Lookout as finale → free play. A break of
  `newAfterMinutes` (15) starts a new one. The Lookout played early is an ordinary mission.
- Suggestions alternate letter and number games and prefer places not played yet this session. The suggested
  place's star grows and sparkles; nothing is ever locked. Hub nudges when she is quiet: at most 2 per visit, none in free play.
- Mission lengths come from GAME.md (`rounds`), following the brief: Kitty Park 4, Balloon Hill 2–3, Name Train 1 word,
  Cone Road 3, River 1–2 crossings, Treat House 3, Lookout 1–2 trips. A "good run" is now ≥ 65% first try (2 of 3).

## Tiredness (Phase 6)

`src/session/attention.js` (pure) scores the last 5 answers against the session's first 4, from 0 to 1:
answers slower (median, so one long pause doesn't count) · random-tap bursts · silences (timeouts) · replays ·
more help than at the start. Weighted sum → `ok` (≥ 0.6) · `tired` · `finish` (< 0.35); thresholds in `CONFIG.attention`.
Nothing is judged before 5 answers.

Checked by `Mission.checkAttention()` between rounds (always right after a success):
- **tired** → no new items (`TIRED_MIX`), and the session's finale comes after this mission (`shorten`).
- **finish** → "Jeszcze tylko jedno, Zosiu!", the next round is the last and uses an item she knows (`EASY_MIX`),
  celebration, then the hub says goodbye ("czas na odpoczynek") and stays quiet (`windDown`; saved as `early`).
  The Name Train finishes its word instead of being cut short.
`?learnlog` also prints the attention state when it isn't ok.

## Adventure Bay remembers (Phase 7)

```
Mission.finish() ─▶ onMissionComplete(kind, { completions, finale })      src/adventure/rewards.js (the only writer)
                      └─ milestoneRewards() → ids ─▶ applyReward(world, id)  src/adventure/world.js (pure: rules, dedupe, caps)
                      └─ world.unseen += id ─▶ progress save (v4: world)
Hub.enter() ─▶ addWorld(hub, world, takeUnseen())                          src/scenes/hub-world.js (drawing + reveal)
```

| Milestone | Reward id | On the island |
|---|---|---|
| Kitty Park finished (each time, up to 6) | `kitten-N` | a rescued kitten wanders near the park, meows when tapped |
| Balloon Hill finished (each time, up to 5) | `balloon-N` | a balloon tied to the Lookout |
| The River (first time) | `bridge` | an arched bridge over the pond |
| Name Train (first time) | `train` | rails round the beach, a little train with her name |
| the session finale (first time) | `lookout-lights` | chasing party lights on the Lookout |

- Each id counts once, ever (replays never duplicate). Existing players get rewards for their badges on upgrade (shown, not announced).
- New things pop in with sparkles and one line ("Zobacz! Nad rzeką stoi nowy most!"); `world.unseen` survives a reload.
- Cost: everything unlocked adds ~45 draw calls (kittens are instanced; train and balloons flattened).
- Taps: invisible place zones (`userData.zone`) give way to a real tappable object behind them.
- Engine: tweens now start when requested (they used to start at the last frame's time, skipping up to 33 ms when idle).

## Island events (Phase 8)

`src/adventure/events.js` (pure): at most one event per hub visit, chosen from the session director's step and suggestion.

| Event | When | On the island | Tap → |
|---|---|---|---|
| `lookout-alarm` | the finale is due | flashing red beacon + bands on the Lookout, siren, "Alarm w Bazie!" | the Lookout |
| `lost-kitten` | Kitty Park is suggested | a kitten up a tree with a "!" bubble, meowing | Kitty Park |
| `balloons-escaping` | Balloon Hill is suggested | lettered balloons rising from the hill | Balloon Hill |

- Events are stories for the suggestion, never locks: every place stays tappable; ignoring one is fine.
- The session remembers the shown event (`pendingEvent`); finishing its mission records it in `world.completedEvents`.
- Hub nudges repeat the story (with a meow / pop / siren), at most twice. `window.__pup.dev.suggest = 'letters'` forces a suggestion (tests, Phase 17 dev tools).

## The Lookout as the session finale (Phase 9)

`LookoutMission` has two modes, chosen when it starts: the normal mission, or the **finale** when the session
director says it is due (the hub's alarm called her there; playing the Lookout earlier is the normal mission).

Finale: alarm on (red beacon on the tower, the car's light flashes red, siren, Chase barks) → "Alarm w Bazie! Szybko,
wsiadamy do windy!" → **one easy press** (floors 1–3, numeral + dots, a number she knows: `EASY_MIX`) → floors counted
aloud → the very top (siren, all signs light up, the beacon flashes faster) → the slide → big celebration
("Hura! Psi Patrol uratował dzień!"). About 30 s. It doesn't count towards the Lookout's level (`countsForLevel = false`).

## Micro-play rewards (Phase 10)

After each finished mission (not after the finale, not at the session's start) the hub opens with ~9 s of pure play:
`adventure/micro.js` (pure) picks one she can have and not one of the last two; `scenes/hub-micro.js` runs it.

| Type | What sparkles | Tap → |
|---|---|---|
| HONK | the cruiser (ring + pulse) | horn, bounce |
| SIREN | the cruiser | siren + flashing lights |
| BUBBLES | bubbles float up around the heroes | pop (blip + sparkle) |
| CHASE_DANCE | Chase (pulse) | spin, bounce, a little tune, a bark |
| PET_KITTEN (needs a rescued kitten) | the nearest kitten trots over to the cruiser | meow, hop, Chase is happy |
| TRAIN_WHISTLE (needs the train) | the island train | whistle, puff |

No speech, nothing to get wrong, nothing blocked: the hub's usual line and every place work meanwhile, and the
invitation fades by itself. The cruiser always honks when tapped. `window.__pup.dev.micro = 'BUBBLES'` forces one.

## Kitty Park V2 (Phase 11)

Six levels, each meeting a letter a different way (GAME.md `ask`), not just more blocks:

| Level | ask | The bubble | She hears | Skill |
|---|---|---|---|---|
| 1 | match | the letter | "Znajdź taką samą!" (no name) | letterVisual |
| 2 | name | the letter | "Kotek się schował! Znajdź Be!" | letterVisual |
| 3 | audio | 🐱 | "Kotek się schował! Znajdź Be!" | letterAudio |
| 4 | name + similar | the letter | lookalikes (B/P/R, E/F, O/C, M/W) among the blocks | letterVisual |
| 5 | word | its picture | "Be jak banan! Znajdź Be!" | letterAudio |
| 6 | sound | 👂 | "Która literka robi: mmmm?" (SOUNDS: letters you can hold) | letterSound |

- **Level gates** (`src/levels/gate.js`, GAME.md `needs`): level 6 opens only when the average letterAudio mastery over
  its letters is ≥ 0.6 — good runs alone are not enough. Any mission's level can have a gate.
- Older tables with `show` still parse (`letter` → name, `picture` → word). A gentler run after a rough one asks
  an easier way (audio/word → name, sound → word).

## Name Train V2 (Phase 12)

Nothing is spelled from memory: the word is always there to look at. GAME.md `mode`:
`ghost` (faint letters on the wagons: match) → `word` (the word in the bubble, wagons empty: which comes next?) →
`missing` (the train arrives loaded with a gap, "Z _ S I A": which one? `gaps` 1–3) → `highlight` (the word with the
next letter lit, for new words). `NameMission.fill` lists the wagons she fills; at the end the letters are said
in word order, then the word, and the train drives off. `ui.bubble({ word, at, done })` can now mark letters done
without lighting the next one.

## Drag and drop + Treat House V2 (Phase 13)

- `stage.draggable(obj, { height, onDrop(obj, point) → accepted?, onTap, onPick })` (`src/input/drag.js`): the engine
  starts a drag when a pointerdown lands on a draggable; it follows the finger across the plane y = height, is
  dropped on release (not accepted → floats back). A press that barely moves is a tap → `onTap`: the fallback for
  anyone who can't drag yet. Frames stay at full rate while dragging.
- Treat House "give": a pile of treats in front of the box (a few more than needed); she moves them to Chase one by
  one (drag, or tap one: it hops over), each onto its own spot of a ten-frame, counted aloud. GAME.md `slots`:
  ghost spots ○○○ early, none later (the clue shows them); `auto no`: she decides when to stop and taps Chase
  (too many → the extras go back to the pile, one by one).

## Number play V2 (Phase 14)

- **Cone Road**: dot patterns `line` (rows of five) or `dice` (1–6, recognised at a glance: `DICE` in textures.js, also
  in the bubble). New question `bubble: name`: "Który pachołek ma cztery kropki?" with dots-only signs (`sign: dots`),
  skill quantity. `count: no`: on success just "Cztery!" — the dots are counted aloud only at the early levels.
- **River** `bubble: missing`: the stones lie in order with one gap ("1 ? 3 4"); two stones wait on the bank (the
  missing number and one that isn't on the path). She drags the right one in (or taps it), then Zosia hops across by
  herself, counting — the crossing is the reward. Skill sequence.

## New missions (Phases 15–16)

Two new places behind the Lookout (where two houses stood); their roads curve straight out of the back of the
roundabout (`PLACES[kind].via`).

- **Pup Delivery** (`delivery`, the post office, letters side): first sounds, skill letterSound.
  `pictureSound`: parcels with pictures, "Co zaczyna się na Ka?" → tap the cat. `soundLetter`: letter mailboxes and
  one parcel with a picture, "Do której skrzynki pójdzie kot?" → drag the parcel into K (or tap the mailbox).
  Picture words are the game's `WORDS`. Sound-alikes (P/B, T/D, K/G, S/Z, W/F, M/N) are kept apart unless `similar`.
- **Pup Picnic** (`picnic`, numbers side): more / less / the same by looking, skill comparison (item = the mode, `#`
  with numerals). Two blankets of treats (`same`: compared with Chase's plate); later the blankets show numerals and
  the treats appear afterwards. No < > signs. The clue lines both groups up in rows side by side (one-to-one: the
  longer row has more). Chase trots over and eats the right ones.

## Grown-ups' page (Phase 17)

`#parent`, or press and hold the badge shelf for 3 seconds (opens over the game; a child's tap does nothing).
- What she knows: per letter / number and skill — mastery, answers, first try, help, answer time, mix-ups.
- Sessions: how many, average length, recent ones (with "finale ✓" / "wound down early"), and **what changed lately**:
  each session saves its biggest mastery changes (`summary.changes`: from → to, worked out from the events).
- Developer tools (collapsed): mission levels − / +, "all missions to the top level", set a mastery value, "next trip"
  (lost kitten / balloons / Lookout alarm → finale, via `parent/next.js`), clear mastery, clear the island, reset
  everything. Anything that erases needs a 1.5 s press-and-hold (`holdToConfirm`).
- Wording avoids conclusions: "estimates from play, not a test", little-data rows are faded.

## Findings relevant to the roadmap

1. **Learning logic is spread across scenes.** Each of the 7 missions re-implements wrong counting, the 2-strike pulse hint and
   its feedback lines. Good candidate for the unified assist system (Phase 4).
2. **One stat per item mixes skills.** `L:B` is fed by Kitty Park level 1 (visual match), Kitty Park level 3 (audio only),
   Balloon Hill (visual scanning) and Name Train (sequencing). Phase 2 needs per-skill stats.
3. **No timing data.** No latency is measured anywhere.
4. **Motor errors are invisible or counted as knowledge errors.** A tap beside a balloon is ignored; a wrong balloon counts the
   same as not knowing the letter.
5. ~~The idle prompt repeats verbatim every 12 s, forever.~~ Replaced by the help ladder (Phase 4).
6. ~~Red "wrong" UI exists in one place~~ (elevator button flash): removed in Phase 4.
7. ~~Mission length is fixed at 5 rounds~~: per-mission `rounds` in GAME.md (Phase 5).
8. **River records no items**, so its numbers never influence selection.
9. **No tests.** Pure logic (parser, progress, item picking) has no automated coverage.

## Proposed extension points

- **`Mission` base** is the natural place to collect learning events: every scene already calls `item()`, `miss()`, `poke()`,
  `hint()` and resolves its round there. Adding `question / correct / wrong` there keeps scenes small.
- **`engine` tap handler** can report "tap hit nothing" to the current stage (`stage.onMissTap?.()`), the only place that knows.
- **`progress.js`** stays the persistence owner; later phases add optional fields next to `missions` and `items`
  (`skills`, `world`, `sessions`) behind a versioned migration.
- **`GAME.md` schema** (`parse.js` `SCHEMA`) is where new per-level options are added (modes, rounds, dot layouts…).

## Migration strategy

- Never rename or drop existing localStorage fields; add optional fields and fill defaults on load.
- Introduce an explicit `migrate(state)` with a schema version when the first new persisted field lands (Phase 2),
  covering: no state, v1 state, and badge-only state. Each step is a pure function with a test.
- Keep the legacy `items` stats running alongside mastery until the scheduler (Phase 3) replaces `pickTarget`,
  so selection behaviour never regresses during the transition.
