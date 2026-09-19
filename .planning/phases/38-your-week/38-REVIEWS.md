---
phase: 38
reviewers: [codex, claude]
reviewed_at: 2026-09-19T02:54:49Z
review_kind: confirmation
convergence_cycle: 5
plans_reviewed: [38-01-PLAN.md, 38-02-PLAN.md, 38-03-PLAN.md, 38-04-PLAN.md, 38-05-PLAN.md, 38-06-PLAN.md, 38-07-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=low)"
  claude: "sonnet"
model_sources:
  codex: "banner"
  claude: "subagent-override"
cycle_summary: current_high=0 current_actionable=2
notes: >
  Cycle-5 CONFIRMATION pass after cycle-4's 3 HIGH + 8 actionable were applied INLINE
  (commit 364bd55). The `claude` lane ran as a READ-ONLY Claude subagent (model sonnet),
  not the `claude -p` CLI lane, because that lane fails on a Write-permission gap inside
  Claude Code (recorded workaround). Both reviewers were source-grounded and verified
  claims against the code on disk. Phase 38 is NOT yet executed (git log shows only
  `docs(38):` commits, tree clean) — so "confirmed" means the fix text is correctly
  inlined into the plan artifacts AND the plan's premises about present-day code are
  accurate. The orchestrator independently re-verified every reviewer claim below against
  the code on disk per the project's "review the code, not the diff" rule.
---

# Cross-AI Plan Review — Phase 38 (Digest & Navigation Restructure) — CONFIRMATION (cycle 5)

## Consensus Summary

Both reviewers (codex gpt-5.6-sol; a read-only Claude/sonnet subagent) independently confirm,
against the code on disk, that **all 3 cycle-4 HIGH fixes and all 8 cycle-4 actionable fixes are
present in the plan artifacts and rest on accurate premises about the current code**. No
hallucinated symbols recurred (the cycle-2 `KEY_TO_COLUMN` class of error is gone — `COLUMN_OF`
is the real writer map at `src/db/app-settings-dao.ts:692,1486-1489`). No recorded ADR / HANDOFF /
dossier decision is reversed, and the D-08 / D-09 / D-10 owner rulings are implemented, not
re-litigated.

The two reviewers **diverge on two of the eight actionable items**, and the orchestrator's
own disk verification sides with codex: the *core corrective language* for the Plan 02 checkpoint
rewording and the Plan 06 non-numeric Overlooked affordance did land, but **stale contradictory
copy survives elsewhere in the same two documents** and could mislead a sequential executor or
the checkpoint owner. Claude marked both CONFIRMED because it checked the corrected lines only;
codex checked for residual contradictions and found them; the orchestrator opened the files and
confirmed the residual wording is real. These are the only two unresolved items — both are
documentation-consistency defects inside the plans, not code or design defects.

**Confirmation totals: 3/3 HIGH confirmed · 6/8 actionable fully confirmed · 2/8 actionable PARTIAL (residual stale wording).**

### Agreed Strengths (2+ reviewers, disk-verified)
- **HIGH-1 (Plan 01) — Settings-hosted Backup consumes the shared singleton.** After `BackupTab`
  removal the surviving `host="settings"` copy is made the consumer. Current defect verified:
  `shouldConsumeSharedBackup` returns true only for `"backup-tab"`
  (`src/screens/backup-dualhome-logic.ts:58-60`); `BackupScreen.tsx:274` early-returns before
  `consumeSharedBackup()` for other hosts. Plan 01 step (7a) (`38-01-PLAN.md:130`) flips it for the
  surviving host, repoints the `linking.ts:67` share-intent deep link `BackupTab`→`SettingsTab`
  (step 7), refreshes the now-inverted `:18` comment, keeps the origin-aware return target, and adds
  a `backup-dualhome-logic.test.ts` case proving the restore path drains the singleton
  (verify `38-01-PLAN.md:145-146`). No-op safety of `consumeSharedBackup()` when nothing is staged
  confirmed against native code (`OrbitBackupDocumentPickerModule.kt` — nullable/idempotent consume).
  Explicitly framed as reassigning the Phase-37 dual-home consumer role, **not** a decision reversal.
- **HIGH-2 (Plan 02) — v1-jump migration fixture built via the runner.** Plan mandates
  `runMigrations(..., targetVersion=1, ...)` (which sets `PRAGMA user_version=1`) and bans a bare
  `migration001.apply()` (`38-02-PLAN.md:176,204`). Premise verified: the runner owns the version
  bump (`runner.ts:38-45` reads `user_version` defaulting to 0; `:56-61` bumps it per step), and
  `001-initial.ts:42` uses bare `CREATE TABLE` (no `IF NOT EXISTS`) — so a bare apply would leave
  version 0 and the next full `runMigrations` would re-apply 001 → "table already exists".
- **HIGH-3 (Plan 02) — version bump updates the five orphaned test-consumers.** `TARGET_VERSION`
  29→30 (`AI_CONFIGURATION_SCHEMA_VERSION=29` on disk) and `BACKUP_FORMAT_VERSION` 6→7
  (`src/backup/types.ts:14` = 6). All five files exist and are genuine pin consumers
  (`029-ai-configuration.test.ts:20-21` asserts `.toBe(29)`; `category-identity-audit.test.ts:214-224`
  pins `expect(TARGET_VERSION).toBe(29)` + format 6; the three backup tests pin format/version 6).
  All five are in Plan 02 `files_modified` (`:15-19`) and Task 3 `<files>` (`:212`), updated in step
  (3b) (`:237`) with a read-first-grep instruction and a broadened verify (`:242,252`).
- **Actionable — Plan 05 controller seam** (`your-week-section-logic.ts`) with render-free tests for
  generation-guard/rollback/day-invalidation, and a **file-agnostic Settings grep**
  (`grep -rl 'yourWeekPeriod' src/screens/ | xargs grep -l 'updateAppSettings'`). Both confirmed.
- **Actionable — Plan 06 drill-through** awaits the atomic `setPopulationsAndFilters` write and only
  navigates on resolve; on rejection it stays on Digest with a non-fatal error. Confirmed
  (`38-06-PLAN.md:144`), atop the real split-write boundary in `dashboard-query-store.ts`.
- **Actionable — Plan 04 `openEvents`** via typed
  `getParent<BottomTabNavigationProp<TabParamList>>()` with a fail-closed no-op + dev warning.
  Confirmed (`38-04-PLAN.md:173`).
- **Actionable — Plan 07** `<verification>` reworded to explicit PASS/FAIL/BLOCKED (no inferred/all-PASS
  claim, BLOCKED prevents closure) and DEV-only-seeder-preferred fixtures with a documented raw-SQL
  fallback. Confirmed (`38-07-PLAN.md:113,133,189,114,167`).
- **D-10 implemented correctly (spot-check).** The unbound-inclusive relaxation is scoped to the exact
  `['not-contacted']` selection only and reuses `countNeverContacted`'s predicate verbatim
  (`src/db/dashboard-read.ts:543-550`); no other population is broadened. No escalation needed.

### Agreed Concerns
None at HIGH or MEDIUM that both reviewers raise. The two actionable PARTIALs below were raised by
codex and confirmed on disk by the orchestrator; Claude did not flag them.

### Divergent Views (reconciled against disk — orchestrator sides with codex)
- **Plan 02 checkpoint rewording — PARTIAL (codex) vs CONFIRMED (claude).** The `<decision>` at
  `38-02-PLAN.md:131` is correctly reworded ("the changes are not yet staged … NOT an inspection of a
  staged diff"), **but three downstream references still say "staged"**: the `<context>` at `:134`
  ("a human must SEE the exact staged changes before they land"), the confirmed-option name at `:141`
  ("the staged mechanics match the ratified spec"), and the resume-signal at `:151` ("if the staged
  mechanics match"). Because this checkpoint runs BEFORE Tasks 2–3, nothing is staged when the owner
  hits it — the residual "staged" wording contradicts the corrected framing. **Disk-verified real.**
- **Plan 06 non-numeric Overlooked affordance — PARTIAL (codex) vs CONFIRMED (claude).** The action
  (`38-06-PLAN.md:140`) and one must-have (`:31`) correctly reserve `+{n} more →` for Never Contacted
  and give Overlooked the non-numeric "See everyone needing attention →". **But three sibling
  references still attach numeric overflow to Overlooked**: the general must-have at `:32` ("large
  Overlooked / Never Contacted populations use a compact preview + `+{n} more →`"), the human-check at
  `:148` ("a large Overlooked population shows a compact preview + `+N more →`"), and the acceptance
  bullet at `:157` (discusses the `+{n} more →` copy for the Overlooked drill). A sequential executor
  could implement the correct non-numeric affordance and then "fix" it back to satisfy the stale
  human-check / acceptance. **Disk-verified real.**

---

## Codex Review

> Model: gpt-5.6-sol (reasoning=low). Source-grounded; claims verified against disk by the orchestrator.

## Summary

The three cycle-4 HIGH fixes are correctly incorporated into the execution plans and grounded in the current source. Of the eight actionable fixes, six are fully confirmed and two are partial because stale contradictory wording remains. Overall: **9 confirmed, 2 partial, 0 missing**. No owner ruling or recorded architecture decision is reversed.

## Confirmation table

| Fix | Status | Evidence and mechanism |
|---|---|---|
| Plan 01: Settings-hosted Backup consumes shared restore | **CONFIRMED** | Current behavior is exactly the reported defect: `backup-dualhome-logic.ts:52` permits only `"backup-tab"`, while `BackupScreen.tsx:268` returns before consumption for other hosts. Plan 01 now owns both logic and test files and explicitly changes the surviving Settings host into the consumer at `38-01-PLAN.md:130`, with positive acceptance coverage at line 146. The native consumer safely returns a nullable URI from an empty coordinator at `OrbitBackupDocumentPickerModule.kt:89`. |
| Plan 02: v1 migration fixture uses the runner | **CONFIRMED** | `runMigrations` reads `user_version` and applies every later migration at `runner.ts:38`, then sets `PRAGMA user_version` inside the transaction at lines 56–61. Migration 001 uses bare `CREATE TABLE` at `001-initial.ts:41`, confirming direct application followed by a version-0 runner would reapply it. Plan 02 now mandates `runMigrations(..., targetVersion=1, ...)` before advancing to 30 at `38-02-PLAN.md:176`, reinforced by acceptance at line 204. |
| Plan 02: five orphaned version consumers updated | **CONFIRMED** | All five files exist and currently contain the pins the version bump will invalidate: `category-identity-audit.test.ts:215`, `orrery-preferences-portability.test.ts:151`, `orrery-exploration.integration.test.ts:608`, `backup-service.test.ts:174`, `029-ai-configuration.test.ts:20`. All five are in Plan 02's top-level ownership list at `38-02-PLAN.md:15`, Task 3 explicitly updates them at line 237, and the broadened verification command includes them at line 242. |
| Plan 02: checkpoint is pre-implementation mechanics confirmation | **PARTIAL** | The checkpoint remains correctly typed `checkpoint:decision` and its principal decision text now says changes are "not yet staged" at `38-02-PLAN.md:131`. However, the following context still requires the owner to "SEE the exact staged changes" at line 134, the confirmed option says "staged mechanics" at line 141, and the resume signal repeats that phrase at line 151. |
| Plan 05: pure Your Week state-controller seam | **CONFIRMED** | The controller and its test are explicitly owned by Task 3 at `38-05-PLAN.md:143`. The action defines pure transitions for generation rejection, persistence rollback, and selected-day invalidation at line 156; acceptance requires render-free tests for each at line 167. This matches the repository's node-only, render-free test configuration at `vitest.config.ts:4`. |
| Plan 05: Settings acceptance is file-agnostic | **CONFIRMED** | The action retains the dossier-approved relocation discretion at `38-05-PLAN.md:185`. Acceptance now searches all `src/screens/` for a Settings screen that both references `yourWeekPeriod` and calls `updateAppSettings`, rather than pinning a filename, at line 192. |
| Plan 06: non-numeric Overlooked affordance | **PARTIAL** | The primary implementation direction correctly reserves numeric overflow for Never Contacted and requires "See everyone needing attention →" for Overlooked at `38-06-PLAN.md:140`. However, stale text remains: the general must-have still assigns `+{n} more` to both populations at line 32, the human check still expects Overlooked `"+N more →"` at line 148, and acceptance line 157 still discusses that numeric copy. |
| Plan 06: await persistence; stay on Digest after rejection | **CONFIRMED** | Plan 06 explicitly requires awaiting `setPopulationsAndFilters`, navigating only after resolution, and suppressing navigation with a non-fatal error after rejection at `38-06-PLAN.md:144`. This addresses the real current split-write boundary: existing `setPopulations` and `setFilters` write independently at `dashboard-query-store.ts:92`, while `resetDashboardView` demonstrates the intended atomic multi-key pattern at line 116. |
| Plan 04: typed parent navigator and fail-closed `openEvents` | **CONFIRMED** | Current code proves the mismatch: the pure builder accepts only a single local route argument at `dashboard-overflow-actions.ts:3`, and `HomeScreen` passes its stack navigation directly at `HomeScreen.tsx:1464`. Plan 04 now requires `navigation.getParent<BottomTabNavigationProp<TabParamList>>()`, then `parent?.navigate("EventsTab", {screen:"GroupEvents"})`, with no-op/dev warning when no parent exists, at `38-04-PLAN.md:173`. |
| Plan 07: PASS/FAIL/BLOCKED verification language | **CONFIRMED** | Task 2 requires explicit three-state recording with no inferred pass at `38-07-PLAN.md:113`. Acceptance repeats this at line 133, while the final verification now states that a mandatory BLOCKED item prevents closure unless waived at line 189. |
| Plan 07: prefer canonical DEV seeder | **CONFIRMED** | The fixture procedure prefers a DEV-only seeder through canonical DAOs and permits raw SQL only with documented rows and verified FKs, participant linkage, recency, and derived counts at `38-07-PLAN.md:114`. Unverifiable fixtures become BLOCKED rather than inferred success. |

## Concerns

### MEDIUM — Plan 02 checkpoint still describes nonexistent staged changes
The checkpoint's leading sentence is corrected, but its context, option label, and resume signal still instruct the owner to inspect "staged" mechanics even though Tasks 2–3 have not run: `38-02-PLAN.md:134`, line 141, and line 151. Those should consistently say "specified/proposed mechanics."

### MEDIUM — Plan 06 still contains conflicting numeric-overflow instructions
The implementation action correctly requires non-numeric Overlooked copy, but the must-have, human check, and acceptance text still expect or discuss `+N more` for Overlooked: `38-06-PLAN.md:32`, `38-06-PLAN.md:148`, and line 157. A sequential executor or UAT operator could implement the correct behavior and then "fix" it back to satisfy the stale check.

No new code-level concern or decision reversal was found beyond those two documentation inconsistencies.

## Risk Assessment
**MEDIUM.** All three HIGH fixes are source-grounded and correctly assigned, and six of eight actionable fixes are complete. The remaining risk is limited to contradictory plan instructions, but both contradictions occur at execution/checkpoint boundaries where they could directly mislead the executor or owner. After those two wording cleanups, the plans are suitable for a low-risk confirmation closure.

---

## Claude Review

> Model: sonnet (read-only Claude subagent — the `claude -p` CLI lane is skipped for independence and fails on a Write-permission gap; recorded workaround). Source-grounded.

## Summary

All 3 HIGH and all 8 actionable cycle-4 fixes are present in the plan documents on disk, and every factual claim the fixes rely on was verified against the actual current-state code (not just the plan's assertion). This phase has not been executed yet (git log shows only `docs(38):` commits; `git status` is clean), so "landed" for this confirmation means: the fix text is correctly inlined into the plan artifacts, and the plan's premises about present-day code are accurate — both checked out. No hallucinated symbols were found (the cycle-2 `KEY_TO_COLUMN` class of error did not recur; `COLUMN_OF` was verified as the real map). No regressions or new concerns were found in the fixed areas.

## Confirmation Table

| # | Fix | Verdict | Evidence |
|---|-----|---------|----------|
| HIGH-1 | Plan 01: surviving Settings-hosted Backup consumes shared-backup singleton | **CONFIRMED** | Plan text `38-01-PLAN.md:379` (Task 7a) instructs flipping `shouldConsumeSharedBackup` to return `true` for `"settings"`. Premise on disk: `backup-dualhome-logic.ts:58-60` currently returns true only for `"backup-tab"`; `BackupScreen.tsx:274` early-returns before `consumeSharedBackup()` for the settings host. `consumeSharedBackup()` is a safe no-op when nothing is staged: `SharedBackupCoordinator.consume()` (`OrbitBackupDocumentPickerModule.kt:43`, `pendingUri.also { pendingUri = null }`) returns null idempotently. No double-drain: only one call site (`BackupScreen.tsx`); Plan 01 Task 1 step (6) removes the `BackupTab` Tab.Screen/`BackupStack` import so only `"settings"` remains mounted. |
| HIGH-2 | Plan 02: v1-jump fixture via `runMigrations(...,1,...)` | **CONFIRMED** | `38-02-PLAN.md:176,204` mandates the runner-based v1 fixture and bans a bare `.apply()`. Verified `runner.ts:38-45` (reads `user_version`, defaults 0) and `:56-61` (`BEGIN; apply; PRAGMA user_version=N; COMMIT`); `001-initial.ts:42` (`CREATE TABLE categories (` no `IF NOT EXISTS`) → re-run throws "table already exists". `full-chain.test.ts:16-22` starts at v0 with no reusable v1 fixture, matching the plan's stated gap. |
| HIGH-3 | Plan 02: version bump updates 5 orphaned test-consumers | **CONFIRMED** | All 5 files exist and are real consumers: `category-identity-audit.test.ts:214-224` (`toContain("expect(TARGET_VERSION).toBe(29)")`, `/BACKUP_FORMAT_VERSION\s*=\s*6/`), `orrery-preferences-portability.test.ts:150` (`toBe(6)`), `orrery-exploration.integration.test.ts:608` (`backupFormatVersion).toBe(6)`), `backup-service.test.ts:174,~203` (`backupFormatVersion: 6` ×2), `029-ai-configuration.test.ts:20-21` (`toBe(29)` ×2). All 5 in `files_modified` (`:15-19`) and Task 3 step (3b) names each with a broadened verify (`:242`). |
| Actionable 1 | Plan 02 checkpoint reworded — no "staged diff" claim | **CONFIRMED** | `38-02-PLAN.md:132`: "the changes are not yet staged … NOT an inspection of a staged diff," with the prior wrong wording named only in a parenthetical. *(Orchestrator note: the leading sentence is fixed, but residual "staged" wording remains at :134/:141/:151 — see Divergent Views; codex's PARTIAL is the accurate verdict.)* |
| Actionable 2 | Plan 05 pure controller seam (`your-week-section-logic.ts`) | **CONFIRMED** | `38-05-PLAN.md:9,143,156,167,206,210,225` — file in `files_modified`, Task 3 specifies the reducer transitions, acceptance requires render-free tests for generation guard / rollback / day-invalidation. |
| Actionable 3 | Plan 05 file-agnostic Settings grep | **CONFIRMED** | `38-05-PLAN.md:192,226`: `grep -rl 'yourWeekPeriod' src/screens/ | xargs grep -l 'updateAppSettings'`, not a hardcoded filename. |
| Actionable 4 | Plan 06 Overlooked non-numeric CTA | **CONFIRMED** | `38-06-PLAN.md:31,140,223`: "See everyone needing attention →" is the non-numeric affordance; numeric `+{n} more →` reserved for Never Contacted, tied to D-10 preview==drill equivalence. *(Orchestrator note: correct in the action, but sibling refs at :32/:148/:157 still attach numeric overflow to Overlooked — codex's PARTIAL is the accurate verdict.)* |
| Actionable 5 | Plan 06 drill-through awaits write, stays on Digest on rejection | **CONFIRMED** | `38-06-PLAN.md:144`: "AWAIT the atomic `setPopulationsAndFilters` write and navigate ONLY after it resolves… On rejection, do NOT navigate: stay on Digest and surface a non-fatal error." |
| Actionable 6 | Plan 04 `openEvents` typed `getParent`, fail-closed | **CONFIRMED** | `38-04-PLAN.md:173,212`: exact typed call; "if `getParent()` returns `undefined`… `openEvents` is a no-op with a dev-only warning and never throws." |
| Actionable 7 | Plan 07 `<verification>` reworded PASS/FAIL/BLOCKED | **CONFIRMED** | `38-07-PLAN.md:28,113,133,139,166,189`: "never inferred," BLOCKED-prevents-closure throughout; line 166 changelog documents the correction. |
| Actionable 8 | Plan 07 DEV-only-seeder-preferred fixtures | **CONFIRMED** | `38-07-PLAN.md:114,167`: "PREFER a DEV-only seeder that writes through the canonical DAOs," with a document-every-row / verify-invariants fallback, else record BLOCKED. |

## Concerns
No HIGH or MEDIUM concerns found in the fixed areas. Two sub-HIGH observations, both non-blocking:

- **LOW (informational, not a defect):** `DEFAULT_BACKUP_HOST = "backup-tab"` (`backup-dualhome-logic.ts:22`) remains the fallback default for the `host` prop in `BackupScreen.tsx:71`, `RestorePreviewScreen.tsx:81`, `RestoreResultScreen.tsx:14`. After Plan 01 removes `BackupTab`, both remaining call sites (`SettingsStack.tsx`) pass `host="settings"` explicitly, so this default is never hit at runtime — not a functional bug, but a now-slightly-stale fail-closed default that could mislead a future reader or a prop-less test mount. Plan 01 does ask to refresh the inverted `:18` comment, which partially addresses it; whether `DEFAULT_BACKUP_HOST` itself should flip is a judgment call left implicit. Not worth gating on for this confirmation pass.
- **D-10 spot-check (sanity, not re-litigating):** `38-03-PLAN.md` Task 3 scopes the unbound-inclusive relaxation to an exact `['not-contacted']` selection only, reusing the identical `countNeverContacted` predicate (`src/db/dashboard-read.ts:543-550`, verified verbatim). Implemented correctly per D-10; no other population broadened. No escalation needed.

## Risk Assessment
**LOW.** All three HIGH cycle-4 fixes and all eight actionable fixes are present in the plan artifacts, and every underlying technical claim (runner semantics, migration DDL, orphaned-consumer pins, native no-op behavior, single consumer call site) was independently verified against the actual code on disk. No decision reversals, no new HIGH/MEDIUM findings, no regressions introduced by the fixes.
