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
   cruiser. Tapping a place (or its bouncing star) drives them there. A tap on the sea or the grass
   drives nowhere unless it lands within 5% of the screen's short side of something she can tap (a
   mission forgives 14%). Every place has one plain gold star; Chase's blue paw print bounces by the star
   of the place he suggests. The level stars are on the mission screen and the celebration, not on the island.
   The badge shelf in the corner shows what she has earned.
3. **A mission** — short: a few rounds (the `rounds` column below; paw prints at the top fill in).
   The speech bubble shows what to look for, and tapping it repeats the question (once the question is
   answered, a tap on it does nothing, so the praise plays on).
   Help comes step by step and is the same in every mission:
   - **if she goes quiet:** the speech bubble bounces after ~6 s (no words: she may just be looking), a short
     prompt ("Gdzie jest Be?") after ~10 s, a clue ("Be jak banan!") after ~17 s, the answer pulses after ~25 s,
     then quiet (no endless nagging)
   - **after a wrong tap:** a low falling "no" sound, the thing she tapped shakes its head, and "Nie, to nie ten."
     ("Nie, to Em." when it only looks like the right letter; "Za mało!" for a count), then the question again,
     and nothing more: one wrong tap never shows the answer. A second wrong tap brings a step that is still not
     the answer: a wrong option goes away, or a clue (the dots, craters or floors light one by one without a
     number said, the stones so far are counted). With only two to choose from the clue comes instead, since
     taking one away would leave the answer. A third wrong tap, or a long wait, shows the answer: it pulses
     ("Tutaj!"). She always makes the last tap herself.
   - **after a right tap:** a bright rising chime and "Tak!" / "Brawo!" / "Super!" before what it was ("Super! Dwa!").
     The praise plays while the next question comes: the next thing can be tapped at once, and the question is said
     when the praise ends. Where she counted, her number is said once ("Tak! Trzy!"), not counted through again.
     A fact (what a shape is like, how big Jupiter is) is said once a visit, not every round. A question that starts
     with something to watch (flashes, a quick look, pebbles falling, Chase's jumps) starts after the praise.
   - **a ride or a feast she taps along with is hers:** the Lookout's rides and Chase's eating in the Treat House
     keep their length, and she can tap along to count (a floor sign, a treat)
   - **every tap answers:** a finger that lands again within 0.12 s and 40 px is one tap, right or wrong. A tap
     on something she can tap while the game cannot act on it yet gets a short tick and a little bounce of that
     thing: it is not an answer and cuts no voice. Taps that count ("Mrugnij trzy razy!") are never lost: each
     plays after the one before, and the tap that says "done" is judged after them. The next thing (the next
     star, the next letter, the right tile after a wrong one) can be tapped as soon as her answer lands, while
     the praise is still being said.
   - **leaving:** the house button takes her home only when held for a moment (a ring fills round it), in a
     mission and on the space and sea maps, so a stray tap does not end a trip.
   - **the grown-ups' buttons** (the badge shelf on the island, the paw on the space and sea maps) open the
     grown-ups' page only when held for 3 seconds. The same ring fills round them while they are held, and a
     short tap opens nothing. Nothing is written on her screen. The buttons are labelled "Dla rodzica,
     przytrzymaj 3 sekundy" for a grown-up's screen reader.
4. **Trips** — the first rocket (or boat) trip of a session shows the whole launch: helmets (life jackets),
   boarding, the countdown, then START (the horn). A later trip in the same session is a short drive, the crew
   already aboard, START at once, and a short lift-off: about 6 s from the tap on the island to the map. A flight
   goes straight to the stop she taps, with one line ("Lecimy na Marsa!"); a tap on another stop on the way
   changes course, and the way home is one glide. On the sea map the stops sit on a ring, each on a round
   white-rimmed pad and at least 110 px wide on an iPad held either way. On both maps a stop with a game carries
   that game's badge and a place that is only to look at carries none; Earth and the island show a small house,
   so home does not look like a place to play.
5. **A session** — the island suggests where to go next, sometimes as a little story (a kitten stuck up a
   tree, balloons escaping); after 2 missions the Lookout's alarm calls everyone in for the finale; after it, she can keep
   playing anything she likes. Suggestions never lock a place. If she seems tired (answers slowing down
   compared with her first answers in the same mission, random taps, needing more and more help), nothing new is
   asked and the finale comes sooner; if she seems very tired: "Jeszcze tylko jedno!" (once a session), an easy one
   she knows, a celebration and a gentle goodnight. The goodnight never locks: the island sleeps, and a tap on a
   place wakes Chase with a yawn and starts a new session in that place.
6. **Celebration** — badge, stars, confetti and fireworks. Chase says the place's own line ("Brawo! Ułożyłaś
   obrazki z gwiazd!"), then one statement of what she won, then asks whether to play again or go on. Each
   statement is a whole sentence that stands alone. The reward is "Zdobywasz nową gwiazdkę!" for one level and
   "Zdobywasz dwie nowe gwiazdki!" for two, with "odznakę i" in front when the badge is new to her shelf. A run that
   gained no level says only "Zdobywasz odznakę!", and only when that badge is new. The question is "Jeszcze raz czy na wyspę?" ("lecimy dalej?" in space,
   "płyniemy dalej?" at sea). Leaving during it (home, again, another place) stops it: nothing more is said, asked
   or sounded in the next place.

## How levels work

- Every mission goes from **match what you see → recognise what you hear → think for yourself**.
  Each level changes one thing, so it feels natural but a little bit challenging.
- **Levelling up follows skill, not time:** one good run moves her up a level (`goodRunsPerLevel`, 1). A run
  is good when at least two thirds of its questions were answered right first time, without the clue or the
  answer being shown (hearing the question again is fine). Every question counts: each River stone, each balloon.
- **A perfect run moves her up two levels:** three or more questions, every one right first time without help.
  Never past the top, and never past a level whose `needs` gate is still closed: she stops just below it.
- **The Lookout finale counts too:** the ride at the end of a session is at her Lookout level and counts like
  any visit to the Lookout.
- **A rough run (under 45%)** makes the next run gentler ("assist": fewer choices, answer shown).
  Stars are never taken away.
- **Letters and numbers she misses come up more often**; ones she knows come up less.
- **A place she has never played starts at the level for her age** (the table below), not at level 1.
- Levels are per mission and saved on the device. Open the game with `#reset` at the end of the
  address to start over. To force a level everywhere for testing, set `level` in `src/config.js`.

## Starting levels

Where each place starts, for her age. The grown-ups' page sets the age ("Zosia ma lat"); a new save starts
at `childAge` in `src/config.js` (3.5).

| Mission | 3 | 3.5 | 4 | 5 |
|---|---|---|---|---|
| Kitty Park · `letters` | 2 | 4 | 6 | 7 |
| Balloon Hill · `balloons` | 1 | 3 | 5 | 6 |
| Name Train · `name` | 3 | 4 | 6 | 8 |
| Cone Road · `cones` | 3 | 4 | 6 | 8 |
| The River · `stones` | 3 | 4 | 6 | 6 |
| Treat House · `counting` | 3 | 4 | 7 | 7 |
| The Lookout · `lookout` | 2 | 3 | 5 | 7 |
| Pup Delivery · `delivery` | 1 | 2 | 4 | 4 |
| Pup Picnic · `picnic` | 2 | 3 | 5 | 5 |
| The Garage · `garage` | 1 | 2 | 3 | 6 |
| Mercury's Craters · `mercury` | 2 | 3 | 4 | 4 |
| Venus's Clouds · `venus` | 2 | 3 | 3 | 3 |
| Moon Jumps · `moon` | 2 | 3 | 3 | 3 |
| The Mars Rover · `mars` | 2 | 3 | 4 | 4 |
| Jupiter's Stripes · `jupiter` | 1 | 2 | 3 | 3 |
| Saturn's Rings · `saturn` | 1 | 2 | 3 | 3 |
| Pluto's Heart · `pluto` | 1 | 2 | 3 | 3 |
| The Black Hole · `blackhole` | 2 | 3 | 3 | 3 |
| Comet Catch · `comet` | 1 | 2 | 3 | 3 |
| Star Pictures · `stars` | 2 | 3 | 3 | 5 |
| The Telescope · `telescope` | 1 | 2 | 3 | 5 |
| The Lighthouse · `lighthouse` | 1 | 2 | 3 | 3 |
| Pływa czy tonie? · `shallows` | 1 | 2 | 2 | 2 |
| The Reef · `reef` | 1 | 2 | 3 | 3 |
| The Port · `port` | 1 | 2 | 2 | 2 |

Each level changes one thing, so half a year is about one level: 3 starts one level below 3.5 and keeps to
the letters of her name, MAMA and TATA; 4 starts at the first level with letters from the whole alphabet or
numbers past 5 (one level above 3.5 where a place has neither); 5 starts one level below the top, so there is
always a star to earn.

- **Columns** are ages. An age between two columns uses the younger one (4½ starts like 4); younger than
  every column starts at level 1.
- **A start** is one of the mission's levels, below any level with a `needs` gate (a start never skips a
  gate), and never lower for an older age. `npm run check` checks all three, and that every mission has a row.
- **Choosing an older age** moves every place below its new start up to it. A younger age takes no stars
  away: a place she has played (or a grown-up set) keeps its level; only places she has never played start lower. Once she
  plays a place its level is her own: it goes up as she plays, and a grown-up can still lower it (Developer
  tools on the grown-ups' page). A start that is too high meets the usual net: after a rough run the next
  one is gentler.

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
| 2 | START | 3 | audio | no | 4 | — |
| 3 | MORE | 3 | word | no | 4 | — |
| 4 | MORE | 3 | audio | no | 4 | — |
| 5 | MORE | 3 | audio | yes | 4 | — |
| 6 | ALL | 3 | word | no | 4 | — |
| 7 | ALL | 3 | audio | no | 4 | — |
| 8 | SOUNDS | 3 | sound | no | 4 | letterAudio 0.4 |
| 9 | ALL | 3 | word | yes | 4 | — |
| 10 | ALL | 4 | word | yes | 4 | — |

Each level brings one new thing: new letters (3, 6), a harder way of asking (2, 4, 7, 8), lookalikes (5, 9) or
a fourth block (10). Only the first level shows the letter. New letters arrive with their picture word (3, 6),
and the next level asks the same letters by name alone (4, 7).

- **pool** — which letters can be asked (a letter set, letters, or both with `+`)
- **choices** — how many blocks (2–4)
- **ask** — how the question is asked (each level a different way of meeting a letter). Only `match` shows the
  letter, so only a `match` row may have the answer on screen:
  `match` the letter is in the bubble: "find the same one" (no name) ·
  `audio` only named, nothing shown: "Znajdź Be!" ·
  `word` named with its picture word, the picture in the bubble: "Be jak banan! Znajdź Be!" ·
  `sound` its sound: "Która literka robi: mmmm?" (only letters you can hold, so `SOUNDS` are consonants) ·
  `name` shown and named: no level asks it; it is the help of a gentler run
- **similar** — `yes` puts lookalike letters (B/P/R, E/F, M/W, O/C…) among the wrong answers on purpose
- **needs** — optional: the level opens only once that skill is known well enough over the level's letters
  (average mastery, 0–1, over the ones she has been asked, once that is at least half of them), not just after
  enough good runs. Mastery takes guessing out (tapping at random scores about 0.1), so `letterAudio 0.4` = she
  knows the names of those letters clearly better than a guess
- **rounds** — how many kittens to find (1–8)

### 🎈 Balloon Hill · `balloons`

Balloons with letters float up. Pop every balloon with the asked letter, counting them as you go. Only the
first two levels show the letter in the bubble ("Przebij balony z literą Be!" with a big B); from the third
level on the bubble holds a balloon and she pops the letter she hears. When the last right balloon is gone she
hears "Tak! Trzy!" and the next letter is named at once; the other balloons drift up and away, and for that
moment she can pop them for fun: nothing counts and nothing is wrong.

| Level | pool | ask | targets | total | speed | similar | rounds |
|---|---|---|---|---|---|---|---|
| 1 | START | match | 2 | 5 | 0.3–0.45 | no | 3 |
| 2 | MORE | match | 2 | 5 | 0.3–0.45 | no | 3 |
| 3 | MORE | audio | 3 | 7 | 0.3–0.45 | no | 2 |
| 4 | MORE | audio | 3 | 7 | 0.45–0.65 | no | 2 |
| 5 | ALL | audio | 3 | 7 | 0.45–0.65 | no | 2 |
| 6 | ALL | audio | 3 | 7 | 0.45–0.65 | yes | 2 |
| 7 | ALL | audio | 4 | 9 | 0.45–0.65 | yes | 2 |

Each level changes one thing: the letters (2, 5), asking by name (3, with more balloons), how fast (4),
lookalikes (6) or more balloons (7). New letters are shown first (2); from level 3 only the name is said.

- **ask** — `match`: the letter is in the bubble, so she pops the same ones (it is also named) ·
  `audio`: only named, the bubble shows a balloon. Only `match` shows the letter. A gentler run shows it again
  (the help of a rough run)
- **targets** — how many balloons have the right letter (1–4) · **total** — balloons in the air (3–9)
- **speed** — how fast they rise, a range (each lane of balloons picks a speed inside it). They rise in five
  lanes that never touch, up to just under the speech bubble (top left) and the top bar, then float away and
  come back up from the bottom
- **similar** — as in Kitty Park · **rounds** — how many letters to pop (aim for 30–45 seconds in all)

### 🚂 Name Train · `name`

Load the letters of a word onto the train in order. Each letter is named as it goes on ("Tak! Zet!"), and the next
one is asked at once, while the block is still hopping onto its wagon; then the train toots once per syllable
while Chase bounces and the voice says them, then the word ("Zo! Sia! Zosia!"), and the train drives off. Nothing is spelled from memory: the word is always there to look at (in the bubble,
or as faint letters on the wagons). A finished word turns into its thing before the train leaves: KOT a kitten
hops onto the last wagon, DOM a little house pops up, MAMA, TATA and the family names a heart floats up
("Buziaczek dla Kasi!"), and her own name makes her cheer (the pictures live in `src/scenes/name.js`, the lines
in `src/lang/pl.js`).

The `whose` levels are about whole names: three trains roll in with name boards and she finds the one asked for
("Który pociąg jest Zosi?"): her own name first, then MAMA or TATA, then a family name. A wrong train says
whose it is ("To pociąg mamy!", or its word for KOT and DOM) and the question comes again; help shows the name
in the bubble so she can match it, then a wrong train drives off, and last the right train's board pulses
("To pociąg Zosi!").

| Level | words | mode | gaps | extras | similar |
|---|---|---|---|---|---|
| 1 | {name} | ghost | — | 1 | no |
| 2 | {name}, MAMA, TATA | ghost | — | 1 | no |
| 3 | {name}, MAMA, TATA | whose | — | — | — |
| 4 | {name}, MAMA, TATA | highlight | — | 1 | no |
| 5 | {name}, MAMA, TATA | word | — | 1 | no |
| 6 | {name}, MAMA, TATA, KOT, DOM, KASIA, BARTEK, RYSIEK, JUREK, BERNADKA, MIA, LAURA, JAGODA | word | — | 1 | no |
| 7 | {name}, MAMA, TATA, KOT, DOM, KASIA, BARTEK, RYSIEK, JUREK, BERNADKA, MIA, LAURA, JAGODA | missing | 2 | 2 | no |
| 8 | {name}, MAMA, TATA, KOT, DOM, KASIA, BARTEK, RYSIEK, JUREK, BERNADKA, MIA, LAURA, JAGODA | missing | 2 | 3 | yes |
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

Numbered cones block the road. Tap the right one and the cruiser drives on (early on, the sign's dots light up one by one).
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
- **count** — `yes`: after a right answer the sign's dots light up one by one, quickly, and how many is said once
  ("Super! Trzy kropki!"; needs dots on the sign) · `no`: just the number ("Cztery!")
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
  (help counts the stones so far, "Jeden! Dwa!", and asks again; the stone pulses last) · `missing`: the stones lie in order with one gap ("1 2 ? 4"); she puts the right
  stone in (drag it or tap it) and Zosia hops across by herself (3–9 stones; help counts the stones up to
  the gap)
- No number ever lies behind Zosia: she hides the ground behind her from the child's eye (the layout works out
  where, for a 4:3 iPad lying down and one standing up), so the next row comes up clear of her, and a tap that
  lands on her and on a stone goes to the stone.
- After a rough run the next one is gentler: 2 stones a row, far foils, one stone shorter, the number in the
  bubble (`missing` keeps its gap, with a far foil). On Chase's bank the river is praised ("Policzyłaś do
  pięciu!") as she leaps back for the next one. After the last river Zosia stays with Chase for the badge.

### 🦴 Treat House · `counting`

Counting for real, at Chase's pup house.

| Level | types | give | howMany | share | hidden | flash | auto | slots | rounds |
|---|---|---|---|---|---|---|---|---|---|
| 1 | give, howMany, share, howMany | 1–3 | 1–3 | 2–3 | — | — | yes | yes | 4 |
| 2 | give, howMany, share, howMany | 1–3 | 1–3 | 2–3 | — | — | yes | no | 4 |
| 3 | give, howMany, share, howMany | 2–5 | 1–4 | 2–4 | — | — | yes | no | 4 |
| 4 | give, howMany, share | 1–3 | 1–4 | 2–4 | — | — | no | no | 3 |
| 5 | give, howMany, flash, share | 1–3 | 1–4 | 2–4 | — | 1–3 | no | no | 4 |
| 6 | give, howMany, flash, hidden, share | 1–3 | 1–4 | 2–4 | 2–3 | 1–3 | no | no | 5 |
| 7 | give, howMany, flash, hidden, share | 3–7 | 2–6 | 3–4 | 2–4 | 1–4 | no | no | 5 |
| 8 | give, howMany, flash, hidden, share | 5–10 | 4–9 | 3–4 | 2–4 | 1–4 | no | no | 5 |

The treats she gives land on Chase's blue tray in rows of five (a ten-frame), so every one is easy to see.

- **types** — the kinds of round. Each comes up once per mission (a kind listed twice comes up twice; extra
  rounds beyond the list repeat one), in a new order each time, never the same kind twice in a row, and the
  mission ends on an easy one (`share`, or `give` when `auto` is yes). Levels 1 to 3 list `howMany` twice: with
  `auto` on, the give and the share can't be got wrong and don't count, so one lucky tap on a numeral would
  have been the whole run; with two counted questions a blind tapper moves up in about one run in nine, not one in three:
  - `give` ("Daj mu trzy smakołyki!"): move the treats from the pile to Chase — drag them, or tap one and it hops over
  - `howMany` ("Ile smakołyków?"): count the bones on the tray (tapping one counts it aloud), then pick the
    numeral; wrong choices are ±1. Then Chase eats them one by one while they are counted, ending on her number
    (she can feed them to him: a tap on a treat and he eats it, counted)
  - `share` (Chase and kittens wait at their plates, "Każdy dostaje jeden smakołyk!"): she taps whoever is
    still hungry; one treat each, counted aloud
  - `flash` ("Szybkie oko!"): Chase's bowl lifts for two seconds over a few treats laid out like a die, then
    covers them: "Ile było? Daj Czejsowi tyle samo!" (seeing how many at a glance)
  - `hidden` ("Schowane smakołyki"): treats go under the bowl, then one more slides in: "Ile jest pod
    miską? Daj Czejsowi tyle samo!" (adding without words)

  In `flash` and `hidden` she gives Chase the same number and taps him. When it is right, the bowl lifts and
  its treats line up next to hers, one under each, so she sees it is the same. Too few: "Za mało! Jeszcze!"
  and the bowl stays shut. Too many: every treat she gave hops back ("Oj, za dużo! Oddaję wszystkie smakołyki."),
  because giving back only the extra ones would leave exactly the hidden number lying on the tray.

  When she is right Chase eats every treat, one by one ("Trzy smakołyki! Mniam, mniam! Dziękuję!"). She can tap
  along: a treat she taps, he eats at once. A treat that is still in the air (the bones tumbling onto the tray in
  `howMany`) cannot be tapped; it counts once it lies still.
- **give** / **howMany** / **share** / **hidden** / **flash** — the number ranges (give up to 10, howMany up to 9,
  share 2–4 friends, hidden 2–4 treats under the bowl in the end, flash 1–4; `—` if unused)
- **auto** — `yes`: done as soon as the right number is there · `no`: she decides when to stop and taps Chase
  (too few: "Za mało! Jeszcze!"; too many in `give`, where the number is in the bubble: Chase gives the extra ones
  back, "Teraz dobrze? Dotknij Czejsa!", and she taps him again herself). `flash` and `hidden` always need `no`
- **slots** — the helping hand. `yes`: ghost rings show where the treats go (○ ○ ○), and the "how many?"
  numerals have their dots under them · `no`: neither (help shows the rings)
- **rounds** — how many tasks (1–8), at least as many as **types** lists
- Rounds that can't really be got wrong (`give` with auto, `share`) are played but don't count towards the next
  level, so every level has a `howMany`, `flash` or `hidden` round. A gentler run after a rough one turns `auto`
  and the rings on and takes one number off the top of every range (give 1–3 becomes 1–2, flash 1–3 becomes 1–2).

### 🌑 Mercury's Craters · `mercury`

The rocket lands on Mercury under a bright violet sky. A patch of grey ground shows a few round craters
laid out like the dots on a die, so she sees how many at once. Below it are the number tiles to choose from.

| Level | craters | show | labels | choices | rounds |
|---|---|---|---|---|---|
| 1 | 1–3 | stay | both | 3 | 3 |
| 2 | 1–4 | stay | both | 3 | 3 |
| 3 | 1–4 | flash | both | 3 | 3 |
| 4 | 2–5 | flash | numeral | 3 | 3 |
| 5 | 3–6 | flash | numeral | 4 | 3 |

- **craters** — the range of crater counts (1 to 6), laid out like a die so a small number is seen at a glance.
- **show** — `stay` keeps the craters in view while she chooses. `flash`: first "Szybkie oko! Patrz!", then the
  craters show for two seconds, a soft light-pink dust cloud drifts over them, "Ile było?", and she chooses from
  memory.
- **labels** — `both` puts the numeral and its dots on each tile. `numeral` shows only the numeral.
- **choices** — how many tiles (2 to 4). From level 2 the wrong tiles are the neighbours (±1), as on Cone Road.
- **rounds** — crater patches per mission (1 to 6). Each is one question, skill `quantity`, item the number,
  and every question is scored. Right: the dust blows away, the craters light up and her number is said once
  ("Tak! Trzy kratery!"). Wrong: the tile bounces, "Popatrz jeszcze raz." and the question again. Help: the
  dust blows away and the craters light one by one without a number said, then a wrong tile goes away, then
  the right tile pulses. The right tile can be tapped all the while: her answer stops the help.

### 🌙 Moon Jumps · `moon`

Chase lands on the Moon in a big helmet, under a violet sky with Earth above him. Each jump leaves a pair of
big footprints in a row, so she can count the jumps afterwards. The jumps he does by himself are high and
floaty, about one a second to count along; the ones she makes are quick hops, over by the time she taps again.

| Level | types | jump | howMany | auto | slots | rounds |
|---|---|---|---|---|---|---|
| 1 | jump, howMany | 1–3 | 1–3 | yes | yes | 4 |
| 2 | jump, howMany | 1–4 | 1–4 | yes | no | 4 |
| 3 | jump, howMany | 2–5 | 2–5 | no | no | 4 |
| 4 | jump, howMany | 3–7 | 3–6 | no | no | 4 |

- **types**: each kind comes up at least once, with extra rounds repeating one. Kinds alternate when
  there are two, and the last round is always `jump` with auto on, including levels 3 and 4.
  `jump` asks "Skocz trzy razy!": she taps Chase once per jump, and each landing is counted aloud.
  A tap while he is in the air is counted too: he jumps again as soon as he lands. `howMany` asks her to watch him jump silently, then
  "Ile było skoków?": she can tap each footprint pair to count it and choose the numeral. The other
  choices are one less and one more. The footprints then light up and her number is said once ("Tak! Pięć!").
- **jump** / **howMany**: the number ranges, up to 9; `—` when howMany is unused.
- **auto**: `yes` finishes a jump round when the requested number of footprints is there. With `no`,
  the rocket flag stands up after her first jump and she taps it when she is done ("Dotknij flagi, kiedy
  skończysz!"). Too few: "Za mało! Skacz dalej!" Too many: the extra footprints fade and she hears
  "Za dużo! Teraz dobrze?" and is asked for the flag again. A wrong flag is answered by the help ladder:
  the first miss says no and asks again, the second shows the footprint outlines, the third makes Chase
  (or the flag, once there are enough footprints) pulse.
- **slots**: `yes` shows ghost footprint outlines and dots under the numeral choices. With `no`,
  neither is shown; help reveals the outlines. A gentler run turns both auto and slots on and takes one
  number off the top of both ranges (so level 1 has an easier step too).
- **rounds**: tasks per mission, 1 to 8, with at least one per kind. Automatic jump rounds are played
  but unscored, so every level includes howMany; levels 1 and 2 have two (four rounds). Manual jumps practise producing a number (`counting`);
  howMany practises `quantity`.
- **size**: the footprints are as wide as 1.44 world units (a footprint pair is about 80 px on the iPad)
  where the round leaves few of them, and narrower only when a long row has to fit. Chase is drawn 1.4 times
  the size of the other pups.

### 🚙 The Mars Rover · `mars`

The rocket lands on Mars, under a pinkish-violet sky with two tiny moons. Chase sits in a six-wheeled rover
with a dish on top. Big red rocks ahead show white numerals (and dots under them early on). Tap the rock the
bubble asks for and the rover drives there, scans it and sparkles, then drives back to where it started
while the rocks clear, so it never stands in front of the next round's rocks.

| Level | max | choices | ask | rock | rounds |
|---|---|---|---|---|---|
| 1 | 3 | 3 | match | both | 3 |
| 2 | 5 | 3 | match | both | 3 |
| 3 | 5 | 3 | name | numeral | 3 |
| 4 | 6 | 3 | dots | numeral | 3 |
| 5 | 9 | 4 | name | numeral | 3 |

- **max**: numbers go from 1 to max (2–9)
- **choices**: how many rocks (2–4, not more than max); from level 2 the wrong ones are neighbours (±1)
- **ask**: `match` shows the numeral in the bubble (with its dots when the rocks show dots): find the same, as on
  Cone Road · `dots` shows dots in the bubble, so she counts them and finds the numeral (help lights the dots one
  by one; the number is named only when the answer is shown) · `name` shows nothing, only speaks
  ("Jedziemy do kamienia z numerem trzy!"); help shows the dots
- **rock**: what the rocks show: `both` (numeral + dots) or `numeral`
- **rounds**: how many rocks she visits (1–8)
- **A gentler run** after a rough one has one rock fewer, the numeral and its dots in the bubble and on the rocks

### 🪐 Saturn's Rings · `saturn`

The rocket stops at Saturn, where the rings have broken apart: there are holes in them. One piece floats in at a
time, ice (a pale blue crystal) or rock (a brown stone), big or small. She drags it into its hole (or taps the
ring). Each piece mends a little of its hole; when the rings are whole, Saturn turns slowly and Chase cheers.

| Level | pieces | named | sizes | sort |
|---|---|---|---|---|
| 1 | 4 | yes | same | kind |
| 2 | 6 | no | mixed | kind |
| 3 | 6 | no | mixed | both |
| 4 | 8 | no | mixed | both |

- **pieces**: how many pieces come, one at a time (2–8). Each piece is one round and one question (skill
  `sorting`), so the progress paws count pieces. Both kinds come in every mission, never three of the same kind in a
  row, and their counts differ by at most one.
- **named**: `yes` names each piece as it arrives and asks for its ring ("To jest lód. Gdzie jest lodowy
  pierścień?"), and the bubble shows ❄️ or 🪨. `no` asks her to judge by its look ("Lód czy skała? Gdzie to
  pasuje?"), and the bubble shows a question mark; the clue names it ("To jest lód.").
- **sizes**: `same` gives every piece the same size. `mixed` gives big and small pieces (a big one is twice a
  small one), each kind its own share of both.
- **sort**: `kind` has one hole at the front of each ring, and the whole ring takes her tap. `both` sorts by two
  things at once: each ring has a big hole on the left and a small hole on the right, so a big ice crystal goes in
  the ice ring's big hole ("Lód czy skała? Duży czy mały?"; the clue: "To duży kawałek lodu."). A tap anywhere on
  the half ring around a hole picks that hole. Needs `named` no and `sizes` mixed.
- **Dropping.** The ring (or half ring) under the piece lights while she drags it, the same for the right ring and the
  wrong one, so it never gives the answer away. A drop counts on the ring drawn under the middle of the piece, or on the
  nearest ring within 3% of the screen's short side of it (about 25 px on an iPad), because the front of a ring is
  only 18 to 38 px tall and the piece is drawn above her finger. A drop farther from every ring floats back with a soft
  tick and a short glow on every ring, and counts for nothing. A tap on a ring still answers, and a tap on the planet
  is never an answer; over the planet the piece lands on no ring.
- The third miss (or a long wait) makes the right hole glow. A run cut short closes the holes before "naprawione!".

### 🤍 Pluto's Heart · `pluto`

The rocket lands on Pluto, a small pale planet with a big, soft heart on its front, dim at first. Chase
watches from his round window. On the icy ground lie a few shapes, all one colour, and Chase asks for one
by name ("Gdzie jest owal?"), a different one each round. Each shape she finds floats up into Pluto's heart,
which shines a little brighter, and Chase names it ("Super! To jest owal!").

| Level | shapes | ask | choices | similar | turned | rounds |
|---|---|---|---|---|---|---|
| 1 | heart, star, oval | match | 2 | no | no | 3 |
| 2 | heart, star, oval, rectangle | name | 3 | no | no | 3 |
| 3 | heart, star, oval, rectangle, diamond | name | 3 | yes | no | 4 |
| 4 | heart, star, oval, rectangle, diamond | name | 4 | yes | yes | 4 |

- **shapes**: the shapes she is asked to find: serduszko (`heart`), gwiazda (`star`), owal (`oval`), prostokąt
  (`rectangle`), romb (`diamond`), and the Garage's koło, kwadrat, trójkąt (`circle`, `square`, `triangle`). Each
  round asks the next one in a shuffled order, never the same one twice in a row. The other pieces come from all
  eight shapes. Each round is one scored `shape` question, item the shape.
- **ask**: `match` draws the shape in the speech bubble. `name` shows a question mark: Chase only says it. The
  clue (a long wait) draws it in the bubble; the second miss takes a wrong piece away; the third pulses the right one.
- **choices**: how many pieces lie on the ground (2–4), all in the same colour so colour never gives the answer.
- **similar**: `yes` puts the asked shape next to the one it is most easily taken for: owal by koło, prostokąt by
  kwadrat, romb by kwadrat. `no` keeps them apart.
- **turned**: `no`, every piece is the textbook shape; `yes`, the pieces are turned a little and bigger or smaller.
  The square never turns far enough to look like the romb.
- **rounds**: shapes to find per mission (1–6). When the visit is cut short, the last one is the heart, and the
  heart shines fully before "Serduszko Plutona świeci!".

### 🕳️ The Black Hole · `blackhole`

Through the rocket's golden window, she sends friendly space pebbles towards a small, distant black
hole in a bright violet sky, and watches some fall in from the shelf: how many are left? Chase stays
in the rocket and cheers.

| Level | types | drop | away | fall | auto | slots | rounds |
|---|---|---|---|---|---|---|---|
| 1 | drop, away | 1–3 | 2–3 | 1–1 | yes | yes | 4 |
| 2 | drop, away | 1–4 | 3–4 | 1–2 | yes | no | 4 |
| 3 | drop, away | 2–6 | 3–5 | 1–2 | no | no | 4 |
| 4 | drop, away | 3–8 | 4–6 | 1–3 | no | no | 4 |

- **types**: each kind appears, kinds alternate, and the last round is always `drop` with auto on.
  `drop` asks "Wypuść trzy kamyki!": tap a pebble or drag it towards the window. Each pebble spirals
  into the black hole's glowing ring and lights one bead under the window, counted aloud, so she can
  still count what she sent. "Czarna dziura świeci jak lampka!" comes once a visit, after her first drop.
  `away` is taking away: the shelf fills with pebbles ("Trzy kamyki!"), the last ones lift off 0.4 s
  apart and spiral in, each leaving a pale outline where it lay ("Jeden wpadł."), then "Ile zostało?"
  and three numeral tiles: what is left, what there was, and a neighbour of what is left. She can tap
  each pebble left on the shelf to count it before choosing. The pebbles left then glow and her number
  is said once ("Tak! Dwa!").
- **drop**: the range of pebbles to send, up to 9.
- **away** / **fall**: how many pebbles were on the shelf (2–7) and how many fall in (at least one
  always stays). The number left is the question (skill `quantity`).
- **auto**: `yes` finishes a drop at N lit beads. With `no`, she taps the rocket's big button to check;
  the button comes once she has sent her first pebble. Too few: "Za mało! Wypuść jeszcze!" Too many:
  every bead goes dark, "Za dużo! Policz jeszcze raz!", and she sends them again. A wrong check is a
  wrong answer on the shared help: the second shows the bead outlines, the third pulses the pebble or
  the button.
- **slots**: `yes` shows unlit bead outlines for a drop and dots under the tiles. With `no`, help can
  reveal the outlines. A gentler run turns auto and slots on and takes the smallest numbers.
- **rounds**: tasks per mission, 1 to 8, at least one per kind. Automatic drops are unscored, so
  levels 1 and 2 have four rounds: two scored `away` questions. Manual drops practise `counting`;
  choosing what is left practises `quantity`.

### ⭐ Star Pictures · `stars`

Big gold stars sit on the corners of a hidden picture, each with a numeral on a big tile under it. Star 1
already shines; she taps the next number and a glowing gold line draws the outline. At the end the picture
fills with soft colour and Chase names it. The speech bubble shows the numbers so far and a question mark
("1 2 ➜ ?", the last three at most) while Chase asks "Jeden, dwa, a co dalej?"; it never shows the answer.

| Level | stars | order | labels | rounds |
|---|---|---|---|---|
| 1 | 3–4 | up | both | 2 |
| 2 | 4–5 | up | both | 2 |
| 3 | 5–6 | up | numeral | 2 |
| 4 | 6–7 | up | numeral | 2 |
| 5 | 4–5 | down | numeral | 2 |
| 6 | 3–4 | twos | numeral | 2 |

- **stars**: the range of star counts. Each round is one picture and a mission never repeats a
  picture; a mission that reaches 7 in `up` order always ends on the Wielki Wóz (7, the line left open).
- **order**: how the numerals run along the picture. `up` is 1, 2, 3… . `down` is a countdown from the
  number of stars to 1: the first star carries the biggest numeral, and the first question of each picture
  says "Liczymy od tyłu!" first ("Pięć! Cztery! A dalej?"). `twos` is 2, 4, 6… , at most 4 stars so the
  numeral stays one digit, and the first question says "Liczymy co dwa!". Chase says the last three numbers
  so far.
- **labels**: `both` draws the numeral and dots on the tile; `numeral` draws only the numeral. The tile is
  as good a thing to tap as its star.
- **rounds**: pictures joined per mission (1–4); every star after the first is a scored `sequence`
  question, item the numeral asked, and its options are the stars not yet lit. A gentler run goes back to
  `up`, with both labels and one smaller picture.

### 🔭 The Telescope · `telescope`

She looks through a round brass eyepiece and taps a floating place. First she matches a picture,
then finds a place by name or by a feature. The place hops with sparkles: "Tak! To jest Saturn."
The last level asks what comes next along the road from the Sun, and shows that road.

| Level | pool | choices | ask | rounds |
|---|---|---|---|---|
| 1 | sun, earth, moon, saturn | 2 | match | 4 |
| 2 | sun, earth, moon, saturn, mars, jupiter | 2 | name | 4 |
| 3 | sun, earth, moon, saturn, mars, jupiter, comet, blackhole | 3 | name | 5 |
| 4 | sun, earth, saturn, mars, jupiter, comet, pluto | 3 | feature | 5 |
| 5 | mercury, venus, earth, mars, jupiter, saturn, uranus, neptune, pluto | 3 | name | 5 |
| 6 | mercury, venus, earth, mars, jupiter, saturn, uranus, neptune | 3 | order | 5 |

- **pool**: place kinds from `PLACES`. Feature pools only include places with a feature question.
- **choices**: how many places float below the picture (2 to 4), with one unambiguous answer.
- **ask**: `match` shows the same place above; `name` asks its name; `feature` asks about rings,
  redness, our home, the largest planet, a tail, a heart or light and warmth; `order` asks what
  follows a planet along the road. Order records `sequence`; the others record `space`.
  An `order` round draws the road from the Sun along the top of the eyepiece: the Sun and every planet
  of the level's pool in order, small, with one place empty ("?") where the answer goes. "Co jest po
  Wenus?" asks for the place that fits; the choices float below the road. A right choice flies into the
  empty place. A place on the road says its name when she taps it, and the "?" asks the question
  again. The clue walks her eye along the road from the Sun to the "?" without naming anyone.
- **rounds**: how many places to find.
- A gentler run takes one step down: one choice fewer (never below 2); order and feature fall back to
  `name`; `name` with two choices falls back to `match`; `match` with two choices is a run one round shorter.

### ☁️ Venus's Clouds · `venus`

Venus is a big, friendly ball under thick, soft, creamy clouds. A few clouds slide apart
and show a big shape in a pale window: which one is it? Chase watches from his round window.
In a `part` level only a corner or a curve peeks out until she answers.
The shape and the tiles are all one deep blue, which reads against the pale window and the cream tiles
(yellow on yellow did not), and a colour never says which shape it is. The question is "Jaki to kształt?"; "Chmury
się rozsuwają!" is said only when a clue opens the clouds (the first clue of a `part` level). A tap while the clouds
are still sliding apart counts.

| Level | reveal | turned | choices | rounds |
|---|---|---|---|---|
| 1 | full | no | 2 | 3 |
| 2 | full | no | 3 | 3 |
| 3 | part | no | 3 | 3 |
| 4 | part | yes | 3 | 3 |

- **reveal**: `full` opens the clouds over the whole shape; `part` shows only part of it until she answers.
- **turned**: `no`, the textbook shape; `yes`, turned and bigger or smaller (the square stands on a corner, the triangle is not the textbook one).
- **choices**: how many tiles (2 or 3): the right shape and the others from koło, kwadrat, trójkąt.
- **rounds**: shapes per mission (1–6), each kind before any repeats, never the same shape twice in a row. Each is one question, skill `shape`, item the shape, every question scored.

### 🟠 Jupiter's Stripes · `jupiter`

The rocket arrives at Jupiter under a bright violet sky. Jupiter is a huge ball with wide horizontal
stripes, and Chase watches from his round window. She paints the stripe row, then compares Jupiter
and the Sun with Earth.

| Level | types | pattern | bigger | rounds |
|---|---|---|---|---|
| 1 | stripes, bigger | AB | big | 3 |
| 2 | stripes, bigger | ABB | big | 3 |
| 3 | stripes, bigger | gap | both | 3 |
| 4 | stripes, bigger | ABC | both | 4 |

- **types**: each kind comes up once; extra rounds repeat `stripes`, and no kind comes twice in a
  row unless there is no other room for it.
- **pattern**: `AB` two colours taking turns (white, orange, white, orange, which next) · `ABB` white, orange,
  orange (or white, white, orange), which next · `gap` an AB or ABB row with one stripe missing in the middle
  instead of at the end · `ABC` white, orange, brown, which next. At least two full repeats come before the blank.
  A row does not always start with white or end on the same stripe: it starts with any of the four colours (white,
  orange, brown, red) and is one of two or three lengths, so the missing stripe is sometimes the first colour of the
  repeat and sometimes another, and every colour is the right one in some rows. The pots are the row's colours plus
  one colour that is not in the row. A gentler run has only the row's own colours (two pots)
- **bigger**: `big` always asks for the bigger · `both` asks bigger or smaller at random. Earth is
  small on purpose; the huge ball is Jupiter or the Sun.
- **rounds**: tasks per mission, 1 to 8, with at least one per kind. `stripes` is scored as
  `pattern` with the pattern name as its item; `bigger` is scored as `comparison` with `bigger` or
  `smaller`. Every question counts. Right: the painted row's pattern is said once ("Biały, pomarańczowy!"),
  not the whole row; "Jowisz jest dużo większy od Ziemi!" comes once a visit.

### ☄️ Comet Catch · `comet`

Comets with letters glide slowly past. Catch every comet with the asked letter, counting them as you go.

| Level | pool | ask | targets | total | speed | similar | rounds |
|---|---|---|---|---|---|---|---|
| 1 | START | match | 2 | 4 | 0.25–0.4 | no | 3 |
| 2 | START | name | 2 | 5 | 0.25–0.4 | no | 3 |
| 3 | MORE | name | 3 | 6 | 0.3–0.5 | no | 2 |
| 4 | ALL | name | 3 | 6 | 0.3–0.5 | yes | 2 |

Level 1 shows the asked letter in the bubble to match; from level 2 she has to know it by name (2), then
new letters and more comets to catch with a little more speed (3), then lookalikes (4).

- **ask** — `match`: the letter is in the speech bubble and is named ("Złap komety z literą Be!"): find the same.
  `name`: the bubble shows only a question mark, the letter is only said. Help shows its picture word in the bubble
  ("Be jak banan!") and only the answer shows the letter
- **targets** — how many comets have the right letter (1–4) · **total** — comets in the sky (3–8)
- **speed** — how fast they glide, a range (a round picks one speed inside it, the same for every comet). They glide
  in four lanes that never touch, from right to left below the speech bubble. A comet leaves past the left edge,
  tail and all, and comes back in from the right edge: it never appears or disappears in the middle of the sky.
  The comets are spread evenly round that loop, and the ones with the asked letter are as far apart from each other
  as they can be, so one is always in reach while two or more are left. A comet is caught only while its whole
  letter is in view; outside that it flies several times faster, so the last one is back within about 6 seconds
- **similar** — as in Kitty Park · **rounds** — how many letters to catch (aim for 30–45 seconds in all)
- **A gentler run** after a rough one has two fewer comets (never fewer than one wrong comet beside the right ones),
  slower, no lookalikes, and the letter in the bubble

### 💡 The Lighthouse · `lighthouse`

Dusk at the lighthouse: a warm orange-pink sky, calm green-blue water and a boat coming home. The lamp
flashes, and she counts the flashes or makes the lamp flash as many times as the number on the boat's sail.

| Level | mode | numbers | choices | rounds |
|---|---|---|---|---|
| 1 | marks | 1–3 | 2 | 4 |
| 2 | flashes | 1–4 | 3 | 4 |
| 3 | make | 2–5 | — | 3 |
| 4 | more | 1–4 | — | 3 |

- **mode**: `marks` keeps a yellow dot on the board for every flash (things that stay); `flashes` has no dots, so
  she counts what she saw, and tapping the bubble replays the flashes; `make` puts the number on the boat's sail,
  she taps the lamp that many times and then the boat; `more` flashes a number, keeps a pale dot on the board for
  each flash and shows one empty place after them ("Mrugnij o jeden raz więcej!"): she makes as many flashes and one
  more, each lighting the next place, the empty one last, and then taps the boat.
  The flashes she makes are quick and each lights a dot; quick taps flash one after another, every one counted,
  and the boat is judged once they have all played.
- **numbers**: the flashes shown, or the number on the sail (1 to 5). `more` asks for one more than it shows (2 to 5),
  and that count is what it records.
- **choices**: how many numeral buoys she picks from (2 to 4). `make` and `more` have none: she produces the count.
- **rounds**: boats brought home per mission (3 to 5). Every round is one scored question; in `more` the board keeps
  a place for every flash she makes, so the grown-ups' page counts it as solved but it does not move mastery. Right:
  the lamp shines a beam and the boat sails into the harbour; the next boat sails in while she is praised, and its flashes start
  after the praise. Wrong: the boat bobs, "Nie, to nie ten." (`make` and `more`: "Za mało! Policz jeszcze
  raz!" and her dots go out; the pale ones stay) and the question again, nothing more. Help: the dots light one by
  one (`marks`), or the flashes again (`flashes`, and `more`: the ones she saw, each pale dot glowing with its
  flash, the empty place still empty), or the lamp shows itself (`make`); last the right buoy pulses, or the lamp
  flashes the answer ("Mrugnij trzy razy!") and she makes it herself. A boat is never lost.

### 🦆 Pływa czy tonie? · `shallows`

A sunny beach with a glass pool on it, seen from the side: blue water up to a clear white surface line, sand on
the bottom. One thing waits on a plank above the water; when it drops in, it splashes, then rests across the
surface line or sinks slowly to the sand. Two big shelves stand on the beach, each under a large picture of the
same pool: a duck sitting on the surface line ("pływa"), a stone lying on the bottom ("tonie"). Things already
sorted stay on the shelves, so she sees the groups grow.

| Level | mode | things | rounds |
|---|---|---|---|
| 1 | watch | familiar | 4 |
| 2 | guess | familiar | 4 |
| 3 | surprise | all | 5 |

- **mode** — `watch`: "Wrzuć to do wody!", she taps the thing and watches it float or sink, then "Pływa czy
  tonie?" and she taps the shelf for what she saw; only then "Brawo! Jabłko pływa!". `guess`: first "Pływa czy
  tonie?" and she taps a shelf as her guess, then the thing drops in and shows the answer. `surprise`: as
  `guess`, with the big log and the little coin among the things. A guess is one try: a wrong one gets no "no",
  the thing shows what it does ("Popatrz! Kłoda pływa!") and goes to its shelf, then the next round. Help in
  `watch`: "Nie, to nie ten." and the question again, then the thing bobs ("Popatrz uważnie!"), then the right
  shelf pulses. A gentler run is `watch` with the familiar things; one after a rough `watch` run also says what
  the thing did before it asks.
- **things** — `familiar`: an apple, a ball, a rubber duck, a stone, a key and a spoon. `all`: also a leaf,
  a wooden block, a big log (clearly the biggest) and a little coin (clearly the smallest), so the log floats
  and the coin sinks. Chase never says heavy or light.
- **rounds** — things dropped per mission (1 to 8). `watch` is scored on the shelf tap (the tap that drops it
  is not scored); `guess` and `surprise` are scored on the guess, once: a right guess is right first time, a
  wrong one counts against the run. Every level has at least one scored question.
### 🦀 The Reef · `reef`

Under water at a bright, shallow reef, seen from the side: blue water, a sandy floor, green sea grass, a big
grey rock with a dark hollow under its ledge, and a big pink shell lying open. A crab, a starfish, a little fish
and an octopus take turns hiding on, under, in and next to them.

| Level | mode | words | choices | rounds |
|---|---|---|---|---|
| 1 | see | na, pod | 2 | 4 |
| 2 | hear | na, pod, w | 3 | 4 |
| 3 | hear | na, pod, w, obok | 3 | 4 |
| 4 | place | na, pod, w, obok | 3 | 3 |

- **mode**: one scene each round. `see` and `hear`: the same animal sits in two or three places at once,
  "Który krab jest pod kamieniem?", and she taps the one that is; `see` shows a small picture of the asked
  place in the bubble, to match with what she sees; `hear` gives the words only (the bubble shows the animal).
  `place`: the animal waits above the scene and three large bright rings mark places ("Połóż kraba pod
  kamieniem."). She taps a ring and the animal swims there.
- **words**: `na`, `pod`, `w`, `obok`. Only real places are used: on the rock, under the rock (in the hollow,
  only its eyes showing in the dark), in the shell, and next to the rock or the shell. `na` is only on the rock
  and `w` only in the shell, so they never share a spot. Where the scene can, another animal (or ring) is on the
  same thing as the asked one (on and under the rock), so the thing alone does not tell which.
- **choices**: how many places the animal sits in (2 to 4), or how many rings in `place`.
- **rounds**: questions per mission (1 to 8). Each is one scored question, skill `position`, item the word.
  Right: the animal celebrates and the answer is said in a full sentence. Wrong: a gentle bounce, "Nie, to nie
  ten." and the question again; then one wrong animal swims away (with two to pick from, the animals hop one by
  one: "Popatrz uważnie!"); the right animal or ring pulses only at the end of the help. Each round's word is
  picked at random, never the same three times in a row.

### 📯 The Port · `port`

A little sunny port with a wooden quay, five small moored boats bobbing, each with its animal painted on a white
board (the boat is named after it: a seal is Foka), and Chase watching from his round window. Every board is the
same width, so it never tells how long a name is. A big round horn stands on the quay. One boat comes forward,
and she toots its name once for each syllable.

| Level | mode | syllables | rounds |
|---|---|---|---|
| 1 | together | 1–2 | 4 |
| 2 | alone | 1–3 | 4 |
| 3 | which | 1–3 | 4 |

- **mode** — `together`: Chase claps the name first ("Me! Wa!"), then asks "Zatrąb jej imię po kawałku!", and she
  copies it with the horn. Once she has solved a `together` boat, a later clap ends at her first toot ·
  `alone`: she hears only the whole name ("Ta łódka nazywa się Foka.") and "Zatrąb jej imię po kawałku!", and toots it
  herself. A save that has not yet solved a `together` boat opens its first `alone` round with one: a name of two
  pieces, so she sees how a name is tooted in pieces before she does it alone. It is one of the level's rounds,
  and the save remembers it (`port.together`), so it comes once ·
  `which`: three boats come forward, each hops as its name is said ("Kot!", "Motylek!", "Foka!"), then "Która łódka
  ma dwa kawałki?", and green ticks appear under the boats with the question; she taps the tick under a boat.
  Tapping a boat itself says its name again, and stops the names if they are still going.
- **syllables** — the range of syllable counts in the names this level uses (1 to 3). Every syllable block
  lights as she toots; the boat toots back once per syllable, then says the whole name.
- **rounds** — boats per mission (1 to 8). Each round is one scored `syllables` question, the word (or the asked
  count in `which`). In `together` the name's pieces are on the board as she toots, so the grown-ups' page counts
  the boat as solved but it does not move her mastery of the name. A boat asks one thing first. After her first
  toot, and a pause of about one and a half seconds, the game says "Gotowe? Dotknij łódki!" once, whatever the count, and the
  boat hops. Her toot marks stay through a replay of the question (which says the whole of it once that line has
  been said) and clear when the next boat comes. Too few or too many toots: "Za mało! Posłuchaj jeszcze raz.", the
  boat's name again, and she toots it again from the start. Help: the horn shows itself ("Dotknij rogu i zatrąb raz
  na każdy kawałek!"); last Chase claps the name slowly and she toots it herself. `which`: a wrong boat says how many
  pieces it has ("Ta łódka ma trzy kawałki."), then a wrong boat sails off, then the right board pulses; a long
  wait brings the three names again. Right:
  the boat sails out happily, saying its name once; the next boat comes in meanwhile. The name is said once
  before her toots (Chase's clap, or the whole name) and once after. A boat is never lost.

### 🗼 The Lookout · `lookout`

Ride the glass elevator up the Lookout ("Baza"). Press the floor on the elevator panel; on the way the car
stops at each floor, its sign lights up and there is a short beat before the number is said, so she (or her
parent) can count along first. She can tap along too: a tap on the signs while the car rides pulses the floor
it is at, with a pop. The ride keeps its length (she loves it). Lost kittens wait on the floors, each right
beside its floor's sign: each ride picks one up (it hops in as she is praised, and the next ride's question
comes meanwhile), and at the end everyone goes to the very top and down the slide together!

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
  floors and 2+ rounds). The kitten is not on the floor yet: it appears when the lift arrives, so no sign beside it
  gives the floor away · `dice`: a big dot die beside the car, "Dotknij kostki!" (or Chase rolls it); it says how many floors up
  ("Dwa piętra w górę! Na które piętro?") and she presses the floor they land on, counting on from where the
  car is; the kitten is a surprise on that floor (age 4+) · `go`: one easy kitten on floors 1–3, numeral and
  dots (the gentler run after a rough one; at level 1, which is that already, it is one ride). A wrong floor: "Nie, to nie ten." and the question again. Help
  lights the floors one by one without saying the number (`find`: the sign beside the kitten; `relative`: the
  floors up to the car; `dice`: as many floors as the die says); `pickup` adds the dots to the number in the
  bubble; last the right button pulses
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
- **mode** — `pictureSound`: parcels with pictures, asked by the letter's name, "Co zaczyna się na literę Ka?" →
  tap the cat. The letter is in the bubble too, and the praise is the word she found, "Tak! Kot!" ·
  `soundLetter`: letter mailboxes and one parcel with a picture, "Do której skrzynki pójdzie kot?" →
  drag the parcel into K (or tap the mailbox). The parcel is posted when its middle is over a mailbox; a small
  lift, or a drop anywhere else, floats it back and posts nothing. The parcel waits well in front of the
  mailboxes, so a small lift is nowhere near one. The letter is written on the mailbox, and the praise names it,
  "Brawo! Ka jak kot!"
- **similar** — optional: `yes` lets sound-alikes (P/B, T/D, K/G, S/Z, W/F, M/N) be choices together

Each mode names the letter in one way, and the question, the clue and the praise of a round all come from the
same row of one table (`LETTER_ROWS` in `src/lang/pl.js`), so a letter's name never meets its sound. `pictureSound`
speaks by the letter's name and `soundLetter` by the written letter and its name; both record the skill
`letterSound` (the first sound of a word), which is what the round tests. A third row asks by the held sound ("Co
zaczyna się na ssss?", clue "Ssss… jak samolot!"); no level uses it yet. It exists only for the letters that can be held
(`AEFHILMNORSUWZ`), and for any other letter the round asks by name. A gentler run of any level asks by name.

### 🧺 Pup Picnic · `picnic`

A picnic with Chase: more, less, the same — by looking, before numbers.

| Level | max | modes | close | numerals | rounds |
|---|---|---|---|---|---|
| 1 | 5 | more | no | no | 5 |
| 2 | 5 | more, less | no | no | 5 |
| 3 | 5 | more, less, same | no | no | 5 |
| 4 | 5 | more, less, same | no | yes | 5 |
| 5 | 5 | more, less, same | yes | yes | 5 |
| 6 | 10 | more, less, same | yes | yes | 5 |

- **max** — the biggest amount (3–10)
- **modes** — the questions, taking turns: `more` ("Gdzie jest więcej smakołyków?", hungry Chase eats them) ·
  `less` (a kitten with a small tummy: "Kotek ma mały brzuszek! Gdzie jest mniej smakołyków?") · `same`
  (Chase has his own treats on a plate: "Gdzie jest tyle samo, co u Czejsa?")
- **close** — `no`: the amounts are far apart (2+ difference) · `yes`: they differ by one
- **rounds** — five questions a visit. There are only two blankets, so a blind tap is right half the time; at
  three questions a blind tapper moved up in one run in two, at five it is about one in five.
- **numerals** — `yes`: the blankets show numerals instead of treats (3 or 5?); the treats appear after
  (no < > signs). The clue lines each group up on its own blanket, one row each from the middle outwards: the
  longer row has more. With numerals the clue puts the dots under each numeral. Right: "Tak! Tu jest więcej!
  Pięć!" as the eater trots over and eats them ("Mniam, mniam! Dziękuję!" once a visit).
- The treats lie in neat rows of up to five and never touch (also in the clue's rows and on Chase's plate). The
  blankets are what she taps; the kitten, Chase and Zosia behind them are theirs: a tap on the kitten meows, it is
  not an answer. A gentler run takes one treat off the top (never below four) as well as the closeness and the numerals.

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
- **a shape counts where she drops it** — a piece let go over a hole is tried in that hole: the asked piece over its
  own hole goes in; over another shape's hole it does not fit ("Nie, to nie ten."); another shape than the asked one
  is named ("Nie, to koło.") wherever it goes; let go away from the door it floats back and nothing is counted.
  Tapping a piece still tries it in the asked hole. A gentler run takes every mode one rung down, and level 1, which
  has none, one job fewer.
- **shapes** — `shown`: one hole in the door, the shape in the bubble and named ("Który kształt pasuje? Koło!") ·
  `name`: a hole for each of koło, kwadrat, trójkąt; she hears which one ("Gdzie jest kwadrat?"), twice, and the
  last one hops in by itself · `turned`: as `name`, but the pieces lie turned and bigger or smaller, the square
  stands on a corner, and the triangle is not the textbook one (a square corner, long and flat, tall and thin)
- **pattern** — `AB`: red, blue, red, blue… which flag comes next? (two colours of the row and one other to
  choose from) · `gap`: the same kind of row with one flag missing in the middle · `ABB`: red, blue, blue (or red,
  red, blue)… which comes next? After a right answer the pattern is said once, flag by flag ("Czerwona!
  Niebieska!"), not the whole row
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

`src/config.js`: child's name and its Polish forms, her age for a new save (`childAge`, see
[Starting levels](#starting-levels); afterwards the grown-ups' page sets it), `goodRunsPerLevel`, help timings (`assistSeconds`),
session length (`session`), picture words for letters, voice and graphics quality. Spoken lines live in `src/lang/pl.js`.
Grown-ups can see what she knows — and use developer tools (levels, "next trip", reset) — at `#parent`
(e.g. `https://…/#parent`) or by pressing and holding the badge shelf (top left of the island) for 3 seconds, while a ring fills round it.
The page's title shows which version is running (the same small label as at the bottom right of the start screen).
It counts every question she solves, apart: right first time, after an error, or after help (a clue or the answer
shown; hearing the question again is not help). Only an answer a guess could miss moves mastery; one it could not
(the last star of a picture, a Port name whose pieces are on the board, a Lighthouse `more` count) is counted as
solved and leaves mastery as it is. A tap that only moves the game on (the drop in Pływa czy tonie?, an automatic
give, jump or drop, the Treat House share) is not a question and is not counted at all. A count she makes (Port
toots, Lighthouse flashes) is scored against the counts the level asks for, the outcomes a blind tapper has, and
"a guess" on the page adds up one in the options of each answer a guess could miss. Each place reads not started,
started (she went in), or completed (it has a badge), and the page says what the stars, paws and badges on her
screen mean. Single answers are not stored, so a save from before these counts (13 November 2026) cannot have its
earlier solves counted: the page says when the counts began, and there a place with no badge and no start reads
not completed yet.

**New versions.** The installed app is suspended, not closed, so it can sit on an old build for days. Each time it
comes back to the front it asks for a new version, and switches to it only on the start screen or on the island with
nothing happening (`mayUpdateNow` in `src/app-update.js`). Inside a mission, a celebration or a trip it waits and
switches the next time she is back on the island; the switch reloads to the start screen.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Run locally (also on the Wi-Fi, for the iPad) |
| `npm run check` | Check this file's level tables |
| `npm run build` | Check + production build (app with offline support) |
| `npm run voices` | Record any missing voice lines with ElevenLabs |
| `vercel deploy --prod` | Publish to https://pup-patrol-theta.vercel.app |
