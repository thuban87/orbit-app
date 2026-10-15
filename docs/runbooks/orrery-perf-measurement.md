# Runbook: Orrery performance measurement (38.7, D-56)

**Why this exists.** Phase 38.7 replaces the Orrery renderer. Its performance gates
(D-56), the idle-heat gate (D-40) and the tab-return memory gate (D-58) only mean something
if every measurement uses **the same data and the same method**: the Day-1 baseline of
today's main (Plan 02), the D-44 renderer spike (Plan 08) and the final release pass
(Plan 16). This runbook is that method. **Follow it exactly; do not improvise.** The
method is frozen from the first baseline number on (see §10).

Decisions served: **D-56** (baseline first, then the owner locks the numeric gates; hard
gates: no ANR, no switch stall over 100 ms on the 6 Pro / 150 ms on the 3a, idle no worse
than main), **D-40** (idle no warmer than main), **D-44** (the renderer spike is judged
against D-56), **D-58** (tab return; bounded warm cache inside 38.6 D-11's memory gate).

Tools: `scripts/dev/orrery-perf/` (Python 3 standard library + `/usr/bin/ffmpeg`).
Prove every parser before a session: `python3 scripts/dev/orrery-perf/selftest.py` must
print `PASS` on every line.

> **Physical phones only, resolved by model.** Every script takes `--model "Pixel 6 Pro"`
> or `--model "Pixel_3a"` and refuses to run when zero or several attached phones match.
> Never name a serial, never measure on the desktop emulator (its frame timing is the
> emulator's, not the app's), never `apt install adb` (use `~/.local/bin/adb`).
> Raw outputs go to `untracked/artifacts/38.7/<pass>/<model>/` (gitignored, never committed), never to
> Google Drive.

---

## 1. What each tool measures (and what it cannot see)

| Tool | Measures | Layer / thread it covers |
|------|----------|--------------------------|
| `sf_sampler.py` | SurfaceFlinger actual-present timestamps of the canvas layer (union of `--latency` polls every 0.5 s), presents/s, inter-present intervals, coverage holes | compositor, one layer; not app threads |
| `touch_windows.py` | owner pan (1 finger) / pinch (2 fingers) windows from `getevent`, scored by `sf_sampler` presents | compositor; touch from the touchscreen device |
| `switch_stall.py` | max inter-present gap in [row tap, tap + 2.6 s] of a System switch; Choose System open ×N | compositor + log signals |
| `tab_return.py` | tab / background return to the **first full frame** from a `screenrecord` | what is on screen (composited) |
| `thread_cpu.py` | per-thread CPU (% of one core) from `/proc/<pid>/task/*/stat` | UI thread (tid = pid), RenderThread, JS (`mqt_v_js`), GC |
| `idle_soak.py` | 5 min idle: skin + battery temperature every 30 s, CPU per 75 s window, presents (context) | thermal HAL TYPE_SKIN sensor; threads as above |
| `meminfo_d11.py` | the 38.6 D-11 memory method: `dumpsys meminfo` at T0+2/20/70 s | process PSS (Graphics, GL mtrack judged) |
| `anr_check.py` | `am_anr` (events buffer), `Davey!`, `Skipped N frames` | UI-thread signals only (a JS-thread stall is invisible here) |
| `fixture_manifest.py` | the seeded fixture's identity (see §4) | the debug build's database + photo files |

**Canvas layer note.** main draws the Orrery into a **TextureView**, so its frames present
through the app **window** layer: `VRI-com.bwales.orbit/…MainActivity#id` on the Pixel 6 Pro
(Android 13+), and the un-prefixed `com.bwales.orbit/com.bwales.orbit.MainActivity#0` on the
Pixel 3a (Android 12; its hash-prefixed `<hash> com.bwales.orbit/…#0` sibling never presents,
verified 2026-10-03). An **opaque** V2 Skia canvas is a **SurfaceView** layer
(`SurfaceView[com.bwales.orbit/…](BLAST)#id`; the highest id is the live one). `dumpsys
gfxinfo` cannot see a SurfaceView, so presents always come from SurfaceFlinger. Presents of
a window layer and of a SurfaceView layer are not the same quantity; that is why idle (G6)
is judged on temperature and CPU, not presents (§9). `sf_sampler.py --probe-layers 5` lists
every candidate layer with its present count; the sampled layer must be the one that moves.

**adb cannot drive everything.** `adb shell input swipe` is injection-rate bound and adb
cannot inject a pinch, so **pan and pinch gates come only from the owner's touch windows**
(§7). adb pans are recorded as a secondary, labelled number. `input` injection never
appears on the touchscreen's getevent stream, so a script's taps are never counted as a
touch window.

---

## 2. Preconditions

1. **Gate numbers come from a RELEASE build.** Debug runs are screening only (D-59).
2. **Build arm64-v8a only, debug then release as separate invocations** (owner, 2026-10-03):
   `gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain`, then
   `gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain`
   (desktop-build-pipeline.md otherwise). Both test phones are arm64; the four-ABI build
   does not fit droid's disk. The baseline, the spike (Plan 08) and the final pass
   (Plan 16) all use this flag so their APKs are built identically.
3. **Seed on the debug build, measure on the release build.** Install the debug APK
   (`adb -s S install -r app-debug.apk`), start Orbit Metro on host `:8082` and
   `adb -s S reverse tcp:8081 tcp:8082` (the dev client asks for :8081, which belongs to
   quest-board). Seed (§3) and record the manifest (§4), then `adb -s S install -r
   app-release.apk`. Data is kept because both APKs are signed with the prebuild debug
   keystore (desktop-build-pipeline.md §1c). **Never uninstall or clear data to resolve a
   signature mismatch** — that destroys the fixture; stop and report instead.
4. **The phone is a test phone** (synthetic data is fine there). Never touch the phone's
   Contacts app; never trigger a real AI suggestion.
5. **Sun = the user** (no Orbit Center contact) at seed time. The restore reports a sun
   that differs from the seed-time value and leaves it alone.
6. Resolve the serial once per session: `emu-connect`, then `adb devices -l`; check the
   count of `device` rows. Scripts resolve by `--model` themselves.
7. Debug builds only: dismiss the LogBox "Open debugger" toast before any tab tap (the
   scripts do it; it silently eats tab-bar taps).

## 3. The fixture (dev menu, debug build)

Open the dev menu (`adb -s S shell input keyevent 82`) and run
**"Orrery: seed perf fixture (Size cast + stress)"**. It writes, through the app's own
DAOs: the labs' shared 120-contact Size cast (custom Systems `Size 5`, `Size 10`,
`Size 20`, `Size 32`, `Size 120` = the first N cast members, member for member the labs'
`sizeSpec(i)` cast), 880 stress contacts in the custom System `Orrery Stress` (All
Contacts ≈ 1,000 with the cast), procedural photos (every cast `i % 3 == 1`, every 4th
stress member), moons, and pins the Orrery inputs (density `balanced`, satellites on, last
System `Size 120`, ring order = spec order). It logs one line:

```
orrery-seed cast=<created|present|partial> stress=<…> allContacts=<n> spec=<SEED_SPEC_VERSION> offsetDays=<n>
```

Read it from **both** `adb logcat -s ReactNativeJS` and the Metro output **by delta**
(capture, run, diff — never a presence test; stale lines exist). `created`/`present` with
no `problems=` is good. **`partial` is a stop-and-report** (the fixture was interrupted or
altered; nothing further was written). The seed is idempotent but never trusts a name: a
`present` part was verified member by member.

## 4. The fixture rule (same data as the baseline)

Status is derived at query time from today's date, so seeded data **ages**; later debug
passes also change photos, satellites and ring order. Before ANY comparable measurement
after the baseline:

1. **Baseline (once per phone):** on the debug build, right after seeding,
   `python3 scripts/dev/orrery-perf/fixture_manifest.py --model "<model>" --record --as-of <YYYY-MM-DD> --out <dir>/fixture-manifest.json`.
   It pulls `files/SQLite/orbit.db` (+ `-wal`, `-shm`) and `files/avatars/` with
   `run-as com.bwales.orbit` and records: contact counts, every custom System's members,
   each seeded contact's interval, rarely-responds, last contact, days since as of
   `--as-of` and the common `offset_days`, each photo's presence/size/dimensions/SHA-256,
   `SEED_SPEC_VERSION` and the commit, the four Orrery settings, and the ring order + its
   hash. Copy it into the repo where the plan says (synthetic data only).
2. **Every later session:** install the debug build (`install -r`), write the baseline
   session's offset (its manifest's `offset_days`) for the restore to use:

   ```bash
   echo '{"offsetDays": <baseline offset_days>}' | ~/.local/bin/adb -s S shell \
     "run-as com.bwales.orbit sh -c 'mkdir -p files/orrery-perf && cat > files/orrery-perf/reanchor.json'"
   ```

   then run **"Orrery: restore perf fixture (photos + re-anchor)"** from the dev menu. It
   rewrites the spec photos (and removes photos the spec lacks), resets density,
   satellites, last System and the ring order, re-anchors every seeded touchpoint to the
   offset through the single recency writer, verifies, and logs
   `orrery-fixture ok=<bool> offsetDays=<n> problems=<…>`. `ok=false` is a stop-and-report.
3. `fixture_manifest.py --model "<model>" --compare <baseline manifest> --as-of <today>`
   must print `fixture compare: IDENTICAL` and exit 0 **before** the release APK is
   installed and measured. Any `DIFF` line is a stop-and-report.
4. Record each session's local date and offset in the pass document's Sessions table.
   A session that crosses local midnight re-runs steps 2-3 (the offset moved by a day).
5. For the rest of a pass, never change density, satellites, the sun or the ring order by
   hand. The scripts switch Systems, which changes only `orrery_last_system` (the restore
   resets it).

## 5. Phone prep (every session, before every scenario)

- Battery **≥ 50 %**, USB connected (`idle_soak.py` refuses below 50 %).
- **Cool-down:** before each idle soak and before each D-11 cold start, wait until the skin
  temperature is within **1.0 °C** of the first run's start temperature (`idle_soak.py
  --reference-start-temp` enforces it for soaks).
- **Stay awake and screen timeout:** `idle_soak.py` records, sets and restores them itself.
  For other scenarios keep the screen on (touch nothing between scripts).
- **Brightness:** do not change it; note the level (`settings get system screen_brightness`)
  in the session record.
- **Any setting you change, record its old value and restore it** at the end of the session.
- Theme: the phone's current theme, unchanged for the whole pass; record which.
- The Orrery at **Home** (Recenter, no focus) with the System under test selected and
  settled (wait 5 s after a switch) unless the scenario says otherwise.

## 6. Scenario matrix (per phone; 3 runs each; report the median)

| # | Scenario | System(s) | Command | Judged value |
|---|----------|-----------|---------|--------------|
| 1 | Owner pan window | Size 120, All Contacts | `touch_windows.py --calibrate --session "Size 120,All Contacts" --reps 3 --timeout-per-segment 600` | median presents/s per label (§7) |
| 2 | Owner pinch window | Size 120, All Contacts | same session | median presents/s per label |
| 3 | Recenter (adb) | Size 120, All Contacts | `recenter_pan.py --recenter --runs 3`: pan away with `input swipe`, sampler started 1 s before a touchscreen tap on the "Recenter Orrery" control's bounds; presents in the 2 s from the tap | median presents/s over [tap, tap + 2 s] |
| 4 | adb pan (secondary, injection-bound) | Size 120, All Contacts | `recenter_pan.py --adb-pan --runs 3`: the sampler runs while 5 `input swipe` pans run | median presents/s, labelled "adb pan" |
| 5 | Switch stall | Size 5 ↔ Size 120; Size 120 ↔ All Contacts | `switch_stall.py --from A --to B --runs 3` (alternates direction) | max inter-present gap (ms) in [tap, tap + 2.6 s] |
| 6 | Tab return | Size 120, All Contacts | `tab_return.py --runs 3 --out-dir …` | total = tap → first full frame (s) |
| 7 | Background return | Size 120, All Contacts | `tab_return.py --background --runs 3 --out-dir …` | total (s) |
| 8 | Choose System open ×3 + ANR | the System on screen | `switch_stall.py --open-selector 3` | `am_anr` for Orbit = 0 |
| 9 | Idle soak, 5 min, Home, Orrery visible | Size 120, then All Contacts | `idle_soak.py --seconds 300 [--reference-start-temp T]` | skin/battery start/end/max; per-thread CPU |
| 10 | D-11 memory, cold | All Contacts, default view | `meminfo_d11.py --run cold` ×3, then `--summarise` | Graphics, GL mtrack medians (§9) |
| 11 | D-11 memory, churn | from cold start: 5 × (Size 5 → Size 120 → All Contacts) + 5 tab returns, ending on All Contacts | `meminfo_d11.py --run cold --pre-steps churn` ×3 | as 10 |
| 12 | D-11 memory, background | Home key, 30 s in the background, relaunch = T0 | `meminfo_d11.py --run cold --pre-steps background` ×3 | as 10 |

Also record display facts once per phone: `dumpsys display` (supported refresh rates,
active mode) and the idle refresh SurfaceFlinger shows while the Orrery sits still.

**Three runs and the median** for every scenario; a run with a non-number outcome (§8) is
re-recorded, never dropped silently and never counted.

## 7. Owner touch windows (scenarios 1-2)

Start `touch_windows.py` in the background on each phone (it waits for the owner) with the
Orrery at Home on `Size 120`. The owner, on each phone:

1. Taps **once on empty sky**, lifts, waits 2 s (clock check, below).
2. Three times: pans with **one** finger ~10 s, pauses 3 s, pinches in and out with **two**
   fingers ~10 s, pauses 3 s.
3. Puts the phone down for 5 s. **The script switches to `All Contacts` itself** (the owner
   never uses the selector during a recording); when it has settled, repeats step 2.

How the script labels: a segment starts 3 s after the script's own switch tap; windows
are `{System}/{pan|pinch}/r{1-3}` by order; any other order, a missing or extra window, or
a stray touch (< 1 s, or 3+ fingers) makes the segment **`unlabelled`** and it is
re-recorded. A label is a number only from **3 valid repetitions**.

**Clock alignment.** getevent and SurfaceFlinger must share CLOCK_MONOTONIC. `--calibrate`
proves it on the device: if `dumpsys input` prints the touch-down's `eventTime=` it
compares directly (|offset| ≤ 2 ms = aligned; a stable offset needs `--calibration-taps 3`
and is applied); **production builds print only `MotionEvent, age=…ms`** (both phones,
2026-10-03), so the fallback is **clock identity**: right after the tap it reads
CLOCK_MONOTONIC (a `logcat -v monotonic` mark) and CLOCK_BOOTTIME (`/proc/uptime`); on a
phone that has slept these differ by hours (6 Pro ≈ 279,000 s, 3a ≈ 15,000 s on
2026-10-03), so the tap timestamp's magnitude proves which clock getevent uses. Monotonic =
aligned (offset 0). Anything else (`unaligned`) and **the script refuses to label any
window**. Record the calibration method and result per phone.

## 8. Outcome rules (never converted into a number)

| Outcome | Where | Meaning | Action |
|---------|-------|---------|--------|
| `truncated` | touch window, switch, tab return | window outside the sampler's coverage, over a coverage hole, finger still down at the end; tab return with < 2 s of recording after `t_full` | re-record |
| `no-present` | touch window, switch | zero presents in a covered window | counts as 0 presents/s **only** if the sampled layer still existed at segment end; otherwise the segment is `invalid` |
| `invalid` | touch segment | no-present while the layer changed under the sampler | re-record the segment |
| `unlabelled` | touch segment | window order ≠ pan, pinch ×3, or a stray touch | re-record the segment |
| `insufficient` | touch label | fewer than 3 valid repetitions | re-record |
| `no-full-frame` | tab return | the settled content level is never held | re-record; if it repeats, stop and report |
| `no-canvas-change` | tab return | the canvas never departs from the first Orrery frame (complete instantly, or never drawn) | check the saved strip by eye; stop and report (the method must be extended before it can give a number) |

## 9. Gate rules

- **G1/G2 (pan, pinch, Recenter presents):** owner-window label medians (§7) and the
  Recenter median, at Size 120 and All Contacts. adb pan is reported separately.
- **G3 tab return:** tap → **first full frame** (D-56 wording), `tab_return.py` `total`.
  The detector scores each canvas frame's content against the blank pre-mount frame and
  takes the first frame at ≥ 95 % of the settled level (median of the last 2 s) that never
  falls below 90 % afterwards; it never compares against the final frame, which ambient
  motion keeps changing. Reported with its decomposition: screen (tap → Orrery header),
  mount (header → canvas departs; today the scene reload + canvas mount), fill (canvas →
  full frame). `t_photos` is context, not G3.
- **G4 no ANR:** `am_anr` for `com.bwales.orbit` = 0 in every scenario at Size 120 and All
  Contacts (hard).
- **G5 switch stall:** max gap ≤ 100 ms (6 Pro) / ≤ 150 ms (3a) in every run (hard).
- **G6 idle (D-40):** judged on **skin and battery temperature** (start/end/max) and
  **per-thread CPU** (UI thread, RenderThread, JS, total) against the baseline;
  presents/s is **context only** (window layer vs SurfaceView are not comparable).
- **G7 memory (D-58):** the **38.6 D-11 method**: Graphics and GL mtrack medians at peak
  (T0+2 s), settled (T0+20 s) and late (T0+70 s), each **≤ 5 %** over the baseline
  (`meminfo_d11.py --summarise <runs> --reference <baseline summary>`); Native Heap,
  TOTAL PSS and EGL mtrack are reported only. Cold, churn and background sets each.
- **G8 feel:** owner device checkpoints (the 3a usable, the 6 Pro smooth).

The numeric thresholds above are the D-56 starting targets and hard gates; the owner locks
the exact numbers after the baseline (Plan 02). Locked gates live in `38.7-BASELINE.md`.

## 10. First-recording validation, then the freeze

Before the FIRST number of the baseline is recorded, on each phone:

1. `sf_sampler.py --probe-layers 5` during an adb pan: the detected layer is the one whose
   present count moves (window layer on main).
2. **Tab return:** one `tab_return.py` run at Size 120 and one at All Contacts; open the
   saved strip (`*-tfull-before/at/after.png`): the frame at `t_full` shows the complete
   scene and the frame before does not. `t_full` must agree with this hand check **within
   one frame**.
3. **Clock alignment:** the owner session's calibration (§7) is `aligned` (or a recorded
   stable offset was applied). Record the method per phone.

If any check fails: fix the tool, re-run `selftest.py`, commit the fix with a Changelog
line below, and only then record numbers.

**The method is frozen once the first baseline number is recorded.** Plan 08 and Plan 16
use it unchanged. Any change to a script's measurement logic or to this runbook's
procedure after that **requires re-measuring the baseline** with the changed method.

## 11. Results table format (BASELINE and final documents)

One section per phone (`## Pixel 6 Pro`, `## Pixel 3a`), one subsection per scenario,
**medians first, then the three runs, then the raw file names**, and for every number the
layer or thread it covers:

```markdown
### Switch stall
| Direction | Run 1 | Run 2 | Run 3 | Median | Layer | Outcome notes |
|-----------|------:|------:|------:|-------:|-------|---------------|
| Size 5 → Size 120 | `<ms>` | `<ms>` | `<ms>` | `<ms>` | `<layer kind + name>` | `<valid / outcome per run>` |
Raw: `untracked/artifacts/38.7/baseline/Pixel_6_Pro/switch-5-120.json`
```

Gate summary rows: `| Gate | Phone | Baseline | Proposed / locked | Method ref |`.

---

## 12. Locked gates and how 38.7 closed against them

The owner locked the numeric gates after the Day-1 baseline (2026-10-03, CONTEXT D-63;
`38.7-BASELINE.md` § Locked gates), then retired the Pixel 3a gates (D-66). The live set is
the **Pixel 6 Pro**:

- **G1:** pan, pinch and Recenter at a median of ≥ 55 presents/s at Size 120; pan and
  pinch ≥ 45 presents/s at All Contacts.
- **G3:** tab return to the first full frame ≤ 1.0 s at Size 120 and All Contacts.
- **G4:** no `am_anr` and no crash (hard).
- **G5:** switch stall ≤ 100 ms (Size 5 ↔ 120, Size 120 ↔ All Contacts; hard).
- **G6:** idle soak ≤ baseline + 0.5 °C, and CPU ≤ baseline × 1.10.
- **G7:** Graphics/GL ≤ baseline + 5 % at settled and late.
- **G8:** the owner feels it smooth.

The **Pixel 3a** gets one release smoke check only: Size 120 and All Contacts open, with no
crash or ANR.

Plan 16 used this method unchanged. Results a later pass must not misread as passes are
listed below; the full gate table is in `38.7-PHASE-END-REPORT.md`.

- **Accepted by the owner, not passed (D-79):** G3 All Contacts 1.008 s; G5 Size 120 ↔
  All Contacts 174.7 ms; G7 Graphics/GL growth from the opaque canvas and the base bake.
  TOTAL PSS fell 26–31 %.
- **Accepted as a warm-start artefact (D-80 T-1):** the G6 Size 120 temperature. CPU passed
  (11 % vs 34 %).
- **Not measured (the owner declined further testing):** the G1 owner touch windows, the
  G8 recorded-window ratings, the portrait scenario, the D-11 churn set, and a post-fix
  G1 Recenter number.

Pitfalls from the final pass:

1. **The §5 cool-down margin is wider than the G6 margin.** The cool-down allows a start
   within 1.0 °C, while G6 allows only + 0.5 °C at the end and maximum. The 38.7 Size 120 soak
   started +0.83 °C warm, inside the cool-down rule, and failed G6 although it cooled 1.1 °C
   during the run. For a G6 judgement, start as close to the baseline start as you can.
2. **The frame-rate vote changes what presents/s means.** At idle, V2 votes 30 Hz on its
   SurfaceView (60 Hz panel, rendering at 30) and votes the panel's top rate during motion
   (ADR-186). Idle presents/s stay context only.
3. **Animations-on idle CPU has no main baseline.** Main was soaked with animations off. The
   V2 animations-on figure (about two thirds of a core) is context for the D-80 CPU-1 todo,
   not a gate.

## Changelog

- **2026-10-03** — Created (38.7 Plan 01). Method frozen at the first baseline number
  (Plan 02). Grounded on the phones the same day: Android 12 (Pixel 3a) presents main's
  window through the un-prefixed `<pkg>/<activity>#0` layer; production `dumpsys input`
  has no `eventTime`, so calibration uses the clock-identity fallback; `screenrecord`
  writes frames only on change and leaves the MP4 duration unset, so tab return takes the
  recording end from the recorder's time limit (15 s, long enough for main's ~5 s scene
  reload plus the 2 s settle window).
- **2026-10-03** — Before any baseline number (38.7 Plan 02): APKs for every pass are built
  **arm64-v8a only** (`-PreactNativeArchitectures=arm64-v8a`, debug and release as separate
  Gradle invocations), owner ruling after the four-ABI build ran droid out of disk. Both
  test phones are arm64, so the code under measurement is unchanged. §2 item 2.
- **2026-10-03** — Before any baseline number (38.7 Plan 02), UI helpers fixed against the
  release build's real tree: tabs are labelled `"<icon glyph>, <title>"` (not React
  Navigation's `"<title>, tab, i of n"`), so `find_tab` no longer hits the screen header
  and `tab_return.py` finds the tab bar; the System selector is awaited before rows are
  searched and each collapsed group is expanded once; the sheet is closed with its own
  close button, never the same-labelled full-screen backdrop (whose centre lies over the
  System rows); `uiautomator dump` misses during an animation are retried. No measurement
  logic changed. `selftest.py` 25/25 with release-tree fixtures.
- **2026-10-03** — Before any baseline number (38.7 Plan 02), Pixel 3a timeouts: opening the
  System sheet stalls its UI thread ~3 s (`Skipped 168 frames`), and `uiautomator dump`
  answers "null root node" for ~10 s after a switch. The sheet wait is 10 s and UI dumps
  retry for up to 30 s. Tap timestamps are taken at the tap itself, so no timing changed.
- **2026-10-03** — First-recording validation (§10.2) FAILED and the tab-return tool was fixed
  before any baseline number (38.7 Plan 02):
  1. `decode()` let ffmpeg's rawvideo output resample to a constant rate (`dup=16 drop=16`
     on a 6 Pro recording), so pixel data no longer matched its timestamps and `t_full`
     came out 1.4 s where the hand check shows 8.4 s. Decoding is now `-fps_mode
     passthrough` and refuses to proceed if raw frames and timestamps disagree.
  2. Canvas content is scored on fine structure (each pixel minus its 3×3 mean), so a
     smooth sky backdrop painted before the scene never counts as the full frame. The
     95 % reach / 90 % hold rule over the last-2-s settled level is unchanged.
  3. Recordings are 60 s (were 15 s): main's tab return takes ~8 s on the 6 Pro and longer
     than 15 s on the 3a, where the scene reload stalls the UI thread ~13 s.
  4. Hand-check strips are cut by frame index (a `-ss` seek to a frame's own time can
     land on the next frame).
  `selftest.py` 27/27, including a backdrop-first scene and a variable-rate decode check.
- **2026-10-03** — Before any baseline number (38.7 Plan 02), scene-load hygiene (owner
  guardrail: one honest tool fix, then record what main cannot do). Today's release build
  crashed (SIGSEGV on the JS thread, `mqt_v_js`) on both phones when a large System (All
  Contacts, Orrery Stress) was switched to through the selector, and once raised `am_anr`
  in the sheet with no UI dump running. The tools now (a) tap a scene-loading control
  (System row, tab) only after 10 s with no `uiautomator dump`
  (`adb_device.A11Y_QUIET_S`), (b) take no UI dump during a fixed post-load dwell (6 Pro
  20 s, 3a 60 s; `SETTLE_LOAD_S`), because no load-complete signal exists on main without
  accessibility: a stalled UI thread also leaves the screen still, and today's Orrery keeps
  the UI thread busy at rest (6 Pro ~32 %, 3a ~98 % of a core); (c) tab return taps tabs
  from bounds found once before the runs; (d) UI dumps retry for up to 90 s (the 3a's busy
  UI thread). With these, switching to All Contacts still crashed the 6 Pro (while a
  selector group was expanding), so switch-dependent scenarios at All Contacts / Orrery
  Stress are recorded as not measurable on main (see 38.7-BASELINE.md).
- **2026-10-03** — Before any baseline number: rows 3-4 are scripted as `recenter_pan.py`
  (the same procedure, with the tap/swipe instants mapped onto SurfaceFlinger's clock in-process).
- **2026-10-03** — Method change AFTER the first baseline number (38.7 Plan 02), so the
  affected numbers were re-measured: the background-return check showed main first shows
  its stale scene snapshot, then blanks the canvas, then redraws (6 Pro), and the detector
  took the stale snapshot as its "blank" reference (`no-canvas-change`). Canvas content is
  now the ABSOLUTE share of fine-structure pixels per frame (no reference frame); t_blank is
  the least-content frame before t_full; the 95 % reach / 90 % hold rule is unchanged and
  excludes a stale snapshot that later blanks. Every tab- and background-return number in
  38.7-BASELINE.md comes from `reanalyse_tab_return.py` over the identical saved
  recordings with this detector (tab-return totals reproduced exactly; background return
  became valid). `selftest.py` 28/28 (background stale-snapshot case added).
- **2026-10-03** — System-sheet wait 90 s (Pixel 3a: 22-33 s to open the sheet on main);
  a timeout only, no measurement change.
- **2026-10-03** — `touch_windows.py` waits up to 4 h for the owner's calibration tap (was
  30 min): the samplers are started before the owner checkpoint is presented. Timeout only.
- **2026-10-03** — 38.7 Plan 08 (spike, before any spike number): the System sheet now
  opens with its groups collapsed (Built-in, Categories, Custom Systems), and
  `select_system` tapped every collapsed header from ONE UI dump; expanding the first
  moved the others, so the second tap landed on a System row and selected it (the sheet
  closed mid-search). It now expands one group per fresh dump (loop budget widened by 8
  passes). Navigation only: no measurement logic changed. `selftest.py` 28/28.
- **2026-10-03** — 38.7 Plan 08 (spike): on the Pixel 3a with All Contacts current, the expanded
  Built-in group pushes "Custom Systems" to the clipped bottom edge of the sheet and a tap on its
  clipped centre missed. `select_system` now taps only fully visible group headers (≥ 60 px tall,
  `MIN_HEADER_TAP_PX`) and scrolls otherwise. Navigation only; `selftest.py` 28/28. Known limit: the 3a
  could still not be driven back from All Contacts by the helper (done by hand); see 38.7-SPIKE.md.
- **2026-10-05** — 38.7 Plan 16 release pass ran the method unchanged. §12 records the locked
  gates (D-63), the 3a retirement (D-66), the owner acceptances (D-79, D-80) and the
  unmeasured windows (KB extraction).
