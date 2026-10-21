#!/bin/bash
# Plays every mission like a parent would and writes timelines to tools/playtest/$OUTDIR (default out/).
# BASE=http://localhost:4173 plays a local build instead of production.
cd "$(dirname "$0")"
for run in "letters 1" "letters 5" "balloons 1" "name 1" "name 3" "cones 1" "cones 3" "stones 1" "stones 4" "counting 1" "counting 2" "lookout 1" "delivery 1" "delivery 3" "picnic 1" "picnic 3"; do
  timeout 420 node walk.mjs $run 2>&1 | grep -v "^\s*at " | tail -1
done
