#!/bin/bash
# panprof.sh TAG [cold]  -- simpleperf main thread during a 6 s pan + gfx pan + idle (debug-native + prod JS)
TAG=$1
SP=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad; export ANDROID_SERIAL=$(~/.local/bin/adb devices | awk '$2=="device"{print $1}')
OUT=$SP/cam/m
source /home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/evidence/final/perf/tools/lib.sh
LOG=$SP/cam/prof-$TAG.txt; : > $LOG
say(){ echo "$*" | tee -a $LOG; }
if [ "$2" = cold ]; then cold; sleep 25; ui list | grep -q "Recenter Orrery" || { ui tap "Orrery" >/dev/null; sleep 5; }; fi
cur=$(ui list | grep -o "Current System: [A-Za-z ]*" | head -1); say "$cur"
recenter; sleep 4
pid=$($ADB shell pidof $P)
( $ADB shell "simpleperf record --app $P -t $pid -f 3000 --duration 6 -g -o /data/local/tmp/perf.data" > $SP/cam/sp-$TAG.log 2>&1 ) & SPP=$!
sleep 0.3; panloop 6 > /dev/null; wait $SPP
$ADB shell "simpleperf report -i /data/local/tmp/perf.data --sort dso" > $SP/cam/$TAG-pan-dso.txt 2>/dev/null
$ADB shell "simpleperf report -i /data/local/tmp/perf.data --children --sort symbol" > $SP/cam/$TAG-pan-sym.txt 2>/dev/null
recenter; sleep 2
for i in 1 2; do gfx_reset; panloop 10 >/dev/null; say "$(gfx_dump $TAG-pan-$i | python3 -c "import sys,json; l=sys.stdin.read().split(' ',1); d=json.loads(l[1]); print(l[0], 'frames',d['frames'],'p50',d['p50'],'p90',d['p90'])")"; recenter; sleep 2; done
( sleep 0.5; panloop 8 >/dev/null ) & say "pan cpu $(thrcpu 7)"; wait
recenter; sleep 3
gfx_reset; sleep 10; say "$(gfx_dump $TAG-idle | python3 -c "import sys,json; l=sys.stdin.read().split(' ',1); d=json.loads(l[1]); print(l[0], 'frames',d['frames'],'p50',d['p50'],'p90',d['p90'])")"
say "idle cpu $(thrcpu 6)"
