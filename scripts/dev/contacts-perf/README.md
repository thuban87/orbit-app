# contacts-perf: Contacts List/Card measurement scripts (38.13 Plan 01)

Measurement scripts for the Contacts List view investigation (38.13 D-55, D-13).
They measure; they change nothing in the app. Python 3 standard library only,
plus `/usr/bin/ffmpeg` / `ffprobe` for `tap_latency.py`. Both reuse
`../orrery-perf/adb_device.py` (phone resolution, adb wrappers, UI-tree helpers)
and `../orrery-perf/thread_cpu.py` (per-thread CPU from /proc).

**Phone.** Both scripts take `--model` ("Pixel 6 Pro", "Pixel 3a") and resolve the
serial through `adb_device.resolve_serial`; every adb call passes `-s <serial>`, so a
second attached phone is never measured by mistake. Which phone to use comes from
`docs/runbooks/desktop-build-pipeline.md` §0. Never hard-code a serial.

**Build.** Performance claims come only from a release build on a physical phone
(CLAUDE.md "Android device"; 40-CONTEXT D-02). A debug build or the desktop
emulator gives no performance evidence. Record which build (release, commit hash)
every figure came from.

## What each figure measures, and which thread it covers

| Script | Figure | Thread covered |
|---|---|---|
| `list_memory.py` | TOTAL PSS, Native Heap, Unknown, Dalvik Heap, Java Heap, Graphics, GL/EGL mtrack, Other/Bitmap (malloced), Views (from `dumpsys meminfo com.bwales.orbit`) | **process-wide** (no thread, no allocation stack) |
| `list_memory.py` | `js_settle_s` per step: time until the JS thread went quiet after a tap (resolution ~0.5 s) | **JS thread** (`mqt_v_js`) |
| `tap_latency.py` | `first_change_any_ms`, `roi_first_change_ms`, `roi_settled_ms`, `roi_intermediate_ms` (ms after touch up) | **end to end** (touch -> composited frame); no thread attribution |
| `tap_latency.py --thread-cpu` | `thread_cpu_pct_of_one_core`: js, main_ui, render_thread, gc, total over the recording window | **per thread** (JS = `mqt_v_js`, UI = the process main thread, RenderThread); says how busy a thread was, not where the latency went |

`dumpsys gfxinfo` frame stats would cover the UI/RenderThread only; never cite them
for JS-thread latency.

## `list_memory.py` (M1)

```bash
python3 scripts/dev/contacts-perf/list_memory.py --model "Pixel 6 Pro" --curve list --cold \
  --pairs 5 --label "release <sha>, <data set>" \
  --raw-dir untracked/artifacts/<phase>/<plan>/m1-list-raw --out untracked/artifacts/<phase>/<plan>/m1-list.json
```

- `--curve list`: card idle (20 s) -> tap List, samples at +0 / +10 / +30 s -> Card ->
  List again -> 5 sort pairs in List (Name A-Z then Default; a sample after each
  pair) -> `am send-trim-memory com.bwales.orbit RUNNING_CRITICAL` -> sample.
- `--curve card`: the control. Card idle -> 5 sort pairs in Card -> trim -> sample.
- `--cold` force-stops and relaunches first. Both curves end by switching the view
  back to Card (not sampled), so the next cold start opens in Card.
- Taps use `uiautomator dump` bounds of the dashboard test IDs
  (`dashboard-view-toggle-list/-card`, `dashboard-sort-control`,
  `dashboard-sort-option-*`). After each tap the script waits for the JS thread to
  go quiet by reading `/proc/<pid>/task/<tid>/stat` (no accessibility client attached
  while the app is busy).

## `tap_latency.py` (M7)

```bash
python3 scripts/dev/contacts-perf/tap_latency.py --model "Pixel 6 Pro" --case trigger --view list \
  --cold --reps 3 --window 8 --thread-cpu --label "release <sha>, <data set>" \
  --video-dir untracked/artifacts/<phase>/<plan>/m7-video --out untracked/artifacts/<phase>/<plan>/m7-list-trigger.json
```

- `--case trigger`: tap the Population trigger; the response region is the panel.
  The panel is closed again after each rep.
- `--case option`: with the panel open, tap a Population option (`--option`,
  default `all-contacts`) twice (tap1, tap2: the list changes and changes back);
  the response region is the list below the panel. `roi_intermediate_ms` is the
  time that region matched neither the list before the tap nor the final list
  (the A-01 blank shows up here).
- **How the tap is timed.** `screenrecord` runs while an `input touchscreen swipe x y
  x y 100` (a 100 ms press) is injected. Developer options > Pointer location is
  switched on for the run (the prior value is restored afterwards); its top bar is
  drawn by system_server, changes at touch down and again at touch up, so the
  touch-up frame (when a Pressable's onPress fires) is found in the video itself.
  Latency = video time of the response frame - video time of the touch-up frame:
  one time base, frame resolution (~8 ms at 120 Hz). A real-touch marker via
  `sendevent` is not possible: SELinux denies the shell write to `/dev/input` on the
  Pixel 6 Pro (2026-10-19). `--anchor stamp` falls back to the device clock stamp
  vs the recording start (about +-0.2 s).
- The `POINTER_BAR` rows (screen pixels of the Pointer location bar) were read on the
  Pixel 6 Pro; check them on another phone before trusting the anchor there.

## Data and evidence stay local

The data sets (the phone's SQLite DB copies), the raw `dumpsys` dumps, the UI dumps
and especially the screen recordings show or contain contact names. They live only
under the gitignored `untracked/artifacts/<phase>/<plan>/` and are never committed,
uploaded or sent anywhere (CLAUDE.md local-first). Measurement APKs built for a
bisect are never committed, uploaded or delivered (38.13 D-56).
