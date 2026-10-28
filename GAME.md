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
  `goodRunsPerLevel` (2) runs where at least two thirds of the questions were answered right first time,
  without the clue or the answer being shown (hearing the question again is fine). Every question counts:
  each River stone, each balloon.
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
| SOUNDS | MSZLNFRW |

`ALL` is every letter the game may use (Q, V, X, Y are left out: they are rare in Polish and hard
to picture). `SOUNDS` are consonants whose sound can be held (mmm, sss): a vowel's sound is its name, so asking
it would repeat the name levels. Every letter needs a picture word in `src/config.js` (`WORDS`), e.g. B → banan 🍌, balon 🎈: the
first is the letter's word ("Be jak banan!"), her name for her own letter ("Zet jak Zosia!"). A picture word starts
with its letter's sound and then a vowel (not "słoń", "gruszka") and is what she would call the picture.

---

## Missions

### 🐱 Kitty Park · `letters`

A kitten hides behind one of the letter blocks: "Kotek się schował! Znajdź Be!" Tapping the right
block makes it fly away and the kitten appears, then sits down in a row at the front with the others she found;
at the end they all play together ("Uratowałaś wszystkie kotki!"). The story is told in the first round only;
after that she hears the praise, the letter's word and the next question ("Brawo! Be jak banan!" "Znajdź Pe!").
When the answer is shown, the kitten peeks out over its block.

| Level | pool | choices | ask | similar | rounds | needs |
|---|---|---|---|---|---|---|
| 1 | START | 3 | match | no | 4 | — |
| 2 | START | 3 | name | no | 4 | — |
| 3 | MORE | 3 | name | no | 4 | — |
| 4 | MORE | 3 | audio | no | 4 | — |
| 5 | MORE | 3 | name | yes | 4 | — |
| 6 | ALL | 3 | name | no | 4 | — |
| 7 | ALL | 3 | word | no | 4 | — |
| 8 | SOUNDS | 3 | sound | no | 4 | letterAudio 0.4 |
| 9 | ALL | 3 | word | yes | 4 | — |
| 10 | ALL | 4 | word | yes | 4 | — |

Each level brings one new thing: new letters (3, 6), a harder way of asking (2, 4, 7, 8), lookalikes (5, 9) or
a fourth block (10). When it brings one, another may get easier again: lookalikes come with letters shown and
named (5), and all the letters arrive shown and named (6) before they are asked by their word (7).

- **pool** — which letters can be asked (a letter set, letters, or both with `+`)
- **choices** — how many blocks (2–4)
- **ask** — how the question is asked (each level a different way of meeting a letter):
  `match` the letter is in the bubble: "find the same one" (no name) ·
  `name` shown and named: "Znajdź Be!" ·
  `audio` only named, nothing shown ·
  `word` named with its picture word, the picture in the bubble: "Be jak banan! Znajdź Be!" ·
  `sound` its sound: "Która literka robi: mmmm?" (only letters you can hold, so `SOUNDS` are consonants)
- **similar** — `yes` puts lookalike letters (B/P/R, E/F, M/W, O/C…) among the wrong answers on purpose
- **needs** — optional: the level opens only once that skill is known well enough over the level's letters
  (average mastery, 0–1, over the ones she has been asked, once that is at least half of them), not just after
  enough good runs. Mastery takes guessing out (tapping at random scores about 0.1), so `letterAudio 0.4` = she
  knows the names of those letters clearly better than a guess
- **rounds** — how many kittens to find (1–8)

### 🎈 Balloon Hill · `balloons`

Balloons with letters float up. Pop every balloon with the asked letter, counting them as you go.

| Level | pool | targets | total | speed | similar | rounds |
|---|---|---|---|---|---|---|
| 1 | START | 2 | 5 | 0.3–0.45 | no | 3 |
| 2 | MORE | 2 | 5 | 0.3–0.45 | no | 3 |
| 3 | MORE | 3 | 7 | 0.3–0.45 | no | 2 |
| 4 | MORE | 3 | 7 | 0.45–0.65 | no | 2 |
| 5 | ALL | 3 | 7 | 0.45–0.65 | no | 2 |
| 6 | ALL | 3 | 7 | 0.45–0.65 | yes | 2 |
| 7 | ALL | 4 | 9 | 0.45–0.65 | yes | 2 |

Each level changes one thing: the letters (2, 5), how many balloons (3, 7), how fast (4) or lookalikes (6).

- **targets** — how many balloons have the right letter (1–4) · **total** — balloons in the air (3–9)
- **speed** — how fast they rise, a range (each lane of balloons picks a speed inside it). They rise in five
  lanes that never touch, up to just under the speech bubble (top left) and the top bar, then float away and
  come back up from the bottom
- **similar** — as in Kitty Park · **rounds** — how many letters to pop (aim for 30–45 seconds in all)

### 🚂 Name Train · `name`

Load the letters of a word onto the train in order. Each letter is named as it goes on ("Tak! Zet!"); then the
train toots once per syllable while Chase bounces and the voice says them, then the word ("Zo! Sia! Zosia!"),
and the train drives off. Nothing is spelled from memory: the word is always there to look at (in the bubble,
or as faint letters on the wagons). A finished word turns into its thing before the train leaves: KOT a kitten
hops onto the last wagon, DOM a little house pops up, MAMA, TATA and the family names a heart floats up
("Buziaczek dla Kasi!"), and her own name makes her cheer (the pictures live in `src/scenes/name.js`, the lines
in `src/lang/pl.js`).

The `whose` levels are about whole names: three trains roll in with name boards and she finds the one asked for
("Który pociąg jest Zosi?"): her own name first, then MAMA or TATA, then a family name. A miss never gets a
"no": the right train just toots.

| Level | words | mode | gaps | extras | similar |
|---|---|---|---|---|---|
| 1 | {name} | ghost | — | 1 | no |
| 2 | {name}, MAMA, TATA | ghost | — | 1 | no |
| 3 | {name}, MAMA, TATA | whose | — | — | — |
| 4 | {name}, MAMA, TATA | highlight | — | 1 | no |
| 5 | {name}, MAMA, TATA | word | — | 1 | no |
| 6 | {name}, MAMA, TATA, KOT, DOM, KASIA, BARTEK, RYSIEK, JUREK, BERNADKA, MIA, LAURA, JAGODA | word | — | 1 | no |
| 7 | {name}, MAMA, TATA, KOT, DOM, KASIA, BARTEK, RYSIEK, JUREK, BERNADKA, MIA, LAURA, JAGODA | missing | 2 | 1 | no |
| 8 | {name}, MAMA, TATA, KOT, DOM, KASIA, BARTEK, RYSIEK, JUREK, BERNADKA, MIA, LAURA, JAGODA | missing | 2 | 1 | yes |
| 9 | {name}, MAMA, TATA, KOT, DOM, KASIA, BARTEK, RYSIEK, JUREK, BERNADKA, MIA, LAURA, JAGODA | whose | — | — | — |

- **words** — the words (2–8 letters, only letters from `ALL`; names may also use Y, "Igrek", which no other
  mission asks). Each run picks one: never the same twice in a row, and her own name about one run in three.
  Every word needs a row in the words table below.
- **mode** — `ghost`: faint letters on the wagons, match each block to its wagon ·
  `highlight`: the whole word in the bubble with the next letter lit ·
  `word`: the whole word in the bubble and the next wagon glowing: which letter goes here? ·
  `missing`: the train arrives loaded with a few letters missing (Z O _ I _) and the whole word in the bubble:
  which letters are missing? ·
  `whose`: three trains with name boards, "Który pociąg jest Zosi?" (three rounds; only words with a
  "whose" form are asked, the others ride on the other trains)
- **gaps** — for `missing`: how many letters are missing (1–3, default 2); a word of 7 or 8 letters gets one more
  (up to 3), and a word always keeps at least one letter
- **extras** — extra blocks that are not in the word (0–3) and never look like any of its letters (no J next
  to the I of ZOSIA); with `missing` they are the other choices
- **similar** — `yes`: the extras are lookalikes of the word's letters on purpose (E/F, M/W…)

#### Name Train words

How the voice claps each word in syllables at the end (Polish reading starts from syllables), and whose it is
("Który pociąg jest **Kasi**?", "Buziaczek dla **Kasi**!"; `—` for things, which are never asked in `whose`).

| Word | syllables | whose |
|---|---|---|
| ZOSIA | ZO-SIA | Zosi |
| MAMA | MA-MA | mamy |
| TATA | TA-TA | taty |
| KOT | KOT | — |
| DOM | DOM | — |
| KASIA | KA-SIA | Kasi |
| BARTEK | BAR-TEK | Bartka |
| RYSIEK | RY-SIEK | Ryśka |
| JUREK | JU-REK | Jurka |
| BERNADKA | BER-NAD-KA | Bernadki |
| MIA | MI-A | Mii |
| LAURA | LAU-RA | Laury |
| JAGODA | JA-GO-DA | Jagody |

### 🚧 Cone Road · `cones`

Numbered cones block the road. Tap the right one and the cruiser drives on (early on, the dots are counted together).
A kitten waits at the end of the road ("Kotek czeka na końcu drogi!"); after the last cone the cruiser reaches
it ("Droga wolna! Uratowałaś kotka!").

| Level | max | choices | bubble | sign | dots | count | rounds |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 3 | both | both | dice | yes | 3 |
| 2 | 5 | 3 | both | both | dice | yes | 3 |
| 3 | 5 | 3 | numeral | both | dice | yes | 3 |
| 4 | 5 | 3 | name | dots | dice | yes | 3 |
| 5 | 5 | 3 | dots | numeral | dice | no | 3 |
| 6 | 6 | 3 | dots | numeral | dice | no | 3 |
| 7 | 6 | 4 | dots | numeral | dice | no | 3 |
| 8 | 6 | 4 | dots | numeral | line | no | 3 |
| 9 | 10 | 4 | dots | numeral | line | no | 3 |

- **max** — numbers go from 1 to max (2–10)
- **choices** — how many cones (2–4, not more than max); from level 2 the wrong ones are neighbours (±1)
- **bubble** — `both`: numeral + dots · `numeral` · `dots`: only dots, she counts and finds the numeral
  (help says "Policz kropki!" and lights the dots one by one; the number is named only when the answer is shown) ·
  `name`: nothing shown, "Który pachołek ma cztery kropki?" (the signs show dots: she recognises the amount)
- **sign** — what the cone signs show: `both` (numeral + dots), `numeral`, or `dots`
- **dots** — `line` (rows of five) or `dice` (dice patterns for 1–6: five is seen at a glance, without counting;
  above 6 always rows of five)
- **count** — `yes`: after a right answer the sign's dots light up one by one as they are counted aloud, then
  how many ("Jeden! Dwa! Trzy! Trzy kropki!"; needs dots on the sign) · `no`: just the number ("Cztery!")
- **rounds** — how many cones block the road (1–8)

### 🪨 The River · `stones`

Tap the stepping stones 1, 2, 3… so Zosia hops across the river to Chase. The stones come up a row at a
time, each row one hop nearer Chase: the next number and one or two others side by side.

| Level | n | rounds | bubble | choices | foils |
|---|---|---|---|---|---|
| 1 | 3 | 2 | numeral | 2 | far |
| 2 | 5 | 2 | numeral | 2 | far |
| 3 | 5 | 2 | numeral | 3 | far |
| 4 | 5 | 2 | missing | — | near |
| 5 | 5 | 2 | next | 2 | far |
| 6 | 7 | 1 | next | 2 | far |
| 7 | 7 | 1 | next | 2 | near |

- **n** — how many stones on the path (2–7; `missing` 3–9) · **rounds** — how many rivers to cross (1–6)
- **choices** — stones in each row (2–3) · **foils** — the other numbers: `far` ones are easy to tell
  apart (1 next to 3), `near` ones are the neighbours (3 next to 4). With `missing`, `near` is a neighbour of
  the gap that is already on the path (2 or 4 for "1 2 ? 4": only the order says no), `far` is past the end (5)
- **bubble** — `numeral`: shows the next number · `next`: shows "3 ➜ ?", she has to know what comes next
  (help shows the number) · `missing`: the stones lie in order with one gap ("1 2 ? 4"); she puts the right
  stone in (drag it or tap it) and Zosia hops across by herself, counting (3–9 stones)
- After a rough run the next one is gentler: 2 stones a row, far foils, one stone shorter, the number in the
  bubble (`missing` keeps its gap, with a far foil). After the last river Zosia stays with Chase for the badge.

### 🦴 Treat House · `counting`

Counting for real, at Chase's pup house.

| Level | types | give | howMany | share | hidden | flash | auto | slots | rounds |
|---|---|---|---|---|---|---|---|---|---|
| 1 | give, howMany, share | 1–3 | 1–3 | 2–3 | — | — | yes | yes | 3 |
| 2 | give, howMany, share | 1–3 | 1–3 | 2–3 | — | — | yes | no | 3 |
| 3 | give, howMany, share | 2–5 | 1–4 | 2–4 | — | — | yes | no | 3 |
| 4 | give, howMany, share | 1–3 | 1–4 | 2–4 | — | — | no | no | 3 |
| 5 | give, howMany, flash, share | 1–3 | 1–4 | 2–4 | — | 1–3 | no | no | 4 |
| 6 | give, howMany, flash, hidden, share | 1–3 | 1–4 | 2–4 | 2–3 | 1–3 | no | no | 5 |
| 7 | give, howMany, flash, hidden, share | 3–7 | 2–6 | 3–4 | 2–4 | 1–4 | no | no | 5 |
| 8 | give, howMany, flash, hidden, share | 5–10 | 4–9 | 3–4 | 2–4 | 1–4 | no | no | 5 |

The treats she gives land on Chase's blue tray in rows of five (a ten-frame), so every one is easy to see.

- **types** — the kinds of round. Each comes up once per mission (extra rounds repeat one), in a new order
  each time, never the same kind twice in a row, and the mission ends on an easy one (`share`, or `give`
  when `auto` is yes):
  - `give` ("Daj mu trzy smakołyki!"): move the treats from the pile to Chase — drag them, or tap one and it hops over
  - `howMany` ("Ile smakołyków?"): count the bones on the tray (tapping one counts it aloud), then pick the
    numeral; wrong choices are ±1. Then Chase eats them one by one while they are counted, ending on her number
  - `share` (Chase and kittens wait at their plates, "Każdy dostaje jeden smakołyk!"): she taps whoever is
    still hungry; one treat each, counted aloud
  - `flash` ("Szybkie oko!"): Chase's bowl lifts for two seconds over a few treats laid out like a die, then
    covers them: "Ile było? Daj Czejsowi tyle samo!" (seeing how many at a glance)
  - `hidden` ("Schowane smakołyki"): treats go under the bowl, then one more slides in: "Ile jest pod
    miską? Daj Czejsowi tyle samo!" (adding without words)

  In `flash` and `hidden` she gives Chase the same number and taps him; the bowl lifts and its treats line
  up next to hers, one under each, so she sees whether it is the same.
- **give** / **howMany** / **share** / **hidden** / **flash** — the number ranges (give up to 10, howMany up to 9,
  share 2–4 friends, hidden 2–4 treats under the bowl in the end, flash 1–4; `—` if unused)
- **auto** — `yes`: done as soon as the right number is there · `no`: she decides when to stop and taps Chase
  (too few: "Za mało! Jeszcze!"; too many: Chase gives the extra ones back, "Teraz dobrze? Dotknij Czejsa!",
  and she taps him again herself). `flash` and `hidden` always need `no`
- **slots** — the helping hand. `yes`: ghost rings show where the treats go (○ ○ ○), and the "how many?"
  numerals have their dots under them · `no`: neither (help shows the rings)
- **rounds** — how many tasks (1–8), at least one per kind in **types**
- Rounds that can't really be got wrong (`give` with auto, `share`) are played but don't count towards the next
  level, so every level has a `howMany`, `flash` or `hidden` round (a gentler run after a rough one turns `auto` on).

### 🗼 The Lookout · `lookout`

Ride the glass elevator up the Lookout ("Baza"). Press the floor on the elevator panel; on the way the car
stops at each floor, its sign lights up and there is a short beat before the number is said, so she (or her
parent) can count along first. Lost kittens wait on the floors, each right beside its floor's sign: each ride
picks one up, and at the end everyone goes to the very top and down the slide together!

| Level | max | bubble | mode | rounds | dice |
|---|---|---|---|---|---|
| 1 | 3 | both | pickup | 2 | — |
| 2 | 5 | numeral | pickup | 3 | — |
| 3 | 5 | numeral | find | 3 | — |
| 4 | 3 | numeral | relative | 3 | — |
| 5 | 7 | numeral | relative | 3 | — |
| 6 | 9 | numeral | pickup | 3 | — |
| 7 | 9 | numeral | dice | 3 | 1–2 |
| 8 | 9 | numeral | dice | 3 | 1–3 |

- **max** — number of floors (2–9; the signs and kittens shrink to fit, 9 is the most that stays readable)
- **bubble** — `both`: numeral + dots · `numeral`
- **mode** — every mode rescues a kitten on each ride:
  `pickup`: a kitten waits on a floor, "Kotek czeka na piętrze dwa!" (the number in the bubble); the elevator
  goes there from wherever it is, counting up or down · `find`: a kitten waits on a floor, "Na którym piętrze
  czeka kotek?" (only the kitten in the bubble: she reads the sign beside it) · `relative`: the first ride is a
  `pickup`, then "Jesteśmy na piętrze trzy. Kotek czeka jedno piętro wyżej!" (one more / one less; needs 3+
  floors and 2+ rounds) · `dice`: a big dot die beside the car, "Dotknij kostki!" (or Chase rolls it); it says how many floors up
  ("Dwa piętra w górę! Na które piętro?") and she presses the floor they land on, counting on from where the
  car is; the kitten is a surprise on that floor (age 4+) · `go`: one easy kitten on floors 1–3, numeral and
  dots (the session finale, and the gentler run after a rough one)
- **rounds** — how many elevator trips (1–3: the car seats 3 kittens); `pickup` and `find` need more floors than
  trips (each kitten waits on a floor of its own). After the last trip everyone goes to the top and down the
  slide, kittens too.
- **dice** — (`dice` only) how many floors the die can say, like `1–2`; the die never says more than fits, and
  every ride goes up, so the floors must cover `rounds` × the smallest number

### 📦 Pup Delivery · `delivery`

The post office: Chase delivers parcels. First sounds: which word starts with which letter.

| Level | pool | choices | mode | rounds |
|---|---|---|---|---|
| 1 | START | 2 | pictureSound | 4 |
| 2 | START | 3 | pictureSound | 4 |
| 3 | START | 3 | soundLetter | 4 |
| 4 | MORE | 3 | soundLetter | 4 |
| 5 | ALL | 3 | soundLetter | 4 |

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
| 3 | 5 | more, less, same | no | no | 3 |
| 4 | 5 | more, less, same | no | yes | 3 |
| 5 | 5 | more, less, same | yes | yes | 3 |
| 6 | 10 | more, less, same | yes | yes | 3 |

- **max** — the biggest amount (3–10)
- **modes** — the questions, taking turns: `more` ("Gdzie jest więcej smakołyków?", hungry Chase eats them) ·
  `less` (a kitten with a small tummy: "Kotek ma mały brzuszek! Gdzie jest mniej smakołyków?") · `same`
  (Chase has his own treats on a plate: "Gdzie jest tyle samo, co u Czejsa?")
- **close** — `no`: the amounts are far apart (2+ difference) · `yes`: they differ by one
- **numerals** — `yes`: the blankets show numerals instead of treats (3 or 5?); the treats appear after
  (no < > signs). The clue lines each group up on its own blanket, one row each from the middle outwards: the
  longer row has more. With numerals the clue puts the dots under each numeral.

### 🔧 The Garage · `garage`

Chase's cruiser is in for repairs: shapes, patterns and sorting, with every colour named. Each visit she fixes the
cruiser's door (put each shape in its hole: drag it, or tap it), hangs the flags (which flag comes next?) and tidies
the blocks into baskets, then the mended cruiser flashes its lights.

| Level | modes | shapes | pattern | sort | rounds |
|---|---|---|---|---|---|
| 1 | shapes, pattern, sort | shown | AB | colour | 3 |
| 2 | shapes, pattern, sort | name | AB | colour | 3 |
| 3 | shapes, pattern, sort | name | gap | colour | 3 |
| 4 | shapes, pattern, sort | name | gap | size | 3 |
| 5 | shapes, pattern, sort | turned | gap | size | 3 |
| 6 | shapes, pattern, sort | turned | ABB | size | 3 |
| 7 | shapes, pattern, sort | turned | ABB | switch | 3 |

- **modes** — the jobs, taking turns, one per round: `shapes` (the door), `pattern` (the flags), `sort` (the blocks)
- **shapes** — `shown`: one hole in the door, the shape in the bubble and named ("Który kształt pasuje? Koło!") ·
  `name`: a hole for each of koło, kwadrat, trójkąt; she hears which one ("Gdzie jest kwadrat?"), twice, and the
  last one hops in by itself · `turned`: as `name`, but the pieces lie turned and bigger or smaller, the square
  stands on a corner, and the triangle is not the textbook one (a square corner, long and flat, tall and thin)
- **pattern** — `AB`: red, blue, red, blue… which flag comes next? (two colours of the row and one other to
  choose from) · `gap`: the same kind of row with one flag missing in the middle · `ABB`: red, blue, blue (or red,
  red, blue)… which comes next? After a right answer the whole row is said aloud, flag by flag
- **sort** — four blocks, one at a time, into two baskets (drag the block, or tap the basket): `colour`: two
  colours, "Czerwony do czerwonego!" · `size`: a big and a small basket, "Duży do dużego!" · `switch`: a big basket
  and a small one in two colours; two blocks go by colour, then "Teraz duże i małe!" and two go by size
- **rounds** — how many jobs (1–6); with all three modes, 3 is one of each. Colours are always the four far-apart
  ones (red, blue, yellow, green) and are named every time

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
