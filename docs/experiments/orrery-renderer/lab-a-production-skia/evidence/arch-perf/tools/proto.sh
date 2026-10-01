#!/bin/bash
# proto.sh TAG  -- debug-native+prodJS protocol for the current JS
TAG=$1
SP=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad; export ANDROID_SERIAL=1A071FDEE002BU
source /home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/evidence/final/perf/tools/lib.sh
LOG=$SP/arch/proto-$TAG.txt; : > $LOG
say(){ echo "$*" | tee -a $LOG; }
cold; sleep 3
cur=$(ui list | grep -o "Current System: [A-Za-z ]*" | head -1); say "$cur"
if ! echo "$cur" | grep -q "All Contacts"; then XY=$(pick "All Contacts" "Built-in, 6 Systems"); $ADB shell input touchscreen tap $XY; sleep 8; fi
recenter; sleep 4
for i in 1 2; do gfx_reset; sleep 10; say "$(gfx_dump $TAG-idle-$i | python3 -c "import sys,json; l=sys.stdin.read().split(' ',1); d=json.loads(l[1]); print(l[0], 'frames',d['frames'],'p50',d['p50'],'p90',d['p90'])")"; done
say "idle cpu $(thrcpu 8)"
gfx_reset; panloop 10 >/dev/null; say "$(gfx_dump $TAG-pan | python3 -c "import sys,json; l=sys.stdin.read().split(' ',1); d=json.loads(l[1]); print(l[0], 'frames',d['frames'],'p50',d['p50'],'p90',d['p90'])")"
recenter; sleep 3
$ADB shell settings put global transition_animation_scale 0; sleep 4
for i in 1 2; do gfx_reset; sleep 10; say "$(gfx_dump $TAG-rm-$i | python3 -c "import sys,json; l=sys.stdin.read().split(' ',1); d=json.loads(l[1]); print(l[0], 'frames',d['frames'],'p50',d['p50'])")"; done
say "rm cpu $(thrcpu 8)"
$ADB shell settings put global transition_animation_scale 1; sleep 3
for i in 1 2; do
  say "$(switch $TAG-sw-ad-$i "Lab Dense" "Categories, 5 Systems" 9)"; sleep 4
  say "$(switch $TAG-sw-da-$i "All Contacts" "Built-in, 6 Systems" 9)"; sleep 4
done
for i in 1 2 3; do FSECS=12 focusrun $TAG-fo-$i; done
tail -3 $R/focus.jsonl | tee -a $LOG
