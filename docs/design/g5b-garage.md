# The Garage (`garage`), unit G5b

**Fixes:** a shape counts where she drops it. The flag clue no longer talks over her answer.

## What she sees and does
```
   door board:   ( koło )   ( kwadrat )   ( trójkąt )      <- holes (L1: only one hole, the shape in the bubble)
   flag line:    R B R B ?
   baskets:      [ red ]   [ blue ]                         <- blocks come one at a time
   pieces:       (o)   [ ]   /\                             <- she drags a piece to a hole, or taps it
```
Three jobs a visit, one per round: the cruiser's door (shapes), the flags (pattern), the blocks (sorting). L1 and L2 name one shape; L3 on turn and resize the pieces; L5 on use odd triangles; L6 and L7 add ABB and the colour-to-size switch.

## What changes from today
- Dropping a piece used to be judged only by "is it the asked shape": the circle let go over the circle hole when "kwadrat" was asked said "Nie, to koło."; the square let go over the triangle hole flew to its own hole. `levels/garage.js` now decides from the hole under the piece (`holeUnder`) and the question (`dropVerdict`): asked piece over its own hole fits; asked piece over another hole does not ("Nie, to nie ten."); another shape is named wherever it goes; let go away from the door it floats back, nothing counted. One hole (level 1) catches a wide drop so a piece from the side still reaches it. Taps behave as before.
- The flag clue ("Czerwona! Niebieska! …") went on after her answer and cut the praise. The chant now stops when anything newer is said.
- Gentler run: level 1 has no easier rung, so it is one job shorter.
