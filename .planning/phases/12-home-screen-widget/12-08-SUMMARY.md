---
phase: 12-home-screen-widget
plan: 08
subsystem: home-screen-widget
tags: [widget, native, boot-receiver, prebuild, manifest-hardening, device-uat, killed-app-mark]
requires: [12-05, 12-06, 12-07]
provides:
  - "plugins/withWidgetBootReceiver.js — config plugin emitting a concrete native BOOT_COMPLETED re-push receiver"
  - "OrbitWidgetBootReceiver.kt (generated at prebuild) — Android 15 cold-boot widget re-arm"
  - "First committed native change: hardened prebuilt AndroidManifest.xml (release + debug APKs)"
affects: [app.config.ts, android/]
tech-stack:
  added:
    - "Expo config-plugin (withDangerousMod + withAndroidManifest) writing/registering a native Kotlin BroadcastReceiver"
  patterns:
    - "JS config plugin GENERATES/REGISTERS native code; it can never BE a BroadcastReceiver (Codex HIGH)"
    - "am kill (not am force-stop) is the faithful killed-app simulation on Android 15 — force-stop resets the widget to initialLayout"
key-files:
  created:
    - plugins/withWidgetBootReceiver.js
  modified:
    - app.config.ts
key-decisions:
  - "Boot receiver is a CONCRETE native Kotlin class (withDangerousMod), not a JS shim — the library registers NO boot receiver so this ADDS one (not reduced to assertion-only)"
  - "android:exported=false + exact-action onReceive guard — BOOT_COMPLETED is a protected system broadcast that still reaches a non-exported receiver"
  - "Killed-app headless mark verified on the DEBUG build via run-as (release is not run-as-debuggable, runbook §3.1)"
requirements-completed: [WDG-01, WDG-02, WDG-03]
coverage:
  - deliverable: "Concrete native BOOT_COMPLETED re-push receiver (config plugin + Kotlin class)"
    verification:
      - kind: command
        ref: "npx tsc --noEmit; grep BOOT_COMPLETED/withDangerousMod/withAndroidManifest/exported=false in plugins/withWidgetBootReceiver.js"
        status: pass
      - kind: manifest-assertion
        ref: "android/app/src/main/AndroidManifest.xml — exactly one <receiver .OrbitWidgetBootReceiver exported=false enabled> + BOOT_COMPLETED filter + RECEIVE_BOOT_COMPLETED permission"
        status: pass
    human_judgment: false
  - deliverable: "Manifest hardening preserved through first prebuild (allowBackup=false, portrait, singleTask, all prior plugins, widget provider)"
    verification:
      - kind: manifest-assertion
        ref: "regenerated + merged manifests asserted on droid"
        status: pass
    human_judgment: false
  - deliverable: "Favourites grid renders on RELEASE standalone build (status rings + base64 avatars + initials fallback)"
    verification:
      - kind: screenshot
        ref: "scratchpad/15-widget-on-home.png (Dad photo + orange ring; Bob initials)"
        status: pass
    human_judgment: false
  - deliverable: "Empty 'Choose favourites' widget state, re-rendered live via event-push"
    verification:
      - kind: screenshot
        ref: "scratchpad/36-empty-state.png"
        status: pass
    human_judgment: false
  - deliverable: "Killed-app headless mark — EXACTLY ONE interactions row per single tap (M4 gate); last_contact recomputed"
    verification:
      - kind: command
        ref: "am kill; run-as sqlite3 — new_rows_from_killed_tap=1; source=widget/outbound/connected=1; Dad.last_contact advanced; 2 distinct uids"
        status: pass
    human_judgment: false
  - deliverable: "Widget deep links (name/chevron -> Profile; Message -> Compose) route with Back -> dashboard"
    verification:
      - kind: command
        ref: "cold-start orbit://contact/2 -> profile; Back -> dashboard (queued pre-ready reset flush)"
        status: pass
    human_judgment: false
  - deliverable: "Add-widget button -> requestPinWidget pin prompt on launcher"
    verification:
      - kind: screenshot
        ref: "scratchpad/14-pin-prompt.png"
        status: pass
    human_judgment: false
  - deliverable: "Widget resize contract (small<->large, min 250/110dp, max 360/220dp, resizeMode)"
    verification:
      - kind: command
        ref: "on-device resize handles + generated widgetprovider_orbitfavourites.xml resize attrs"
        status: pass
    human_judgment: false
  - deliverable: "Grid-capacity / bitmap ceiling (max tiles before RemoteViews truncate/OOM)"
    human_judgment: true
    rationale: "Only 2 favourites tested; the OOM/truncation ceiling is a device spike + judgment call routed to the owner checkpoint."
  - deliverable: "Worst-capacity tap-to-update timing (<30s)"
    human_judgment: true
    rationale: "Measured ~20.5s on the DEBUG build (Metro bundle load over adb-reverse) with 2 favourites + 2 widget instances; worst-capacity full photo grid on RELEASE is the owner's judgment call."
  - deliverable: "Recovery path A — reboot-receiver refresh on RELEASE build (no Metro after reboot)"
    human_judgment: true
    rationale: "Requires a full physical reboot (owner action); the BOOT_COMPLETED receiver is built and registered but the re-push is only observable after a real reboot."
  - deliverable: "Recovery path B — force-stop grey -> manual-launch re-arm (Android 15)"
    human_judgment: true
    rationale: "Observed: am force-stop reset both widgets to the initialLayout (logo placeholder) with dead taps; a manual app launch re-rendered content. Owner confirms the grey/re-arm UX."
duration: 59 min
completed: 2026-08-17
---

# Phase 12 Plan 08: Home-Screen Widget — Native Enablement + On-Device Verification Summary

The widget is real on the physical Pixel: a first custom-dev-client prebuild produced a hardened manifest (allowBackup=false, portrait, singleTask, all prior plugins preserved) carrying the OrbitFavourites provider plus a **concrete native Kotlin BOOT_COMPLETED re-push receiver** emitted by a new Expo config plugin; both RELEASE (standalone) and DEBUG (run-as) APKs built on `droid`; and the device-only behaviours — grid render, deep-link nav, pin prompt, empty state, and the **killed-app headless mark (exactly one row per tap)** — were driven and verified on the Pixel.

- **Duration:** ~59 min | **Tasks:** 3 (2 auto committed + 1 device UAT, checkpoint pending) | **Files:** 2 source (+ generated android/)
- **Start:** 2026-08-17T08:40:12Z → **End:** 2026-08-17T09:39:05Z

## Accomplishments

### Task 1 — Concrete native BOOT_COMPLETED re-push receiver (commit acfaee5)
- `plugins/withWidgetBootReceiver.js`: at prebuild, (1) `withDangerousMod` writes `OrbitWidgetBootReceiver.kt` into the app package (`com.bwales.orbit`), co-located with `MainApplication.kt`; (2) `withAndroidManifest` adds the `RECEIVE_BOOT_COMPLETED` permission and a single `<receiver android:exported="false" android:enabled="true">` with a `BOOT_COMPLETED` intent-filter.
- `onReceive` FIRST guards `intent?.action != Intent.ACTION_BOOT_COMPLETED` (defence-in-depth), then calls the verified `com.reactnativeandroidwidget.RNWidgetJsCommunication.requestWidgetUpdate(context, "OrbitFavourites")` (class/method confirmed at `node_modules/.../RNWidgetJsCommunication.java:15`; it no-ops when no widget is placed).
- **Non-duplication asserted (Codex MED):** react-native-android-widget@0.22.0's `app.plugin.js` registers NO boot/update receiver (its widget receiver carries only `APPWIDGET_UPDATE` + `<pkg>.WIDGET_CLICK`), so this ADDS the boot receiver — it does NOT reduce to the assertion-only path.
- Wired into `app.config.ts` via the dedupe-by-name `plugins()` builder (local path `./plugins/withWidgetBootReceiver`, ordered after the widget plugin). `tsc --noEmit` clean.

### Task 2 — Desktop prebuild + manifest hardening + BOTH build variants
- Transported source to `droid` (tar-over-ssh), ran `npm ci` (droid's `node_modules` predated the Phase-12 widget dep — a required lockfile install, not a new package), then `expo prebuild --platform android --clean` (CI=1).
- Built **RELEASE** (`assembleRelease`, 7m34s, embedded bundle) AND **DEBUG** (`assembleDebug`, 6m56s) APKs — the Kotlin receiver compiled into both.
- **Manifest-hardening assertion (source manifest, all PASS):** `allowBackup="false"`, `screenOrientation="portrait"`, `launchMode="singleTask"`, share-intent text/plain, orbit:// scheme, picker hardening (CAMERA + RECORD_AUDIO `tools:node="remove"`), `RNWidgetCollectionService`, the `.widget.OrbitFavourites` provider (APPWIDGET_UPDATE + WIDGET_CLICK), EXACTLY ONE `BOOT_COMPLETED` receiver (`.OrbitWidgetBootReceiver`, exported=false, enabled), one `RECEIVE_BOOT_COMPLETED` permission. No exported=true boot receiver; no duplicate widget boot receiver.
- **Merged manifest note (honest finding):** the fully-merged manifest contains 4 `BOOT_COMPLETED` receivers from 4 distinct subsystems — ours (widget re-push), `expo.modules.notifications` (notification reschedule), `expo.modules.taskManager` (task restart), and `androidx.work RescheduleReceiver` (enabled=false). None is a widget re-push, so the "exactly one WIDGET boot receiver" invariant holds. `allowBackup="false"` survived the merge.
- Generated `widgetprovider_orbitfavourites.xml` confirms the resize contract: minWidth 250dp / minHeight 110dp, maxResize 360×220dp, `resizeMode="horizontal|vertical"`, `updatePeriodMillis="0"` (event-push only, WDG-03).

### Task 3 — Device UATs on the physical Pixel (serial 1A071FDEE002BU)
Claude-verified (RELEASE build unless noted):
- **Grid + avatars:** favourites grid renders status-colour rings (orange around Dad) + base64 photo avatar (Dad) + initials fallback (Bob "B"). `15-widget-on-home.png`.
- **Empty state:** unfavouriting both re-rendered the widget LIVE to "Choose favourites" (event-push refresh, WDG-03). `36-empty-state.png`.
- **Deep-link nav:** cold-start `orbit://contact/2` (name/chevron) → Dad's profile; **Back → dashboard** (queued pre-ready reset flush). `34/35`. (First cold attempt exited to home because Back was pressed before the ready-gated reset flushed — a sub-second window, not a bug; re-test with a proper settle landed on the dashboard.)
- **Message → Compose:** profile "Message Dad" → in-app Compose (conversational fuel + message field + Copy/Send). `19-compose.png`.
- **Add-widget button:** Settings → "Add Orbit widget" → `requestPinWidget` pin prompt on the launcher ("Orbit — Favourites", 4×2). `14-pin-prompt.png`.
- **Resize:** widget is resizable on-device (resize handles appeared); provider XML carries the configured min/max/resizeMode.
- **Killed-app headless mark (DEBUG build, run-as):** `am kill` (0 processes; faithful OS-kill that preserves the widget RemoteViews) → tap Dad's avatar (WIDGET_MARK region) → **EXACTLY ONE** new `interactions` row (id 3, `source='widget'`, `direction='outbound'`, `connected=1`, occurred_at 2026-08-17 04:30:54); Dad's `last_contact` advanced to match; 2 widget rows total, 2 distinct uids. **Mark-commit latency ~20.5s** on the debug build (dominated by Metro JS-bundle load over adb-reverse; release embedded-bundle would be faster). This also closes the **deferred Phase-11 killed-app headless-mark** check (same FCM-less headless-wake path).

## M4 Gate
The single killed-app tap produced exactly ONE row (verified: `new_rows_from_killed_tap = 1`, 2 distinct uids). **No WIDGET_CLICK double-delivery observed → the deterministic-uid dedup backstop is NOT required.** The M4 gate is satisfied; no gated follow-up before phase close.

## Deviations from Plan

**1. [Rule 3 - Blocker] `npm ci` required on droid before prebuild.** Found during Task 2. droid's `node_modules` predated the Phase-12 widget dependency, so `expo prebuild` failed to resolve `react-native-android-widget`. Fix: ran the runbook's `npm ci` (installs the exact committed `package-lock.json` tree — not a new/unvetted package). Verified widget lib present, prebuild then succeeded.

**2. [Rule 1 - Test-artifact revert] Metro rewrote `tsconfig.json`.** Found post-UAT. `expo start` auto-edited `tsconfig.json#include`, dropping `.expo/types/**/*.ts` and `expo-env.d.ts` (a regression). Reverted via `git checkout -- tsconfig.json`; `tsc --noEmit` clean. Not committed.

**3. [Rule 1 - Faithful simulation] `am force-stop` is NOT a faithful killed-app test on Android 15.** Found during Task 3. `am force-stop` reset both widgets to the `initialLayout` (logo placeholder) with dead taps — the WIDGET_MARK region no longer existed, so no mark fired. The faithful "OS killed the app" simulation is `am kill` (kills the process WITHOUT the stopped-state flag, preserving the widget RemoteViews), under which the headless mark fires correctly. This is itself evidence for recovery path B (force-stop grey/reset → manual-launch re-arm).

**Total deviations:** 3 (1 blocker auto-fixed, 1 test-artifact revert, 1 methodology correction). **Impact:** none on shipped code; all three are build/verification-environment adjustments.

## Pending — Owner Checkpoint (Task 3, blocking human-verify; NOT self-approved)
The genuine human-judgment / physical-action UATs are returned to the owner:
1. **Grid-capacity / bitmap ceiling** — how many favourite tiles before the RemoteViews bitmap truncates/blanks (only 2 tested). Add many favourites and record the number for THUMB_PX / capacity tuning.
2. **Worst-capacity tap-to-update timing (<30s)** — measured ~20.5s on DEBUG (Metro-bound) with 2 favourites; confirm a full photo-bearing grid (and ideally two placed instances) on the RELEASE build stays < 30s.
3. **Recovery A — reboot-receiver refresh (RELEASE):** fully reboot the Pixel; confirm the BOOT_COMPLETED receiver re-pushes and the widget shows live data without opening the app.
4. **Recovery B — force-stop grey → manual-launch re-arm:** observed (force-stop reset widgets to the logo placeholder; manual launch re-armed) — owner confirms the UX.

## Next Steps
- Task 3 checkpoint awaits owner sign-off on the 4 items above. Once approved, the phase's device-only behaviours are fully verified. RELEASE APK (`app-release.apk`) and DEBUG APK (`app-debug.apk`) are on this box for the owner's reboot / grid-capacity runs.

## Self-Check: PASSED
- `plugins/withWidgetBootReceiver.js` exists; `.planning/phases/12-home-screen-widget/12-08-SUMMARY.md` exists.
- Task 1 commit `acfaee5` present in git log; `app.config.ts` references the plugin.
- `npx tsc --noEmit` clean; working tree clean (Metro's tsconfig edit reverted).
- Manifest hardening + exactly-one non-exported boot receiver asserted on the regenerated + merged manifests (droid).
- Killed-app headless mark: exactly 1 row per tap (run-as, debug build), last_contact advanced.
