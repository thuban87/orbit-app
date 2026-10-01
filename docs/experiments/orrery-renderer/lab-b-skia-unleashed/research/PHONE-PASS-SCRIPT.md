# Lab B — phone pass script (Pixel 6 Pro, ~20 min)

**Do not start until the owner says Lab A is done with the Pixel.** Lab A owns the phone and the
local adb server (port 5037) until then. This pass uses that local server, **not** Lab B's
5039 tunnel. Prepared in R1 (2026-10-01) from the emulator envelope (`research/R1-REPORT.md`);
every number from the emulator is relative only — this pass produces the first absolute ones.

## 0. Preconditions (2 min)

```bash
LB=/home/bwales/projects/orbit-orrery-lab-b
T=$LB/docs/experiments/orrery-renderer/lab-b-skia-unleashed/tools
EV=$LB/docs/experiments/orrery-renderer/lab-b-skia-unleashed/evidence/10-phone
PKG=com.bwales.orbit.labb
emu-connect status                       # read only — never `emu-connect device` without the owner
~/Android/Sdk/platform-tools/adb devices -l   # local server 5037; exactly ONE device (the 6 Pro)
SERIAL=<serial from the line above>      # never hardcode / guess
ADB="$HOME/Android/Sdk/platform-tools/adb -s $SERIAL"
$ADB shell getprop ro.product.model      # "Pixel 6 Pro"
mkdir -p $EV
```

- If the phone shows `unauthorized`, only the owner can accept the prompt. Stop and ask.
- Never `kill-server`, never `apt install adb`, never touch Lab A's package (`com.bwales.orbit`).

## 1. Builds (droid, ~6 min, busy-checked) — ARM64

The emulator APKs are x86_64-only. The phone needs arm64-v8a. Seed on DEBUG, profile on RELEASE
(RUNBOOK §10: release installed over the seeded debug keeps the data).

```bash
$T/droid-busy.sh || echo BUSY            # wait while busy; never kill anything
# sync (RUNBOOK §4), then:
ssh -o BatchMode=yes droid "cd /d C:\Users\bwales\projects\orbit-lab-b\android & gradlew.bat assembleDebug assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain"
scp "droid:C:/Users/bwales/projects/orbit-lab-b/android/app/build/outputs/apk/debug/app-debug.apk" /tmp/labb-arm-debug.apk
scp "droid:C:/Users/bwales/projects/orbit-lab-b/android/app/build/outputs/apk/release/app-release.apk" /tmp/labb-arm-release.apk
```

Seeding needs Metro on 8084 reachable from the phone: `$ADB reverse tcp:8081 tcp:8084` (the dev
client asks for 8081) — remove it at the end (`$ADB reverse --remove tcp:8081`). Install debug,
launch, wait for `[lab-b-seed] stress seeded contacts=800` in `$ADB logcat -s ReactNativeJS`
(~1 min on the emulator; the phone is faster), then `install -r` the release APK.

## 2. Matrix (≈8 min, scripted)

The harness is the same one R1 used on the emulator. It drives deep links, so no panel taps:

```bash
export ADB PKG
# Screen geometry: the 6 Pro is 1440x3120 — re-derive the two tap targets from a screenshot
# ($ADB exec-out screencap -p) and pass them (the emulator values are for 1280x2856):
export ORRERY_TAB="<x y of the Orrery tab icon>" RECENTRE="<x y of the recentre control>"
export SWIPE="<x1 y1 x2 y2 inside the canvas, never within 150 px of the left edge>"
CONFIGS="laball labmin legacy" SYSTEMS="120 400 800" $T/r1-matrix.sh $EV/perf
# then the R1 defaults (idle clock ON) for the idle rows only:
LABALL_FLAGS="idleClock:1" CONFIGS=laball SYSTEMS="120 800" $T/r1-matrix.sh $EV/perf-idleclock
```

Output: `$EV/perf/summary.tsv` (one row per scenario: gfx frames, janky, p50/p90/p95/p99, GPU
p50/p90, Choreographer skips, `CRASH`) + per-scenario `.gfx`/`.log` with the per-worklet probe
lines (`[labb-probe] name=runs/mean/p95/max ms`).

## 3. Perfetto: UI + RenderThread + JS thread (≈3 min)

One trace per scene: Stress 800 overview idle, pan, focus fly-in, big switch (Inner → Stress 800).

```bash
cat > /tmp/labb-trace.pbtx <<'EOF'
buffers { size_kb: 65536 fill_policy: RING_BUFFER }
data_sources { config { name: "linux.ftrace" ftrace_config {
  ftrace_events: "sched/sched_switch" ftrace_events: "sched/sched_wakeup"
  ftrace_events: "power/cpu_frequency" ftrace_events: "power/gpu_frequency"
  atrace_categories: "gfx" atrace_categories: "view" atrace_categories: "input"
  atrace_categories: "sched" atrace_categories: "freq" atrace_categories: "hal"
  atrace_apps: "com.bwales.orbit.labb" } } }
data_sources { config { name: "linux.process_stats" process_stats_config { scan_all_processes_on_start: true } } }
data_sources { config { name: "android.surfaceflinger.frametimeline" } }
data_sources { config { name: "android.gpu.memory" } }
duration_ms: 12000
EOF
$ADB push /tmp/labb-trace.pbtx /data/local/tmp/labb-trace.pbtx
# start, then trigger the scene within 2 s (deep link / swipe), e.g. the big switch:
$ADB shell "perfetto --txt -c /data/local/tmp/labb-trace.pbtx -o /data/misc/perfetto-traces/labb-switch.pftrace" &
sleep 1; $ADB shell "am start -a android.intent.action.VIEW -d 'orbit://labb?system=Lab%20B%20Stress%20800&delay=500' $PKG"
wait; $ADB pull /data/misc/perfetto-traces/labb-switch.pftrace $EV/
```

Read in ui.perfetto.dev: thread tracks **main** (the Android UI thread — Skia draws here; the
Reanimated mappers and the layer-picture worklets run here), **RenderThread**, **mqt_v_js** (JS:
React commits, paragraph preparation, scene load) and **FrameTimeline** (janky frames + cause).
Record per scene: main-thread busy % in the window, the longest main slice, JS longest slice,
RenderThread p90, and the FrameTimeline jank type split.

## 4. gfxinfo framestats, memory, thermal, battery (≈5 min)

```bash
# Frame stats over a 15 s idle on Stress 800, R1 defaults vs the always-on clock:
$ADB shell dumpsys gfxinfo $PKG reset; sleep 15; $ADB shell dumpsys gfxinfo $PKG framestats > $EV/framestats-800-idle.txt
$ADB shell "am start -a android.intent.action.VIEW -d 'orbit://labb?flags=idleClock:0' $PKG"; sleep 12
$ADB shell dumpsys gfxinfo $PKG reset; sleep 15; $ADB shell dumpsys gfxinfo $PKG framestats > $EV/framestats-800-idle-clockon.txt
# Memory (PSS, Graphics, Native heap) on Stress 800 after a switch round trip:
$ADB shell dumpsys meminfo $PKG > $EV/meminfo-800.txt
# Thermal + battery: 10 min continuous on Dense (all flags on), screen on:
$ADB shell dumpsys battery reset; $ADB shell dumpsys batterystats --reset
$ADB shell dumpsys thermalservice | grep -A12 "Current temperatures" > $EV/thermal-t0.txt
sleep 600
$ADB shell dumpsys thermalservice | grep -A12 "Current temperatures" > $EV/thermal-t10.txt
$ADB shell dumpsys batterystats $PKG | grep -E "Estimated power use|Uid u0a|cpu=|Screen" > $EV/battery-10min.txt
$ADB shell dumpsys gfxinfo $PKG > $EV/gfx-10min.txt
```

(The 10-minute soak can overlap with filling in §5 from the matrix output.)

## 5. Result tables (fill in)

### 5.1 Envelope (release, arm64, Galaxy Dark; gfx = main + RenderThread)

| Bodies | Config | idle frames/10 s | idle p50/p90 | pan p50/p95 | focus p90/p99 | switch p90/p99 | skipped max | crash |
|---|---|---|---|---|---|---|---|---|
| 120 | lab all-on | | | | | | | |
| 120 | lab minimal | | | | | | | |
| 120 | legacy | | | | | | | |
| 400 | lab all-on | | | | | | | |
| 400 | lab minimal | | | | | | | |
| 400 | legacy | | | | | | | |
| 800 | lab all-on | | | | | | | |
| 800 | lab minimal | | | | | | | |
| 800 | legacy | | | | | | | |

### 5.2 Per-worklet UI-thread cost at 800 (probe, ms mean / p95)

| Scene | frame | alloc | bodies | labels | rings | wakes | trim | nebula |
|---|---|---|---|---|---|---|---|---|
| pan | | | | | | | | |
| focus fly-in | | | | | | | | |
| switch | | | | | | | | |

### 5.3 Perfetto (Stress 800)

| Scene | main busy % | longest main slice | JS longest slice | RenderThread p90 | jank split |
|---|---|---|---|---|---|
| idle | | | | | |
| pan | | | | | |
| focus | | | | | |
| switch | | | | | |

### 5.4 Idle clock (R1) on the phone

| Scene | idleClock ON frames/15 s | OFF frames/15 s | notes |
|---|---|---|---|
| 800, all ambient on | | | (clock runs: nebula/stars/sun) |
| 800, reduced motion | | | ON should be ≈0 |

### 5.5 Thermal / battery / memory

| Metric | t0 | t+10 min |
|---|---|---|
| skin / battery °C | | |
| throttling status | | |
| app power estimate (mAh) | — | |
| PSS total / Graphics / Native (MB) | | |

## 6. Questions this pass must answer

1. Does the 800-body Hermes crash stay fixed on ARM (R1 fix: cached label paragraphs)?
2. Absolute frame cadence at 120/400/800 — is 400 inside a 60 fps budget with all effects?
3. Is the emulator's GPU-cheap verdict true on Mali (nebula sample, ring shader, body shaders,
   corona)? Compare lab all-on vs minimal GPU p90.
4. The frame projection (model half) scales linearly (~48 µs/body on the emulator UI thread):
   what is it on the 6 Pro's big core?
5. Opaque canvas (`flags=opaqueCanvas:1`): any RenderThread win, and do the glass overlays /
   focus card / screenshots still composite?
6. Thermal after 10 min with ambient effects; idle-clock savings with reduced motion.

## 7. Teardown

`$ADB reverse --remove tcp:8081`; leave the app installed; tell the owner the phone is free.
