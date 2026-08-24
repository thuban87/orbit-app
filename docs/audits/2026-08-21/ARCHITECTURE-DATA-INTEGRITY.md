# Orbit Architecture, Data Integrity, and Build-Quality Audit

**Audit date:** 2026-08-21  
**Code snapshot:** `a4da2bd` plus the implementation present on disk  
**Scope:** application architecture, SQLite lifecycle and writers, file/DB consistency, background work, time semantics, build configuration, automated quality gates, and dormant/deferred code  
**Verdict:** **The core data layer is carefully designed and unusually well tested, but release should wait for the custom-photo retention defect, background failure isolation, database initialization race, and release/toolchain gate failures to be addressed.**

## Executive summary

Orbit's main architectural choices are sound for an offline-first personal relationship manager. SQLite is the source of truth; foreign keys are enabled before migrations; all production business writes found in the audit route through one shared transaction/mutex boundary; recency has one recompute writer; dynamic SQL identifiers are allowlisted; destructive contact deletion is two-stage; and the photo replacement path keeps a recoverable backup across process death. The 83-file, 1,009-test pure-logic/data suite, strict TypeScript check, and color-token check all pass.

The most important data defect crosses the database/filesystem boundary. Dropping or expiring a custom photo field removes the only metadata capable of enumerating its image files, but no file cleanup runs. Changing a photo field to another type creates a second route to the same leak: later contact purge only deletes files for definitions whose *current* type is `photo`. Those private image bytes can therefore outlive both the field and the contact indefinitely.

The lifecycle layer also has three related reliability gaps. Concurrent foreground/headless startup can open and migrate the same database more than once because initialization caches only the completed connection, not the in-flight promise. The foreground sweep aborts at the first rejecting hook and its two trigger sites discard the rejection. A notification-settings change likewise starts schedule reconciliation without a rejection handler. These paths are recoverable on a later launch in many cases, but they create stale maintenance state and unhandled promise rejections.

Release automation is not yet a trustworthy gate. Expo Doctor fails two of 21 checks, the configured Biome check fails, the package has no aggregate `check` or CI workflow, coverage is not configured, and rendered/device tests are absent. The available release APK provides useful evidence but is not a shippable artifact: security/signing and APK-specific issues are detailed in the companion security report.

## Finding totals

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 1 |
| Medium | 6 |
| Low | 4 |
| Info | 0 |
| **Total** | **11** |

## Scope and method

The audit traced the actual implementation rather than relying on phase summaries. It reviewed database bootstrap and all migrations, the transaction/mutex primitives, every production writer identified under `src/db`, the field-definition/value lifecycle, photo persistence and purge extensions, contact purge, recency, notification scheduling/actions, widget headless entry points, launch sweeps, navigation bootstrap, build configuration, dependency state, tests, and static quality configuration.

Automated evidence collected:

- `npm test -- --run`: **PASS**, 83 test files / 1,009 tests.
- `npx tsc --noEmit`: **PASS** under `strict: true`.
- `npm run check:colors`: **PASS**.
- `npx biome check . --max-diagnostics=200`: **FAIL**, 28 errors, 2 warnings, 3 informational diagnostics across 262 checked files.
- `npx expo config --type public --json`: **PASS**, and used to inspect resolved public configuration.
- `npx expo-doctor`: **FAIL**, 19/21 checks passed; missing direct `react-native-worklets` peer declaration and six Expo SDK patch mismatches.
- `npm audit --omit=dev --json`: **FAIL**, 17 vulnerable package nodes (10 high, 7 moderate, 0 critical); reachability and practical severity are treated in the security report rather than equating package-node counts with 17 exploitable app vulnerabilities.
- `apkanalyzer` and Android SDK `apksigner` were run read-only against the untracked August 17 APK artifacts. No phone or emulator was attached.

Limitations:

- No physical-device run, frame trace, fault injection against Expo native APIs, notification delivery test, widget interaction test, or database recovery test was possible; `emu-connect status` reported no USB phone and no local AVD.
- The ignored generated `android/` and `ios/` projects are absent. APK inspection provides merged-manifest evidence for the available artifact but cannot establish what every future prebuild will generate.
- Coverage percentages cannot be reported because no Vitest coverage provider or thresholds are configured.
- iOS is explicitly deferred in the project record. iOS findings are future-portability issues, not Android release blockers.

## Findings

### High

#### ADI-001 — Custom-field photo bytes can survive field deletion, expiry, type change, and later contact purge indefinitely

**Evidence:**

- The shared field-drop core snapshots the stored text values, deletes the definition, and drops the physical column, but has no filesystem cleanup or post-commit extension (`src/db/field-ddl.ts:113-137`). Both immediate deletion and 30-day expiry use this core (`src/db/field-ddl.ts:165-187`, `200-219`).
- The launch field sweep invokes expiry and prunes `field_history`; it does not remove custom-photo masters (`src/services/field-sweep.ts:87-133`).
- Contact purge deletes custom-photo files by re-enumerating the **surviving** definitions and only those whose current `type === "photo"` (`src/services/photos/purge-photo-cleanup.ts:62-99`). A dropped definition can no longer be enumerated. A definition changed from photo to another type is deliberately skipped.
- Type change preserves every stored value byte and changes only `custom_field_defs.type` (`src/db/field-type-change.ts:162-189`). This preserves reversibility, but after a change away from `photo`, later ordinary edits can overwrite the stored relative path and later contact purge does not delete the old derived image.
- Custom-field filenames are deterministic (`avatars/cv-<contactId>-<colName>.jpg`) (`src/services/photos/photo-storage.ts:73-89`). The existing reconciliation sweep handles only interrupted `.tmp`/`.bak` swaps, not canonical files orphaned from database metadata (`src/services/photos/photo-storage.ts:213-280`).

**Failure scenario:** A populated photo field is quarantined and expires, or a user changes it to text/number and later deletes the field/contact. The database no longer exposes enough current metadata to select that photo for deletion, while the canonical JPEG remains in app-private document storage without a retention limit.

**Impact:** Private third-party photos and storage usage outlive the user's deletion action. This conflicts with Orbit's “purge really means gone” posture even though Android app sandboxing prevents ordinary cross-app reads. The exported widget provider issue in the security report makes disciplined file retention especially important.

**Remediation:** Add a photo-aware, post-commit cleanup contract for field drop/expiry and make contact purge delete the deterministic `cv-<id>-<col>.jpg` path for every surviving definition, not only definitions currently typed as photo. Add a launch orphan-reconciliation pass that compares canonical `cv-*` files with live contacts/definitions, with conservative parsing and tests. Preserve type-change reversibility while the stored value remains in use, but define and enforce the exact point at which superseded photo bytes are deleted. Never perform irreversible filesystem deletion inside the SQLite transaction.

### Medium

#### ADI-002 — Database initialization is not single-flight across foreground and headless entry points

**Evidence:** `openAndMigrate` checks only `cachedDb`, opens a new connection, applies PRAGMAs/migrations, and sets the cache only after all work completes (`src/db/database.ts:89-117`). There is no cached in-flight promise. Foreground bootstrap calls it from `App.tsx:105-119`; notification actions and widget handlers independently call it before reading the executor (`src/services/notifications/notification-actions.ts:122-126`, `src/services/widget/widget-task-handler.tsx:90-95`, `src/services/widget/widget-render.tsx:149`).

**Failure scenario:** A killed-app widget/notification event and normal foreground launch overlap. Both calls observe `cachedDb === null`, open separate connections, and calculate the pending migration list before either caches the result. `busy_timeout` can serialize locks, but it does not stop the second runner from attempting DDL already committed by the first.

**Impact:** Startup or a headless action can fail even though another caller successfully migrated the database. Multiple live connections also weaken the assumption that the process has one PRAGMA-configured database handle.

**Remediation:** Cache one initialization promise immediately, have all callers await it, assign `cachedDb` once, close/discard any partially opened connection on failure where the Expo API permits, and clear the promise only for an intentional retry. Add a concurrency test with two simultaneous callers and a failed-first-attempt test.

#### ADI-003 — One rejecting launch-sweep hook aborts all later maintenance and becomes an unhandled rejection

**Evidence:** `runLaunchSweep` awaits registered hooks in a bare loop (`src/services/launch-sweep.ts:71-89`). `installSweepTrigger` invokes it with `void` at cold start and on background-to-active transitions, without `.catch` (`src/services/launch-sweep.ts:102-114`). Hooks are registered in field → photo → notification → widget order (`App.tsx:123-157`). The field hook isolates per-definition expiry, but its final history-prune transaction can still reject (`src/services/field-sweep.ts:121-132`). Notification reconciliation can reject before its per-notification error isolation if settings/OS enumeration fails (`src/services/notifications/notification-schedule.ts:495-511`, `520-525`).

**Impact:** A field-prune failure skips photo, notification, and widget maintenance; a notification-read failure skips widget refresh. Because the trigger discards the rejected promise, the failure can surface as an unhandled rejection. A later launch may recover, but maintenance ordering becomes an unintended failure dependency.

**Remediation:** Isolate each hook in the central runner, log a stable hook name/result, continue through the registry, and make both trigger sites attach a terminal rejection handler. Preserve the existing defer-one concurrency behavior. Add a test proving hook B/C still run when hook A rejects and a test proving rerun state resets.

#### ADI-004 — Notification-settings reconciliation is fire-and-forget without a rejection handler

**Evidence:** After persisting and rereading settings, `SettingsScreen` calls `void reconcileSchedule(exec)` inside a `try` block (`src/screens/SettingsScreen.tsx:241-253`). Because it is neither awaited nor given `.catch`, a later rejection is not caught by the surrounding synchronous `try/catch`. Other call sites correctly attach `.catch`, for example snooze/unsnooze (`src/screens/ContactProfileScreen.tsx:322-359`).

**Impact:** The UI can show a successfully persisted notification/privacy setting while the OS schedule remains stale until another reconcile. The promise rejection is unhandled and the logger defaults to off, so the user and normal developer console may receive no useful signal.

**Remediation:** Keep schedule work decoupled from the committed settings write, but attach `.catch` and surface a non-destructive “setting saved; reminders will retry” state where appropriate. Add a rejected-reconcile test around the settings controller.

#### ADI-005 — The migration runner does not validate a contiguous manifest or reject a newer database

**Evidence:** The runner sorts and filters whatever migration versions it receives, then advances `user_version` to each encountered value (`src/db/migrations/runner.ts:32-68`). It validates that a chosen version is an integer, but not uniqueness, contiguity, presence of the target migration, `targetVersion >= 0`, or `current <= targetVersion`. The current shipped `[1,2,3]` manifest is correct.

**Failure scenario:** A future array accidentally omits version 4 but contains version 5. A version-3 database applies version 5 and records `user_version=5`, permanently skipping 4. Separately, older application code opening a database with a newer `user_version` silently proceeds against a schema it does not understand.

**Impact:** Future release engineering mistakes can create locally unrecoverable installs in an app with no server repair path. This is a hardening gap, not evidence of current schema corruption.

**Remediation:** Validate the migration manifest before opening a transaction: unique integer versions, exact contiguous sequence from `current + 1` through `targetVersion`, and exactly one target entry. Fail clearly if `current > targetVersion`. Unit-test gaps, duplicates, missing targets, negative/non-integer versions, and downgrade detection.

#### ADI-006 — Expo/native dependency validation and patch alignment are not release-green

**Evidence:** `npx expo-doctor` passed 19/21 checks and failed:

1. `react-native-reanimated@4.5.1` requires `react-native-worklets`, but Orbit does not declare it directly. It is currently hoisted transitively at `0.10.4`, which does not satisfy Expo Doctor's native peer-dependency ownership rule.
2. Six Expo packages are below the current SDK 57 expected patch: `expo` 57.0.13 vs 57.0.15, `expo-file-system` 57.0.4 vs 57.0.5, `expo-image-manipulator` 57.0.10 vs 57.0.12, `expo-image-picker` 57.0.10 vs 57.0.12, `expo-notifications` 57.0.11 vs 57.0.13, and `expo-task-manager` 57.0.10 vs 57.0.12.

The available August 17 APK does contain `libworklets.so` for all four bundled ABIs, so this is not proof that that artifact crashes. It remains a reproducibility/autolinking defect because a required native peer is not an owned direct dependency.

**Impact:** A clean install or future package-manager layout can autolink differently; Expo explicitly warns the app may crash outside Expo Go. Patch drift also means the project is not on the SDK's validated package set.

**Remediation:** Add the peer through `npx expo install react-native-worklets`, align the six patches through Expo's installer, inspect the lockfile diff, rerun all checks, regenerate native projects, and validate a signed release build on the Pixel. Do not combine this with an unreviewed `npm audit fix` downgrade.

#### ADI-007 — There is no single passing release-quality gate

**Evidence:** `package.json:44-51` exposes tests and the color check but no `typecheck`, `lint`, `format:check`, Expo Doctor/native validation, coverage, build, or aggregate `check` command. No CI workflow or hook is present. The configured repo-wide Biome command currently fails with 28 errors, 2 warnings, and 3 informational diagnostics; its configuration also uses a deprecated `recommended` field (`biome.json:8-12`). Vitest is deliberately Node-only/render-free (`vitest.config.ts:4-15`), no coverage provider is installed, and no threshold is configured.

**Impact:** “Tests pass” is true but incomplete: formatting/import/static diagnostics, native peer drift, component behavior, accessibility, and release-build validity can regress without blocking a merge or artifact.

**Remediation:** Create explicit scripts and one aggregate command, make Biome green, migrate its config, add coverage reporting with intentionally chosen thresholds, and run the gate in CI. Keep pure data tests fast, then add a small rendered-component and Android E2E tier as detailed in the UI report.

### Low

#### ADI-008 — Local wall-clock interaction timestamps are not globally ordered instants

**Evidence:** Interaction/event timestamps and `last_contact` intentionally store local `YYYY-MM-DD HH:MM:SS` strings. Recency uses lexical `MAX(occurred_at)` (`src/db/recency-dao.ts:143-173`), while timeline and impact reads sort the same strings descending (`src/db/timeline-read.ts:75-106`, `src/db/impact-read.ts:58-83`). No UTC instant, offset, or zone is retained.

**Impact:** During the repeated hour at daylight-saving fallback, or after travel to a sufficiently earlier time zone, a later real-world interaction can sort before an earlier one. Date-level status often remains unaffected, but timeline order, newest channel, gravity inputs, and `last_contact` can disagree with real elapsed order. This is an edge-condition consequence of a documented architectural choice.

**Remediation:** For new interaction/event records, consider storing a UTC epoch/ISO instant for ordering plus the local wall-clock value/offset needed for display. Keep birthday and snooze *dates* local. Any migration must preserve existing display semantics and define how legacy rows with no offset are ordered.

#### ADI-009 — Several exported or compiled modules are dormant and already diverge from production behavior

**Evidence:** `src/services/AiService.ts` contains live provider HTTP clients but has no production importer; Phase 14 is planned rather than implemented. `src/types.ts` exports a legacy `calculateStatus` with a three-state model that differs from the query-time four-state status source and has only test/documentation references. `src/schemas/new-person.schema.ts`, `edit-person.schema.ts`, and their generic schema types have no production consumers and retain plugin-era comments/URL-photo behavior.

**Impact:** Dormant network code enlarges review scope and can be mistaken for shipped AI behavior. Duplicate status/form models invite future callers to choose the wrong source of truth and create misleading test confidence.

**Remediation:** Move intentionally dormant AI code behind the Phase 14 boundary or delete/reintroduce it with the new design. Remove unused schema/status surfaces or clearly mark them test-only/legacy and exclude them from the runtime bundle where possible.

#### ADI-010 — User-controlled text has almost no explicit size limits

**Evidence:** The contact, link, fuel, notes, labels, and share-capture paths trim or validate required content but generally do not apply `maxLength` in the UI or length guards in DAO boundaries. A repository-wide production search found `maxLength` only on the custom date widget. SQLite `TEXT` columns also have no size checks.

**Impact:** Accidental huge paste/share payloads can create oversized rows, slow search/widget/notification shaping, layout pressure, and backup growth. Android intent/Binder limits constrain some external payloads, but direct paste and imports are still unbounded.

**Remediation:** Define product-level maximums by field class, enforce them at both UI and DAO boundaries, provide accessible validation copy, and add boundary tests. Choose generous limits that do not disrupt ordinary notes.

#### ADI-011 — Deferred iOS configuration currently resolves invalid share-extension identifiers

**Evidence:** The resolved public Expo config has no `ios.bundleIdentifier`; the share-intent plugin consequently emits `extra.eas.build.experimental.ios.appExtensions` values `undefined.share-extension` and `group.undefined`. `app.json:9-11` contains only `supportsTablet`. The project explicitly records iOS as deferred.

**Impact:** This does not block the Android-first release, but a future iOS build cannot rely on the current resolved configuration and could fail signing/entitlements.

**Remediation:** Before beginning the iOS milestone, define the stable bundle identifier and matching app-group/share-extension identifiers, regenerate config, and review every native permission/entitlement rather than carrying the Android-first config forward unchanged.

## Verified strengths to preserve

- **One shared write boundary:** All production business writers found by the audit use `inWriteTransaction`; the mutex and rollback behavior are centralized (`src/db/transaction.ts`, `src/db/mutex.ts`). Raw updates inside composite operations deliberately use non-mutexed cores to avoid reentrant deadlock.
- **Recency is recomputed, not patched:** Interaction create/edit/delete converge through the sole `contacts.last_contact` writer, including `rarely_responds` filtering (`src/db/recency-dao.ts`). Scoped `(interactionId, contactId)` guards prevent cross-contact stale recency.
- **Crash-safe migrations:** Each shipped migration and `user_version` bump commit atomically; rollback preserves the original SQL error (`src/db/migrations/runner.ts`).
- **Database connection PRAGMAs are correctly ordered:** WAL, foreign keys, and busy timeout are set before migration transactions (`src/db/database.ts:99-114`).
- **Dynamic identifiers are defended:** Custom-field column names are generated/validated against an allowlist and quoted; runtime values are bound.
- **Contact purge is explicit and guarded:** Only archived contacts can be purged, all owned tables are explicitly cleaned, the contact delete is asserted, and filesystem/OS extensions run post-commit (`src/db/purge-dao.ts`).
- **Photo replacement is recoverable:** The `.tmp` → prior-master `.bak` → new-master sequence preserves a recoverable copy across process death and launch reconciliation (`src/services/photos/photo-storage.ts`).
- **Sensitive preference storage is narrow:** AsyncStorage contains theme/dashboard enums only, while contact data remains in app-private SQLite. Resolved Android config has `allowBackup=false` and the inspected APK confirms it.
- **No inline screen SQL writers were found:** Screens call DAO/service boundaries rather than issuing ad hoc SQL.
- **Strong pure/data verification:** 1,009 tests and strict TypeScript pass. Database behavior, migrations, transactions, scheduling logic, photos, widget shaping, custom fields, and pure geometry are substantially covered.

## Prioritized remediation

### P0 — Before any production release

1. Close ADI-001 with tested field-drop/type-change/contact-purge photo cleanup and orphan reconciliation.
2. Resolve the release-blocking security/APK findings in `SECURITY-PRIVACY.md`, especially the exported widget image provider and debug signing.
3. Make database initialization single-flight (ADI-002) and isolate launch-hook failures (ADI-003).
4. Align native dependencies and make Expo Doctor green (ADI-006).

### P1 — Before declaring the build production-gated

1. Handle settings reconciliation rejections (ADI-004).
2. Harden the migration manifest/downgrade checks (ADI-005).
3. Make Biome green and create one CI-backed aggregate gate (ADI-007).
4. Add rendered critical-path and device smoke coverage from the companion UI report.

### P2 — Planned hardening

1. Decide the long-term instant/local-time model (ADI-008).
2. Remove or quarantine dormant duplicate models (ADI-009).
3. Add generous input-size limits (ADI-010).
4. Repair identifiers/entitlements when the deferred iOS milestone starts (ADI-011).

## Companion reports

- `SECURITY-PRIVACY.md` — threat model, native manifest/APK, dependency advisories, secrets/privacy, exported components, network and storage findings.
- `PERFORMANCE-RELIABILITY.md` — render/query/background performance, resource usage, headless/native reliability, APK size, and measurement plan.
- `UI-ACCESSIBILITY-QUALITY.md` — screen-by-screen UI, accessibility, states, interaction quality, and rendered/device test gaps.
- `FULL-AUDIT.md` — consolidated release verdict and deduplicated action plan.

