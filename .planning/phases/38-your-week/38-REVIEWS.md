---
phase: 38
reviewers: [codex, claude]
reviewed_at: 2026-09-19T03:56:40Z
review_kind: full-adversarial
convergence_cycle: 7
plans_reviewed: [38-01-PLAN.md, 38-02-PLAN.md, 38-03-PLAN.md, 38-04-PLAN.md, 38-05-PLAN.md, 38-06-PLAN.md, 38-07-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=low)"
  claude: "claude read-only subagent (general-purpose; default subagent model)"
model_sources:
  codex: "banner"
  claude: "subagent"
cycle_summary: current_high=0 current_actionable=4
notes: >
  Cycle-7 FULL adversarial re-review of the current committed plans (HEAD 08e21ef — the cycle-6
  fixes: two orphaned-test-consumers added to plan ownership (icon-registry.test.ts to Plan 01,
  full-chain.test.ts to Plan 02), the notification-gate test filename corrected, the Metro 8081->8082
  remap spelled out in Plan 07, VALIDATION render-free wording, plus a proactive orphaned-consumer
  sweep). NOT scoped to any prior finding list — all 7 plans reviewed fresh. The `claude` lane ran as
  a READ-ONLY Claude subagent (not the `claude -p` CLI lane, which fails on a Write-permission gap
  inside Claude Code — recorded workaround). Codex ran gpt-5.6-sol at the default LOW review-lane
  reasoning effort. Both reviewers were source-grounded; the orchestrator independently re-verified
  EVERY load-bearing claim against the code on disk per "review the code, not the diff," including a
  comprehensive orphaned-test-consumer sweep re-derived from scratch for every consumer of the
  changing contracts (TAB_ICON keys, TARGET_VERSION==29, BACKUP_FORMAT_VERSION==6). Phase 38 is NOT
  yet executed (git log shows only `docs(38):` commits; tree clean).

  OUTCOME — the two NEW HIGH build-breakers raised in cycle 6 (the orphaned icon-registry.test.ts
  and full-chain.test.ts consumers) are now RESOLVED on disk: icon-registry.test.ts is owned by
  Plan 01 (Task 1 steps 5-6 + `<files>` + acceptance greps), and full-chain.test.ts is owned by
  Plan 02 (Task 2 step g). The fresh adversarial pass found NO new HIGH and NO unowned orphaned
  test-consumer of any of the three changed symbols — every breaking consumer is assigned to a plan
  (orchestrator-verified file-by-file on disk). Migration 030 is the correct next free number
  (registry head is 029; 030 file absent), and D-08/D-09/D-10 are implemented correctly (not
  re-litigated). No new finding reverses an ADR/HANDOFF/dossier decision. FOUR actionable non-HIGH
  items remain (2 MEDIUM + 2 LOW), all fixable by editing the named PLAN.md and all disk-verified.
---

# Cross-AI Plan Review — Phase 38 (Digest & Navigation Restructure) — FULL ADVERSARIAL (cycle 7)

## Consensus Summary

Both reviewers (Codex gpt-5.6-sol @ low; a read-only Claude subagent) independently find the seven
plans **directionally strong, implementation-ready, and exceptionally well source-grounded**. The
recurring failure mode for this phase — an **orphaned test-consumer** of a changed symbol that
breaks the project-wide `tsc`/vitest gate but is owned by no plan — has been swept exhaustively for
all three changed contracts and **no unowned consumer remains**. There are **no HIGH-severity
findings this cycle**. The only remaining items are two MEDIUM task-level verification-command gaps
(a task can be marked done without running its own load-bearing test, though the phase-level gate
still catches it) and two LOW Plan-02 bookkeeping/clarity nits.

The orchestrator independently re-derived the orphaned-consumer sweep on disk and confirms both
reviewers' verdicts:

- **TAB_ICON** — only two consumers exist: `src/components/icons/icon-registry.test.ts`
  (asserts `TAB_ICON.BackupTab` at `:100` + the `Object.keys(TAB_ICON)` four-key parity at `:108-110`)
  and `src/navigation/RootNavigator.tsx:207`. Both owned by Plan 01 (Task 1 step 5 rewrites the test
  to the five-key set and drops `.BackupTab`; acceptance greps `! TAB_ICON.BackupTab` / `! "BackupTab"`).
  Plan 01 deliberately PRESERVES the internal `DashboardTab` route id (only the visible title becomes
  "Contacts"), so the `"DashboardTab"` string references in `universal-fab-logic.test.ts`,
  `reset-intents.test.ts`, and `notification-gate.test.tsx` do NOT break. The stale `"BackupTab"`
  string at `universal-fab-logic.test.ts:156` feeds `getFocusedContactContext(NavigationStateNode)`
  whose `routes[].name` is typed `string` (not `keyof TabParamList`), so it is neither a tsc error
  nor a runtime failure (a non-Profile route name still yields `originContactId: null`).
- **TARGET_VERSION** — only three files pin the literal `29`: `full-chain.test.ts:87` (+ head-filter
  `:85`), `029-ai-configuration.test.ts:22`, and the `category-identity-audit.test.ts:223` meta-guard.
  All owned by Plan 02 (step g + step 3b). The remaining `TARGET_VERSION` assertions
  (`027-…test:24`, `028-…test:23`, `profile-presentation.test:41`) use `toBeGreaterThanOrEqual` and
  stay green at 30; the ~80 files that merely import `TARGET_VERSION` to migrate-to-head are
  additive-safe.
- **BACKUP_FORMAT_VERSION** — every format-6 assertion is owned by Plan 02:
  `category-identity-audit.test.ts` (`:224`), `orrery-preferences-portability.test.ts:151`,
  `orrery-exploration.integration.test.ts:608`, `backup-service.test.ts`, `export-manifest.test.ts`
  (`:115,:176` — listed in Plan 02 `<files>` line 214 + Task 3 step 5 + verify), `backup-schema.test.ts`
  (relative `+1`).

The `category-identity-audit.test.ts:215-225` meta-guard is the subtlest consumer: all four of its
assertions break under this phase (`TARGET_VERSION = AI_CONFIGURATION_SCHEMA_VERSION` expr,
`.not.toMatch(/migration030/)`, the `toBe(29)` string pin, and `BACKUP_FORMAT_VERSION = 6`). Plan 02
step 3b-i names "~4 assertions" and lists the `= 6` / `AI_CONFIGURATION_SCHEMA_VERSION` literals in
its grep list, and correctly pre-empts the decision-reversal worry: loosening this no-schema-change
guard is authorized by owner-ruling D-08, not a reversal.

### Agreed Strengths
- Migration 030 is the correct next free number (registry head is `029-ai-configuration.ts` at
  `database.ts:70`; no `030` file on disk) and `TARGET_VERSION` 29->30 is right. (both reviewers)
- The `TAB_ICON` / `TARGET_VERSION` / `BACKUP_FORMAT_VERSION` orphaned-consumer sweep is complete —
  every breaking old-shape consumer is owned by a plan. (both reviewers)
- D-08 (yourWeekPeriod portable + format 6->7 + FORWARD_MIGRATIONS[6]), D-09 (Settings row +
  in-context toggle + focus-time re-read), and D-10 (shared not-contacted population includes
  opted-in unbound contacts, with a documented, bounded Contacts-tab blast radius) are implemented
  correctly and not re-litigated. (both reviewers)
- Preserving the internal `DashboardTab` id while removing `BackupTab` (RESEARCH Pitfall 1) protects
  the FAB's hardcoded `navigate("DashboardTab", …)` target and every stale-string test consumer.
  (both reviewers)
- The `app-settings-dao.ts` writer contract is real: the generic writer iterates
  `Object.keys(COLUMN_OF)` at `:1486-1489` (no `KEY_TO_COLUMN` exists), so Plan 02's full
  `yourWeekPeriod` threading is necessary and its line refs are accurate. (both reviewers)
- The atomic both-axes drill-through (`setPopulationsAndFilters`, Plan 06) is correctly modeled on
  the existing `resetDashboardView` precedent and fixes a real stale-axis desync. (both reviewers)
- Plan 07's render-free shell-contract regression test is the right strategy given the node-only
  `vitest.config.ts` (no react-test-renderer on disk). (both reviewers)

### Agreed Concerns
- None at HIGH. The two reviewers raise disjoint non-HIGH items (see below); neither reviewer
  contradicts the other's findings.

### Divergent Views
- The reviewers surfaced different, non-overlapping actionable items rather than disagreeing: Codex
  focused on task-level verification-command gaps in Plans 05 and 06 (MEDIUM); the Claude subagent
  focused on Plan 02 frontmatter/edit-boundary bookkeeping (LOW). The orchestrator verified all four
  on disk and holds all four as valid and actionable.

### Actionable items this cycle (all disk-verified by the orchestrator)
1. **MEDIUM (codex) — Plan 05 Task 3 `<verify>` omits its load-bearing controller test.** The
   automated command at `38-05-PLAN.md:159` runs only `YourWeekSection.test.tsx`, but the task's
   acceptance (`:167`) makes `your-week-section-logic.test.ts` the proof of the generation guard,
   persist-reject rollback, and selected-day invalidation. The plan-level aggregate (`:248`
   `npx vitest run src/components/digest`) does catch it, but the task commit can be declared done
   without running its own proof. **Fix:** add `src/components/digest/your-week-section-logic.test.ts`
   to Task 3's `<automated>` command.
2. **MEDIUM (codex) — Plan 06 Task 2 `<verify>` omits its load-bearing store test.** The automated
   command at `38-06-PLAN.md:147` runs only `HorizonSection.test.tsx`, but Task 2 changes the
   persisted Zustand store and its acceptance (`:154`) / `<done>` (`:160`) require a
   `dashboard-query-store.test.ts` case proving both axes are written in one `updateAppSettings`
   with one generation bump. No Plan-06 vitest command includes `src/stores/` (the plan aggregate at
   `:246` is `src/components/digest src/screens/DigestScreen.test.tsx`), so the store test runs only
   at Plan 07's full-suite gate — not at the task or plan that introduces the behavior. **Fix:** add
   `src/stores/dashboard-query-store.test.ts` to Task 2's `<automated>` command.
3. **LOW (claude) — Plan 02 frontmatter `files_modified` is incomplete vs. its task bodies.** The
   frontmatter (`38-02-PLAN.md:7-19`) omits `src/backup/backup-schema.test.ts`,
   `src/backup/export-manifest.test.ts`, and `src/db/app-settings-dao.test.ts`, although all three are
   owned/edited by Task 2/3 (`<files>` line 214, step 5 line 241, verify line 353). Bookkeeping only —
   Plan 02 is the sole wave-1 owner of these files, so no wave collision is missed — but it feeds the
   SUMMARY changed-file list. **Fix:** add the three test files to the `38-02` frontmatter.
4. **LOW (claude) — Plan 02 step 3b-v under-specifies the `029-ai-configuration.test.ts` edit
   boundary.** `029-ai-configuration.test.ts:21` (`expect(AI_CONFIGURATION_SCHEMA_VERSION).toBe(29)`)
   is permanently correct and must be PRESERVED; only `:22` (`expect(TARGET_VERSION).toBe(29)`) moves
   to 30. Step 3b-v targets the right line ("~:22") and the "read each file first" instruction largely
   mitigates it, but a one-line note removes all ambiguity. **Fix:** add to step 3b-v a note that only
   the `TARGET_VERSION` pin at `:22` changes and the `AI_CONFIGURATION_SCHEMA_VERSION` assertion at
   `:21` stays 29.

No new finding deletes, weakens, or inverts a recorded ADR / HANDOFF / dossier decision. The one
guard being loosened (the `category-identity-audit` no-schema-change boundary) is explicitly
authorized by owner-ruling D-08 and flagged as such in Plan 02 — it is not a hidden reversal.

---

## Codex Review

<!-- Codex gpt-5.6-sol (reasoning=low); source-grounded; full adversarial pass, all 7 plans fresh. -->

# Phase 38 Cycle-7 Adversarial Review

## Executive summary

The seven plans are implementation-ready overall. The migration number is correct, D-08/D-09/D-10 are represented accurately, and the recurring orphaned-test-consumer problem is now covered for `TAB_ICON`, `TARGET_VERSION`, and `BACKUP_FORMAT_VERSION`.

I found no HIGH-severity issue and no unowned old-shape consumer. Two MEDIUM verification gaps remain:

1. Plan 05's task-level command does not run the newly extracted state-controller test that proves stale-read suppression and persistence rollback.
2. Plan 06's task-level command does not run the dashboard-store test despite changing the store's atomic persistence boundary.

Overall risk: MEDIUM-LOW.

---

## Plan 38-01 — Five-tab shell and semantic routing

### Summary

The plan correctly identifies the structural navigation changes and accounts for the most failure-prone consequences of removing `BackupTab`: icon-registry parity, share-intent routing, shared-backup consumption, stale route types, and Profile-reachable child routes.

### Strengths

- The current shell is genuinely four-tab, defaults to Dashboard, and registers Backup as a tab at `src/navigation/RootNavigator.tsx:190`. The proposed five-tab replacement addresses the actual implementation.
- Preserving the internal `DashboardTab` identifier is necessary because every FAB navigation intent targets it at `src/components/universal-fab-logic.ts:82`.
- Removing the Backup tab without changing the consumer would break shared restore: Settings currently passes the non-consuming host, while `shouldConsumeSharedBackup` only accepts `"backup-tab"` at `src/screens/backup-dualhome-logic.ts:51`, and `BackupScreen` exits before consumption at `src/screens/BackupScreen.tsx:268`. The plan explicitly repairs this.
- `consumeSharedBackup()` is safe with no pending item: the native bridge returns the nullable result of `SharedBackupCoordinator.consume()` at `OrbitBackupDocumentPickerModule.kt:89`.
- The known `TAB_ICON` old-shape consumer is owned by this plan: `src/components/icons/icon-registry.test.ts:96` currently asserts `BackupTab` and the four-key set.
- The expanded Profile route inventory follows the existing Orrery precedent, which registers `RecentlyDeleted`, history routes, Group Event routes, Compose, crop, and merge routes at `src/navigation/tabs/OrreryStack.tsx:56`.
- The plan correctly retains the stale Dashboard route types temporarily until notification routing is repointed. The live notification intent still returns `[Home, Digest]` at `src/services/notifications/notification-nav.ts:76`.

### Concerns

None material.

### Suggestions

- Retain the exact runtime-descriptor test strategy. It is appropriate for the node-only Vitest configuration at `vitest.config.ts:4`.
- During execution, make the route-name-to-component registry exhaustiveness check a compile-time `satisfies` relationship where practical, rather than relying only on a runtime assertion.

### Risk assessment

LOW. The plan is large, but its high-risk cross-links are explicitly owned and tested.

---

## Plan 38-02 — Your Week data, migration 030, and backup format 7

### Summary

The schema and portability plan is technically sound. Migration 030 is the correct next step, and the plan properly treats settings persistence, backup emission, forward migration, and parsing validation as one coordinated change.

### Strengths

- Migration 030 is the correct next free number. The registered chain ends at migration 029 at `src/db/database.ts:70`, and the migration directory contains no 030 file.
- The plan correctly uses the migration runner for the v1 fixture. The runner owns `PRAGMA user_version`; directly applying migration 001 would not establish version 1.
- The real settings writer iterates `COLUMN_OF`, not a hypothetical alternate map, at `src/db/app-settings-dao.ts:1481`. The proposed full wiring is necessary.
- The portable snapshot already emits the formerly deferred Phase 23–36 keys at `src/db/app-settings-dao.ts:888`, validating D-08's decision to use the landed emission policy rather than the stale comments.
- Backup parsing requires an unbroken migration step for every version. The current registry ends at `5 → 6` at `src/backup/backup-schema.ts:33`, so adding `FORWARD_MIGRATIONS[6]` is mandatory.
- Parse-boundary validation is the correct layer. Restore casts the accepted wire data to the settings patch, so a shared `assertYourWeekPeriod` prevents malformed external input from reaching SQLite.
- The activity-unit distinction is coherent with storage: Group Event parents live separately, while child interactions link through `group_event_id` added at `src/db/migrations/026-group-events-schema.ts:17`.
- The migration-head and backup-format old-shape consumers are all assigned:
  - `src/db/migrations/full-chain.test.ts:85`
  - `src/db/migrations/029-ai-configuration.test.ts:19`
  - `src/category-identity-audit.test.ts:215`
  - `src/backup/backup-schema.test.ts:368`
  - `src/backup/export-manifest.test.ts:101`
  - `src/backup/orrery-preferences-portability.test.ts:146`
  - `src/services/orrery-exploration.integration.test.ts:596`
  - `src/services/backup/backup-service.test.ts:166`

### Concerns

None material.

### Suggestions

- Update the description/name of the migration-029 test when adjusting its head assertions. Its own constant should remain 29, while build-head and final `user_version` assertions advance to 30.
- Keep the checkpoint narrowly mechanical as written; D-08 itself must not be reopened.

### Risk assessment

MEDIUM because it contains two irreversible compatibility changes, not because the plan is deficient.

---

## Plan 38-03 — Up Next and Horizon composition

### Summary

The plan correctly reuses canonical status logic, constrains Up Next to the existing attention population, and implements D-10 at the shared population-query boundary.

### Strengths

- The canonical attention predicate is exactly `progress >= STABLE_MAX` plus active-snooze exclusion at `src/logic/dashboard-query-logic.ts:173`. Reusing it avoids a Digest-only urgency definition.
- The cadence precondition is explicitly defined at `src/db/status.ts:61`, and the plan includes it.
- `REASON_SQL` is nullable for wobble/decay at `src/db/status.ts:80`; assigning presentation fallback to Plan 06 is the correct separation.
- D-10 is implemented at the right seam. `listDashboardPopulation()` obtains its SQL from `buildPopulationWhere()` at `src/db/dashboard-read.ts:310`, so changing the exact `["not-contacted"]` branch aligns preview and drill without creating a second read definition.
- The intended comparison query is concrete: `countNeverContacted()` includes opted-in unbound contacts at `src/db/dashboard-read.ts:539`.
- `readOverlooked()` currently omits snooze filtering at `src/db/digest-read.ts:102`; adding the canonical snooze predicate is a real consistency correction.
- The birthday plan correctly avoids the existing 30-day population filter at `src/db/dashboard-read.ts:300`.

### Concerns

None material.

### Suggestions

- Keep the exact-selection limitation for D-10 under test. Mixed populations intentionally retain the existing bound-only scope.
- Include a test where the unbound flag is toggled between reads to prove the scalar subquery is evaluated dynamically and not cached in composition state.

### Risk assessment

LOW.

---

## Plan 38-04 — Notification routing, header cleanup, FAB, and overflow routing

### Summary

The plan closes the important semantic leftovers from promotion: notification routing, dead in-stack routes, cross-tab overflow navigation, and FAB contact context.

### Strengths

- The current digest resolver returns a Dashboard-stack reset at `src/services/notifications/notification-nav.ts:76`, so a distinct Digest-tab intent is required.
- The notification gate currently funnels all resolved routes through `resetToDashboardWith()` at `src/navigation/notification-gate.tsx:129`; the proposed branch is necessary.
- The existing stale-request guard is real: navigation is suppressed when `isCurrent()` fails at `src/navigation/notification-gate.tsx:140`. The plan preserves and tests it.
- The Contacts overflow currently calls the removed local route directly at `src/screens/dashboard-overflow-actions.ts:20`. A dedicated `openEvents()` callback is better typed than widening the single-argument local navigation API.
- The actual caller currently passes stack navigation directly at `src/screens/HomeScreen.tsx:1464`; obtaining the tab parent is therefore necessary.
- The FAB's profile context currently recognizes only Dashboard and Orrery at `src/components/universal-fab-logic.ts:135`. Adding Digest and Events fixes a real behavior gap.
- The plan owns the stale FAB test that still lists `BackupTab`.

### Concerns

None material.

### Suggestions

- In the notification test, explicitly cover "slow contact lookup → newer Digest tap" as well as contact-to-contact races. That is the branch boundary most likely to regress during the refactor.
- Keep the failed-parent lookup path in `HomeScreen` non-throwing as planned.

### Risk assessment

LOW.

---

## Plan 38-05 — Your Week presentation and Settings row

### Summary

The component decomposition and D-09 implementation are good. The extracted pure controller is the right response to the node-only test environment. One task-level verification command still fails to exercise that controller.

### Strengths

- The repo's tests are explicitly node-only and render-free at `vitest.config.ts:4`. Extracting the period state machine into a pure `.ts` controller is appropriate.
- The existing render-free component-test idiom is real: tests mock hooks/native modules and walk returned React elements at `src/components/orrery/orrery-controls-render.test.tsx:11`.
- The existing Settings screen already reloads settings on focus at `src/screens/SettingsInteractionsScreen.tsx:59`, exactly matching D-09's focus-time synchronization.
- Its generic persistence path writes through `updateAppSettings()` and reloads after success at `src/screens/SettingsInteractionsScreen.tsx:73`.
- The heatmap plan correctly avoids `buckets()` for pre-aggregated `{d,n}` data and reuses only level/classification/theme primitives.
- Future-cell non-interactivity follows the existing History behavior and prevents meaningless day-detail selection.

### Concerns

- **MEDIUM — Task 3's automated verification does not run the new controller test.** The action makes `your-week-section-logic.test.ts` the proof for stale-generation rejection, rollback, and selected-day invalidation, but its `<verify>` command runs only `YourWeekSection.test.tsx`. The plan-level aggregate command eventually catches it, but the task's own commit can be declared done without executing its load-bearing test.

### Suggestions

Change Task 3's automated command to include both suites:

```bash
npx vitest run \
  src/components/digest/your-week-section-logic.test.ts \
  src/components/digest/YourWeekSection.test.tsx
```

Also add `SettingsInteractionsScreen.test.tsx` and all newly created component test files to the plan frontmatter's `files_modified` inventory for accurate ownership reporting.

### Risk assessment

MEDIUM until the task-level verification command is corrected; LOW afterward.

---

## Plan 38-06 — Digest assembly and drill-through

### Summary

The assembly plan is coherent and correctly treats Dashboard query state as the durable drill-through boundary. The principal issue is another task-level test omission for the new atomic store action.

### Strengths

- The store currently persists populations and filters independently at `src/stores/dashboard-query-store.ts:92`, while Contacts AND-composes those axes at `src/db/dashboard-read.ts:399`. The proposed atomic two-axis action fixes a real stale-axis defect.
- `resetDashboardView()` is an appropriate pattern: it persists multiple axes in one settings update and performs one generation bump at `src/stores/dashboard-query-store.ts:116`.
- The Overlooked drill correctly uses the canonical needs-attention filter because the population vocabulary has no rogue/overlooked token.
- The plan accurately distinguishes the honest numeric Never Contacted overflow from the broader nonnumeric attention drill.
- Using a compact `Avatar + ringVisual` row is correct. The DAO row does not satisfy the full Dashboard `ContactCard` contract.
- The screen removes the obsolete tab-root Back control and dead `navigate("Home")` path.
- Awaiting persistence before cross-tab navigation prevents Contacts from briefly loading the previous query state.

### Concerns

- **MEDIUM — Task 2 changes the persisted Zustand store but its automated command omits `dashboard-query-store.test.ts`.** The task requires proof that both axes are written in one `updateAppSettings` call with one generation bump, yet its `<verify>` runs only `HorizonSection.test.tsx`, TypeScript, and the color check. The plan-level aggregate suite catches this later, but the state-boundary task lacks its own required gate.

### Suggestions

Change Task 2 verification to run both:

```bash
npx vitest run \
  src/components/digest/HorizonSection.test.tsx \
  src/stores/dashboard-query-store.test.ts
```

The task should also explicitly test rejection ordering: failed `setPopulationsAndFilters()` must leave both in-memory axes unchanged and must not invoke navigation.

### Risk assessment

MEDIUM until the store test is included in the task gate; LOW afterward.

---

## Plan 38-07 — Regression gate and physical-device UAT

### Summary

The plan appropriately separates render-free structural assertions from physical navigation behavior. The device precondition, fixture policy, PASS/FAIL/BLOCKED reporting, and Metro remap are unusually thorough and match the repository's device rules.

### Strengths

- The runtime descriptor approach is correct because `TabParamList` erases at runtime and the repo has no mounted-navigation test harness.
- Runtime `TAB_ICON` parity is testable and catches divergence between the descriptor and icon registry.
- Initial focus, reselect-to-root, and origin-aware traversal are correctly assigned to device UAT rather than falsely claimed by a source scan.
- The owner-confirmation precondition is required by the repository instructions; setting `autonomous: false` is consistent.
- The explicit `8081 → 8082` remap prevents Orbit from connecting to the other project's Metro instance.
- The fixture plan prefers canonical DAOs and treats unverifiable raw SQL state as BLOCKED rather than PASS.
- The repair loop respects plan ownership and prevents cross-cutting fixes from being silently folded into the verification plan.
- Offline UAT directly verifies the local-first read-path promise.

### Concerns

None material.

### Suggestions

- Record the exact Metro command and tmux pane/session in the UAT summary alongside the package and device serial.
- For notification UAT, record whether the app was cold, warm-backgrounded, or foregrounded; at least cold and warm-background routing should be exercised because the gate has distinct paths.

### Risk assessment

LOW for the plan itself. Execution remains operationally demanding because physical hardware and fixtures are mandatory.

---

# Cross-cutting review (Codex)

## Orphaned test consumers

### `TAB_ICON`

Current old-shape consumers:

- `src/components/icons/icon-registry.test.ts:96` — owned by Plan 01.
- `src/components/universal-fab-logic.test.ts:152` contains the old root-tab set — owned by Plan 04.
- Runtime use at `src/navigation/RootNavigator.tsx:205` — owned by Plan 01.

Verdict: no orphan.

### `TARGET_VERSION`

Hard old-head assertions:

- `src/db/migrations/full-chain.test.ts:85` — owned by Plan 02 Task 2.
- `src/db/migrations/029-ai-configuration.test.ts:19` — owned by Plan 02 Task 3.
- `src/category-identity-audit.test.ts:215` — owned by Plan 02 Task 3.

Other consumers use the imported current target dynamically or assert a lower bound, so they do not require edits.

Verdict: no orphan.

### `BACKUP_FORMAT_VERSION`

Hard format-6 assertions appear in: `backup-schema.test.ts`, `export-manifest.test.ts`, `orrery-preferences-portability.test.ts`, `orrery-exploration.integration.test.ts`, `backup-service.test.ts`, `category-identity-audit.test.ts`. All are assigned to Plan 02.

Verdict: no orphan.

## Migration numbering

The live chain ends at migration 029 and version 29 at `src/db/database.ts:52`. No migration 030 exists. The proposed number is correct.

## Decision compliance

- D-08: correctly emits `yourWeekPeriod`, validates it, bumps format 6→7, and adds `6→7` forward migration.
- D-09: correctly provides both Settings and Digest surfaces with focus-time re-read.
- D-10: correctly changes the shared exact not-contacted population, including the documented Contacts-tab blast radius, while leaving other populations unchanged.
- No other ADR/HANDOFF reversal was identified.

## Final risk assessment (Codex)

**Overall: MEDIUM-LOW.** The plans achieve the phase goal and have closed the repeated structural failures from prior cycles. There are no remaining HIGH findings and no orphaned old-shape consumer. Before execution, update the two task-level verification commands in Plans 05 and 06 so their newly introduced state-boundary tests run at the commit where those behaviors are implemented.

---

## Claude Review

<!-- Read-only Claude subagent (general-purpose; default subagent model); source-grounded; full adversarial pass, all 7 plans fresh. Ran as a subagent because the `claude -p` CLI lane fails on a Write-permission gap inside Claude Code (recorded workaround). -->

# Phase 38 Cross-AI Re-Review (Claude lane) — Full Fresh Pass

Reviewed all 7 plans against actual code on disk (not plan text in isolation). Re-derived the orphaned-test-consumer sweep from scratch for all three changed symbols (TAB_ICON, TARGET_VERSION, BACKUP_FORMAT_VERSION), re-verified migration numbering, and traced every load-bearing mechanism (COLUMN_OF writer, D-10 population scoping, backup consumer, drill-through store atomicity).

## Verification highlights (disk-confirmed)

**Migration numbering — CORRECT.** `src/db/migrations/` head is `029-ai-configuration.ts`; `TARGET_VERSION = AI_CONFIGURATION_SCHEMA_VERSION` (=29) at `database.ts:67`. 024 is absent (historical gap), so 030 is the correct next free number and 29→30 is right. (`database.ts:71-99` MIGRATIONS list ends at migration029.)

**Orphaned test-consumer sweep — COMPLETE, all consumers owned.**
- **TAB_ICON:** only two consumers exist — `icon-registry.test.ts` (`:98-113`, incl. `.BackupTab` at `:100` and `Object.keys(TAB_ICON)` parity at `:108`) and `RootNavigator.tsx:207`. Both owned by Plan 01 (Task 1 step 5 + step 6). No third consumer.
- **BACKUP_FORMAT_VERSION / format-6 literals:** every format-6 assertion file is owned by Plan 02 — `category-identity-audit.test.ts` (`:215,:223,:224`), `orrery-preferences-portability.test.ts` (`:151-152`), `orrery-exploration.integration.test.ts:608`, `backup-service.test.ts` (`:174,:203`), `export-manifest.test.ts` (`:34,:83,:115-116,:176,:434`), `backup-schema.test.ts` (`:378,:402,:423`). No unowned format consumer.
- **TARGET_VERSION exact-value assertions:** only three files pin a literal — `category-identity-audit.test.ts:223`, `029-ai-configuration.test.ts:22`, `full-chain.test.ts:87` (+ head-filter `:85`). All owned by Plan 02 (step 3b + step g). The other TARGET_VERSION assertions (`027:24`, `028:23`, `profile-presentation:41`) use `toBeGreaterThanOrEqual`, which stay green at 30. The ~80 files that merely import TARGET_VERSION to run migrations-to-head are additive-safe (migration030 is additive).
- **New-emitted-key vector (subtle):** adding the newly-emitted `yourWeekPeriod` to the portable snapshot does NOT break shape assertions — every snapshot assertion found uses `toMatchObject` (partial): `app-settings-dao.test.ts:477,:672`, `orrery-preferences-portability.test.ts:153`, `export-manifest.test.ts`. No `toEqual`/`toStrictEqual`/key-count assertion on the snapshot exists. Confirmed safe.

**The `category-identity-audit.test.ts:215-225` meta-guard.** All four assertions break (the `TARGET_VERSION = AI_CONFIGURATION_SCHEMA_VERSION` expr → YOUR_WEEK; `.not.toMatch(/migration030/)` → now matches; the full-chain string pin `toBe(29)`→`(30)`; `BACKUP_FORMAT_VERSION = 6`→`7`). Plan 02 step 3b-i names "~4 assertions" and the `= 6`/`AI_CONFIGURATION_SCHEMA_VERSION` literals in its grep list, and correctly pre-empts the decision-reversal worry (D-08 owner-ruling ratifies the migration, so updating this no-schema-change guard is authorized, not a reversal). Covered.

**COLUMN_OF writer contract (Plan 02 cycle-2 fix) — every line ref accurate.** `COLUMN_OF` exists at `app-settings-dao.ts:692`; generic writer iterates `Object.keys(COLUMN_OF)` at `:1486-1489`; no `KEY_TO_COLUMN` exists. All 7 threading points verified: AppSettings `:315`, PortableSettingsSnapshot `:472`, WritableSettingsKey `:531/:570`, AppSettingsRow `:619`, COLUMN_OF `:731`, validator `:1341`, getAppSettings SELECT/return `:776/:841`, snapshot `:960/:1013`. The `historyLens` analog is emitted post-Phase-36 exactly as claimed.

**D-10 population scoping — sound and correctly bounded.** `buildPopulationWhere` (`dashboard-query-logic.ts:248`) wraps every predicate in `DASHBOARD_POPULATION_SCOPE_WHERE` (`tracking_enabled = 1`, `:219`). The `['not-contacted']`-exact guard is implementable and `countNeverContacted`'s predicate (`dashboard-read.ts:540-553`) matches. Verified no undocumented blast radius: `all-contacts` stays bound-only (scope wrapper); mixed selections skip the branch; the **widget uses `populations:["favourites"]`** (`widget-data.ts:94`) so it's unaffected; orrery/systems reads consume `DASHBOARD_POPULATION_SCOPE_WHERE` **directly** (not the builder), so no leak. The remaining `composePopulationRead` consumers (`listDashboardSearch:430`, `searchEligible:479`) are search-within-the-selected-population — a natural sub-case of the documented Contacts-tab blast radius. D-10's "no other population broadened" claim holds.

**Other mechanisms confirmed:** `shouldConsumeSharedBackup` returns true only for `"backup-tab"` (`backup-dualhome-logic.ts:59`) — Plan 01 7a's fix is valid; `linking.ts:67` `navigate("BackupTab",…)` confirmed (Plan 01 repoint correct); `dashboard-overflow-actions.ts` single-arg `navigate` interface + `navigate("GroupEvents")` confirmed (crash-after-Plan-01 claim valid, `openEvents` fix sound); store `setPopulations`/`setFilters` each write one axis, `resetDashboardView` writes both atomically (Plan 06 `setPopulationsAndFilters` precedent valid); `ringVisual` re-exported at `ContactCard.tsx:49`; `getFocusedContactContext` checks only DashboardTab/OrreryTab (`universal-fab-logic.ts:140`); `GroupEventsScreen` `title="Group Events"` at `:72`; status.ts symbols (`STABLE_MAX:40`, `PROGRESS_SQL:59`, precondition `:62`) accurate. Wave-1 plans (01/02/03) have disjoint file sets; depends_on chains are correct.

## Per-plan summary

- **Plan 01 (shell):** Strong. Orphaned `icon-registry.test.ts` owned; backup-consume-after-tab-removal (7a) is a real, correctly-diagnosed defect with a sound fix. No concern.
- **Plan 02 (data/migration/backup):** Strongest-grounded plan; all cycle-2 hallucination corrections verified against disk. One LOW frontmatter nit (below).
- **Plan 03 (Up Next/Horizon logic + D-10):** D-10 mechanism correct and correctly scoped; snooze guard on readOverlooked valid. No concern.
- **Plan 04 (notification/FAB/overflow):** Overflow crash + stale param-list + cross-tab `getParent()` all accurate. No concern.
- **Plan 05 (Your Week presentation):** buckets()-avoidance and render-free controller extraction well-specified. No concern.
- **Plan 06 (Digest assembly):** Atomic both-axes drill-through correctly modeled on `resetDashboardView`; D-10 count==preview==drill equivalence test specified. No concern.
- **Plan 07 (regression gate + UAT):** Render-free shell-contract test is correct given no react-test-renderer on disk; repair loop and BLOCKED policy sound. No concern.

## Concerns

**LOW — Plan 02 frontmatter `files_modified` is incomplete vs. its task bodies.** The frontmatter list (`38-02-PLAN.md:7-19`) omits `src/backup/backup-schema.test.ts`, `src/backup/export-manifest.test.ts`, and `src/db/app-settings-dao.test.ts`, although all three are owned and edited by Task 2/3 (`<files>`, action step 5, and the verify commands run them). Mechanism: `files_modified` feeds wave-collision detection and the SUMMARY's changed-file list. Not a build risk here (Plan 02 is the sole wave-1 owner of the backup/app-settings tests; no collision is missed in practice), purely a bookkeeping inconsistency. PLAN.md change: add those three test files to the `38-02` frontmatter `files_modified`.

**LOW — Plan 02 step 3b-v under-specifies the `029-ai-configuration.test.ts` edit boundary.** Line 21 (`expect(AI_CONFIGURATION_SCHEMA_VERSION).toBe(29)`) is legitimately correct and must be PRESERVED; only line 22 (`expect(TARGET_VERSION).toBe(29)`) moves to 30 (or `toBeGreaterThanOrEqual`). The plan's "~:22 head/version pin" targets the right line and the acceptance says "Read each file first and grep the exact pinned literals," so this is already mitigated — but a one-line clarification ("do not touch the `AI_CONFIGURATION_SCHEMA_VERSION` assertion at `:21`; only the `TARGET_VERSION` pin at `:22`") would remove all ambiguity. PLAN.md change: optional clarifying note in step 3b-v.

## Risk

Low. The plan set is exceptionally well-grounded — line references are accurate, the recurring orphaned-test-consumer failure mode has been swept exhaustively and every breaking consumer of all three changed symbols is owned by a plan, and the owner rulings D-08/D-09/D-10 are implemented (not re-litigated) with their blast radii documented. No decision-reversal is hidden as a bug fix (the one guard being loosened — the category-identity no-schema-change boundary — is explicitly authorized by owner-ruling D-08 and flagged as such in the plan).

**HIGH CONCERNS (unresolved):** None.

**ACTIONABLE NON-HIGH (unresolved):**
- LOW — Add `src/backup/backup-schema.test.ts`, `src/backup/export-manifest.test.ts`, and `src/db/app-settings-dao.test.ts` to the `38-02-PLAN.md` frontmatter `files_modified` list (owned/edited by Task 2/3 but omitted from frontmatter; bookkeeping only, no build risk).
- LOW — In `38-02-PLAN.md` step 3b-v, add a one-line note that `029-ai-configuration.test.ts:21` (`AI_CONFIGURATION_SCHEMA_VERSION).toBe(29)`) must be preserved and only the `TARGET_VERSION` pin at `:22` changes (prevents an over-edit; already partially mitigated by the "read each file first" instruction).
