#!/bin/bash
# sfanim.sh -- presents during camera ANIMATIONS (not input-rate-bound): Recenter recovery after a big pan, x3
ADB=~/.local/bin/adb; T=/home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/tools
L=$($ADB shell dumpsys SurfaceFlinger --list | grep -o "[0-9a-f]* SurfaceView\[com.bwales.orbit.laba[^]]*\](BLAST)#[0-9]*" | head -1)
[ -z "$L" ] && L=$($ADB shell dumpsys SurfaceFlinger --list | grep -o "VRI-com.bwales.orbit.laba/[^#]*#[0-9]*" | head -1)
XY=$(python3 $T/ui.py list 2>/dev/null | grep "Recenter Orrery" | grep -o "center=([0-9]*,[0-9]*)" | head -1 | tr -dc "0-9,"| tr "," " ")
for i in 1 2 3; do
  $ADB shell input touchscreen swipe 300 2200 1200 900 300; sleep 2.5
  $ADB shell input touchscreen tap $XY; sleep 1.6
  $ADB shell dumpsys SurfaceFlinger --latency "'$L'" > /tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad/cam/sfa.txt
  python3 - <<'PY'
v=[l.split() for l in open('/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad/cam/sfa.txt').read().splitlines()[1:]]
t=sorted(int(x[1]) for x in v if len(x)==3 and 0<int(x[1])<9e18)
# the recovery burst: last run of frames with gaps < 30 ms (ambient frames are >= 33 ms apart)
best=[];cur=[t[0]] if t else []
for a,b in zip(t,t[1:]):
  if b-a<30e6: cur.append(b)
  else:
    if len(cur)>len(best): best=cur
    cur=[b]
if len(cur)>len(best): best=cur
g=sorted((b-a)/1e6 for a,b in zip(best,best[1:]))
if len(best)>2: print(f"recovery burst: {len(best)} presents over {(best[-1]-best[0])/1e6:.0f} ms = {1e3*(len(best)-1)/((best[-1]-best[0])/1e6):.0f} fps, median gap {g[len(g)//2]:.1f} ms, max {g[-1]:.1f}")
else: print("no burst")
PY
done
