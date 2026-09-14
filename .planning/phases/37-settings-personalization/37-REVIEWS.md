---
phase: 37
reviewers: [codex, claude]
reviewed_at: 2026-09-14T22:56:56Z
plans_reviewed: [37-01-PLAN.md, 37-02-PLAN.md, 37-03-PLAN.md, 37-04-PLAN.md, 37-05-PLAN.md, 37-06-PLAN.md, 37-07-PLAN.md, 37-08-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=low)"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  claude: "orchestrator-fork"
cycle_summary:
  current_high: 3
  current_actionable: 12
lane_provenance:
  codex: "gsd-review codex lane (spawn transport), source-grounded prompt, completed cleanly (232-line review, ~3m20s)."
  claude: "The built-in `claude -p` lane self-skips inside Claude Code (SELF_CLI=claude) and has the known Write-permission gap in this repo. Per the run directive, the Claude lane was obtained as a read-only, source-grounded fork pass over all 8 plans + cited source. Its HIGH findings were then re-verified against code on disk by the orchestrator (not relayed as unverified subagent claims)."
---

# Cross-AI Plan Review — Phase 37 (Settings & Personalization)

## Consensus Summary

Two independent reviewers (Codex `gpt-5.6-sol`, Claude `opus-4-8`) reviewed all 8 sequential-wave plans against the code on disk. They **converge strongly**: both rate the phase **HIGH risk / NEEDS REVISION**, both confirm the hard project constraints are respected, and both independently surface the **same three HIGH implementation-mechanism defects** (Plan 06 Orrery, Plan 07 backup singleton, Plan 08 About) plus the **same cross-cutting test-integrity weakness** (route-registration tests over an erased TypeScript type).

**Escalation-trigger check (recorded-decision removal by name):** NONE. Neither reviewer found a plan that deletes, weakens, or inverts a recorded control/decision. Verified on disk: no schema migration is added (`TARGET_VERSION=29`, `src/db/database.ts:53,67`; migration head 029), backup wire format stays 5 (`src/backup/types.ts:13`), Category CRUD stays out and `categories` remains read-only (D-03; `src/db/migrations/001-initial.ts:41`), ADR-047 is enforced not reversed — only `self_sun_colour`/`sunContactId` are written and no contact-center color control is added (D-02; `src/screens/SettingsScreen.tsx:452,471`), and no plan adds network egress on a read path (local-first intact). So there is no owner-escalation item of that kind arising from this review; the HIGHs below are plan-quality fixes, not decision reversals.

### Agreed Strengths (2+ reviewers)
- **Fixed sequential ordering is correct.** Almost every wave edits the same shrinking monolith + hub model + `SettingsStack`, so serial execution avoids conflicts and each later wave sees an accurate inventory.
- **The transitional `SettingsMore` route is a genuine behavior-preserving migration device** — the monolith stays reachable (mounted today at `Settings`, `SettingsStack.tsx:95/101`) until Plan 08 retires it, so nothing is lost mid-migration.
- **Managers are reused by navigation, not reimplemented** — `AIConnection/AIModelPicker/AIPersonalization/AIPermissions/AIPreview`, `SystemsManagement`, `CustomFields`, `Archived` are already registered (`SettingsStack.tsx:102-140`).
- **Hard-constraint discipline is real, verified on disk** (D-06, D-03, D-02, local-first) — see escalation-trigger check above.

### Agreed Concerns (2+ reviewers — highest priority)
- **HIGH — Plan 06 forks the Orrery's canonical preference source (§H DECIDED).** `SettingsOrreryScreen` is told to write `orrery_density`/`orrery_satellites_enabled` directly via `updateAppSettings` (`37-06-PLAN.md:73,83`), but the Orrery renders from `useOrreryPreferencesStore((s)=>s.committed)` (`src/screens/OrreryScreen.tsx:218`), a deliberately single-serialized-writer Zustand store whose `save()` writes SQLite *and* publishes `committed` (`src/stores/orrery-preferences-store.ts`). A second, unsynchronized write path is exactly the "duplicate preference model" §H forbids.
- **HIGH — Plan 07 backup restore/singleton safety hinges on unspecified `host` resolution.** The plan factors two *tested pure* helpers `restoreReturnRouteName(host)`/`shouldConsumeSharedBackup(host)` (`37-07-PLAN.md:100-102`), but the risky part — deriving `"backup-tab"` vs `"settings"` from nested navigation state via `getParent/getState` — is deferred to "reading the code first" with no exact parent ID, no fail-closed default, and no test (`37-07-PLAN.md:107,109`). Wrong resolution double-drains the native `consumeSharedBackup()` singleton (`src/screens/BackupScreen.tsx:259/262`) or leaves a shared backup silently unconsumed.
- **HIGH — Plan 08 About surface promises content with no runtime source (contradicts §K).** must_haves promise "app name/icon, semantic version/**build number**, dependency **licenses/acknowledgements**" (`37-08-PLAN.md:25`), but on disk `app.json` name/slug = `"orbit-scaffold"`, version `1.0.0`, no `android.versionCode`; `package.json` has no `expo-application` and there is no license/acknowledgements asset or generator. §K says omit unavailable rows — as written the task can't execute truthfully and risks showing the scaffold name.
- **MEDIUM (cross-cutting, Plans 01/04/08) — route-registration tests can't prove what they assert.** `SettingsStackParamList` is a compile-time type erased at runtime (`src/navigation/types.ts:229`); a test over the type or a hand-maintained allowlist passes even if a `<Stack.Screen>` is unregistered — and `CategoryManagement` is *deliberately* typed-but-unregistered (D-03), the exact false-positive case.

### Divergent Views
- **Plan 06 failure mechanism (nuance, not disagreement on severity).** Codex frames the divergence as "the Orrery need not rehydrate because the store stays hydrated." Claude corrected this against disk (and the orchestrator re-verified): `OrreryScreen` re-hydrates from SQLite on **every focus** (`OrreryScreen.tsx:409-416`; `reading` resets in the store's `.finally`, `orrery-preferences-store.ts:146-149`), so a Settings→Orrery change *is* picked up on refocus. Both still rate it HIGH: §H's DECIDED "changes agree immediately; no duplicate preference model" would then rest on an **undocumented, untested focus side-effect**, and the direct write races the store's in-flight `drain`. The required fix (route Settings through the store's `hydrate/save/retry`) is identical for both reviewers.

---

## Codex Review

_Model: gpt-5.6-sol (reasoning=low). Source-grounded lane, ran cleanly._

# Phase 37 Plan Review

## Summary

The eight-plan sequence is structurally sound and respects the major scope locks: no migration or backup-format bump, no Category CRUD, no ADR-047 reversal, and no removal of the Backup tab. The tracer-first decomposition and transitional `SettingsMore` route are especially good safeguards.

However, the plan set is not ready to execute unchanged. The most important defect is Plan 06: it proposes writing Orrery preferences directly through `updateAppSettings`, while the Orrery renders from a long-lived Zustand store. That would create two behavioral sources and can leave the Orrery stale, directly violating §H. Plan 07's host inference is underspecified for safety-critical dual-home behavior, and Plan 08 promises version/build/license content for which the repository currently has no complete runtime source. Several tests also claim stronger route/runtime guarantees than TypeScript-only allowlists can provide.

**Verdict: NEEDS REVISION. Overall risk: HIGH until the Orrery and dual-home issues are corrected.**

## Cross-plan strengths

- The fixed ordering is appropriate. Almost every wave edits the same stack, hub model, and shrinking monolith, so sequential execution avoids conflicts and gives each later plan an accurate inventory.
- The transitional route is a strong migration mechanism. `SettingsStack` currently mounts the monolith directly at `Settings` (`src/navigation/tabs/SettingsStack.tsx:95`); keeping it reachable as `SettingsMore` until final retirement protects behavior while the screen is split.
- The plans correctly preserve existing navigation destinations instead of recreating managers (`SettingsStack.tsx:102,113,118,140`).
- The no-schema/no-format constraint matches the repository. `TARGET_VERSION` resolves from migration 029 (`src/db/database.ts:53,67`); wire format is 5 (`src/backup/types.ts:13`).
- D-02 preserved: current Settings writes only `selfSunColour` and `sunContactId` (`src/screens/SettingsScreen.tsx:452,471`); no contact-center color column proposed.
- D-03 respected: no category writer added; row and screen deliberately withheld (`src/db/migrations/001-initial.ts:41`).

## Plan-by-plan review

### Plan 01 — Hub tracer and Interactions
- **MEDIUM — The route-validity test cannot prove what it claims.** `SettingsStackParamList` is a TypeScript type erased at runtime (`src/navigation/types.ts:229`). A manually maintained allowlist can diverge from the type and the actual `<Stack.Screen>` registrations. This matters because `CategoryManagement` is intentionally typed but deliberately unregistered.
- **MEDIUM — Task 1 is not independently green as written.** It registers `SettingsInteractionsRoute`, but Task 2 supplies the screen.
- **LOW — DAO round-trip coverage is asserted but not actually added here.**
- Suggestions: export one runtime `SETTINGS_REGISTERED_ROUTES` constant used by both `SettingsStack` and tests, or use a component-level navigation test; make Tasks 1+2 one atomic tracer; add a focused persistence test incl. write-failure behavior.

### Plan 02 — Theme controls
- **MEDIUM — Live state can diverge from durable state after a failed write.** The existing sequence updates Zustand first and launches persistence without awaiting it (`SettingsScreen.tsx:735`); the copied `persist()` catches/logs but does not roll back or surface failure (`SettingsScreen.tsx:501`).
- **LOW — Conditional wording ambiguous.** Should render the active package's background choices (Background UI renders both package groups today at `SettingsScreen.tsx:922`).
- Suggestions: state the screen renders only `BACKGROUND_ORDER[themePackage]` + None; add a package-switch/patch-key test; preserve failure behavior honestly or add an inline save-error/reload path.

### Plan 03 — Orbit appearance, global profile defaults, self name
- **MEDIUM — Self-name semantics underspecified.** UI fallback is `selfName ?? "You"` (`SettingsScreen.tsx:1577`); storing `""` yields a blank identity. Define trim/empty/clear-to-NULL/length + DAO signature.
- **MEDIUM — Global-template controls lack concrete data/loading/error design** (choices come from `listProfileLayoutTemplates`/`listProfileBackgroundTemplates`, `src/db/profile-presentation-read.ts:54`).
- **LOW — "Applies to new profile views" is inaccurate** — global value participates for any contact lacking a stronger override (`profile-presentation-read.ts:149`).
- Strengths: `setProfilePhoto` DAO analog is correct (`src/db/profile-dao.ts:38`); `profile.name` already exists (`001-initial.ts:51`, read at `profile-dao.ts:95`); global template defaults are real `app_settings` columns in the portable snapshot (`app-settings-dao.ts:923,1011`); per-contact managers correctly kept separate.

### Plan 04 — Contacts & Relationships
- **MEDIUM — The promised Contacts permission/status surface is not planned concretely.** An existing pattern with `Linking.openSettings()` lives in `src/services/contacts/use-read-contacts-permission.ts:150`; absent from `read_first`/instructions.
- **LOW — "Every active route is registered" has the same runtime/type-erasure weakness as Plan 01.**
- **LOW — Grepping only "the change" for category SQL is insufficient** — backup/test code legitimately writes categories; make it a file-ownership assertion.
- Strengths: migration inventory matches the current screen (`SettingsScreen.tsx:983,1056,1930`); preserves resumable reconcile path (`SettingsScreen.tsx:286,1085`); Categories reservation obeys D-03.

### Plan 05 — Notifications
- **MEDIUM — "Synchronously" is incorrect and tests do not prove reconciliation.** Current code invokes both reconcilers with `void`, without awaiting (`SettingsScreen.tsx:507`); source-text acceptance that both names occur proves nothing about routing/error handling.
- **MEDIUM — Permission state becomes "degraded" only when the Orbit master is enabled** (`SettingsScreen.tsx:349`) — not enough to power a general permission-status row + denied-only handoff.
- **LOW — Reconcile errors are silently detached.**
- Suggestions: extract/test a shared `persistNotificationSettings` (mocked DAO + reconcilers, failures, ordering); track raw OS permission status separately; replace "synchronously" with "immediately triggered."
- Strengths: treats schedule reconciliation as load-bearing (`SettingsScreen.tsx:498`); preserves all ten controls + native time picker; keeps birthday config distinct from presentation.

### Plan 06 — Orrery and AI
- **HIGH — The Orrery implementation violates the required shared preference source.** Orrery renders `useOrreryPreferencesStore().committed` (`src/screens/OrreryScreen.tsx:218`); its own controls write through `preferences.save(...)` which commits SQLite then publishes Zustand (`src/components/orrery/OrreryViewOptions.tsx:159,183`; `src/stores/orrery-preferences-store.ts:88`). The proposed Settings screen instead calls `updateAppSettings` directly; the DB can hold one value while the rendered Orrery shows another.
- **MEDIUM — The existing DAO test cannot catch this defect** (proves SQLite round-trip, not sync with the Zustand consumer).
- Suggestions: make `SettingsOrreryScreen` use `useOrreryPreferencesStore` hydrate/save/retry like `OrreryViewOptions`; add a shared-store integration test; keep `lastSystem` out of the Settings UI.
- Strengths: AI half reuses Phase 36 logic + leaf routes (`SettingsScreen.tsx:1730,1771`), keeps `AiService.ts` out of scope, changes only `ai_enabled`, excludes `orreryLastSystem`.

### Plan 07 — Data & Backup dual-home
- **HIGH — Host detection is not specified robustly enough for the singleton gate.** No exact parent ID, route traversal, or fallback — a mistaken fallback double-drains the native singleton or prevents the intended Backup-tab copy from consuming it.
- **MEDIUM — Origin handling spread across shared screens but only partially enumerated** (`RestorePreviewScreen.tsx:98,123`).
- **MEDIUM — Pure helper tests do not test host resolution** (they prove the mapping only).
- **LOW — The Settings hub row uses the generic route name `Backup`** (reduces type clarity in the root intersection).
- Suggestions: prefer explicit wrapper components passing `host="backup-tab"`/`host="settings"`; if inference remains, give navigators stable IDs + fail-closed policy + tests of nested states; test full restore sequence both hosts + single-drain assertion.
- Strengths: four-screen tree genuinely reusable (`BackupStack.tsx:10`); nav params serializable with manifest in a process-local map (`backup-restore-logic.ts:5,31`); singleton hazard correctly identified (`BackupScreen.tsx:259`; `linking.ts:60`); hard-reset hazard real (`RestoreResultScreen.tsx:18`).

### Plan 08 — About, widget, retirement
- **HIGH — The About contract cannot currently be fulfilled from the declared sources.** `app.json` identifies the app as `"orbit-scaffold"` with only version `1.0.0` and no `versionCode` (`app.json:2`); no licenses/acknowledgements asset, no `expo-application` (`package.json:5`).
- **MEDIUM — Monolith parity is mostly manual** — `tsc` detects stranded imports, not dropped behavior (async refresh, reconcile prompts, permission handling, AI hydration, modals).
- **MEDIUM — Final hub test still cannot prove screen registration if it relies on a manual route allowlist.**
- **LOW — The widget action is not naturally a navigation row** — needs a discriminated action-vs-route type.
- Suggestions: resolve About prerequisites (display metadata, runtime build-version source, license generation/bundling — reassess "no package installs") before Plan 08; build a checked migration matrix before Plan 01; discriminated union `{kind:"route"}|{kind:"action"}`; navigation/render tests per final row.
- Strengths: retirement delayed until all migrations complete; requires checking remaining imports/groups; full-suite gate on the deletion; widget action reuses existing pinning path (`SettingsScreen.tsx:1876`).

## Required revisions before execution (Codex)
1. Rewrite Plan 06 so Settings uses `useOrreryPreferencesStore.hydrate/save/retry`, not direct DAO writes.
2. Rewrite Plan 07 to pass an explicit host through stack wrappers, or fully specify + test navigator-ID-based host resolution.
3. Resolve Plan 08's About metadata/build-number/license source before promising that surface.
4. Replace manual route allowlists with a runtime registration contract or component-level navigation tests.
5. Define self-name empty/trim/clear/length semantics in Plan 03.
6. Add a phase-wide monolith migration inventory covering behavior and error states.
7. Strengthen notification tests to exercise reconcile calls through the actual shared write path.
8. Add an explicit physical-device UAT prerequisite: confirm package name and `emu-connect` target with the owner.

## Risk Assessment (Codex): HIGH
No schema bump, no format bump, no Category CRUD, no local-first violation, no ADR-047 reversal — hard constraints handled well. HIGH comes from Plan 06 (stale/duplicate Orrery preference source) and Plan 07 (native-singleton ownership on unspecified host inference), plus Plan 08's deliverability gap. Once corrected, residual decomposition work is likely MEDIUM.

---

## Claude Review

_Model: claude-opus-4-8. Obtained as a read-only source-grounded fork pass (see `lane_provenance`); HIGH findings re-verified against code on disk by the orchestrator._

## Summary

The 8-plan sequence is a well-structured, tracer-first decomposition of the 2,168-line `SettingsScreen.tsx` monolith into a navigation-first hub plus per-concept category screens over 8 fixed sequential waves. The hard project constraints are respected and each was confirmed against code: no migration added (`TARGET_VERSION`=29, `src/db/database.ts`; head 029), wire format stays 5 (`src/backup/types.ts`), Category CRUD is reserved-route-only (D-03; `001-initial.ts:41`), ADR-047 enforced not reversed (`SettingsScreen.tsx:452,471`), no network egress on a read path. The transitional `SettingsMore` route (Plan 01 → retired Plan 08) is a strong behavior-preserving migration device.

The set is **not ready to execute unchanged.** Three implementation-mechanism defects reach into DECIDED dossier invariants or a data-restore path, and a cross-cutting test-strength issue means several "route registered / behavior preserved" acceptance criteria cannot prove what they assert. **Verdict: NEEDS REVISION. Overall risk: HIGH.**

## Cross-plan strengths
- Fixed sequential ordering is correct (serial edits to the shrinking monolith + hub model + `SettingsStack`).
- Transitional route is a genuine safety net (`SettingsStack.tsx:101` mounts the monolith at `Settings`; reachable as `SettingsMore` until Plan 08).
- Managers reused by navigation, not reimplemented (`SettingsStack.tsx:102-119`).
- Hard-constraint discipline verified: no migration, no format bump, no category-mutation writer, no `fetch` on a read path, no contact-center color control.

## Plan-by-plan (concerns emphasized)

### Plan 01 — Hub tracer + Interactions
- **MEDIUM — route-validity test cannot prove runtime registration.** `SettingsStackParamList` is erased at runtime (`types.ts:229`); the `<Stack.Screen>` list (`SettingsStack.tsx:101-148`) is separate. A type/allowlist test passes even if a screen is unregistered — and `CategoryManagement` is deliberately typed-but-unregistered (D-03). Fix: runtime `SETTINGS_REGISTERED_ROUTES` constant or component-level nav test.
- **MEDIUM — tracer atomicity.** Task 1 registers the route but Task 2 supplies the screen; Task 1 isn't independently green. Make 1+2 atomic or ship a minimal compilable screen in Task 1.

### Plan 02 — Theme controls
- **MEDIUM — live vs durable divergence on a failed write carried forward silently** (`SettingsScreen.tsx:501`); "durable" shouldn't imply failure-safe. State the screen renders only `BACKGROUND_ORDER[themePackage]` + None (both groups render today at `SettingsScreen.tsx:922`) and add a package-switch/patch-key test.

### Plan 03 — Orbit appearance, global profile defaults, self name
- **MEDIUM — self-name semantics underspecified.** `selfName ?? "You"` (`SettingsScreen.tsx:1577`); define trim/max-length/blank-clears-to-NULL + DAO signature `string | null`. D-02/ADR-047 correctly enforced (`37-03-PLAN.md:100,110`).
- **LOW — "applies to new profile views" inaccurate** — participates for any contact lacking a stronger override (`profile-presentation-read.ts:149`); add an effective-presentation test.

### Plan 04 — Contacts & Relationships
- **MEDIUM — Contacts permission/status surface (§E/§G) not planned concretely** — reuse `src/services/contacts/use-read-contacts-permission.ts` (`Linking.openSettings()`); define denied/restricted/unavailable behavior.
- **LOW — "no category CRUD" guard is a broad repo grep** (`37-04-PLAN.md:114`); make it a file-ownership assertion (no new category DAO/mutation). D-03 reservation itself correct (`37-04-PLAN.md:105`).

### Plan 05 — Notifications
- **MEDIUM — "synchronously" inaccurate; tests don't prove reconciliation.** `void reconcileSchedule(exec)` is fire-and-forget (`SettingsScreen.tsx:507`). Extract/test a shared `persistNotificationSettings` (ordering + failure).
- **MEDIUM — permission "degraded" isn't a general permission signal** (`SettingsScreen.tsx:349` clears it when master off). Track raw OS status separately.

### Plan 06 — Orrery + AI — HIGH
- **HIGH — Settings Orrery writes bypass the canonical shared preference source (§H).** must_haves/AC write `orrery_density`/`orrery_satellites_enabled` directly via `updateAppSettings` (`37-06-PLAN.md:73,83`); Orrery renders from `useOrreryPreferencesStore((s)=>s.committed)` (`OrreryScreen.tsx:218`), the canonical single serialized writer whose `save()` writes SQLite *and* publishes `committed` (`orrery-preferences-store.ts:151-190`). A second unsynchronized writer is the "duplicate preference model" §H forbids.
  - **Correction to the naive failure story (verified on disk):** `OrreryScreen` re-hydrates from SQLite on **every focus** (`OrreryScreen.tsx:409-416`; `reading` resets in `.finally`, store `146-149`), so a Settings→Orrery change *is* picked up on refocus. Still HIGH: §H's DECIDED "changes agree immediately; no duplicate preference model" then rests on an **undocumented, untested focus side-effect**, the only test is a DAO round-trip that can't observe cross-surface agreement, and the write races the store's in-flight `drain`.
  - **Required revision:** route `SettingsOrreryScreen` through `useOrreryPreferencesStore.hydrate/save/retry` like `OrreryViewOptions`; add a shared-store integration test. AI half is fine.

### Plan 07 — Data & Backup dual-home — HIGH
- **HIGH — native shared-backup singleton safety hinges on `host` resolution, which is underspecified/untested.** Otherwise strong: serializable params + manifest in a module-singleton `Map` (`backup-restore-logic.ts:5-52`); correctly identifies every focused `BackupScreen` drains `consumeSharedBackup()` (`BackupScreen.tsx:262`); factors pure tested helpers (`37-07-PLAN.md:100-102`). But deriving `"backup-tab"` vs `"settings"` from nested nav state via `getParent/getState` is deferred to "reading the code first" — no parent ID, no traversal, no fail-closed default, no test (`37-07-PLAN.md:107,109`). Wrong resolution double-drains the singleton or leaves a shared backup unconsumed (silently broken restore).
  - **Required revision:** explicit wrapper components per stack passing `host="backup-tab"`/`host="settings"`, or pin navigator IDs + fail-closed default + tests of representative nested states + a single-drain-per-host test.

### Plan 08 — About, widget, monolith retirement — HIGH
- **HIGH — About must_have overreaches its data sources (contradicts §K).** Promises name/icon/version/**build number**/**licenses/acknowledgements** "from app config, not hardcoded" (`37-08-PLAN.md:25,71`). On disk: `app.json` name/slug=`"orbit-scaffold"`, version `1.0.0`, no `android.versionCode`; `package.json` no `expo-application`; no license asset/tooling. §K says omit unavailable rows. As written it can't execute truthfully and risks displaying the scaffold name.
  - **Required revision:** set a real product display name, choose a runtime build-version source (or drop "build number"), and either add license generation (reconciling "no installs") or narrow the must_have to name+version per §K.
- **MEDIUM — monolith parity largely manual.** `tsc` catches stranded imports, not dropped behavior. Build a phase-wide migration matrix (control/action/modal/focus-refresh/error state → destination plan) before Plan 01; make Plan 08 fail on any unaccounted entry. Give hub entries a discriminated `{kind:"route"}|{kind:"action"}` union so the widget row isn't mis-modeled (§L).

## Required revisions before execution (Claude)
1. Plan 06: route Settings Orrery through `useOrreryPreferencesStore` + cross-surface store test (§H).
2. Plan 07: deterministic `host` (explicit prop via stack wrappers) or specify + fail-close + test derivation; test single-drain per host.
3. Plan 08: resolve About name/build/license sources (or narrow to name+version per §K); reconcile tooling vs "no package installs."
4. Cross-cutting: runtime route-registration contract or component-level nav tests (esp. `CategoryManagement`).
5. Plan 03: self-name trim/empty/clear/length + DAO signature.
6. Phase-wide: behavior/error-state monolith migration matrix.
7. Plan 05: test the shared notification write path; separate raw OS permission status from "master-on-but-blocked."
8. Add an explicit device-UAT prerequisite (confirm package name + `emu-connect` target with owner).

## Risk Assessment (Claude): HIGH
Hard constraints handled well and verified on disk. HIGH from: Plan 06 forking the Orrery's canonical preference source against DECIDED §H (agreement resting on an untested focus side-effect); Plan 07 native-singleton ownership on unspecified/untested host inference on a data-restore path; Plan 08 About promising content with no runtime source. Residual decomposition work is MEDIUM once corrected.
