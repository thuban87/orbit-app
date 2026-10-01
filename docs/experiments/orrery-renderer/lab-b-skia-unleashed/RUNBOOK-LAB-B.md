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
tiers, mixed recency), ~56 procedural Skia-rendered JPEG "photos", ~75 unlinked relationships on
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
