---
phase: 38
reviewers: [codex, claude]
reviewed_at: 2026-09-19T04:20:42Z
review_kind: full-adversarial
convergence_cycle: 8
plans_reviewed: [38-01-PLAN.md, 38-02-PLAN.md, 38-03-PLAN.md, 38-04-PLAN.md, 38-05-PLAN.md, 38-06-PLAN.md, 38-07-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=low)"
  claude: "claude read-only subagent (general-purpose; default subagent model)"
model_sources:
  codex: "banner"
  claude: "subagent"
cycle_summary: current_high=0 current_actionable=2
notes: >
  Cycle-8 FULL adversarial re-review of the current committed plans (HEAD c5fd5b0 — the cycle-7
  fixes applied: Plan 05 Task 3 + Plan 06 Task 2 task-gate verify commands now run their load-bearing
  controller/store tests, Plan 02 frontmatter files_modified gained the three backup/app-settings test
  files, and Plan 02 step 3b-v gained the 029-ai-configuration over-edit guard). Orchestrator
  independently re-verified all four cycle-7 fixes on disk (Plan 05 `<automated>` :160 now runs
  your-week-section-logic.test.ts; Plan 06 `<automated>` :150 now runs dashboard-query-store.test.ts;
  Plan 02 files_modified :14-16 lists all three test files; Plan 02 step 3b-v :242 carries the
  "only TARGET_VERSION pin at ~:22 moves; AI_CONFIGURATION_SCHEMA_VERSION at ~:21 stays 29" guard).
  NOT scoped to any prior finding list — all 7 plans reviewed fresh. The `claude` lane ran as a
  READ-ONLY Claude subagent (not the `claude -p` CLI lane, which fails on a Write-permission gap inside
  Claude Code — recorded workaround); it was explicitly instructed read-only and made no repo edits.
  Codex ran gpt-5.6-sol at the default LOW review-lane reasoning effort. Both reviewers were
  source-grounded. The orchestrator independently re-derived the orphaned-test-consumer sweep from
  scratch for all three changing contracts (TAB_ICON keys, TARGET_VERSION 29->30, BACKUP_FORMAT_VERSION
  6->7) plus the newly-emitted yourWeekPeriod snapshot key, and independently verified BOTH reviewers'
  new findings against the code on disk. Phase 38 is NOT yet executed (git log shows only `docs(38):`
  commits; tree clean).

  OUTCOME — NO HIGH findings this cycle. The recurring orphaned-test-consumer failure mode is fully
  swept: every breaking consumer of TAB_ICON (icon-registry.test.ts + RootNavigator.tsx → Plan 01;
  universal-fab-logic.test.ts stale string → Plan 04), TARGET_VERSION (full-chain / 029-ai-configuration /
  category-identity-audit → Plan 02), and BACKUP_FORMAT_VERSION (backup-schema / export-manifest /
  orrery-preferences-portability / orrery-exploration.integration / backup-service / category-identity-audit
  → Plan 02) is owned by exactly one plan and run in that plan's own verify gate. Migration 030 is the
  correct next free number (registry head 029; no 030 file). D-08/D-09/D-10 are implemented correctly
  (not re-litigated) and no finding reverses an ADR/HANDOFF/dossier decision. TWO fresh actionable
  non-HIGH items (both LOW, disjoint, one per reviewer) remain — both a *new instance of the same
  enumeration/ownership class* the cycle-7 pass fixed elsewhere, both disk-verified, both fixable by
  editing the named PLAN.md, and both caught at the owning task's own gate (not escaping build-breakers):
  (1) codex — Plan 03's dashboard-read.test.ts is run + named in artifacts/verification but absent from
  the two write-ownership lists; (2) claude — Plan 02's app-settings-dao.test.ts:534 full-object
  `toEqual` breaks under the new required yourWeekPeriod field but is not enumerated like its siblings.
  The target of 0 actionable is therefore NOT met this cycle; these two remain for the next fix pass.
---

# Cross-AI Plan Review — Phase 38 (Digest & Navigation Restructure) — FULL ADVERSARIAL (cycle 8)

## Consensus Summary

Both reviewers (Codex gpt-5.6-sol @ low; a read-only Claude subagent) independently find the seven
plans **technically coherent, correctly sequenced (waves 1→4 with sound dependencies),
single-owner-per-file, and exceptionally well source-grounded**. Neither reviewer found any
HIGH-severity issue and neither found a functional contract defect. The recurring failure mode for
this phase — an **orphaned test-consumer** of a changed symbol that breaks the project-wide
`tsc`/vitest gate but is owned by no plan — is swept exhaustively for all three changing contracts
plus the newly-emitted `yourWeekPeriod` snapshot key, and **no unowned build-breaker remains**.

The orchestrator independently re-derived the orphaned-consumer sweep on disk and confirms both
reviewers' verdicts:

- **TAB_ICON** — the only breaking consumers are `src/components/icons/icon-registry.test.ts`
  (asserts `TAB_ICON.BackupTab` at `:100`, a project-wide TS2339, and the four-key
  `Object.keys(TAB_ICON)` parity at `:108-110`) and the runtime use at `src/navigation/RootNavigator.tsx:207`.
  Both owned by Plan 01 (Task 1 step 5 + `<files>` + acceptance greps `! TAB_ICON.BackupTab` /
  `! "BackupTab"`). The stale `"BackupTab"` string at `universal-fab-logic.test.ts:156` is owned by
  Plan 04 (Task 3 removes it) and is non-breaking anyway (a plain string fed to
  `getFocusedContactContext`, whose nav-state `routes[].name` is typed `string`, not `keyof TabParamList`).
- **TARGET_VERSION (29→30)** — the only hard literal-29 pins are `full-chain.test.ts:87` (+ head-filter
  `:85`), `029-ai-configuration.test.ts:22`, and the `category-identity-audit.test.ts:223` meta-guard;
  all owned by Plan 02 (Task 2 step g + Task 3 step 3b). The `027`/`028`/`profile-presentation`
  assertions use `toBeGreaterThanOrEqual` and stay green at 30; the ~60 files that merely import
  `TARGET_VERSION` to migrate-to-head are additive-safe.
- **BACKUP_FORMAT_VERSION (6→7)** — every format-6 assertion is owned by Plan 02 Task 3:
  `backup-schema.test.ts`, `export-manifest.test.ts`, `orrery-preferences-portability.test.ts`,
  `orrery-exploration.integration.test.ts`, `backup-service.test.ts`, and the
  `category-identity-audit.test.ts:224` regex meta-guard (step 3b + step 5, verify runs `src/backup/`
  + `src/services/backup/` + the named files).

All four cycle-7 fixes were independently confirmed applied on disk (Plan 05 `<automated>` :160,
Plan 06 `<automated>` :150, Plan 02 `files_modified` :14-16, Plan 02 step 3b-v :242 over-edit guard).

### Agreed Strengths
- Migration 030 is the correct next free number (registry head `029-ai-configuration.ts`; no `030`
  file on disk) and `TARGET_VERSION` 29→30 with an additive, forward-only ALTER is right. (both reviewers)
- The `TAB_ICON` / `TARGET_VERSION` / `BACKUP_FORMAT_VERSION` orphaned-consumer sweep is complete —
  every breaking old-shape consumer is owned by a plan and run in that plan's own verify. (both reviewers)
- D-08 (yourWeekPeriod portable + format 6→7 + `FORWARD_MIGRATIONS[6]` + reused parse-boundary
  validator, following the LANDED Phase-36 emit policy — not the spent deferred-comment pattern),
  D-09 (both a Settings row and an in-context toggle on one `app_settings.your_week_period` key with
  focus-time re-read; not a D-03 reversal), and D-10 (the shared not-contacted population relaxation
  matches `countNeverContacted` verbatim, scoped to a deduped `["not-contacted"]` selection ONLY, with
  a documented Contacts-tab blast radius and a no-op default when the flag is off) are implemented
  correctly and not re-litigated. (both reviewers)
- Preserving the internal `DashboardTab` id while removing `BackupTab` protects the FAB's hardcoded
  `navigate("DashboardTab", …)` target and every stale-string test consumer. (both reviewers)
- The `app-settings-dao.ts` writer contract is real: the generic writer iterates
  `Object.keys(COLUMN_OF)` at `:1486-1489` (no `KEY_TO_COLUMN` exists), so Plan 02's full
  `yourWeekPeriod` threading is necessary and its line refs are accurate. (both reviewers)
- The atomic both-axes drill-through (`setPopulationsAndFilters`, Plan 06) is correctly modeled on the
  existing `resetDashboardView` precedent and fixes a real single-axis stale-composition desync. (both reviewers)
- Plan 07's render-free `shell-contract.test.ts` (runtime `TAB_ORDER`/`INITIAL_TAB`/`TAB_ICON` parity +
  pure `resolveNotificationNav`) is the right strategy given the node-only `vitest.config.ts` with no
  react-test-renderer, and it correctly leaves live traversal / reselect-to-root to device UAT. (both reviewers)

### Agreed Concerns
- None at HIGH. The two reviewers each surfaced one **disjoint** LOW actionable item (different plan,
  different mechanism); neither contradicts the other. Both are a new instance of the same
  enumeration/ownership class that cycle-7 fixed for other files.

### Divergent Views
- The reviewers surfaced different, non-overlapping actionable items rather than disagreeing. Codex
  focused on Plan 03's write-ownership lists (an integration test run + named but not owned); the
  Claude subagent focused on a specific full-object `toEqual` in Plan 02's app-settings test that the
  plan does not enumerate like its siblings. The orchestrator verified BOTH on disk and holds both as
  valid and actionable. Notably, codex judged Plan 02 clean (0 concerns) and missed the `:534`
  `toEqual`; the Claude subagent caught it — the intended cross-AI blind-spot coverage.

### Actionable items this cycle (both disk-verified by the orchestrator; both LOW; target 0 NOT met)
1. **LOW (codex) — Plan 03: `src/db/dashboard-read.test.ts` is run and named but is in neither
   write-ownership list.** Task 3's `<automated>` (`38-03-PLAN.md:173`) runs
   `src/db/dashboard-read.test.ts`; Task 3's acceptance (criterion 2) requires a real-DB assertion that
   `countNeverContacted(exec) == listDashboardPopulation({populations:['not-contacted'],…}).length` under
   the enabled unbound flag (both functions live in `dashboard-read.ts`, so the natural test home is
   `dashboard-read.test.ts`); the artifacts section (`:192`) and plan verification (`:225`) both name it
   as extended/run. But the file is absent from the plan-level `files_modified` (`:7-11`) AND Task 3's
   `<files>` (`38-03-PLAN.md` Task 3 declaration). An executor respecting the declared write boundary
   could add the D-10 equivalence assertion to the owned `dashboard-query-logic.test.ts` (or omit it)
   rather than to `dashboard-read.test.ts`. Not a wave-collision (no other wave-1 plan owns it), purely
   an ownership inconsistency. **Fix:** add `src/db/dashboard-read.test.ts` to Plan 03's `files_modified`
   and Task 3's `<files>`.
2. **LOW (claude) — Plan 02: the full-object `toEqual` at `src/db/app-settings-dao.test.ts:534` is not
   enumerated like its sibling breakers.** The `it("roundtrips every field")` case asserts
   `expect(await getAppSettings(exec)).toEqual({ …explicit keys + spreads… })` with no `yourWeekPeriod`
   key. Task 2 adds a REQUIRED `AppSettings.yourWeekPeriod` field (`38-02-PLAN.md:166`, `:307`) and
   threads it into the `getAppSettings` return (step g, `:193`), so `getAppSettings()` returns an extra
   key and this strict `toEqual` fails. The file IS owned (`files_modified` `:16`) and Task 2's
   `<verify>` (`:198`) runs it, so the break is caught at the owning task's own gate — NOT an escaping
   build-breaker. But unlike its siblings (`full-chain.test.ts`, `category-identity-audit.test.ts`),
   which the plan enumerates line-by-line, this specific full-equality assertion is named nowhere, so an
   executor could append a new persist→reload case (which the acceptance asks for) and still leave `:534`
   red for a cycle. **Fix:** in Plan 02 Task 2 step (g)/action, add `src/db/app-settings-dao.test.ts:534`
   to the enumerated updates — the full-object `toEqual` must gain `yourWeekPeriod: 'rolling7'` (or a
   `YOUR_WEEK_DEFAULTS` spread). (`orrery-preferences.test.ts:131`'s `toEqual(before)` is
   runtime-to-runtime and safe; no action.)

No new finding deletes, weakens, or inverts a recorded ADR / HANDOFF / dossier decision. The one guard
being loosened (the `category-identity-audit` no-schema-change boundary) is explicitly authorized by
owner-ruling D-08 and flagged as such in Plan 02 — it is not a hidden reversal. The `readOverlooked`
snooze-exclusion in Plan 03 *adds* a control aligned with snooze semantics and rests on a code comment,
not an ADR — no escalation trigger.

---

## Codex Review

<!-- Codex gpt-5.6-sol (reasoning=low); source-grounded; full adversarial pass, all 7 plans fresh. -->

# Phase 38 Cross-AI Plan Review

Reviewed at git HEAD `c5fd5b05660e9658c7c138c04840cff04f9b9d4a`. The working tree was clean. I reviewed all seven plans, supporting Phase 38 artifacts, the cited source files, and the relevant SQL/read/write paths.

## Plan 38-01 — Five-tab shell and semantic routing

### Summary

The plan correctly converts the four-tab shell into Contacts · Events · Digest · Orrery · Settings, retains the internal `DashboardTab` identifier, promotes Digest and Events into independent stacks, and removes the Backup tab without stranding shared-backup restore.

### Strengths

- The current tab-icon contract is genuinely coupled to `TabParamList`: `TAB_ICON` is a `Record<keyof TabParamList, IconName>` at `src/components/icons/icon-registry.ts:107-112`. Adding `DigestTab`/`EventsTab` and removing `BackupTab` therefore requires the coordinated type and map edit the plan specifies.
- The current icon test hardcodes both `TAB_ICON.BackupTab` and the exact four-key set at `src/components/icons/icon-registry.test.ts:96-117`. Plan 01 explicitly owns that file in both `files_modified` and Task 1, preventing an orphaned test consumer.
- The migration from Backup tab to Settings is necessary in actual code: the share-intent gate currently navigates to `BackupTab` at `src/navigation/linking.ts:63-68`.
- The plan catches the less-obvious restore regression. The Settings-hosted screen currently does not consume a shared backup because `shouldConsumeSharedBackup()` returns true only for `"backup-tab"` at `src/screens/backup-dualhome-logic.ts:51-60`, and `BackupScreen` exits before `consumeSharedBackup()` when that returns false at `src/screens/BackupScreen.tsx:268-277`.
- The new Digest/Events stacks are required to reproduce all Profile-reachable routes, not merely `Profile`. The plan includes `RecentlyDeleted` and the edit/compose/merge descendants, preventing an origin-aware route from typechecking globally but failing inside the originating stack.
- The plan correctly retains the old Dashboard param-list entries until Plan 04 repoints the notification and overflow consumers, avoiding a wave-1 type break.

### Concerns

None.

### Suggestions

None. The plan’s render-free shell descriptor is an appropriate substitute for a navigator-mount test in this repository; live traversal and reselect behavior remain covered by Plan 07 device UAT.

### Risk

Medium implementation risk because navigation promotion and Backup-tab removal have broad reach, but the plan explicitly covers the real deep-link and shared-backup consumers.

---

## Plan 38-02 — Your Week data, migration 030, backup format 7

### Summary

The plan provides a sound additive migration, threads `yourWeekPeriod` through the complete settings writer/read/restore contract, bumps the portable format to 7, and defines app-wide activity aggregation without creating Digest-owned relationship state.

### Strengths

- Migration numbering is correct. The registry currently ends at migration 029 at `src/db/database.ts:25-55,67-100`; migration 030 is the next additive step.
- The plan correctly identifies the full generic settings contract. Existing preferences must appear in:

  - `AppSettings`, currently including history fields at `src/db/app-settings-dao.ts:300-317`;
  - optional `PortableSettingsSnapshot` fields feeding `AppSettingsPatch` at `src/db/app-settings-dao.ts:450-508`;
  - `WritableSettingsKey` at `src/db/app-settings-dao.ts:531-584`;
  - `AppSettingsRow` at `src/db/app-settings-dao.ts:587-655`;
  - `COLUMN_OF`, which drives generic updates, at `src/db/app-settings-dao.ts:687-737`;
  - the portable SELECT and return projection at `src/db/app-settings-dao.ts:960-1021`.

  The plan covers all of these and does not rely on the nonexistent `KEY_TO_COLUMN` mechanism.
- The proposed migration is additive: one `ALTER TABLE app_settings ADD COLUMN`, preserving the forward-only migration rule.
- The current portable format really is 6 at `src/backup/types.ts:13-15`, and parsing returns the current format at `src/backup/backup-schema.ts:952-959`; the proposed format-6→7 forward migration is therefore required rather than cosmetic.
- The plan owns every direct exact-value backup consumer found in the sweep, including:

  - `src/backup/backup-schema.test.ts`;
  - `src/backup/export-manifest.test.ts`;
  - `src/backup/orrery-preferences-portability.test.ts`;
  - `src/services/orrery-exploration.integration.test.ts`;
  - `src/services/backup/backup-service.test.ts`;
  - `src/category-identity-audit.test.ts`.

- It also owns both current schema-head pins:

  - `TARGET_VERSION === 29` in `src/db/migrations/029-ai-configuration.test.ts:19-28`;
  - `TARGET_VERSION === 29` and the migration-29 registration check in `src/db/migrations/full-chain.test.ts:15-92`.

- The calendar-week design correctly accounts for the 1-based Expo weekday versus JavaScript’s 0-based weekday. The existing date implementation uses `getDay()` with Sunday = 0 at `src/services/history/window.ts:73-77`.
- Group-event aggregation is appropriately split into headline interaction counts versus deduplicated activity units. This matches the real storage model, where group events own child interaction rows; the group writer reads those children from `interactions` at `src/db/group-events-dao.ts:162-176`.
- The plan keeps date arithmetic local and reuses the existing seven-day builder at `src/services/history/window.ts:90-100,149-157`.

### Concerns

None.

### Suggestions

None. The pre-write checkpoint is framed as verification of irreversible mechanics, not a re-vote on D-08.

### Risk

High intrinsic migration/backup risk, but low residual planning risk. The one-way changes, forward compatibility, writer threading, validation, and exact-value tests are all explicitly covered.

---

## Plan 38-03 — Up Next and Horizon composition

### Summary

The plan correctly derives Up Next from canonical status/progress semantics, deduplicates Horizon, introduces the seven-day birthday filter, and implements D-10’s narrowly scoped not-contacted population extension.

### Strengths

- Canonical status thresholds and SQL are centralized at `src/db/status.ts:40-42,59-78,100-104`. The plan imports these rather than deriving Digest-specific urgency.
- The cadence precondition is load-bearing because `STATUS_SQL` would otherwise classify null progress as stable; that contract is documented at `src/db/status.ts:53-64`. Plan 03 includes it.
- The attention threshold and snooze predicate match the existing Contacts filter at `src/logic/dashboard-query-logic.ts:173-175`.
- The existing `buildPopulationWhere` applies a global bound-only scope at `src/logic/dashboard-query-logic.ts:248-283`, confirming that D-10 requires a special exact-`["not-contacted"]` branch.
- `countNeverContacted` already includes opted-in unbound contacts through the `app_settings` subquery at `src/db/dashboard-read.ts:539-553`. Reusing that exact predicate gives the required count/preview/drill parity.
- The plan explicitly leaves mixed population selections and all other population branches under the existing scope. That is consistent with the current shared population construction at `src/logic/dashboard-query-logic.ts:257-280`.
- `readOverlooked` currently lacks a snooze condition at `src/db/digest-read.ts:102-123`; the proposed addition is necessary to match its needs-attention drill target.
- Birthday candidates are a broad non-archived source at `src/db/dashboard-read.ts:619-627`, so applying the separate 0–6-day pure filter is the correct way to produce Horizon’s seven-day window without altering the existing 30-day Contacts population.
- The plan does not pre-cap the Up Next SQL, leaving enough candidates for cap-and-dedup composition.

### Concerns

- **LOW — `src/db/dashboard-read.test.ts` is required to change but is not formally task-owned.** Task 3 requires and verifies a real-DB assertion that `countNeverContacted()` equals `listDashboardPopulation()` under the enabled unbound setting (`38-03-PLAN.md:162-179`), and the artifacts section says `src/db/dashboard-read.test.ts` is extended (`38-03-PLAN.md:186-192`). However, the file is absent from both the plan-level `files_modified` list (`38-03-PLAN.md:7-11`) and Task 3’s `<files>` declaration (`38-03-PLAN.md:153-155`). The current test file is also explicitly executed by Task 3 at `38-03-PLAN.md:173`. This is an ownership inconsistency: an executor respecting the declared write boundary could omit the integration assertion while still following the task’s named files.

### Suggestions

Add `src/db/dashboard-read.test.ts` to Plan 03’s `files_modified` and Task 3 `<files>`. No implementation change is needed beyond what the action already specifies.

### Risk

Low-to-medium. The data semantics are sound; the only issue is explicit ownership of a required integration-test edit.

---

## Plan 38-04 — Notifications, header cleanup, FAB, overflow

### Summary

The plan correctly repoints digest notifications to the new root tab, removes obsolete header shortcuts, preserves the global FAB, and replaces dead in-stack Group Events navigation with a typed cross-tab callback.

### Strengths

- The current notification resolver emits `[Home, Digest]` at `src/services/notifications/notification-nav.ts:31-52,76-92`, and the gate currently applies every resolved intent through `resetToDashboardWith` at `src/navigation/notification-gate.tsx:129-152`. A new Digest-tab reset path is therefore required.
- The existing stale-request guard is real: `applyBodyNav()` checks `isCurrent()` after the asynchronous lookup at `src/navigation/notification-gate.tsx:123-151`, and the gate increments request IDs at `src/navigation/notification-gate.tsx:199-216`. The plan explicitly preserves this for contact notifications while bypassing unnecessary lookup for Digest.
- The FAB remains globally mounted, while its context recognizer currently knows only the pre-Phase-38 tab set. Extending it for Profile routes inside Digest and Events is appropriately scoped.
- The existing FAB test contains a stale `"BackupTab"` root case, independently confirmed at `src/components/universal-fab-logic.test.ts:152-162`; Plan 04 explicitly owns and updates it.
- A dedicated `openEvents()` callback is better than weakening the local `navigate()` union. It correctly reflects that `HomeScreen` is nested in a stack and must obtain its tab parent before calling `navigate("EventsTab", {screen: "GroupEvents"})`.
- Removing stale Dashboard param-list entries only after the notification and overflow consumers are repointed closes a real typechecks-but-crashes footgun.

### Concerns

None.

### Suggestions

None.

### Risk

Medium because notification resets and nested cross-tab navigation are runtime-sensitive. The pure resolver tests, concurrency test, compile gate, and physical-device UAT cover the relevant failure modes.

---

## Plan 38-05 — Your Week presentation and Settings row

### Summary

The plan supplies a period-scoped heatmap, app-wide inline day detail, resilient period-state handling, and both D-09 preference surfaces using one persisted key.

### Strengths

- Reusing `HistoryWindow` is structurally compatible: it provides date, placeholder, and future-state cells at `src/services/history/window.ts:27-48`.
- The existing seven-day builder already marks future cells and uses local date arithmetic at `src/services/history/window.ts:60-66,84-100`; the proposed Digest heatmap can consume the same shape.
- The plan correctly avoids feeding pre-aggregated `{d,n}` rows through `buckets()`. It builds the count map directly and limits shared reuse to heatmap classification and the theme ramp.
- Future Calendar Week cells are explicitly non-interactive, matching the distinction carried by `WindowCell.isFuture` at `src/services/history/window.ts:33-34`.
- The selected-state contract includes structural styling and accessibility state, avoiding a colour-only signal.
- The stateful behaviors that cannot be exercised by render-free component tests are extracted into `your-week-section-logic.ts`: stale-generation rejection, persistence rollback, and selected-day invalidation all gain a node-testable seam.
- The existing settings architecture is database-backed, not a shared reactive store. Defining D-09 synchronization as focus-time reload is therefore accurate.
- Both surfaces write the same `yourWeekPeriod` key, preventing a duplicate preference or divergent restore behavior.

### Concerns

None.

### Suggestions

None.

### Risk

Medium. The main risks are stale asynchronous results and preference-write failures; both are explicitly designed and tested through the pure controller.

---

## Plan 38-06 — Digest assembly and drill-through

### Summary

The plan composes the three fixed Digest modules, preserves canonical reads, and makes Horizon drill-through replace both Contacts query axes atomically before navigation.

### Strengths

- The Up Next row design matches the real query shape. `REASON_SQL` is non-null only for rogue rows at `src/db/status.ts:80-104`, so the plan’s status fallback prevents blank context text for wobble and decay.
- Avoiding the full `ContactCard` prevents fabricated Dashboard-only fields. The plan instead reuses the avatar and status-ring primitives.
- Never Contacted preview rows come from the same `listDashboardPopulation()` path used by Contacts. The actual read composes `buildPopulationWhere()` and applies the resulting SQL at `src/db/dashboard-read.ts:310-334,380-410`.
- The plan correctly distinguishes exact Never Contacted drill parity from the broader needs-attention destination used by Overlooked. It consequently avoids a misleading numeric `+N more` label for Overlooked.
- The proposed `setPopulationsAndFilters` action fixes a real state-composition problem: Contacts combines population and filter SQL, so changing only one persisted axis can leave the other axis narrowing the result.
- Persist-before-navigate ordering prevents Contacts from briefly or permanently displaying the previous query state.
- The Digest read lifecycle includes a null/loading sentinel, retry-on-focus behavior, cancellation protection, and no network/write operation on the read path.
- Module order is fixed as Up Next → Horizon → Your Week, matching the dossier.

### Concerns

None.

### Suggestions

None.

### Risk

Medium. Cross-tab drill state and asynchronous focus reads are the largest hazards, but the plan gives both explicit atomicity/failure semantics and tests.

---

## Plan 38-07 — Regression gate and physical-device UAT

### Summary

The plan provides the project-wide automated gate plus physical-device validation for behavior that cannot be proven by the render-free Vitest environment.

### Strengths

- The shell regression test uses runtime values—`TAB_ORDER`, `INITIAL_TAB`, `TAB_ICON`, and `resolveNotificationNav`—instead of attempting to inspect erased TypeScript types or mount an unavailable navigation renderer.
- It correctly leaves fresh-launch behavior, reselect-to-root, and nested Back traversal to device UAT.
- The full automated gate runs Vitest, `tsc --noEmit`, and the colour-token checker.
- The repair loop attributes a feature defect back to the plan that owns the affected file rather than silently accumulating implementation edits in the regression plan.
- The device precondition requires owner-confirmed package name, Metro session, and exactly one authorized target. This follows the repository’s Android safety rules.
- The UAT explicitly records PASS / FAIL / BLOCKED rather than inferring success from a rendered screen.
- Fixture guidance prefers canonical DAOs and requires invariant checks if raw SQL is unavoidable.
- Offline cold-launch verification directly tests the local-first requirement.
- Both themes, large text, structural heatmap selection, notification routing, shared-backup reachability, and origin-aware Back behavior are included.

### Concerns

None.

### Suggestions

None.

### Risk

Low planning risk. Device availability or fixture provisioning may block closure, but the plan treats that honestly as BLOCKED rather than a false pass.

---

# Cross-cutting review (Codex)

## Orphaned-consumer sweep

### `TAB_ICON`

Current consumers found:

- Runtime: `src/navigation/RootNavigator.tsx:18,207`.
- Direct contract tests: `src/components/icons/icon-registry.test.ts:96-117`.

Additional removed-tab literal consumer:

- `src/components/universal-fab-logic.test.ts:152-162`.

Verdict: **PASS.** Plan 01 owns `RootNavigator.tsx`, `icon-registry.ts`, and `icon-registry.test.ts`; Plan 04 owns the stale FAB test. No unowned breaking `TAB_ICON` consumer remains.

### `TARGET_VERSION`

Most tests import `TARGET_VERSION` only to run the current chain and therefore adapt automatically. Exact head assertions found:

- `src/db/migrations/029-ai-configuration.test.ts:19-28`.
- `src/db/migrations/full-chain.test.ts:15-92`.
- The source-scanning boundary assertion in `src/category-identity-audit.test.ts:215-225`.

Verdict: **PASS.** Plan 02 Task 2 owns `full-chain.test.ts`; Task 3 owns `029-ai-configuration.test.ts` and `category-identity-audit.test.ts`. No unowned exact 29 assertion remains.

### `BACKUP_FORMAT_VERSION`

Direct and literal format-6 assertions found in:

- `src/backup/backup-schema.test.ts`;
- `src/backup/export-manifest.test.ts`;
- `src/backup/orrery-preferences-portability.test.ts`;
- `src/services/orrery-exploration.integration.test.ts`;
- `src/services/backup/backup-service.test.ts`;
- `src/category-identity-audit.test.ts`.

The live constant is currently 6 at `src/backup/types.ts:13-15`.

Verdict: **PASS.** Plan 02 Task 3 names and edits every breaking consumer. No unowned format-6 consumer remains.

## Migration numbering

**PASS.** The live registry ends at 029 and `TARGET_VERSION` is derived from `AI_CONFIGURATION_SCHEMA_VERSION` at `src/db/database.ts:52-67`; migration 029 is the final registered entry at `src/db/database.ts:98-100`. Migration 030 is correctly additive and appended rather than modifying a shipped migration.

## D-08 compliance

**PASS.** Plan 02:

- bumps format 6→7;
- emits `yourWeekPeriod` from `getPortableSettingsSnapshot`;
- adds it to portable validation/restoration;
- adds `FORWARD_MIGRATIONS[6]`;
- tests format-6 defaulting and format-7 round-trip preservation.

This follows the landed emission model visible in the existing snapshot projection at `src/db/app-settings-dao.ts:960-1021`.

## D-09 compliance

**PASS.** Plan 05 provides both:

- an in-context Digest toggle;
- a Settings row.

Both read and write the single `app_settings.your_week_period` value and re-read on focus. The plan accurately avoids claiming instantaneous cross-screen reactivity.

## D-10 compliance

**PASS.** Plan 03 changes only the exact single `["not-contacted"]` selection from the current bound-only population scope at `src/logic/dashboard-query-logic.ts:218-220,248-283`. It reuses the predicate already used by `countNeverContacted` at `src/db/dashboard-read.ts:539-553`.

The plan explicitly proves:

- flag on: opted-in unbound never-contacted rows are included;
- flag off: they remain excluded;
- `all-contacts` and `favourites` remain bound-only;
- mixed population selections retain the existing scope.

No other population is broadened.

# Overall verdict

**Overall risk: LOW-MEDIUM.**

The seven plans are technically coherent and cover the previously fragile navigation, migration, backup, query-state, group-event, and test-consumer boundaries. I found no HIGH issue and no functional contract defect.

There is one actionable documentation/ownership defect in Plan 03: `src/db/dashboard-read.test.ts` must be added to the formal file lists for Task 3.

- **HIGH findings: 0**
- **Actionable non-HIGH findings: 1 LOW**

---

## Claude Review

<!-- Read-only Claude subagent (general-purpose; default subagent model); source-grounded; full adversarial pass, all 7 plans fresh. Ran as a subagent because the `claude -p` CLI lane fails on a Write-permission gap inside Claude Code (recorded workaround). Instructed strictly read-only; made no repo edits. -->

# Cross-AI Plan Review — Phase 38 (Digest & Navigation Restructure) — Fresh Adversarial Pass

Repo HEAD `c5fd5b0`. All seven plans read in full; every load-bearing `file:line` claim spot-checked against the code on disk; the three changing contracts (TAB_ICON, TARGET_VERSION, BACKUP_FORMAT_VERSION) plus the new `yourWeekPeriod` snapshot key re-swept from scratch across `src/**` including `*.test.ts(x)`.

## Plan 01 — Five-tab shell + semantic routing
**Summary.** Promotes Digest to the centered default tab, promotes Events, removes the Backup tab, introduces the render-free `shell-contract.ts` descriptor, preserves the internal `DashboardTab` id.
**Strengths.** The `TAB_ICON` re-key breakage is correctly owned: `icon-registry.test.ts:100` (`TAB_ICON.BackupTab`, a project-wide TS2339) and `:108-110` (`Object.keys` parity to `["BackupTab","DashboardTab","OrreryTab","SettingsTab"]`) are both in `files_modified` and rewritten by Task 1 step 5 (verified on disk — these assertions exist exactly as the plan states). The `linking.ts:67` `navigate("BackupTab",…)` share-intent path and the `shouldConsumeSharedBackup` consumer flip (`backup-dualhome-logic.ts:58-60` returns true only for `"backup-tab"`, disk-confirmed) are correctly identified and owned in the same wave-1 commit. The render-free descriptor approach correctly avoids the non-existent react-test-renderer.
**Concerns.** None HIGH/actionable. (LOW, no change needed) `universal-fab-logic.test.ts:156` still contains `"BackupTab"` as a plain string in a browse-surface array — it does NOT break wave-1 tsc (untyped string, `getFocusedContactContext` takes a nav-state, not `keyof TabParamList`) and is correctly assigned to Plan 04 Task 3; no wave-1 hazard.
**Risk.** Low.

## Plan 02 — Your Week data, migration 030, backup format 7
**Summary.** Locale-aware week window, migration 030 (`app_settings.your_week_period`), TARGET_VERSION 30, `yourWeekPeriod` wired through the real writer contract, BACKUP_FORMAT_VERSION 6→7, app-wide read DAO.
**Strengths (disk-verified).** The writer contract is real: `COLUMN_OF` exists at `app-settings-dao.ts:692` and the generic writer iterates `Object.keys(COLUMN_OF)` at `:1486-1489` — there is NO `KEY_TO_COLUMN` (the cycle-2 hallucination is genuinely gone). `getPortableSettingsSnapshot` (`:888`) emits `history_lens` at `:960` — the landed Phase-36 pattern the plan copies. The reused parse-boundary validators (`assertDefaultInteractionChannel`/`assertMessageMode`) exist and are already consumed in `backup-schema.ts:307/326`, grounding the `assertYourWeekPeriod` reuse. Migration numbering is correct: on-disk head is `029`, `TARGET_VERSION = AI_CONFIGURATION_SCHEMA_VERSION` (29) at `database.ts:67`, so 030 is the next free number; the ALTER is additive/forward-only. `FORWARD_MIGRATIONS[5]` exists (`backup-schema.ts:127`) and the parse loop requires `FORWARD_MIGRATIONS[from]` up to MAX (`:991`), so the mandatory `FORWARD_MIGRATIONS[6]` is correctly identified.
**Orphaned-consumer ownership (all verified owned + run in Task 2/3 verify):** `full-chain.test.ts:85/87`, `029-ai-configuration.test.ts:22` (with the correct guard keeping `:21` `AI_CONFIGURATION_SCHEMA_VERSION` at 29), `category-identity-audit.test.ts:220/222/223/224` (all four assertions in the `it()` block break — `TARGET_VERSION=…SCHEMA_VERSION` string, `not.toMatch(/migration030/)`, `toBe(29)`, and the `BACKUP_FORMAT_VERSION\s*=\s*6` regex — and the plan's step 3b(i) + acceptance `= 6` covers them; this boundary loosening is explicitly authorized by D-08 per the prompt, NOT a reversal), `orrery-preferences-portability.test.ts:151/152`, `orrery-exploration.integration.test.ts:608`, `backup-service.test.ts:174/203`, and the `export-manifest.test.ts`/`backup-schema.test.ts` `.toBe(6)` pins (owned via `files_modified`).
**Concerns.**
- **(LOW, actionable) `app-settings-dao.test.ts:534` `expect(await getAppSettings(exec)).toEqual({…})`** is a *full-object* equality (explicit keys + `...THEME_DEFAULTS/...HISTORY_DEFAULTS/…` spreads) with no `yourWeekPeriod`. Adding the REQUIRED `yourWeekPeriod` to `AppSettings` makes `getAppSettings()` return an extra key and this `toEqual` fails. The file IS owned (in `files_modified`) and Task 2's `<verify>` runs it, so the failure is caught at the owning task's own gate (not an escaping build-breaker) — but unlike its siblings (`full-chain`, `category-identity-audit`) this specific full-equality assertion is not named anywhere in the plan. Prior cycles enumerated every other breaking pin by line; this one should be named too. **Exact PLAN.md change:** in Plan 02 Task 2 step (g)/action, add `src/db/app-settings-dao.test.ts:534` to the enumerated updates ("add `yourWeekPeriod: 'rolling7'` to the full-object `toEqual` expectation"). (`orrery-preferences.test.ts:131` `toEqual(before)` is runtime-to-runtime — safe, no action.)
**Risk.** Low.

## Plan 03 — Up Next + Horizon composition (+ D-10)
**Summary.** New `up-next-read` (canonical attention floor), pure `digest-composition`, and the two read-path fixes: D-10 not-contacted unbound-inclusive + `readOverlooked` snooze guard.
**Strengths (disk-verified).** `countNeverContacted` (`dashboard-read.ts`) uses *exactly* the predicate D-10/Plan 03 cite verbatim (`archived_at IS NULL AND last_contact IS NULL AND (tracking_enabled = 1 OR (tracking_enabled = 0 AND (SELECT include_unbound_never_contacted FROM app_settings WHERE id = 1) = 1))`). `buildPopulationWhere` (`dashboard-query-logic.ts:248-283`) prepends `DASHBOARD_POPULATION_SCOPE_WHERE` (`tracking_enabled = 1`, `:219-220`) over the OR of predicates — so scoping the relaxation to a `selected.length===1 && "not-contacted"` early-return is structurally sound. `readOverlooked` (`digest-read.ts`) confirmed to have NO snooze clause and the "mute filter DELIBERATELY omitted" docblock; adding the snooze exclusion to match the drill target is a consistency fix, not a recorded-decision reversal (the omission is a code comment, not an ADR; the change *adds* a control aligned with snooze semantics — no escalation trigger).
**D-10 scoping verdict.** Correctly scoped. The relaxation fires only for a deduped `["not-contacted"]` selection; `favourites`/`snoozed`/`birthdays`/`all-contacts`/mixed selections retain the bound-only scope. Consumers of the shared builder: `HomeScreen.tsx`, `services/widget/widget-data.ts` (calls with `["favourites"]`, unaffected), `dashboard-read.ts`, `systems-members-read.ts`, `system-rule-resolver.ts`, `orrery-system-logic.ts`. No OTHER population is broadened. The documented Contacts-tab (and any other not-contacted consumer) blast radius is the accepted, population-scoped D-10 consequence and is a no-op when the flag is 0 (default).
**Concerns.** None.
**Risk.** Low.

## Plan 04 — Notification routing, header cleanup, FAB, overflow
**Summary.** `resetToDigestTab`, digest-intent repoint with concurrency guard preserved, HomeScreen shortcut removal, FAB context extension, overflow `openEvents` cross-tab callback + stale param-list entry removal.
**Strengths.** Owns `universal-fab-logic.test.ts:152-162` (removes stale `"BackupTab"`, adds the five-tab set + the Digest/Events context case). The cross-tab typing hazard is correctly handled — a dedicated `openEvents()` callback rather than widening the single-arg `navigate` union, with `getParent<BottomTabNavigationProp<TabParamList>>()` and fail-closed no-op. The caller (`HomeScreen.tsx:1464-1470`) and test double (`dashboard-overflow-actions.test.ts:5-14`) are owned so the now-required `openEvents` doesn't break tsc. Wave-2 ordering correctly defers the `Digest: undefined`/`GroupEvents: undefined` removal (`types.ts:47/155`) until after Plan 01 retained them for the wave-1 notification-nav reset target.
**Concerns.** None.
**Risk.** Low.

## Plan 05 — Your Week presentation + Settings row (D-09)
**Summary.** Heatmap (reused helpers, not `buckets()`), inline day detail, section with pure controller, and the D-09 Settings row sharing the `yourWeekPeriod` key.
**Strengths.** Correctly forbids routing the pre-deduped `{d,n}` rows through `buckets()` (which would collapse the group-dedup). Future/placeholder cells rendered non-interactive per `ActivityHeatmap.renderDayCell`. The cycle-4 extraction of a pure `your-week-section-logic.ts` controller correctly answers the render-free constraint. D-09 sync model correctly framed as focus-time re-read (`SettingsInteractionsScreen` `useFocusEffect`→`reload()`), not live propagation; single source of truth honored. D-09 is not a D-03 reversal (row placement vs decomposition).
**Concerns.** None.
**Risk.** Low.

## Plan 06 — Digest assembly + drill-through
**Summary.** DigestScreen rewrite composing three modules; compact Digest rows (not full ContactCard); atomic `setPopulationsAndFilters` drill-through; D-10 count==preview==drill assertion.
**Strengths.** The both-axes atomic store action correctly closes the cycle-2 single-axis desync (verified the store has separate `setPopulations`/`setFilters` and `resetDashboardView` as the multi-axis precedent). `listDashboardPopulation(exec, query, now)` has no cap arg (confirmed `dashboard-read.ts:380`) — the "full read, JS-sliced via previewWithOverflow" framing is accurate. Correctly avoids passing the DAO row to `ContactCard` (whose required `modifiedAt`/`categoryLabel`/… fields the row lacks). Non-numeric "See everyone needing attention →" for Overlooked (superset drill) vs numeric "+N more" for Never Contacted (D-10 exact equivalence) is a sound distinction. `navigate("Home")` removal (`DigestScreen.tsx:171`) owned.
**Concerns.** None.
**Risk.** Low.

## Plan 07 — Regression gate + physical-device UAT
**Summary.** Render-free `shell-contract.test.ts` (runtime `TAB_ORDER`/`INITIAL_TAB` + `Object.keys(TAB_ICON)` parity + pure `resolveNotificationNav`), full phase gate (vitest + tsc + check:colors), and PASS/FAIL/BLOCKED device UAT with owner-confirm precondition.
**Strengths.** `autonomous:false` consistent with the halting precondition. Render-free premise correct (no react-test-renderer on disk). tsc-in-gate rule honored. Metro remap (`adb reverse tcp:8081 tcp:8082`) correctly flagged as a deviation from the runbook's 8081→8081. Repair loop routes defects to owning plans. Offline Digest read-path check added.
**Concerns.** None.
**Risk.** Low.

---

## Cross-cutting

**Orphaned-consumer sweep (per symbol):**
- **TAB_ICON** — OWNED. `icon-registry.test.ts` (Plan 01), `RootNavigator.tsx:207` (Plan 01). No unowned breaker.
- **BackupTab (broader)** — OWNED. `universal-fab-logic.test.ts:156` (Plan 04, non-breaking string); comments in `backup-dualhome-logic.ts`/`BackupScreen.tsx` (Plan 01). `BackupStack.tsx` uses `"Backup"` (unaffected).
- **TARGET_VERSION 29→30** — OWNED. Hard `.toBe(29)` pins: `full-chain.test.ts`, `029-ai-configuration.test.ts`, `category-identity-audit.test.ts` (all Plan 02). ~60 `runMigrations(…, TARGET_VERSION, …)` consumers are dynamic (unaffected). `toBeGreaterThanOrEqual` pins (027/028/profile-presentation) stay green at 30.
- **BACKUP_FORMAT_VERSION 6→7** — OWNED. All `.toBe(6)`/`= 6`/input-fixture pins across `export-manifest`, `backup-schema`, `orrery-preferences-portability`, `orrery-exploration.integration`, `backup-service`, `category-identity-audit` tests are in Plan 02's `files_modified`, plus the stale comment regions.
- **`yourWeekPeriod` new key** — one owned-but-unnamed full-equality breaker (`app-settings-dao.test.ts:534`, see Plan 02 LOW). All other appSettings/snapshot assertions are `toMatchObject` (partial, safe); `orrery-preferences.test.ts:131` is runtime-to-runtime (safe); no non-test `AppSettings` full-literal constructions exist (only `as` casts and parameter types → no tsc break).

**Migration numbering:** 030 is the correct next free number (disk head 029, TARGET_VERSION 29); additive, forward-only, safe on a v1→v30 jump.

**D-08 / D-09 / D-10 compliance:** All three implemented correctly. D-08: portable emission + format bump + FORWARD_MIGRATIONS[6] + reused parse validator, following the landed Phase-36 policy (not the spent deferred-comment pattern). D-09: both surfaces on one `app_settings` key, focus-time sync, not a D-03 reversal. D-10: relaxation matches `countNeverContacted` verbatim, scoped to the `["not-contacted"]`-exact selection only, no other population broadened, no-op when flag off.

**Escalation check:** No finding deletes/weakens/inverts a recorded ADR/HANDOFF/dossier decision. The `category-identity-audit` no-schema-change boundary loosening is explicitly authorized by D-08 (per the prompt). The `readOverlooked` snooze-exclusion *adds* a control aligned with snooze semantics (not a removal) and rests on a code comment, not an ADR — no escalation trigger.

**Overall risk verdict:** Low. The plans are coherently sequenced (waves 1→4 with correct dependencies), single-owner per file, and every changing-contract consumer I could find is owned by exactly one plan and run in that plan's own verify gate. The one residual is a LOW plan-completeness item (an owned, gate-caught full-object `toEqual` that the plan doesn't explicitly enumerate).

HIGH_COUNT: 0
ACTIONABLE_NONHIGH_COUNT: 1

Actionable non-HIGH item:
1. **Plan 02** — In Task 2's test-update enumeration (step (g)/action, alongside the `full-chain.test.ts` and `category-identity-audit.test.ts` callouts), explicitly name `src/db/app-settings-dao.test.ts:534`: the full-object `expect(await getAppSettings(exec)).toEqual({…})` must gain `yourWeekPeriod: 'rolling7'` (or a `YOUR_WEEK_DEFAULTS` spread) in its expected object, since the new REQUIRED `AppSettings.yourWeekPeriod` field makes this equality fail. (Already owned via `files_modified` and caught by the task's own `<verify>`; naming it prevents the executor from only appending a new case and missing the pre-existing assertion.)
