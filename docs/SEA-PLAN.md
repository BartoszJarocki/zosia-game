# Lighthouse and sea plan

Zosia taps a little harbour on the island's back shore, puts on a life jacket with Chase and sails out into the bay.
The bay is a second map, like space, with the lighthouse, a reef she sees through the boat's glass floor, a sandy
shallow and a small port. Each of those four has a game. Three more stops (a seal, the gulls, a buoy) are look-only.
Phase 1 makes the trip and the lighthouse game playable, because the lighthouse is what she asked for. Phases 2 and 3
add the water games. Two of them teach skills the game has never taught, position words and syllables.

## 0. What this plan stands on

- **A measurement of the island.** The home camera projected onto the three iPad sizes (scratch script, 2026-11-08).
  The lighthouse is off screen in portrait (it lands at x 910 of 820 px). The back shore right of the Lookout is on
  screen at all three sizes, at about (785, 160) px at 1180 × 820 and (690, 230) px at 820 × 1180. So the trip starts
  from a harbour there, not from the lighthouse itself.
- **The space map.** It already has areas (`area`, `leadsTo` in `src/places.js`), a trip state machine, look-only stops,
  the director on a second map, the way home and keepsakes. The bay reuses all of it.
- **The polish plan.** It deferred "prepositions as their own mission" and the "rhythm parade" until the core missions
  were finished (docs/POLISH-PLAN.md, section 7). They are finished now.
- **Facts.** The floating, lighthouse and position-word facts come from the sources in section 10, found by web search.
  I read the search summaries, not every full page. The sea animal facts (a crab walks sideways, an octopus has eight
  arms) are general knowledge, not yet checked. Unit 7 checks them before Hanna records them.

## 1. A trip, step by step

1. A small wooden harbour stands on the back shore, right of the Lookout, with a boat tied up. She taps it, the cruiser
   drives over, and Zosia and Chase put on orange life jackets. "Zakładamy kamizelki!"
2. Casting off. She taps the boat's horn herself. "Tuu-tuu! Płyniemy!"
3. Sailing out. The island slides behind, the waves rock the boat, and the bay opens up.
4. The bay map. A path of buoys runs from the harbour around the bay. The island's bouncing star marks a suggested stop.
   She taps any stop and the boat sails there along the buoys, naming what it passes ("Mijamy fokę!").
5. Arrival. A stop with a game starts it. A look-only stop does one thing when she taps it, and the boat waits.
6. After a game comes the usual celebration, then "Płyniemy dalej czy do domu?" The harbour is the way home.
7. When the finale is due or she is tired, Chase says "Wracamy na wyspę!" and the boat sails home. The finale and the
   goodnight stay on the island, as with space.

## 2. What she learns, and what we leave out

**New, position words (`position`).** Na, pod, w, obok. Polish speech-development guides list understanding commands
with na, pod, w, przed, za and obok among a three-year-old's skills (section 10). First she matches ("Krab jest pod
kamieniem. Gdzie jest krab?" with two pictures), then she finds one by the word alone, then she places a thing herself
("Połóż muszelkę na kamieniu.").

**New, syllables (`syllables`).** Polish reading starts from syllables, and the Name Train already claps her name at the
end ("Zo! Sia! Zosia!"). Here she claps herself. Each boat in the port has a name, and she toots the horn once per
syllable.

**Skills she already has, in a new place.**

- **Counting, in time.** The lighthouse flashes and she counts the flashes. Counting things that do not stay on screen
  is a step up from counting bones.
- **Numerals and counting out.** A boat with a number on its sail, and she makes the lamp flash that many times.
- **Sorting, by a real-world property.** Floats or sinks.

**Left out on purpose.**

- **"Heavy things sink."** It is the most common misconception about floating at this age (section 10). Chase never says
  "bo jest ciężki" or "bo jest lekki". The set includes a big log that floats and a small coin that sinks.
- **Why things float.** Air and density wait until 4 to 5. She sees what happens and says it.
- **Storms, shipwrecks, sharks, deep dark water.** The bay is sunny, shallow and green-blue, and nothing she loves gets
  lost at sea. A boat coming home at dusk is the only tension, and it always arrives.
- **Left and right.** Too early at 3. Position words stop at na, pod, w and obok.
- **One-word voice clips.** As in space, every line is a sentence ("To jest foka.").

## 3. The places

| Place | What she hears | Game (skill) | Built like | Phase |
|---|---|---|---|---|
| Przystań | "To nasza przystań." | none, it is the way home | the rocket's pad | 1 |
| Latarnia | "Latarnia świeci w nocy, żeby statki trafiły do domu." "Każda latarnia mruga po swojemu." | Dusk falls and boats come home. Level 1, the lamp flashes three times and a dot appears with each flash, then "Ile razy mrugnęła?" Level 2, no dots. Level 3, a boat with 4 on its sail, "Mrugnij cztery razy!" and she taps the lamp. Level 4, "Mrugnij o jeden raz więcej!" (counting, numeral, sequence) | Treat House and Moon Jumps | 1 |
| Foka | "Foka odpoczywa na kamieniu." | none. It claps its flippers when she taps it | look-only | 1 |
| Mewy | "Mewy szukają ryb." | none. They lift off and circle | look-only | 1 |
| Boja | "Boja pokazuje statkom drogę." | none. Its bell rings | look-only | 1 |
| Rafa | "Pod wodą mieszkają kraby i rozgwiazdy." "Krab chodzi bokiem." "Ośmiornica ma osiem ramion." | Through the glass floor. Level 1, two pictures, on and under the rock, "Gdzie krab jest pod kamieniem?" Level 2, three places, na, pod, w (a shell). Level 3, by the word alone with obok. Level 4, she places a thing, "Połóż rozgwiazdę obok muszli." (position) | Kitty Park, then Garage drag | 2 |
| Mielizna | "Tu jest płytko." | Floats or sinks. Level 1, she drops a thing in and watches, then puts it on the shelf where its friends are, floaters or sinkers. Level 2, she guesses first, "Pływa czy tonie?", then drops it. Level 3, the surprises, a big log and a little coin. (sorting) | Garage sorting | 2 |
| Port | "W porcie łódki odpoczywają." | Each boat has a name, Mewa, Foka, Kot, Rybka, Kaczka. Level 1, Chase toots with her, "Me-wa!", one toot per syllable. Level 2, she toots alone, one to three syllables. Level 3, "Która łódka ma dwie sylaby?" (syllables) | Name Train's ending | 3 |

The floaters are an apple, a ball, a rubber duck, a leaf, a wooden block and a big log. The sinkers are a stone, a key,
a coin and a metal spoon.

## 4. The bay map is a path of buoys

The bay reuses the space map, with water instead of stars and buoys instead of the road. Stops sit in one loop from the
harbour, so the boat never crosses its own path. The order is Przystań, Boja, Mielizna, Foka, Latarnia, Mewy, Rafa, Port, then back
to Przystań. The lighthouse stands on its rock at the far end of the loop, as it does on the island.

- A tap target of at least 70 px for every stop at all three sizes, as in space.
- Under 100 draw calls. The water is one animated plane, without the island's shadows.
- One boat badge on the island's shelf, as the rocket has one for space.

## 5. How it fits the game

This section is for whoever builds it.

- **One map, two places to use it.** `src/scenes/space.js` holds the trip machinery (the state machine `MOVES` and
  `nextState`, `flightStops`, `mapPoints`, `mapView`, boarding, the way home) next to space's own look. Split the
  machinery out so the bay is a second configuration, not a copy of 971 lines. Space's own trip check must pass
  unchanged before the bay starts.
- **Places.** `src/places.js` gets `harbour` (`area: 'island'`, `leadsTo: 'sea'`) and the sea places
  (`area: 'sea'`). The shelf groups them into one boat badge, the way `shelfItems` groups space into the rocket.
- **New skills.** `position` and `syllables` join `SKILLS` in `src/learning/events.js`, with a section each on the
  parent page (`src/parent/report.js`, `src/parent/view.js`). Floats or sinks reports under the Garage's `sorting`.
- **The director** runs on the bay as on the space map, and flies home first when the finale is due.
- **Saves.** Visited places are already an open list, so no migration is expected. The save test proves it.
- **Voice.** By analogy with space (179 lines for eight games), about 150 to 200 new lines. Hanna records each phase
  before it ships. The syllable lines get three samples listened to first, because "Me-wa" must not run together.
- **Tools.** The walker learns the boat trip and the four games. The trip test gains the bay.

## 6. Order of work

Each unit ends in a check, and the next one starts only after it passes. OpenCode writes every unit in its own
worktree. Claude writes the briefs, reviews each diff and runs the checks in a real browser. The parent runs the deploy.

**Phase 1, the trip and the lighthouse.**

- [ ] **1. One map machine.** Split the trip machinery out of `space.js`. Check. all tests pass, the space trip passes at
  1180 × 820, 1366 × 1024 and 820 × 1180 with 0 page errors, and every space game's first and last level replays to
  the celebration.
- [ ] **2. The harbour on the island.** The pier and the boat on the back shore, trees cleared around it. Check. its
  tap target measures at least 70 px at all three sizes, it does not cover the night sky or the shelf, and the rest
  of the island screenshot matches today's.
- [ ] **3. Boarding, casting off, the bay map with the look-only stops and the way home.** Check. the walker visits
  every stop and lands home with 0 page errors, the smallest stop is at least 70 px at all three sizes, the map draws
  under 100 calls, and a finale or tired session forced from the parent page sails her home.
- [ ] **4. The lighthouse game.** Check. the walker plays every level to the celebration, with screenshots. The parent
  watches a short video of the dusk for anything scary.
- [ ] **5. Voices, an old save and the update path.** Check. `npm run check` reports 0 unrecorded lines, last week's
  save opens with the island and the space trip intact, and the update simulation finishes.
- [ ] **6. Deploy.** The parent runs `vercel deploy --prod`, and Claude checks the live site.

**Phase 2.**

- [ ] **7. The reef and position words.** The new `position` skill and its parent page section. Check. each sea animal
  fact has a source in section 10, unit tests cover the skill, and every level reaches the celebration.
- [ ] **8. Floats or sinks.** Check. a test that every thing is on its true side, and every level to the celebration.

**Phase 3.**

- [ ] **9. The port and syllables.** First, three syllable samples for the parent to listen to. Check. the new
  `syllables` skill is tested, and every level reaches the celebration.
- [ ] **10. Shells at the harbour.** Each sea place she visits leaves a shell on the pier, like the keepsakes at the
  launch pad. At the goodnight, the island's lighthouse sweeps its beam once if she has sailed to it. Check. the
  shells measure at least 28 px, the beam shows in the goodnight screenshot, and the final replay of every level
  passes.

## 7. Decisions for the parent

Each has a default, which I will use unless you say otherwise.

1. **A bay map, or games straight from the island.** Default, the bay map. It keeps the island uncluttered and gives the
   same "a boat takes you somewhere" story as the rocket. The other option is the lighthouse and one water game as
   ordinary island places, which is quicker but leaves the lighthouse unreachable in portrait.
2. **Which water game comes second.** Default, the reef (position words), because it is the newest skill. Floats or
   sinks can go first if she loves splashing.
3. **The port game.** Default, syllables. The other option is parking boats by size, which repeats the Garage.
4. **Boat names in the port.** Default, Mewa, Foka, Kot, Rybka, Kaczka. Family names could join them, as on the Name Train.

## 8. What I would not do

- **Steering the boat.** As with the rocket, a tap chooses where to go.
- **A diving pup.** The glass floor shows the reef without anyone going under water.
- **Real tides or weather.** Pretty, but they teach nothing at 3 and cost frames.
- **One island badge per sea place.** One boat badge, as with space.
- **A song.** Polish preschool sea songs are under copyright. Chase's own short chant on the way out is enough.

## 9. Risks

- **Water that feels deep or dark.** The reef stays shallow and bright, and the parent reviews the dusk video (unit 4).
- **Splitting the space map breaks space.** Unit 1 changes no behaviour, and its check is the full space trip and
  replay before anything new is added.
- **The harbour hidden by trees or the Lookout.** The projection says it is on screen, but it did not account for trees.
  Unit 2 measures the real tap target in a browser.
- **Syllables run together in the voice.** Unit 9 starts with three samples, and Name Train's clips show it can work.
- **A bigger update.** About 3 to 4 MB more voice (a guess, by analogy with space). The start paw already falls back to
  the version on the iPad after 20 s.

## 10. Sources

Found by web search on 2026-11-08, read as search summaries. Quality varies, and the weak ones are marked.

- What a three-year-old understands, including na, pod, w, przed, za and obok, a psychological and educational
  counselling centre's guide, https://samorzad.gov.pl/web/poradnia-pp-hajnowka/prawidlowosci-rozwoju-mowy-dziecka
- Location words from 3 to 7, https://sp3nidzica.edupage.org/files/Rozwoj_mowy_dziecka_od_narodzin_do_7_roku_zycia.pdf
- Preschoolers explain floating by weight alone, Varela, Mota and Wendling 2020,
  https://e-revista.unioeste.br/index.php/rebecem/en/article/view/24906
- "Objects sink because they are heavy" as a common preschool misconception,
  https://sajce.co.za/index.php/sajce/article/view/1407/2655
- Preschoolers exploring sinking, Baker et al. 2011,
  https://www.artsci.uc.edu/content/dam/refresh/artsandsciences-62/labs/ccrl/docs/publications/Baker_et_al._2011.pdf
- A teacher challenging "heavy sinks" with an orange, https://taps.pstt.org.uk/?p=2129
- Apples float because about a quarter of an apple is air, a USDA children's sheet (weak, an archived colouring page),
  https://webarchive.library.unt.edu/eot2008/20090109075824/http://content.fsa.usda.gov/fsakids/Zip_Color_Sheets/2apples.pdf
- Each lighthouse has its own flash pattern, its "characteristic", California State Parks,
  https://parks.ca.gov/?page_id=22010
- Syllables first in Polish reading, docs/POLISH-PLAN.md (section 3, Name Train)
