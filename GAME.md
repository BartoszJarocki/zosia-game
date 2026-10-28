# Zosia's Pup Patrol 🐾

A 3D browser game for Zosia (3 years old) that teaches **letters and numbers** with Chase.
It runs on the iPad or a computer, installs as an app, works offline, and talks in Polish
(native voice "Hanna", pre-recorded with ElevenLabs). There is nothing to read: every
instruction is spoken, and nothing can be lost — a wrong tap just gets a gentle "try again".

**This file is also the game's level data.** The tables below are read by the game, so editing a
row changes the game and adding a row adds a level. See [Adding or changing levels](#adding-or-changing-levels).

---

## How it plays

1. **Start screen** — a big paw button (the tap also switches sound on, which iPads require).
2. **Adventure Bay** — an island with the Lookout in the middle. Zosia and Chase sit in the police
   cruiser. Tapping a place (or its bouncing star) drives them there. Each place shows its
   level stars; the badge shelf in the corner shows what she has earned.
3. **A mission** — short: a few rounds (the `rounds` column below; paw prints at the top fill in).
   The speech bubble shows what to look for, and tapping it repeats the question.
   Help comes step by step and is the same in every mission:
   - **if she goes quiet:** the speech bubble bounces after ~6 s (no words: she may just be looking), a short
     prompt ("Gdzie jest Be?") after ~10 s, a clue ("Be jak banan!") after ~17 s, the answer pulses after ~25 s,
     then quiet (no endless nagging)
   - **after a wrong tap:** a low falling "no" sound, the thing she tapped shakes its head, and "Nie, to nie ten."
     ("Nie, to Em." when it only looks like the right letter); then a wrong option goes away, then the answer
     pulses. She always makes the last tap herself.
   - **after a right tap:** a bright rising chime and "Tak!" / "Brawo!" / "Super!" before what it was ("Super! Dwa!")
4. **A session** — the island suggests where to go next, sometimes as a little story (a kitten stuck up a
   tree, balloons escaping); after 2 missions the Lookout's alarm calls everyone in for the finale; after it, she can keep
   playing anything she likes. Suggestions never lock a place. If she seems tired (answers slowing down,
   random taps, needing more and more help), nothing new is asked and the finale comes sooner; if she seems
   very tired: "Jeszcze tylko jedno!", an easy one she knows, a celebration and a gentle goodbye.
5. **Celebration** — badge, stars, confetti and fireworks, then "again" or "home".

## How levels work

- Every mission goes from **match what you see → recognise what you hear → think for yourself**.
  Each level changes one thing, so it feels natural but a little bit challenging.
- **Levelling up follows skill, not time:** a mission's next level unlocks after
  `goodRunsPerLevel` (2) runs where at least two thirds of answers were right first time.
- **A rough run (under 45%)** makes the next run gentler ("assist": fewer choices, answer shown).
  Stars are never taken away.
- **Letters and numbers she misses come up more often**; ones she knows come up less.
- Levels are per mission and saved on the device. Open the game with `#reset` at the end of the
  address to start over. To force a level everywhere for testing, set `level` in `src/config.js`.

---

## Letter sets

Letters are introduced gradually: her own name first, then the letters of MAMA and TATA, then the rest.
A set can use `{name}` (the child's name), other sets, and plain capital letters, joined with `+`.

| Set | Letters |
|---|---|
| ALL | ABCDEFGHIJKLMNOPRSTUWZ |
| START | {name} + AMTO |
| MORE | START + EULDPKBW |
| SOUNDS | MSAOZLUEI |

`ALL` is every letter the game may use (Q, V, X, Y are left out: they are rare in Polish and hard
to picture). Every letter needs a picture word in `src/config.js` (`WORDS`), e.g. B → banan 🍌, balon 🎈: the
first is the letter's word ("Be jak banan!"), her name for her own letter ("Zet jak Zosia!"). A picture word starts
with its letter's sound and then a vowel (not "słoń", "gruszka") and is what she would call the picture.

---

## Missions

### 🐱 Kitty Park · `letters`

A kitten hides behind one of the letter blocks: "Kotek schował się za literą Be!" Tapping the right
block makes it fly away and the kitten appears.

| Level | pool | choices | ask | similar | rounds | needs |
|---|---|---|---|---|---|---|
| 1 | START | 3 | match | no | 4 | — |
| 2 | START | 3 | name | no | 4 | — |
| 3 | MORE | 3 | audio | no | 4 | — |
| 4 | MORE | 3 | name | yes | 4 | — |
| 5 | ALL | 3 | word | no | 4 | — |
| 6 | SOUNDS | 3 | sound | no | 4 | letterAudio 0.6 |

- **pool** — which letters can be asked (a letter set, letters, or both with `+`)
- **choices** — how many blocks (2–4)
- **ask** — how the question is asked (each level a different way of meeting a letter):
  `match` the letter is in the bubble: "find the same one" (no name) ·
  `name` shown and named: "Znajdź Be!" ·
  `audio` only named, nothing shown ·
  `word` named with its picture word, the picture in the bubble: "Be jak banan! Znajdź Be!" ·
  `sound` its sound: "Która literka robi: mmmm?" (only letters you can hold — the `SOUNDS` set)
- **similar** — `yes` puts lookalike letters (B/P/R, E/F, M/W, O/C…) among the wrong answers on purpose
- **needs** — optional: the level opens only once that skill is known well enough over the level's letters
  (average mastery, 0–1), not just after enough good runs. `letterAudio 0.6` = she knows the names of those letters
- **rounds** — how many kittens to find (1–8)

### 🎈 Balloon Hill · `balloons`

Balloons with letters float up. Pop every balloon with the asked letter, counting them as you go.

| Level | pool | targets | total | speed | similar | rounds |
|---|---|---|---|---|---|---|
| 1 | START | 2 | 5 | 0.3–0.45 | no | 3 |
| 2 | MORE | 3 | 7 | 0.45–0.65 | no | 2 |
| 3 | ALL | 3 | 8 | 0.6–0.85 | yes | 2 |

- **targets** — how many balloons have the right letter (1–4) · **total** — balloons in the air (3–9)
- **speed** — how fast they rise, a range (each balloon picks a speed inside it)
- **similar** — as in Kitty Park · **rounds** — how many letters to pop (aim for 30–45 seconds in all)

### 🚂 Name Train · `name`

Load the letters of a word onto the train in order, then say them together ("Zet! O! Es! I! A! Zosia!")
and the train drives off. Nothing is spelled from memory: the word is always there to look at.
A finished word turns into its thing before the train leaves: KOT a kitten hops onto the last wagon, DOM a
little house pops up, MAMA and TATA a heart floats up, and her own name makes her cheer (the pictures live
in `src/scenes/name.js`, the lines in `src/lang/pl.js`).

| Level | words | mode | extras | similar |
|---|---|---|---|---|
| 1 | {name} | ghost | 1 | no |
| 2 | {name} | word | 1 | no |
| 3 | {name}, MAMA, TATA | missing | 2 | no |
| 4 | {name}, MAMA, TATA, KOT, DOM | highlight | 2 | yes |

- **words** — the words (one is picked each time; 2–7 letters, only letters from `ALL`)
- **mode** — `ghost`: faint letters on the wagons, match each block to its wagon ·
  `word`: the whole word in the bubble, wagons empty — which letter comes next? ·
  `missing`: the train arrives loaded with one letter missing (Z O _ I A) — which one? ·
  `highlight`: the whole word in the bubble with the next letter lit (good for new words)
- **gaps** — optional, for `missing`: how many letters are missing (1–3, default 1)
- **extras** — extra blocks that are not in the word (0–3); with `missing` they are the other choices
- **similar** — extras are lookalikes of the word's letters

### 🚧 Cone Road · `cones`

Numbered cones block the road. Tap the right one and the cruiser drives on (early on, the dots are counted together).

| Level | max | choices | bubble | sign | dots | count | rounds |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 3 | both | both | dice | yes | 3 |
| 2 | 5 | 3 | numeral | both | dice | yes | 3 |
| 3 | 5 | 3 | name | dots | dice | no | 3 |
| 4 | 6 | 4 | dots | numeral | dice | no | 3 |

- **max** — numbers go from 1 to max (2–10)
- **choices** — how many cones (2–4, not more than max); from level 2 the wrong ones are neighbours (±1)
- **bubble** — `both`: numeral + dots · `numeral` · `dots`: only dots, she counts and finds the numeral ·
  `name`: nothing shown, "Który pachołek ma cztery kropki?" (the signs show dots: she recognises the amount)
- **sign** — what the cone signs show: `both` (numeral + dots), `numeral`, or `dots`
- **dots** — `line` (rows of five) or `dice` (dice patterns for 1–6: five is seen at a glance, without counting)
- **count** — `yes`: after a right answer the dots are counted aloud together · `no`: just the number ("Cztery!")
- **rounds** — how many cones block the road (1–8)

### 🪨 The River · `stones`

Tap the stepping stones 1, 2, 3… so Zosia hops across the river to Chase. The stones come up a row at a
time, each row one hop nearer Chase: the next number and one or two others side by side.

| Level | n | rounds | bubble | choices | foils |
|---|---|---|---|---|---|
| 1 | 3 | 2 | numeral | 2 | far |
| 2 | 5 | 2 | numeral | 3 | far |
| 3 | 4 | 2 | missing | — | — |
| 4 | 7 | 1 | next | 2 | near |

- **n** — how many stones on the path (2–7; `missing` 3–9) · **rounds** — how many rivers to cross (1–6)
- **choices** — stones in each row (2–3) · **foils** — the other numbers in a row: `far` ones are easy to tell
  apart (1 next to 3), `near` ones are the neighbours (3 next to 4)
- **bubble** — `numeral`: shows the next number · `next`: shows "3 ➜ ?", she has to know what comes next
  (help shows the number) · `missing`: the stones lie in order with one gap ("1 2 ? 4"); she puts the right
  stone in (drag it or tap it) and Zosia hops across by herself, counting (3–9 stones)

### 🦴 Treat House · `counting`

Counting for real, at Chase's pup house.

| Level | types | give | howMany | share | auto | slots | rounds |
|---|---|---|---|---|---|---|---|
| 1 | give, share | 1–3 | — | 2–3 | yes | yes | 3 |
| 2 | give, howMany, share | 2–5 | 1–4 | 2–4 | yes | no | 3 |
| 3 | give, howMany, share | 3–7 | 2–6 | 3–4 | no | no | 3 |

- **types** — round kinds, taking turns: `give` ("Daj mu trzy smakołyki!": move the treats from the pile to Chase — drag them, or tap one and it hops over),
  `howMany` ("Ile smakołyków?": count the bones, tapping them counts aloud, then pick the numeral; wrong
  choices are ±1) and `share` (Chase and kittens wait at their plates, "Każdy dostaje jeden smakołyk!": she
  taps whoever is still hungry; one treat each, counted aloud)
- **give** / **howMany** / **share** — the number ranges (give up to 10, howMany up to 9, share 2–4 friends; `—` if unused)
- **auto** — `yes`: done as soon as the right number is there · `no`: she decides when to stop and taps Chase
- **slots** — `yes`: ghost spots show where the treats go (○ ○ ○) · `no`: no spots (help shows them)
  (too many: he gives one back; too few: "jeszcze!") · **rounds** — how many tasks (1–8)

### 🗼 The Lookout · `lookout`

Ride the glass elevator up the Lookout ("Baza"). Press the floor on the elevator panel; floors are
counted aloud on the way. Lost kittens wait on the floors: each ride picks one up, and at the end
everyone goes to the very top and down the slide together!

| Level | max | bubble | mode | rounds |
|---|---|---|---|---|
| 1 | 3 | both | pickup | 2 |
| 2 | 5 | numeral | pickup | 3 |
| 3 | 5 | numeral | find | 3 |
| 4 | 7 | numeral | relative | 2 |

- **max** — number of floors (2–9)
- **bubble** — `both`: numeral + dots · `numeral`
- **mode** — `pickup`: a kitten waits on a floor, "Kotek czeka na piętrze dwa!" (the number in the bubble);
  the elevator goes there from wherever it is, counting up or down · `find`: a kitten waits on a floor, "Na
  którym piętrze czeka kotek?" (only the kitten in the bubble: she reads the floor's sign) ·
  `go`: "Jedziemy na piętro trzy" and back down each time (the session finale) ·
  `relative`: "We're on floor 3 — go one floor up/down" (one more / one less; needs 3+ floors and 2+ rounds)
- **rounds** — how many elevator trips (1–8); `pickup` and `find` need more floors than trips (each kitten waits
  on a floor of its own) and have at most 3 trips (the car seats 3 kittens). After the last trip everyone goes to the top and down the slide, kittens too.

### 📦 Pup Delivery · `delivery`

The post office: Chase delivers parcels. First sounds: which word starts with which letter.

| Level | pool | choices | mode | rounds |
|---|---|---|---|---|
| 1 | START | 2 | pictureSound | 4 |
| 2 | START | 3 | pictureSound | 4 |
| 3 | START | 3 | soundLetter | 4 |
| 4 | MORE | 3 | soundLetter | 4 |

- **pool** — which letters (their picture words come from `WORDS`, taking turns: K → kot 🐱, then kaczka 🦆)
- **choices** — how many parcels / mailboxes (2–4)
- **mode** — `pictureSound`: parcels with pictures, "Co zaczyna się na Ka?" → tap the cat ·
  `soundLetter`: letter mailboxes and one parcel with a picture, "Do której skrzynki pójdzie kot?" →
  drag the parcel into K (or tap the mailbox)
- **similar** — optional: `yes` lets sound-alikes (P/B, T/D, K/G, S/Z, W/F, M/N) be choices together

### 🧺 Pup Picnic · `picnic`

A picnic with Chase: more, less, the same — by looking, before numbers.

| Level | max | modes | close | numerals | rounds |
|---|---|---|---|---|---|
| 1 | 5 | more | no | no | 3 |
| 2 | 5 | more, less | no | no | 3 |
| 3 | 6 | more, less, same | yes | no | 3 |
| 4 | 9 | more, less | yes | yes | 3 |

- **max** — the biggest amount (3–10)
- **modes** — the questions, taking turns: `more` ("Gdzie jest więcej smakołyków?") · `less` · `same`
  (Chase has a plate: "Gdzie jest tyle samo, co u Czejsa?")
- **close** — `no`: the amounts are far apart (2+ difference) · `yes`: they differ by one
- **numerals** — `yes`: the blankets show numerals instead of treats (3 or 5?); the treats appear after
  (no < > signs). The clue lines both groups up in rows, side by side: the longer row has more.

---

## Adding or changing levels

1. Edit a table above: change a value, or **add a row** for a new level (number them 1, 2, 3, 4… in order).
   The stars, levelling up and saving all adapt to however many rows a mission has.
2. Check it: `npm run check` — it explains anything that's wrong, with the line number.
3. If the change needs new spoken lines (new words, letters or bigger numbers), record them:
   `npm run voices` (only new lines are recorded; needs `ELEVENLABS_API_KEY` in `.env.local`).
4. Try it: `npm run dev`, then open `http://localhost:5173/#cones` (or any mission name) to jump straight in.
5. Ship it: `vercel deploy --prod` (the build runs the check too, so a broken table never goes live).

New **missions** (not just levels) need code: a scene in `src/scenes/`, an entry here, and a place on
the island in `src/scenes/hub.js`.

## Other settings

`src/config.js`: child's name and its Polish forms, `goodRunsPerLevel`, help timings (`assistSeconds`),
session length (`session`), picture words for letters, voice and graphics quality. Spoken lines live in `src/lang/pl.js`.
Grown-ups can see what she knows — and use developer tools (levels, "next trip", reset) — at `#parent`
(e.g. `https://…/#parent`) or by pressing and holding the badge shelf (top left of the island) for 3 seconds.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Run locally (also on the Wi-Fi, for the iPad) |
| `npm run check` | Check this file's level tables |
| `npm run build` | Check + production build (app with offline support) |
| `npm run voices` | Record any missing voice lines with ElevenLabs |
| `vercel deploy --prod` | Publish to https://pup-patrol-theta.vercel.app |
