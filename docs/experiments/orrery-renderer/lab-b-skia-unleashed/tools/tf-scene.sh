#!/usr/bin/env bash
# Tilt fix (phone): set up a scene like r1-perf.sh's setup step, no measuring.
# Usage: tf-scene.sh <preset> <flags> <system> [pose-query e.g. "tilt=1.0472"]
set -u
PRESET=$1; FLAGS=$2; SYSTEM=$3; POSE=${4:-}
PKG=${PKG:-com.bwales.orbit.labb}
S=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$SYSTEM")
link() { $ADB shell "am start -a android.intent.action.VIEW -d '$1' $PKG" >/dev/null 2>&1; }
$ADB shell input tap ${ORRERY_TAB:-1008 2930}; sleep 2
link "orbit://labb?reset=1&preset=$PRESET&renderer=lab&flags=$FLAGS,fpsHud:0,perfProbe:1,opaqueCanvas:1&panel=0&system=$S&delay=0"
sleep ${SETTLE:-14}
$ADB shell input tap ${ORRERY_TAB:-1008 2930}; sleep 2
$ADB shell input touchscreen tap ${RECENTRE:-1290 2290}; sleep 4
if [ -n "$POSE" ]; then link "orbit://labb?$POSE&delay=2500"; sleep 6; fi
