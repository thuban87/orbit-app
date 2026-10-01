#!/bin/bash
# relsf.sh TAG -- SurfaceFlinger-presents protocol (works for TextureView and SurfaceView canvases)
TAG=$1
SP=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad; export ANDROID_SERIAL=$(~/.local/bin/adb devices | awk '$2=="device"{print $1}'); export OUT=$SP/cam/rel
source /home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/evidence/final/perf/tools/lib.sh 2>/dev/null
LOG=$SP/cam/relfinal-$TAG.txt; : > $LOG
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

recenter; sleep 2
bash $SP/cam/sfanim.sh | while read l; do say "anim $l"; done
recenter; sleep 3
for i in 1 2 3; do
  switch $TAG-sw-ad-$i "Lab Dense" "Categories, 5 Systems" 12 >/dev/null 2>&1; sleep 3
  switch $TAG-sw-di-$i "Lab Inner Circle" "Custom Systems, 1 System" 12 >/dev/null 2>&1; sleep 3
  switch $TAG-sw-ia-$i "All Contacts" "Built-in, 6 Systems" 12 >/dev/null 2>&1; sleep 3
done
for i in 1 2 3 4 5 6; do FSECS=10 focusrun $TAG-fo-$i >/dev/null 2>&1; done
cold 2>/dev/null; sleep 3; recenter; sleep 3; say "$(mem $TAG-mem-load)"
for i in 1 2 3 4 5; do
  XY=$(pick "Lab Dense" "Categories, 5 Systems"); $ADB shell input touchscreen tap $XY; sleep 5
  XY=$(pick "All Contacts" "Built-in, 6 Systems"); $ADB shell input touchscreen tap $XY; sleep 5
done
say "$(mem $TAG-mem-10sw)"
say "soak start $($ADB shell dumpsys thermalservice | grep -m1 'Thermal Status') $($ADB shell dumpsys battery | grep -E 'level|temperature' | tr -s ' ' | tr '\n' ' ')"
recenter; sleep 2; end=$(( $(date +%s) + 120 ))
while [ $(date +%s) -lt $end ]; do contpan 15; XY=$(pick "Lab Dense" "Categories, 5 Systems"); $ADB shell input touchscreen tap $XY; sleep 4; XY=$(pick "All Contacts" "Built-in, 6 Systems"); $ADB shell input touchscreen tap $XY; sleep 4; recenter; done
say "soak end $($ADB shell dumpsys thermalservice | grep -m1 'Thermal Status') $($ADB shell dumpsys battery | grep -E 'level|temperature' | tr -s ' ' | tr '\n' ' ')"
