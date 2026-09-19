---
phase: 38
reviewers: [codex, claude]
reviewed_at: 2026-09-19T02:32:34Z
plans_reviewed: [38-01-PLAN.md, 38-02-PLAN.md, 38-03-PLAN.md, 38-04-PLAN.md, 38-05-PLAN.md, 38-06-PLAN.md, 38-07-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=low)"
  claude: "unknown (read-only Claude subagent — Write-gap fallback)"
model_sources:
  codex: "banner"
  claude: "subagent-fallback"
review_method_notes: >
  Convergence CYCLE 4 (final extended-budget convergence check — owner extended the budget by one
  after cycle 3). The built-in `claude` reviewer lane was NOT used: this run executes inside Claude
  Code (CLAUDE_CODE_ENTRYPOINT=cli), so the machinery skips its own lane for independence, and that
  lane is also the known Write-permission-gap hazard (project MEMORY). Per the documented workaround
  the Claude review was run as a READ-ONLY general-purpose subagent (Opus 4.8, inherited) and
  aggregated alongside the codex lane. The codex lane returned a genuine source-grounded review on
  the first attempt (gpt-5.6-sol, reasoning=low, ~3.5 min). The aggregator independently re-verified
  every load-bearing / disputed finding against the code on disk before recording it (CLAUDE.md
  "Review the code, not the diff"): linking.ts:67, backup-dualhome-logic.ts:51-60, BackupScreen.tsx:274,
  SettingsStack.tsx:154-160, runner.ts:38-61, migration 001 (bare CREATE TABLE), and the five orphaned
  test-consumer files.
cycle_summary:
  cycle: 4
  current_high: 3
  current_actionable: 8
  verdict: >
    Cycle 4 confirms every cycle-3 HIGH is resolved on disk (render-free shell-contract descriptor
    replaces the false navigator-mount premise in Plans 01/07; D-10 not-contacted preview/count/drill
    now match countNeverContacted exactly, unbound-inclusive, and survive applyPopulationPostProcessing).
    D-08/D-09/D-10 are implemented correctly at the mechanism level. HOWEVER, three NEW, distinct,
    independently-verified HIGH defects surfaced this cycle — the two reviewers found DIFFERENT ones,
    and the aggregator confirmed all three against the code on disk:
    (H1, codex, Plan 01) repointing the shared-backup share-intent from BackupTab to SettingsTab->Backup
    routes the .orbitbackup recovery file to a host (host="settings") whose shouldConsumeSharedBackup()
    returns false, so BackupScreen.tsx:274 early-returns and the file is NEVER consumed — the plan only
    ensures the route RESOLVES, not that the backup is RESTORED; the Backup-tab removal leaves no
    consumer.
    (H2, codex, Plan 02) the prescribed v1 migration fixture ("apply migration 001 directly, then
    runMigrations to 30") never sets PRAGMA user_version=1; the runner reads version 0 (runner.ts:38-45)
    and re-applies migration 001, whose bare CREATE TABLE (001-initial.ts:42) throws "table already
    exists" — the migration proof is non-executable as written.
    (H3, claude, Plan 02) the TARGET_VERSION 29->30 / migration030 / BACKUP_FORMAT_VERSION 6->7 bump
    breaks version pins in FIVE test files owned by NO Phase-38 plan (category-identity-audit.test.ts:215-225,
    orrery-preferences-portability.test.ts:151-152, orrery-exploration.integration.test.ts:608,
    backup-service.test.ts:174/203, 029-ai-configuration.test.ts:22); Plan 02's scoped verify misses
    them, so the tree goes red at Plan 07's wave-4 gate after waves 2-3 build on it — the exact
    orphaned-test-consumer build-breaker pattern the project MEMORY flags (recurred 4x in P35).
    All three are mechanical INLINE PLAN.md edits, not replans and not decision reversals. No new
    owner-escalation trigger: nothing deletes/weakens/inverts a standing ADR/HANDOFF/dossier decision.
    The category-identity-audit "no-schema-change" guard that H3 invalidates pins a PAST phase's
    boundary, and D-08 explicitly ratifies migration 030 + format 7, so updating it is in-scope
    maintenance the executor performs, not an escalation.
---

# Cross-AI Plan Review — Phase 38 (Digest & Navigation Restructure), Convergence Cycle 4

## Consensus Summary

Two independent reviewers (codex `gpt-5.6-sol`, and a read-only Claude subagent) reviewed all seven
plans against the code on disk. Both agree the plans are mature, decision-grounded, and — rare for a
fourth cycle — that every file:line reference they spot-checked is accurate; the cycle-2
hallucinated `KEY_TO_COLUMN` symbol is confirmed absent and the real writer contract
(`COLUMN_OF` / `WritableSettingsKey` / `validateAppSettingsPatch`) is correctly located. Both agree
D-08 (portable `yourWeekPeriod` + `BACKUP_FORMAT_VERSION` 6->7 with a forward migration and a
parse-boundary validator), D-09 (dual Settings-row + in-context toggle, focus-time re-read), and
D-10 (Never Contacted includes opted-in unbound never-contacted contacts, matching
`countNeverContacted` exactly) are implemented correctly at the mechanism level.

The cycle did NOT cleanly converge to zero HIGHs. Three NEW, distinct HIGH defects surfaced — the
two reviewers each found different ones — and the aggregator independently verified all three
against disk. None is a decision reversal; all three are mechanical inline PLAN.md fixes. The
notable signal for the owner is that a fourth adversarial pass still surfaced material executable
defects, and the two AIs' non-overlap means neither alone would have caught the full set.

### Agreed Strengths
- The render-free `shell-contract.ts` descriptor (Plan 01) is the correct fix for cycle-3 HIGH-1:
  the repo genuinely has no react-test-renderer/@testing-library and `vitest.config.ts` mandates
  render-free tests, so asserting `TAB_ORDER`/`INITIAL_TAB`/`Object.keys(TAB_ICON)` from a runtime
  value (not a mounted navigator) is sound (both reviewers).
- Preserving the internal `DashboardTab` route id while relabelling it "Contacts" is correct — the
  FAB (`universal-fab-logic.ts:88/93/101/146`) and `linking.ts:71` both hardcode it (both reviewers).
- The D-10 not-contacted relaxation is placed at the shared, pure `buildPopulationWhere` seam and
  reproduces `countNeverContacted`'s correlated subselect (`dashboard-read.ts:543-551`) so
  count == preview == drill under `include_unbound_never_contacted=1`, and
  `applyPopulationPostProcessing` only sorts/gravity-filters (does not re-narrow) (both reviewers).
- The backup format bump correctly requires a new forward migration entry and a parse-boundary
  validator (`assertPortableSettings`) because `FORWARD_MIGRATIONS[6]`'s `?? 'rolling7'` only fills a
  MISSING value — a crafted invalid string would otherwise survive to the DAO (both reviewers).
- Migration 030 is correctly numbered (chain ends at 029, `TARGET_VERSION=29`) and additive
  (`ALTER TABLE ... NOT NULL DEFAULT ... CHECK(...)`), mirroring migration 029 (both reviewers).
- The atomic two-axis drill-through (`setPopulationsAndFilters`) is well-motivated — `resetDashboardView`
  is the exact single-write precedent, and a stale orthogonal axis would empty the drilled set (both).

### Agreed Concerns
The two reviewers did not raise the same HIGH, but they converge on the Plan 02 wave-1 gate being
too narrow: codex's H2 (non-executable v1 fixture) and claude's H3 (orphaned test-consumers) both
mean Plan 02 can pass its own scoped `<verify>` while the project-wide `vitest`/`tsc` suite is red,
with the failure only surfacing at Plan 07's wave-4 gate. Both independently recommend broadening
Plan 02 Task 3's verify to run the full `src/backup` suite (+ `category-identity-audit.test.ts` +
`029-ai-configuration.test.ts`) so migration/format breakers are caught in wave 1, per the project's
own "grep ALL consumers up front" memory. Claude's Plan 07 MEDIUM is the same point from the other end.

### Divergent Views
- **Codex flagged H1 (Plan 01 shared-backup consumer break); Claude did not.** Claude treated the
  linking.ts:67 repoint as adequately resolving the prior "MEDIUM linking.ts:67" finding (the route
  now resolves). The aggregator sided with codex and VERIFIED the defect: `SettingsStack.tsx:154-160`
  wraps BackupScreen with `host="settings"`, `shouldConsumeSharedBackup("settings")` returns false
  (`backup-dualhome-logic.ts:58-60`), and `BackupScreen.tsx:274` early-returns before
  `consumeSharedBackup()`. The plan's acceptance ("share-intent path still resolves") checks route
  liveness, not consumption — so the recovery path is broken. This is a real HIGH.
- **Claude flagged H3 (orphaned test-consumer cluster); codex did not** (codex focused on the fixture
  mechanics, H2). The aggregator VERIFIED all five files carry the version pins as cited and none is
  referenced in any Phase-38 artifact. Both H2 and H3 are real and additive; fixing one does not fix
  the other.
- Codex rated overall risk HIGH; Claude rated it Medium-High and framed the remaining work as "PROCEED
  after one scoped inline correction to Plan 02." The aggregator's position: three inline fixes are
  required (Plan 01 backup consumer, Plan 02 fixture, Plan 02 test-consumer cluster) before execution;
  none needs a full replan.

---

## Codex Review

> **Aggregator note:** codex `gpt-5.6-sol` (reasoning=low), source-grounded, first attempt (~3.5 min). Its two HIGHs (Plan 01 shared-backup consumer, Plan 02 v1 fixture) were independently re-verified against disk by the aggregator before recording.


## Overall assessment

The plans are substantially stronger after three convergence cycles. The navigation, query-state, settings, backup, group-event aggregation, and validation contracts mostly track the code on disk accurately. Two material defects remain:

1. Plan 01 repoints shared-backup intents into a Settings-hosted screen that explicitly refuses to consume the shared file.
2. Plan 02’s prescribed v1 migration fixture does not set `PRAGMA user_version = 1`, so the runner will attempt migration 001 twice.

These are executable-plan defects, not disagreements with D-08, D-09, or D-10.

---

## Plan 01 — Five-tab shell and semantic routing

### Summary

The shell decomposition is well grounded, but the shared-backup route change would break the `.orbitbackup` recovery path. This is a release-blocking navigation/data-recovery defect.

### Strengths

- Preserving the internal `DashboardTab` identifier is correct. The FAB contract hardcodes that target in `resolveFabTarget` at `src/components/universal-fab-logic.ts:82-104`.
- The proposed tab-reselect behavior reuses the existing stack-aware `popToTop` mechanism at `src/navigation/RootNavigator.tsx:91-117`.
- Removing promoted `Digest` and `GroupEvents` screens from `DashboardStack` is appropriate; they are currently registered at `src/navigation/tabs/DashboardStack.tsx:39` and `:69`.
- Mirroring the full Profile-reachable route set is justified. The existing Orrery stack already registers `RecentlyDeleted` and the broader Profile descendants at `src/navigation/tabs/OrreryStack.tsx:56-82`.
- A pure runtime shell descriptor is compatible with the test environment. The repository explicitly uses node/render-free Vitest at `vitest.config.ts:4-15`, and `icon-registry.ts` is runtime-safe because its imports are type-only at `src/components/icons/icon-registry.ts:15-18`.

### Concerns

- **HIGH — Repointing shared backup to `SettingsTab → Backup` leaves the file unconsumed.**  
  Plan 01 changes `src/navigation/linking.ts:67` from `BackupTab` to `SettingsTab`. But the Settings wrapper passes `host="settings"` at `src/navigation/tabs/SettingsStack.tsx:159-161`, while `shouldConsumeSharedBackup()` returns true only for `"backup-tab"` at `src/screens/backup-dualhome-logic.ts:51-60`. `BackupScreen` checks that predicate before calling `consumeSharedBackup()` at `src/screens/BackupScreen.tsx:270-276`. The plan’s claim that merely targeting a live Settings route preserves the data-recovery path is therefore false.
- **LOW — The route contract duplicates route names across three sources.**  
  The plan introduces descriptor arrays, ParamLists, and local component registries. The completeness assertion covers descriptor→component mapping, but TypeScript does not inherently prove descriptor→ParamList equality because the arrays are described as plain strings. This can be made stronger with `as const satisfies readonly (keyof DigestStackParamList)[]`.

### Suggestions

- Extend the backup host contract before removing `BackupTab`. Options include:

  - Make the Settings-hosted Backup screen the sole shared-backup consumer after tab removal, updating `shouldConsumeSharedBackup`, comments, and dual-home tests.
  - Add an explicit `"share-intent"` host that consumes the singleton but retains Settings-origin return behavior.

- Type route arrays with `satisfies readonly (keyof …ParamList)[]` and type component registries as `Record<(typeof ROUTES)[number], ComponentType<…>>`.

### Risk Assessment

**HIGH.** The main shell design is sound, but the current plan breaks an existing recovery path by navigating to a screen that deliberately does not consume the shared backup.

---

## Plan 02 — Your Week data layer, migration 030, and backup format 7

### Summary

The settings/backup design now follows the real on-disk writer and parser contracts. The aggregation semantics are explicit and testable. The remaining major issue is the prescribed v1→v30 test setup, which would rerun migration 001.

### Strengths

- The plan correctly identifies the live generic writer:

  - `WritableSettingsKey` begins at `src/db/app-settings-dao.ts:531`.
  - `COLUMN_OF` is the actual mapping used by the writer.
  - `updateAppSettingsCore` validates and constructs its update from that contract.
- Parse-boundary validation is the right approach. `assertPortableSettings` already reuses DAO validators for interaction channels and message modes at `src/backup/backup-schema.ts:301-334`.
- The format bump correctly requires a new forward migration. The parser walks every version and fails when an entry is absent at `src/backup/backup-schema.ts:981-1001`; the current registry ends at `5 → 6` at `src/backup/backup-schema.ts:105-128`.
- Migration 030 is correctly numbered. The registered chain currently ends at migration 029 and `TARGET_VERSION = 29` at `src/db/database.ts:52-100`.
- The `firstWeekday - 1` conversion is correct. Expo defines Sunday=1 through Saturday=7, while the history code uses JavaScript Sunday=0 at `src/services/history/window.ts:73-77`.
- Separating raw interaction headlines from deduplicated activity units matches the schema. Group membership is represented by multiple interaction children under one parent through `interactions.group_event_id` and its uniqueness constraint at `src/db/migrations/026-group-events-schema.ts:31-39`.

### Concerns

- **HIGH — The specified v1 fixture will run migration 001 twice.**  
  Task 2 says to apply migration 001 directly and then call `runMigrations`. Direct `migration001.apply()` creates schema and seeds but does not set `user_version`; the runner owns that bump at `src/db/migrations/runner.ts:56-61`. If the test then invokes the runner without explicitly setting `PRAGMA user_version = 1`, the runner reads version 0 at `src/db/migrations/runner.ts:38-45` and attempts migration 001 again. The existing full-chain test starts from v0 through the runner at `src/db/migrations/full-chain.test.ts:15-22`; it provides no reusable v1 fixture.
- **MEDIUM — The reversibility checkpoint is described as reviewing “staged” changes before those changes exist.**  
  The checkpoint precedes Tasks 2–3 and remains declared as `checkpoint:decision`, while its prose says the exact staged migration and backup changes will be inspected. A sequential executor cannot show a real staged diff at that point. This also conflicts with the review table’s claim that it was converted to a human-verification checkpoint.
- **LOW — Calendar-week windows overload the existing `HistoryWindow.lens` value.**  
  `HistoryWindow.lens` only permits `"7days" | "month" | "year"` at `src/services/history/window.ts:21-47`. A calendar week will presumably report `"7days"`. That is workable for heatmap thresholds, but the plan should state it explicitly so later consumers do not infer rolling-window semantics from the lens field.

### Suggestions

- Construct the v1 fixture by either:

  - Running migration 001 through `runMigrations(..., targetVersion=1, ...)`, then running the full registry to 30; or
  - Applying migration 001 directly and explicitly setting `PRAGMA user_version = 1` in the same fixture transaction.

- Move the checkpoint after implementation has produced a reviewable diff, or rename it as a pre-implementation mechanics acknowledgement without claiming staged inspection.
- Specify that calendar-week `HistoryWindow.lens` remains `"7days"` solely to reuse the seven-day heatmap threshold contract.

### Risk Assessment

**HIGH until the fixture instruction is corrected; MEDIUM afterward.** The production design is strong, but the mandated migration test is currently non-executable as written.

---

## Plan 03 — Up Next and Horizon composition

### Summary

This plan is tightly scoped and follows the canonical status and population paths. D-10 is implemented at the correct shared query boundary.

### Strengths

- The attention floor correctly reuses `STABLE_MAX = 0.8` and the canonical progress expression at `src/db/status.ts:40-42` and `:59-78`.
- The plan correctly preserves `STATUS_CADENCE_PRECONDITION`, whose required lifecycle scope is documented at `src/db/status.ts:53-64`.
- Adding the snooze predicate to `readOverlooked` aligns it with the canonical attention filter while retaining rogue-only membership. The current read lacks that predicate at `src/db/digest-read.ts:109-123`.
- D-10 is placed at the shared `buildPopulationWhere` seam. Today every explicit population is constrained by `tracking_enabled = 1` at `src/logic/dashboard-query-logic.ts:218-220,279-282`, while `countNeverContacted` already implements the opted-in unbound rule at `src/db/dashboard-read.ts:539-553`.
- Birthday filtering correctly reuses `daysUntilBirthday` while avoiding the separate 30-day dashboard window at `src/db/dashboard-read.ts:292-307`.
- The uncapped DAO plus pure cap/dedup composition is a good split.

### Concerns

- **LOW — Duplicate SQL semantics remain manually copied between count and population paths.**  
  D-10 says `buildPopulationWhere` should reproduce `countNeverContacted`’s predicate. The count currently owns the literal SQL at `src/db/dashboard-read.ts:543-551`. Copying it into `dashboard-query-logic.ts` creates two definitions that could drift later.

### Suggestions

- Extract a shared `NEVER_CONTACTED_INCLUDING_OPTED_UNBOUND_WHERE` SQL constant and use it from both `countNeverContacted` and the exact `["not-contacted"]` branch.
- Add a test for duplicate population tokens such as `["not-contacted", "not-contacted"]`, since `buildPopulationWhere` deduplicates selections at `src/logic/dashboard-query-logic.ts:248-253`.

### Risk Assessment

**LOW.** The plan is source-aligned and its important edge cases are explicitly tested.

---

## Plan 04 — Notification routing, header cleanup, FAB, and overflow action

### Summary

The plan correctly closes the remaining shell references and preserves notification concurrency. It depends on Plan 01 fixing the shared-backup consumer problem, but otherwise is well structured.

### Strengths

- The digest notification needs a distinct root intent. It currently resolves to `[Home, Digest]` at `src/services/notifications/notification-nav.ts:76-92`, and the gate always wraps intents through `resetToDashboardWith` at `src/navigation/notification-gate.tsx:129-152`.
- The plan explicitly preserves the stale-request guard at `src/navigation/notification-gate.tsx:123-151`.
- Removing stale `DashboardStackParamList` entries only after notification and UI callers are repointed is correct dependency ordering.
- The overflow fix correctly recognizes that the current interface accepts only a single local route argument at `src/screens/dashboard-overflow-actions.ts:3-6`; a dedicated `openEvents()` callback is safer than weakening typing.
- Extending FAB context to new tabs is necessary because the existing recognizer only accepts Dashboard and Orrery at `src/components/universal-fab-logic.ts:135-160`.

### Concerns

- **MEDIUM — This plan inherits Plan 01’s broken shared-backup destination.**  
  S-04 cannot be considered satisfied merely because Backup & Restore is visible in Settings. The `.orbitbackup` intent remains broken unless Plan 01 also changes the host-consumption contract described above.
- **LOW — The cross-tab caller mechanism should be stated concretely.**  
  `HomeScreen` receives stack navigation, not root tab navigation. The action should explicitly use a typed parent navigator or a shared root-navigation helper, rather than leaving “via parent/root navigator” to executor interpretation.

### Suggestions

- Make Plan 04 depend on the corrected backup-host behavior, and add a share-intent regression test covering “intent → Settings Backup → consume shared URI.”
- Specify the exact cross-tab API, for example `navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate(...)`, including the fail-closed behavior when no parent exists.

### Risk Assessment

**MEDIUM.** Notification and overflow work are sound, but S-04 remains exposed to the Plan 01 recovery-path defect.

---

## Plan 05 — Your Week presentation and Settings row

### Summary

The component split and focus-time synchronization model are appropriate. The main risk is test design: the plan asks render-free tests to verify stateful asynchronous hook behavior without defining the controller seam needed to do that reliably.

### Strengths

- Reusing `heatmapLevel`, `classifyHeatmapCell`, and `colors.heatmapScale` is correct. `classifyHeatmapCell` distinguishes real zero-count cells from structural blanks at `src/components/history/heatmap-cell.ts:31-48`.
- Blocking future cells matches the shipped component behavior in `ActivityHeatmap` and avoids meaningless day-detail selection.
- Building the map directly from `{d,n}` avoids losing the pre-aggregated count through `buckets()`, whose contract counts individual rows.
- D-09’s focus-time synchronization matches the actual Settings screen. `SettingsInteractionsScreen` reloads on focus at `src/screens/SettingsInteractionsScreen.tsx:59-71` and reloads after writes at `:78-89`.
- The chosen Settings screen already has a reusable option-section pattern at `src/screens/SettingsInteractionsScreen.tsx:110-161`.
- The proposed UI avoids the full Profile heatmap’s lens and navigation chrome.

### Concerns

- **MEDIUM — Stateful async component tests are underspecified for this render-free environment.**  
  The repository has no renderer and requires node/render-free tests at `vitest.config.ts:4-15`. Existing tree-walk tests work by replacing React hooks with simple mocks, e.g. `src/components/orrery/orrery-controls-render.test.tsx:11-18`. That is adequate for static props but does not naturally exercise `YourWeekSection` focus effects, async reads, rapid-toggle generations, rollback after rejected persistence, and subsequent rerender. The plan requires all of those behaviors but does not extract a pure controller/model or define a deterministic hook harness.
- **LOW — Period changes will currently run notification schedule reconciliation if they reuse the screen’s generic `persist`.**  
  `SettingsInteractionsScreen.persist` invokes both notification reconcilers after every generic preference write at `src/screens/SettingsInteractionsScreen.tsx:73-89`. A Your Week period change does not affect notification scheduling.

### Suggestions

- Extract period-state transition logic into a pure `.ts` controller/helper and test:

  - generation acceptance/rejection;
  - direct `{d,n}` map construction;
  - persistence rollback;
  - selected-day invalidation when the period changes.

  Keep the `.tsx` tree-walk tests limited to roles, labels, selected states, and event wiring.

- Either accept and document the harmless schedule reconciliation, or add a narrower persistence callback for unrelated settings preferences.

### Risk Assessment

**MEDIUM.** The UI architecture is good, but the current testing instructions risk producing brittle hook mocks or tests that do not truly exercise the stated behavior.

---

## Plan 06 — Digest assembly

### Summary

The screen assembly is coherent, derives from the correct reads, and fixes the previous missing preview/drill state boundary. One semantic mismatch remains between the numeric Overlooked overflow label and its broader drill destination.

### Strengths

- A compact Digest row is the correct choice. `ContactCard` requires dashboard-specific fields at `src/components/ContactCard.tsx:51-71`, whereas the proposed Up Next/Overlooked rows do not carry them.
- Reusing `ringVisual` preserves the canonical status presentation at `src/components/contact-card-ring.ts:45-60`.
- Falling back from nullable `REASON_SQL` to canonical status is necessary: `REASON_SQL` returns null for wobble and decay at `src/db/status.ts:80-104`.
- The atomic two-axis store update is well motivated. Current `setPopulations` and `setFilters` persist independently at `src/stores/dashboard-query-store.ts:92-110`, while `resetDashboardView` demonstrates the correct single-write pattern at `:116-128`.
- The exact Never Contacted drill state—`['not-contacted']` plus `{}`—matches the preview query contract and D-10.
- The rewrite correctly removes the legacy `navigate("Home")` at `src/screens/DigestScreen.tsx:167-172`, which would not be valid inside the new Digest stack.
- The current screen’s loading sentinel and cancellation pattern provide an appropriate base at `src/screens/DigestScreen.tsx:69-119`.

### Concerns

- **MEDIUM — `+N more` is not truthful for the Overlooked drill destination.**  
  The preview is rogue-only because `readOverlooked` filters `STATUS_SQL = 'rogue'` at `src/db/digest-read.ts:109-123`. The proposed drill selects canonical `needs-attention`, which includes wobble, decay, and rogue based on the status thresholds at `src/db/status.ts:72-78`. Therefore `+{overflow} more →` numerically describes the remaining rogue rows, but the destination may contain additional wobble/decay rows beyond that number. The plan acknowledges the destination is a superset but still retains exact numeric copy.
- **LOW — Drill failure behavior is not specified.**  
  The plan says persist both axes before navigation. If `updateAppSettings` rejects, the UI should remain on Digest and surface a nonfatal error; navigation must not proceed with stale query state.

### Suggestions

- For Overlooked, use nonnumeric copy such as “See everyone needing attention →”. Keep `+N more` only for Never Contacted, where D-10 gives exact preview/count/drill equivalence.
- Require the drill handler to `await setPopulationsAndFilters`; navigate only on success and expose a calm retry/error path on rejection.
- Extract why-copy and drill-target construction into pure helpers to reduce the load on render-free component tests.

### Risk Assessment

**MEDIUM.** Core data and state behavior are correct, but the Overlooked overflow copy currently overpromises exact cardinality.

---

## Plan 07 — Regression gate and physical-device UAT

### Summary

The final gate is appropriately render-free and the physical-device checklist is unusually thorough. Fixture creation should be constrained so direct SQL does not manufacture impossible application state.

### Strengths

- The runtime descriptor plus `TAB_ICON` parity is compatible with the pure icon registry at `src/components/icons/icon-registry.ts:15-18,96-112`.
- Moving reselect, initial-focus, and traversal checks to device UAT is correct because those behaviors depend on the live navigator.
- The plan correctly requires all three gates: full Vitest, TypeScript, and color-token enforcement.
- PASS/FAIL/BLOCKED reporting avoids converting unavailable evidence into a pass.
- The owner-confirmed package/session/device precondition follows the repository’s physical-device safety rules.
- The offline check directly verifies the local-first product commitment.
- The repair loop properly routes feature defects back to their owning plan.

### Concerns

- **LOW — Raw `run-as` fixture writes can bypass application invariants.**  
  Group-event writers coordinate parent/child updates and recency through the canonical DAO; `group-events-dao.ts` imports the recency core and transaction boundary at `src/db/group-events-dao.ts:1-11`. Directly inserting parent/children for UAT could create a state the app itself cannot produce, weakening evidence for heatmap and detail behavior.
- **LOW — The closing verification text still says all eight items pass.**  
  The task correctly allows BLOCKED outcomes, but the final `<verification>` prose says all eight §S.15 items are recorded pass. That conflicts with the declared PASS/FAIL/BLOCKED policy.

### Suggestions

- Prefer a DEV-only fixture seeder that calls canonical DAOs. If raw SQL is unavoidable, document every inserted row and verify foreign keys, recency, group linkage, and expected aggregate counts before UI assertions.
- Align the final verification/success wording with the task policy: phase closure should require PASS for mandatory items, or explicitly state which BLOCKED items prevent closure.

### Risk Assessment

**LOW–MEDIUM.** The gate design is strong; fixture discipline and closure wording need tightening.

---

# Final recommendation

Do not execute the phase yet. Revise these items first:

1. Fix Plan 01’s shared-backup host/consumer path.
2. Correct Plan 02’s v1 fixture construction.
3. Define a testable pure controller seam for Plan 05’s async period behavior.
4. Replace the Overlooked numeric `+N more` claim or provide an exact rogue drill target.
5. Constrain Plan 07 fixtures to canonical write paths where practical.

After those changes, the phase’s overall implementation risk should fall from **HIGH to MEDIUM**, driven mainly by the irreversible migration/backup bump and the breadth of the navigation restructure rather than unresolved plan defects.

---

## Claude Review

> **Aggregator note:** run as a READ-ONLY general-purpose subagent (Opus 4.8), not the built-in
> `claude -p` lane (Write-permission-gap hazard + self-lane independence). Its headline HIGH (the
> orphaned test-consumer cluster) was independently re-verified against disk by the aggregator: all
> five cited files carry the version pins as quoted, and `grep` of `.planning/phases/38-your-week/`
> returns none of them — they are genuinely unowned by any Phase-38 plan.

# Cross-AI Review — Phase 38 (Digest & Navigation Restructure), Convergence Cycle 4

**Reviewer scope:** source-grounded, read-only. Every file:line below was opened and verified on disk. The owner rulings D-08/D-09/D-10 are treated as DECIDED — flagged only where implementation is wrong.

## Headline

The plans are mature and unusually well-grounded. Re-verified the previously-hallucinated `KEY_TO_COLUMN` is gone (`grep` returns nothing; the real map is `COLUMN_OF` at `app-settings-dao.ts:692`, iterated at `:1486`), the D-08 emission precedent claim (`getPortableSettingsSnapshot` really does emit `history_lens`/`theme_package`/`default_interaction_channel`/`default_message_mode` at `app-settings-dao.ts:960/995/1015/1019`), the D-10 predicate match (`countNeverContacted` at `dashboard-read.ts:543-551`), and the `FORWARD_MIGRATIONS` parse-loop hard-fail (`backup-schema.ts:989-997`). All correct.

**One NEW HIGH:** Plan 02's backup/migration version bump breaks a cluster of test-consumers that no plan owns — the exact "orphaned test-consumer build-breaker" pattern from this project's own memory.

---

## Plan 01 — Five-tab shell

**Summary.** Promotes Digest to centered/default tab root, demotes Dashboard→Contacts, removes Backup tab, adds DigestStack/EventsStack. Leads with a tracer slice.

**Strengths.**
- Every cited anchor verified: `RootNavigator.tsx:191` `initialRouteName="DashboardTab"`, Tab.Screens at `:216/225/234/243`, `handleActiveTabPress` at `:91`; `linking.ts:67` `navigate("BackupTab",{screen:"Backup"})` and `:71` DashboardTab/Capture; `TAB_ICON` is `Record<keyof TabParamList,IconName>` at `icon-registry.ts:107`. The Pitfall-1 "keep internal `DashboardTab` id" is real — the FAB (`universal-fab-logic.ts:88/93/101`) and `linking.ts:71` both hardcode it.
- The cycle-3 HIGH-1 fix (render-free `shell-contract.ts` descriptor instead of a NavigationContainer mount) is sound: the repo genuinely has no react-test-renderer/@testing-library, so a runtime descriptor asserted in Node is the correct route.
- RecentlyDeleted omission fix is real: `OrreryStack.tsx:64` registers it precisely because Profile can reach it; DigestStack/EventsStack must too.

**Concerns.**
- LOW (`icon-registry.ts:27,101-102`): prose comments still enumerate `dashboard/orrery/backup/settings` as the tab identities. Plan 01 acceptance explicitly tolerates a lingering prose mention, so this is a nit, not a blocker — but worth a bounded comment-sync alongside the `TAB_ICON` re-key.

**Risk:** Low. Tracer-first ordering is appropriate for the architecture-defining plan.

---

## Plan 02 — week-window, migration 030, backup v7, your-week-read

**Summary.** The only genuinely-new data work: locale week window, migration 030 (`app_settings.your_week_period`), `BACKUP_FORMAT_VERSION` 6→7, app-wide Your Week reads.

**Strengths.**
- Migration head verified: `database.ts:99` ends at `migration029`, `TARGET_VERSION = AI_CONFIGURATION_SCHEMA_VERSION` (`:67`) = 29, so 030 is correct. `BACKUP_FORMAT_VERSION = 6` at `types.ts:14`. Additive `ALTER TABLE … NOT NULL DEFAULT 'rolling7' CHECK(...)` is valid SQLite and mirrors migration 029.
- The full writer-contract wiring is correctly located: `WritableSettingsKey` `:531`, `AppSettingsRow` `:619`, `COLUMN_OF` `:692/731`, `validateAppSettingsPatch` `:1341`, `getAppSettings` SELECT `:776` + return `:841`. The restore-cast-bypass argument is real (external JSON is cast to `AppSettingsPatch`, so `assertYourWeekPeriod` in `validateAppSettingsPatch` is the only runtime guard on the DAO path).
- The parse-boundary validation (Task 3 step 3a) is genuinely necessary and correctly reasoned: `backup-schema.ts:1000` resets a format-7 manifest straight to `validate()` (skipping `FORWARD_MIGRATIONS[6]`), and `FORWARD_MIGRATIONS[6]`'s `?? 'rolling7'` only fills a *missing* value — a crafted `"weekly"` survives both paths unless `assertPortableSettings` rejects it. The reused-DAO-validator pattern matches `assertDefaultInteractionChannel`/`assertMessageMode` at `backup-schema.ts:307/325`.
- `week-window` geometry: `window.ts:74` `weekdayOf` uses 0-based `getDay()`; the `firstWeekday - 1` conversion for expo-localization's 1-based value is the correct load-bearing fix.

**Concerns.**
- **HIGH — orphaned test-consumer build-breaker (the version bump breaks tests no plan owns).** Task 3 says only "update the existing export-manifest/backup-schema version assertions from 6 to 7," and `files_modified` lists only `backup-schema.test.ts` + `export-manifest.test.ts`. But the following version pins exist on disk and are guaranteed to fail once migration 030 / TARGET_VERSION 30 / format 7 land — and **none are referenced in any Phase-38 artifact** (verified: `grep` of `.planning/phases/38-your-week/` returns nothing for these files):
  - `src/category-identity-audit.test.ts:220-224` — a deliberate source-guard ("pins the no-schema-change phase boundary and portable format 6") asserting **all four** of: `database` contains `TARGET_VERSION = AI_CONFIGURATION_SCHEMA_VERSION` (Plan 02 changes to `YOUR_WEEK_PERIOD_SCHEMA_VERSION`); `database` does **not** match `/migration030|030-category/i` (Plan 02 adds `migration030`); `full-chain.test.ts` contains `expect(TARGET_VERSION).toBe(29)`; `types.ts` matches `BACKUP_FORMAT_VERSION\s*=\s*6`. **All four break.**
  - `src/backup/orrery-preferences-portability.test.ts:151-152` — `expect(BACKUP_FORMAT_VERSION).toBe(6)` and `expect(exported.backupFormatVersion).toBe(6)`.
  - `src/services/orrery-exploration.integration.test.ts:608` — `expect(manifest.backupFormatVersion).toBe(6)`.
  - `src/services/backup/backup-service.test.ts:174,203` — restore-preview asserts `backupFormatVersion: 6` (the input manifest is v1, migrated forward to MAX_SUPPORTED at preview time; after the bump the preview returns 7).
  - `src/db/migrations/029-ai-configuration.test.ts:22` — `expect(TARGET_VERSION).toBe(29)` (line 21's `AI_CONFIGURATION_SCHEMA_VERSION).toBe(29)` stays valid; line 22 breaks).

  **Mechanism/why it matters:** Plan 02's own `<verify>` runs only `backup-schema.test.ts`/`export-manifest.test.ts`/`app-settings-dao.test.ts`/`full-chain.test.ts`/`your-week-read.test.ts`. `full-chain.test.ts:87` (`toBe(29)`) *is* in scope and will be caught, but the six pins above are **not**, so Plan 02 will execute, pass its scoped gate, and commit while the project-wide `vitest`/`tsc` suite is red. The failure only surfaces at Plan 07's full-suite gate (wave 4) — after waves 2 and 3 have built on a red tree — and the repair loop must then route back to Plan 02. This is precisely the memory-encoded lesson ("grep ALL consumers up front, put each in the wave that removes the symbol; recurred 4× in P35"). **Fix:** add all six files to Plan 02 Task 3 `files_modified`, update the assertions to 7 / 30 / `migration030`-present / `YOUR_WEEK_PERIOD_SCHEMA_VERSION`, and broaden the Task-3 verify to run the full `src/backup` + `src/category-identity-audit.test.ts` + `029-ai-configuration.test.ts` suites.
  - *Not a decision reversal:* the `category-identity-audit` guard pins a **prior** phase's no-schema-change boundary, not a standing ADR; Phase 38 D-08 explicitly ratifies migration 030 + format 7, so updating this guard to the new expected values is in-scope and correct. The executor should update it, not treat it as an escalation.

- LOW: Task 2 says "extend the app-settings-dao test for read/write" but `app-settings-dao.test.ts` version/snapshot exhaustiveness is not spot-checked in-plan; the `PORTABLE_SETTINGS_KEYS` iteration tests at `backup-schema.test.ts:26/89/92/123/126` should stay green once `yourWeekPeriod` is both emitted and allowlisted (it is on both sides), but the plan should confirm the "emitted key ⊆ allowlist" invariant test after the change.

**Risk:** Medium-High until the build-breaker cluster is owned. The migration/backup *mechanics* themselves are correct.

---

## Plan 03 — up-next-read, digest-composition, D-10 not-contacted, Overlooked snooze

**Summary.** Attention-ordered Up Next read, pure composition/dedup, and two read-path consistency fixes.

**Strengths.**
- The canonical needs-attention predicate reuse is verified verbatim: `dashboard-query-logic.ts:173-175` is `(PROGRESS_SQL) >= STABLE_MAX AND (c.snooze_until IS NULL OR date(c.snooze_until) <= date('now','localtime'))`. Reusing it (rather than a Digest-local rule) satisfies D-04 and makes the empty state reachable — the cycle-1 HIGH.
- D-10 mechanism is correct and elegant: `buildPopulationWhere` (`dashboard-query-logic.ts:248-283`) is pure; the proposed EXACT-`['not-contacted']` branch using the correlated subselect `(SELECT include_unbound_never_contacted FROM app_settings WHERE id=1)` matches `countNeverContacted` (`dashboard-read.ts:543-551`) byte-for-byte and needs no async plumbing. Verified `applyPopulationPostProcessing` (`dashboard-read.ts:336-360`) only sorts/gravity-filters, so it will **not** re-narrow the relaxed set — count == preview == drill holds.
- `readOverlooked` (`digest-read.ts:109-124`) confirmed rogue-only with no snooze predicate and the "mute filter DELIBERATELY omitted" comment at `:102-108`; the added snooze guard correctly mirrors the drill target.

**Concerns.**
- LOW (informational, D-10 scope edge): the relaxation is scoped to a selection *exactly* `['not-contacted']`. A mixed selection containing `not-contacted` (e.g. `['not-contacted','favourites']`) keeps bound-only scope, so its count badge (`countNeverContacted`, unbound-inclusive) would disagree with that mixed list. This is out of Phase-38 scope (the Digest always issues exactly `['not-contacted']`) and is documented in the plan; noting only so the executor doesn't over-generalize the branch.

**Risk:** Low. Well-grounded.

---

## Plan 04 — notification repoint, header declutter, FAB audit, stale-entry removal

**Summary.** Finishes the shell semantics: `resetToDigestTab`, digest-intent branch, HomeScreen shortcut removal, FAB context extension, stale `DashboardStackParamList` cleanup.

**Strengths.**
- All anchors verified: `notification-nav.ts:43` returns `routes:[{name:"Home"},{name:"Digest"}]` and `:19` confirms the digest payload carries no `contactId` (the V5 boundary); `reset-intents.ts:16/29` (`resetToDashboardRoot`/`resetToDashboardWith`, `TabResetState` at `:10`); `universal-fab-logic.ts:146` gates contact context to `DashboardTab`/`OrreryTab` only.
- The wave ordering is correct: Plan 01 retains `Digest: undefined`/`GroupEvents: undefined` (`types.ts:47/155`) because `notification-nav` still names `Digest`; Plan 04 (wave 2) removes them after repointing. Verified both entries exist on disk.
- The cross-tab-typing fix (dedicated `openEvents()` rather than widening the single-arg `navigate` union) is the right call, and Task 4 now owns the caller (`HomeScreen.tsx:1464-1470`) + test double — closing the cycle-3 out-of-task compile-break.

**Concerns.** None new. The dependency `depends_on:["38-01"]` is correct (Plan 04 removes entries Plan 01 retained).

**Risk:** Low.

---

## Plan 05 — Your Week presentation (heatmap, day detail, section, Settings row D-09)

**Summary.** Self-contained Your Week components + the D-09 Settings row.

**Strengths.**
- The heatmap-saturation reasoning is correct: feeding the pre-deduped `{d,n}` rows through `buckets()` (`buckets.ts:52-70`, one-per-row) would collapse the group-dedup, so building the Map directly is right. Acceptance forbids `buckets(` in both components.
- The `isFuture`-cell non-interactivity mirrors the real `ActivityHeatmap.renderDayCell` pattern; reusing `heatmapLevel`/`classifyHeatmapCell`/`colors.heatmapScale` (not the full `ActivityHeatmap` with its lens/prev-next chrome) satisfies §J.
- D-09 sync model is now accurately described as focus-time re-read (`SettingsInteractionsScreen` uses `useFocusEffect`→`reload`), not live propagation — matches the no-shared-reactive-store reality.
- Render-free tree-walk test idiom (with named analogs) is the correct approach given no renderer on disk.

**Concerns.**
- LOW: Task 4 leaves the exact Settings category to execution-time discretion (`SettingsInteractionsScreen` "or a better natural fit"). Acceptance greps `SettingsInteractionsScreen.tsx` specifically, so if the executor relocates, the acceptance grep would misfire. Minor — pin the file or make the grep category-agnostic.

**Risk:** Low.

---

## Plan 06 — DigestScreen assembly, Up Next / Horizon sections, atomic drill-through

**Summary.** Composes the three modules; adds the atomic `setPopulationsAndFilters` store action for drill-through.

**Strengths.**
- `listDashboardPopulation` signature verified `(exec, query, now)` with no cap arg (`dashboard-read.ts:380`), returning the full filtered set — the "sliced in JS via `previewWithOverflow`" framing is now accurate (the earlier "capped read" wording is corrected).
- The atomic-both-axes fix is real and well-grounded: `setPopulations` (`dashboard-query-store.ts:92`) and `setFilters` (`:100`) each write one axis; `resetDashboardView` (`:116-128`) is the exact precedent (both axes + sort in one `updateAppSettings`, one generation bump). The cycle-2 regression (stale orthogonal axis empties the drilled `not-contacted AND needs-attention` set) is genuine, and the behavioral test seeded from a pre-existing persisted filter is the correct guard.
- Not passing the `up-next-read` row into full `ContactCard` is correct: `ContactCard` requires `modifiedAt`/`categoryLabel`/`isFavourite`/`fuelText`/`snippet` the DAO row lacks; the compact `Avatar`+`ringVisual` row avoids fabricating null fields.
- The `REASON_SQL`-NULL-for-wobble fallback to `status` copy is a real correctness need (`REASON_SQL` non-null only for rogue).

**Concerns.** None new. The D-10 equivalence test (count==preview==drill under `include_unbound_never_contacted=1`) correctly consumes Plan 03's read-path.

**Risk:** Low, contingent on Plan 03/05 landing first (`depends_on` correct).

---

## Plan 07 — regression gate + device UAT

**Summary.** Render-free shell-contract regression test + populated VALIDATION.md + full phase gate + physical-device UAT.

**Strengths.**
- Correctly render-free (runtime `TAB_ORDER`/`INITIAL_TAB` + `Object.keys(TAB_ICON)` parity + pure `resolveNotificationNav`); the cycle-3 HIGH-1 "false navigator-mount-harness premise" is fully retired.
- `autonomous:false` now matches the halting owner-confirmation precondition; PASS/FAIL/**BLOCKED** (never inferred) and the offline read-path check are strong.
- The repair loop is spelled out for a sequential executor and correctly attributes fixes to owning plans.

**Concerns.**
- MEDIUM (interaction with the Plan 02 finding): Plan 07 Task 1's full `npx vitest run` is the *first* place the Plan 02 build-breaker cluster surfaces. As written, that's late (wave 4) — the repair loop would then route ~6 test-file fixes back to Plan 02 after waves 2–3 already built on red. This is a consequence of the Plan 02 gap, not a defect in Plan 07 itself, but it argues for running the full suite per-wave (per project memory) rather than only at phase close. Recommend Plan 02 broaden its own verify so the breakers are caught in wave 1.

**Risk:** Low on its own; elevated only by the upstream Plan 02 gap.

---

## Overall Risk Assessment

The plans are internally consistent, decision-grounded, and (rare for cycle 4) every file:line checked is accurate. Owner rulings D-08/D-09/D-10 are implemented correctly at the mechanism level: the migration is additive/forward-only, the backup bump has the mandatory `FORWARD_MIGRATIONS[6]` + parse-boundary validator, the D-10 not-contacted relaxation matches `countNeverContacted` exactly and survives post-processing, and the drill-through mutates both persisted query axes atomically.

The single material gap is the **Plan 02 test-consumer build-breaker cluster** (HIGH): the version bump breaks assertions in `category-identity-audit.test.ts` (4 pins), `orrery-preferences-portability.test.ts`, `orrery-exploration.integration.test.ts`, `backup-service.test.ts`, and `029-ai-configuration.test.ts:22` — none owned by any plan, and invisible to Plan 02's scoped verify. This is the exact pattern the project's own memory flags as recurring.

No new owner-escalation triggers: nothing in the plans deletes/weakens/inverts a standing ADR or HANDOFF entry. The `category-identity-audit` "no-schema-change" guard that Phase 38 invalidates pins a *past* phase's property, not a live decision, and D-08 explicitly ratifies the change — so updating it is in-scope maintenance, not a reversal.

## Recommendation

**PROCEED after one scoped correction to Plan 02:** add the six build-breaker test files to Plan 02 Task 3 `files_modified`, update their version/migration assertions (6→7, 29→30, `AI_CONFIGURATION_SCHEMA_VERSION`→`YOUR_WEEK_PERIOD_SCHEMA_VERSION`, allow `migration030`), and broaden Task 3's `<verify>` to run the full `src/backup` suite + `category-identity-audit.test.ts` + `029-ai-configuration.test.ts` so the wave-1 gate is genuinely green. This is a mechanical, inline PLAN.md edit — it does not require a full replan. All other plans are ready to execute.

---
