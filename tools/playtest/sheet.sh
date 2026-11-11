#!/bin/bash
# sheet.sh <run-dir>... : one contact sheet per run (asked / answered frames), for reviewing many levels at a glance (verification tooling)
for d in "$@"; do
  ls "$d"/*.png >/dev/null 2>&1 || continue
  montage -label '%t' -pointsize 13 $(ls "$d"/*.png | grep -v -e start-screen | head -12) -tile 3x -geometry 500x347+3+3 -quality 78 "$d/sheet.jpg" 2>/dev/null
done
