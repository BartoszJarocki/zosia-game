# Pup Picnic (`picnic`), unit G5b

**Fixes:** tapping the kitten (or Zosia, or Chase) is not an answer; the treats never overlap.

## What she sees and does
```
      [ Zosia ]    [ Chase ]  <- plate with his treats ("same")        [ kitten ]
      +-------------------+                   +-------------------+
      |  red blanket      |                   |  blue blanket     |
      |  ( 3 ) or 3 treats|                   |  ( 5 ) or 5 treats|
      +-------------------+                   +-------------------+
```
L1: which blanket has more (far apart). L2: more or less (a kitten with a small tummy). L3: more, less, same as Chase's plate. L4 to L6: the blankets show numerals, later a difference of one, up to 10. She taps a blanket; the eater trots over and eats.

## What changes from today
- The blanket tap boxes were 1.2 tall and stood in front of the kitten and Zosia, so a tap on the kitten's lower body or Zosia's feet chose a blanket. The boxes are now 0.6 tall and flagged as tap zones: whatever else is under her finger wins.
- Treats are laid by `levels/picnic.js`: neat rows of up to five, 1.05 apart, 1.25 times the model, crooked by at most 0.25 rad. Before they were 1.5 times the model 0.95 apart and turned up to 0.4 rad, which made two bones touch in 97% of layouts (measured over 1800). The clue lines them up on the same spacing; the blanket holds the longest row.
- Five questions a visit, not three. Two blankets mean a blind tap is right half the time, and at three questions a blind tapper (at least 65% clean) moved up in one run in two (G6's guessing check: 49 to 53%). At five it is 18 to 20%, and moving up two levels at once from 12 to 14% down to 3 to 4%.
- Gentler run: one treat off the top (not below four) so levels 1 to 3 have a gentler run too.
