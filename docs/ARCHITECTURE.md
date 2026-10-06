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
constructor(game, kind)   level = levelFor(kind); L = settingsFor(kind); rounds = CONFIG.roundsPerMission
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
| `pup-patrol-progress` | `{ v: 1, missions: { [kind]: { level, good, lastAcc } }, items: { [prefix+item]: { n, ok } } }` | `progress.js` |
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
- No drag-and-drop yet. No multi-touch handling (every pointerdown is a tap).

## Reusable helpers worth keeping

`animate(ms, fn, ease)`, `wait`, `hop` (squash & stretch), `wiggle`, `Mission.success/hint/jumpTo/dropIn`,
`sparkle/fireworks/dust`, `ui.bubble` modes (big, dots, word+at, seq, passthrough), `pickTarget`, `distractors`
(lookalike-aware), `numberChoices` (±1 neighbours), `parseGame` (pure, testable).

## Debug routes

`#letters #balloons #name #cones #stones #counting #lookout` (jump straight into a mission), `#avatar` (character close-up),
`#reset`, `?q=low|medium|high` (force graphics tier), `?perf` (draw calls/frame stats in `window.__perf`),
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
7. **Mission length is fixed at 5 rounds** (Lookout = 5 trips, River = 3 crossings), longer than the brief's targets (Phase 5).
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
