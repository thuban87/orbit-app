#!/usr/bin/env bash
# ORRERY LAB B — R1 legibility captures + contrast numbers (emulator).
# For each theme: a static (reduced-motion) scene, captured twice — labels ON
# and labels OFF (the raw backdrop under every label plate) — plus a UI tree
# dump (RN overlay text boxes; works because the idle clock leaves the canvas
# static), then `r1-contrast.py` for labels and overlays.
# Usage: r1-legibility.sh <out-dir> <palette.json> [scene-name] [extra link params]
set -u
OUT=$1; PAL=$2; SCENE=${3:-overview}; EXTRA=${4:-}
ADB=${ADB:-"$HOME/Android/Sdk/platform-tools/adb -P 5039 -s emulator-5554"}
PKG=${PKG:-com.bwales.orbit.labb}
T=$(dirname "$0")
mkdir -p "$OUT"
link() { $ADB shell "am start -a android.intent.action.VIEW -d '$1' $PKG" >/dev/null 2>&1; }
shot() { $ADB exec-out screencap -p > "$1"; }
for theme in galaxy:dark galaxy:light standard:dark standard:light; do
  tag="${SCENE}-${theme/:/-}"
  link "orbit://labb?reset=1&rm=on&theme=$theme&flags=fpsHud:0,labels:1&panel=0$EXTRA"; sleep 12
  shot "$OUT/$tag-labels.png"
  $ADB shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && $ADB pull /sdcard/ui.xml "$OUT/$tag-ui.xml" >/dev/null 2>&1
  link "orbit://labb?flags=labels:0&panel=0"; sleep 10
  shot "$OUT/$tag-raw.png"
  link "orbit://labb?flags=labels:1&panel=0"; sleep 6
  echo "## $tag"
  python3 "$T/r1-contrast.py" labels "$OUT/$tag-labels.png" "$OUT/$tag-raw.png" "$PAL" "$theme" | tail -1
  [ -f "$OUT/$tag-ui.xml" ] && python3 "$T/r1-contrast.py" overlay "$OUT/$tag-labels.png" "$OUT/$tag-ui.xml" "$OUT/$tag-raw.png" "$PAL" "$theme" | tail -1
done
