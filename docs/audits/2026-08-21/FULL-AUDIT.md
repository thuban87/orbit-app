# Orbit Full Codebase Audit

**Audit date:** 2026-08-21  
**Code snapshot:** `a4da2bd` plus the implementation present on disk  
**Platform emphasis:** Android-first Expo / React Native app, Android home-screen widget, local SQLite and document storage  
**Audit mode:** Read-only source, dependency, configuration, test, and retained-artifact review. Only the reports in this directory were created.  
**Overall verdict:** **Orbit has a thoughtful and well-tested local-first core, but the reviewed Android build is not ready for production distribution or accessibility sign-off.**

## Executive assessment

Orbit is substantially healthier than a typical app at this stage. SQLite is the source of truth; foreign keys, WAL, and a busy timeout are enabled before migrations; production business writes found in the audit pass through a shared mutex/transaction boundary; SQL values are bound and dynamic identifiers are allowlisted; typed navigation covers every registered route; destructive contact deletion is deliberately staged; and private data does not currently flow to analytics, a backend, or the dormant AI layer. The 83-file, 1,009-test suite, strict TypeScript check, and color-token gate all pass.

The release boundary is weaker than the in-app core. The retained release APK exposes launcher-widget screenshots through an exported provider with no permission, and the artifact is signed by the Android debug certificate. Normal app workflows can also make photo bytes diverge from SQLite/form state, silently acknowledge failed notification actions, race database bootstrap, and perform a duplicate unbounded URL-image transfer. These are concrete source- or artifact-proven issues, not theoretical scale warnings.

Accessibility is the other major sign-off gap. Favourites reorder is drag-only; the Skia Orrery has no accessible contact/action model; dashboard cards hide their meaningful state from assistive technology; custom chrome does not consume safe-area insets; custom date/number fields accept invalid values; and long-lived profile history is fully mounted without pagination or virtualization. No rendered UI, navigation, accessibility, screenshot, or end-to-end test harness currently catches regressions in these areas.

The correct release posture is therefore:

- **Do not distribute the reviewed widget-capable Android build.** Fix and verify the exported widget image provider first.
- **Do not treat the retained `app-release.apk` as a production artifact.** It is debug-signed.
- **Do not claim data-loss-safe photo editing or reliable background actions** until file/DB commit ordering, database bootstrap, and notification failure handling are corrected and fault-tested.
- **Do not claim accessibility conformance** until the seven high-severity UI/accessibility findings are remediated and checked on a physical device with TalkBack, large text, Reduce Motion, cutouts, and gesture navigation.

## Companion reports

This document deduplicates and prioritizes four detailed reports. File/line evidence, failure scenarios, remediation guidance, and device test matrices remain in those reports:

- [Security and privacy](./SECURITY-PRIVACY.md)
- [Performance and reliability](./PERFORMANCE-RELIABILITY.md)
- [UI, accessibility, and product quality](./UI-ACCESSIBILITY-QUALITY.md)
- [Architecture, data integrity, and build quality](./ARCHITECTURE-DATA-INTEGRITY.md)

## Finding totals

The specialist reports contain 63 entries. Counts are intentionally **not** a count of unique root causes: database bootstrap, migration validation, photo lifecycle, URL intake, unbounded profile history, launch maintenance, and quality-gate issues appear in more than one report because they cross disciplines.

| Report | Critical | High | Medium | Low | Info | Total |
|---|---:|---:|---:|---:|---:|---:|
| Security / privacy | 0 | 1 | 4 | 6 | 1 | 12 |
| Performance / reliability | 0 | 4 | 7 | 6 | 0 | 17 |
| UI / accessibility / product quality | 0 | 7 | 15 | 1 | 0 | 23 |
| Architecture / data integrity / build | 0 | 1 | 6 | 4 | 0 | 11 |
| **Raw specialist entries** | **0** | **13** | **32** | **17** | **1** | **63** |

No critical issue was found. That does not imply release readiness: the widget disclosure is directly exploitable by another installed app, and several high findings can lose local data or make a core workflow unavailable to assistive-technology users.

## Release blockers and highest priorities

### P0 — Block distribution or reliability/accessibility sign-off

#### 1. Protect widget-rendered images before distributing any widget-capable build

**References:** SEC-001; related SEC-005.

`react-native-android-widget` 0.22.0 contributes an exported `RNWidgetImageProvider` with no read permission. The merged Aug 17 release APK confirms the provider is present as `android:exported="true"`. It serves predictably named `widget_<id>_mode_<light|dark>.png` files, and Orbit's large widget can render contact names, photos, and conversational fuel. `query()` does not list files and the canonical-path check prevents arbitrary file reads, but any installed app can probe and read a correctly guessed widget URI.

Fix the native manifest/provider behavior, then verify the **merged release manifest and installed APK**, not only TypeScript or plugin configuration. A release acceptance test should show that an unrelated app cannot open the content URI, while the launcher can still render the widget.

#### 2. Establish real production signing and artifact provenance

**Reference:** SEC-002.

Both retained Aug 17 APKs are signed with the same Android debug certificate (`CN=Android Debug`). The release APK is not debuggable, but its signing identity makes it unsuitable for production distribution or as the basis for an update lineage. Define the production signing path, restrict key access, record the expected certificate digest, and make signature verification a release gate.

#### 3. Make photo edits transactional across files, forms, and SQLite

**References:** PERF-002, ADI-001, SEC-007.

Stable photo filenames are replaced before the corresponding contact/profile database write. Custom-field crops persist bytes before the Edit form is saved; removing a committed custom photo deletes the file immediately even if the user later cancels; re-cropping an existing stable path and canceling cannot restore the old bytes. Separately, deleting/expiring a photo field or changing it to another type can erase the metadata needed to clean up its canonical image, leaving private bytes indefinitely.

Use versioned immutable filenames or an explicit old/new ledger. Commit the new reference first, delete the old file only after successful commit, and restore/delete staged files on every cancel/failure path. Field deletion, expiry, type change, and contact purge need one retention policy and fault-injection tests at each await boundary.

#### 4. Coalesce database initialization and harden migration admission

**References:** PERF-001, ADI-002, PERF-012, SEC-009, SEC-010.

`openAndMigrate()` caches only a completed connection. Concurrent foreground, notification, and widget calls can all pass the initial cache check and attempt open/migration work. The migration runner also does not reject newer databases, duplicate/gapped migration manifests, or a final version below the declared target.

Cache the in-flight open promise before the first await, reset it safely on failure, and use a database-level strategy for coordination across separate JS runtimes. Validate unique contiguous migrations, reject downgrades/newer schemas explicitly, and assert the final target version. Add concurrent-open, gap, duplicate, downgrade, and failure-retry tests.

#### 5. Replace the URL-photo fallback with one bounded, cancellable transfer

**References:** PERF-003, SEC-004.

The current flow first calls `fetch()` for status, redirects, and content type. On React Native runtimes without a readable body stream, it leaves that response unconsumed and makes a second native GET. The second request has no in-flight byte cap and is measured only after fully writing to disk; neither request has a timeout, and decoded-pixel dimensions are not bounded before expensive manipulation.

Use one native transfer that exposes final URL, status, headers, progress, cancellation, and a hard byte limit. Add time and decoded-pixel limits, clean every partial file, and verify one request per import against slow, chunked, redirecting, over-cap, disconnecting, and decompression-bomb-like inputs.

#### 6. Do not acknowledge genuine notification-action failures as success

**Reference:** PERF-004; related ADI-003/004.

The notification action handler correctly treats durable duplicate-UID collisions as benign, but its generic catch only logs and then returns. The killed-app task consequently resolves normally even when “Mark contacted” or “Snooze 1 week” failed, with no retry queue or visible error.

Separate durable write outcome from best-effort notification cancellation. Rethrow/report genuine failures or persist an idempotent retry record before acknowledging. Fault-test database-open, busy, write, and OS cancellation failures; a committed write plus failed notification cancellation must not be classified as a failed write.

#### 7. Resolve the high-impact accessibility and supported-layout gaps

**References:** UX-001 through UX-007.

Before accessibility sign-off:

- consume safe-area insets in custom screen chrome and verify edge-to-edge Android layouts;
- provide non-drag controls for favourites reordering;
- expose an accessible semantic list/action model for the Orrery rather than one opaque canvas;
- make Capture inline-create a real modal interaction whose Back behavior returns to the share flow;
- replace permissive date/number text entry with the settled constrained input behavior;
- include status, favourite, category, and fuel state in dashboard card semantics; and
- page/virtualize accumulated profile history instead of mounting it all in a `ScrollView`.

These must be checked with TalkBack and switch access on a physical Android device; source-only semantics are insufficient evidence.

#### 8. Create one passing, reproducible release gate

**References:** ADI-006, ADI-007, UX-020, UX-021, PERF-017.

The unit suite, TypeScript, and color gate pass independently, but the repository has no aggregate `check` command or CI workflow. Biome fails. Expo Doctor fails because `react-native-worklets` is not directly declared and six Expo packages do not match the SDK's expected patch versions. Coverage thresholds, rendered UI tests, native integration tests, and release artifact verification are absent.

A release gate should at minimum run clean install/patch application, TypeScript, Biome, color checks, unit tests, coverage thresholds, Expo Doctor, an Android release build, merged-manifest policy checks, signature checks, dependency audit triage, and a small native/device smoke suite.

## P1 — Correctness, privacy, and lifecycle hardening

After the P0 work, address these cross-cutting groups:

1. **Isolate launch maintenance failures.** One rejecting launch-sweep hook currently skips later work, discards an overlapping rerun, and can become an unhandled rejection. Settings also launches schedule reconciliation without a catch. Run each hook independently, continue after failure, retain pending reruns, and expose structured outcomes (PERF-005, ADI-003, ADI-004).
2. **Make reload state monotonic.** Dashboard and Profile can publish older or mixed snapshots after overlapping focus, foreground, pull-refresh, or mutation loads. Use a screen-wide generation/coordinator and consistent read snapshots (PERF-007).
3. **Fix crop source-generation races and unsaved fuel state.** The crop fallback can replace its decoded source after geometry was initialized; existing uncontrolled fuel inputs can keep displaying values that failed to persist (PERF-006, PERF-009).
4. **Harden external-entry lifecycle.** Installed share-intent native code can emit through a missing module instance or lose a warm intent during bridge recreation. Store before emit and clear only after successful JS consumption (PERF-011).
5. **Make widget actions one-shot and review launcher disclosure.** Widget “Mark” tokens are mutable/replayable and each delivery intentionally produces a new UID/history row. Conversational fuel is shown on the launcher by default. Use one-shot authorization and make launcher-visible fuel an explicit, informed privacy choice (SEC-003, SEC-005).
6. **Correct state and feedback gaps.** Read failures masquerade as empty states; keyboard dismissal can consume the first action tap; success is not announced; Log Contact's React-state latch can admit a rapid duplicate; photo crop lacks a terminal decode state; Profile lacks a missing/loading guard; settings failures are silent; and timeline refine opens content below the current viewport (UX-008, UX-009, UX-011, UX-012, UX-015, UX-016, UX-019, UX-022).
7. **Complete accessibility semantics and responsive behavior.** Respect Reduce Motion, meet non-text contrast, expose dropdown selected/current state, guarantee Android-size targets, test large-font layouts, and give text inputs durable accessible names (UX-010, UX-013, UX-014, UX-017, UX-018, UX-023).

## P2 — Measured performance and maintainability work

These are real code-shape risks but should be benchmarked and fixed proportionally rather than triggering a broad rewrite:

- Profile reads and renders all accumulated timeline/fuel data and duplicates some history reads. Add paging/“load older,” virtualize, and consolidate bounded queries (PERF-008; overlaps UX-007).
- Fuel, events, links, and purge paths lack contact-scoped indexes. Real-schema `EXPLAIN QUERY PLAN` shows scans, but the checked-in Phase 2 physical-Pixel status benchmarks remain below budget. Add indexes only after representative before/after device measurement (PERF-013).
- Every widget refresh re-decodes and re-encodes visible photos. Cache by source revision/theme/size and measure launcher-update battery/latency (PERF-014).
- The retained release is a 151,424,230-byte universal APK containing four ABIs, with an estimated compressed download size around 64.9 MB. Use app bundles or ABI splits and add a size budget (PERF-015).
- Custom-field settings performs serial per-definition emptiness checks. Replace with one aggregate query if device measurement shows user-visible delay (PERF-016).
- Orrery's minimum gap can push rings outside the canvas and collapse multiple bodies at the rim at plausible contact counts. Preserve the radius invariant or introduce an explicit overflow representation, then verify 20/30-body layouts on the Pixel (PERF-010).
- Dormant legacy schema, status, type-change, and AI modules already diverge from production behavior. Remove, isolate, or clearly gate them before they become accidental integration surfaces (ADI-009).
- Add bounded lengths for names, notes, links, labels, custom values, and shared text based on explicit product/storage limits (ADI-010).

## Product-owner security and data decisions

These are not purely implementation choices and should be documented before release:

| Decision | Current behavior | Recommended default |
|---|---|---|
| Launcher widget fuel | Large widget shows conversational fuel | Redact by default; explicit informed opt-in if retained |
| Screenshots / task switcher | Sensitive screens can be captured and previewed | Decide whether an app-level privacy-screen/secure mode is warranted |
| Time semantics | Interaction ordering uses local wall-clock strings | Document travel/DST behavior or migrate to an instant plus display timezone |
| AI activation | Provider/prompt code is dormant, with no current caller | Require secure key storage, HTTPS enforcement, preview/consent, minimization, and log redaction before activation |
| iOS | Explicitly deferred; public config resolves invalid extension identifiers | Treat iOS config as unsupported until bundle/group identifiers and native lifecycle tests are completed |

## Security and dependency posture

Positive security findings:

- No live analytics, telemetry, crash-reporting SDK, remote backend, hard-coded credential, arbitrary SQL injection path, photo path traversal, or production AI egress was found.
- `allowBackup=false` is present in the merged release manifest.
- Notification bodies are deliberately sparse; app data remains in app-private SQLite/documents under ordinary Android sandboxing.
- SQL values are bound, dynamic identifiers are validated, and contact purge is a deliberate two-stage operation.
- The widget provider's path validation confines the disclosure to its widget image directory; SEC-001 is an unauthorized read of rendered snapshots, not arbitrary filesystem access.

Dependency evidence:

- `npm ls --depth=0` is clean.
- Online `npm audit --omit=dev --json` reports 17 affected dependency nodes: 10 high, 7 moderate, 0 critical.
- Those node counts collapse to two high `image-size` infinite-loop denial-of-service advisories propagating through Metro/build tooling and one moderate `uuid` bounds advisory through Xcode/config tooling. This is primarily build/tooling reachability, not evidence of 17 exploitable mobile-runtime paths.
- Do not accept npm's proposed downgrade of `react-native-android-widget` to 0.17.2 without compatibility and security review; the known exported-provider defect needs an intentional native fix and merged-artifact verification.

## Architecture and quality strengths worth preserving

- A clear local-first boundary with SQLite as the source of truth and narrow AsyncStorage use for UI preferences.
- Shared transaction/mutex write discipline and a single recency recompute writer.
- Foreign keys, WAL, and busy timeout configured before migrations.
- Bound SQL values and allowlisted dynamic identifiers for custom fields/sorts.
- Typed navigation and a traced, reachable route graph.
- Strong pure logic/data coverage: 83 test files and 1,009 passing tests.
- Deliberate two-stage destructive contact deletion.
- Crash-aware `.tmp`/`.bak` photo replacement and launch reconciliation within the filesystem operation, even though the DB/form boundary still needs correction.
- Skia/Reanimated animation work stays off React state per frame and pauses off-focus/background.
- Color-token enforcement passes, and the UI has a coherent visual system.
- No evidence of hidden data egress in the currently active product.

## Verification evidence

| Check | Result |
|---|---|
| `npm test -- --run` | **PASS** — 83 files, 1,009 tests |
| `npx tsc --noEmit` | **PASS** |
| `npm run check:colors` | **PASS** |
| `npx biome check . --max-diagnostics=200` | **FAIL** — 28 errors, 2 warnings, 3 info across 262 files |
| `npx expo-doctor` | **FAIL** — 19/21 checks passed; worklets declaration and six Expo patch mismatches |
| `npm ls --depth=0` | **PASS** |
| `npm audit --omit=dev --json` | **FAIL** — 17 affected nodes: 10 high, 7 moderate, 0 critical |
| Real-schema `EXPLAIN QUERY PLAN` probes | Interaction index used; fuel/events and several sort paths scan/use temporary B-trees |
| Retained release APK manifest | Provider disclosure confirmed; `allowBackup=false`; target SDK 36, min SDK 24 |
| Retained APK signature | **FAIL for production** — release and debug artifacts use Android debug certificate |
| Retained release APK size | 151,424,230 bytes; universal four-ABI artifact |
| Physical device / emulator availability | None attached; no runtime UI, accessibility, performance, notification, or widget validation performed |

## Recommended remediation sequence

1. **Contain distribution risk:** fix provider export/permission behavior, remove the debug-signed artifact from release consideration, and establish production signing plus merged-manifest checks.
2. **Protect local truth:** redesign photo staging/commit/cleanup, coalesce DB initialization, validate migration manifests, and make notification actions durably observable/retryable.
3. **Bound external inputs:** implement a single cancellable URL transfer with byte/time/pixel limits and explicit input-length limits.
4. **Restore release gates:** align Expo patches, declare worklets directly, make Biome pass, add an aggregate check/CI workflow, triage advisories, and build/sign a reproducible release artifact.
5. **Complete accessibility work:** safe-area handling, reorder alternative, Orrery semantics, card state, Capture modality, constrained input, motion/contrast/targets, and a virtualized/paged profile.
6. **Add native/device coverage:** run fault injection, notification/share/widget lifecycle tests, and accessibility UAT on the physical Pixel.
7. **Measure before tuning:** profile profile-history growth, query indexes, widget encoding, Orrery density, startup, memory, frame time, and APK size in a release build.

## Release acceptance criteria

Orbit should not move to production sign-off until all of the following are true:

- The merged release APK does not expose widget bitmaps to an unrelated installed app, demonstrated with an `adb content read`/equivalent negative test.
- The release certificate digest matches the documented production key and the artifact is reproducibly built, non-debuggable, and policy-checked.
- Photo replace/remove/cancel/save paths pass injected disk/DB failures without losing the old photo, exposing uncommitted bytes, or retaining deleted custom-field photos.
- Concurrent foreground/widget/notification database opens use one safe initialization path, and migration gap/downgrade tests fail closed.
- Notification action failures are distinguishable from success and have a tested retry/reporting strategy.
- URL-photo tests prove one request, timeout/cancellation, byte and decoded-pixel bounds, redirect enforcement, and cleanup of partial files.
- One repository command and CI job pass TypeScript, Biome, color checks, tests/coverage, Expo Doctor, dependency triage, release build, manifest, signature, and size checks.
- The seven high UI/accessibility issues are remediated and verified with TalkBack, switch access, large text, Reduce Motion, cutout/edge-to-edge layouts, hardware Back, and gesture navigation.
- A physical-Pixel release-build pass covers startup, dashboard/profile growth, Orrery at realistic density, share capture, photo crop/import, notification actions, widget render/actions, foreground/background transitions, and process-death recovery.

## Audit limitations

- No Android device or local AVD was attached. Per the repository's own rules, emulator timing would not be valid performance evidence anyway; a physical Pixel release build remains required.
- The ignored generated `android/` and `ios/` projects are absent. The retained Aug 17 APK supplies point-in-time Android merged-manifest/signature/size evidence but may not exactly match the Aug 21 TypeScript source.
- No destructive fault injection, disk-full simulation, SQLite corruption exercise, OEM notification test, launcher-specific widget test, or bridge-recreation share test was performed.
- Coverage percentages cannot be reported because no Vitest coverage provider or thresholds are configured.
- This is a code/configuration/artifact audit, not a formal penetration test, Play Console policy review, cryptographic review, or visual accessibility certification.
- iOS is explicitly deferred; its configuration findings are readiness warnings, not Android blockers.

## Bottom line

Orbit does not need an architectural rewrite. Its strongest qualities—local-first storage, disciplined SQLite writers, typed boundaries, deliberate privacy choices, and deep pure-logic coverage—should remain. The path to a trustworthy release is a focused hardening pass around the places where the app crosses boundaries: launcher/native providers, signing/build output, files versus database commits, foreground versus headless lifecycle, external network input, and pixels versus accessible semantics.
