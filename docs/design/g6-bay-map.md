# G6. The bay map as clear as the space map (plan unit F2)

**Goal.** Zosia, 3.5, picks where to sail from a map of eight stops. Today the stops are 76 to 118 px wide on a wide empty sea, the seal's rock reads as a dark blob, and a place with a game looks the same as a place to look at. The island, which means "go home", looks like any other stop.

**What she sees.** A ring of eight stops, drawn larger, each on a round white-rimmed pad, as the planets are on the space map.

```
         reef 🦀          gulls          lighthouse 💡

   port 📯                                       seal

       island + house      buoy        shallows 🦆
```

- The loop keeps its order: island, buoy, shallows, seal, lighthouse, gulls, reef, port. It is a ring now, not a wide C, so the stops can be large on an iPad held either way.
- Every stop is at least 110 px wide at 1180x820, 820x1180, 1366x1024 and 1024x1366, wherever the boat is and whichever stop is suggested (a test).
- A stop with a game (shallows, lighthouse, reef, port) carries its badge, the one she earns, on the front left of its pad. A stop to look at (buoy, seal, gulls) carries none. The space map gets the same badges on its ten game stops.
- The island shows a small house beside the palm. Earth on the space map shows the same house. "Home" is a house, not a place to play.
- The seal is bigger on a paler rock, the gulls sit on a darker one, the buoy shows its white band. The boat parks on the inner side of the ring, so parking never widens the map.

**What stays.** The quick later trips, the course change, the hold on the house button, every stop's visit and facts. A tap on a badge is a tap on its stop.

**What it costs.** Nothing in draw calls: the bay map stays at 79 draws (a test). The pad is one mesh with its rim painted in, the palm sways as one, and the lighthouse roof joins its red bands.

**Checks.** `tests/bay-flow.test.js` (widths, badges, house, boat parking), `tour.mjs sea` and `tour.mjs space` at both orientations, `probes.mjs maphome`.
