#!/usr/bin/env bash
# R1 idle-clock / reduced-motion / opaque-canvas A/B: 10 s idle gfx windows.
# Usage: r1-idle.sh <out-dir>
set -u
OUT=$1; mkdir -p "$OUT"
ADB=${ADB:-"$HOME/Android/Sdk/platform-tools/adb -P 5039 -s emulator-5554"}
PKG=${PKG:-com.bwales.orbit.labb}
OFF="nebulaDrift:0,twinkle:0,ringFlow:0,sunCorona:0,sunPlasma:0,sunPulse:0"
run() { # label system flags rm
  $ADB shell "am start -a android.intent.action.VIEW -d 'orbit://labb?reset=1&rm=$4&flags=fpsHud:0,opaqueCanvas:0,$3&system=$2&panel=0' $PKG" >/dev/null 2>&1
  sleep 14; $ADB shell input touchscreen tap ${RECENTRE:-1150 2140}; sleep 5
  $ADB shell dumpsys gfxinfo $PKG reset >/dev/null; sleep 10
  $ADB shell dumpsys gfxinfo $PKG > "$OUT/$1.gfx"
  printf "%s\t%s\t%s\n" "$1" "$(grep -m1 'Total frames' "$OUT/$1.gfx" | awk '{print $4}')" "$(grep -m1 '50th percentile' "$OUT/$1.gfx" | awk '{print $3}')" | tee -a "$OUT/idle.tsv"
}
D="Lab%20B%20Dense"; S8="Lab%20B%20Stress%20800"
run dense-defaults-idleclock $D "idleClock:1" os
run dense-defaults-clockalways $D "idleClock:0" os
run dense-rm-idleclock $D "idleClock:1" on
run dense-rm-clockalways $D "idleClock:0" on
run dense-ambientoff-idleclock $D "idleClock:1,$OFF" os
run dense-ambientoff-clockalways $D "idleClock:0,$OFF" os
run s800-rm-idleclock $S8 "idleClock:1" on
run dense-opaque $D "idleClock:1,opaqueCanvas:1" os
