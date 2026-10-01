#!/bin/bash
# relsf.sh TAG -- SurfaceFlinger-presents protocol (works for TextureView and SurfaceView canvases)
TAG=$1
SP=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad; export ANDROID_SERIAL=$(~/.local/bin/adb devices | awk '$2=="device"{print $1}'); export OUT=$SP/cam/rel
source /home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/evidence/final/perf/tools/lib.sh 2>/dev/null
LOG=$SP/cam/relsf-$TAG.txt; : > $LOG
say(){ echo "$*" | tee -a $LOG; }
contpan(){ # continuous swipes for N seconds (back-to-back 3 s swipes)
  local end=$(( $(date +%s) + $1 )); local k=0; while [ $(date +%s) -lt $end ]; do if [ $((k%2)) -eq 0 ]; then $ADB shell input touchscreen swipe 300 1800 1100 1500 3000; else $ADB shell input touchscreen swipe 1100 1500 300 1800 3000; fi; k=$((k+1)); done; }
say "thermal $($ADB shell dumpsys thermalservice | grep -m1 'Thermal Status') $($ADB shell dumpsys battery | grep -E 'level|temperature' | tr -s ' ' | tr '\n' ' ')"
cold 2>/dev/null; sleep 4; recenter; sleep 4
for i in 1 2 3; do say "idle $(bash $SP/cam/sfidle.sh 3)"; done
say "idle refresh $($ADB shell dumpsys SurfaceFlinger | grep -m1 -o 'vsyncRate=[0-9.]* Hz')"
say "idle cpu $(thrcpu 8 2>/dev/null)"
for i in 1 2; do bash $SP/cam/sfpan.sh | sed 1d | while read l; do say "pan $l"; done; recenter; sleep 2; done
( sleep 0.5; contpan 9 ) & say "pan cpu $(thrcpu 8 2>/dev/null)"; wait
recenter; sleep 2
$ADB shell settings put global transition_animation_scale 0; sleep 5
say "rm $(bash $SP/cam/sfidle.sh 3)"; say "rm cpu $(thrcpu 8 2>/dev/null)"
$ADB shell settings put global transition_animation_scale 1; sleep 2
