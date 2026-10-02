#!/usr/bin/env bash
# ORRERY LAB B — R1 density-envelope perf harness (emulator now, phone later).
#
# Usage: r1-perf.sh <out-dir> <label> <renderer lab|legacy> <flags> <system> <focus-name> <other-system> [scenarios]
#   flags        comma list for orbit://labb?flags= (fpsHud:0,perfProbe:1 are always appended)
#   system       the System under test (exact catalog name)
#   focus-name   a member of <system> to focus (fly-in)
#   other-system the switch partner (switch S -> other, then other -> S)
#   scenarios    default "idle pan focus switch"
#
# Env: POSE (tilt fix): deep-link pose query applied after every recentre.
# Env: ADB (default: the Lab B tunnel, `adb -P 5039 -s emulator-5554`), PKG,
#      PRESET (R3 one-tap preset applied before <flags>),
#      SF=1 (phone pass): also sample the OPAQUE canvas's presented frames from
#      SurfaceFlinger during every window (tools/sf-sampler.py) -> <scenario>.sf + summary cols.
# On the PHONE pass set ADB="$HOME/Android/Sdk/platform-tools/adb -s <serial>"
# (local server 5037) and SWIPE (see research/PHONE-PASS-SCRIPT.md).
#
# Each deep link pauses/resumes the activity and REMOUNTS the Orrery, so every
# measured action is fired with `delay=` after the remount has settled and the
# gfxinfo window starts just before it fires. Output per scenario:
#   <out>/<label>__<scenario>.gfx   dumpsys gfxinfo (main + RenderThread)
#   <out>/<label>__<scenario>.log   logcat ReactNativeJS [labb-probe] + Choreographer skips
#   <out>/summary.tsv               one row per scenario
set -u
OUT=$1; LABEL=$2; RENDERER=$3; FLAGS=$4; SYSTEM=$5; FOCUS=$6; OTHER=$7
SCEN=${8:-"idle pan focus switch"}
ADB=${ADB:-"$HOME/Android/Sdk/platform-tools/adb -P 5039 -s emulator-5554"}
PKG=${PKG:-com.bwales.orbit.labb}
SETTLE=${SETTLE:-14}       # s after a remounting deep link
ACT_DELAY=${ACT_DELAY:-12000}  # ms: action fires this long after its link
SWIPE=${SWIPE:-"700 1500 300 1300"} # x1 y1 x2 y2 (avoid the left 150 px: system Back)
mkdir -p "$OUT"
enc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$1"; }
link() { $ADB shell "am start -a android.intent.action.VIEW -d '$1' $PKG" >/dev/null 2>&1; }
SFS=$(dirname "$0")/sf-sampler.py; SFSTOP="$OUT/.sf-stop"
gfx_reset() { $ADB shell dumpsys gfxinfo $PKG reset >/dev/null; $ADB logcat -c
  if [ -n "${SF:-}" ]; then rm -f "$SFSTOP" "$OUT/.sf-cur"; ADB="$ADB" PKG=$PKG SF_STOP="$SFSTOP" python3 "$SFS" 0 "$OUT/.sf-cur" >/dev/null & SFPID=$!; fi; }
collect() { # scenario
  if [ -n "${SF:-}" ]; then touch "$SFSTOP"; wait "$SFPID" 2>/dev/null; mv -f "$OUT/.sf-cur" "$OUT/${LABEL}__$1.sf" 2>/dev/null; fi
  $ADB shell dumpsys gfxinfo $PKG > "$OUT/${LABEL}__$1.gfx"
  APID=$($ADB shell pidof $PKG | tr -d '\r')
  $ADB logcat -d -s ReactNativeJS:I Choreographer:I libc:F | grep -E "labb-probe|Fatal signal|Skipped" | grep -E "labb-probe|Fatal signal|[ (]${APID:-x} " > "$OUT/${LABEL}__$1.log"
  python3 - "$OUT" "$LABEL" "$1" <<'PY'
import re,sys,os
out,label,scen=sys.argv[1:4]
g=open(f"{out}/{label}__{scen}.gfx").read()
def f(p):
    m=re.search(p,g); return m.group(1) if m else "-"
row=[label,scen,f(r"Total frames rendered: (\d+)"),f(r"Janky frames: (\d+)"),
     f(r"50th percentile: (\d+)ms"),f(r"90th percentile: (\d+)ms"),f(r"95th percentile: (\d+)ms"),
     f(r"99th percentile: (\d+)ms"),f(r"50th gpu percentile: (\d+)ms"),f(r"90th gpu percentile: (\d+)ms")]
log=open(f"{out}/{label}__{scen}.log").read()
skips=[int(x) for x in re.findall(r"Skipped (\d+) frames",log)]
row.append(str(max(skips) if skips else 0) + (" CRASH" if "Fatal signal" in log else ""))
# probe: mean of per-window means, max of max, total runs, per name
agg={}
for line in log.splitlines():
    if "labb-probe" not in line: continue
    for name,n,mean,p95,mx in re.findall(r"(\w+)=(\d+)/([\d.]+)/([\d.]+)/([\d.]+)",line):
        a=agg.setdefault(name,[0,0.0,0.0,0.0]); n=int(n)
        a[0]+=n; a[1]+=n*float(mean); a[2]=max(a[2],float(p95)); a[3]=max(a[3],float(mx))
row.append(" ".join(f"{k}:{v[0]}x{v[1]/max(1,v[0]):.1f}/p95 {v[2]:.1f}/max {v[3]:.1f}" for k,v in sorted(agg.items())))
sf={}
if os.path.exists(f"{out}/{label}__{scen}.sf"):
    sf=dict(kv.split("=",1) for kv in open(f"{out}/{label}__{scen}.sf").read().split() if "=" in kv and not kv.startswith("layer"))
row+= [sf.get(k,"-") for k in ("sf_frames","sf_fps","sf_p50","sf_p90","sf_p99","sf_max")]
hdr="label\tscenario\tframes\tjanky\tp50\tp90\tp95\tp99\tgpu50\tgpu90\tskipped_max\tprobe(name:runs x mean ms/p95/max)\tsf_frames\tsf_fps\tsf_p50\tsf_p90\tsf_p99\tsf_max"
path=f"{out}/summary.tsv"
new=not os.path.exists(path)
with open(path,"a") as fh:
    if new: fh.write(hdr+"\n")
    fh.write("\t".join(row)+"\n")
print("\t".join(row[:11]+row[12:]))
PY
}
S=$(enc "$SYSTEM"); O=$(enc "$OTHER"); F=$(enc "$FOCUS")
# R3: PRESET (best | shipSafe | everything | legacy) is applied right after the
# reset, before renderer/flags, so <flags> are deltas on top of the preset.
BASE="orbit://labb?reset=1${PRESET:+&preset=$PRESET}&renderer=$RENDERER&flags=$FLAGS,fpsHud:0,perfProbe:1,opaqueCanvas:${OPAQUE:-0}&panel=0"
# Setup: flags + renderer + the System under test, then recentre.
# Make sure the Orrery tab is in front (a crash/relaunch lands on Digest).
$ADB shell input tap ${ORRERY_TAB:-896 2690}; sleep 3
link "$BASE&system=$S&delay=0"; sleep "$SETTLE"
$ADB shell input tap ${ORRERY_TAB:-896 2690}; sleep 2
$ADB shell input touchscreen tap ${RECENTRE:-1150 2140}; sleep 4
# Tilt fix: POSE (e.g. "tilt=1.0472") applies a camera pose after the recentre.
pose() { [ -n "${POSE:-}" ] && { link "orbit://labb?$POSE&delay=1500"; sleep 5; }; return 0; }
pose
for sc in $SCEN; do
  case $sc in
    idle)
      gfx_reset; sleep 10; collect idle ;;
    pan)
      gfx_reset
      read -r x1 y1 x2 y2 <<<"$SWIPE"
      for k in 1 2 3; do
        $ADB shell input swipe $x1 $y1 $x2 $y2 350; sleep 1.2
        $ADB shell input swipe $x2 $y2 $x1 $y1 350; sleep 1.2
      done
      sleep 1; collect pan
      $ADB shell input touchscreen tap ${RECENTRE:-1150 2140}; sleep 3; pose ;;
    focus)
      link "orbit://labb?focus=$F&delay=$ACT_DELAY"
      sleep $(( ACT_DELAY / 1000 - 1 )); gfx_reset; sleep 7; collect focus
      link "orbit://labb?clear=1&delay=$ACT_DELAY"; sleep $(( ACT_DELAY / 1000 + 3 ))
      $ADB shell input touchscreen tap ${RECENTRE:-1150 2140}; sleep 3 ;;
    switch)
      link "orbit://labb?system=$O&delay=$ACT_DELAY"
      sleep $(( ACT_DELAY / 1000 - 1 )); gfx_reset; sleep 9; collect switch_out
      link "orbit://labb?system=$S&delay=$ACT_DELAY"
      sleep $(( ACT_DELAY / 1000 - 1 )); gfx_reset; sleep 9; collect switch_in ;;
  esac
done
