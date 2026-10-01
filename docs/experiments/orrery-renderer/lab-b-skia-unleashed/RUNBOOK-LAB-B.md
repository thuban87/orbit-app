# Runbook — Orrery Lab B (Skia Unleashed) build / device loop

Branch `experiment/orrery-skia-unleashed`, worktree `/home/bwales/projects/orbit-orrery-lab-b`.
Target: the **Android emulator on droid** (owner's Windows desktop) through a **private adb
tunnel on port 5039**. Lab A concurrently owns the Pixel, the local adb server on 5037 and
Metro 8081–8083 — never touch any of those.

| Thing | Value |
|---|---|
| App package | `com.bwales.orbit.labb` (launcher label "Orrery Lab B") — side-by-side with `com.bwales.orbit` |
| adb | `~/Android/Sdk/platform-tools/adb` (v37) — **always** `-P 5039` (or `ADB_SERVER_PORT=5039`) |
| Emulator | `emulator-5554`, `sdk_gphone16k_x86_64`, API 37 (Android 17), 1280x2856 @ 480dpi, 4 vCPU, 4 GB, host GPU (GLES 3.0 translator over Intel Arc B580) |
| Metro | this box, port **8084**, tmux session **`orbit-lab-b`** |
| droid build dir | `C:\Users\bwales\projects\orbit-lab-b` (never `orbit-app` or `orbit-lab-a`) |
| Busy probe | `docs/experiments/orrery-renderer/lab-b-skia-unleashed/tools/droid-busy.sh` |
| Evidence | `docs/experiments/orrery-renderer/lab-b-skia-unleashed/evidence/` |

Shell helpers used below (paste once per shell):

```bash
LB=/home/bwales/projects/orbit-orrery-lab-b
ADB="$HOME/Android/Sdk/platform-tools/adb -P 5039 -s emulator-5554"
DEST='C:\Users\bwales\projects\orbit-lab-b'
PKG=com.bwales.orbit.labb
```

**Never** run `emu-connect` (except `emu-connect status`), never run a bare `adb` (that hits 5037 =
Lab A's Pixel), never kill an adb server / Metro / Gradle daemon you did not start, never
`git worktree`, never push, never upload to Drive.

---

## 1. Tunnel (adb 5039 + Metro 8084)

```bash
# Is it already up?
pgrep -af "ssh -f -N .*-L 5039:127.0.0.1:5037"
# Bring it up (local 5039 -> droid adb server 5037; droid 8084 -> Metro here)
ssh -f -N -o BatchMode=yes -o ExitOnForwardFailure=yes -o ConnectTimeout=15 \
    -o ServerAliveInterval=30 -L 5039:127.0.0.1:5037 -R 8084:127.0.0.1:8084 droid
# MUST list exactly the emulator. If anything else shows (e.g. the Pixel), STOP.
~/Android/Sdk/platform-tools/adb -P 5039 devices -l
```

If the emulator is not listed: check on droid with
`ssh droid 'tasklist /fi "imagename eq qemu-system-x86_64.exe"'`. It is normally left running by
the owner (emu-connect never starts it; it only tunnels to it). Starting it is the owner's call.

## 2. Metro on 8084 (tmux `orbit-lab-b`)

```bash
tmux has-session -t orbit-lab-b 2>/dev/null || \
  tmux new-session -d -s orbit-lab-b -c $LB \
    "CI=1 npx expo start --dev-client --port 8084 2>&1 | tee -a /tmp/orbit-lab-b-metro.log; exec bash"
curl -s localhost:8084/status            # -> packager-status:running
ssh droid "curl -s http://127.0.0.1:8084/status"   # same, through the -R tunnel
```

**Gotcha — inotify exhaustion (why `CI=1`).** This box's `fs.inotify.max_user_watches` is 65536
and the other Metros + VS Code servers already hold ~62k. A watching Metro needs ~6.9k and dies
with `ENOSPC: System limit for number of file watchers reached`. `CI=1` runs Metro **without a
file watcher**: it serves bundles fine but does **not** see edits. So after a JS edit:

```bash
tmux kill-session -t orbit-lab-b      # ours only
# re-run the tmux line above, then reload the app (section 6)
```

Owner-side permanent fix (not applied; needs sudo): `sudo sysctl fs.inotify.max_user_watches=524288`.
Once raised, drop `CI=1` and fast-refresh works normally.

The "React Native DevTools ... SUID sandbox" error in the Metro log is harmless.

## 3. Point the dev client at Metro (10.0.2.2:8084 — NOT adb reverse)

**Gotcha:** on the emulator the RN dev client defaults to **`10.0.2.2:8081`** (the emulator's
alias for droid's loopback), not `localhost:8081`, so `adb reverse` is ignored. And
`adb reverse tcp:8081 tcp:8084` through droid's adb server connects but returns nothing (tested
with `toybox nc`). What works: `10.0.2.2:8084` → droid 127.0.0.1:8084 → SSH `-R` → Metro here.
Set it in the app's dev prefs (debug build, `run-as`), **after every `pm clear` / fresh install**:

```bash
printf '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<map>\n    <string name="debug_http_host">10.0.2.2:8084</string>\n</map>\n' > /tmp/labb-prefs.xml
$ADB push /tmp/labb-prefs.xml /data/local/tmp/labb-prefs.xml
$ADB shell am force-stop $PKG
$ADB shell "run-as $PKG sh -c 'mkdir -p shared_prefs && cat /data/local/tmp/labb-prefs.xml > shared_prefs/${PKG}_preferences.xml'"
# verify the path from inside the emulator:
$ADB shell 'printf "GET /status HTTP/1.0\r\nHost: x\r\n\r\n" | toybox nc -w 5 10.0.2.2 8084 | tail -1'   # packager-status:running
```

A `tcp:8081 tcp:8084` reverse is also set (harmless); leave it.

## 4. Sync source to droid (tar-over-ssh; droid has no rsync)

```bash
cd $LB
ssh droid 'if exist "C:\Users\bwales\projects\orbit-lab-b" (echo PRESENT) else (echo ABSENT)'
# first time: ssh droid "mkdir \"$DEST\""
tar -czf - --exclude=./node_modules --exclude=./android --exclude=./ios --exclude=./.git \
    --exclude=./.expo --exclude=./.planning --exclude=./docs . \
  | ssh -o BatchMode=yes droid "tar -xzf - -C \"$DEST\""
```

Overwrites changed files; leaves droid's `node_modules`/`android` alone. Files deleted locally
are NOT deleted on droid (no mirror) — remove them by hand if it matters.

## 5. Check for concurrent builds, then build (droid)

```bash
$LB/docs/experiments/orrery-renderer/lab-b-skia-unleashed/tools/droid-busy.sh; echo "exit=$?"
# exit 0 = IDLE, 1 = BUSY, 2 = probe failed (treat as busy). Wait loop:
until $LB/docs/experiments/orrery-renderer/lab-b-skia-unleashed/tools/droid-busy.sh >/dev/null; do sleep 180; done
```

The probe uses PowerShell (`Get-Process` + `Win32_Process` command lines, CPU sampled twice 5 s
apart). `wmic` is NOT installed on droid — any wmic-based check always looks idle. BUSY when a
gradle-wrapper JVM or a `gradlew` cmd launcher exists, or a GradleDaemon / worker / kotlin daemon
burned >= 0.5 s CPU in the window. An idle leftover daemon (flat CPU) counts as idle. Verified to
report BUSY during a live Lab B `assembleDebug`. Never kill anything it lists.

Only when IDLE:

```bash
# (a) only if package.json / package-lock changed (or first time)
ssh -o BatchMode=yes droid "cd /d \"$DEST\" & npm ci"
# (b) only if app.config.ts / app.json / plugins / native deps changed (or first time)
ssh -o BatchMode=yes droid "cd /d \"$DEST\" & set \"CI=1\" & npx expo prebuild --platform android --clean --no-install"
ssh droid "findstr /n applicationId \"$DEST\\android\\app\\build.gradle\""   # must say com.bwales.orbit.labb
# (c) debug build. x86_64-only is much faster for the emulator:
ssh -o BatchMode=yes droid "cd /d \"$DEST\\android\" & gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64 --console=plain"
```

`set "CI=1"` must be quoted (cmd.exe captures trailing spaces otherwise). First 4-ABI debug build:
10.5 min and a **347 MB** APK that fails to install (`INSUFFICIENT_STORAGE`; emulator /data has
~780 MB free). Always pass `-PreactNativeArchitectures=x86_64` → 110 MB APK, incremental rebuild
~30 s.

## 6. Pull, install, launch

```bash
scp -o BatchMode=yes "droid:C:/Users/bwales/projects/orbit-lab-b/android/app/build/outputs/apk/debug/app-debug.apk" /tmp/orbit-lab-b-debug.apk
$ADB install -r /tmp/orbit-lab-b-debug.apk            # -r keeps app data
$ADB shell monkey -p $PKG -c android.intent.category.LAUNCHER 1
# Reload JS without reinstalling (after restarting Metro for a JS change):
$ADB shell am force-stop $PKG && $ADB shell monkey -p $PKG -c android.intent.category.LAUNCHER 1
```

**Rebuild rule.** JS/TS-only change (renderer, components, shaders as SkSL strings) → **no APK
rebuild**: restart Metro (CI mode) + force-stop/relaunch. Rebuild only for `app.config.ts`,
`package.json` / native deps, `plugins/`, `modules/`, or anything under `android/`.

A fresh install (or `pm clear`) needs §3's prefs file before launch, otherwise it redboxes
"Unable to load script".

## 7. Seed synthetic data

Automatic. `src/__dev__/lab-b-seed.ts` runs once after DB migration on any **`__DEV__` build
whose applicationId is `com.bwales.orbit.labb`** (it no-ops in the real app and in release). It
seeds through the real DAOs: 140 contacts with varied cadences and 0–24 interactions (all gravity
tiers, mixed recency), 71 photos — 30 of them the fictional test portraits from
`assets/test-portraits/` (WP-1.4; fetched from Metro, dev bundle only, see §10) and the rest
procedural Skia-rendered JPEGs — ~75 unlinked relationships on
30 contacts (satellites), and Systems **Lab B Dense** (120 members), **Lab B Inner Circle** (12),
**Lab B Work** (30). Idempotent (skips when "Lab B Dense" exists). Logs
`[lab-b-seed] seeded contacts=… photos=… satellites=… in …ms` to logcat (`ReactNativeJS`).

```bash
$ADB logcat -d -s ReactNativeJS | grep lab-b-seed
# Reset to a fresh seed (then redo §3 prefs before launching!):
$ADB shell pm clear $PKG
# Peek at the DB (debug build only; the emulator has no sqlite3 binary). Pull all three
# WAL files, then read the copy with node:sqlite (WAL-aware):
mkdir -p /tmp/lab-b-db && for f in orbit.db orbit.db-wal orbit.db-shm; do
  $ADB exec-out "run-as $PKG cat files/SQLite/$f" > /tmp/lab-b-db/$f; done
node -e 'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync("/tmp/lab-b-db/orbit.db");
console.log(d.prepare("select (select count(*) from contacts) c,(select count(*) from systems) s,(select count(*) from relationships) r").get())'
```

## 8. Screenshots, UI tree, recordings, gfxinfo

```bash
EV=$LB/docs/experiments/orrery-renderer/lab-b-skia-unleashed/evidence
$ADB exec-out screencap -p > $EV/00-baseline/name.png
$ADB shell uiautomator dump /sdcard/ui.xml && $ADB pull /sdcard/ui.xml /tmp/lab-b-ui.xml
grep -o 'text="[^"]*"\|content-desc="[^"]*"\|bounds="[^"]*"' /tmp/lab-b-ui.xml | paste - - | head
$ADB shell input tap X Y          # RN Pressables
$ADB shell input touchscreen tap X Y   # gesture-handler buttons (FAB, gear)
$ADB shell input swipe X1 Y1 X2 Y2 300  # pan
# Screen recording (max 180 s; stop with Ctrl-C or --time-limit):
$ADB shell screenrecord --time-limit 15 --bit-rate 8000000 /sdcard/lab-b.mp4
$ADB pull /sdcard/lab-b.mp4 $EV/<dir>/clip.mp4 && $ADB shell rm /sdcard/lab-b.mp4
# Frame stats (UI/RenderThread only; JS-thread jank is invisible here):
$ADB shell dumpsys gfxinfo $PKG reset
#   ... interact ...
$ADB shell dumpsys gfxinfo $PKG | sed -n '1,40p'
$ADB shell dumpsys meminfo $PKG | head -30
```

- `uiautomator dump` fails with "null root node" while the Orrery animates (it waits for idle).
  Dump on other screens, or read coordinates from a screenshot (screencap is 1280x2856 native).
- LogBox "Open debugger to view warnings" toast covers the tab bar; dismiss its X (~1184,2639)
  first. Orrery tab ≈ (896,2690). System selector chip ≈ (240,430). FAB-column buttons
  (list / recenter / north) are gesture-handler buttons → `input touchscreen tap`.
- Tapping a body opens the companion panel ("Focus in Orrery"); the camera fly-in takes ~2–4 s,
  so wait before capturing.
- Pinch zoom cannot be injected with `input` (single pointer only). Zoomed states come from
  focus fly-ins; a debug zoom hook would be needed for arbitrary zoom levels.

**Perf caveat.** This is an emulator with a GLES-translator onto a desktop GPU. Frame timings are
**not** device performance; use them only for relative A/B on the same target, and say so.

## 9. Teardown (only when nobody needs the target any more)

```bash
$ADB reverse --remove tcp:8081
tmux kill-session -t orbit-lab-b
pkill -f "ssh -f -N .*-L 5039:127.0.0.1:5037"       # ONLY our tunnel pattern
# optional: $ADB uninstall $PKG ; ssh droid "rmdir /s /q \"$DEST\""
```

## 10. Release (non-debug) build for evidence and perf (WP-1.4)

Performance claims and M1 evidence come from a **release** APK: Hermes bytecode, minified,
`__DEV__ = false`, no dev menu / LogBox / Metro. The FX panel and FPS HUD stay reachable
because they are gated on the applicationId, not `__DEV__` (C-08): long-press "LAB B".

**Seeding.** The seed (and the test portraits it pulls from Metro) only runs in a DEBUG build:
`App.tsx` requires `@/__dev__/lab-b-seed` inside `if (__DEV__)`, and Metro constant-folds that
branch away before collecting dependencies in a release bundle. So: seed on the debug APK, then
install the release APK over it with `install -r`. **Verified 2026-10-01 that this keeps the
data**: `assembleRelease` on the Expo-prebuilt project signs with the same `debug.keystore` as
`assembleDebug` (`android/app/build.gradle` `signingConfigs.debug` for both), so the
certificates match and `install -r` is an in-place update. No lab-only release flag was needed.

```bash
# 1. Seed on DEBUG (fresh): pm clear + §3 prefs + launch the debug APK; wait for
#    "[lab-b-seed] seeded ... portraits=30 ..." in logcat (§7). Turn on Settings > Orrery >
#    Relationship Satellites if the run needs moons (pm clear resets it to off).
# 2. Busy check (§5), sync (§4), then build RELEASE, x86_64 only (~5 min clean, droid):
ssh -o BatchMode=yes droid "cd /d \"$DEST\\android\" & gradlew.bat assembleRelease -PreactNativeArchitectures=x86_64 --console=plain"
scp -o BatchMode=yes "droid:C:/Users/bwales/projects/orbit-lab-b/android/app/build/outputs/apk/release/app-release.apk" /tmp/orbit-lab-b-release.apk
# 3. Same signer as the debug APK? (both print the same SHA-256)
AS=$(ls -d ~/Android/Sdk/build-tools/*/ | tail -1)apksigner
$AS verify --print-certs /tmp/orbit-lab-b-release.apk | grep -m1 SHA-256
$AS verify --print-certs /tmp/orbit-lab-b-debug.apk   | grep -m1 SHA-256
# 4. Install OVER the seeded debug app (keeps the DB + avatars/), launch:
$ADB shell am force-stop $PKG && $ADB install -r /tmp/orbit-lab-b-release.apk
$ADB shell dumpsys package $PKG | grep -m1 "flags=\["      # no DEBUGGABLE => release
$ADB shell monkey -p $PKG -c android.intent.category.LAUNCHER 1
```

Release APK (x86_64): ~84 MB (debug 110 MB). It needs no Metro and no `debug_http_host`.

**Fixtures never ship — how it was checked.** droid's source copy excludes `docs/` (§4), so a
release bundle that tried to resolve the portrait `require`s would fail to build; it built.
Then, on the APK: `unzip -l app-release.apk | grep -c jpg` under `res/drawable*` = 0, and the
Hermes bundle (`assets/index.android.bundle`) contains no `lab-b-seed`, `Lab B Dense` or
`registerUatProbes` strings, while it does contain `labb-fx-panel` (panel present).

**Caveats.** `run-as` does not work on the release install (not debuggable), so DB peeks need the
debug APK again (`install -r` the debug APK back; data is kept the same way). Going back to debug
also needs the §3 prefs only after a `pm clear`. Panel state (renderer, flags, reduced-motion
override) is session-only and resets on app restart. `uiautomator dump` still fails while the
Orrery animates; drive the panel from screenshots (panel chip coordinates at 1280x2856, panel
unscrolled: Lab 126,1396 · Legacy 300,1396 · Far 158,1582 · Overview 406,1582 · Identity
692,1582 · Detail 966,1582 · Near 156,1684 · RM On 380,2158 · RM Follow OS 188,2158 · All
Contacts 210,2346 · Lab B Dense 888,2546 · Close 1132,1198 · Reset 956,1198). Recentre =
`input touchscreen tap 1150 2140`. Panning: `input swipe` in the canvas works but carries
fling momentum (distance not repeatable); never start a swipe within ~150 px of the left edge
(it triggers system Back).

**Debug-build blank canvas (seen once).** Right after a reseed, while droid was running the
release Gradle build, the DEBUG app showed an empty Orrery canvas for >1 min with
`updateTexImage: LegacySurfaceTexture is not attached!` spam from RNSkia. The release build
rendered normally on the same data. Not reproduced or diagnosed further (suspected host
contention + debug JS); if it recurs, relaunch the app after the host is idle.

## Gotchas hit while bringing this up

- **Dev client uses 10.0.2.2:8081 on the emulator**, ignoring adb reverse → set
  `debug_http_host=10.0.2.2:8084` (§3).
- **INSTALL_FAILED_INSUFFICIENT_STORAGE** with the 4-ABI APK → x86_64-only build (§5).
- Seed bug fixed: a touchpoint dated "today 17:00" at 01:00 tripped the future-date guard and
  aborted the seed half-way; on a half-seeded DB, `pm clear` and relaunch.
- **inotify watch limit** → Metro `ENOSPC` crash; run Metro with `CI=1` (no watcher). See §2.
- **wmic is absent on droid**; use the PowerShell probe.
- Lab A builds in `C:\Users\bwales\projects\orbit-lab-a`; the emulator's adb server (droid 5037)
  is shared, so `adb -P 5039 devices` may also be used by others — never `kill-server` it.
- `expo prebuild` warns "Install expo-system-ui to enable userInterfaceStyle" — pre-existing, harmless.
- The scheme stays `orbit://` (widget deep links hardcode it). With both apps installed on one
  device, `orbit://` links would show a chooser; the emulator has only Lab B.

## Baseline evidence (unchanged renderer, 2026-10-01, emulator)

`evidence/00-baseline/`: `01-overview-all-contacts` (140 contacts), `02-system-selector`,
`03-switch-to-dense-transition` (mid-switch), `04-dense-system-centered` (Lab B Dense, 120),
`05-contacts-sheet-dense` (body-tap cluster sheet), `06-dense-focused-zoomed-cleo` (focus fly-in,
near zoom + labels), `07-dense-after-clear-focus`.

Rough emulator gfxinfo over that whole session (launch + seeding + switching, NOT a perf claim):
643 frames, 50% janky, p50 24 ms / p90 250 ms. Reset gfxinfo before any measured run.

## 11. WP-2.1 switch tooling (lab build only)

- **Deep links** (`parseLabCommand` in `LabFxPanel.tsx`):
  `$ADB shell "am start -a android.intent.action.VIEW -d 'orbit://labb?flags=fx:0,fxStreaks:1&slowmo=6&rm=on&intensity=0.75&reset=1&renderer=legacy&system=Lab%20B%20Dense&delay=0&panel=0' com.bwales.orbit.labb"`.
  Each VIEW intent pauses/resumes the activity → the Orrery REMOUNTS (wait ~10 s on release).
  Use links for flags / slow-mo / reduced motion, then switch with the panel.
- **Panel quick switch** is now the first section; with "Close on switch: ON" the panel closes
  and the switch fires 0.7 s later. Unscrolled chip centres (1280×2856): All Contacts 210,1396 ·
  Lab B Dense 888,1600 · Work 354,1600 · Lab B Inner Circle 264,1702 · Lab B Work 618,1702 ·
  Replay 976,1702. Long-press the "LAB B" marker (96,2584) ~800 ms to open.
- **Slow motion**: `slowmo=N` multiplies the switch duration (store `switchTimeScale`). It was
  needed to see the first half of BIG switches until the switch-stall fix (`ea137306`…`3c0f691b`,
  research/SWITCH-STALL-INVESTIGATION.md); big switches now play at normal speed.
- **Layer pictures A/B**: `flags=layerPictures:0` restores the per-component bodies / labels /
  rings (the pre-fix-2 tree) on the same build.
- **Temporary perf instrumentation** (never commit): `evidence/07-switch-stall/12-instrumentation.patch`
  patches RN Skia / Reanimated / Worklets copies in `node_modules` (Metro bundles their `src/`)
  — sync them to droid too, and change any app source line so Gradle re-bundles. Restore the
  originals locally AND on droid afterwards (compare MD5s).
- **screenrecord quirk**: running another `adb shell input` concurrently with screenrecord ended
  the recording's frame stream early. Fire the input first in the SAME shell:
  `$ADB shell "input tap X Y; screenrecord --time-limit 15 --bit-rate 4000000 --size 720x1606 /sdcard/r.mp4"`.
- **Main-thread stack of a stall**: debug build only — `$ADB shell run-as $PKG kill -3 <pid>`, then
  `$ADB bugreport` and read `FS/data/anr/trace_00` (the user-build emulator denies /data/anr).
- Iterate on RELEASE (`assembleRelease` ≈ 1 min incremental after the busy check; install -r keeps
  data). Debug JS takes > 7 s to load a System on this emulator.

## 12. R1 tooling (density, perf, legibility)

- **Stress seed**: a debug launch adds 800 contacts + "Lab B Stress 400" / "Lab B Stress 800"
  if absent (`[lab-b-seed] stress seeded …` in logcat, ~1 min). All Contacts becomes 940.
- **Deep links** (lab build): `focus=<member name>`, `clear=1`, `theme=galaxy:dark` (session
  only), on top of §11's. All still remount the Orrery (pause/resume) — fire actions with
  `delay=` after the remount settles.
- **Probe**: `flags=perfProbe:1` → logcat `[labb-probe] win=… name=runs/mean/p95/max` (ms,
  UI-thread JS only) every 3 s while worklets run.
- **Harness**: `tools/r1-matrix.sh <out>` (configs × Systems × idle/pan/focus/switch; env
  `CONFIGS`, `SYSTEMS`, `LABALL_FLAGS`, `OPAQUE`, `ORRERY_TAB`, `RECENTRE`, `SWIPE`),
  `tools/r1-table.py <summary.tsv…>`, `tools/r1-idle.sh <out>` (idle clock / RM / opaque),
  `tools/r1-legibility.sh <out> <palettes.json>` + `tools/r1-contrast.py` (needs numpy + PIL:
  use a venv). Never run `pkill -f r1-perf.sh` from a shell whose own command line contains that
  string (it kills the shell).
- **Opaque canvas is ON by default since R1**: gfxinfo cannot see its frames; the harness pins
  `opaqueCanvas:0`, and SurfaceFlinger `--latency` measures the opaque path (PHONE-PASS §4).
- `uiautomator dump` now works on a static Orrery (reduced motion or all ambient off: the idle
  clock stops the canvas).
