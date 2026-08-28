---
status: resolved
trigger: Restore a backup opens Android DocumentsUI as a blank PickActivity instead of a usable file picker.
created: 2026-08-28
updated: 2026-08-28
resolution: In-task ACTION_GET_CONTENT direct picker (native pickBackupDocument) + Files->Share receiver fallback; the blank picker was this Pixel's corrupted DocumentsUI, cleared with pm clear com.google.android.documentsui.
---

## FINAL RESOLUTION (supersedes the share-only "Resolution" section below)

The earlier draft resolution proposed replacing the direct button with a Files -> Share ->
Orbit receiver. **The owner rejected that as the primary path** (see the phase
`.continue-here.md`): the direct Restore button had to be repaired, with the share receiver
kept only as an additional route. Actual resolution, verified on the Pixel 2026-08-28:

1. **App fix — direct button repaired.** The native module gained `pickBackupDocument()`,
   which launches `ACTION_GET_CONTENT` in Orbit's own task (no `FLAG_ACTIVITY_NEW_TASK`, so
   `OnActivityResult` still delivers the selection) and copies the chosen file to app cache
   via the same `copyToCache` the share receiver uses. `BackupScreen.chooseRestore` calls it;
   the Files -> Share receiver is retained untouched as a fallback.
2. **Root cause — this device's DocumentsUI.** `ACTION_GET_CONTENT` reproduced the identical
   blank `PickActivity` hang, resolving to the same `com.google.android.documentsui` — proving
   the fault is DocumentsUI on this Pixel (RefreshTask `NullPointerException: name`), not the
   intent action or Orbit's task. `adb shell pm clear com.google.android.documentsui` restored
   rendering, and the direct button then worked end-to-end to `restore-preview-screen` and a
   clean changed-primary Merge.
3. **Falsified hypothesis:** "ACTION_GET_CONTENT avoids the blank DocumentsUI." It does not —
   it lands in the same DocumentsUI PickActivity and hangs identically until the provider is
   reset.

## Symptoms

- Expected behavior: Tapping **Restore a backup** presents a usable system file picker so a JSON backup in Downloads can be selected.
- Actual behavior: Android launches a blank DocumentsUI `PickActivity`; opening Files separately, force-stopping DocumentsUI, and retrying do not make it render.
- Error messages: No in-app error is shown before the picker dead end.
- Timeline: Detected during Phase 18.1 Android UAT; restore flow was shipped in Phase 17.
- Reproduction: In Orbit, open Backup & Restore and tap **Restore a backup** on the connected Pixel.

## Current Focus

reasoning_checkpoint:
  hypothesis: "This Pixel's DocumentsUI fails only in Orbit's activity-result task; an explicit Files-share grant lets Orbit safely copy one chosen JSON backup into private cache and run the existing validation/preview flow."
  confirming_evidence:
    - "The original Expo picker and a separate app-owned bridge both leave DocumentsUI blank, while the final Files → Share → Orbit flow reaches Restore preview."
    - "The final release's real Files share rendered the existing readable-JSON preview without launching DocumentsUI from Orbit or applying data changes."
  falsification_test: "A user-selected Files share of the known JSON fails to reach Restore preview, or the in-app Restore action launches DocumentsUI."
  fix_rationale: "A precise inbound ACTION_SEND filter receives only a user-selected JSON URI grant. Native code copies it immediately to app-private cache; the unchanged parser/encryption/schema/preview validation decides whether it can be restored."
  blind_spots: "User must choose Orbit from Files' full Sharesheet target list; only application/json and text/json source shares are intentionally eligible."
  candidate_causes:
    - "code: startActivityForResult directs Restore into the Pixel's failing DocumentsUI task."
    - "environment: this Pixel's DocumentsUI cannot render either Orbit-owned picker caller task."
    - "platform-config: scoped storage prevents an app-owned cross-app Downloads browser without an explicit user URI grant."
  and_gate: "yes — a solution must avoid the broken DocumentsUI result task and retain a narrowly user-granted Android read capability."
bug_class: bohrbug
hypothesis: "Confirmed and self-verified; awaiting real-workflow confirmation."
test: "Final standalone APK on Pixel: Files → select JSON → Share → Orbit, plus Orbit's Restore button."
expecting: "Restore preview appears without DocumentsUI; Restore button stays in Orbit and explains the Files-share handoff."
next_action: "Ask the user to repeat the Files → Share → Orbit workflow on the deployed Pixel and confirm the preview; then archive and commit only the owned fix files."

## Evidence

- timestamp: 2026-08-28
  checked: final deduplicated standalone release and regression checks
  found: The final droid release installed on Pixel at 09:05. Repeating the real FilesActivity long-press → Share → Orbit flow again reached `restore-preview-screen` with the expected Format version 2, readable JSON, 2 contacts, 2 related rows, and 1 photo. `npx tsc --noEmit`, focused share/restore tests (13), `npm test` (1,510 tests in 135 files), and `git diff --check` all passed. The final Restore button remains in Orbit and shows the Files-share instruction rather than launching DocumentsUI.
  implication: the final deployed artifact preserves existing restore validation, avoids the broken DocumentsUI task, and receives only the user-mediated selected document. It is ready for human workflow confirmation before commit/archive.

- timestamp: 2026-08-28
  checked: real Files → Share → Orbit flow with the known Downloads backup
  found: In the actual FilesActivity, long-pressing `orbit-uat-changed-primary.json`, tapping Share, revealing Orbit in the full target list, and tapping Orbit produced receiver logs `JSON share copied to private cache`. Six seconds later Orbit was the focused window and UiAutomator exposed `restore-preview-screen` with the expected readable-JSON backup details (`Format version: 2`, `Contacts: 2`, `Related rows: 2`, `Photos: 1`) and the existing Merge/Replace preview choices. DocumentsUI was not launched from Orbit and no restore was applied.
  implication: the user-mediated per-document grant works with the app-owned receiver; it copies only the selected file to private cache and reaches existing validation/preview before any data mutation. The previous shell `SecurityException` is correctly explained by shell's lack of grant authority, not an app defect.

- timestamp: 2026-08-28
  checked: native receiver lifecycle telemetry with shell-originated explicit SEND
  found: The rebuilt telemetry release reaches the JSON receiver, but every cache copy fails with `SecurityException`. The launched Orbit task records the selected Downloads URI as a read grant, yet the source is `com.android.shell`; shell does not own the DocumentsProvider permission and therefore cannot delegate it. No DocumentsUI was launched and Orbit stayed on the dashboard.
  implication: the direct explicit intent was a valid resolution/lifecycle test but an invalid data-read test. It cannot falsify the Sharesheet design. The authoritative test must originate in Files, which owns and can delegate the per-document read grant selected by the user.

- timestamp: 2026-08-28
  checked: rebuilt ShareIntentGate release on the connected Pixel
  found: The 08:50 release (SHA-256 `2a1075e9ee719ba1f06f996697cc890ab2e34f4c7ef73ce37005efc2cd952023`) installed successfully at 08:52. A cold explicit delivery of the exact Files-observed `ACTION_SEND application/json` URI grant opened Orbit's focused MainActivity without DocumentsUI, but after six seconds UiAutomator still exposed `dashboard-root`, not Backup or RestorePreview. `dumpsys activity` confirms MainActivity retains the SEND action, MIME type, and a read grant for that exact Downloads URI.
  implication: Android resolution, URI-grant delivery, standalone deployment, and the JavaScript gate's unconditional invocation are all confirmed. The native cache is still false or unconsumed, so the next discriminating test is receiver lifecycle/copy instrumentation rather than another routing change.

- timestamp: 2026-08-28
  checked: receiver retry with gate-time native intent read
  found: The rebuilt 08:47 APK compiled the changed Kotlin receiver and installed successfully, but the same cold `ACTION_SEND application/json` grant still landed on Orbit's dashboard. No DocumentsUI launch occurred.
  implication: the remaining failure is route gating, not intent resolution or native compilation. `ShareIntentGate` only queried `hasSharedBackup()` after expo-share-intent claimed a pending share; on this cold delivery that third-party state did not become truthy, so the native receiver was never consulted. The gate must query the native cache unconditionally once navigation is ready.

- timestamp: 2026-08-28
  checked: first Files-grant receiver test
  found: Delivering the observed Files `ACTION_SEND application/json` URI grant explicitly to the installed Orbit MainActivity opened Orbit but left it on the dashboard instead of the restore preview. The release app did not crash and DocumentsUI was not launched.
  implication: the Android intent filter resolves correctly, but `OnCreate` did not capture the cold-start intent early enough for ShareIntentGate. Expo modules can initialize before `currentActivity` is attached, so the receiver must also inspect the attached activity intent at the gate-time query.

- timestamp: 2026-08-28
  checked: installed inbound-share release and Files integration eligibility
  found: The fresh standalone APK (SHA-256 `c0b9950fb6d0055618b27cb2cde03bc7fe76e6ef00a5d62fab212268b14f39c5`) installed at 08:42. Android resolves `ACTION_SEND` + `application/json` to `com.bwales.orbit/.MainActivity`; its package resolver lists only the two intended backup types in that filter. In Files, selecting `orbit-uat-changed-primary.json` produces a chooser whose clip MIME is directly observed as `application/json` and whose grant URI is `content://com.android.providers.downloads.documents/document/raw%3A%2Fstorage%2Femulated%2F0%2FDownload%2Forbit-uat-changed-primary.json`.
  implication: the known test backup has the precise filter/grant contract required by Orbit. The chooser may initially show only predicted targets, so a direct explicit launch using that Files-provided intent is a valid recipient-path test while preserving the same one-document Android grant semantics.

- timestamp: 2026-08-28
  checked: inbound-share droid prebuild and manifest
  found: The clean prebuild completed. Its generated MainActivity manifest contains `application/json` and `text/json` ACTION_SEND data entries; no `*/*` entry was generated by the backup-share plugin. Existing `text/plain` capture sharing remains separate.
  implication: Orbit is a narrowly scoped JSON backup recipient rather than a broad file-share target, preserving the intended user-mediated capability boundary.

- timestamp: 2026-08-28
  checked: inbound-share implementation static checks
  found: `npx tsc --noEmit`, `src/navigation/backup-share-intent.test.ts`, and `src/screens/backup-restore-logic.test.ts` all passed (13 assertions). The new routing test accepts only one `application/json` or `text/json` file and rejects text, non-JSON, and multi-file shares.
  implication: the JavaScript routing cannot send ordinary Capture shares into restore, and existing restore validation remains unchanged before native/device verification.

- timestamp: 2026-08-28
  checked: Android scoped-storage alternatives
  found: Android's official storage documentation states that reading another app's file in `MediaStore.Downloads` requires the Storage Access Framework; `MediaStore.Downloads` without a broad read grant covers only files owned by Orbit. The document picker documentation identifies an explicit user-selected URI grant as the SAF boundary.
  implication: an app-owned Downloads list would violate the requested Android security semantics. The viable app-owned restore surface is an exact-MIME inbound share receiver that copies the user-selected grant to private cache before existing validation.

- timestamp: 2026-08-28
  checked: rebuilt bridge release in the actual Orbit Restore flow
  found: The 08:25 standalone APK (SHA-256 `fc688be84640dbac33fd65d3c833cfd68d950d87c2975e68efabb10d0eb4013f`) installed successfully on Pixel `1A071FDEE002BU`. From Orbit Backup & Restore, tapping Restore launched the bridge path; after five seconds `mCurrentFocus=null` and UiAutomator returned `null root node`, the same blank DocumentsUI state as Expo's direct path.
  implication: merely moving the caller into a separate app-owned task does not fix the Pixel DocumentsUI rendering defect. The bridge implementation is rejected and must not be committed; the remaining solution must avoid DocumentsUI itself, not only Expo's activity-result wrapper.

- timestamp: 2026-08-28
  checked: detached droid release assembly
  found: The clean-prebuilt droid build produced `android\\app\\build\\outputs\\apk\\release\\app-release.apk` at 08:25 (191,873,554 bytes). Gradle's configuration output explicitly listed `orbit-backup-document-picker` as an Expo module and executed its release manifest-processing tasks.
  implication: the Kotlin bridge compiles and is included in a standalone release artifact ready for the authoritative on-device test.

- timestamp: 2026-08-28
  checked: first clean-prebuilt droid release assembly
  found: Gradle recognized and scheduled `orbit-backup-document-picker`, including its release manifest and resource tasks, but the SSH-attached build ended without `app-release.apk`; its Java workers subsequently exited and its terminal failure was truncated by the connection output limit.
  implication: module discovery and early Kotlin/manifest processing are supported, but the release result is inconclusive. A detached build log is necessary to distinguish a late build failure from a transport/output limitation.

- timestamp: 2026-08-28
  checked: droid clean Android prebuild
  found: `npx expo prebuild --platform android --clean --no-install` completed successfully after the bridge source transfer. The app-owned manifest source does not directly list library activities, as expected; Gradle merges local-module manifests at release manifest-processing time.
  implication: release assembly is now the required compile and manifest-merge test for the Kotlin bridge activity.

- timestamp: 2026-08-28
  checked: droid deployment target and source synchronization
  found: The marker-confirmed `C:\\Users\\bwales\\projects\\orbit-app` droid tree received only the three owned restore files and the new `modules/orbit-backup-document-picker` directory through the documented tar-over-SSH transport.
  implication: the native build experiment will contain this candidate without transferring or altering the user's unrelated local paths.

- timestamp: 2026-08-28
  checked: Expo module autolinking resolution
  found: `npx expo-modules-autolinking search --platform android` and `resolve --platform android` both discovered `modules/orbit-backup-document-picker` and its Kotlin module class with no duplicates.
  implication: the local module will be added to the generated Android project during prebuild; no dependency or app-config change is required.

- timestamp: 2026-08-28
  checked: bridge implementation static checks
  found: `npx tsc --noEmit` passed; `npx vitest run src/screens/backup-restore-logic.test.ts` passed all 11 existing validation tests; and `git diff --check` passed. The only owned JavaScript change replaces Expo DocumentPicker with the bridge adapter; all parsing, encrypted-envelope handling, and restore preview logic is unchanged.
  implication: the TypeScript boundary is sound and the existing restore validation contract remains green before native prebuild/device testing.

- timestamp: 2026-08-28
  checked: local Expo module patterns, backup restore path, and Android storage constraints
  found: Orbit already autolinks local Expo modules from `modules/`; backup restore reads only `File(asset.uri).text()` before its existing schema/encryption validation. The installed Expo picker copies a user-granted content URI into app cache and does not retain a provider URI. Existing automatic-backup folder access is an optional persisted SAF tree grant, so it cannot replace general restore from Downloads.
  implication: a local module can preserve existing behavior by owning a standard SAF single-document result in a non-exported bridge activity, copying the selected bytes to app cache, and returning a file URI without adding storage permissions or weakening restore validation.

- timestamp: 2026-08-28
  checked: restore UI implementation and repository state
  found: `BackupScreen.chooseRestore` calls Expo DocumentPicker with `type: ["application/json", "text/json"]`, `multiple: false`, and `copyToCacheDirectory: true`; there is no app-owned Android activity or manifest configuration for this picker. The worktree contains only pre-existing `tsconfig.json` and unrelated untracked planning/UI files plus this debug record.
  implication: the launch path is controlled by Expo DocumentPicker's Android intent construction; the MIME request is the most direct code candidate, while app manifest configuration is unlikely to control the external DocumentsUI activity.

- timestamp: 2026-08-28
  checked: installed Expo DocumentPicker Android module and connected Pixel availability
  found: Expo DocumentPicker 57 builds a multi-type request as `ACTION_OPEN_DOCUMENT`, `CATEGORY_OPENABLE`, top-level `type="*/*"`, and `Intent.EXTRA_MIME_TYPES` containing the provided array. A connected Pixel 6 Pro exposes `com.google.android.documentsui`; prior logs contain no DocumentsUI exception because the picker is not currently foregrounded.
  implication: an `adb am start` intent with exactly those fields is a clean, app-independent reproduction test; a single `application/json` request is the appropriate one-variable control.

- timestamp: 2026-08-28
  checked: first external reproduction command
  found: the unquoted wildcard was expanded by the remote Android shell, so `am` received a malformed type and did not launch an activity (`Error type 3`, `Activity class {bin/abb} does not exist`).
  implication: this test did not exercise DocumentsUI and neither supports nor refutes the MIME-array hypothesis; the intent must be reissued with the wildcard quoted on the device shell.

- timestamp: 2026-08-28
  checked: exact Expo-shaped external intent on the connected Pixel
  found: `ACTION_OPEN_DOCUMENT` with `type=*/*`, `CATEGORY_OPENABLE`, and `EXTRA_MIME_TYPES=[application/json,text/json]` opens `com.android.documentsui.picker.PickActivity` successfully but remains a blank Files splash screen. DocumentsUI logs `RefreshTask: java.lang.NullPointerException: name` from `DocumentsApplication.acquireUnstableProviderOrThrow` during the launch.
  implication: the reported blank activity is reproducible independently of Orbit and the precise Expo multi-MIME intent is sufficient to trigger it. The provider-side NPE is a competing environment cause; the broad-MIME control will distinguish it from the MIME-array cause.

- timestamp: 2026-08-28
  checked: initial broad-MIME control launch
  found: Android delivered the broad intent to the existing top DocumentsUI instance (`result code=3`) rather than recreating it, so its continued blank screen is confounded by the prior multi-MIME activity state.
  implication: this control is inconclusive. A process restart and fresh broad-intent launch are required before accepting or eliminating the MIME-array hypothesis.

- timestamp: 2026-08-28
  checked: fresh broad-MIME control after force-stopping DocumentsUI
  found: a cold `ACTION_OPEN_DOCUMENT` request with only `type=*/*` renders the normal Files browser within three seconds, including storage providers and recent files. It emits the same provider `RefreshTask` NPE but remains usable.
  implication: the provider warning alone does not explain the blank activity. The difference between the failed and working cases is Expo's multi-MIME intent shape; a single JSON MIME type is now the narrowest candidate fix to test.

- timestamp: 2026-08-28
  checked: fresh single-`application/json` control after force-stopping DocumentsUI
  found: the cold single-type request renders DocumentsUI's actual file-browser hierarchy (search, navigation drawer, provider rows, and recent-files region) rather than the blank splash screen. The same provider `RefreshTask` warning is present, but DocumentsUI remains drawn and interactive.
  implication: the multi-MIME intent construction is confirmed as the app-side trigger. The next check is that this narrower single JSON filter still reaches a JSON backup in Downloads.

- timestamp: 2026-08-28
  checked: single-`application/json` navigation to Downloads
  found: although its chrome/drawer renders, the single-JSON picker remains on an indefinite recent-files spinner and does not load Downloads after selecting it. The Pixel already contains `Download/orbit-uat-changed-primary.json`.
  implication: a single JSON MIME type is not a usable fix on this device. The working wildcard request is the remaining code-side candidate; Orbit already parses and validates every selected file before preview/apply.

- timestamp: 2026-08-28
  checked: focused restore regression suite and TypeScript compilation after the fix
  found: `npx vitest run src/screens/backup-restore-logic.test.ts` passed all 12 tests, including the new wildcard-options assertion; `npx tsc --noEmit` passed.
  implication: the app compiles with the new one-type picker configuration and the focused regression oracle is green.

- timestamp: 2026-08-28
  checked: full regression suite, mutation-tool availability, and implementation diff
  found: `npm test` passed 1,509 tests in 134 files. No Stryker dependency or configuration exists. The owned diff is additive/behavior-preserving: it replaces only the picker argument and retains copy-to-cache plus single-select behavior; schema validation remains unchanged.
  implication: adjacent tests are green, mutation checking must be logged as unavailable, and the fix is not a deletion/no-op workaround. The remaining guardrail step is revert-and-reconfirm.

- timestamp: 2026-08-28
  checked: focused regression after temporarily reverting only the wildcard picker helper and its BackupScreen call
  found: the focused test failed exactly at the restore-picker configuration (`TypeError: restoreDocumentPickerOptions is not a function`; 11 neighboring tests still passed).
  implication: removing the minimal app-side fix reintroduces the guarded configuration failure. Reapplying the same two source changes and regreening the test will complete the causal check.

- timestamp: 2026-08-28
  checked: focused regression and TypeScript compilation after reapplying the wildcard picker helper
  found: the focused suite passed all 12 tests again, `npx tsc --noEmit` passed, and `git diff --check` reported no whitespace errors.
  implication: revert-and-reconfirm is complete. The tested helper now produces the same one-wildcard intent shape that rendered usable Files UI in the isolated Pixel control.

- timestamp: 2026-08-28
  checked: installed package, local artifacts, and droid build-tree metadata
  found: The connected Pixel package is `com.bwales.orbit` version `1.0.0` (code 1), installed at 03:43:49 from shell. Its local `app-release.apk` was built 2026-08-26 14:35, while all three wildcard-picker source edits are timestamped 04:41 on 2026-08-28. The marker-confirmed droid tree has an older `package.json` timestamp (02:54) and release APK (03:42) from the same day.
  implication: The app used in the failed human verification necessarily predates the uncommitted picker change. That result cannot falsify the candidate fix; the exact current source must be rebuilt and installed before reproducing the app-owned flow.

- timestamp: 2026-08-28
  checked: documented clean prebuild and synchronous release-build attempt on droid
  found: The clean Android prebuild completed successfully after the three picker-source files were synchronized. The synchronous SSH command returned before Gradle produced an APK, and the cleaned output directory remains absent; the remote Java workers later stopped without an artifact or captured terminal failure.
  implication: The source transfer and prebuild are confirmed, but the first release-build observation is inconclusive because the SSH/session timeout discarded the terminating Gradle output. A detached build with an explicit log is required rather than treating this as source or device evidence.

- timestamp: 2026-08-28
  checked: current-source standalone release artifact and device installation
  found: The droid release build created `app-release.apk` at 08:00 with a distinct SHA-256 (`c7b630…3393d32`) from the prior local artifact (`1fbc64…e1d04b49`). Its ZIP integrity check passed. It was installed successfully over `com.bwales.orbit`; the Pixel package code path changed and `lastUpdateTime` advanced to 08:03:44. The source was synchronized before that build, and the embedded JS bundle includes the current restore-picker code path.
  implication: The connected Pixel now runs a standalone APK built from the wildcard-picker source, so the next app-owned reproduction is a valid test of the candidate fix rather than a stale-deployment check.

- timestamp: 2026-08-28
  checked: app-owned Restore flow from the rebuilt release APK
  found: The current APK launched `com.android.documentsui.picker.PickActivity` from `com.bwales.orbit` with `ACTION_OPEN_DOCUMENT`, `CATEGORY_OPENABLE`, `type=*/*`, and extras. After 11 seconds it remained an undrawn DocumentsUI splash: `mCurrentFocus=null`, UiAutomator had no root node, and the screenshot was blank. The activity changed the display from Orbit's portrait `ROTATION_0` to `ROTATION_270` because DocumentsUI requests an unspecified orientation.
  implication: Deployment was the first failure, but the wildcard request alone is insufficient in the real flow. The resulting orientation transition is a new, directly observed environment candidate that the earlier adb-only wildcard control did not isolate.

- timestamp: 2026-08-28
  checked: portrait-orientation counterfactual in the app-owned Restore flow
  found: The device's original rotation settings were `accelerometer_rotation=1`, `user_rotation=0`. With acceleration disabled and portrait forced, a cold launch of the rebuilt Orbit release followed by the actual Backup & Restore UI and Restore a backup control still left DocumentsUI on the same blank splash after eight seconds.
  implication: The orientation-transition hypothesis is eliminated. The failure is deterministic with both sensor and fixed portrait; the difference must instead be in another app-owned intent field or the caller/task context.

- timestamp: 2026-08-28
  checked: Expo Android picker implementation and explicit-extra differential control
  found: Expo DocumentPicker 57 constructs only `ACTION_OPEN_DOCUMENT`, `CATEGORY_OPENABLE`, `EXTRA_ALLOW_MULTIPLE=options.multiple`, and the supplied MIME type before calling `startActivityForResult`. JavaScript defaults `multiple` to false. A cold shell control containing the same wildcard MIME type and explicit `EXTRA_ALLOW_MULTIPLE=false` rendered a fully interactive DocumentsUI browser with a valid window and accessibility hierarchy.
  implication: The false multi-select extra is not the remaining trigger. The observed remaining distinction is that Orbit's result-based launch has no `FLAG_ACTIVITY_NEW_TASK` and is embedded in Orbit's task, whereas shell `am start` launches DocumentsUI in its own task with `FLAG_ACTIVITY_NEW_TASK`.

- timestamp: 2026-08-28
  checked: Android platform constraints on a task-splitting workaround
  found: Android's activity-result API documentation states that a launched activity using `FLAG_ACTIVITY_NEW_TASK` does not run in the caller's task and returns an immediate cancelled result to `startActivityForResult`.
  implication: Adding the shell-only new-task flag could make the picker draw but would break selection delivery, so it is not a valid Restore fix.

## Eliminated

- hypothesis: "A dedicated app-owned bridge activity in a distinct task lets DocumentsUI render while preserving an activity result."
  evidence: "The current release APK's bridge-owned restore launch reproduced the blank splash exactly (`mCurrentFocus=null`, no UiAutomator root) on the connected Pixel."
  timestamp: 2026-08-28

- hypothesis: "DocumentsUI's rotation from Orbit portrait to sensor landscape causes the splash hang."
  evidence: "The app-owned picker remained an undrawn splash after a cold retry with Pixel auto-rotation disabled and portrait forced."
  timestamp: 2026-08-28

- hypothesis: "Expo's `EXTRA_ALLOW_MULTIPLE=false` extra causes the splash hang."
  evidence: "A cold shell `ACTION_OPEN_DOCUMENT` control with the same wildcard MIME type and explicit `android.intent.extra.ALLOW_MULTIPLE=false` rendered a complete, interactive DocumentsUI browser."
  timestamp: 2026-08-28

## Resolution

- root_cause: "The original device test was partly stale, but rebuilt releases prove the actual cause: this Pixel's DocumentsUI remains an undrawn splash whenever Orbit launches `ACTION_OPEN_DOCUMENT` through an activity-result caller task. Expo's multi-MIME shape worsens the symptom, but neither wildcard MIME nor a separate Orbit bridge task fixes it. Android scoped storage also prevents Orbit from safely browsing another app's Downloads files itself; it needs an explicit user URI grant."
- fix: "Replace the outbound DocumentsUI picker with a narrow Files-to-Orbit JSON share receiver. Android declares only `application/json` and `text/json` ACTION_SEND targets; native code copies the one user-granted URI into app-private cache exactly once, and navigation opens the existing Backup/Restore preview. The Restore button now gives the Files-share instruction rather than launching DocumentsUI."
- verification:
  target_test:
    result: pass
    suite: Pixel 6 Pro final standalone release, Files → Share → Orbit
    detail: Selected `Download/orbit-uat-changed-primary.json` reached `restore-preview-screen` with Format version 2 and the existing Merge/Replace choices; no restore was applied and Orbit remained focused.
  mutation_check:
    result: skipped
    reason_if_skipped: No Stryker dependency or configuration is present in this repository.
    mutant_killed: not-applicable
  no_op_deletion:
    result: pass
    deletion_justified_by_rca: false
    detail: The change replaces a broken picker task with a precise user-granted inbound flow while retaining parsing, encrypted-envelope handling, schema validation, and preview-before-apply.
  adjacent_tests:
    result: pass
    suites_run:
      - npm test (1510 tests in 135 files)
      - npx tsc --noEmit
      - npx vitest run src/navigation/backup-share-intent.test.ts src/screens/backup-restore-logic.test.ts (13 tests)
      - droid clean-prebuilt standalone Gradle release assembly
  revert_and_reconfirm:
    result: not-applicable
    bug_returned_on_revert: not-run
    fixed_on_reapply: not-run
    detail: Reverting the native share receiver would require a further device rebuild and would deliberately restore the known blank picker path; the direct device acceptance test is the applicable causal signal for this Android integration change.
  guardrail_verdict: accepted-pending-human-verification
- files_changed:
  - app.config.ts
  - plugins/withBackupRestoreShareIntent.js
  - modules/orbit-backup-document-picker/
  - src/navigation/backup-share-intent.ts
  - src/navigation/backup-share-intent.test.ts
  - src/navigation/linking.ts
  - src/screens/BackupScreen.tsx
- oracle_type: derived (Android per-document grant contract and existing RestorePreview validation, verified by final Files-originated delivery on Pixel)
