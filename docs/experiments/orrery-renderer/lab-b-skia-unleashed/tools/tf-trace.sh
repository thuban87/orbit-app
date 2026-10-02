#!/usr/bin/env bash
# Tilt fix (phone): one Perfetto trace of the current scene + droid-side summary.
# Usage: tf-trace.sh <out-dir> <label> [seconds]
# Env: ADB (phone, local server), PKG. The caller sets up the scene first.
# Config = the phone pass's (sched, gpu freq/util, atrace gfx/view for the app).
# Analysis runs on droid (trace_processor needs AVX2) with the phone-pass
# queries (evidence/12-phone/perfetto/perfetto-queries.sql), one per file.
set -u
OUT=$1; LABEL=$2; SECS=${3:-10}
PKG=${PKG:-com.bwales.orbit.labb}
HERE=$(cd "$(dirname "$0")" && pwd)
Q="$HERE/../evidence/12-phone/perfetto/perfetto-queries.sql"
mkdir -p "$OUT"
CFG=$(mktemp)
cat > "$CFG" <<CFGEOF
buffers { size_kb: 65536 fill_policy: RING_BUFFER }
data_sources { config { name: "linux.ftrace" ftrace_config {
  ftrace_events: "sched/sched_switch" ftrace_events: "sched/sched_wakeup"
  ftrace_events: "power/cpu_frequency" ftrace_events: "power/gpu_frequency"
  atrace_categories: "gfx" atrace_categories: "view" atrace_categories: "input"
  atrace_categories: "sched" atrace_categories: "freq" atrace_categories: "hal"
  atrace_apps: "$PKG" } } }
data_sources { config { name: "linux.process_stats" } }
data_sources { config { name: "android.gpu.memory" } }
data_sources { config { name: "gpu.counters" gpu_counter_config { counter_period_ns: 1000000 } } }
duration_ms: $((SECS * 1000))
CFGEOF
cat "$CFG" | $ADB shell "perfetto --txt -c - -o /data/misc/perfetto-traces/tf-$LABEL.pftrace" >/dev/null 2>&1
rm -f "$CFG"
$ADB pull "/data/misc/perfetto-traces/tf-$LABEL.pftrace" "$OUT/$LABEL.pftrace" >/dev/null 2>&1
$ADB shell rm -f "/data/misc/perfetto-traces/tf-$LABEL.pftrace"
D='C:\Users\bwales\projects\orbit-lab-b\.labb-perfetto'
scp -q -o BatchMode=yes "$OUT/$LABEL.pftrace" "droid:C:/Users/bwales/projects/orbit-lab-b/.labb-perfetto/t.pftrace"
# One query per file: the two shared tables + one select.
HEAD=$(head -2 "$Q")
n=0
tail -n +3 "$Q" | while IFS= read -r line; do
  [ -z "$line" ] && continue
  printf '%s\n%s\n' "$HEAD" "$line" | ssh -o BatchMode=yes droid "more > \"$D\\q$n.sql\"" 2>/dev/null
  n=$((n + 1))
done
ssh -o BatchMode=yes droid "cd /d \"$D\" & run.bat t.pftrace" 2>/dev/null | grep -v '^"k"\|^$' > "$OUT/$LABEL.summary.txt"
gzip -f "$OUT/$LABEL.pftrace"
cat "$OUT/$LABEL.summary.txt"
