#!/usr/bin/env bash
# scenario.sh <label> : fresh launch, then switches + focus, each recorded with logcat summary
SP=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad
ADB=~/.local/bin/adb; L=$1; OUT=$SP/perf/$L; mkdir -p $OUT
sum() { # $1 name
  $ADB logcat -d -v time > $OUT/$1.log
  python3 - "$OUT/$1.log" "$OUT/$1.mp4" "$1" <<'PY'
import sys,re,subprocess
log=open(sys.argv[1]).read().splitlines(); name=sys.argv[3]
def t(l):
    h,m,s=l[6:18].split(":"); return int(h)*3600+int(m)*60+float(s)
tap=next((t(l) for l in log if "ready->loading" in l or "focus 1" in l),None)
pub=next((t(l) for l in log if "publish gen" in l and "isSwitch true" in l),None)
done=[l for l in log if "switch done" in l]
dav=[int(re.search(r"duration=(\d+)",l).group(1)) for l in log if "Davey!" in l]
skips=[int(re.search(r"Skipped (\d+)",l).group(1)) for l in log if "Skipped" in l]
loadr=[l.split("load read ")[1] for l in log if "load read" in l]
v=subprocess.run(["python3","/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad/vidan.py",sys.argv[2],sys.argv[2][:-4],"30","12"],capture_output=True,text=True).stdout.splitlines()
mov=[x for x in v if x.startswith("moving")]
print(f"{name}: load {loadr[:1]} tap->publish {round(pub-tap,2) if pub and tap else None}s | {done[0].split('switch done: ')[1] if done else 'no-switch-summary'} | maxDavey {max(dav) if dav else 0}ms skips {skips} | {mov[0] if mov else ''}")
PY
}
WAIT=15 bash $SP/launch.sh
$ADB logcat -c; bash $SP/sw.sh "Lab Dense" "Categories" $OUT/s1-all-dense.mp4 10 >/dev/null; sleep 4; sum s1-all-dense
$ADB logcat -c; bash $SP/sw.sh "All Contacts" "Built-in" $OUT/s2-dense-all.mp4 10 >/dev/null; sleep 4; sum s2-dense-all
$ADB logcat -c; $ADB shell rm -f /sdcard/f.mp4; ($ADB shell screenrecord --size 720x1560 --bit-rate 12000000 --time-limit 5 /sdcard/f.mp4 &) ; sleep 0.8; $ADB shell input tap 718 1498; sleep 5; $ADB pull /sdcard/f.mp4 $OUT/s3-focus.mp4 >/dev/null; sum s3-focus
python3 /home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/tools/ui.py tap "Clear focus" --nth 1 >/dev/null 2>&1; sleep 3
$ADB logcat -c; bash $SP/sw.sh "Lab Dense" "Categories" $OUT/s4-all-dense.mp4 10 >/dev/null; sleep 4; sum s4-all-dense
$ADB logcat -c; bash $SP/sw.sh "Lab Inner Circle" "Custom" $OUT/s5-dense-inner.mp4 8 >/dev/null; sleep 4; sum s5-dense-inner
$ADB logcat -c; bash $SP/sw.sh "Lab Dense" "Categories" $OUT/s6-inner-dense.mp4 8 >/dev/null; sleep 4; sum s6-inner-dense
