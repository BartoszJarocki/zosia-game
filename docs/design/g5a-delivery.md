# G5a. Pup Delivery: a small lift posts nothing

Goal: a parcel is posted when Zosia drops it on a mailbox, not when her finger nudges it. A small lift floats the parcel back.

## What she sees and does

Levels 1 to 2 (`pictureSound`): parcels with pictures, "Co zaczyna się na Ka?", tap the right one. Levels 3 to 5 (`soundLetter`): mailboxes with letters, one parcel with a picture, "Do której skrzynki pójdzie kot?". She drags the parcel to a mailbox, or taps the mailbox.

```
 landscape 1180 x 820                       portrait 820 x 1180
   ( 🦋 🔊 )                                   ( 🦋 🔊 )
   [M]      [A]      [I]   y ~ 365              [M] [A] [I]   y ~ 556
    |        |        |                          |   |   |

                                                  (a gap of 221 px)

          +----+                                       
          | 🦋 |   y ~ 669  <- home                    +----+
          +----+   (a gap of 305 px)                   | 🦋 |   y ~ 777  <- home
                                                       +----+
```

## What goes wrong today

Measured with `tools/playtest/delivery-lift.mjs` on the base build: the drop looked at the **top edge** of the parcel and a small box in front of each mailbox. A drag of 90 px straight up in landscape posted into the mailbox above it (70 px and under floated back); in portrait the review measured 43 px. A drag that took the parcel right onto the mailbox (the natural drag) floated back, because by then the top edge had passed above that small box.

## What changes

- The drop looks at the **middle** of the parcel and at the mailbox's letter box plus a margin, with air above it, so overshooting upwards still posts. Dragging the parcel onto a mailbox posts.
- The parcel waits nearer to her, well in front of the mailboxes: z 4.5 in landscape (was 3) and z 6 on a tall screen (was 3). The gap from the parcel to the mailboxes grows from 226 px to 305 px in landscape and from 148 px to 221 px in portrait.
- Together: in landscape a lift of up to 160 px floats back and posts nothing, and a drag from 200 px posts (before, from 90 px). In portrait a lift of up to 110 px floats back and a drag from 130 px posts (before, from 43 px, the review's number).
- A gentler run of level 1 has no fewer choices to give (it has 2), so every gentler delivery run is 3 questions, not 4. Level 1's gentler run was the normal run.
- Tapping a mailbox still posts (the way in for anyone who cannot drag yet).

The drag that barely moves (12 px or less) is still a tap: the parcel hops, nothing is posted. A drag that moves more than 12 px plays the pick-up pop, so every touch answers.

Voice lines: none new.
