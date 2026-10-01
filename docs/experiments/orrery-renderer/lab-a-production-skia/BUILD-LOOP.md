# Orrery Lab A — build + device loop

Experiment-only. Lab A installs as its **own package** `com.bwales.orbit.laba`
(launcher "Orbit Lab A"), set in `app.config.ts` (`// ORRERY LAB A (experiment-only)`).
Every provider authority in the merged manifest is `${applicationId}`-relative
(verified in the built APK: `com.bwales.orbit.laba.FileSystemFileProvider`,
`.SharingFileProvider`, `.ClipboardFileProvider`, `.ImagePickerFileProvider`,
`.cropper.fileprovider`, `.androidx-startup`, `.firebaseinitprovider`), and the
widget boot-receiver plugin derives its Kotlin package from `android.package`,
so Lab A coexists with `com.bwales.orbit` without install conflicts. The `orbit://`
deep-link scheme (incl. `orbit://openrouter-auth`) is **shared** with the main
app: an `orbit://` link may show an Android app chooser. Irrelevant to the Orrery.

Never install/uninstall/clear `com.bwales.orbit` or another lab's package. Never
`git push`. Builds only in `C:\Users\bwales\projects\orbit-lab-a` on `droid`.

Proven environment (2026-10-01): Pixel 6 Pro (`raven`, 1440x3120), serial
`1A071FDEE002BU` — but always resolve it at run time:

```bash
ADB=~/.local/bin/adb
$ADB devices | awk '$2=="device"' | wc -l      # must print 1
S=$($ADB devices | awk '$2=="device"{print $1}')
LAB=/home/bwales/projects/orbit-orrery-lab-a
TOOLS=$LAB/docs/experiments/orrery-renderer/lab-a-production-skia/tools
```

## (a) Source sync + rebuild on droid

droid's shell is **cmd.exe**; `rsync` is absent there, so transport is tar-over-ssh.

```bash
cd /home/bwales/projects/orbit-orrery-lab-a
DEST='C:\Users\bwales\projects\orbit-lab-a'

# Incremental sync (overwrites archived files, keeps node_modules/ and android/ on droid).
# NOTE: it never deletes files on droid; if you DELETE/RENAME a source file, do a clean reset:
#   ssh -o BatchMode=yes droid "rmdir /s /q \"$DEST\" & mkdir \"$DEST\""   (then full rebuild)
tar -czf - --exclude=./node_modules --exclude=./android --exclude=./ios \
  --exclude=./.git --exclude=./.expo --exclude=./.planning . \
  | ssh -o BatchMode=yes droid "tar -xzf - -C \"$DEST\""

# Full native rebuild (first build took ~2 min npm ci + ~1 min prebuild + 10m14s gradle, all 4 ABIs)
ssh -o BatchMode=yes droid "cd /d \"$DEST\" & npm ci"
ssh -o BatchMode=yes droid "cd /d \"$DEST\" & set \"CI=1\" & npx expo prebuild --platform android --clean --no-install"
ssh -o BatchMode=yes droid "cd /d \"$DEST\\android\" & gradlew.bat assembleDebug --console=plain"

# Native-only change with unchanged package.json: skip npm ci; prebuild + gradle only.
# (Untested speed-up: append  -PreactNativeArchitectures=arm64-v8a  to the gradle line
#  to build only the Pixel's ABI.)

# Pull the APK back (forward slashes on the remote path)
mkdir -p "$SP/apk"   # SP = your scratchpad
scp -o BatchMode=yes "droid:C:/Users/bwales/projects/orbit-lab-a/android/app/build/outputs/apk/debug/app-debug.apk" "$SP/apk/orbit-laba-debug.apk"

# Sanity: package + label
~/Android/Sdk/build-tools/36.0.0/aapt2 dump badging "$SP/apk/orbit-laba-debug.apk" | grep -E "^package|application-label:"
```

Run long builds in the background and poll the log (`BUILD SUCCESSFUL`); the
`Pseudo-terminal will not be allocated` line from ssh is harmless.

## (b) Native rebuild vs JS-only reload

| Changed | Action |
|---|---|
| Anything under `src/`, `App.tsx`, JS/TS only (incl. Skia draw code, shaders as JS strings, worklets) | **Nothing to rebuild.** Metro fast-refreshes; or force reload (below). |
| `app.config.ts`, `app.json`, `plugins/*.js`, `package.json` / lockfile, `patches/*`, any native dep, any asset referenced by native config | Sync → `npm ci` (if deps/patches changed) → prebuild `--clean` with `set "CI=1"` → `assembleDebug` → pull → `adb install -r`. |

Force a full JS reload without rebuilding: `$ADB -s $S shell am force-stop com.bwales.orbit.laba`
and relaunch (d) — the debug APK re-fetches the bundle from Metro on every cold start.

## (c) Metro on 8083 + adb reverse

Metro runs on this Linux box in a dedicated tmux session (watch mode on; do **not**
set `CI=1`, which disables reloads):

```bash
SP=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad
tmux new-session -d -s orbit-lab-a -c /home/bwales/projects/orbit-orrery-lab-a \
  "npx expo start --port 8083 2>&1 | tee $SP/metro-8083.log"
ss -ltnp | grep 8083                       # node listening
tmux kill-session -t orbit-lab-a           # stop it
```

The debug APK asks for Metro on device port **8081**, so map it to 8083:

```bash
$ADB -s $S reverse --list                  # RECORD what is there first (other labs / main app)
$ADB -s $S reverse tcp:8081 tcp:8083
$ADB -s $S reverse tcp:8083 tcp:8083
```

Only one mapping for device:8081 can exist. Before this lab took it, it was
`tcp:8081 tcp:8082` (the main `orbit-app` Metro). Whoever runs next must re-point it.
`adb reverse` is lost on USB replug / reboot — re-run the lines above.

The "React Native DevTools ... SUID sandbox" FATAL in the Metro log is harmless.

## (d) Install / launch

```bash
$ADB -s $S install -r "$SP/apk/orbit-laba-debug.apk"          # -r keeps app data (seed survives)
$ADB -s $S shell input keyevent 224                              # wake screen
$ADB -s $S shell monkey -p com.bwales.orbit.laba -c android.intent.category.LAUNCHER 1
$ADB -s $S shell am force-stop com.bwales.orbit.laba             # stop
```

First launch after install bundles ~17 MB; allow ~30–45 s. Confirm via Metro log
(`Android Bundled ...`) and a screenshot.

**LogBox toast**: the debug build shows "Open debugger to view warnings" across the
tab bar on every cold start; it swallows tab taps. Dismiss it first:
`$ADB -s $S shell input touchscreen tap 1328 2866` (the ✕; Pixel 6 Pro coordinates —
or find it with `python3 $TOOLS/ui.py find "Open debugger" --contains`).

## (e) Reseed synthetic data

```bash
python3 $TOOLS/seed-lab-a.py                 # wipes ALL contacts in the laba package, reseeds
python3 $TOOLS/seed-lab-a.py --satellites 1  # also turn Relationship Satellites on
```

What it does: force-stops the app, pulls `files/SQLite/orbit.db` (+`-wal`/`-shm`) via
`run-as cat`, applies the seed locally with Python `sqlite3` (WAL replayed and folded
into the main file), pushes the DB back via `run-as sh -c 'cat > …'`, deletes the
device `-wal`/`-shm`, and pushes synthetic abstract avatar JPEGs to `files/avatars/contact-<id>.jpg`.
`last_contact` is set with the exact recompute statement from `src/db/recency-dao.ts`.
Requires the DEBUG build (release is not `run-as`-able), app launched at least once
(DB at `user_version` ≥ 32), Pillow.

Seeded content (statuses relative to the day you run it):
- 8 core: Ada Park (Family, fav #1, photo, 2 satellites), Ben Okafor (Friends, wobble, photo),
  Clara Ruiz (Work, decay, 1 satellite), Dev Malhotra (Friends, fav #2, photo, 1 satellite),
  Elif Kaya (Family, wobble, 1 satellite), Felix Brandt (Work, rarely-responds → rogue),
  Grace Liu (never contacted → does not orbit, by design), Hugo Lemaire (Community, stable, photo).
- 32 dense contacts in category **Lab Dense** (every 3rd with a photo), progress spread 0.05–1.8.
- Custom System **Lab Inner Circle** (rule favorite=on + include override for Clara Ruiz) → 3 members.
- Totals: 40 contacts, 39 orbiting, ~174 interactions, 5 satellites, 15 avatars.

Relaunch after seeding (d). Orrery photo derivatives build lazily — bodies show
initials for a second or two on first view, then photos.

## (f) Screenshot / screenrecord / UI tree

```bash
$ADB -s $S exec-out screencap -p > shot.png
$ADB -s $S shell screenrecord --time-limit 8 /sdcard/laba.mp4 &   # start, then act
$ADB -s $S pull /sdcard/laba.mp4 ./clip.mp4
python3 $TOOLS/ui.py list                        # text/content-desc + centers + bounds
python3 $TOOLS/ui.py tap "Orrery"                # exact match, touchscreen tap at centre
python3 $TOOLS/ui.py tap "Choose System" --contains
python3 $TOOLS/ui.py tap "Clear focus" --nth 1
```

Pinch zoom **cannot be automated**: `adb shell input` has no multitouch, and
`sendevent` to `/dev/input/event3` (sec_touchscreen) is *Permission denied* for the
shell user on this Pixel. Use **tap-on-body (focus)** to get a zoomed-in camera, and
**Recenter Orrery** to return to the home view.

## (g) Navigating to the Orrery + System switcher (selectors that worked)

| Goal | Selector (`ui.py tap …`) | Notes |
|---|---|---|
| Orrery tab | `"Orrery"` (tab label, y≈3008) | Header also reads "Orrery" (y≈235) — first match is the tab only when the header is absent; on the Orrery screen use the tab coordinates or `--nth 1` |
| Settings tab | `"Settings"` | |
| Open System selector | `"Choose System" --contains` | a11y label is `Choose System. Current System: <name>` |
| Expand a group | `"Built-in, 6 Systems"`, `"Categories, 5 Systems"`, `"Custom Systems, 1 System"` | groups other than the current System's start collapsed |
| Pick a System | `"All Contacts" --contains`, `"Lab Dense" --contains`, `"Lab Inner Circle" --contains` | scroll the sheet first if needed: `$ADB -s $S shell input touchscreen swipe 616 2500 616 1300 400` |
| View options sheet | `"View options"` | Satellites toggle is the Switch at the right of "Relationship Satellites" (≈1242,1936): tap coords; then `"Close view options" --nth 1` |
| Recenter / north / list | `"Recenter Orrery"`, `"Reset north" --contains`, `"Contacts in this System"` | |
| Focus a contact | tap the body's pixel (Skia canvas — bodies are not in the a11y tree); then `"Clear focus" --nth 1` / `"Open Profile" --contains` | |
| Theme mode | Settings → `"Appearance"` → `"Mode Light"` / `"Mode Dark"` / `"Mode Follow System"` | Switching to Light **reloaded the JS app** to Digest (LogBox toast returns) |

## (h) Perf capture (gfxinfo)

```bash
$ADB -s $S shell dumpsys gfxinfo com.bwales.orbit.laba reset > /dev/null
# … perform the interaction for N seconds …
$ADB -s $S shell dumpsys gfxinfo com.bwales.orbit.laba > gfx.txt
grep -E "Total frames|Janky|percentile" gfx.txt
$ADB -s $S shell dumpsys gfxinfo com.bwales.orbit.laba framestats > framestats.txt  # per-frame
```

gfxinfo covers only the UI/RenderThread. **A debug + Metro build is not a valid perf
baseline** (dev-mode JS, no minification, Hermes debug): the baseline idle capture
shows 186 frames / 10 s, p50 69 ms, 100 % janky — treat as a debug artifact until a
release build is measured on the physical phone. Never make perf claims from the
desktop emulator.

## Gotchas hit

1. `CI=1 npx expo start` disables reloads/watch mode — use the tmux session.
2. LogBox toast eats tab taps after every cold start/reload (dismiss at ≈1328,2866).
3. No multitouch automation (see (f)).
4. Theme mode → Light triggered a full JS reload.
5. **Baseline bug observed:** after a cold start/reload with a *custom* System as the
   last System, the selector reads **"Unavailable System"** although the scene renders
   the right members (`src/stores/orrery-system-store.ts` `select()` falls back to
   "Unavailable System" when no name is passed and none is cached). Seed rows are
   valid (`app_settings.orrery_last_system = custom:<uid>` matches `systems.uid`).
6. Home/"Recenter" view of All Contacts does not fit the whole sky on screen; outer
   rings run off-screen.
7. System switch takes >4 s to settle in the debug build (frame 12 still mid-flight 4 s after tap).

## Baseline evidence (`evidence/baseline/`)

01 overview All Contacts (dark) · 02 zoomed after clear focus · 03 focus Ada Park w/ labels ·
04 View options sheet · 05 satellites on, zoomed · 06 recentered overview, satellites on ·
07 System selector open · 08 Categories expanded · 09 sheet closing as switch starts ·
10 **screenrecord 8 s** All Contacts → Lab Dense · 11 dense System (32) settled ·
12 Dense → Lab Inner Circle mid-transition · 13 Lab Inner Circle settled ·
14 overview All Contacts (light) · 15 cold-start "Unavailable System" label (light) ·
16 focus Ada Park with satellite list (light) · 17 gfxinfo (debug, focused idle, 10 s).

## (i) Production-mode JS on the DEBUG APK (no native rebuild) — pass 2

**This is NOT a release build.** It is the debug APK (debuggable, debug native
libs, RN dev-support code present) fetching a `dev=false&minify=true` bundle
from Metro. It removes dev-mode JS overhead (LogBox, strict-mode warnings,
`__DEV__` paths, unminified bundle) and nothing else. The Lab DEV marker is
hidden in this mode (`__DEV__` is false).

The Lab APK has **no expo-dev-client** (`node_modules/expo-dev-launcher` is
absent): it is a plain RN debug app whose `DevSupportManager` builds the bundle
URL itself from its dev settings. So Metro's `--no-dev` flag (it only changes
the expo manifest) has no effect; the switch is the app's own shared prefs:

```bash
P=com.bwales.orbit.laba
$ADB -s $S shell am force-stop $P
printf '%s\n' "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>" "<map>" \
  '    <boolean name="js_dev_mode_debug" value="false" />' \
  '    <boolean name="js_minify_debug" value="true" />' "</map>" \
  | $ADB -s $S shell "run-as $P sh -c 'cat > shared_prefs/${P}_preferences.xml'"
# relaunch (d): Metro logs "Android Bundled … index.ts (2803 modules)" (dev = 2926),
# ~26 s first bundle; no LogBox toast appears.
# Back to dev JS: run-as $P rm shared_prefs/${P}_preferences.xml  (and relaunch)
```

Metro was restarted for pass 2 as
`npx expo start --port 8083 --dev-client --no-dev --minify` (tmux `orbit-lab-a`,
log `$SP/metro-8083-prod.log`) — harmless, but not what makes the difference.
No fast refresh in this mode: force-stop + relaunch after every JS edit.

**Finding: the 4–5 s System-switch freeze is NOT dev mode.** It reproduces in
production-mode JS, and with `DEEP_FIELD_ENABLED = false` (legacy renderer):
one 3.4–4.6 s main-thread block ("Skipped ~400–480 frames", Davey) right after
the switch starts, then ~600 ms frames for a few seconds. It scales with body
count: Family(2)↔Friends(2) / Family↔Lab Inner Circle(3) animate continuously
(~16–20 fps, progress samples every 50–60 ms); All(40)↔Lab Dense(32) freezes
then jumps. simpleperf: the block is mostly `libworklets` (shareable
(de)serialisation) + Hermes on the main thread. A focus tap shows the same
pattern (≈2.4 s to respond, then discrete jumps). See `_notes/PASS-2.md`.

Recording helpers used in pass 2 (scratchpad, not committed): `pick.py`
(open the selector, expand a group, scroll until a System row is visible),
`sw.sh "<System>" "<group header>" out.mp4 [secs]` (screenrecord + tap),
`vidan.py` (frame diff + contact sheet), `idle.sh` (relaunch + 5 s idle
gfxinfo).

## (j) Perf pass additions

- **Renderer A/B at runtime:** View options → "Lab A renderer (experiment)" switch flips Lab A ↔ legacy
  live (in-memory, resets on app start). Use it to measure both renderers in ONE build (incl. release).
- **Switch latency method:** `evidence/perf/logs/scenario.sh` + `lat2.py` with the probe patch
  `evidence/perf/probe-instrumentation.patch.txt` (not committed to src). Take UI-side timestamps
  (`Date.now()` inside worklets); logcat arrival time of a UI `console.log` is NOT a timestamp — UI logs
  are forwarded through the JS thread and arrive seconds late while JS is busy.
- See `_notes/PERF-PASS.md` for root cause, numbers and residuals.
