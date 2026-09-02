# Orbit performance and reliability audit

Audit date: 2026-08-21
Repository: `/home/bwales/projects/orbit-app`
Mode: read-only review; this report is the only file written

## Executive verdict

Orbit has a strong local-first foundation and unusually deliberate handling of SQLite writes, notification/widget headless entry points, and Skia lifecycle. The automated suite is fully green, the TypeScript build is clean, the primary contact-status queries have prior physical-Pixel timing evidence well below their budget, and the orrery avoids React-state-per-frame work.

The code is **not yet reliability-signoff ready**. Four high-severity paths can silently lose an action, make file state diverge from SQLite/form state, download an unbounded/duplicate URL payload, or race database bootstrap. None is a demonstrated widespread production failure, but all are reachable from normal product surfaces and should be addressed before treating the local data path as crash/failure safe.

The main optimization risks are narrower. Orbit is explicitly designed for tens of contacts, and this audit does not manufacture hundreds-of-thousands-of-contact problems. The meaningful accumulation axis is years of per-contact history and fuel. Current profile rendering eagerly reads and mounts all of that history, current fuel/event paths lack supporting indexes, widget image work repeats on every push, and the retained universal APK is large. These require measurement and targeted changes, not speculative rewrites.

Finding count:

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 4 |
| Medium | 7 |
| Low | 6 |
| Informational | 0 |
| **Total** | **17** |

## Scope, method, and limitations

Reviewed directly on disk:

- React screen/component state, effects, listener/timer cleanup, list rendering, and async reload behavior.
- SQLite bootstrap, PRAGMAs, migration runner, schema/indexes, transaction primitive, mutex, read/write DAOs, launch sweep, and query shapes.
- Photo pick, URL download, crop, encode, persistent storage, cache busting, launch reconciliation, and custom-photo staging.
- Notifications: schedule reconciliation, foreground response gate, killed-app task, action idempotency, channels/categories, snooze and mark paths.
- Widget data, thumbnail encoding, RemoteViews render, event-push refresh, headless task, deep links, and boot receiver.
- Share-intent provider/gate/capture lifecycle plus the installed native dependency and committed patch.
- Navigation/deep-link readiness, orrery geometry, Skia/Reanimated worklets, pause-on-blur/background, and app startup ordering.
- Retained `app-release.apk` / `app-debug.apk` artifacts and the desktop build runbook.

Checks run:

- `npm test -- --reporter=dot`: **83/83 test files and 1,009/1,009 tests passed**.
- `npx tsc --noEmit --pretty false`: **passed with no diagnostics**.
- `EXPLAIN QUERY PLAN` through the real migration schema using the repository's `node:sqlite` adapter for dashboard, search, timeline, fuel, impact, capture, and orrery reads.
- `apkanalyzer`, `unzip`, and manifest inspection of the retained Aug-17 release artifact.

Limitations:

- No Android device was attached. No runtime frame, JS-thread, GPU, memory, thermal, battery, startup, widget, notification, or photo profile was performed in this audit.
- Per `CLAUDE.md`, emulator performance is not valid evidence for Orbit. All UI/Skia conclusions here are static architectural findings. A physical Pixel release build is required for runtime claims.
- The retained APK is dated 2026-08-17 and may not contain the exact 2026-08-21 source. It is packaging evidence only.
- Node SQLite query plans establish index selection and scan shape, not Android latency. Android/bionic and on-device filesystem/OS-service performance must be measured separately.
- Prior Pixel benchmark numbers are taken from the checked-in Phase 2 artifact; this audit did not rerun them.
- This was a code/config/artifact audit, not destructive fault injection. Disk-full, process-kill-at-every-await, SQLite corruption, notification OEM behavior, and Android headless time-budget outcomes remain unproven.

## Severity rubric

| Severity | Meaning in this report |
|---|---|
| Critical | Likely catastrophic data loss, persistent startup failure, or broadly exploitable resource failure with no practical workaround. |
| High | Normal or credible user flow can silently lose/alter data or actions, break a core path, or exhaust material resources; remediation should precede reliability signoff. |
| Medium | Conditional correctness failure, stale/inconsistent UI, lifecycle race, or material degradation as normal history grows. |
| Low | Bounded optimization, build/distribution fragility, or future-proofing gap with limited current-user impact. |
| Informational | Observation without a requested change. |

## Findings

### High

#### PERF-001 — Database open/migration bootstrap is not single-flight

**Class:** correctness/reliability
**Evidence:** `src/db/database.ts:89-117`; callers at `App.tsx:105-115`, `src/services/notifications/notification-actions.ts:122-126`, `src/services/widget/widget-render.tsx:144-150`, and `src/services/widget/widget-task-handler.tsx:90-95`.

`openAndMigrate()` caches only a fully completed database. Two calls that arrive before line 116 both pass the `cachedDb` check, both open `orbit.db`, both apply PRAGMAs, and both independently inspect/run migrations. The module comments call the operation idempotent, but there is no cached in-flight promise.

**Trigger/scenario:** cold foreground bootstrap overlaps a widget lifecycle render, widget mark, or notification action callback in the same JS runtime; or two headless callbacks arrive together. On a fresh install/upgrade both callers can calculate the same pending migration set. Across separate runtimes, the JS mutex cannot coordinate them at all.

**User impact:** duplicate connections, avoidable I/O, `SQLITE_BUSY` delays up to the five-second timeout, duplicate-DDL migration failure, or a silent failed widget/notification action. A foreground bootstrap failure presents “Couldn't start Orbit.”

**Remediation:** cache an `openingPromise` before the first await, return it to all in-runtime callers, set `cachedDb` only on success, close/reset on rejection, and add a concurrency test that calls `openAndMigrate()` many times before the first open resolves. For cross-runtime migration contention, serialize migration acquisition with an explicit database-level strategy and re-read `user_version` under that strategy; do not rely only on the module mutex.

#### PERF-002 — Photo bytes become authoritative before the matching DB/form commit

**Class:** correctness/data-loss reliability
**Evidence:** deterministic paths at `src/services/photos/photo-storage.ts:73-107`; replacement swap/final backup deletion at `src/services/photos/photo-storage.ts:153-193`; crop persists before contact/profile DAO writes at `src/screens/CropPhotoScreen.tsx:267-295`; custom remove deletes immediately at `src/components/PhotoSourcePicker.tsx:157-186`; cancel cleanup preserves a staged path if the old committed value has that same path at `src/screens/EditContactScreen.tsx:219-245`.

All photo targets reuse stable filenames. `persistMaster()` replaces the canonical file and deletes the backup before `CropPhotoScreen` performs the contact/profile SQLite update. Custom-field crops intentionally perform no DB write until the edit form's later Save. Removing a custom photo deletes the committed file immediately, while only staging `null` in the form.

**Trigger/scenario:**

- Contact/profile replacement succeeds on disk and the later DAO write fails.
- A user re-crops an already-committed custom photo, then cancels Edit. The committed DB value equals the stable path, so cleanup keeps the new bytes rather than restoring the old bytes.
- A user removes a committed custom photo, then cancels Edit. SQLite still references the old path, but the file is already deleted.
- The `.bak` move succeeds and the subsequent `.tmp` move fails; the canonical path remains absent until a later launch reconciliation.

**User impact:** cancel does not mean cancel; a prior image can be irrecoverably overwritten or deleted; the database can reference missing bytes; an error alert can claim save failure even though visible photo content changed. This is local-only data with no server recovery.

**Remediation:** use immutable/versioned filenames for new masters. Persist new bytes to a new path, atomically update the DB/form reference, and delete the old path only after commit. For staged custom photos, keep an explicit old/new version ledger and restore/delete on cancel. Delay custom-photo deletion until successful form Save. If stable names must remain, retain `.bak` until the DB commit and restore it on every failure/cancel path.

#### PERF-003 — URL photo import performs a second GET and has no bounded in-flight fallback

**Class:** performance/resource reliability
**Evidence:** validation fetch at `src/services/photos/url-image.ts:289-326`; no-stream fallback at `src/services/photos/url-image.ts:347-392`; native transfer and only-after-download size check at `src/services/photos/url-image.ts:241-259`.

The function first calls `fetch(url)` to inspect redirect URL, status, and content type. If `response.body.getReader` is unavailable—a path the file itself says is frequent on React Native—it does not consume/cancel that response and calls `File.downloadFileAsync(response.url, ...)`, making a second request. The second request has no in-flight byte cap and is checked only after it has fully written to disk. Neither request has an abort timeout. The first React Native fetch may also buffer its body depending on runtime implementation, so the code cannot substantiate its “never unbounded in JS heap” claim on that path.

**Trigger/scenario:** paste an HTTPS image URL on a runtime without a readable response stream; use a slow, changing, or very large endpoint.

**User impact:** doubled network/radio use, potentially two full transfers, indefinite busy state on a stalled server, large transient disk consumption despite the advertised 8 MB cap, and possible memory pressure/OOM in a buffering fetch implementation. The bytes downloaded by the second request can also differ from the response that was validated.

**Remediation:** use one native HTTP/download implementation that exposes final URL, status, headers, byte progress, redirect policy, cancellation, and a hard maximum while streaming. Add a timeout/AbortController and delete partial files on every exit. If the platform cannot enforce the cap during download, fail closed rather than issuing a second unbounded request. Add device tests with chunked/no-length, over-cap, redirect-changing, slow, and disconnecting servers, and assert one request per import.

#### PERF-004 — Genuine notification-action failures are logged and acknowledged as success

**Class:** correctness/reliability
**Evidence:** action write/cancel at `src/services/notifications/notification-actions.ts:130-167`; generic catch at `src/services/notifications/notification-actions.ts:168-181`; headless wrapper considers the resolved call complete at `src/services/notifications/headless-task.ts:65-85`.

The handler correctly swallows only durable duplicate-UID collisions, but its generic error branch also returns normally after logging. This contradicts the comment that a genuine transient failure is “surfaced.” The caller cannot tell whether mark/snooze committed. The killed-app task then resolves normally; there is no durable retry queue.

**Trigger/scenario:** a notification action hits database bootstrap contention, a transient SQLite/filesystem error, an OS cancellation error before `handledSet.add`, or another non-UNIQUE failure.

**User impact:** “Mark contacted” or “Snooze 1 week” can silently do nothing while the headless task reports completion. The user receives no UI error because the action deliberately does not foreground the app. A later delivery is only hypothetical; no code schedules it.

**Remediation:** separate durable write outcome from best-effort notification cancellation. Retry bounded transient DB failures within the headless budget, persist an idempotent pending-action record before acknowledging if durable retry is required, and rethrow/report non-duplicate failures to callers. A cancellation failure after a committed write must not classify the write as failed. Add fault-injection tests for bootstrap failure, busy DB, write failure, and cancel failure.

### Medium

#### PERF-005 — One launch-sweep failure aborts later maintenance and can become unhandled

**Class:** correctness/reliability
**Evidence:** bare sequential hook loop and unconditional pending reset at `src/services/launch-sweep.ts:71-89`; fire-and-forget invocations without catches at `src/services/launch-sweep.ts:102-114`; registration order at `App.tsx:125-180`; throwing field scan/prune boundaries at `src/services/field-sweep.ts:98-132`; notification reconcile's unguarded top-level reads at `src/services/notifications/notification-schedule.ts:374-397`; Settings fire-and-forget call at `src/screens/SettingsScreen.tsx:241-253`.

Per-item work is often isolated, but the registry itself is not. A field candidate scan/history prune or notification settings/OS enumeration failure rejects the loop, skips all later hooks, and is launched with `void` from both cold start and foreground transitions. `finally` clears `pendingRerun`, so an overlapping foreground request can also be lost on the failing pass. Settings likewise calls `void reconcileSchedule(exec)` without a rejection handler.

**Trigger/scenario:** transient database or OS notification API rejection during cold start/foreground maintenance.

**User impact:** photo recovery, schedule reconciliation, or widget refresh may not run until another launch; the Promise rejection may be unhandled; the screen setting appears saved even when its schedule refresh failed.

**Remediation:** isolate every hook with named try/catch and continue, make the trigger explicitly `.catch` unexpected runner failures, retain/requeue `pendingRerun` after failure, and attach a catch in Settings. Return structured per-hook outcomes for diagnostics. Add a test where each hook position throws and prove later hooks and a pending rerun still execute.

#### PERF-006 — Crop decode fallback can swap the source after geometry initialized

**Class:** correctness/reliability
**Evidence:** one-time geometry guard at `src/screens/CropPhotoScreen.tsx:141-168`; asynchronous fallback timer/manipulation at `src/screens/CropPhotoScreen.tsx:170-197`; crop uses stored geometry with the current `sourceUri` at `src/screens/CropPhotoScreen.tsx:251-272`.

If the 2.5-second fallback starts and the original `useImage` resolves while manipulation is in flight, geometry can initialize from the original dimensions. The fallback can then replace `sourceUri`; `initedRef` prevents geometry from recomputing. Confirm crops the downscaled URI using dimensions/transform derived from the original. The async fallback also has no mounted/generation guard after its native awaits.

**Trigger/scenario:** a large or slow-decode image resolves near the fallback threshold.

**User impact:** crop coordinates can be wrong or out of bounds, save can fail, or the resulting crop can differ from the preview. Portrait fallback resizes by width only, so “max edge” is not actually capped for a tall source.

**Remediation:** attach a generation token to each source, cancel/ignore fallback completion once the original decodes or the component unmounts, and reset/recompute geometry whenever `sourceUri` changes. Determine dimensions and resize the longest edge, not width unconditionally. Test both resolution orderings with delayed manipulation/decode fakes.

#### PERF-007 — Dashboard/profile reloads can publish older or mixed snapshots

**Class:** correctness/stale-data reliability
**Evidence:** Dashboard's per-call cancellation flag and six independent reads at `src/screens/HomeScreen.tsx:131-169`; three independent caller-owned cancel slots at `src/screens/HomeScreen.tsx:171-211`; Profile's six-query load with no generation/unmount guard at `src/screens/ContactProfileScreen.tsx:182-228`.

Dashboard cancellation is local to each caller. Focus, AppState, and pull-to-refresh can each have an active request; starting one does not cancel the other two. A slower older request can therefore overwrite a newer result. Each load also publishes list/count/category values from separate statements rather than a shared snapshot. Profile has no request generation at all and is called by focus plus many mutation completions; older results can win, and its header/status/timeline/impact/fuel projections can reflect different commit points.

**Trigger/scenario:** foregrounding, pulling to refresh, or completing two fuel/profile actions while another reload is still running; a headless write commits between statements.

**User impact:** stale cards, counts that do not match the list, status/timeline/fuel disagreement, state updates after blur/unmount, and data appearing to revert until the next refresh.

**Remediation:** use one monotonic request generation per screen and discard every non-latest completion regardless of caller. Route all refresh triggers through one coordinator. Where multiple values must agree, consolidate into one statement or use a read transaction/snapshot. Add deferred-Promise tests that complete requests out of order and commit between component reads.

#### PERF-008 — Contact Profile eagerly reads and renders all accumulated history

**Class:** optimization with reliability consequences
**Evidence:** six-way load at `src/screens/ContactProfileScreen.tsx:182-211`; root `ScrollView` at `src/screens/ContactProfileScreen.tsx:590-595`; eager fuel/timeline rendering at `src/screens/ContactProfileScreen.tsx:820-876` and `src/components/FuelEditor.tsx:582-603`; unbounded timeline SQL at `src/db/timeline-read.ts:80-105`; unbounded fuel reads at `src/db/fuel-read.ts:50-65` and `src/db/fuel-read.ts:137-153`; duplicate interaction-history read at `src/db/impact-read.ts:51-87`.

This is not a “too many contacts” claim. Even with 7–30 contacts, one relationship can accumulate years of touchpoints, events, and fuel. Profile reads interactions twice (timeline and impact), fuel twice (editor and ranking), retains all rows, and mounts all editor/timeline components inside a non-virtualized `ScrollView`.

**Trigger/scenario:** opening a long-lived contact with hundreds or thousands of history rows, then editing/logging fuel or touchpoints; each mutation repeats the full six-query load.

**User impact:** increasing open/refresh latency, JS/native memory growth, longer React commits, keyboard/input jank, and repeated SQLite/I/O work.

**Remediation:** page or cap timeline/history, virtualize the profile (for example a sectioned virtual list), query only the promoted fuel row with `LIMIT 1`, and avoid duplicate history fetches by computing impact aggregates/windows in SQL or sharing one bounded read. Establish a product-visible “load older” strategy rather than silently truncating. Profile at 100, 500, and 2,000 rows on the Pixel.

#### PERF-009 — Existing fuel inputs can display values that never committed

**Class:** correctness/failure recovery
**Evidence:** uncontrolled-input rationale at `src/components/FuelEditor.tsx:16-23`; `defaultValue`/blur commits at `src/components/FuelEditor.tsx:333-369`; stable row keys at `src/components/FuelEditor.tsx:592-601`; write failure only alerts at `src/screens/ContactProfileScreen.tsx:514-529`.

React Native `defaultValue` is used only at mount. Re-rendering the same `FuelRow` key after a DB reload does not reset its native text. If an edit fails, the typed text remains visually present even though SQLite retains the old value. A later focus reload still reuses the same row key, so the UI can continue showing phantom state. Successful external/concurrent changes have the same synchronization problem.

**Trigger/scenario:** a blur commit fails, or the same fuel row changes outside that mounted input and Profile reloads.

**User impact:** Orbit can show unsaved data as if it were durable; leaving and returning to a still-mounted profile may not correct it. This is especially harmful in an app whose UI is expected to represent the local database exactly.

**Remediation:** give each row explicit local draft state synchronized from a persisted revision/version, render a visible dirty/saving/error state, and only adopt new server/DB values when the local draft is clean. On failure either preserve the draft as clearly unsaved with Retry/Revert or reset to persisted truth. Test failed write plus refocus and external row update.

#### PERF-010 — Minimum orrery gap can push rings off-screen and collapse bodies at the rim

**Class:** correctness/layout; runtime performance unmeasured
**Evidence:** `MIN_GAP = 8` at `src/logic/orrery-geometry-logic.ts:52-67`; unbounded ring radius at `src/logic/orrery-geometry-logic.ts:130-137`; body-only clamp at `src/logic/orrery-geometry-logic.ts:139-164`; gap derivation at `src/logic/orrery-geometry-logic.ts:249-274`; ring/body creation at `src/screens/OrreryScreen.tsx:313-389`.

The comment says compression keeps the furthest ring inside `DRIFT_MAX`, but `max(MIN_GAP, span/(n-1))` makes that false once the needed gap is below eight pixels. Rings remain unbounded while bodies clamp to `DRIFT_MAX`, so several outer bodies can share the same radius and rings can draw outside the canvas. For an illustrative 393 px-wide canvas, `DRIFT_MAX` is about 172.5 px; 20 bodies force an 8 px gap, making the outer ring about 210 px and clamping the last several stable bodies onto the same rim. Twenty contacts is within Orbit's stated “tens” scale.

**Trigger/scenario:** enough orbiting contacts on a phone-width portrait canvas.

**User impact:** hidden rings, overlapping bodies/tap targets, ambiguous radial drag ranking, and unnecessary off-canvas drawing. This is a static layout result, not a measured jank claim.

**Remediation:** enforce `ringInner + (n-1)*gap <= DRIFT_MAX` as the primary invariant. If an 8 px separation cannot fit, deliberately change representation: shrink planets/hit strategy, allow zoom/scroll, group bodies, or cap visible rings with a disclosed overflow treatment. Add 20/30-body tests at real Pixel logical widths and physical-device visual/tap UAT.

#### PERF-011 — Installed share-intent native code can drop or crash on a warm intent during bridge transition

**Class:** dependency correctness/lifecycle reliability
**Evidence:** installed module uses non-null assertions to emit at `node_modules/expo-share-intent/android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt:44-55`; initial intent singleton is consumed at `:182-188`; warm `OnNewIntent` directly emits without storing at `:199-201`; the committed patch changes only title extraction at `patches/expo-share-intent+8.0.1.patch:5-11`.

Cold intents are stored in `ExpoShareIntentSingleton`, but warm `OnNewIntent` is not. It immediately calls `handleShareIntent`, which ultimately uses `instance!!`. During a React bridge reload/recreation or activity restoration window, `instance` or the JS listener can be unavailable. That can produce a Kotlin null failure or an emitted event with no subscriber and no singleton fallback. App-level `ShareIntentGate` readiness cannot recover a payload the native module dropped.

**Trigger/scenario:** share text into an existing Orbit activity while the native module/JS bridge is being recreated, reloaded, or recovered after memory pressure.

**User impact:** a share-sheet capture can disappear or the native path can fail before Capture opens.

**Remediation:** update or extend the patch so every `OnNewIntent` first stores the intent and pending flag, emits only when safely attached, and clears only after JS successfully consumes it. Remove `instance!!` from delivery. Add native/instrumentation tests for cold, warm, bridge-reload, rapid consecutive, and process-restored shares on API 36.

### Low

#### PERF-012 — Migration runner accepts newer, missing, or non-contiguous schema versions

**Class:** correctness/future release reliability
**Evidence:** current version is read and pending migrations merely sorted/filtered at `src/db/migrations/runner.ts:38-47`; no final version assertion exists before return at `src/db/migrations/runner.ts:47-68`; target is fixed at `src/db/database.ts:35-38`.

The runner does not reject `user_version > TARGET_VERSION`, duplicate versions, gaps, or a migration list that never reaches the target. A sideloaded downgrade can therefore open a newer DB with older code. A future release that forgets to register a migration can return “success” below its declared target.

**Trigger/scenario:** app downgrade/rollback, or a future migration wiring mistake.

**User impact:** unpredictable query/write failures after startup rather than a clear incompatible-schema error.

**Remediation:** validate unique contiguous versions, fail closed if the DB is newer than the build, and assert final `user_version === targetVersion`. Add downgrade/gap/duplicate/missing-target tests. Preserve the existing per-step transaction behavior.

#### PERF-013 — Fuel, events, links, and purge paths lack contact-scoped supporting indexes

**Class:** optimization
**Evidence:** only `interactions(contact_id, occurred_at DESC)` is created at `src/db/migrations/001-initial.ts:96-125`; `fuel` has no contact index at `src/db/migrations/001-initial.ts:165-179`; dashboard correlated fuel reads at `src/db/dashboard-read.ts:114-123`; timeline event filter at `src/db/timeline-read.ts:80-90`; capture fuel grouping at `src/db/capture-read.ts:50-69`; purge counts/deletes at `src/db/purge-dao.ts:89-116` and `:182-198`.

The query-plan probe used `idx_interactions_recency` for interaction seeks, but reported full `SCAN fuel` for dashboard fuel, search, ranked/editor fuel and capture materialization; `SCAN events` for timeline; and temp B-trees for their sorts. SQLite also needs child-key indexes for efficient parent deletes/cascades.

**Trigger/scenario:** years of fuel/events/history, not an unrealistic number of contacts.

**User impact:** repeated full-table scans and sorts on dashboard/profile/capture and slower purges. At today's small data volume this is a low-severity optimization opportunity; no current latency regression was measured.

**Remediation:** benchmark before/after on the physical Pixel and consider at least `fuel(contact_id, created_at DESC, id DESC)`, `events(contact_id, occurred_at DESC, id DESC)`, `contact_links(contact_id, display_order)`, and `field_history(contact_id)`. Keep the prohibition on indexing dynamic custom value columns. A more complex expression/partial fuel index should be driven by real plans and write-cost measurement.

#### PERF-014 — Every widget push re-decodes and re-encodes all visible photos

**Class:** optimization/battery
**Evidence:** every mutation publisher calls a full push at `src/services/widget/widget-refresh.ts:53-75`; renderer encodes every tile in parallel at `src/services/widget/widget-render.tsx:144-182`; each encode manipulates a 512 px master and produces base64 at `src/services/widget/widget-photo.ts:58-79`.

For a placed widget, a contact log, fuel edit, favourite change, launch sweep, or headless mark rebuilds up to six thumbnails even when photo bytes did not change. `Promise.all` can run six native image manipulations together. The capacity keeps this bounded, so this is not a scale alarm, but repeated marks/edits can spend CPU, memory, I/O, and battery unnecessarily.

**Trigger/scenario:** repeated non-photo data changes while a photo-heavy widget is placed.

**User impact:** slower headless completion and avoidable battery/thermal cost; runtime magnitude is unknown.

**Remediation:** carry a photo revision (`modified_at` or immutable path) into widget data and reuse a bounded cache of 88 px thumbnails, invalidated only on photo change/delete. Alternatively update only changed instances/parts if the library supports it. Profile the current six-photo worst case before adding persistent cache complexity.

#### PERF-015 — Retained release artifact is a 145 MiB universal APK

**Class:** distribution/storage optimization
**Evidence:** build runbook produces `assembleRelease` APK at `docs/runbooks/desktop-build-pipeline.md:89-105`; retained `app-release.apk` measured 151,424,230 bytes and contains `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`.

Artifact inspection found approximately 133.4 MB of stored native libraries: 35.1 MB arm64, 24.1 MB armv7, 37.1 MB x86, and 37.0 MB x86_64. The four `librnskia.so` files alone total about 42.8 MB uncompressed. `android:extractNativeLibs="false"` is positive for mmap/startup, but a universal APK makes users download/store ABIs their phone cannot use. The debug APK is about 291 MiB and is not a release concern.

**Trigger/scenario:** direct distribution/install of this APK rather than Play-delivered split APKs from an AAB.

**User impact:** large download, install, update, and device-storage cost. It does not by itself prove slow startup.

**Remediation:** use `bundleRelease`/AAB for production distribution or explicit per-ABI release APK splits. Track arm64 delivered size, download size, native contribution, and bundle regression in CI. Re-measure a current build; the retained artifact predates this audit.

#### PERF-016 — Custom-field settings performs a serial N+1 emptiness scan

**Class:** optimization
**Evidence:** definitions are loaded once, followed by one awaited query per definition at `src/screens/CustomFieldsScreen.tsx:106-121`.

**Trigger/scenario:** opening Custom Fields with many definitions.

**User impact:** latency grows by one native SQLite round trip per definition. Expected field counts and visit frequency keep this low severity.

**Remediation:** compute emptiness in one safely generated aggregate query (using the existing validated column-name boundary) or one executor method that returns all results. Do not add indexes to dynamic value columns because quarantine `DROP COLUMN` depends on their absence.

#### PERF-017 — Reanimated's worklets peer is used but not declared directly

**Class:** build/reproducibility reliability
**Evidence:** Babel loads `react-native-worklets/plugin` at `babel.config.js:5-12`; `package.json:27-32` declares Reanimated but no `react-native-worklets`; installed Reanimated declares the `0.10.x` peer, and the current lock happens to install/dedupe `0.10.4` transitively through Expo.

**Trigger/scenario:** SDK/package upgrade or dependency-tree change removes the transitive provider or resolves an incompatible peer.

**User impact:** prebuild/bundle failure or worklet-transform incompatibility despite application code being unchanged. The current install and TypeScript build work; this is not a runtime defect today.

**Remediation:** declare the Expo-compatible `react-native-worklets` version directly and keep Expo Doctor/package compatibility checks in the release gate. Resolve reported SDK patch-version mismatches as one controlled dependency update, followed by full tests, prebuild, release build, and Pixel profiling.

## Measured and automated evidence

### Green checks

| Check | Result |
|---|---|
| Vitest | 83 files, 1,009 tests passed in 5.53 s |
| TypeScript | `npx tsc --noEmit --pretty false` passed |
| Existing physical Pixel 6 Pro benchmark | `STATUS_SCAN` 24.07 ms; `NEWEST_PER_CONTACT` 47.51 ms at 150 contacts × 20 interactions (3,000 interactions), both below 100 ms |
| Existing Android local-time probe | `date('now','localtime')` matched the device's 2026-08-14 local date |
| Release artifact | 151,424,230-byte APK; 3,782,224-byte Hermes bundle; four ABIs; `extractNativeLibs=false` |

The prior Pixel data is from `.planning/milestones/v1.0-phases/02-data-foundation-status-engine/02-06-SUMMARY.md`, not a rerun. It covers the Phase 2 status/newest queries—not the current dashboard fuel subqueries, profile, widget, photo, or orrery.

### Query-plan evidence

The real schema was migrated in memory and production DAO SQL was intercepted with `EXPLAIN QUERY PLAN`:

| Read | Important plan result |
|---|---|
| Dashboard default | contact scan; correlated `SCAN fuel`; temp B-tree for fuel ranking and dashboard sort |
| Dashboard search | contact scan; two correlated fuel scans plus ranked-line fuel scan; temp B-trees |
| Timeline | interaction seek via `idx_interactions_recency`; event scan; outer temp B-tree |
| Fuel editor/ranked | full fuel scan plus temp B-tree |
| Impact | PK contact seek and indexed interaction left join |
| Capture picker | materialized full fuel scan/group; automatic covering index for join; temp sort |
| Orrery | contact scan and temp sort |

These plans support PERF-013 but are not latency measurements. Scanning tens of contacts is expected and acceptable; the concern is accumulated child rows and repeated correlated work.

## Positive patterns

- **SQLite write discipline:** one shared promise-chain mutex, one transaction helper, parameterized values, best-effort rollback that preserves original errors, and writers routed through DAOs (`src/db/mutex.ts:22-35`, `src/db/transaction.ts:42-56`).
- **Connection posture:** WAL, foreign keys, and a five-second busy timeout are configured before migrations (`src/db/database.ts:99-113`).
- **Migration atomicity:** each version's DDL plus `user_version` commit together, with rollback on failure (`src/db/migrations/runner.ts:47-67`).
- **Startup ordering:** migration gates screen rendering; notification channel/category initialization precedes installation of the cold-start reconcile trigger (`App.tsx:102-119`, `:159-186`). Launch maintenance does not block the initial navigator after migration.
- **Current core-query evidence:** the status/newest-per-contact physical-Pixel benchmark has generous headroom at a dataset larger than Orbit's intended contact count.
- **Single-statement consistency where it matters:** gravity/intensity policy and interaction input are read in one joined snapshot (`src/db/impact-read.ts:41-87`).
- **Virtualized primary collections:** Dashboard, Never Contacted, Capture, and Manage Favourites use FlatList/ReorderableList rather than eagerly mounting every contact.
- **Search throttling:** dashboard search waits roughly 220 ms before querying (`src/screens/HomeScreen.tsx:119-126`).
- **Orrery render architecture:** one Skia clock drives the starfield and sun; body morphs are shared-value worklets; there is no React setState per frame (`src/components/orrery/OrreryCanvas.tsx:85-123`, `src/components/orrery/OrbitBody.tsx:102-120`).
- **Pause behavior:** the clock-owning canvas subtree mounts only while measured, focused, and foregrounded (`src/screens/OrreryScreen.tsx:282-299`, `:656-738`). Static code satisfies the pause architecture; runtime CPU quiescence still needs Pixel proof.
- **Bounded orrery ambient work:** 44 deterministic stars share one opacity worklet; there is no per-star timer/allocation loop (`src/components/orrery/OrreryCanvas.tsx:54-63`, `:96-123`).
- **Photo normalization:** all captures become one 512×512 JPEG master, avoiding original-resolution images on ordinary reads (`src/services/photos/photo-pipeline.ts:38-42`, `:76-104`).
- **Photo cache correctness:** expo-image uses path plus DB timestamp plus an in-memory per-write revision, and load failures degrade to initials (`src/components/Avatar.tsx:53-80`).
- **Interrupted-file recovery:** `.tmp`/`.bak` swap and launch reconciliation handle process death within the filesystem operation, even though PERF-002 identifies the missing DB/form atomic boundary (`src/services/photos/photo-storage.ts:141-193`, `:253-281`).
- **Notification scheduling is bounded and diffed:** desired requests are horizon-filtered/capped at 48, unchanged OS requests are retained, and per-item cancel/schedule failures are isolated (`src/services/notifications/notification-schedule.ts:419-478`).
- **Action idempotency:** notification mark/snooze uses deterministic UIDs plus a UNIQUE constraint, while widget taps deliberately use fresh UIDs (`src/services/notifications/notification-actions.ts:115-175`, `src/services/widget/widget-mark.ts:46-61`).
- **Headless separation:** notification/widget tasks bootstrap before DB use, avoid the foreground launch sweep, and commit the durable widget mark before best-effort refresh (`src/services/notifications/headless-task.ts:61-92`, `src/services/widget/widget-task-handler.tsx:66-109`).
- **Widget battery posture:** event-push only; `updatePeriodMillis: 0` means no polling (`app.config.ts:26-54`). Rendering is capped at six tiles and a corrupt photo falls back per tile rather than blanking the widget.
- **Navigation lifecycle:** share, notification, and widget gates all wait on reactive navigator readiness; strict widget URI parsing rejects malformed/oversized IDs and resets a deterministic back stack (`src/navigation/linking.ts:38-60`, `src/navigation/notification-gate.tsx:113-177`, `src/navigation/widget-linking.ts:78-153`).
- **Capture resilience:** a synchronous ref latch prevents pre-render double commits, timers/listeners are cleaned up, and the share is reset only after commit/cancel (`src/screens/CaptureScreen.tsx:163-179`, `:209-250`).
- **Local/offline reads:** no render path depends on a backend. URL image access occurs only during the explicit import write flow.

## Physical Pixel profiling plan

Use a current commit, standalone release build, and the real Pixel. Do not use emulator timing. Record OS version, build SHA, thermal state, battery state, logical resolution, and dataset seed with every result.

### 1. Build and artifact baseline

Use the established desktop pipeline, but produce both APK and AAB:

```bash
gradlew.bat assembleRelease bundleRelease --console=plain
apkanalyzer apk file-size android/app/build/outputs/apk/release/app-release.apk
apkanalyzer files list android/app/build/outputs/apk/release/app-release.apk
```

Track universal APK bytes, arm64 delivered bytes, AAB bytes, Hermes bundle bytes, native library bytes by ABI, DEX method count, and deltas from the previous release. Confirm production distribution uses split delivery/signing rather than the runbook's debug-keystore universal APK.

### 2. Cold/warm startup

Run at least 10 cold and 10 warm launches after installing the current release:

```bash
adb shell am force-stop com.bwales.orbit
adb shell am start -W -n com.bwales.orbit/.MainActivity
adb shell dumpsys meminfo com.bwales.orbit
```

Capture `ThisTime`, `TotalTime`, and `WaitTime`; report median and p95. Separate first-ever install/migration, normal cold start, and warm foreground. Add internal signposts for DB open, PRAGMAs, migration, channels/categories, navigator ready, and sweep-hook durations; release Hermes console output is not a reliable evidence channel, so render/export structured test diagnostics or use native trace sections.

### 3. SQLite workload

Extend the throwaway on-device benchmark to time the current production reads:

- Dashboard default, favourites, search, and all four counts.
- Profile header/status/timeline/impact/fuel/ranked load.
- Capture picker, notification candidates, widget favourites, and orrery contacts.
- Purge impact and purge transaction.

Seed realistic matrices: 8 and 30 contacts; 20/100/500 interactions per long-lived contact; 5/50/250 fuel rows; events and links. Use warm-up plus at least 30 iterations and report p50/p95/max, query-plan changes, DB bytes, WAL bytes, and transaction busy failures. Re-run after candidate indexes; retain indexes only when device evidence beats their write/storage cost.

### 4. React/Skia frame and JS profiling

Profile a current release on the Pixel; `dumpsys gfxinfo` covers Android UI/render timing, not the React Native JS thread:

```bash
adb shell dumpsys gfxinfo com.bwales.orbit reset
# Exercise Dashboard search/scroll, 500-row Profile, and Orrery with 8/20/30 bodies.
adb shell dumpsys gfxinfo com.bwales.orbit framestats
adb shell dumpsys meminfo com.bwales.orbit
```

Collect frame count, janky frames, missed vsync, p50/p90/p95/p99 frame time, slow UI thread, slow bitmap upload, and peak PSS/RSS. Use React DevTools/Hermes sampling on a comparable instrumented build to attribute JS commits; verify conclusions again in release because tooling changes timing.

Capture a 30–60 second Perfetto trace while the orrery is visible, then while Home is visible and while the app is backgrounded:

```bash
adb shell perfetto -o /data/misc/perfetto-traces/orbit.perfetto-trace -t 30s \
  sched freq idle am wm gfx view binder_driver hal dalvik
adb pull /data/misc/perfetto-traces/orbit.perfetto-trace .
```

Verify CPU/GPU activity falls to baseline when Orrery blurs/backgrounds; compare 8/20/30 bodies; measure morph and drag frames; inspect allocations, image decodes, and thermal/frequency changes. Static review cannot prove `useClock` teardown behavior in the installed Skia version.

### 5. Photo and URL stress

On the Pixel, test 12–48 MP portrait/landscape images, corrupt images, and controlled HTTPS endpoints that are 1 MB, exactly 8 MB, 8 MB + 1 byte, 50 MB, chunked without length, slow/stalled, redirect-changing, and disconnecting.

Measure:

- request count (must be one), transferred bytes, cancellation/timeout time;
- peak JS/native/PSS memory and disk bytes;
- crop preview/confirm latency and correctness around the 2.5 s fallback;
- persistence under injected DAO failure, cancel after custom recrop/remove, process kill at each `.tmp`/`.bak` stage, and disk full;
- cache directory growth after repeated URL import/cancel.

### 6. Widget and notification headless paths

With six photo favourites and a placed large widget:

- Kill Orbit, tap widget Mark and both notification actions repeatedly.
- Verify exactly one durable row/event per notification action and one fresh row per genuine widget tap.
- Force DB busy/failure and confirm the action is retried or visibly recoverable rather than silently acknowledged.
- Measure callback-to-commit and callback-to-widget-render duration, peak PSS, thumbnail encode time/count, and completion within the OS budget.
- Compare 20 consecutive non-photo widget pushes before/after thumbnail caching.
- Reboot and verify boot receiver refresh; force-stop separately because Android treats it differently.

Inspect coarse package battery state after controlled runs:

```bash
adb shell dumpsys batterystats com.bwales.orbit
adb shell dumpsys jobscheduler com.bwales.orbit
adb shell dumpsys alarm | rg com.bwales.orbit
```

Do not reset device-wide battery stats without explicit owner approval.

### 7. Share/navigation lifecycle matrix

On API 36 hardware or a device-valid test environment, exercise cold, warm, background, bridge reload, low-memory process restoration, and rapid consecutive intents for:

- share text;
- notification body/Mark/Snooze;
- widget contact/compose/favourites URI;
- Back behavior after each entry.

Record delivered intent count, Capture/navigation arrival, payload retention through migration delay, and duplicate/lost events. Specifically reproduce the installed share module's `OnNewIntent` listener gap before and after patching.

## Residual risks after remediation

- A JS module mutex coordinates one runtime, not arbitrary Android processes or concurrently created database handles. SQLite-level contention handling remains necessary.
- `busy_timeout = 5000` is a fixed wait, not recovery. Device fault tests must establish acceptable action/launch behavior during contention.
- Local wall-clock timestamps intentionally follow user time. Manual clock/timezone changes can reorder or reclassify data; existing localtime correctness does not cover clock rollback.
- Android notification/task/widget delivery and time budgets vary by OEM, Doze state, force-stop state, reboot, and OS version. Unit tests cannot certify them.
- No remote backend means excellent offline behavior but no server recovery. File/DB atomicity and explicit backup/export strategy therefore matter more than in a synced app.
- Logger-only failures may be unavailable after a user reports a problem. Decide on privacy-preserving local diagnostics/export or crash telemetry before production support depends on observability.
- Skia, Reanimated, expo-image, SQLite, and RemoteViews native memory/CPU behavior cannot be inferred from TypeScript structure. Keep the physical-Pixel release profile as a release gate.
- The current tests are broad but primarily success/correctness oriented. The high findings need deterministic failure-ordering and concurrency tests, not only more happy-path coverage.
- The share-intent and widget flows depend on third-party native modules plus local patches/config plugins; upgrades require source re-audit and lifecycle device tests.
- The retained APK is stale relative to this audit. Current startup and size must be re-baselined after fixes and dependency alignment.

## Recommended order of work

1. Fix PERF-002 photo commit/cancel semantics and add destructive failure-order tests.
2. Make DB bootstrap single-flight (PERF-001), then exercise concurrent foreground/headless open and migration.
3. Replace the URL photo downloader with one bounded request (PERF-003).
4. Make notification action failure durable/observable (PERF-004) and isolate the launch sweep (PERF-005).
5. Resolve crop/reload/fuel stale-state correctness (PERF-006, PERF-007, PERF-009).
6. Correct orrery overflow at 20/30 bodies (PERF-010) and patch share warm-delivery retention (PERF-011).
7. Run the physical profiling plan; use results to prioritize profile pagination/indexes/widget caching/APK splitting rather than optimizing by intuition.
