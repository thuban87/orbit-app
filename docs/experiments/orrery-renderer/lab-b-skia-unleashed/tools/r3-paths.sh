#!/usr/bin/env bash
# ORRERY LAB B — R3 less-tested paths (emulator, lab build, 1280x2856).
# Usage: r3-paths.sh <out-dir> [path ...]
# Paths: north cluster farfocus reorder bgswitch rmstatic
# Env: PRESET (default best), THEME (default galaxy:dark), WAIT (remount settle s).
# Shots are JPEG (r2-snap.sh) except the reduced-motion pair (PNG, pixel diff).
set -u
OUT=$1; shift
PATHS=${*:-north cluster farfocus reorder bgswitch rmstatic}
ADB=${ADB:-"$HOME/Android/Sdk/platform-tools/adb -P 5039 -s emulator-5554"}
PKG=${PKG:-com.bwales.orbit.labb}
PRESET=${PRESET:-best}
THEME=${THEME:-galaxy:dark}
WAIT=${WAIT:-12}
T=$(dirname "$0")
mkdir -p "$OUT"
link() { $ADB shell "am start -a android.intent.action.VIEW -d '$1' $PKG" >/dev/null 2>&1; }
shot() { "$T/r2-snap.sh" "$OUT/$1.jpg" >/dev/null; echo "shot $1"; }
RECENTRE="1150 2140"; NORTH="1150 2310"
base() { # $1 system  [$2 extra query]
  link "orbit://labb?reset=1&preset=$PRESET&theme=$THEME&flags=fpsHud:0&system=$1&panel=0${2:-}"; sleep "$WAIT"
  $ADB shell input touchscreen tap $RECENTRE; sleep 5
}
for p in $PATHS; do
  case $p in
    north)
      # Yaw the camera, then reset north: Polaris flare (620 ms) + recovery.
      base "Lab%20B%20Dense"
      link "orbit://labb?yaw=1.4&delay=2000&panel=0"; sleep 9
      shot north-0-yawed
      $ADB shell "input touchscreen tap $NORTH; screenrecord --time-limit 4 --bit-rate 4000000 --size 720x1606 /sdcard/r3n.mp4"
      $ADB pull /sdcard/r3n.mp4 "$OUT/north-flare.mp4" >/dev/null 2>&1; $ADB shell rm /sdcard/r3n.mp4
      sleep 2; shot north-1-settled ;;
    cluster)
      # Overlapping JD/EN at Dense overview (R3 Home tilt) -> group intent.
      base "Lab%20B%20Dense"
      shot cluster-0-before
      $ADB shell input tap ${CLUSTER_TAP:-955 650}; sleep 4
      shot cluster-1-panel ;;
    farfocus)
      base "Lab%20B%20Dense"
      link "orbit://labb?zoom=0.4&delay=2000&panel=0"; sleep 9
      shot farfocus-0-far
      link "orbit://labb?focus=Cleo%20Okafor&delay=2500"; sleep 10
      shot farfocus-1-focused ;;
    reorder)
      # Long-press a ring body (hold charge), drag outward one slot, release.
      base "Lab%20B%20Inner%20Circle"
      shot reorder-0-before
      read -r x y <<<"${REORDER_BODY:-640 1000}"
      $ADB shell "input motionevent DOWN $x $y; sleep 1.2; input motionevent MOVE $x $((y+60)); sleep 0.3; input motionevent MOVE $x $((y+140)); sleep 0.3"
      shot reorder-1-held
      $ADB shell "input motionevent MOVE $x $((y+200)); sleep 0.4; input motionevent UP $x $((y+200))"
      sleep 4; shot reorder-2-after ;;
    bgswitch)
      # Background the app 1 s into a big switch, foreground 3 s later.
      base "Lab%20B%20Inner%20Circle"
      link "orbit://labb?system=Lab%20B%20Dense&delay=4000&panel=0"; sleep 5.0
      $ADB shell input keyevent KEYCODE_HOME; sleep 3
      $ADB shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 1.5
      shot bgswitch-0-resumed; sleep 5; shot bgswitch-1-settled ;;
    rmstatic)
      # Reduced motion with EVERY effect on (preset everything): must be static.
      link "orbit://labb?reset=1&preset=everything&rm=on&theme=$THEME&flags=fpsHud:0&system=Lab%20B%20Dense&panel=0"; sleep "$WAIT"
      $ADB shell input touchscreen tap $RECENTRE; sleep 6
      $ADB exec-out screencap -p > "$OUT/rmstatic-a.png"; sleep 3
      $ADB exec-out screencap -p > "$OUT/rmstatic-b.png"
      # Diff below the status bar (its clock may tick): needs numpy + PIL.
      ${PY:-python3} -c "
import sys,numpy as np; from PIL import Image
a,b=[np.asarray(Image.open(p).convert('RGB'),dtype=int)[160:] for p in sys.argv[1:3]]
d=(np.abs(a-b).max(axis=-1)>0); print('rmstatic changed pixels below status bar:',int(d.sum()))
" "$OUT/rmstatic-a.png" "$OUT/rmstatic-b.png"
      ;;
  esac
done
