#!/bin/bash
# sfidle.sh SECS -- presents/s of the Orrery layer: new present timestamps between two dumps SECS apart (SECS<=4 at 30 Hz)
ADB=~/.local/bin/adb; D=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad/cam
L=$($ADB shell dumpsys SurfaceFlinger --list | grep -o "[0-9a-f]* SurfaceView\[com.bwales.orbit.laba[^]]*\](BLAST)#[0-9]*" | head -1)
[ -z "$L" ] && L=$($ADB shell dumpsys SurfaceFlinger --list | grep -o "VRI-com.bwales.orbit.laba/[^#]*#[0-9]*" | head -1)
$ADB shell dumpsys SurfaceFlinger --latency "'$L'" > $D/sfi1.txt; sleep ${1:-3}; $ADB shell dumpsys SurfaceFlinger --latency "'$L'" > $D/sfi2.txt
python3 - "${1:-3}" <<'PY'
import sys
D='/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad/cam/'
def ts(f): return {int(l.split()[1]) for l in open(D+f).read().splitlines()[1:] if len(l.split())==3 and 0<int(l.split()[1])<9e18}
a=ts('sfi1.txt'); b=ts('sfi2.txt'); n=len(b-a)
print(f"presents/s over {sys.argv[1]}s: {n/float(sys.argv[1]):.1f}" + (" (buffer saturated: lower bound)" if n>=127 else ""))
PY
