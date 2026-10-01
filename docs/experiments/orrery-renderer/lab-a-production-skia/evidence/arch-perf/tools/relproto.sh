#!/bin/bash
TAG=rel-arch
SP=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad; export ANDROID_SERIAL=1A071FDEE002BU
source /home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/evidence/final/perf/tools/lib.sh
LOG=$SP/arch/relproto.txt; : > $LOG
say(){ echo "$*" | tee -a $LOG; }
g(){ gfx_dump $1 | python3 -c "import sys,json; l=sys.stdin.read().split(' ',1); d=json.loads(l[1]); print(l[0], 'frames',d['frames'],'janky',d['janky_pct'],'p50',d['p50'],'p90',d['p90'],'p99',d['p99'],'gpu50',d['gpu_p50'])"; }
say "thermal $($ADB shell dumpsys thermalservice | grep -m1 'Thermal Status') battery $($ADB shell dumpsys battery | grep -E 'level|temperature' | tr -s ' ' | tr '\n' ' ')"
cold; sleep 3
cur=$(ui list | grep -o "Current System: [A-Za-z ]*" | head -1); say "$cur"
if ! echo "$cur" | grep -q "All Contacts"; then XY=$(pick "All Contacts" "Built-in, 6 Systems"); $ADB shell input touchscreen tap $XY; sleep 8; fi
recenter; sleep 3
for i in 1 2 3; do gfx_reset; sleep 10; say "$(g $TAG-idle-$i)"; say "  cpu $(thrcpu 8)"; done
for i in 1 2 3; do recenter; sleep 2; gfx_reset; panloop 10 >/dev/null; say "$(g $TAG-pan-$i)"; done
recenter; sleep 3
for i in 1 2 3; do
  say "$(switch $TAG-sw-ad-$i "Lab Dense" "Categories, 5 Systems" 12 | tail -1)"; sleep 3
  say "$(switch $TAG-sw-di-$i "Lab Inner Circle" "Custom Systems, 1 System" 12 | tail -1)"; sleep 3
  say "$(switch $TAG-sw-ia-$i "All Contacts" "Built-in, 6 Systems" 12 | tail -1)"; sleep 3
done
for i in 1 2 3 4 5 6; do FSECS=10 focusrun $TAG-fo-$i; done
tail -6 $R/focus.jsonl | tee -a $LOG
recenter; sleep 2
$ADB shell settings put global transition_animation_scale 0; sleep 5
for i in 1 2 3; do gfx_reset; sleep 10; say "$(g $TAG-rm-$i)"; say "  cpu $(thrcpu 8)"; done
$ADB shell settings put global transition_animation_scale 1; sleep 2
cold; sleep 3; recenter; sleep 3; say "$(mem $TAG-mem-load)"
for i in 1 2 3 4 5; do
  XY=$(pick "Lab Dense" "Categories, 5 Systems"); $ADB shell input touchscreen tap $XY; sleep 5
  XY=$(pick "All Contacts" "Built-in, 6 Systems"); $ADB shell input touchscreen tap $XY; sleep 5
done
say "$(mem $TAG-mem-10sw)"
say "thermal $($ADB shell dumpsys thermalservice | grep -m1 'Thermal Status') battery $($ADB shell dumpsys battery | grep -E 'level|temperature' | tr -s ' ' | tr '\n' ' ')"
