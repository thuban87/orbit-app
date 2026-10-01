#!/usr/bin/env bash
# ORRERY LAB B — R2 art-review capture set (emulator, lab build).
# Usage: r2-shots.sh <out-dir> [scene ...]
# Scenes: inner dense identity detail focus switch themes  (default: all)
# Env: FLAGS="homeTilt:1,bloom:0"  extra flag pairs applied after reset.
#      PRESET=best|shipSafe|everything|legacy  (R3) one-tap preset applied before FLAGS.
#      THEME=galaxy:dark  (themes scene loops all four regardless)
#      WAIT=12  seconds after a remounting deep link.
# Shots are saved as JPEG (q85) via r2-snap.sh.
set -u
OUT=$1; shift
SCENES=${*:-inner dense identity detail focus switch themes}
ADB=${ADB:-"$HOME/Android/Sdk/platform-tools/adb -P 5039 -s emulator-5554"}
PKG=${PKG:-com.bwales.orbit.labb}
FLAGS=${FLAGS:-}
THEME=${THEME:-galaxy:dark}
WAIT=${WAIT:-12}
BASEF="fpsHud:0${FLAGS:+,$FLAGS}"
mkdir -p "$OUT"
link() { $ADB shell "am start -a android.intent.action.VIEW -d '$1' $PKG" >/dev/null 2>&1; }
shot() { "$(dirname "$0")/r2-snap.sh" "$OUT/$1.jpg"; }
base() { # $1 theme  $2 system (url-encoded)
  link "orbit://labb?reset=1${PRESET:+&preset=$PRESET}&clear=1&theme=$1&flags=$BASEF&system=$2&panel=0"; sleep "$WAIT"
  # Recentre = Home on every axis (a remount restores the previous pose instead).
  $ADB shell input touchscreen tap 1150 2140; sleep 5
}
for s in $SCENES; do
  case $s in
    inner) base "$THEME" "Lab%20B%20Inner%20Circle"; shot 01-overview-inner ;;
    dense) base "$THEME" "Lab%20B%20Dense"; shot 02-overview-dense ;;
    identity) base "$THEME" "Lab%20B%20Dense"; link "orbit://labb?zoom=2&panel=0"; sleep 8; shot 03-identity-dense ;;
    detail) base "$THEME" "Lab%20B%20Dense"; link "orbit://labb?zoom=3.2&panel=0"; sleep 8; shot 04-detail-dense ;;
    focus) base "$THEME" "Lab%20B%20Dense"; link "orbit://labb?focus=Cleo%20Okafor&delay=2500"; sleep 10; shot 05-focus-cleo ;;
    switch)
      base "$THEME" "Lab%20B%20Inner%20Circle"
      link "orbit://labb?system=Lab%20B%20Dense&delay=3000&panel=0"; sleep 3.9; shot 06a-switch-early
      sleep 0.6; shot 06b-switch-mid; sleep 3; shot 06c-switch-settled ;;
    themes)
      for t in galaxy:light standard:dark standard:light; do
        base "$t" "Lab%20B%20Dense"; shot "07-overview-dense-${t/:/-}"
        link "orbit://labb?focus=Cleo%20Okafor&delay=2500"; sleep 10; shot "08-focus-${t/:/-}"
      done ;;
  esac
done
