#!/bin/bash
# skiprun.sh MASK
SP=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad; export ANDROID_SERIAL=1A071FDEE002BU
source /home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/evidence/final/perf/tools/lib.sh; OUT=$SP/arch
sed -i "s/^const PERF_SKIP = [0-9]*;/const PERF_SKIP = $1;/" /home/bwales/projects/orbit-orrery-lab-a/src/components/orrery/lab/LabScene.tsx
sleep 2; cold; sleep 6; gfx_reset; sleep 8; gfx_dump skip-$1 | python3 -c "import sys,json; l=sys.stdin.read().split(' ',1); d=json.loads(l[1]); print(l[0], d['frames'], d['p50'], d['p90'])"; thrcpu 6
