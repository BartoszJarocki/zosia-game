# D6 Pluto: find the shape

Today every round asks for the heart, the bubble draws the heart, and Pluto wears a big heart. She learns nothing new.

After D6 the asked shape changes each round and comes from a longer list: serduszko, gwiazda, owal, prostokąt, romb.
The pieces around it come from every shape, the Garage's koło, kwadrat and trójkąt too.

## What she sees and does

```
   bubble [ ? 🔍 ]                       (Chase)
                  ( Pluto with its heart )

      [ owal ]   [ koło ]   [ gwiazda ]   <- pieces on the ice, all one colour
```

- Chase asks by name: "Gdzie jest owal?". She taps a piece. Right: it floats up into Pluto's heart, which shines a
  little brighter, and Chase names it: "Super! To jest owal!". Wrong: "Nie, to nie ten." and the question again.
- At level 1 the bubble draws the shape (match). From level 2 the bubble shows a question mark: the question is the
  word. The clue (a long wait) draws the shape in the bubble. The second miss takes a wrong piece away. The third
  pulses the right piece.
- Lookalike levels put the asked shape next to its twin: owal with koło, prostokąt with kwadrat, romb with kwadrat.
  The turned level turns and resizes every piece a little; the square never turns a full 45°, so it never becomes a
  romb.

## Levels

| Level | shapes asked | ask | choices | similar | turned | rounds |
|---|---|---|---|---|---|---|
| 1 | heart, star, oval | match | 2 | no | no | 3 |
| 2 | heart, star, oval, rectangle | name | 3 | no | no | 3 |
| 3 | heart, star, oval, rectangle, diamond | name | 3 | yes | no | 4 |
| 4 | heart, star, oval, rectangle, diamond | name | 4 | yes | yes | 4 |

Starts: 3 at level 1, 3.5 at level 2 (new names, no twins), 4 and 5 at level 3.

## What changes from today
- Four new outlines next to the Garage's (star, oval, rectangle, diamond), so a piece and its bubble picture match.
- `shapes`, `ask` and `similar` columns; `choices`, `turned` and `rounds` stay.
- When the winding down cuts the run short, the heart shines fully before "Serduszko Plutona świeci!".
- Pluto's own big heart stays (it is the place). When the heart is asked by name, it is a hint she can see.
- New lines: "Gdzie jest gwiazda?", "Gdzie jest owal?", "Gdzie jest prostokąt?", "Gdzie jest romb?", "To jest
  gwiazda!", "To jest owal!", "To jest prostokąt!", "To jest romb!". "Gdzie jest serduszko?" and "To jest
  serduszko!" are recorded.
