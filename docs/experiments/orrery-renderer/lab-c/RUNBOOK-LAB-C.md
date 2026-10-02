# Runbook — Orrery Lab C (True 3D) build / device loop

Branch `experiment/orrery-3d`, worktree `/home/bwales/projects/orbit-orrery-lab-c`.
Target: the owner's **physical Pixel 6 Pro over USB on the LOCAL adb server (port 5037)**.
Adapted from Lab B's runbook (`orbit-orrery-lab-b/.../RUNBOOK-LAB-B.md`); differences: Pixel instead
of the droid emulator, `adb reverse` works (dev client uses `localhost:8081`), arm64 only.

| Thing | Value |
|---|---|
| App package | `com.bwales.orbit.labc` (launcher label "Orbit Lab C", scheme `orbitlabc`) — installs side by side with `com.bwales.orbit` |
| adb | `~/.local/bin/adb` (v37, local server 5037). Serial from `adb devices -l` (the 6 Pro was `1A071FDEE002BU`); always `-s <serial>`. Port 5039 is Lab B's — never use it. |
| Metro | this box, port **8085**, tmux session **`orbit-lab-c`**, `CI=1` (no file watcher) |
| Reverse | `adb reverse tcp:8081 tcp:8085` on the Pixel (owner approved replacing the old 8081→8082 mapping for this experiment) |
| droid build dir | `C:\Users\bwales\projects\orbit-lab-c` (never `orbit-app`, `orbit-lab-a`, `orbit-lab-b`) |
| Busy probe | `docs/experiments/orrery-renderer/lab-c/tools/droid-busy.sh` (exit 0 = IDLE) |
| Evidence | `docs/experiments/orrery-renderer/lab-c/evidence/` |

Shell helpers (paste once per shell):

```bash
LC=/home/bwales/projects/orbit-orrery-lab-c
SERIAL=$(~/.local/bin/adb devices -l | awk '/model:Pixel_6_Pro/{print $1}')
ADB="$HOME/.local/bin/adb -s $SERIAL"
DEST='C:\Users\bwales\projects\orbit-lab-c'
PKG=com.bwales.orbit.labc
BUSY=$LC/docs/experiments/orrery-renderer/lab-c/tools/droid-busy.sh
```

**Never** run `emu-connect` (it tears down other sessions' adb topology), never `adb kill-server`,
never kill a Metro / tmux session / Gradle daemon you did not start, never `git worktree`, never push,
never upload to Drive, never `apt install`.

## 1. Metro on 8085 + reverse

```bash
tmux has-session -t orbit-lab-c 2>/dev/null || \
  tmux new-session -d -s orbit-lab-c -c $LC \
    "CI=1 npx expo start --dev-client --port 8085 2>&1 | tee -a /tmp/orbit-lab-c-metro.log; exec bash"
curl -s localhost:8085/status                 # packager-status:running
$ADB reverse tcp:8081 tcp:8085 && $ADB reverse --list
```

`CI=1` = no file watcher (this box's inotify budget is exhausted by other Metros). After any JS edit:
`tmux kill-session -t orbit-lab-c`, re-run the line above, then force-stop + relaunch the app (§4).
Re-run the `reverse` after replugging the USB cable or rebooting the phone.

Optional warm-up (also catches resolution errors before the phone asks):
`curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:8085/index.bundle?platform=android&dev=true&minify=false&app=$PKG"`

## 2. Sync source to droid (tar-over-ssh; droid has no rsync)

```bash
cd $LC
tar -czf - --exclude=./node_modules --exclude=./android --exclude=./ios --exclude=./.git \
    --exclude=./.expo --exclude=./.planning --exclude=./docs . \
  | ssh -o BatchMode=yes droid "tar -xzf - -C \"$DEST\""
```

First time: `ssh droid "mkdir \"$DEST\""`. Deleted local files are not deleted on droid.

## 3. Busy check, then build (droid)

```bash
until $BUSY >/dev/null; do sleep 180; done      # run before EVERY npm ci / prebuild / gradle
# (a) only if package.json / package-lock changed (or first time)
ssh -o BatchMode=yes droid "cd /d \"$DEST\" & npm ci"
# (b) only if app.config.ts / plugins / native deps changed (or first time)
ssh -o BatchMode=yes droid "cd /d \"$DEST\" & set \"CI=1\" & npx expo prebuild --platform android --clean --no-install"
ssh droid "findstr /n applicationId \"$DEST\\android\\app\\build.gradle\""   # com.bwales.orbit.labc
# (c) debug APK, arm64 only
ssh -o BatchMode=yes droid "cd /d \"$DEST\\android\" & gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain"
```

Rebuild only for native changes (`app.config.ts`, `package.json` native deps, `plugins/`, `android/`).
JS/TS changes (renderer, shaders as TSL, seed) only need the Metro restart in §1.

## 4. Pull, install, launch

```bash
scp -o BatchMode=yes "droid:C:/Users/bwales/projects/orbit-lab-c/android/app/build/outputs/apk/debug/app-debug.apk" /tmp/orbit-lab-c-debug.apk
$ADB install -r /tmp/orbit-lab-c-debug.apk          # -r keeps app data
$ADB shell monkey -p $PKG -c android.intent.category.LAUNCHER 1
# JS reload without reinstall (after a Metro restart):
$ADB shell am force-stop $PKG && $ADB shell monkey -p $PKG -c android.intent.category.LAUNCHER 1
```

No dev-prefs file is needed on the Pixel: the dev client asks for `localhost:8081`, which the reverse
maps to Metro 8085.

## 5. Seed

Automatic on a debug launch (`src/__dev__/lab-c-seed.ts`, gated on `__DEV__` + applicationId, idempotent
by the "Lab C Dense" System). Logs `[lab-c-seed] seeded contacts=… photos=… satellites=…`.
Reset: `$ADB shell pm clear $PKG` then relaunch.

## 6. Logs, screenshots, perf

```bash
$ADB logcat -c; $ADB logcat -s ReactNativeJS:V | grep -E "lab-c"     # renderer + seed + frame stats
EV=$LC/docs/experiments/orrery-renderer/lab-c/evidence
$ADB exec-out screencap -p > $EV/01-m1/name.png
$ADB shell dumpsys meminfo $PKG | sed -n '1,40p'
$ADB shell dumpsys gfxinfo $PKG          # UI/RenderThread only; the 3D loop is on the JS thread
```

`[lab-c] frames=… avgDt=… p95Dt=… jsRenderAvg=…` lines every 5 s are the JS-thread rAF cadence and
the CPU cost of building + submitting one 3D frame (that is where this renderer's jank lives).
`[lab-c] mount #N` / `unmount #N: loop stopped` prove the loop dies with the screen.

Navigation: Orrery tab via `uiautomator dump` bounds (the dump can fail while the Orrery animates —
use a screenshot then). Dismiss the LogBox toast before tapping the tab bar.

## 7. Teardown (only when nobody needs the phone any more)

```bash
$ADB reverse tcp:8081 tcp:8082     # restore the real Orbit dev mapping the owner had before
tmux kill-session -t orbit-lab-c   # ours only
```

## 8. Release build (Checkpoint F, verified 2026-10-01)

Release = Hermes bytecode, minified, `__DEV__ = false`, no Metro / LogBox. The seed only runs in a
DEBUG build (`if (__DEV__)` is folded away), so seed on debug first, then install the release APK
**over** it with `install -r`. `assembleRelease` on the Expo-prebuilt project signs with the same
`debug.keystore` as `assembleDebug` (`android/app/build.gradle` `signingConfigs.debug` for both
build types), so it is an in-place update and the seeded DB is kept. Never uninstall / `pm clear`.

```bash
# sync (§2), then:
until $BUSY >/dev/null; do sleep 180; done
ssh -o BatchMode=yes droid "cd /d \"$DEST\\android\" & gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain"
#   (1 m 14 s incremental after a debug build; createBundleReleaseJsAndAssets re-runs on every JS change)
scp -o BatchMode=yes "droid:C:/Users/bwales/projects/orbit-lab-c/android/app/build/outputs/apk/release/app-release.apk" /tmp/orbit-lab-c-release.apk
# same signer as the installed debug app? (compare the installed base.apk)
AS=$(ls -d ~/Android/Sdk/build-tools/*/ | tail -1)apksigner
$ADB pull "$($ADB shell pm path $PKG | head -1 | sed 's/package://')" /tmp/orbit-lab-c-installed.apk
$AS verify --print-certs /tmp/orbit-lab-c-installed.apk | grep -m1 SHA-256
$AS verify --print-certs /tmp/orbit-lab-c-release.apk   | grep -m1 SHA-256   # both fac61745…3b9c
$ADB shell am force-stop $PKG && $ADB install -r /tmp/orbit-lab-c-release.apk
$ADB shell dumpsys package $PKG | grep -m1 "flags=\["    # no DEBUGGABLE => release
$ADB shell monkey -p $PKG -c android.intent.category.LAUNCHER 1
```

Release APK (arm64-v8a only): **102.9 MB** (debug arm64 139.7 MB). Stored (uncompressed) in it:
`libwebgpu_dawn.so` 17.5 MB, `libreact-native-webgpu.so` 3.1 MB (≈20.6 MB for the WebGPU stack),
`assets/index.android.bundle` 8.9 MB (includes three.js). The bundle contains no `lab-c-seed` /
`Lab C Dense` strings. `console.log` is not stripped in release (no remove-console Babel plugin), so the
`[lab-c] frames=…` renderer line still reaches `logcat -s ReactNativeJS`. `run-as` does not work on the
release install; `install -r` the debug APK back for DB peeks (data kept the same way).
