---
phase: 38
reviewers: [codex, claude]
reviewed_at: 2026-09-19T03:34:12Z
review_kind: full-adversarial
convergence_cycle: 6
plans_reviewed: [38-01-PLAN.md, 38-02-PLAN.md, 38-03-PLAN.md, 38-04-PLAN.md, 38-05-PLAN.md, 38-06-PLAN.md, 38-07-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=high)"
  claude: "claude read-only subagent (general-purpose; default subagent model)"
model_sources:
  codex: "banner"
  claude: "subagent"
cycle_summary: current_high=2 current_actionable=4
notes: >
  Cycle-6 FULL adversarial re-review of the current committed plans (HEAD includes the cycle-4
  inline fixes 364bd55 and the wording-residual fixes 623579a). NOT scoped to any prior finding
  list — all 7 plans reviewed fresh. The `claude` lane ran as a READ-ONLY Claude subagent (not the
  `claude -p` CLI lane, which fails on a Write-permission gap inside Claude Code — recorded
  workaround). Codex ran gpt-5.6-sol at HIGH reasoning effort (not the default LOW review-lane
  effort). Both reviewers were source-grounded; the orchestrator independently re-verified EVERY
  load-bearing claim against the code on disk per "review the code, not the diff," including a
  comprehensive orphaned-test-consumer sweep for every consumer of the changing contracts
  (TAB_ICON keys, TARGET_VERSION==29, BACKUP_FORMAT_VERSION==6). Phase 38 is NOT yet executed
  (git log shows only `docs(38):` commits; tree clean).

  OUTCOME — the phase did NOT converge clean. The two cycle-5 residuals (Plan 02 "staged" wording,
  Plan 06 Overlooked numeric-overflow copy) ARE resolved on disk by 623579a (orchestrator-verified).
  BUT the fresh adversarial pass surfaced TWO NEW HIGH build-breakers — both the recurring
  "orphaned test-consumer build-breaker" pattern that prior cycles thought fully closed: a DIFFERENT
  orphaned consumer was missed by each of Plan 01 and Plan 02. Plus 4 actionable non-HIGH items.
  No new finding reverses an ADR/HANDOFF/dossier decision; D-08/D-09/D-10 are implemented correctly.
---

# Cross-AI Plan Review — Phase 38 (Digest & Navigation Restructure) — FULL ADVERSARIAL (cycle 6)

## Consensus Summary

Both reviewers (Codex gpt-5.6-sol @ high; a read-only Claude subagent) independently find the seven
plans **directionally strong and exceptionally well source-grounded** — but **NOT ready to execute
unchanged**. The prior-cycle hallucination classes are gone (no `KEY_TO_COLUMN`; `COLUMN_OF` is the
real writer map; the v1-jump migration fixture is correctly runner-driven), the two cycle-5 residual
wording items are resolved on disk (623579a), and D-08/D-09/D-10 are implemented against the exact
symbols they cite. **No new finding reverses any recorded ADR/HANDOFF/dossier decision, so there is
no owner-escalation trigger.**

The fresh pass surfaced **two NEW HIGH-severity defects, each the same "orphaned test-consumer
build-breaker" pattern the phase already knows how to fix** — but each reviewer caught a DIFFERENT
missed file, and the orchestrator's independent full-corpus sweep confirms these are the only two:

- **Claude found:** Plan 01 re-keys `TAB_ICON` but does not own `src/components/icons/icon-registry.test.ts`.
- **Codex found:** Plan 02 bumps `TARGET_VERSION` 29→30 but does not own `src/db/migrations/full-chain.test.ts`.

Neither reviewer caught the other's HIGH — a textbook illustration of why cross-AI review earns its
cost. The orchestrator disk-verified both, ran a comprehensive sweep of every consumer of the
changing contracts, and confirms these two files are the ONLY unowned breakers (the backup-format
pins in `backup-schema.test.ts`/`export-manifest.test.ts` ARE covered by Plan 02 Task 3 step (5); the
`toBeGreaterThan(0)`/v1-fixture references in `phase-17-integration.test.ts`/`backup-restore-logic.test.ts`
do not break; `universal-fab-logic.test.ts`'s `BackupTab` string is untyped and non-breaking).

**Totals: 2 unresolved HIGH · 4 actionable non-HIGH · 0 decision reversals.**

### Agreed Strengths (2+ reviewers, disk-verified)
- **The one-way-door data-layer work is airtight.** D-08's premise is disk-true: `getPortableSettingsSnapshot`
  (`src/db/app-settings-dao.ts`) already emits the formerly-deferred Phase-36 keys (`history_lens` :960/:1013,
  `theme_package` :995, `dashboard_view_mode` :1002, `default_interaction_channel` :1015, `default_message_mode`
  :1019), so the "emission-deferred" comments (`:435-489`) are genuinely stale and Plan 02 correctly follows the
  landed emit-and-bump policy. Migration 030 is the correct next head (registry ends at 029; `runner.ts:38-67`
  owns the version bump in-transaction). BACKUP_FORMAT_VERSION 6→7 is the right trigger.
- **The v1-jump migration fixture is correct.** `runMigrations(...,targetVersion=1,...)` sets `PRAGMA user_version=1`;
  `001-initial.ts:42` `CREATE TABLE categories` has no `IF NOT EXISTS`, so a bare `migration001.apply()` would
  leave version 0 and re-throw "table already exists" on the next full run. Both reviewers verified the runner
  semantics (`runner.ts:38-61`).
- **D-10 is mechanically sound for its scope.** `buildPopulationWhere` (`dashboard-query-logic.ts:248-283`) special-cases
  exactly `['not-contacted']` and returns the SAME predicate `countNeverContacted` uses (`dashboard-read.ts:543-551`),
  so for all three D-10-named surfaces (Digest preview, Digest drill, Contacts-tab not-contacted selection — all
  singleton `['not-contacted']` reads) count == preview == drill genuinely holds. No other population is broadened.
- **Plan 01's shared Android document-picker transfer is correct and framed as a role reassignment, not a reversal.**
  `backup-dualhome-logic.ts:58-60` returns true only for `"backup-tab"` today; the native consume is a safe no-op
  when nothing is staged (`OrbitBackupDocumentPickerModule.kt:40-43,89-91`).
- **Group-event aggregation matches the real normalized model** (one parent + child interaction rows; `group-events-dao.ts:317-376`),
  and the navigation work uses an appropriate render-free seam (`vitest.config.ts` is node-env; `shell-contract.ts` is a
  pure const module asserted by a render-free test, not a mounted NavigationContainer).

### Agreed Concerns
Neither HIGH was raised by BOTH reviewers (they are complementary — see Divergent Views). At the
MEDIUM/LOW level both reviewers independently flag the **stale post-repoint Backup comments**
(Codex: `SettingsStack.tsx:151-158,202-205`; Claude: `backup-dualhome-logic.ts:54`, `BackupScreen.tsx:271`)
as a bounded doc-sync Plan 01 should own but currently does not.

### Divergent Views (reconciled against disk)

- **Plan 01 `icon-registry.test.ts` HIGH — raised by Claude, MISSED by Codex; orchestrator CONFIRMS.**
  Plan 01 Task 1 step (5) (`38-01-PLAN.md:127`) re-keys `TAB_ICON` (removes `BackupTab`, adds `DigestTab`/`EventsTab`).
  `TAB_ICON` is typed `Record<keyof TabParamList, IconName>` (`icon-registry.ts:107`) and `tsconfig.json` has NO
  `exclude`, so `**/*.ts` typechecks the test. `icon-registry.test.ts:100` asserts `TAB_ICON.BackupTab` → **TS2339
  under `strict:true`**, so Plan 01 cannot pass its own `npx tsc --noEmit` gate (`:134`,`:147`). Worse, `:108-110`
  pins `Object.keys(TAB_ICON).sort()` to the OLD 4-key set — a **runtime-only** failure tsc does not catch, and
  Plan 01's test verify is `npx vitest run src/navigation`, which does NOT cover `src/components/icons/`, so it
  surfaces only at Plan 07's wave-4 full `vitest run`. The file is owned by NO plan (grep count 0). This is exactly
  the pattern Plan 02's cycle-4 HIGH fixed for the version bumps; Plan 01 must symmetrically own it.

- **Plan 02 `full-chain.test.ts` HIGH — raised by Codex, MISSED by Claude; orchestrator CONFIRMS.**
  `full-chain.test.ts:87` asserts `expect(TARGET_VERSION).toBe(29)`. Plan 02 bumps `TARGET_VERSION` to 30, RUNS this
  test in Task 2's own verify (`38-02-PLAN.md:193`) and the final gate (`:350`), but the file is in neither
  `files_modified` (`:8-19`) nor Task 3's five enumerated orphaned consumers (step (3b), `:242`), and no task updates
  the `29` pin. Task 2's atomic commit is therefore guaranteed to fail. (`:85`'s `version === 29` filter does NOT
  break — there is still exactly one v29; only the `:87` head pin does. The new 030-migration test is separate and
  correctly built.) Codex also notes full-chain should gain a `your_week_period` default/column expectation.

- **Plan 03 D-10 "mixed-selection" concern — raised by Codex as HIGH; orchestrator downgrades to a
  NON-BLOCKING owner-awareness note, NOT counted.** Codex argues Plan 03's widening only for EXACTLY
  `['not-contacted']` (`38-03-PLAN.md:169`, deliberate & documented) breaks OR-union monotonicity: with the opt-in
  flag ON, `['favourites','not-contacted']` EXCLUDES the opted-in unbound never-contacted contact that `['not-contacted']`
  alone INCLUDES. The mechanic is real (the global `DASHBOARD_POPULATION_SCOPE_WHERE` `tracking_enabled=1` AND-wrapper,
  `dashboard-query-logic.ts:280`, filters unbound rows before the OR-union), the OR-union multi-select contract is real
  and tested (`dashboard-query-logic.test.ts:101`, `dashboard-read.test.ts:221`), and the multi-select UI path is real
  (`PopulationPanelContent.tsx:26` `togglePopulation`/`includes`). **However, this is NOT a D-10 mis-implementation:**
  D-10 as owner-ruled (and as restated in CONTEXT `:73-90`) is explicitly scoped to the shared
  `listDashboardPopulation(['not-contacted'])` SINGLETON read that all three named surfaces issue, and states it "does
  NOT broaden any other population" with minimal blast radius. The plan implements exactly that. Codex's proposed fix
  (widen the not-contacted ARM in every selection) would make unbound contacts appear in MORE contexts than the owner's
  ruling contemplated — arguably a broadening beyond D-10, not an enforcement of it. Per the review's D-10 rule ("only
  flag if implemented incorrectly"), this is not counted. **Surfaced for owner awareness:** whether mixed selections
  should also be unbound-inclusive is a genuine scope question the owner did not rule on; if desired it is a NEW
  decision, not a plan bug.

---

## Codex Review

> Model: gpt-5.6-sol (reasoning=high). Source-grounded; every claim independently re-verified against disk by the orchestrator. (Codex's incidental path label `src/navigation/icon-registry.ts` is actually `src/components/icons/icon-registry.ts`; the cited content matches.)

# Summary

The seven-plan sequence is directionally strong and mostly grounded in the repository's real seams, but it is **not ready to execute unchanged**. Two HIGH-severity defects remain: Plan 02 does not own the mandatory full-chain migration-version update and therefore cannot pass its own verification after introducing migration 030; and Plan 03 implements D-10 only for an exact singleton selection, breaking the established OR-union semantics when `not-contacted` is selected with another population.

Two MEDIUM-severity issues weaken verification and device UAT: Plan 04 repeatedly targets a nonexistent `.test.ts` file while the real notification-gate suite is `.test.tsx`, and Plan 07's prescribed Metro port remap contradicts the runbook it calls authoritative. The remaining findings are LOW-severity stale source/plan documentation that should be cleaned before execution.

I found no new proposal that should reverse an ADR, `HANDOFF.md`, or dossier decision. The D-10 concern below is an implementation correction required to honor that owner ruling, not a request to revisit it. The proposed widening remains confined to the `not-contacted` arm and is compatible with ADR-062's proactive bound/unbound lifecycle plus D-10's explicit extension.

# Strengths

- **The migration number and forward-only shape are correct.** The current registry ends at migration 029 and derives `TARGET_VERSION` from that entry (`src/db/database.ts:25-56`, `src/db/database.ts:67-100`; `src/db/migrations/029-ai-configuration.ts:15-18`). The runner applies each missing version in order inside a transaction (`src/db/migrations/runner.ts:38-67`). A new additive migration 030 is therefore the correct mechanism for D-08.
- **D-08 is traced through the actual portable-settings path.** Plan 02 covers the DAO field, snapshot parsing, writable-column map, backup schema/export/restore, and backup version pins (`.planning/phases/38-your-week/38-02-PLAN.md:157-190`, `:232-250`). The live DAO derives the patch type from portable settings and validates writes through an explicit column map (`src/db/app-settings-dao.ts:505-508`, `:531-584`, `:692-725`, `:1474-1525`), while restore passes the parsed settings object into the DAO (`src/backup/restore-apply.ts:1582-1597`).
- **The navigation work uses an appropriate render-free seam** (`vitest.config.ts:4-15`; `src/components/icons/icon-registry.ts:107-112`; `38-01-PLAN.md:123-128,166-183`).
- **The group-event aggregation design matches the real normalized model** (`src/db/group-events-dao.ts:317-376`; `38-02-PLAN.md:269-280`) — the right invariant after checking the create, edit, detach, dissolve, delete, conversion, restore, and purge writers.
- **Plan 01 correctly addresses the shared Android document-picker consumer** (`src/screens/backup-dualhome-logic.ts:51-60`; `38-01-PLAN.md:130`; native no-op `OrbitBackupDocumentPickerModule.kt:40-43,89-91`).
- **The plans generally preserve the chosen architecture** — Plan 05 computes the heatmap from raw range rows; Plan 06 adds one atomic two-axis dashboard action instead of composing stale independent setter snapshots.

# Concerns

## HIGH — Plan 02 omits the full-chain version update, so migration 030 cannot pass its own task gate

Plan 02 Task 2 changes `TARGET_VERSION` by registering migration 030, but its owned file list does not include the test that pins the chain head (`38-02-PLAN.md:157`). The live test explicitly requires version 29 (`src/db/migrations/full-chain.test.ts:85-87`). Task 2 then runs that very test (`38-02-PLAN.md:193`), so the task's atomic commit is guaranteed to fail once `TARGET_VERSION` becomes 30. The omission persists in Task 3: its list of five "orphaned consumers" does not include the full-chain test (`:232-242`). The plan's final gate runs the test again (`:350`), but no task owns the required edit.

**Required correction:** add `src/db/migrations/full-chain.test.ts` to Plan 02 Task 2 and the plan-level `files_modified`; update the head assertion to 30 and add the new `your_week_period` default/schema expectation there. This is necessary to implement D-08 correctly and does not reopen D-08.

*(Orchestrator: CONFIRMED. `full-chain.test.ts:87` = `expect(TARGET_VERSION).toBe(29)`; run at `:193` and `:350`; absent from `files_modified` `:8-19` and Task 3 step (3b) `:242`. `:85`'s `version === 29` filter does NOT break. The comprehensive sweep found no other unowned breaker.)*

## HIGH — Plan 03 violates D-10 for mixed population selections

Plan 03 widens eligibility only when the population selection is **exactly** `['not-contacted']`, retaining the old bound-only scope whenever `not-contacted` appears in a mixed selection (`38-03-PLAN.md:169-181`). The current builder applies one global bound scope before OR-combining selected predicates (`dashboard-query-logic.ts:218-220,248-283`); the established contract is an OR-union (`dashboard-query-logic.test.ts:101-109`), with a DB regression covering `['favourites','not-contacted']` (`dashboard-read.test.ts:221-252`). Under the exact-only special case, an opted-in unbound never-contacted person appears for `['not-contacted']` and disappears merely because the user also selects `favourites` — making the `not-contacted` arm's meaning depend on an unrelated sibling arm. Implementable without widening any other population: retain the global archived/active guard, scope bound eligibility to the ordinary predicates, and OR it with the D-10 opted-in-unbound/not-contacted predicate.

*(Orchestrator: mechanic CONFIRMED and multi-select IS a real UI path. DOWNGRADED to a non-blocking owner-awareness note, NOT counted — see Divergent Views. D-10 as owner-ruled is scoped to the singleton read; the plan implements that correctly, and Codex's fix would broaden beyond the ruling. Whether mixed selections should widen is a new scope question, not a D-10 mis-implementation.)*

## MEDIUM — Plan 04's notification verification targets a nonexistent test file

Plan 04 runs `src/navigation/notification-gate.test.ts` in Task 1 and the final gate (`38-04-PLAN.md:99`, `:234`). The real file is `src/navigation/notification-gate.test.tsx` (`:76-131` holds the stale-request/concurrency regression the plan intends to preserve). The acceptance text acknowledges `.tsx` (`:106`) and the review ledger claims the verify command was corrected (`:205`), but both executable commands remain `.test.ts`. Because Vitest is configured with `passWithNoTests: true` (`vitest.config.ts:14-15`) and those commands include other valid files, the intended notification suite can be **silently skipped while the command still succeeds**.

**Required correction:** change both command paths to `.test.tsx` and remove the contradictory "already fixed" ledger claim.

*(Orchestrator: CONFIRMED. Only `notification-gate.test.tsx` exists; `:99` and `:234` say `.test.ts`; `:106` claims the command targets `.tsx`; ledger `:205` falsely says "already correct"; `passWithNoTests: true` at `vitest.config.ts:15`.)*

## MEDIUM — Plan 07's required Metro remap contradicts its authoritative runbook

Plan 07 mandates a `device:8081 -> host:8082` remap (`38-07-PLAN.md:59`), then says the authoritative runbook contains that same remap (`:105`). It does not — the runbook starts Expo on the default host port 8081 and prescribes `adb reverse tcp:8081 tcp:8081` (`docs/runbooks/desktop-build-pipeline.md:166-179`). Following the runbook could connect Orbit to the other project's Metro; following only the plan without starting Metro explicitly on 8082 could leave the device with no bundle.

**Required correction:** establish one authoritative sequence — if 8082 is the owner-approved Orbit port, update the runbook or spell out both halves in Plan 07 (Metro on 8082 and `adb reverse tcp:8081 tcp:8082`), while retaining the owner-confirmation and target-cardinality checks.

*(Orchestrator: CONFIRMED. Runbook §2 `:178-179` = `expo start` 8081 + `adb reverse tcp:8081 tcp:8081`; no 8082. The 8082 remap itself is a real recorded operational detail — the defect is the false attribution at `:105`. Plan 07 `:59` DOES carry the correct instruction, so this is a doc-consistency contradiction, not a missing instruction.)*

## LOW — Stale execution-facing prose contradicts the plans' actual behavior

- Plan 01 transfers document-picker consumption to Settings (`38-01-PLAN.md:130`), but `SettingsStack.tsx:151-158,202-205` still says the Settings copy must not drain and the Backup tab is the sole consumer. Plan 01 references this file but does not own a comment update.
- Plan 07 first claims the validation matrix still has template placeholders, then says it is already populated (`38-07-PLAN.md:81-85`). The matrix IS populated (`38-VALIDATION.md:16-17`) but still describes the shell contract as a "rendered navigator" test (`:68`), contrary to Plan 07's render-free design.
- Plan 07's review ledger says Task 1 renders the navigator and that the objective was corrected to `.test.tsx`, though the task is render-free and consistently creates `.test.ts` (`38-07-PLAN.md:157,163-165`).

*(Orchestrator: CONFIRMED as real, disk-verified stale prose likely to misdirect an executor.)*

# Suggestions

1. Own and update `full-chain.test.ts` in the same atomic commit that registers migration 030; keep the category-identity pin synchronized in Task 3.
2. (Owner-awareness) Decide whether Plan 03's D-10 widening should extend to mixed selections; if yes, rewrite around per-population eligibility with mixed-selection regressions for both flag states.
3. Correct Plan 04's two notification-gate paths to `.tsx`; do not rely on a broad final gate to compensate for an invalid task-local command.
4. Reconcile the Metro port instructions with the runbook before Plan 07 execution.
5. Refresh the SettingsStack ownership comments and Plan 07 validation/review prose.

# Risk Assessment

**Overall risk: HIGH until the two HIGH findings are corrected.** The migration omission is deterministic (Plan 02's own gate fails after the bump). *(Orchestrator note: the Plan 03 D-10 item, which Codex rated the second HIGH, is downgraded to a non-blocking owner-awareness note; the orchestrator's own second HIGH is the Plan 01 `icon-registry.test.ts` orphan Codex did not catch.)* After corrections, implementation risk drops to MEDIUM; the architecture is cohesive, the storage change is additive, and the UI work has testable pure seams.

---

## Claude Review

> Model: read-only Claude subagent (general-purpose; the `claude -p` CLI lane is skipped for independence and fails on a Write-permission gap — recorded workaround). Source-grounded; every load-bearing claim re-verified against disk by the orchestrator.

## Summary

These seven Phase 38 plans are exceptionally well source-grounded. Essentially every load-bearing `file:line` claim across all seven held — migration head (029→030), `BACKUP_FORMAT_VERSION = 6`, the *absence* of `KEY_TO_COLUMN`, the real `COLUMN_OF` writer contract, the `getPortableSettingsSnapshot` Phase-36 emissions that underpin D-08, the `countNeverContacted` predicate D-10 must match, `buildPopulationWhere`, the single-axis `setPopulations`/`setFilters` vs both-axis `resetDashboardView`, the `runner.ts`/`001-initial.ts` interplay behind the v1-fixture fix, the five orphaned test-consumers of the version bumps, and the navigation anchors — all held. The prior-cycle hallucination classes are gone. D-08/D-09/D-10 are correctly implemented against the code they cite. I found **one genuine actionable HIGH**: Plan 01 re-keys `TAB_ICON` but does not own the test file that pins the old key set, which breaks the tsc gate and defers a runtime-assertion break to the wave-4 full gate — the exact orphaned-test-consumer pattern Plan 02 explicitly guards against but Plan 01 does not.

## Strengths

- **The data-layer / one-way-door work is airtight.** D-08's premise is disk-true: `getPortableSettingsSnapshot` already emits `history_lens` (`app-settings-dao.ts:960`/`:1013`), `theme_package` (`:995`), `dashboard_view_mode` (`:1002`), `default_interaction_channel` (`:1015`), `default_message_mode` (`:1019`), so the "emission-deferred" comments (`:435-489`) are genuinely stale, and the writer contract (`COLUMN_OF:692`, iterated `:1486-1489`; `validateAppSettingsPatch:1270`; restore cast `restore-apply.ts:1589-1592`) is described exactly.
- **D-10 is mechanically sound.** `countNeverContacted` (`dashboard-read.ts:540-553`) uses precisely the predicate the plan quotes; `buildPopulationWhere` (`dashboard-query-logic.ts:248-283`) can special-case `['not-contacted']` as an early return; and `applyPopulationPostProcessing` (`dashboard-read.ts:336-364`) does nothing that would drop unbound rows — so count == preview == drill genuinely holds. `listDashboardPopulation`'s no-cap signature (`:380`) is correctly described.
- **The v1-fixture cycle-4 fix is correct.** `runner.ts:38-61` owns the `PRAGMA user_version` bump; `001-initial.ts:42` `CREATE TABLE categories` has no `IF NOT EXISTS`; `full-chain.test.ts:15-22` starts at v0 — so a bare `migration001.apply()` really would leave `user_version=0` and re-throw.
- **All five orphaned test-consumers of the version bumps are real and correctly located:** `category-identity-audit.test.ts:223`, `orrery-preferences-portability.test.ts:151`, `orrery-exploration.integration.test.ts:608`, `backup-service.test.ts:174/:203`, `029-ai-configuration.test.ts:21-22/:28`. Plan 02 owns each and broadens its verify to run them in-wave.
- **Navigation anchors are precise:** `linking.ts:67/:71`, `backup-dualhome-logic.ts:58-59` (returns true only for `"backup-tab"`), `GroupEventsScreen.tsx:72`, `OrreryStack.tsx:18/:64` (`RecentlyDeleted`), the stale `types.ts:255-262` Backup comment and `:146-153` Digest comment. Wave 1's three plans are file-disjoint.

## Concerns

- **HIGH — `src/components/icons/icon-registry.test.ts` is an orphaned test-consumer of the old `TAB_ICON` key set, owned by no plan; it breaks Plan 01's own tsc gate and defers a runtime-assertion break to Plan 07's wave-4 full run.** Plan 01 re-keys `TAB_ICON` (removes `BackupTab`, adds `DigestTab`/`EventsTab`) in `icon-registry.ts`, but `icon-registry.test.ts:100` asserts `TAB_ICON.BackupTab).toBe("backup")` and `:108-110` asserts `Object.keys(TAB_ICON).sort()` equals `["BackupTab","DashboardTab","OrreryTab","SettingsTab"]`. Since `TAB_ICON` is `Record<keyof TabParamList, IconName>` and `tsconfig.json:12-14` typechecks `**/*.ts`, the `.BackupTab` access at `:100` becomes a **TS2339 project-wide tsc error** — so Plan 01 cannot pass its own `npx tsc --noEmit` verify, and `icon-registry.test.ts` is absent from Plan 01's `files_modified`/`<files>` and from every plan (grep count 0). Worse, the exact-key `Object.keys` assertion at `:110` is a runtime-only failure tsc does not catch, and Plan 01's test verify is `npx vitest run src/navigation` — which does not run `src/components/icons/` — so a green-looking Plan 01 (tsc patched ad hoc) still leaves `:110` red until Plan 07's full `npx vitest run`. This is precisely the "orphaned test-consumer build-breaker" pattern Plan 02's cycle-4 HIGH addresses for the version bumps; Plan 01 should symmetrically add `icon-registry.test.ts` to its `files_modified`/`<files>` and update `:98-113` in the same commit as the `TAB_ICON` re-key.

- **LOW — residual stale `BackupTab` comments left behind after the deep-link repoint.** `src/screens/BackupScreen.tsx:271` ("linking.ts routes a shared backup to BackupTab › Backup") and `src/screens/backup-dualhome-logic.ts:54` ("share-intent gate routes a shared backup to `BackupTab › Backup`") both become false once Plan 01 repoints the deep link to `SettingsTab`. Plan 01 edits `backup-dualhome-logic.ts` (step 7a refreshes the `:18` comment) but does not mention `:54`; `BackupScreen.tsx` is only in `read_first`.

- **LOW — `src/navigation/tabs/BackupStack.tsx` becomes an orphaned module after tab removal.** Imported only by `RootNavigator.tsx:20/:235`; once Plan 01 removes the `BackupTab` `Tab.Screen` and its import, nothing references `BackupStack` (the Settings dual-home uses `SettingsStack.tsx:206`). Not a tsc error (dead file), but the plans never note it.

- **LOW — `universal-fab-logic.test.ts:156` carries a now-meaningless `"BackupTab"` browse-surface fixture.** Stale test data (still passes, untyped strings). Plan 04 owns and extends this file, so clean it when Plan 04 adds the `DigestTab`/`EventsTab` cases.

## Suggestions

- Add `src/components/icons/icon-registry.test.ts` to Plan 01 Task 1's `<files>`/`files_modified`, with a step to update `:98-113` to the new five-key set (`DashboardTab`,`EventsTab`,`DigestTab`,`OrreryTab`,`SettingsTab`), and broaden Plan 01's Task-1 verify to include `npx vitest run src/components/icons/icon-registry.test.ts` so the `Object.keys` break is caught in-wave. Mirrors Plan 02 Task 3 step (3b).
- While editing `backup-dualhome-logic.ts` (step 7a), refresh the `:54` comment and add `BackupScreen.tsx:271` to the bounded doc-sync.
- Optionally note that `BackupStack.tsx` is left orphaned (delete-or-keep is an owner/scope call).

## Risk Assessment

**LOW–MEDIUM.** The substantive engineering is correct and precisely grounded, and D-08/D-09/D-10 are implemented against the exact symbols they cite. No new finding proposes reversing any decision. The one HIGH is a contained file-ownership/wave-gating omission of the same class the phase already knows how to fix; it surfaces as a hard tsc failure during Plan 01 execution and, if patched ad hoc, a red assertion at the Plan 07 gate — annoying and cycle-costing, but not silent and not data-affecting.

---

## Orchestrator Verification Note

Per "review the code, not the diff," the orchestrator independently opened every load-bearing file
and ran a comprehensive orphaned-consumer sweep. Findings:

- **Both HIGHs CONFIRMED on disk** (`icon-registry.test.ts:100,108-110` + `Record<keyof TabParamList,IconName>` at
  `icon-registry.ts:107` + no `tsconfig` exclude; `full-chain.test.ts:87` run at `38-02-PLAN.md:193,350`, unowned).
- **Sweep result:** the ONLY unowned test-consumers that break are those two. `backup-schema.test.ts`
  (`toBe(6)` ×3) and `export-manifest.test.ts` (`toBe(6)` ×several) ARE covered by Plan 02 Task 3 step (5)
  ("update the existing export-manifest/backup-schema version assertions from 6 to 7") + the `src/backup/` verify.
  `phase-17-integration.test.ts:99` (`toBeGreaterThan(0)`) and `backup-restore-logic.test.ts:17` (v1-fixture input)
  do not break. `universal-fab-logic.test.ts`'s `BackupTab` is an untyped string (Plan 04-owned; non-breaking LOW).
- **Cycle-5 residuals RESOLVED by 623579a:** Plan 02 `:134/:141/:151` no longer say "staged" (now "PROPOSED"/"specified
  mechanics"); Plan 06 Overlooked references `:32/:148/:157` now correctly use the non-numeric affordance with numeric
  `+{n} more →` reserved for Never Contacted.
- **D-08/D-09/D-10 implemented correctly; no decision reversal in any new finding.**

Actionable tally: **2 HIGH** (Plan 01 icon-registry.test.ts; Plan 02 full-chain.test.ts) · **4 non-HIGH**
(Plan 04 test path; Plan 07 Metro/runbook attribution; Plan 01 stale post-repoint comments; Plan 07
VALIDATION render-free contradiction + self-contradiction). Plan 03 D-10 mixed-selection is surfaced for
owner awareness but not counted (correct per the ruled D-10 scope).
