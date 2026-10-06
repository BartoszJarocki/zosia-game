<!-- Implementation brief provided by Bartosz (2026-10-06). Work through it phase by phase; see §33–§35. -->

# Zosia's Pup Patrol — Gameplay & Learning System Implementation Plan

## Purpose

This document is the implementation brief for improving **Zosia's Pup Patrol**, a Three.js educational game designed primarily for a 3-year-old child.

The existing game already has a strong foundation:

- touch-first interaction
- no reading required
- Polish spoken instructions
- no punishment for mistakes
- adaptive difficulty
- persistent progress
- multiple educational missions
- Adventure Bay as a central hub
- short mission-based gameplay
- offline/PWA support
- iPad and desktop support

The goal is **not** to rewrite the game.

The goal is to evolve it from a collection of educational mini-games into a coherent, replayable adventure where:

1. learning progress is tracked across missions,
2. difficulty adapts to actual skills,
3. the world reacts to the player's achievements,
4. missions feel like meaningful events,
5. sessions have a beginning, middle, and ending,
6. educational tasks remain short and age-appropriate,
7. failure never feels punishing,
8. the game stays fun even when no learning question is being asked.

---

# 1. Core Product Principles

All implementation decisions must follow these rules.

## 1.1 The player is three years old

Do not design interactions assuming:

- reading ability,
- precise mouse-style control,
- working memory comparable to an older child,
- understanding of menus,
- understanding of abstract progression systems,
- patience for long instructions.

Interactions should be:

- obvious,
- large,
- visual,
- spoken,
- forgiving,
- immediately responsive.

---

## 1.2 Learning should be embedded in play

The game should not feel like:

> question → answer → question → answer → score

Prefer:

> adventure → problem → interaction → success → playful reward → continuation

The player should feel that she is:

- rescuing a kitten,
- helping Chase,
- crossing a river,
- driving somewhere,
- feeding a puppy,
- riding an elevator,

rather than "doing a letter exercise".

---

## 1.3 Never punish mistakes

Do not:

- remove stars,
- remove rewards,
- play harsh failure sounds,
- reset meaningful progress,
- end missions because of mistakes,
- show red "wrong" UI,
- reduce accumulated achievements.

Mistakes should trigger progressively stronger help.

Every interaction should eventually result in success.

---

## 1.4 End on success

If the game detects fatigue or repeated difficulty, do not continue increasing pressure.

Instead:

1. make the next interaction easier,
2. let the player succeed,
3. celebrate,
4. naturally finish the session.

---

## 1.5 Prefer short interactions

For this age group, shorter is better.

Do not artificially force every mission into exactly five rounds.

Suggested rough duration:

| Mission | Preferred length |
|---|---:|
| Kitty Park | 3–5 answers |
| Balloon Hill | 30–45 seconds |
| Name Train | 1–2 words |
| Cone Road | ~3 obstacles |
| River | 1–2 crossings |
| Treat House | ~3 tasks |
| Lookout | 1 trip |

Always prefer ending slightly too early rather than slightly too late.

---

# 2. General Engineering Rules

Before modifying anything:

1. Inspect the existing implementation.
2. Understand the current abstractions.
3. Reuse existing helpers and scene infrastructure.
4. Do not replace working architecture without a concrete reason.
5. Keep changes incremental.
6. Keep gameplay logic testable without Three.js wherever possible.

Do **not** perform a large rewrite.

---

## 2.1 Preserve existing functionality

The following must continue working:

- direct mission debug routes such as `#cones`
- progress persistence
- existing saved games
- offline/PWA functionality
- iPad touch controls
- desktop controls
- Polish speech
- `npm run check`
- `npm run build`
- existing level-data workflow

---

## 2.2 Keep learning logic outside Three.js scenes

Scenes should primarily handle:

- rendering,
- animation,
- touch input,
- game-object state,
- presentation.

Scenes should report learning interactions to a shared learning system.

A scene should **not** independently decide:

> "The player knows letter B."

Instead:

```text
scene
  ↓
learning event
  ↓
learning engine
  ↓
mastery state
```

---

# 3. First Step: Repository Audit

Before implementing Phase 1, inspect at minimum:

```text
src/scenes/
src/scenes/hub.js
src/config.js
src/lang/pl.js
```

Also identify:

- persistence/storage implementation,
- mission lifecycle,
- scene transitions,
- audio helpers,
- touch/input helpers,
- celebration effects,
- current weak-item/adaptive selection logic,
- level parsing,
- debug routes.

Create or update an architecture document containing:

```text
- current scene lifecycle
- mission interface
- persistence model
- audio architecture
- input architecture
- reusable helpers
- current progression logic
- proposed extension points
- migration strategy
```

Do not refactor merely for stylistic reasons during this audit.

---

# 4. Target Architecture

Prefer approximately this structure where appropriate:

```text
src/
  scenes/
    hub.js
    kitty.js
    balloons.js
    train.js
    cones.js
    river.js
    treats.js
    lookout.js
    pupDelivery.js
    pupPicnic.js

  learning/
    events.ts
    mastery.ts
    scheduler.ts
    assist.ts

  session/
    director.ts
    attention.ts

  world/
    state.ts
    events.ts
    rewards.ts

  progress/
    storage.ts
    migrations.ts

  ui/
    parentDashboard/

  config.js

  lang/
    pl.js
```

This is a target organization, not a requirement to rename working files unnecessarily.

Adapt it to the existing repository.

---

# 5. Phase 1 — Learning Event Infrastructure

Implement a common learning-event model.

Every meaningful educational interaction should eventually be expressible as an event similar to:

```ts
interface LearningEvent {
  mission: string;

  skill:
    | 'letterVisual'
    | 'letterAudio'
    | 'letterSound'
    | 'numeral'
    | 'quantity'
    | 'counting'
    | 'sequence'
    | 'comparison';

  item: string;

  correct: boolean;
  firstTry: boolean;

  latencyMs: number;

  assistLevel: 0 | 1 | 2 | 3;

  errorType?:
    | 'wrongChoice'
    | 'timeout'
    | 'missTap'
    | 'overTap';
}
```

Exact naming may be adjusted to match the codebase.

The important distinction is between:

- what was being tested,
- which item was involved,
- whether it was solved,
- whether it was solved independently,
- how long it took,
- how much help was used.

---

## Error semantics

Do not treat every unsuccessful interaction as lack of knowledge.

For example:

- tapping another valid letter = `wrongChoice`
- tapping beside a moving balloon = possibly `missTap`
- doing nothing = `timeout`
- rapid random tapping = possibly `overTap`

Motor-control mistakes should not strongly reduce learning mastery.

---

# 6. Phase 2 — Skill Mastery Model

The current per-mission level system should initially remain in place.

Add a second layer that tracks actual skills.

Example:

```ts
interface SkillStat {
  attempts: number;
  correctFirstTry: number;
  assisted: number;

  mastery: number;

  avgLatencyMs: number;

  lastSeenAt: number;
}
```

Suggested persisted structure:

```ts
{
  skills: {
    letterVisual: {
      Z: { ... },
      O: { ... },
      S: { ... }
    },

    letterAudio: {
      Z: { ... }
    },

    letterSound: {
      B: { ... }
    },

    numeral: {
      "1": { ... },
      "2": { ... }
    },

    quantity: {
      "1": { ... }
    }
  }
}
```

`mastery` should be normalized to:

```text
0.0 → completely new / unknown
1.0 → strongly mastered
```

---

## 6.1 Initial mastery algorithm

Do not introduce machine learning.

Use something simple and inspectable.

Example:

```ts
newMastery =
  oldMastery * 0.8 +
  resultScore * 0.2;
```

Possible scores:

```text
correct first try     1.00
correct after hint    0.70
correct assist level 2 0.45
full answer reveal    0.20
wrong / unresolved    0.00
```

Keep latency as a separate metric initially.

Do not prematurely combine every measurement into one opaque score.

---

## 6.2 Storage migrations

Existing saves must remain valid.

When loading old state:

- add missing structures,
- preserve mission levels,
- preserve stars,
- preserve badges,
- preserve known progress.

Never reset progress simply because the schema changed.

Introduce explicit migration/default logic where needed.

---

# 7. Phase 3 — Adaptive Content Scheduler

Create a common scheduler responsible for deciding which educational items should appear.

Suggested API:

```ts
pickLearningItem({
  skill: 'letterAudio',
  candidates,
  recentItems,
  mastery,
});
```

The scheduler should consider:

- mastery,
- recent mistakes,
- `lastSeenAt`,
- recent repetition,
- whether an item is new,
- whether an item is currently being learned.

Approximate target distribution:

```text
50% currently learning
30% familiar / easy
15% difficult
5% new
```

These percentages do not need to be exact.

The intent is more important:

**do not fill sessions exclusively with weak items.**

The player needs frequent easy successes.

---

## 7.1 Avoid repetitive scheduling

The scheduler should avoid patterns such as:

```text
B
B
B
B
M
B
B
```

even if B is currently weak.

Use recency penalties or equivalent logic.

---

# 8. Phase 4 — Unified Assist System

Replace duplicated mission-specific help logic with a common assist model where practical.

Suggested state:

```ts
interface AssistState {
  level: 0 | 1 | 2 | 3;
  wrongAttempts: number;
  idleMs: number;
}
```

Suggested progression:

### Normal state

No help.

---

### Idle for approximately 5 seconds

Repeat a **shortened** prompt.

Instead of:

> "The kitten is hiding behind letter B. Find letter B."

say:

> "Where is B?"

---

### Continued hesitation

Provide a semantic hint.

Example:

> "B like banana."

---

### First wrong choice

Respond neutrally.

Example:

> "Try again."

Do not say:

> "Wrong."

---

### Second wrong choice

Increase help.

Possible mechanisms:

- remove one distractor,
- reduce distractor emphasis,
- visually strengthen the target clue,
- repeat a shorter clue.

---

### Third wrong choice / strong hesitation

Reveal the correct answer through:

- pulsing,
- glow,
- animation,
- pointing character,
- equivalent scene-specific cue.

The player must still perform the final interaction herself.

---

## 8.1 Scene integration

Allow scenes to provide assist hooks:

```ts
assist: {
  shortPrompt(),
  hint(),
  simplify(),
  revealAnswer()
}
```

Do not force every scene to assist in exactly the same visual way.

---

# 9. Phase 5 — Session Director

Introduce a layer above individual missions.

The current conceptual flow:

```text
hub
→ mission
→ celebration
→ hub
```

should evolve toward:

```text
start
→ hub
→ mission
→ small reward
→ hub/event
→ mission
→ Lookout finale
→ celebration
→ end / free exploration
```

Suggested session state:

```ts
interface SessionState {
  missionsCompleted: number;
  targetMissions: number;

  recentLatency: number[];
  recentAssistLevels: number[];
  recentErrors: string[];

  finaleTriggered: boolean;
}
```

Start conservatively.

For example:

```text
2 regular missions
→ Lookout finale
```

Avoid making a session long simply because more activities exist.

---

# 10. Phase 6 — Attention / Fatigue Heuristics

Implement simple heuristics.

Do not call external AI services.

Do not attempt psychological classification.

Look only for gameplay patterns such as:

- response latency increasing,
- repeated random taps,
- repeated timeouts,
- repeated prompt replay,
- rapidly increasing assist use.

Example conceptual score:

```ts
attentionScore = f(
  recentLatency,
  wrongTapRate,
  idleTime,
  repeatPromptCount,
  assistUsage
);
```

Possible rough interpretation:

```text
> 0.60 normal
0.35–0.60 potentially tired
< 0.35 finish soon
```

These thresholds must be easy to tune.

---

## 10.1 Graceful session ending

If fatigue is strongly suspected:

1. do not introduce new content,
2. make the next challenge easy,
3. announce something equivalent to:
   > "One more!"
4. let the player succeed,
5. celebrate,
6. end naturally.

Never end immediately after a failure.

---

# 11. Phase 7 — Persistent Adventure Bay

Adventure Bay should gradually change as the player completes activities.

Introduce persistent world state.

Example:

```ts
interface WorldState {
  rescuedKittens: number;

  bridgeBuilt: boolean;
  trainUnlocked: boolean;

  balloonsAtLookout: number;
  lookoutLights: boolean;

  completedEvents: string[];
}
```

Do not implement dozens of world mutations initially.

Start with three visible changes.

---

## 11.1 Kitty Park reward

After an appropriate Kitty Park milestone:

```ts
rescuedKittens += 1;
```

A rescued kitten should then appear somewhere in Adventure Bay.

It may:

- sit near the park,
- walk around,
- react to taps.

---

## 11.2 River reward

After an appropriate milestone:

```ts
bridgeBuilt = true;
```

A small bridge appears in the world.

---

## 11.3 Name Train reward

After an appropriate milestone:

```ts
trainUnlocked = true;
```

A small train can occasionally travel through Adventure Bay.

---

## 11.4 Centralized world rewards

Do not mutate persistent world state directly throughout scenes.

Prefer something like:

```ts
applyWorldReward('kitty-rescue-1');
```

The world reward system should own:

- duplicate prevention,
- persistence,
- milestone interpretation.

---

# 12. Phase 8 — Adventure Bay Events

The hub should gradually feel like a world rather than a mission menu.

Introduce optional world events.

Example model:

```ts
interface WorldEvent {
  id: string;
  mission: string;

  condition(state): boolean;

  voiceLine: string;

  icon?: string;
}
```

Examples:

### Lost kitten

Visual:

```text
🐱
```

Spoken:

> "Oh no! A kitten needs help!"

Selecting it opens Kitty Park.

---

### Balloons escaping

Visual balloons appear around Balloon Hill.

Selecting them launches the balloon mission.

---

### Lookout alarm

A flashing/sounding event appears after enough regular missions.

Selecting it launches the session finale.

---

## Important

Events must not lock the player out of other locations.

All normal locations remain usable.

Events are narrative recommendations, not forced progression.

---

# 13. Phase 9 — Lookout as Session Finale

Keep the existing educational elevator mechanic.

Add a second scene mode.

For example:

```ts
type LookoutMode =
  | 'mission'
  | 'sessionFinale';
```

---

## Session finale sequence

Suggested sequence:

1. Lookout alarm activates on Adventure Bay.
2. Chase reacts.
3. Vehicle travels to the Lookout.
4. Player performs one easy elevator-number task.
5. Elevator moves upward.
6. Floors are counted aloud.
7. Lookout lights/alarm activate.
8. Chase and Zosia reach the top.
9. Large playful action:
   - slide,
   - tube,
   - jump,
   - similar existing interaction.
10. Celebration.

Total target duration:

```text
approximately 45–60 seconds
```

Do not turn the finale into another long quiz.

---

# 14. Phase 10 — Micro-Play Rewards

Introduce tiny interactions that contain **no educational question**.

Possible API:

```ts
runMicroReward(type);
```

Initial reward types:

```ts
type MicroReward =
  | 'HONK'
  | 'SIREN'
  | 'BUBBLES'
  | 'PET_KITTEN'
  | 'TRAIN_WHISTLE'
  | 'CHASE_DANCE';
```

---

## Design requirements

A micro-reward should:

- last roughly 5–10 seconds,
- require no spoken explanation,
- produce immediate feedback,
- have no wrong answer,
- be optional or naturally time-limited,
- avoid blocking the game unnecessarily.

Examples:

### Vehicle

Tap:

- horn,
- police lights,
- siren.

### Kitten

Tap the kitten:

- kitten reacts,
- Chase reacts,
- small sound/animation.

### Train

Tap whistle:

- train whistle plays,
- train reacts.

### Bubbles

Tap to produce or pop bubbles.

---

# 15. Phase 11 — Kitty Park V2

Refactor Kitty Park to teach letters through progressively different representations.

Do not merely increase distractor count.

Suggested progression:

---

## Level 1 — Visual match

Prompt shows:

```text
B
```

Choices:

```text
B
M
T
```

Skill:

```text
letterVisual
```

---

## Level 2 — Symbol + spoken name

Prompt:

> "Find B."

The visual B is still present.

Skill:

```text
letterVisual
```

---

## Level 3 — Audio recognition

Prompt:

> "Find B."

Do not show the answer letter in the prompt.

Choices remain visible.

Skill:

```text
letterAudio
```

---

## Level 4 — Similar letters

Use deliberate visual confusions:

```text
B / P / R
E / F
O / C
M / W
```

Use age-appropriate combinations only.

---

## Level 5 — Letter + word connection

Example:

> "B like banana. Find B."

Include the known picture where useful.

---

## Level 6 — Sound / phoneme

Example:

> "Which letter makes bbb?"

Skill:

```text
letterSound
```

Do not force progress to this level solely because enough missions were completed.

Use mastery where appropriate.

---

# 16. Phase 12 — Name Train V2

Do not require a 3-year-old to spell words from memory.

The important skills are:

- letter recognition,
- sequencing,
- matching,
- noticing missing letters.

Suggested progression:

---

## Level 1

Ghost letters directly on wagons.

Example:

```text
Z O S I A
```

Player matches blocks to wagons.

---

## Level 2

Full word visible above the train:

```text
ZOSIA
```

Wagons are empty.

---

## Level 3

Missing-letter task:

```text
Z O _ I A
```

Choices:

```text
S
M
T
```

---

## Level 4

Full word remains visible, and the next required letter is highlighted.

---

## Spoken sequence

When placing letters:

> "Z"

> "O"

> "S"

> "I"

> "A"

At the end:

> "Z-O-S-I-A... ZOSIA!"

Then the train departs.

The departure is the reward.

---

# 17. Phase 13 — Treat House V2

Move toward physical one-to-one counting rather than repeated tapping.

Instead of:

```text
tap treat box three times
```

prefer:

```text
pile of treats
      ↓
drag
      ↓
Chase's bowl
```

Example:

> "Give Chase three treats."

Player drags:

```text
1 → "one"
2 → "two"
3 → "three"
```

Each object should visibly move from one group into the other.

---

## Progression

### Early

Show ghost slots:

```text
○ ○ ○
```

for a request of three.

---

### Middle

Remove ghost slots.

---

### Later

Player decides when finished and taps Chase.

Existing `auto` behavior can be adapted rather than removed.

---

# 18. Phase 14 — Number Gameplay Improvements

## 18.1 Cone Road — subitizing

Add structured dot patterns.

Possible layout modes:

```ts
type DotLayout =
  | 'linear'
  | 'dice';
```

For small values, especially 1–5, use dice-like arrangements.

Example:

```text
•   •
  •
•   •
```

should be recognizable as five without necessarily counting every dot.

Do not always count aloud automatically.

Allow questions such as:

> "Which cone has four dots?"

and on success simply say:

> "Four!"

---

## 18.2 River — missing numbers

Add a sequence-completion mode.

Example:

```text
1 → 2 → ? → 4
```

Available numbers:

```text
3
5
```

Player drags `3` into the missing stepping stone.

Possible mode:

```ts
mode: 'sequenceMissing';
```

After solving it, the character crosses the river.

The physical action is the reward.

---

# 19. Phase 15 — New Mission: Pup Delivery

Purpose:

**phonological awareness / first sounds**

---

## Early mode

Show pictures:

```text
🍌   🐱   🏠
```

Ask:

> "What starts with K?"

Player selects the cat.

Skill:

```text
letterSound
```

---

## Later mode

Show boxes:

```text
K
M
D
```

Show:

```text
🐱
```

Ask:

> "Which box does the cat go into?"

Player places the cat into `K`.

---

## Possible level data

Example:

```ts
{
  level: 1,
  pool: 'START',
  choices: 2,
  mode: 'pictureSound'
}
```

Then:

```ts
{
  level: 2,
  pool: 'START',
  choices: 3,
  mode: 'soundLetter'
}
```

Reuse the existing picture-word mapping where practical.

---

# 20. Phase 16 — New Mission: Pup Picnic

Purpose:

- more,
- less,
- same,
- visual quantity comparison.

Begin without numerals.

Example:

```text
🦴 🦴


🦴 🦴 🦴 🦴
```

Ask:

> "Where are there more?"

Modes:

```ts
type ComparisonMode =
  | 'more'
  | 'less'
  | 'same';
```

Only later introduce symbolic comparison such as:

```text
3     5
```

Do not introduce mathematical symbols such as `<` and `>` unless intentionally added much later.

---

# 21. Future Mission Candidate — Patterns

Do not implement this before the core architecture is stable.

A future mission could teach simple visual patterns.

Example:

```text
🔴 🔵 🔴 🔵 🔴 ?
```

Choices:

```text
🔴
🔵
```

Or:

```text
🐾 🐾 🦴 🐾 🐾 🦴 ?
```

This could naturally fit a construction/workshop-themed location.

---

# 22. Parent / Developer Dashboard

Add a hidden dashboard intended for adults, not the child.

Possible access:

```text
long press badge shelf for ~3 seconds
```

and/or:

```text
#parent
```

Do not expose adult statistics during normal gameplay.

---

## 22.1 Letter dashboard

Example:

```text
Z

visual   ██████████  95%
audio    ████████    82%
sound    █████       53%
```

Show at minimum:

- mastery,
- attempts,
- first-try accuracy,
- average latency,
- assist frequency.

---

## 22.2 Number dashboard

Example:

```text
4

numeral   83%
quantity  61%
sequence  55%
```

---

## 22.3 Session metrics

Useful metrics:

- sessions played,
- approximate session duration,
- average response latency,
- total assists,
- recent mastery changes,
- recently difficult items.

Avoid presenting uncertain metrics as precise psychological conclusions.

---

## 22.4 Developer controls

Provide convenient testing actions such as:

```text
Reset progress
Unlock all missions
Force mission level
Set mastery value
Clear mastery
Clear world state
Trigger world event
Trigger Lookout finale
```

Ensure destructive actions require deliberate adult interaction.

---

# 23. Vehicle / Hub Interaction

Travel between locations should remain mostly automatic.

Do **not** add difficult driving controls.

During travel, allow small playful actions such as:

- tap vehicle → horn,
- tap siren → lights/sound,
- tap roadside object → reaction,
- pass over a small ramp,
- collect a purely playful object.

These interactions should not become required objectives.

---

# 24. World Persistence Philosophy

Badges and stars should remain.

Do not add:

- coins,
- shops,
- currencies,
- energy systems,
- daily streak pressure,
- consumable rewards.

The most meaningful reward should be:

**the world visibly changes because of what the player did.**

Examples:

```text
rescued kitten stays in the park
bridge appears
train starts running
Lookout gains lights
balloons remain near the tower
new playful object appears
```

These are more age-appropriate than abstract currencies.

---

# 25. Progression Philosophy

Existing mission levels can remain as coarse progression.

Skill mastery becomes the more precise educational layer.

Long-term progression should distinguish:

```text
mission progression
≠
actual learning mastery
```

For example:

A child may be comfortable with Kitty Park Level 4 overall but still struggle with auditory recognition of `F`.

The scheduler should account for that without forcing the entire mission back to an easier level.

---

# 26. Response Latency

Track latency.

A correct answer after:

```text
800 ms
```

is meaningfully different from a correct answer after:

```text
7 seconds + repeated prompt
```

Do not initially turn latency into a dominant mastery penalty.

Store it and expose it for scheduling/analysis.

Later, it may contribute to confidence estimates.

---

# 27. Avoid Changing Too Many Difficulty Variables at Once

Current level progression should gradually move toward changing one primary dimension at a time.

Avoid transitions where one level simultaneously changes:

- candidate pool,
- number of choices,
- speed,
- number of targets,
- distractor similarity.

Prefer additional internal levels if necessary.

Example Balloon Hill progression:

| Level | Pool | Targets | Total | Speed | Similar |
|---|---|---:|---:|---|---|
| 1 | START | 1 | 4 | slow | no |
| 2 | START | 2 | 5 | slow | no |
| 3 | MORE | 2 | 5 | slow | no |
| 4 | MORE | 2 | 6 | medium | no |
| 5 | ALL | 2 | 6 | medium | no |
| 6 | ALL | 2 | 6 | medium | yes |

The child never needs to know these internal level numbers.

---

# 28. Audio Prompt Design

Avoid repeating long prompts verbatim.

Prefer progression:

```text
full prompt
→ short prompt
→ helpful clue
```

Example:

### Initial

> "The kitten is hiding behind B. Find B."

### Short repeat

> "Where is B?"

### Hint

> "B like banana."

Spoken lines should sound natural rather than mechanically repetitive.

---

# 29. Animation Rules

Animations should support comprehension.

Good examples:

- correct block flies away to reveal kitten,
- treat visibly moves into bowl,
- train departs after successful word,
- character hops across stones,
- elevator visibly moves between floors.

Avoid animations that:

- delay the next interaction too long,
- obscure tappable objects,
- create ambiguity about what is interactive,
- require waiting repeatedly.

Important gameplay objects should remain clearly visible and stable enough to tap.

---

# 30. Touch Interaction Requirements

All new mechanics must be designed for iPad touch first.

Requirements:

- generous hitboxes,
- no tiny targets,
- tolerate near misses,
- avoid hover-only interactions,
- avoid precision dragging,
- snap dragged objects into obvious targets,
- cancel/reset gracefully,
- do not punish accidental multi-touch.

For drag-and-drop:

- object follows finger clearly,
- valid destination becomes visually obvious,
- release near destination should snap,
- failed drop returns gently to origin.

---

# 31. Testing Requirements

Add automated tests for pure logic wherever reasonable.

High-value test targets:

```text
mastery calculations
scheduler weighting
storage migrations
assist progression
session director
attention heuristics
world reward idempotency
world event eligibility
```

Three.js visuals do not need exhaustive automated testing.

---

## Manual test scenarios

Before completing a phase, manually verify at minimum:

### Existing player

- old save loads,
- old stars remain,
- old levels remain,
- no crash due to missing new fields.

### New player

- clean start works,
- default mastery structures work,
- first mission works.

### Wrong-answer flow

- first wrong answer is neutral,
- assist escalates,
- final answer can always be completed.

### Idle flow

- short prompt occurs,
- hint occurs,
- no endless voice repetition.

### iPad/touch

- major interactions have sufficient hit area,
- drag actions are forgiving.

### Offline

- previously supported offline functionality still works.

---

# 32. Required Validation Before Completing Any Implementation Phase

Run the repository's relevant validation commands.

At minimum:

```bash
npm run check
npm run build
```

Also run:

```bash
npm test
```

or equivalent if tests are configured.

Do not declare a phase complete if the build is broken.

---

# 33. Implementation Order

Implement in the following order.

Do not attempt the whole roadmap in one change.

---

## PR / Step 01

**Learning event infrastructure**

Deliver:

- common event definitions,
- instrumentation path,
- first mission integrations,
- tests.

No meaningful UX redesign.

---

## PR / Step 02

**Skill mastery persistence**

Deliver:

- mastery storage,
- calculations,
- migrations,
- tests.

Existing mission-level progression remains.

---

## PR / Step 03

**Adaptive scheduler**

Deliver:

- shared scheduler,
- weak/familiar/new balancing,
- recency handling,
- tests.

---

## PR / Step 04

**Unified assist system**

Deliver:

- assist state machine,
- idle escalation,
- mission hooks,
- migration of at least one representative mission.

---

## PR / Step 05

**Session director**

Deliver:

- session state,
- mission counting,
- session progression,
- no major hub redesign yet.

---

## PR / Step 06

**Attention/fatigue heuristics**

Deliver:

- heuristic model,
- easy final task flow,
- successful session ending.

---

## PR / Step 07

**Persistent world state**

Deliver:

- storage,
- world rewards,
- first three visible persistent world changes.

---

## PR / Step 08

**Dynamic hub events**

Deliver:

- event system,
- event presentation,
- event-to-mission navigation.

---

## PR / Step 09

**Lookout session finale**

Deliver:

- finale mode,
- hub alarm,
- short narrative ending.

---

## PR / Step 10

**Micro-play rewards**

Deliver a reusable system plus several simple rewards.

---

## PR / Step 11

**Kitty Park V2**

Use it as the first complete demonstration of:

```text
mastery
+ scheduler
+ assist
+ revised learning progression
```

---

## PR / Step 12

**Name Train V2**

Implement sequencing-oriented progression.

---

## PR / Step 13

**Treat House V2**

Implement physical drag/drop counting.

---

## PR / Step 14

**Cone Road + River improvements**

Implement:

- subitizing,
- dice-dot layouts,
- missing-number sequences.

---

## PR / Step 15

**Pup Delivery**

Implement phonological-awareness mission.

---

## PR / Step 16

**Pup Picnic**

Implement quantity-comparison mission.

---

## PR / Step 17

**Parent dashboard**

Implement:

- mastery visualization,
- recent stats,
- developer tools.

---

# 34. Important Scope Rule

Do not implement multiple major phases at once unless explicitly requested.

For every phase:

1. inspect the relevant existing code,
2. describe the minimal architecture change,
3. implement it,
4. add/update tests,
5. validate,
6. summarize the result,
7. stop.

Do not continue into the next roadmap phase automatically unless instructed.

---

# 35. Required Agent Output After Each Phase

At the end of every implementation task, report:

## Changed files

Example:

```text
src/learning/events.ts
src/learning/mastery.ts
src/progress/storage.ts
src/scenes/kitty.js
```

---

## Architecture decisions

Briefly explain:

- why the design was chosen,
- what existing abstractions were reused,
- any intentionally deferred work.

---

## Persistence impact

State explicitly:

```text
No save migration required.
```

or:

```text
Save schema extended with optional `skills`.
Existing saves are migrated on load.
```

---

## Manual verification

List scenarios actually checked.

---

## Validation

Report results of:

```text
npm run check
npm test
npm run build
```

Do not claim a command passed unless it was actually executed.

---

# 36. Non-Goals

Do not introduce these unless separately requested:

- backend accounts,
- cloud saves,
- multiplayer,
- online leaderboards,
- ads,
- purchases,
- currencies,
- achievements requiring grind,
- daily streak mechanics,
- complex character customization,
- generative AI during gameplay,
- speech recognition,
- open-ended child chat,
- procedural educational content from an LLM.

The game should remain deterministic, fast, private, and offline-friendly.

---

# 37. Final Product Vision

The game should eventually feel less like:

```text
Choose Letters
→ answer five questions
→ receive stars
```

and more like:

```text
Adventure Bay has a problem
→ Chase and Zosia go there
→ solving educational interactions advances the adventure
→ something fun happens
→ the world changes
→ another event appears
→ the session ends with a memorable Lookout finale
```

The ideal player reaction is not:

> "I want to practice letters."

It is:

> "I want to help Chase rescue the kitten."

The learning mechanic should be the tool that allows the player to participate in the adventure.

---

# 38. First Implementation Task

Start with **Phase 1 only: Learning Event Infrastructure**.

Before making code changes:

1. inspect the repository,
2. identify the current scene/mission lifecycle,
3. identify current persistence and adaptive-selection logic,
4. identify at least one representative letter mission and one number mission,
5. propose the smallest compatible learning-event abstraction.

Then implement Phase 1.

Do not implement mastery, the adaptive scheduler, persistent Adventure Bay, new missions, or the parent dashboard yet.

The initial objective is simply to establish a clean event pipeline that later systems can consume without requiring scene rewrites.
