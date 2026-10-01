#!/bin/bash
SP=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad; export ANDROID_SERIAL=$(~/.local/bin/adb devices | awk '$2=="device"{print $1}'); export OUT=$SP/cam/m
source /home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/evidence/final/perf/tools/lib.sh 2>/dev/null
[ "$1" = cold ] && { cold; sleep 30; ui list | grep -q "Recenter Orrery" || { ui tap "Orrery" >/dev/null; sleep 5; }; }
recenter; sleep 3
bash $SP/cam/sfpan.sh | tail -2
$ADB logcat -c
( sleep 0.3; for k in 1 2 3; do $ADB shell input touchscreen swipe 300 1800 1100 1500 3000; $ADB shell input touchscreen swipe 1100 1500 300 1800 3000; done ) & echo "pan cpu $(thrcpu 9)"; wait
$ADB logcat -d -s ReactNativeJS:V | grep LABPROF | sed 's/.*LABPROF//' | tail -2
