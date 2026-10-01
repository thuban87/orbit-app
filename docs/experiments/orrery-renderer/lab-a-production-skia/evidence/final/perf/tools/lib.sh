# source me
SP=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad
R=$SP/rel; OUT=${OUT:-$R/m}; mkdir -p $OUT
ADB=~/.local/bin/adb; P=com.bwales.orbit.laba
T=/home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/tools
ui(){ python3 $T/ui.py "$@"; }
gfx_reset(){ $ADB shell dumpsys gfxinfo $P reset >/dev/null; }
gfx_dump(){ $ADB shell dumpsys gfxinfo $P > $OUT/$1.gfx.txt; $ADB shell dumpsys gfxinfo $P framestats > $OUT/$1.fs.txt; python3 $R/gfxparse.py $OUT/$1.gfx.txt $OUT/$1.fs.txt > $OUT/$1.json; echo "$1 $(cat $OUT/$1.json)"; }
# rec_start NAME SECS  (background; device-timestamped verbose log)
rec_start(){ $ADB shell rm -f /sdcard/m.mp4; ( $ADB shell "screenrecord --verbose --time-limit $2 --size 720x1560 --bit-rate 12000000 /sdcard/m.mp4 | while read l; do echo \"\$(date +%s.%N) \$l\"; done" > $OUT/$1.rec.txt 2>&1 ) & RECPID=$!; sleep 1.2; }
rec_end(){ wait $RECPID; sleep 0.3; $ADB pull /sdcard/m.mp4 $OUT/$1.mp4 >/dev/null; }
# dtap X Y NAME -> logs device time before/after
dtap(){ $ADB shell "date +%s.%N; input touchscreen tap $1 $2; date +%s.%N" > $OUT/$3.tap.txt; }
pick(){ python3 $SP/pick.py "$1" "$2"; }
renderer(){ # renderer lab|legacy
  ui tap "View options" >/dev/null; sleep 1.5
  cur=$(python3 - <<'PY'
import sys,re,subprocess
sys.path.insert(0,"/home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/tools")
import ui
x=ui.dump(ui.serial())
print("lab" if any(l=="Lab A" for l,_,_,_ in ui.nodes(x)) else "legacy")
PY
)
  [ "$cur" != "$1" ] && { $ADB shell input touchscreen tap 1242 2560; sleep 1; }
  ui tap "Close view options" --nth 1 >/dev/null; sleep 1.2; echo "renderer was $cur now $1"; }
recenter(){ ui tap "Recenter Orrery" >/dev/null; sleep 1.5; }
panloop(){ local end=$(( $(date +%s) + ${1:-10} )); local k=0; while [ $(date +%s) -lt $end ]; do if [ $((k%2)) -eq 0 ]; then $ADB shell input touchscreen swipe 300 1800 1100 1600 600; else $ADB shell input touchscreen swipe 1100 1600 300 1800 600; fi; k=$((k+1)); done; echo "swipes $k"; }
# perfetto_start NAME DUR_MS ; perfetto_end NAME
perfetto_start(){ sed "s/DUR/$2/" $R/pf.cfg | $ADB shell "cat > /data/misc/perfetto-configs/pf.cfg"; ( $ADB shell "perfetto --txt -c /data/misc/perfetto-configs/pf.cfg -o /data/misc/perfetto-traces/$1.pftrace" > $OUT/$1.pf.log 2>&1 ) & PFPID=$!; sleep 1.5; }
perfetto_end(){ wait $PFPID; $ADB pull /data/misc/perfetto-traces/$1.pftrace $OUT/$1.pftrace >/dev/null; ls -la $OUT/$1.pftrace; }
# switch NAME "<System>" "<group>" [secs]
switch(){ local XY; XY=$(pick "$2" "$3") || { echo "pick failed $2"; return 1; }; sleep 0.5; gfx_reset; rec_start $1 ${4:-8}; dtap $XY $1; rec_end $1; gfx_dump $1 >/dev/null; python3 $R/swan.py $1 ${THR:-0.3}; }
focusrun(){ recenter; sleep 2; gfx_reset; rec_start $1 ${FSECS:-10}; $ADB logcat -c; dtap 720 1496 $1; rec_end $1; gfx_dump $1 >/dev/null; $ADB logcat -d -v epoch | grep -E "Choreographer|Davey|ReactNativeJS" > $OUT/$1.logcat.txt; python3 $R/swan.py $1 0.3 >> $R/focus.jsonl; ui tap "Clear focus" --nth 1 >/dev/null 2>&1 || ui tap "Clear focus" --contains >/dev/null 2>&1; sleep 2; }
# thrcpu SECS -> % CPU of main, RenderThread, JS thread over window
thrcpu(){ local p=$($ADB shell pidof $P); local s1=$($ADB shell "cut -d' ' -f1 /proc/uptime; for t in /proc/$p/task/*; do echo \$(basename \$t) \$(cat \$t/comm | tr ' ' _) \$(cut -d' ' -f14,15 \$t/stat); done"); sleep $1; local s2=$($ADB shell "cut -d' ' -f1 /proc/uptime; for t in /proc/$p/task/*; do echo \$(basename \$t) \$(cat \$t/comm | tr ' ' _) \$(cut -d' ' -f14,15 \$t/stat); done"); python3 - "$1" "$s1" "$s2" <<'PY'
import sys
secs=float(sys.argv[1])
def parse(s):
    d={}
    for l in s.splitlines():
        p=l.split()
        if len(p)>=4: d[p[0]]=(p[1],int(p[2])+int(p[3]))
    return d
a=parse(sys.argv[2]); b=parse(sys.argv[3]); secs=float(sys.argv[3].split()[0])-float(sys.argv[2].split()[0])
rows=sorted(((b[k][1]-a[k][1])/secs,b[k][0],k) for k in b if k in a)[::-1][:6]
print(f"win={secs:.1f}s "+" ".join(f"{n}:{v:.0f}%" for v,n,k in rows))
PY
}
mem(){ $ADB shell dumpsys meminfo $P > $OUT/$1.meminfo.txt; echo "$1 $(grep -E "TOTAL PSS|Native Heap|Graphics|GL mtrack|EGL mtrack|TOTAL RSS" $OUT/$1.meminfo.txt | grep -E "^ *(Native Heap|Graphics|EGL mtrack|GL mtrack)|TOTAL PSS" | awk '{print $1$2":"$3}' | tr '\n' ' ')"; }
cold(){ $ADB shell am force-stop $P; sleep 1; $ADB shell monkey -p $P -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; for i in $(seq 1 30); do ui list 2>/dev/null | grep -q "'Orrery'" && break; sleep 0.5; done; ui tap "Orrery" >/dev/null; sleep 5; }
settheme(){ # settheme "Theme X" "Mode Y"
  for i in 1 2 3 4; do ui list 2>/dev/null | grep -q "'Theme Galaxy'" && break; ui tap "Settings" >/dev/null 2>&1; sleep 2; ui tap "Appearance, Theme" --contains >/dev/null 2>&1; sleep 2; done
  ui tap "$1" >/dev/null; sleep 4; ui list 2>/dev/null | grep -q "'Mode Light'" || { ui tap "Settings" >/dev/null 2>&1; sleep 2; ui tap "Appearance, Theme" --contains >/dev/null 2>&1; sleep 2; }
  ui tap "$2" >/dev/null; sleep 5
  $ADB shell input touchscreen tap 1008 2951; sleep 4; ui list | grep -q "Recenter Orrery" || { $ADB shell input touchscreen tap 1008 2951; sleep 4; }
  recenter; sleep 4; }
