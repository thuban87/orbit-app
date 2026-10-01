#!/usr/bin/env bash
# ORRERY LAB B — R3 legibility re-measure (R1 method, R2/R3 stage on).
# Same as r1-legibility.sh, plus: a Recentre tap after each remount so the
# Home tilt (R2 `homeTilt`) and the stage plane apply, an overview scene with
# the focus on a body next to the sun, and extra flags via env FLAGS.
# Usage: r3-legibility.sh <out-dir> <palette.json> [focus-name]
# Env: PY (python with numpy+PIL), FLAGS (extra flag pairs), THEMES.
set -u
OUT=$1; PAL=$2; FOCUS=${3:-Cleo%20Okafor}
PY=${PY:-python3}
ADB=${ADB:-"$HOME/Android/Sdk/platform-tools/adb -P 5039 -s emulator-5554"}
PKG=${PKG:-com.bwales.orbit.labb}
FLAGS=${FLAGS:-}
THEMES=${THEMES:-galaxy:dark galaxy:light standard:dark standard:light}
T=$(dirname "$0")
mkdir -p "$OUT"
link() { $ADB shell "am start -a android.intent.action.VIEW -d '$1' $PKG" >/dev/null 2>&1; }
shot() { $ADB exec-out screencap -p > "$1"; }
for theme in $THEMES; do
  tag="focus-${theme/:/-}"
  link "orbit://labb?reset=1&rm=on&theme=$theme&flags=fpsHud:0,labels:1${FLAGS:+,$FLAGS}&system=Lab%20B%20Dense&panel=0"; sleep 12
  $ADB shell input touchscreen tap 1150 2140; sleep 4
  link "orbit://labb?focus=$FOCUS&delay=3000"; sleep 12
  shot "$OUT/$tag-labels.png"
  $ADB shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && $ADB pull /sdcard/ui.xml "$OUT/$tag-ui.xml" >/dev/null 2>&1
  link "orbit://labb?flags=labels:0&panel=0"; sleep 10
  shot "$OUT/$tag-raw.png"
  link "orbit://labb?flags=labels:1&panel=0"; sleep 6
  echo "## $tag"
  $PY "$T/r1-contrast.py" labels "$OUT/$tag-labels.png" "$OUT/$tag-raw.png" "$PAL" "$theme" | tail -1
  [ -f "$OUT/$tag-ui.xml" ] && $PY "$T/r1-contrast.py" overlay "$OUT/$tag-labels.png" "$OUT/$tag-ui.xml" "$OUT/$tag-raw.png" "$PAL" "$theme" | tail -1
done
