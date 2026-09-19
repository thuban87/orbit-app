---
phase: 38
reviewers: [codex, claude]
reviewed_at: 2026-09-19T01:19:00Z
plans_reviewed: [38-01-PLAN.md, 38-02-PLAN.md, 38-03-PLAN.md, 38-04-PLAN.md, 38-05-PLAN.md, 38-06-PLAN.md, 38-07-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=low)"
  claude: "unknown (read-only Claude subagent — Write-gap fallback)"
model_sources:
  codex: "banner"
  claude: "subagent-fallback"
review_method_notes: >
  Convergence CYCLE 3 (final convergence check). The built-in `claude` reviewer lane was NOT
  used: this run executes inside Claude Code (CLAUDE_CODE_ENTRYPOINT=cli), so the machinery skips
  its own lane for independence, and that lane is also the known Write-permission-gap hazard
  (project MEMORY). Per the documented workaround the Claude review was run as a READ-ONLY
  general-purpose subagent and aggregated alongside the codex lane. The codex lane returned a
  genuine source-grounded review on the first attempt (gpt-5.6-sol, reasoning=low). The aggregator
  independently re-verified every disputed / load-bearing finding against the code on disk before
  recording it (CLAUDE.md "Review the code, not the diff").
cycle_summary:
  cycle: 3
  current_high: 2
  current_actionable: 7
  verdict: >
    Cycle-3 confirms all THREE cycle-2 HIGHs are resolved on disk: Plan 02 now wires yourWeekPeriod
    through the real COLUMN_OF/WritableSettingsKey/AppSettingsRow/validateAppSettingsPatch contract
    (the phantom KEY_TO_COLUMN is gone), Plan 06 sets BOTH query axes atomically via the new
    setPopulationsAndFilters with a pre-existing-persisted-axis regression test, and Plan 07 is
    autonomous:false with the halting owner-confirmation precondition. TWO NEW HIGHs surfaced, both
    verified against code on disk by the aggregator: (1) the rendered-navigator tests in Plan 01
    Task 2 and Plan 07 Task 1 are non-executable — no react-test-renderer / @testing-library exists,
    vitest.config.ts mandates render-free tests, and NO existing test mounts a navigator, so Plan
    07's premise that an "existing navigator-mount harness" can be reused is factually false; and (2)
    Plan 06's Never Contacted count (countNeverContacted, unbound-inclusive) does not equal its
    preview/drill-through (listDashboardPopulation not-contacted, bound to tracking_enabled=1),
    breaking the plan's stated "equals EXACTLY" invariant when include_unbound_never_contacted=1.
    No owner-escalation trigger: D-08/D-09 are implemented per the owner's ruling and no plan
    deletes/weakens/inverts an ADR/HANDOFF/dossier decision. The only decision-adjacent fork is HIGH
    2's alternative fix (broaden not-contacted to include unbound), which WOULD touch ADR-062/§G
    population semantics and must be escalated IF that path is chosen — the conservative fix (derive
    the count from the same bound-only preview read) does not.
---

# Cross-AI Plan Review — Phase 38: Digest & Navigation Restructure (Convergence Cycle 3)

## Consensus Summary

Two independent reviewers assessed the 7-plan / 4-wave set after two cycle-2 replans (6fd031c,
f89696b). Both confirm — against the code on disk — that all three cycle-2 HIGHs are resolved:
the Plan 02 writer wiring now uses the real `COLUMN_OF`/`WritableSettingsKey`/`AppSettingsRow`/
`validateAppSettingsPatch` contract (the cycle-2 `KEY_TO_COLUMN` hallucination is gone, explicitly
noted at `38-02-PLAN.md:27,156,177`), Plan 06's drill-through now sets BOTH axes atomically via a
new `setPopulationsAndFilters` with a pre-existing-persisted-axis behavioral test, and Plan 07 is
`autonomous: false` with the halting owner-confirmation precondition. **D-08 and D-09 are implemented
per the owner's ruling and are NOT re-raised** — only their concrete implementation was examined,
and both check out.

The two reviews diverge on severity, and the aggregator adjudicated the divergence against disk
(as in cycle 2). **Codex rated the phase HIGH** on two grounds; **the read-only Claude subagent rated
it LOW**, finding no new HIGH. The aggregator independently verified both codex HIGHs on disk and
sustains them (with one scope correction), while also sustaining Claude's new MEDIUM:

**Aggregator verification of the load-bearing / disputed findings (evidence on disk):**

1. **Rendered-navigator tests are non-executable (codex HIGH — SUSTAINED, scope-corrected → HIGH #1).**
   `package.json` has no `react-test-renderer` and no `@testing-library/react-native` (confirmed:
   neither in `package.json` nor `node_modules`); `vitest.config.ts:4-14` explicitly mandates
   render-free (node env, "tests must stay render-free (no DOM shipped)"); and a repo-wide grep for
   `NavigationContainer` / a rendered `RootNavigator` in any `*.test.tsx` returns **NONE** — no
   existing test mounts a navigator. Therefore Plan 07 Task 1's premise at `38-07-PLAN.md:78`
   ("existing `src/navigation/*.test.tsx` that MOUNT a navigator … reuse their harness/providers")
   is **factually false**, and its Task-1 requirement to "RENDER `RootNavigator` … assert the
   initially-focused Digest tab … drive a tabPress and assert popToTop" (`:83,:97`) cannot run — those
   assertions need runtime navigation state that only a mounted `NavigationContainer` provides.
   Plan 01 Task 2's acceptance "A navigation test **mounts** DigestStack and EventsStack and
   traverses Profile → RecentlyDeleted" (`38-01-PLAN.md:169`) has the same blocker.
   **Scope correction:** codex swept Plans 05 and 06 into this HIGH, but the repo has a render-free
   component-test idiom that calls the component function and walks the returned element tree
   (`src/components/orrery/orrery-controls-render.test.tsx`, `src/components/category/CategoryChoiceSheet.test.tsx`),
   so Plan 05's cell/day-detail tests and Plan 06's row-count/store tests ARE feasible render-free.
   The genuine blocker is only the **navigator-mount** tests (Plan 01 Task 2 acceptance + Plan 07
   Task 1). Fix: extract a runtime shell/route descriptor (tab ids, order, roots, initial tab; route
   arrays per stack) and unit-test it in Node, and move initial-focus / reselect-popToTop / stack
   traversal to Plan 07 device UAT. This aligns WITH the render-free convention (not a reversal); if a
   replan instead ADDS a renderer, that is a scope/infra decision to surface to the owner.

2. **Plan 06 Never Contacted count↔preview↔drill population mismatch (codex HIGH — SUSTAINED → HIGH #2).**
   The count comes from `countNeverContacted` (`src/db/dashboard-read.ts:544-553`), which includes
   unbound contacts via `tracking_enabled = 0 AND (SELECT include_unbound_never_contacted …) = 1`.
   The preview rows and the drill-through both come from `listDashboardPopulation(['not-contacted'])`,
   which every explicit population constrains to `tracking_enabled = 1`
   (`DASHBOARD_POPULATION_SCOPE_WHERE`, `src/logic/dashboard-query-logic.ts:218-220`; `not-contacted`
   predicate `:268-280`). So when `include_unbound_never_contacted = 1` and any unbound
   never-contacted contact exists, the count exceeds the preview+drill universe — yet Plan 06 asserts
   the drilled list "equals the preview EXACTLY" (`38-06-PLAN.md:138,149,151`) and derives the
   "+N more" arithmetic from the count. Plan 03 even notes `countNeverContacted` "honours
   include_unbound_never_contacted" (`38-03-PLAN.md:111`) without reconciling it against the
   bound-only preview read. No test seeds `include_unbound_never_contacted = 1`. Fix: derive the count
   from the same `listDashboardPopulation` result as the preview (conservative, bound-only), OR route
   the drill to a universe that also includes opted-in unbound contacts — the latter touches
   population semantics (ADR-062 / dossier §G) and must be escalated IF chosen.

3. **Horizon "Overlooked" preview ≠ drill target (Claude MEDIUM — SUSTAINED, actionable).**
   A sibling of HIGH #2 on the other Horizon subgroup: `readOverlooked` (`src/db/digest-read.ts:109-124`)
   is rogue-only with **no snooze predicate**, while the Overlooked drill target `needs-attention`
   resolves to a broader status range (wobble+decay+rogue) that also excludes snoozed contacts
   (`dashboard-query-logic.ts:172-174`). A snoozed rogue appears in the preview then vanishes on
   drill; wobble/decay contacts appear in the drill but never in the preview. No acceptance criterion
   catches it. Weighted MEDIUM (a narrow UX/consistency gap, not the count-arithmetic defect of HIGH #2).

**No owner-escalation trigger fires this cycle.** D-08 (portable `yourWeekPeriod`, `BACKUP_FORMAT_VERSION`
6→7) and D-09 (period preference in both a Settings row and the in-context toggle, single source of
truth) are implemented correctly per the owner's rulings, and no NEW finding deletes, weakens, or
inverts a recorded ADR / HANDOFF / dossier decision. The only decision-adjacent item is HIGH #2's
alternative fix path, flagged above.

### Agreed Strengths

- Cycle-2 HIGHs all resolved on disk: real `COLUMN_OF` writer contract (no `KEY_TO_COLUMN`), atomic
  both-axes `setPopulationsAndFilters`, `autonomous: false` + halting precondition.
- Migration 030 is the correct next head (029 on disk; `TARGET_VERSION` repointed); `BACKUP_FORMAT_VERSION`
  6→7 with a mandatory `FORWARD_MIGRATIONS[6]` is correct.
- D-08/D-09 implemented correctly; the Up Next attention predicate reuses the canonical
  `dashboard-query-logic.ts:172-176` verbatim; the `{d,n}`→Map heatmap feed avoids `buckets()`
  double-collapse; group-event dedup is coherent against the `026` schema.
- Wave ordering/parallelism is safe (disjoint file sets per wave).

### Agreed Concerns

- **Horizon preview↔drill population equivalence is not sound** — codex found it on Never Contacted
  (unbound inclusion, HIGH #2), Claude found it on Overlooked (snooze/status range, MEDIUM). Together
  they show the plan's "drilled list equals the preview" contract is false on both Horizon subgroups.

### Divergent Views

- **Rendered-navigator tests:** codex rated non-executable rendered tests a HIGH across Plans
  01/05/06/07; Claude did not flag test executability at all. Aggregator adjudication: codex is
  correct that the **navigator-mount** tests (Plan 01 Task 2, Plan 07 Task 1) cannot run and rest on
  a false "existing mount harness" claim (HIGH #1), but over-scoped it — Plan 05/06 component tests
  are feasible via the repo's existing render-free tree-walk idiom.
- **Overall risk:** codex HIGH-until-fixed; Claude LOW. Reconciled at "HIGH until the two blockers
  are replanned, then MEDIUM-LOW," matching codex's own consolidated verdict.

---

## Codex Review


## Summary

The plans are substantially improved and generally align with the dossier. Migration 030 is correctly next after 029, the settings plan now targets the real `COLUMN_OF` writer and restore validator, and navigation cleanup covers several previously missed live routes.

Three material issues remain:

1. Plans 01, 05, 06, and 07 require rendered React Native tests, but this repository explicitly has no renderer and mandates render-free Vitest tests.
2. Plan 06 assumes the Never Contacted count and row source describe the same population, but they diverge when unbound inclusion is enabled.
3. Plan 02 adds DAO validation for `yourWeekPeriod` but omits validation at the backup parser boundary, contrary to the existing portable-settings validation pattern.

Overall risk: **HIGH until the first two issues are replanned**.

---

## Plan 01 — Five-tab shell

### Summary

The navigation transition is well scoped and correctly preserves the internal `DashboardTab` identifier. Route promotion, Backup share-intent repair, and stale type-comment cleanup are appropriately grouped.

### Strengths

- Preserving `DashboardTab` is correct because FAB intents hardcode it in `src/components/universal-fab-logic.ts:28-32` and `:82-103`.
- Repointing the backup share intent is necessary: it currently targets `BackupTab` at `src/navigation/linking.ts:67`, while Backup is already registered under Settings.
- Retaining the temporary `DashboardStackParamList.Digest` entry until notification routing changes is sound dependency ordering. The current notification intent still produces `[Home, Digest]` at `src/services/notifications/notification-nav.ts:76-92`.
- The Events relabel is source-grounded: current user-facing strings remain at `src/screens/GroupEventsScreen.tsx:64`, `:72`, `:77`, `:85`, and `:145-152`.

### Concerns

- **HIGH — the required stack-mount/traversal test cannot run with current test infrastructure.** Task 2 requires mounting `DigestStack` and `EventsStack` and traversing Profile → RecentlyDeleted. The repository has no `react-test-renderer` or `@testing-library/react-native`; `npm ls` is empty, `package.json:51-59` lists neither dependency, and `vitest.config.ts:4-7` explicitly says tests must remain render-free. Existing navigation tests are pure or source-based, not mounted navigator tests; for example, `src/navigation/profile-origin-integration.test.ts:1-23` only exercises pure intent logic.

### Suggestions

- Extract runtime route-registration arrays for each new stack and render `Stack.Screen`s from those arrays. Unit-test the arrays in Node, including `RecentlyDeleted`, instead of mounting navigators.
- Alternatively, explicitly add a renderer and update the test architecture, dependencies, and plan scope. That is broader and less consistent with current repository conventions.

### Risk Assessment

**MEDIUM-HIGH.** The implementation shape is good, but the stated verification method is currently non-executable.

---

## Plan 02 — Your Week data, migration, and backup

### Summary

This is a strong data-layer plan. It correctly identifies migration 030 as the next head and now threads the preference through the real settings writer contract. The distinction between child-inclusive headline interactions and deduplicated heatmap activity units is explicit and internally coherent.

### Strengths

- Migration 030 is correctly next: `src/db/database.ts:67-99` registers through migration 029, and `src/db/migrations/full-chain.test.ts:85-91` pins the current target to 29.
- The writer analysis is correct. `WritableSettingsKey` begins at `src/db/app-settings-dao.ts:531`, `COLUMN_OF` is at `:692`, and the generic writer iterates that exact map at `:1486-1490`.
- Restore really does cast external manifest entries to `AppSettingsPatch` and then call `updateAppSettingsCore` at `src/backup/restore-apply.ts:1588-1596`; adding a DAO runtime validator is therefore necessary.
- The planned format bump correctly requires a `FORWARD_MIGRATIONS[6]` entry because parsing walks every version at `src/backup/backup-schema.ts:981-1001`.
- The group-event storage model supports the planned deduplication: one parent lives in `group_events`, while participant interactions link through `group_event_id` with one child per contact, enforced by the partial unique index at `src/db/migrations/026-group-events-schema.ts:17-40`.

### Concerns

- **MEDIUM — backup parsing does not explicitly validate `yourWeekPeriod`.** The plan adds validation in `validateAppSettingsPatch`, which protects restore application, but `parseBackupManifest` is expected to strictly validate the portable manifest before returning it. Existing settings with constrained vocabularies are validated inside `assertPortableSettings`, such as interaction channels at `src/backup/backup-schema.ts:301-317` and message modes at `:319-333`. The plan only adds the key to `PORTABLE_SETTINGS_KEYS` and defaults it during migration. A crafted format-6 manifest containing `yourWeekPeriod: "weekly"` would survive `settings.yourWeekPeriod ?? "rolling7"` and parse successfully, failing only later during restore.
- **LOW — the v1-jump test instructions do not match the current reusable test surface.** The existing full-chain test starts at v0 at `src/db/migrations/full-chain.test.ts:15-22`; it does not export a “full-chain runner” fixture. The executor can build a v1 fixture, but the plan should specify running migration 001 first and then invoking `runMigrations` to 30.

### Suggestions

- Export/reuse `assertYourWeekPeriod` and invoke it in `assertPortableSettings`, matching the established channel/message-mode pattern.
- Add parser tests for invalid format-7 and migrated format-6 `yourWeekPeriod` values, not only DAO-write rejection.
- Clarify the v1 fixture construction explicitly.

### Risk Assessment

**MEDIUM.** The irreversible mechanics are otherwise carefully designed, but backup validation should reject malformed data at parse time.

---

## Plan 03 — Up Next and Horizon composition

### Summary

The plan cleanly separates canonical SQL selection from pure presentation composition. It fixes the previously unreachable Up Next empty state and handles birthday and dedup semantics deterministically.

### Strengths

- The attention predicate is exactly the canonical Dashboard predicate: progress floor plus active-snooze exclusion at `src/logic/dashboard-query-logic.ts:173-176`.
- Reusing `STATUS_CADENCE_PRECONDITION` is necessary because the status fragments require bound, contacted rows; that contract is documented at `src/db/status.ts:53-64`.
- Keeping SQL uncapped is appropriate because Horizon dedup needs the selected three IDs while later candidates may remain relevant.
- The birthday boundary avoids the Dashboard’s 30-day implementation at `src/db/dashboard-read.ts:292-307` and correctly uses a separate 0–6-day filter.
- The fallback presentation issue is properly delegated: `REASON_SQL` is null for wobble/decay at `src/db/status.ts:80-104`, while the planned Up Next component falls back to status.

### Concerns

- No new blocking concern found.

### Suggestions

- Type the returned `status` as the canonical status union rather than generic `string`; this will reduce casting in Plan 06.
- Keep copy derivation in a pure helper so the render-free test suite can cover all `reason/status` combinations.

### Risk Assessment

**LOW.** The proposed data and composition contracts are narrow and source-aligned.

---

## Plan 04 — Notification, Contacts cleanup, and FAB audit

### Summary

This plan correctly repairs semantic notification routing and removes live navigation to promoted stack roots. The atomic ordering—repointing notification and overflow routes before deleting stale Dashboard route types—is sound.

### Strengths

- A distinct Digest intent is appropriate because `applyBodyNav` currently assumes every intent can be passed to `resetToDashboardWith` at `src/navigation/notification-gate.tsx:129-152`.
- Preserving the stale-request guard is important: current code checks `isCurrent()` after the asynchronous lookup at `src/navigation/notification-gate.tsx:140-145`, and the existing test proves the older lookup cannot reset navigation at `src/navigation/notification-gate.test.tsx:76-130`.
- The overflow fix addresses a real crash. `src/screens/dashboard-overflow-actions.ts:3-6` only models local one-argument navigation, and its Group Events action currently calls the removed in-stack route at `:25-29`.
- The proposed dedicated `openEvents()` callback is safer than weakening the local route type.
- Extending FAB contact context is warranted because it currently recognizes only Dashboard/Orrery at `src/components/universal-fab-logic.ts:135-160`.

### Concerns

- **LOW — the overflow task must explicitly update its caller and existing pure test.** `HomeScreen` passes its stack navigation object directly at `src/screens/HomeScreen.tsx:1464-1470`, and `src/screens/dashboard-overflow-actions.test.ts:5-14` constructs a navigation object with only `navigate`. The plan text mentions wiring the caller, but Task 4’s `<files>` lists only the action module and navigation types. The plan-level file list includes `HomeScreen`, but the task ownership should be explicit to avoid a compile/test break after `openEvents` becomes required.

### Suggestions

- Add `HomeScreen.tsx` and `dashboard-overflow-actions.test.ts` to Task 4’s file list and acceptance criteria.
- Prefer a small pure helper for the Digest reset state so it remains independently testable without mounting navigation.

### Risk Assessment

**LOW-MEDIUM.** The behavior is well planned; task-level file ownership needs tightening.

---

## Plan 05 — Your Week presentation

### Summary

The component decomposition is sensible, the direct `{d,n}` → `Map` contract fixes the earlier aggregation error, and D-09’s two-surface preference is properly respected. However, almost every listed test is incompatible with the repository’s render-free test environment.

### Strengths

- Directly constructing the count map is correct. `buckets()` increments once per input row at `src/services/history/buckets.ts:52-69`, so feeding pre-aggregated `{d,n}` rows through it would lose `n`.
- Reusing `classifyHeatmapCell` and `heatmapLevel` is appropriate; their count-to-level logic is pure at `src/components/history/heatmap-cell.ts:39-48` and `src/services/history/buckets.ts:77-86`.
- Future-cell handling matches the shipped heatmap’s actual behavior at `src/components/history/ActivityHeatmap.tsx:196-212`.
- Settings placement is plausible and source-aligned. `SettingsInteractionsScreen` already reloads on focus at `src/screens/SettingsInteractionsScreen.tsx:57-71` and persists through `updateAppSettings` at `:73-89`, so the two surfaces can converge on the same durable value without a second store.

### Concerns

- **HIGH — the planned component tests cannot execute as written.** Tasks require rendering, querying accessibility roles, pressing future cells, observing inline day records, and testing the screen row. The repository explicitly runs Node-only, render-free tests (`vitest.config.ts:4-14`), has no renderer in `package.json:51-59`, and documents the `*-logic.ts` extraction convention at `src/components/field-def-form-logic.ts:1-17`.
- **MEDIUM — “both surfaces stay in sync” should be defined as focus-time synchronization, not live simultaneous synchronization.** The Settings screen refreshes on focus at `src/screens/SettingsInteractionsScreen.tsx:67-71`. That is sufficient across navigation, but there is no shared reactive settings store. The plan should avoid implying instantaneous cross-screen propagation while one surface remains mounted off-focus.

### Suggestions

- Extract pure modules for:
  - heatmap cell view models and interactivity;
  - day-detail row projection;
  - period transition/generation logic;
  - Settings option definitions.
- Test those modules in Node and reserve actual press/accessibility verification for Plan 07 device UAT.
- State that both controls re-read the shared preference on focus and after their own writes.

### Risk Assessment

**HIGH.** The production design is credible, but the test strategy conflicts directly with repository infrastructure.

---

## Plan 06 — Digest assembly

### Summary

The Digest composition and atomic drill-through store action are thoughtful, but the Never Contacted preview/count equivalence is incorrect against the live data model. This can produce a visible count/preview/drill-through mismatch for a supported persisted setting.

### Strengths

- The new atomic store action follows the right precedent: `resetDashboardView` persists multiple axes in one call and performs one generation bump at `src/stores/dashboard-query-store.ts:116-128`.
- Clearing both orthogonal query axes avoids the prior stale-filter/population bug.
- The Contacts population rules cited by the plan are correct: empty populations use Active at `src/logic/dashboard-query-logic.ts:248-255`, and `needs-attention` uses the canonical predicate at `:173-176`.
- Removing `navigate("Home")` from the promoted Digest root is necessary.
- The status-copy fallback is necessary because `REASON_SQL` returns null outside rogue status at `src/db/status.ts:80-104`.

### Concerns

- **HIGH — Never Contacted count, preview rows, and drill-through are not the same population.** `countNeverContacted` includes unbound contacts when `include_unbound_never_contacted=1` at `src/db/dashboard-read.ts:539-553`. By contrast, every explicit Dashboard population is constrained by `tracking_enabled = 1` at `src/logic/dashboard-query-logic.ts:218-220`, including `not-contacted` at `:268-280`. Therefore:
  - Digest may show count `N` including unbound contacts;
  - `listDashboardPopulation(...['not-contacted'])` will omit those unbound contacts;
  - the preview and `+N more` count can disagree;
  - drill-through cannot equal the Digest preview/count as the plan repeatedly claims.
- **HIGH — component/screen tests again require a renderer that does not exist.** The Up Next, Horizon, and DigestScreen tests require rendered row counts, subgroup visibility, navigation presses, and section order. The Node-only render-free restriction is explicit at `vitest.config.ts:4-14`.
- **MEDIUM — `UpNextSection` cannot directly pass the planned row to `ContactCard`.** `ContactCard` requires `modifiedAt`, `categoryLabel`, `isFavourite`, `fuelText`, and `snippet` at `src/components/ContactCard.tsx:51-71`, while Plan 03’s read only selects id/name/photo/progress/status/reason. The plan needs either a dedicated compact Digest row/status-ring primitive or an explicit neutral mapping. Silently supplying false/null Dashboard fields risks making the component contract misleading.

### Suggestions

- Resolve the Never Contacted population mismatch before execution:
  - either derive both count and preview from the same `listDashboardPopulation` result, accepting bound-only canonical Contacts behavior;
  - or add an existing-architecture retrieval path that includes opted-in unbound contacts and ensure drill-through reaches that same universe.
- Because changing unbound semantics may interact with ADR-062 and the dossier’s “canonical Contacts population” language, escalate if the proposed fix would broaden or weaken an existing population decision.
- Replace rendered component tests with pure composition/view-model tests.
- Prefer a purpose-built Digest contact row using `Avatar` plus shared `ringVisual`, or expand `up-next-read` with the exact presentation fields if reusing `ContactCard` is intentional.

### Risk Assessment

**HIGH.** The population mismatch is user-visible and violates the plan’s core drill-through equivalence; test execution is also blocked.

---

## Plan 07 — Regression and physical UAT

### Summary

The device-UAT plan is unusually thorough and correctly treats unavailable cases as BLOCKED. The automated shell test, however, cannot be implemented under the current test architecture as specified.

### Strengths

- `autonomous: false` now correctly matches the owner-confirmation precondition.
- PASS/FAIL/BLOCKED and disposable fixtures are appropriate, especially for group-event and notification behaviors that cannot be inferred from an empty screen.
- The offline check directly verifies the local-first requirement.
- The repair loop clearly routes defects back to owning plans.
- Recording build SHA, device serial, API level, theme, and fixture identity makes UAT evidence reproducible.

### Concerns

- **HIGH — the rendered navigator regression test is impossible with current dependencies.** The plan requires rendering `RootNavigator`, inspecting tab order/focus, and driving tab presses. The repo has no renderer (`package.json:51-59`), `npm ls react-test-renderer @testing-library/react-native` is empty, and `vitest.config.ts:4-7` explicitly requires render-free tests. The assertion that Plan 01 adds a navigator-mount harness is unsupported by the current repository and Plan 01 does not add a rendering dependency.
- **MEDIUM — reselect-to-root should be tested through extracted pure logic rather than a mounted navigator.** The live behavior is contained in the non-exported `handleActiveTabPress` at `src/navigation/RootNavigator.tsx:91-118`. Without a renderer, it cannot be behaviorally exercised. Extracting the intent calculation into a pure helper would make this contract testable while leaving actual React Navigation dispatch for device UAT.

### Suggestions

- Introduce a runtime shell descriptor containing tab IDs, labels, order, roots, and initial tab; have `RootNavigator` render from it and test it in Node.
- Extract active-tab reselect resolution into a pure helper accepting focused state/transient outcome and returning `dismiss`, `pop-to-top`, or `default`.
- Test `TAB_ICON` parity and notification intent purely.
- Leave the final navigator integration and actual reselect gesture to physical UAT unless a renderer is deliberately added.

### Risk Assessment

**HIGH.** The UAT portion is strong, but the phase gate’s flagship automated test is currently non-executable.

---

# Consolidated Required Changes

1. **Rework the test strategy across Plans 01, 05, 06, and 07.** Either add and configure a supported React Native renderer as explicit scope, or follow the repository’s existing `*-logic.ts` pure-test convention and move rendered interaction checks to device UAT.
2. **Fix the Never Contacted population mismatch in Plan 06.** Count, preview rows, overflow count, and drill-through must share one explicit population contract, including a test with `include_unbound_never_contacted=1`.
3. **Validate `yourWeekPeriod` inside `assertPortableSettings` in Plan 02**, with malformed format-6 and format-7 parser tests.
4. Tighten Task 04-04 file ownership to include the `HomeScreen` caller and overflow action test.
5. Specify whether Up Next expands its DAO row or uses a dedicated compact row instead of undersupplying `ContactCard`.

# Overall Risk Assessment

**HIGH.**

The architectural direction is good and the previous convergence findings were largely resolved. The remaining issues are concentrated but consequential: two plans depend on a population equivalence contradicted by live SQL, and four plans depend on rendered tests forbidden by the current test setup. Once those are corrected, the implementation risk should fall to **MEDIUM-LOW**.

---

## Claude Review (read-only subagent — Write-gap fallback)

> Ran as a READ-ONLY general-purpose subagent, not the built-in `claude -p` lane. This run
> executes inside Claude Code (`CLAUDE_CODE_ENTRYPOINT=cli`), so the machinery skips its own
> lane for independence, and that lane is also the known Write-permission-gap hazard (project
> MEMORY). Per the documented workaround the Claude review was run as a read-only subagent with
> full repo read access and aggregated alongside codex.

### 1. Summary

This is an unusually well-grounded plan set. Read all 7 PLAN.md files in full and cross-checked
essentially every load-bearing symbol, line citation, and SQL fragment against the actual code on
disk — including `src/db/app-settings-dao.ts`, `src/backup/types.ts`, `src/backup/backup-schema.ts`,
`src/db/database.ts`, `src/db/migrations/`, `src/db/status.ts`, `src/logic/dashboard-query-logic.ts`,
`src/db/dashboard-read.ts`, `src/db/digest-read.ts`, `src/navigation/*`, `src/components/icons/icon-registry.ts`,
`src/screens/dashboard-overflow-actions.ts`, `src/stores/dashboard-query-store.ts`, and
`src/db/migrations/026-group-events-schema.ts`. Every symbol the plans cite as existing (`COLUMN_OF`,
`WritableSettingsKey`, `validateAppSettingsPatch`, `PROGRESS_SQL`/`STATUS_SQL`/`REASON_SQL`,
`STATUS_CADENCE_PRECONDITION`, `listDashboardPopulation`, `resetDashboardView`, `setPopulations`/`setFilters`
writing only one axis each, `renderDayCell`'s `isFuture` blank-cell branch, `title="Group Events"` at
`GroupEventsScreen.tsx:72`, `TabParamList`/`DashboardStackParamList` stale entries, `linking.ts:67/71`)
checked out exactly, including line numbers in almost every case. The claimed absence of `KEY_TO_COLUMN`
(the cycle-2 hallucination) and the presence of the real `COLUMN_OF` map at `app-settings-dao.ts:692` is
confirmed. D-08 and D-09 are both implemented correctly and are not re-litigated. Migration 030 is
confirmed the correct next head (029 is on disk; `TARGET_VERSION = AI_CONFIGURATION_SCHEMA_VERSION` = 29).
Found one new, disk-verified MEDIUM population-consistency gap in Plan 06's Horizon drill-through that no
acceptance criterion catches, plus a few low-severity polish items. No HIGH carryovers remain open, and
no NEW HIGH found by this reviewer.

### 2. Strengths

- **D-08 implemented correctly**: `yourWeekPeriod` is wired through the real `COLUMN_OF`/`WritableSettingsKey`/`validateAppSettingsPatch` contract (Plan 02 Task 2), and `BACKUP_FORMAT_VERSION` bump to 7 plus `FORWARD_MIGRATIONS[6]` (Plan 02 Task 3) mirrors the *actually landed* Phase-36 pattern — verified: `history_lens` is genuinely emitted in `getPortableSettingsSnapshot`'s SELECT (`app-settings-dao.ts:960`) and return (`:1013`), and is in `PORTABLE_SETTINGS_KEYS` (`backup-schema.ts:215`), confirming the "declare-optional/emission-deferred" RESEARCH pattern is genuinely stale for this key family.
- **D-09 implemented correctly**: Plan 05 Task 4 adds a Settings row to the *existing* `src/screens/SettingsInteractionsScreen.tsx` that reads/writes the identical `yourWeekPeriod` `app_settings` key the in-context toggle (Task 3) uses — genuinely single source of truth, not two stored copies.
- **The cycle-2 `setFilters`/`setPopulations` single-axis bug is real and the fix is correct**: verified `setPopulations` (`dashboard-query-store.ts:92-99`) and `setFilters` (`:100-111`) each call `updateAppSettings` independently, writing only their own axis. The new `setPopulationsAndFilters` action mirrors `resetDashboardView` (`:116-128`), which genuinely writes both axes atomically in one call — a sound, disk-verified precedent.
- **Group-event dedup design (Plan 02 Task 4) is coherent against a real schema fact**: `interactions.group_event_id` is nullable with `ON DELETE SET NULL` (`migrations/026-group-events-schema.ts:31-32`); the plan correctly treats `group_events` as a standalone one-unit entity independent of participant archival — a defensible, explicitly-surfaced read-time decision per D-05/§H/§J.
- **Up Next empty-state reachability fix is real and correctly scoped**: `up-next-read.ts`'s WHERE reuses the exact canonical `needs-attention` predicate verbatim from `dashboard-query-logic.ts:172-174`, satisfying D-04 without inventing a Digest-local rule.
- **Migration 030 numbering and mechanics are correct**: migration 029 (`AI_CONFIGURATION_SCHEMA_VERSION`) is the current head, no 030 exists yet, and `BACKUP_FORMAT_VERSION` is currently 6 — matching the plan's premises exactly.
- **The reversibility checkpoint in Plan 02 is scoped correctly** (mechanics-only, not re-litigating D-08).
- **Plan ordering/parallelism is safe**: waves touch disjoint file sets; Plan 06 (wave 3) transitively depends on Plan 02 via Plan 05, which is correct.

### 3. Concerns

- **MEDIUM — NEW this cycle: Horizon "Overlooked" preview and its drill-through target are materially different populations; no acceptance criterion in Plan 06 catches this.** `readOverlooked` (`src/db/digest-read.ts:109-124`) filters `WHERE c.archived_at IS NULL AND c.tracking_enabled = 1 AND c.last_contact IS NOT NULL AND (STATUS_SQL) = 'rogue'` — it has **no `snooze_until` predicate at all** (its own doc comment says the mute filter is deliberately omitted). The Plan 06 drill-through target for Overlooked is `setPopulationsAndFilters(exec, [], { 'needs-attention': ['on'] })`, which resolves via `dashboard-query-logic.ts:172-174` to `(PROGRESS_SQL) >= STABLE_MAX AND (c.snooze_until IS NULL OR ...)` — a **broader status range (wobble+decay+rogue, since `STABLE_MAX=0.8 < ROGUE_K=3`, `status.ts:40-42,72-78`) that also excludes snoozed contacts** (DASHQ-05). Consequences: (1) a snoozed rogue contact can appear in the Overlooked preview but disappears on "+N more"; (2) the drilled list can contain wobble/decay contacts that never appeared in the preview. Plan 06 proves exact preview↔drill equivalence for Never Contacted but makes no equivalence claim/test for Overlooked. Since `readOverlooked` is used only by the Digest surface, aligning its snoozed-exclusion with the canonical `needs-attention` predicate is a local, low-blast-radius fix that would not violate D-05.
- **LOW — Plan 01/04's `RecentlyDeleted` route registration is verified correct by pattern-matching `OrreryStack.tsx`, but the plan never independently enumerates every route `ContactProfileScreen` can open**: acceptance criteria only grep for `RecentlyDeleted`, `Profile`, and `GroupEventDetail`; the other ~13 named routes (e.g. `SurvivorSelect`/`MergeConflicts`/`MergeImpactSummary`) have no acceptance grep. Recommend adding one grep per named Profile-reachable route to the Plan 01 Task 2 acceptance list.
- **LOW — carryover risk, not a defect**: Plan 07 Task 1's repair loop depends on correctly identifying "the owning plan" from a `tsc`/`vitest` failure; given the deep cross-plan coupling, this could require judgment calls not fully mechanizable — acceptable for a verification-only closing plan, flagged only for visibility.

### 4. Suggestions

1. **Plan 06 Task 2**: Add an explicit behavioral test (or a documented, deliberate acceptance of the divergence) for the Overlooked preview↔drill-through population mismatch. Either add the snooze predicate to `readOverlooked`'s WHERE so preview and `needs-attention` drill agree, or explicitly document the intentional non-equivalence and adjust the `+N more` copy.
2. **Plan 01 Task 2**: Tighten acceptance to grep for every enumerated Profile-reachable route, not just three.
3. No changes needed to D-08/D-09 mechanics — both implemented correctly per the owner rulings.

### 5. Risk Assessment

**LOW.** A mature, third-cycle convergence with extremely high fidelity between plan claims and actual disk state — not a single hallucinated symbol, wrong line citation, or incorrect migration-head/backup-version claim across the seven plans. The one new MEDIUM (Overlooked preview/drill population mismatch) is a real, narrow UX/data-consistency gap, not a data-integrity, security, or one-way-door issue, and is cheap to fix or explicitly accept.

---
