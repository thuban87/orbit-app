#!/bin/bash
# probe.sh TAG [cold] -- LABPROF logcat during pan and idle
TAG=$1
SP=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad; export ANDROID_SERIAL=$(~/.local/bin/adb devices | awk '$2=="device"{print $1}')
OUT=$SP/cam/m
source /home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/evidence/final/perf/tools/lib.sh
if [ "$2" = cold ]; then cold; sleep 30; ui list | grep -q "Recenter Orrery" || { ui tap "Orrery" >/dev/null; sleep 5; }; fi
recenter; sleep 3
$ADB logcat -c; panloop 10 >/dev/null; sleep 0.5
$ADB logcat -d -s ReactNativeJS:V | grep LABPROF > $SP/cam/probe-$TAG-pan.txt
recenter; sleep 3; $ADB logcat -c; sleep 10
$ADB logcat -d -s ReactNativeJS:V | grep LABPROF > $SP/cam/probe-$TAG-idle.txt
echo PAN; cut -c1-600 $SP/cam/probe-$TAG-pan.txt | sed 's/.*LABPROF//'; echo IDLE; cut -c1-600 $SP/cam/probe-$TAG-idle.txt | sed 's/.*LABPROF//'
