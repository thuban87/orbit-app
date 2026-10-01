#!/bin/bash
# sfpan.sh -- presented fps of the Orrery layer during continuous 3 s swipes (SurfaceFlinger --latency), 4 runs
ADB=~/.local/bin/adb; P=com.bwales.orbit.laba
L=$($ADB shell dumpsys SurfaceFlinger --list | grep -o "[0-9a-f]* SurfaceView\[com.bwales.orbit.laba[^]]*\](BLAST)#[0-9]*" | head -1)
[ -z "$L" ] && L=$($ADB shell dumpsys SurfaceFlinger --list | grep -o "VRI-com.bwales.orbit.laba/[^#]*#[0-9]*" | head -1)
echo "layer: $L"
for i in 1 2 3 4; do
  if [ $((i%2)) -eq 1 ]; then A="300 1800 1100 1500"; else A="1100 1500 300 1800"; fi
  ( $ADB shell input touchscreen swipe $A 3000 ) & sleep 2.4
  $ADB shell dumpsys SurfaceFlinger --latency "'$L'" > /tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad/cam/sf.txt; wait
  python3 - <<'PY'
v=[l.split() for l in open('/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad/cam/sf.txt').read().splitlines()[1:]]
t=sorted(int(x[1]) for x in v if len(x)==3 and 0<int(x[1])<9e18)
if not t: print("no frames"); raise SystemExit
end=t[-1]; win=[x for x in t if x>end-1.0e9]
gaps=[(b-a)/1e6 for a,b in zip(win,win[1:])]
gaps.sort()
print(f"presents in last 1.0 s: {len(win)}  median gap {gaps[len(gaps)//2]:.1f} ms  p90 {gaps[int(len(gaps)*0.9)]:.1f} ms" if gaps else "few")
PY
  sleep 0.8
done
