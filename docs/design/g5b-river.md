# The River (`stones`), unit G5b

**Fix:** the next stone never sits behind Zosia. Level 7 had a stone straight behind her on stone 2; her body took every tap and the run stalled.

## What she sees and does
The stones come up a row at a time, one hop nearer Chase. She taps the right number, hops to it, the others sink. L1 to L3 show the next number; L4 has a gap ("1 2 ? 4"); L5 to L7 ask "what comes next?".

```
   far bank:  [ Chase ]
   row 3:     (4)             (1)        <- the next row, in plain sight
   row 2:        ####                    <- ground her body hides from the camera: no number here
   row 1:      [ Zosia on stone 2 ]
```
The camera looks down from the south bank. Zosia, 2 tall on a stone, hides a strip of ground behind her, longer the lower the camera looks, and shifted outwards when she stands off the middle. The old rule kept stones 0.8 away sideways, which holds only on the middle line.

## What changes
- `levels/river.js` knows the camera (`VIEW`) and her body (a box 0.86 wide, 1 deep and 2 tall, standing on a stone) and projects it onto the stones' plane for a 4:3 iPad lying down and an iPad Air standing up. A row is laid only where each stone's numeral (45% of its radius) is clear of both outlines. `tests/levels/river.test.js` projects her body with a real camera at five screen shapes and checks no stone centre lies behind her (it fails on the old layout in 6 of 8 level shapes).
- `scenes/stones.js` flags Zosia a tap zone: where a ray crosses her and a stone, the stone takes the tap (the engine already prefers a real thing to a zone). That is the belt for the braces.
- The right stone is slightly more often on the outer side of the row at level 3 (3 stones a row), 47% against 33%: she may only stand on a stone and see all three. The test keeps every slot above 23%.
- A new river shows its own first number in the bubble at once; it kept the last river's number for 0.9 s until the question came.
- The next number is asked while "Tak! Dwa!" is still being said (the question is open at once and spoken when the praise ends), the crossing hops are 190 ms and the leap back 560 ms. The play check had the missing-stone level and level 7 at 4.1 to 4.2 s from a right answer to the next question (the plan allows 4 s); now every level is under 3.5 s.
