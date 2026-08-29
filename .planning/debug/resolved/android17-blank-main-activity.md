---
status: resolved
trigger: "Fresh Android 17 debug APK installs and receives a Metro bundle on the Pixel 6 Pro, but MainActivity renders only a blank dark background, blocking Phase 19 import device UAT."
created: "2026-08-29"
updated: "2026-08-29T14:37:00-05:00"
---

# Debug Session: Android 17 blank MainActivity

## Symptoms

- Expected: A freshly built debug APK should render Orbit's initial UI, initialize its database, and permit the Phase 19 contact-import UAT on the connected Android 17 Pixel.
- Actual: The APK installs and launches, but `MainActivity` displays only its dark background. `uiautomator` sees an empty content `FrameLayout`, and Orbit's SQLite database is never initialized.
- Errors: Metro reports successful bundle delivery (`Android Bundled 3389ms index.ts (2422 modules)` and a 151ms follow-up bundle); `adb logcat` has no React Native JS exception or Android crash.
- Timeline: Reproduced on the fresh Phase 19 debug APK after the desktop build completed. The installed app is debuggable and `run-as com.bwales.orbit id` succeeds.
- Reproduction: Install the fresh `app-debug.apk` on the connected Android 17 Pixel, start the app with Metro available through `adb reverse`, then observe a blank activity instead of initial app content.

## Current Focus

- bug_class: bohrbug
- hypothesis: Confirmed — the reported blank MainActivity was a premature observation while the debug runtime was still loading the Metro JavaScript bundle; it is not a persistent startup/render failure in the 19-17 APK.
- test: Five force-stop cold launches of the device APK whose SHA-256 exactly equals /tmp/orbit-19-17-debug.apk each reached the expected dashboard; the final cache check showed no persisted BridgelessReactNativeDevBundle.js to mask the behavior.
- expecting: If this diagnosis were false, at least one bounded trial would remain blank after 10 seconds or log a React/Android exception. Neither occurred.
- next_action: Return the device to the Phase 19 executor; it can resume 19-17 picker and durable-import UAT from the healthy dashboard.
- reasoning_checkpoint:
    hypothesis: "A premature observation during Metro debug-bundle startup caused the false blank-MainActivity conclusion; the installed 19-17 APK itself renders normally on Android 17."
    confirming_evidence:
      - "The installed base.apk SHA-256 is cce94c0b70490b026f36e51f5ec88b461ec51af969f59fcdeddd3e3051da35f8, exactly matching /tmp/orbit-19-17-debug.apk."
      - "Five force-stop cold launches exposed the expected dashboard in the bounded poll; screenshots/uiautomator show Your week, two UAT contacts, and the private SQLite orbit.db exists."
      - "ReactNativeJS startup warnings prove JavaScript executed; no Android crash or JS exception was observed."
    falsification_test: "A matching-APK launch that remains without 'Your week' after 10 seconds, or a startup trace containing a React/Android exception, would disprove the diagnosis."
    fix_rationale: "No source-code fix is warranted. Device UAT must wait for a semantic ready condition (dashboard text/root content) rather than sampling the activity immediately after Metro reports bundle delivery."
    blind_spots: "This run preserves existing app data, so it does not independently prove first-install migration from an empty data directory; clearing owner UAT data was intentionally avoided."
    candidate_causes:
      - "code: App bootstrap or native module throws before the React root renders — contradicted by five successful cold starts and the rendered dashboard."
      - "environment: Android 17/Pixel incompatibility prevents React Native rendering — contradicted by the same Android 17 Pixel rendering the hash-matched APK."
      - "config: Metro/adb reverse connection is absent — contradicted by successful ReactNativeJS startup and dashboard rendering on the active tcp:8082 reverse."
    and_gate: "no — a premature readiness observation alone fully explains the original blank snapshot; no co-occurring code/config/environment defect was observed."

## Evidence

- timestamp: "2026-08-29"
  source: Phase 19 Plan 19-17 device UAT attempt
  observation: "Fresh APK installed; Pixel 6 Pro reports Android API 37; Metro bundles successfully, but MainActivity remains blank with no initialized Orbit database and no visible JS/native error."
  implication: "The device-UAT blocker is a startup/render failure rather than a stale APK or failed install."
- timestamp: "2026-08-29T14:19:00-05:00"
  checked: "Fresh force-stop/relaunch on the connected Pixel 6 Pro, filtered logcat, activity state, and package metadata"
  found: "MainActivity is the resumed, drawn, focused window in a live com.bwales.orbit process; the package is debuggable (targetSdk 36); ReactNativeJS emits multiple startup deprecation warnings, with no Android crash or JS exception."
  implication: "The app is not failing before the JavaScript bundle runs. The primary boundary is now inside application bootstrap/rendering or the JS-to-native initialization it invokes; a generic Android-17 launch incompatibility is less likely."
- timestamp: "2026-08-29T14:21:00-05:00"
  checked: "Screenshot captured directly from the resumed Pixel MainActivity after the same fresh force-stop/relaunch"
  found: "The rendered Orbit dashboard is visible with two UAT contacts; it is not an empty FrameLayout or a perpetual bootstrap loading view."
  implication: "The reported blank-activity symptom does not reproduce on the currently installed debug APK. The next test must establish whether this APK is the exact fresh artifact from the failed UAT and whether repeated cold starts remain healthy."
- timestamp: "2026-08-29T14:23:00-05:00"
  checked: "Five planned cold-start trials (the command completed three before its external 30-second bound) and private app storage inspection"
  found: "Trials 1–3 each exposed 'Your week', '2 contacts', 'UAT Ada', and 'UAT Grace' via uiautomator. The app-private SQLite directory contains orbit.db, orbit.db-wal, and orbit.db-shm."
  implication: "The current installed app has repeatedly completed React rendering and database bootstrap. The initial claim that its database never initialized is contradicted for this installation; the verification must now bind this result to the local 19-17 APK artifact before the blocker can be closed."
- timestamp: "2026-08-29T14:30:00-05:00"
  checked: "Installed APK and /tmp/orbit-19-17-debug.apk SHA-256"
  found: "Both artifacts have SHA-256 cce94c0b70490b026f36e51f5ec88b461ec51af969f59fcdeddd3e3051da35f8 and size 347233460 bytes."
  implication: "The successful device launches are of the exact fresh 19-17 debug artifact, not a stale or different APK."
- timestamp: "2026-08-29T14:34:00-05:00"
  checked: "Five bounded force-stop/cold-start trials of the hash-matched APK, polling for dashboard text"
  found: "All five trials reached the 'Your week' dashboard condition at the first reported poll (two seconds plus uiautomator dump overhead); none remained blank or logged a startup exception."
  implication: "The alleged permanent blank activity is not reproducible. The short zero-text probes were not a valid readiness oracle."
- timestamp: "2026-08-29T14:35:00-05:00"
  checked: "Attempt to locate the app's regenerated BridgelessReactNativeDevBundle.js cache before a fresh-bundle test"
  found: "The path is absent in the current app-private files directory, while the dashboard remains visible after cold launch."
  implication: "The repeated cold starts are not being masked by that persistent development-bundle cache; Metro-delivered debug startup remains healthy."

## Eliminated

- hypothesis: "The React Native host fails before JavaScript root registration on Android 17."
  evidence: "ReactNativeJS runs, the exact 19-17 APK renders the dashboard, and five bounded cold starts succeed without a crash or exception."
  timestamp: "2026-08-29T14:36:00-05:00"
- hypothesis: "The Pixel's Android 17 runtime is incompatible with the installed 19-17 debug APK."
  evidence: "The connected API-37 Pixel renders the expected dashboard and can access its existing orbit.db on all five cold-start trials."
  timestamp: "2026-08-29T14:36:00-05:00"

## Resolution

- root_cause: "Premature device-UAT observation during Metro/React Native debug startup; no persistent blank-MainActivity defect reproduces in the exact 19-17 APK."
- fix: "No source change. Use a semantic device-ready assertion (for example, uiautomator finds 'Your week') with a bounded wait before judging launch success."
- verification:
    target_test: "not applicable — this was an operational readiness assertion, not an application-source defect"
    mutation_check: "skipped — no application source changed"
    no_op_deletion: "pass — no application behavior was removed or altered"
    adjacent_tests: "not applicable — no application source changed"
    revert_and_reconfirm: "not applicable — the remedy is the verified UAT readiness condition, not a code diff"
    guardrail_verdict: "accepted — exact artifact identity plus five independent cold launches satisfy the recorded manual reproduction criterion"
- files_changed: ".planning/debug/resolved/android17-blank-main-activity.md"

## Prevention

- **Blameless contributing conditions:** The initial UAT probe sampled the activity before React Native had reached a meaningful render-ready state; Metro bundle-delivery success was treated as sufficient evidence of UI readiness. Code, device compatibility, and Metro connectivity were each checked and contradicted as contributing faults, so the AND-gate remains **no**.
- **Why not caught:** No Phase 19 device-UAT readiness gate existed; the verification step used an immediate visual/content probe rather than a bounded semantic wait.
- **Recurrence guard:** Phase 19 Android device UAT must wait, with a bounded timeout, for a dashboard semantic marker such as `uiautomator` text **"Your week"** before recording a launch failure. This resolved-session and knowledge-base entry preserve the guard for future Metro/React Native startup investigations.
