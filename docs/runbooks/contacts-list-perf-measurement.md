# Contacts List/Card Performance Measurement Pipeline

## Overview

How to measure the Contacts List and Card views' memory and tap latency, and how to bisect a
regression with measurement-only builds. Use it before and after any change to the Contacts list
host, its rows or its refresh path, and for Phase 40 performance work. The end result is a pair of
before/after tables, each figure naming its build, data set and the thread it covers. Phase 38.13
used it to take List memory from 1,749 MB to 308 MB (ADR-250).

## Architecture (38.13)

### Measurement scripts

**Directory:** `scripts/dev/contacts-perf/` (Python 3 standard library plus `/usr/bin/ffmpeg`
and `ffprobe`). Both scripts reuse `scripts/dev/orrery-perf/adb_device.py` (phone resolution by
model, adb wrappers, UI-tree helpers) and `scripts/dev/orrery-perf/thread_cpu.py` (per-thread CPU
from `/proc`). The full flag reference is `scripts/dev/contacts-perf/README.md`.

| Script | Figure | Thread covered |
|---|---|---|
| `list_memory.py` (M1) | TOTAL PSS, Native, Graphics, Views (`dumpsys meminfo`) | process-wide |
| `list_memory.py` | `js_settle_s` after each tap | JS thread (`mqt_v_js`) |
| `tap_latency.py` (M7) | ms from touch-up to the response frame | end to end |
| `tap_latency.py --thread-cpu` | CPU % per thread over the window | per thread (JS, UI, RenderThread) |

`dumpsys gfxinfo` sees only the UI/RenderThread; never cite it for JS-thread latency.

## File Locations

### Code

| File | Purpose |
|------|---------|
| `scripts/dev/contacts-perf/list_memory.py` | M1 memory curves: `--curve list`, `card`, `scroll`. |
| `scripts/dev/contacts-perf/tap_latency.py` | M7 tap latency from `screenrecord`, timed from the Pointer location bar. |
| `scripts/dev/contacts-perf/README.md` | Flag reference and what each figure measures. |
| `src/screens/HomeScreen.tsx` | The List host and its `LIST_WINDOW_*` tunables being measured. |

Evidence goes to `untracked/artifacts/<phase>/<plan>/` (CLAUDE.md repo layout) and never leaves
this box: DB copies, dumps and recordings show contact names.

## How to Measure

1. **Pick the phone from the runbook** (`docs/runbooks/desktop-build-pipeline.md` §0). Pass it
   by model; the scripts resolve the serial and pass `-s` on every adb call. Never measure on the
   desktop emulator or a debug build (CLAUDE.md "Android device"; 38.13 D-13).

2. **Pin the baseline commit** and build a release APK of it from `git archive`, never HEAD while
   other plans are committing:
   ```bash
   BASELINE_SHA=<sha>
   git archive "$BASELINE_SHA" | tar -x -C <scratchpad>/measure-src
   ```
   Build it per `docs/runbooks/desktop-build-pipeline.md` (arm64-v8a `assembleRelease`) in a
   **separate build-host directory**, never the normal build tree (38.13 D-56; 38.13-01 used
   `C:\Users\bwales\projects\orbit-app-measure`, that plan only). Install with `install -r`.

3. **Fix the data set and view.** Record the data set (38.13 used ~1,016 contacts shown on All
   Contacts and the ~100 set) and reset the Contacts view to All Contacts, no filter, before
   measuring.

4. **Run M1 and M7 in List and Card**, cold:
   ```bash
   python3 scripts/dev/contacts-perf/list_memory.py --model "Pixel 6 Pro" --curve list --cold \
     --pairs 5 --label "release <sha>, <data set>" \
     --raw-dir untracked/artifacts/<phase>/<plan>/m1-list-raw --out untracked/artifacts/<phase>/<plan>/m1-list.json
   python3 scripts/dev/contacts-perf/tap_latency.py --model "Pixel 6 Pro" --case trigger --view list \
     --cold --reps 3 --window 8 --thread-cpu --label "release <sha>, <data set>" \
     --video-dir untracked/artifacts/<phase>/<plan>/m7-video --out untracked/artifacts/<phase>/<plan>/m7-list-trigger.json
   ```
   Repeat with `--curve card`, `--view card`, `--case option`, and `--curve scroll` after a
   windowing change.

5. **Bisect with one patch per measurement build.** Apply each patch to a fresh `git archive`
   copy (never edit the repo), build it in the separate directory, and run the same M1/M7 set.
   A render counter (38.13 M3) tells whether rows re-render or mount.

6. **Native heap attribution only if the bisects do not explain it.** A `profileable` manifest flag
   may go into the separate directory's generated manifest only; confirm with `aapt2 dump xmltree`
   on that APK and save the dump. Ask the owner before installing any Perfetto host tooling. The
   shipped release manifest never changes (D-56; ADR-176).

### What You Don't Need to Change

- The app: the scripts only measure. No test IDs need adding for the Population/Sort/view-toggle
  taps; they use the existing `dashboard-*` test IDs.
- The normal build-host tree and the release delivery path.

## Pitfalls

1. **`sendevent` taps are blocked.** SELinux denies the shell write to `/dev/input` on the Pixel 6
   Pro, so M7 injects a 100 ms `input touchscreen swipe` with Pointer location on and reads touch
   down/up from that bar in the video. The `POINTER_BAR` pixel rows were read on the 6 Pro; check
   them before trusting the anchor on another phone.
2. **Two attached phones.** A "one device" check prints 2 with both test phones attached; rely on
   `--model`, never on cardinality.
3. **Leftover view state skews counts.** A phone left on Active + Needs attention shows far fewer
   rows; reset the view first.
4. **A measurement APK must never ship.** Building it in the normal directory risks a later plain
   build shipping a hand-edited manifest; keep the separate directory and never upload these APKs.
5. **Restore phone settings.** `pointer_location`, `show_touches` and `stay_on_while_plugged_in`
   are changed during runs; set them back afterwards.

## Smoke Test

```bash
python3 scripts/dev/orrery-perf/selftest.py
ls scripts/dev/contacts-perf/
```

Expected: every self-test line prints `PASS`; the directory lists `list_memory.py`,
`tap_latency.py` and `README.md`.

```bash
grep -n "profileable" android/app/src/main/AndroidManifest.xml 2>/dev/null; echo "exit=$?"
```

Expected: no match (the shipped manifest is never profileable).
