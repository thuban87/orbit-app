#!/usr/bin/env bash
# r2-link.sh '<orbit://labb?...>' [sleep-seconds] — fire a lab deep link (remounts the Orrery).
ADB=${ADB:-"$HOME/Android/Sdk/platform-tools/adb -P 5039 -s emulator-5554"}
$ADB shell "am start -a android.intent.action.VIEW -d '$1' com.bwales.orbit.labb" >/dev/null 2>&1
sleep "${2:-0}"
