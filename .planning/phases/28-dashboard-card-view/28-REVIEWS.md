---
phase: 28
reviewers: [codex, claude]
reviewed_at: 2026-09-06T08:05:30Z
cycle: 5
plans_reviewed: [28-01-PLAN.md, 28-02-PLAN.md, 28-03-PLAN.md, 28-04-PLAN.md, 28-05-PLAN.md, 28-06-PLAN.md, 28-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8 (subagent, read-only)"
model_sources:
  codex: "banner"
  claude: "orchestrator-known"
---

# Cross-AI Plan Review — Phase 28 (Dashboard Card View)

_Cycle 5 of a bounded convergence loop (findings: 14 → 8 → 3 → 1 → this cycle). The only change since cycle 4 is commit `97ad2f9`, a 2-line fix to `28-01-PLAN.md` for the sole cycle-4 finding (favourite-star touch target). Both reviewers were source-grounded and verified `file:line` citations against the actual code on disk._

_Note: Claude Code is the executing harness, so the built-in Claude lane self-skips for independence; the Claude review below was produced by an independent read-only Claude subagent and aggregated here (per project convention), then cross-checked by the orchestrator against disk._

## Consensus Summary

Both reviewers independently conclude the plan set is **execution-ready with zero actionable findings**. Neither raised a HIGH. The cycle-4 favourite-star fix is verified sound (`SPACING["2xl"]=48 ≥ 44px` centered min-box mirroring `ListRow.styles.favouriteButton` at `src/components/ListRow.tsx:342-347`, hitSlop supplemental — verified on disk by both reviewers and the orchestrator). All prior-cycle fixes were re-confirmed against source: the atomic receipt-based `undoBulkQuickLog` in one `inWriteTransaction` with a single `bumpDataRevisionCore` (D-04), the additive `GroupLog { participantIds? }` handoff (reverses nothing — `navigation/types.ts:34`), the direct `navigateDashboardContactAction(id, "LogContact")` route bypassing the preference-gated `onLogInteraction` (`HomeScreen.tsx:412-425`), the view-independent search/line-3 descriptors (Plan 04), and the awaited 2-arg `setViewMode(exec, "card")` with a persist-failure path (`dashboard-query-store.ts:79-89`, Plan 06). No decision reversal, no network on a read path, no new migration (D-03), no bulk-delete/quarantine regression.

Codex raised two MEDIUMs; the orchestrator verified both against source and found both to be **non-actionable false positives** (details under Divergent Views). The convergence loop has genuinely converged.

### Agreed Strengths

- **Cycle-4 fix correct and complete** — favourite-star touch target is a `minWidth/minHeight: SPACING["2xl"]` (48px) centered min-box mirroring `ListRow.tsx:342-347`; hitSlop-alone (36px) would be below the floor. Verified on disk by both reviewers.
- **Bulk data layer correct-by-construction** — extracting non-mutexed `*Core` primitives and composing N per op in one `inWriteTransaction` correctly respects the non-reentrant write mutex (`contacts-dao.ts:536`, `favourites-dao.ts:32`, `snooze-dao.ts:79`); single recency writer + immutable event trail preserved; `bumpDataRevisionCore` lives in the core, not the wrapper (`contacts-dao.ts:637-658`).
- **Quick Log shape pinned to canonical** — `channel:"unspecified"`, `direction:"outbound"` (against the `direction ?? null` default at `recency-dao.ts:205`), `connected:1`, `quality:null`, `source:"manual"` (`quick-log-command.ts:87`).
- **Cycle-3 routing fixes grounded** — direct detailed-log route, not the preference-gated swipe handler; awaited persisted `setViewMode`.
- **Frozen-universe selection** — store guard + render-side filter is sound defense-in-depth against a refresh promoting newly-matching contacts into selectable cards.

### Agreed Concerns

None. Both reviewers returned `high=0 total_actionable=0`.

### Divergent Views

Codex (reasoning=low) raised two MEDIUMs that the Claude reviewer did not, and that the orchestrator verified against source and **rejects as non-actionable**:

1. **"Plans 02 & 04 have impossible intermediate verification order"** — Codex read Plan 02 Task 2's verify (`npm test -- src/db/bulk-actions-dao.test.ts`, line 164) as running before Task 3 creates that test file (line 179-180), same for Plan 04 Task 1 vs Task 2. **Rejected:** `vitest.config.ts:15` sets `passWithNoTests: true` (with a comment explicitly anticipating this) — verified by probe that `npm test -- <nonexistent>` exits 0 ("No test files found, exiting with code 0"). The verify passes cleanly whether or not the test file exists yet. No plan change needed.
2. **"Plan 05 long-press/press exclusivity not enforced"** — Codex wanted a long-press-consumed ref guard. **Rejected:** Plan 05 explicitly relies on documented RN `Pressable` semantics (lines 108, 111: "fires either onPress OR onLongPress, not both"), a correct standard-RN guarantee, and gates it with a device-UAT check (line 173: "long-press opens the 8-item menu; tap opens Profile"). The ref-guard is unnecessary belt-and-suspenders; adding a component test is optional polish, not execution-blocking.

Observational (not a plan defect, from the Claude reviewer): the review-prompt premise "TARGET_VERSION 11" is stale — on disk `TARGET_VERSION = 20` (`src/db/database.ts:55`). Irrelevant to the plans (they ship no migration, D-03; "v11 CHECK" references point at the still-live `interval_days` constraints in `011-contact-lifecycle-schema.ts`).

---

## Codex Review

<!-- model: gpt-5.6-terra (reasoning=low) -->

## Summary

The plans are technically strong and trace the existing architecture closely: they correctly replace the Card placeholder, preserve the non-reentrant transaction model, and route bulk writes through extracted cores. Two execution-order defects should be fixed before approval; one interaction detail also needs an explicit guard.

_(Orchestrator note: on source verification both MEDIUMs below are non-actionable — see Divergent Views. Codex ran at reasoning=low and did not open `vitest.config.ts` or confirm RN `Pressable` semantics.)_

## Strengths

- The plans correctly identify that Card View is currently a legacy single-column `ContactCard` branch, while List owns shared loading, empty, refresh, and header behavior in `HomeScreen.tsx:1054`. Moving to a separate `CardGrid` container is appropriate.
- Bulk-write design respects the real mutex constraint: existing archive, favourite, and snooze writers each open their own transaction (`contacts-dao.ts:536`, `favourites-dao.ts:32`, `snooze-dao.ts:79`). Extracting non-mutexed cores is necessary for atomic N-contact operations.
- The Quick Log shape is correctly pinned to the canonical command: `channel:"unspecified"`, `direction:"outbound"`, `connected:1`, `quality:null`, `source:"manual"` (`quick-log-command.ts:87`). This avoids the recency DAO's nullable direction default.
- The plan correctly avoids reusing the dashboard's preference-gated list-swipe handler, which can execute Quick Log rather than detailed logging depending on persisted preference (`HomeScreen.tsx:412`). Directly routing Card-menu detailed log to `LogContact` is required.
- The search and line-3 gaps are real: descriptor production and knowledge-candidate reads are currently list-only (`HomeScreen.tsx:558`, `:601`). Plan 04 addresses both.
- The frozen-universe store plus render-side filtering is a sound defense-in-depth approach.

## Concerns

- **MEDIUM — Plans 02 and 04 have impossible intermediate verification order.** Plan 02 Task 2 runs `npm test -- src/db/bulk-actions-dao.test.ts` before Task 3 creates that file; Plan 04 Task 1 likewise. _(Orchestrator: REJECTED — `vitest.config.ts:15` `passWithNoTests: true`; the verify exits 0 with no file. Verified by probe.)_
- **MEDIUM — Plan 05 assumes long-press and press are mutually exclusive without enforcing it.** Suggests a long-press-consumed ref + a test. _(Orchestrator: REJECTED — the plan relies on documented RN `Pressable` "either onPress OR onLongPress" semantics (lines 108, 111) and a device-UAT gate (line 173); the ref-guard is unnecessary.)_

## Suggestions

- Add a focused UI/component test for the two routing distinctions (Card-menu "Log Interaction" always reaches detailed `LogContact`; long-press never triggers Profile navigation). _(Optional polish.)_
- Retain the explicit `await setViewMode(getExecutor(), "card")` sequencing in Plan 06 — the store requires `(exec, viewMode)` and persists before updating Zustand (`dashboard-query-store.ts:79`). _(Confirms cycle-3 fix sound.)_
- Keep the Group Log param additive as proposed — `GroupLog` is currently parameterless (`types.ts:34`), so `{ participantIds?: number[] }` is a contained routing handoff. _(Confirms cycle-1 fix sound.)_

## Risk Assessment

**MEDIUM.** The architecture, data integrity model, and frozen-selection design are well-grounded in the source. _(Orchestrator: adjusted to LOW after both raised concerns verified as non-actionable false positives.)_

---

## Claude Review

<!-- model: claude-opus-4-8 (independent read-only subagent) -->

## Summary

5th cycle of a bounded convergence loop. The only change since cycle 4 is commit `97ad2f9`, a 2-line fix to `28-01-PLAN.md` addressing the single cycle-4 finding (favourite-star touch target). That fix is sound and complete; the highest-risk data-layer and UI-wiring citations were re-verified against the actual code on disk; no recorded decision (HANDOFF, ADR-010/018/024/025/033/071/075, D-01..D-12) is deleted, weakened, or inverted. The plans are execution-ready. **Zero actionable findings.**

## Strengths (with on-disk evidence)

- **Cycle-4 fix correct and complete.** `SPACING["2xl"]=48` (`spacing.ts:18`), `ICON_SIZE.md=20`, `SPACING.sm=8` — hitSlop-alone yields 36px, below the 44px floor. `28-01-PLAN.md` specifies the min-box in both `<behavior>` (line 125) and `<action>` (line 129), mirroring `ListRow.styles.favouriteButton` at `ListRow.tsx:342-347`.
- **Data layer correct-by-construction (Plan 02).** `archiveContact` (`contacts-dao.ts:536`) uses `WHERE id=? AND archived_at IS NULL` + `recordEventCore` (ADR-025). `setContactPhotoCore` (`:637`) carries `bumpDataRevisionCore` inside the core; wrapper (661-669) adds none — per A3. `insertInteraction` defaults `direction ?? null` (`recency-dao.ts:205`), so pinning `outbound` is required. `deleteTouchpoint` (`recency-dao.ts:313-346`) is bump-free with dual-key delete.
- **Frequency guard grounded.** Migration 011 `CHECK(interval_days ... >0)` + `contacts_prevent_cadence_clear` trigger; Plan 02's positive-integer guard respects both.
- **Cycle-3 UI-wiring fixes verified.** `navigateDashboardContactAction` direct helper (`HomeScreen.tsx:133-141`); `onLogInteraction` (`:412-425`) is preference-gated → Quick Log fallback; `setViewMode async (exec, viewMode)` + idempotency guard (`dashboard-query-store.ts:79-89`); `GroupLog: undefined` (`navigation/types.ts:34`) → additive handoff reverses nothing.
- **No migration introduced (D-03).**

## Concerns

**None actionable.**

- (Observational, not a plan defect) Prompt premise "TARGET_VERSION 11" is stale — on disk `TARGET_VERSION = 20` (`database.ts:55`); irrelevant since the plans ship no migration and "v11 CHECK" refers to still-live `interval_days` constraints.
- (Prior-cycle, correctly not counted) Codex's cycle-4 note re Plan 03 `enterSelection` seed membership-check is defensive hardening only; both wired callers pass in-universe seeds and `toggle()` is fenced.

## Suggestions

None required for execution.

## Risk Assessment

**LOW.** Every decision-critical citation resolves correctly on disk. Highest-risk surface (bulk data layer) is architecturally sound; frozen-universe invariant double-fenced; no decision reversal, no read-path network, no schema change. The convergence loop has genuinely converged.

## Actionable Count

ACTIONABLE: high=0 total_actionable=0
