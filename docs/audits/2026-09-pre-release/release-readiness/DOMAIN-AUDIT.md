# Android Release Readiness and Production Hygiene Audit

## Audit Metadata

- **Date:** 2026-09-22 (America/Chicago)
- **Domain code:** `REL`
- **Mode:** Deep domain audit; discovery only, no fixes.
- **Repository:** `/home/bwales/projects/orbit-app`
- **HEAD:** `0e04c27e1d82bc3b5069bbf5adfc72281155df69` — `docs(kb): record phase 38.1 extraction`
- **Initial working tree:** No tracked modifications; `docs/audits/2026-09-pre-release/` was already untracked and contained other domain packets. Those files were preserved.
- **Output:** `docs/audits/2026-09-pre-release/release-readiness/DOMAIN-AUDIT.md`
- **Mutation boundary:** Only this report was written. No application, tests, configuration, dependencies, migrations, generated native files, or other documentation was changed. No build, installation, remote synchronization, commit, push, or worktree operation was performed.

## Executive Summary

Three findings are admitted: **one S1 Major and two S3 Minor**, all OPEN. The major finding is a startup failure boundary: an optional background-image cleanup error can keep an otherwise healthy installation out of the entire application. The minor findings are concrete scaffold remnants in the production manifest and launcher artwork.

The repository is not yet an evidenced Google Play release candidate. Production signing and final release destinations are explicitly deferred, and onboarding and final hardening remain planned work. Those are recorded separately rather than represented as defects in already completed functionality. The available APK supports several useful native checks but predates current source and cannot certify it.

Most suspicious development remnants did **not** warrant findings: developer navigation is guarded, the release benchmark is explicitly intentional, logging defaults off, and unused old stores/screens are not automatically bundled product behavior. The audit found no reason to remove required historical migrations or cross-version contact-import paths.

## Scope

Included: Expo production configuration; Android generation, manifests, permissions, build variants, metadata and signing workflow; environment/build flags; development UI, probes and logging; startup readiness and failure handling; dependency/lockfile/patch hygiene; generated artifacts and asset provenance; obsolete code and compatibility paths where they could affect shipping behavior; targeted native artifact checks relevant to Play submission.

Excluded: another general security, architecture, data-integrity, accessibility or performance audit; implementation; release publication; store-account administration. Background storage and restore writers were traced only as necessary to establish the startup finding and its safe recovery constraints. Existing campaign packets were searched narrowly for overlap, not re-audited or synthesized.

## Repository Context Reviewed

- `HANDOFF.md`, repository agent instructions, `.planning/PROJECT.md`, and `.planning/ROADMAP.md`: local-first Android application, current v2.0 release-readiness milestone, and deferred Phases 39/40. Detailed recent completion notes outrank stale aggregate progress rows.
- ADR-007 and `docs/runbooks/desktop-build-pipeline.md`: sanctioned desktop `npm ci` → clean Expo prebuild → Gradle workflow; debug versus standalone release proofs; production signing explicitly later.
- ADR-002/003: permissionless modern contact import and deliberately uncapped reconciliation permission. The newer ADR preserves the CRM/Contact Management declaration as a release obligation.
- ADR-009, ADR-001 and database bootstrap: forward-only per-version migration transactions and readiness gating.
- ADR-112, profile presentation readers/resolver, background storage/finalization/reconciliation, presentation DAO/migration, and restore application: durable image ownership, bounded debris, fallback and retry expectations.
- `docs/dossier/milestone-2/phase-37-settings-personalization-dossier.md` §K and Settings About implementation: omit unavailable legal/support/build/license rows; later release work may supply them.
- Deferred phase stub contracts and historical Phase 17 benchmark plan/summary: distinguish reserved work and intentional release-build instrumentation from accidental shipping UI.

## Methodology and Coverage

Investigation used three distinct tracks: native/build configuration, development/remnant hygiene, and startup/dependency readiness. Investigators read actual files and callers rather than diffs. The primary auditor adjudicated candidates, reopened their evidence, checked repository state, and independently checked the consequential startup path. Table writers were located manually because Graphify does not discover SQL writes inside strings.

Sanctioned `npm run graph:ask -- governs ...` queries covered `App.tsx`, `src/db/database.ts`, `src/services/photos/background-finalization.ts`, and Settings About. Database relationships were **INFERRED** from ADR Key-files lists, not code assertions; the query flagged partial supersessions. Empty graph results were treated as missing citations, not absence of governing decisions. No graph was rebuilt.

### Checks performed

| Check | Result and practical limit |
|---|---|
| `tsc --noEmit --incremental false --pretty false` | Passed. Type checking does not execute Metro or native startup. |
| Targeted Vitest run, `--no-cache --maxWorkers=2` | **6 files / 40 tests passed:** migration full chain and runner, font fallback, theme hydration, launch sweep, background reconciliation. Existing tests do not establish boot-level image failure isolation. |
| In-memory fault injection into actual transpiled reconciliation/finalization modules | Healthy empty template reads plus an orphan pending artifact and a throwing cleanup dependency rejected reconciliation with the injected error. No test or fixture was added to the repository. See REL-001. |
| `npm ls --depth=0` | Passed; no missing/invalid direct dependency reported. |
| Lockfile root dependency comparison | Runtime and development dependency maps match `package.json`; lockfile v3. Worklets resolves to 0.10.4. |
| Installed `expo/config` `getConfig()` | Resolved successfully to Orbit / orbit / `com.bwales.orbit`; active plugin list and icon paths inspected. This is configuration evaluation, not prebuild execution. |
| Authored plugins, local native module configuration, installed Expo template and generated Android files | Reviewed generation boundaries and manifest contributions. Generated files are not authoritative current-source proof. |
| Historical APK `aapt dump badging` / certificate inspection | SDK 24 minimum, SDK 36 target, version 1.0.0/code 1; Android Debug certificate. Camera/audio absent; overlay permission present. |
| Historical APK `zipalign -c -P 16 4` | Passed. ELF headers additionally checked for all **56 64-bit libraries**: every `PT_LOAD` alignment is at least 16,384. This does not prove current AAB packaging or runtime behavior on a 16 KB device. |
| Artifact / secret-file inventory | No tracked APK/AAB, `.env` or signing keystore found. This is not a historical secret scan. Existing local APKs are ignored artifacts. |

The APK checked is `app-release-31.1-05.apk`, local mtime September 11, 2026, 201,101,123 bytes. It predates current source. The generated Android manifest also lacks the current OpenRouter completion filter, confirming that it must not be mistaken for a fresh native build.

## Findings Summary

**Primary findings:** 3 OPEN; 0 INVESTIGATE. Severity distribution: S0 0, S1 1, S2 0, S3 2, S4 0. Accepted/deferred and disproven candidates are recorded separately below and excluded from these counts.

| ID | Finding | Severity | Confidence | Scope | Disposition |
|---|---|---|---|---|---|
| AUD-REL-001 | Recoverable background cleanup failure blocks application startup | S1 Major | C3 Confirmed | Cross-cutting | OPEN |
| AUD-REL-002 | Production generation retains unused overlay permission | S3 Minor | C3 Confirmed | Multi-area | OPEN |
| AUD-REL-003 | Active Android launcher artwork still uses the Expo scaffold mark | S3 Minor | C3 Confirmed | Local | OPEN |

## Findings

### AUD-REL-001 — Recoverable background cleanup failure blocks application startup

**Severity:** S1 — Major  
**Confidence:** C3 — Confirmed  
**Scope:** Cross-cutting  
**Type:** BUG, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

Cold-start readiness treats background-image recovery and orphan cleanup as fatal bootstrap dependencies. A filesystem failure while deleting an irrelevant pending image can prevent access to every screen, even with a healthy database and no affected live background.

#### Expected Behavior / Invariant

ADR-112's Decision and Consequences allow bounded staging debris, safe retry and theme fallback for failed images. Image cleanup must not make unrelated relationship data inaccessible. Migration failures still require their established fail-closed handling; successful restoration must retain exact pending ownership and protect canonical bytes.

#### Observed Behavior

`AppShell` awaits raw background reconciliation in the same promise chain that opens the database. The finalizer propagates pending deletion and persistence failures. Reconciliation does not isolate them, so bootstrap sets the fatal error state without setting readiness. The ordinary best-effort sweep cannot help because its registration requires readiness.

#### Evidence

- `App.tsx:185–206`: `Promise.all` includes `runBackgroundReconciliation(getExecutor())` at line 197; `setReady(true)` is later. Any rejection reaches `setError(err)`. The error branch displays “Couldn't start Orbit”; there is no mounted product navigator.
- `App.tsx:216`: the launch/sweep effect returns immediately when readiness is false.
- `src/services/photos/background-reconcile-sweep.ts:55–59`: every discovered pending artifact is passed to `finalizeBackgroundRestoreCandidate` without a per-candidate catch.
- `src/services/photos/background-finalization.ts:59–65`: a missing or different owner causes `deletePending(...)` before returning `stale`. Its exception propagates even though there is no image to recover for that row. Lines 69–82 similarly propagate copy or post-finalization cleanup errors.
- `src/services/photos/background-storage.ts:152–157`: existing pending files are deleted without a catch. The persistence function also rethrows copy failures, so insufficient space during a pending-image recovery is another credible trigger.
- Counterevidence checked: the registered sweep catches failures at `background-reconcile-sweep.ts:77–86`; `src/backup/restore-apply.ts:1624–1639` catches the same finalizer failure as `photosNeedingAttention`. Neither catch wraps the raw cold-start call.
- Safe presentation already exists: `src/db/profile-presentation-read.ts:65–74` excludes restore-pending paths from visible templates; `src/profile/resolve-presentation.ts:53–74` falls through missing background references to inherited/theme presentation.
- A read-only Node probe transpiled the actual sweep, model and finalizer in memory, substituted an empty healthy database, one orphan pending artifact, and a cleanup function throwing an injected I/O error. Reconciliation rejected with that error. The fatal UI transition was established by reading the App promise chain; no physical storage fault or rendered boot test was performed.

#### Impact

A recoverable presentation/storage problem becomes complete foreground unavailability: Contacts, Digest, Settings and Backup are inaccessible. Reopening repeats the same path while the filesystem condition persists. This does not establish data corruption or an unconditional failure on normal startup.

#### Trigger / Preconditions

A pending restore artifact remains after an interrupted/failed restore, and its deletion or required persistence fails. The strongest minimal case is stale orphan cleanup: no live image or broken database is required. Normal successful recovery is unaffected.

#### Remediation Direction

Keep successful recovery before presentation, but distinguish recoverable image/cleanup failures from database bootstrap failures. Preserve staged bytes and ownership checks, permit safe fallback and later retry, and keep application data accessible when cleanup alone fails.

#### Verification

Exercise cold start with failed orphan deletion, failed owned-image copy, and failed cleanup after successful finalization. Assert usable navigation and fallback, retained recovery state, later successful retry, and unchanged protection against stale candidates overwriting newer images. Separately assert genuine migration/database failures still prevent unsafe reads. Include a physical-device restore/relaunch check; node tests alone cannot establish native filesystem behavior.

#### Related Findings

No duplicate primary finding identified in the existing campaign packets. The performance packet's observation that pre-paint reconciliation has a legitimate purpose is compatible with this finding: the defect is failure isolation, not the existence or ordering of recovery.

#### Planning Notes

The boundary spans App readiness and background finalization, not a new schema. Preserve ADR-112 and current restore ownership semantics. A blanket catch that hides database integrity failures would not satisfy the finding.

### AUD-REL-002 — Production generation retains unused overlay permission

**Severity:** S3 — Minor  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** HYGIENE  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

The app inherits `android.permission.SYSTEM_ALERT_WINDOW` from the Expo template into the main manifest, despite having no product overlay feature or permission-request path.

#### Expected Behavior / Invariant

The production manifest should declare permissions needed by implemented functionality. Android describes this permission as intended for exceptional system-level interaction and requiring explicit user approval on modern Android. [Android permission reference](https://developer.android.com/reference/android/Manifest.permission#SYSTEM_ALERT_WINDOW).

#### Observed Behavior

The optional template permission is never removed by Orbit's authored configuration/plugins and survives into the inspected standalone release APK.

#### Evidence

- Installed `node_modules/expo/template.tgz`, member `package/android/app/src/main/AndroidManifest.xml:5–11`, explicitly labels a group of permissions optional and includes `SYSTEM_ALERT_WINDOW` at line 6.
- `app.config.ts:70–96` and its complete returned plugin list contain no overlay exclusion. The local manifest plugins manage contact permission, JSON shares and widget boot behavior; none removes it.
- Generated `android/app/src/main/AndroidManifest.xml:8` retains it. This generated file is supporting evidence only.
- Independent `aapt dump badging app-release-31.1-05.apk` reports `uses-permission: name='android.permission.SYSTEM_ALERT_WINDOW'`.
- Authored `src/`, `modules/`, `plugins/`, App and configuration searches found no overlay grant request, `canDrawOverlays`, `TYPE_APPLICATION_OVERLAY`, or matching product implementation.

#### Impact

An unnecessary special-access capability remains associated with the shipping package and complicates its permission inventory. No automatic grant, overlay execution, user-content disclosure or guaranteed Play rejection is established. This limited demonstrated consequence is why the finding is S3.

#### Trigger / Preconditions

A normal clean prebuild using the installed template and current authored configuration.

#### Remediation Direction

Make the production manifest's permission set match the product. Preserve legitimate development behavior where needed; resolve through the maintained generation/configuration boundary rather than editing ignored generated files.

#### Verification

Inspect a freshly generated merged release manifest and final APK/AAB-derived APK for absence of this permission, then confirm ordinary release navigation and intended development operation still work.

#### Related Findings

AUD-REL-003 shares a scaffold-origin theme but has an independent remediation boundary.

#### Planning Notes

Permission/security posture is owner-owned. Do not use this finding to remove `READ_CONTACTS` or recap it: ADR-003 explicitly requires that permission for modern reconciliation. Legacy storage permissions also require separate old-Android evidence before removal.

### AUD-REL-003 — Active Android launcher artwork still uses the Expo scaffold mark

**Severity:** S3 — Minor  
**Confidence:** C3 — Confirmed  
**Scope:** Local  
**Type:** HYGIENE, DESIGN  
**Disposition:** OPEN  
**Verification:** STATIC, MANUAL-VISUAL, DEVICE

#### Summary

The active adaptive launcher foreground still depicts the Expo scaffold mark rather than Orbit artwork. This is an actual visible scaffold asset, unlike obsolete internal names that the dynamic configuration overrides.

#### Expected Behavior / Invariant

A public Orbit release should present the owner's intended application identity on the launcher. No specific recorded acceptance or deferral of the Expo launcher mark was located. This finding identifies the remnant; it does not choose replacement artwork.

#### Observed Behavior

Dynamic configuration replaces the name and slug but inherits the scaffold icon paths unchanged.

#### Evidence

- `app.json:7,13–17` supplies the icon and adaptive foreground/background/monochrome asset paths.
- `app.config.ts:61–71` spreads the incoming configuration and Android configuration, preserving those paths while overriding the name and package.
- Current `expo/config.getConfig()` resolves `android.adaptiveIcon.foregroundImage` to `./assets/android-icon-foreground.png`.
- Direct visual inspection of that actual PNG confirms the blue Expo mark. The finding does not rely on its filename or a stale comment.

#### Impact

Users see development-template identity in the launcher, weakening recognition and making the application look unfinished. This is product polish, not a demonstrated runtime failure or store rejection.

#### Trigger / Preconditions

Installation of a normal build generated from current icon configuration on an adaptive-icon Android launcher.

#### Remediation Direction

Use owner-approved Orbit launcher artwork and consistent applicable icon variants.

#### Verification

Inspect resolved configuration, generated resources and the final device launcher under ordinary and themed-icon presentation. Confirm About's separate `assets/icon.png` reference is consistent with the selected identity.

#### Related Findings

AUD-REL-002; related scaffold residue only, no ordering dependency.

#### Planning Notes

Artwork/taste is the owner's decision. Do not change the stable `com.bwales.orbit` package identifier as part of branding. Phase 37's omission of unavailable About links does not require retaining this launcher image.

## Cross-Finding Patterns

Two findings arise from inherited scaffold defaults that remain active in the generated product. Neither is discoverable by deleting every file with “legacy” or “phase” in its name. The startup finding is different: recovery work has sound durability semantics but an overly broad failure boundary at the application entry point.

Production acceptance must evaluate the final generated artifact. Type checking, source review and a historical debug-signed release proof answer different questions and do not collectively substitute for a current release build.

## Reviewed Areas With No Material Findings

- **App identity/configuration:** resolved name is Orbit, slug orbit and package `com.bwales.orbit`; `orbit-scaffold` in static JSON does not become the effective application name. Portrait lock and disabled OS backup remain configured. The config's JSON display-name import avoids the documented runtime TypeScript-loader hazard.
- **Developer UI:** `SettingsStack.tsx:56–58,224` guards both the dev screen require and route registration with `__DEV__`; Settings Hub and Appearance entry points are guarded too. Phase 38 notification/data probes are descendants of that harness. No ordinary release route into them was found. Final-bundle elimination was not tested.
- **Logging:** `src/utils/logger.ts:11` defaults off, with no runtime `Logger.setLevel` callers found. A live raw dashboard-preference warning is fixed text. Sensitive arguments passed to disabled logging do not demonstrate a current output leak. No telemetry dependency was introduced or proposed by this audit.
- **Startup:** navigation waits for migration; concurrent opens share an opening promise; migrations transact each step; fonts are bundled and load failures resolve to fallback; legacy theme import parses defensively and compares before writing. Full registered v0→v30 migration test passed. No network dependency was found in this reviewed readiness chain. These observations exclude REL-001.
- **Compatibility:** historical migrations, normalized custom-field history, legacy theme import and older-Android contact picker paths serve supported upgrade/device contracts. “Legacy” does not mean removable.
- **Native generation:** camera/audio are explicitly disabled in image-picker options and absent from the inspected APK. JSON and text shares use bounded MIME types. The generated widget boot receiver is non-exported, checks its action and refreshes event-driven widgets. OpenRouter's current completion filter is credential-free by configuration/decision; no general OAuth re-audit was performed.
- **Dependencies/build tooling:** lockfile matches package roots; `npm ci` and postinstall patches are documented. Both maintained patches correspond to installed dependency versions (share-intent 8.0.1 and screens 4.26.2). No claim of a new clean installation or patch reapplication is made. Missing EAS/CI is not a defect where the owner explicitly selected a desktop pipeline.
- **Android API and native packaging:** installed RN defaults target/compile SDK 36 and minimum 24. The historical APK agrees. API 36 meets the new-app target requirement effective August 31, 2026; recheck at submission. [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en). Historical ZIP/ELF checks support 16 KB alignment, but packaging and device testing remain necessary for the actual release. [Android page-size guidance](https://developer.android.com/guide/practices/page-sizes).
- **Assets/generated output:** APK/native build output is ignored, not tracked source. Bundled fonts and eight background WebPs have provenance records; stale background-placeholder comments do not establish missing artwork. Font-version differences are explicitly accepted in `assets/README.md`. This review does not certify complete third-party license distribution.

## Accepted / Deferred / Rejected Candidates

| Candidate | Disposition and evidence |
|---|---|
| Debug-signed standalone development release APKs | **DEFERRED production prerequisite.** ADR-007 Risks and desktop runbook explicitly defer production signing. The inspected APK verifies as `CN=Android Debug`. Complete actual production signing and distribution preparation before public release; no claim that development proofs are Play-ready. |
| Missing final release/legal/support/license destinations | **DEFERRED.** Phase-37 dossier §K (`255–263`) instructs omission of unavailable rows; Settings About `18–28` records that boundary. Final release must resolve applicable destinations/distribution obligations. No dead placeholder buttons found. |
| Onboarding and whole-app responsive/release hardening | **DEFERRED.** Current roadmap Phases 39/40 remain reserved. Their absence is not admitted as a completed-feature regression. Outstanding device/accessibility/performance evidence belongs to that explicit work. |
| `EXPO_PUBLIC_BACKUP_ENCRYPTION_BENCHMARK` replaces AppShell | **ACCEPTED measurement tooling.** `App.tsx:430–455` enables the isolated harness only for value `1`; Phase 17 `17-07-PLAN.md:89` requires a physical release-build KDF benchmark and `17-07-SUMMARY.md:76,99` records this method. No tracked configuration enables it. A mistaken production value would disable the product UI, so assert it unset in the final build. Blindly adding `__DEV__` would break the intended release measurement. |
| Uncapped `READ_CONTACTS` | **ACCEPTED.** ADR-003 supersedes ADR-002's cap for user-initiated reconciliation. The plugin enforces the new decision. The ADR's Play declaration obligation remains external release work; do not remove a decided feature to simplify the manifest. |
| Missing widget preview artwork | **DEFERRED polish.** `app.config.ts:33–36` deliberately omits a nonexistent preview rather than introducing a failing asset path. |
| Unused old schemas, stores, BackupStack and DB benchmark | **FALSE-POSITIVE as a release defect.** No production importers found for the old frontmatter schemas, dashboard/AI preference stores, retired Backup tab or DB benchmark. Optional cleanup is not proof of shipped obsolete UI, seed data or runtime cost. |
| Logger calls carrying errors/private arguments | **FALSE-POSITIVE as a current log leak.** Logger remains off and has no runtime enabling caller. Enabling diagnostics later requires review of its content boundary; this report does not authorize it. |
| Lack of app-wide crash telemetry | **Not a defect.** Local-first policy and explicit diagnostic deferrals govern. No recommendation to add general crash reporting or widen egress is made. |

## Coverage Limitations / Follow-up Investigation

1. **No current release artifact was built or certified.** Regenerate on the sanctioned desktop pipeline from an identified source snapshot, then verify the merged manifest, signing, versioning, embedded bundle and ordinary launch with Metro unavailable. Local ignored artifacts and native sources are stale; this audit establishes neither success nor failure of current HEAD's Gradle build.
2. **No Play Console access or submission check.** Signing custody, upload format/AAB, version-code progression, listing assets, privacy/Data safety declarations, the recorded Contacts declaration, account-specific testing requirements and actual review outcomes remain external release acceptance work. Missing repository evidence is not proof those external preparations do not exist.
3. **No new native/device execution.** The startup fault probe establishes propagation under injected I/O failure; it does not measure fault frequency or reproduce physical storage exhaustion. Historical page alignment is not a current 16 KB runtime test, and supported older Android permission/picker behavior was not exercised.
4. **No production Metro bundle inspection.** Source-level guards and import reachability were reviewed, but exact bundle contents, benchmark flag substitution, assets, and development-code elimination require final-artifact checks. Build-host environment and untracked remote `.env` state were not inspected.
5. **Bounded dependency coverage.** Direct installation, lockfile consistency, patches and native configuration were examined. No second CVE/security audit, clean dependency reinstall or complete license-compliance audit was performed. Existing campaign security evidence remains separate.
6. **No blanket release clearance.** Intentional deferrals remain release obligations even though they are excluded from OPEN finding counts. Owner acceptance of earlier phase/device proofs must not be converted into evidence that these remaining steps passed.
