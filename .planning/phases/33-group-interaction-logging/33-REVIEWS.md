---
phase: 33
cycle: 5
reviewers: [claude, codex]
reviewed_at: 2026-09-12T08:18:39Z
plans_reviewed: [33-01-PLAN.md, 33-02-PLAN.md, 33-03-PLAN.md, 33-04-PLAN.md, 33-05-PLAN.md, 33-06-PLAN.md, 33-07-PLAN.md]
models:
  claude: "opus (read-only verification agent)"
  codex: "gpt-5.6 (codex exec, read-only repo access)"
model_sources:
  claude: "subagent"
  codex: "banner"
cycle_summary:
  current_high: 0
  current_actionable: 5
---

# Cross-AI Plan Review — Phase 33: Group Interaction Logging (Cycle 5, final)

> Cycle 5 of the convergence loop. The 7 plans were revised (commit f2504d2) to resolve cycle-4's
> 2 HIGH + 3 actionable findings. Both lanes re-verified FRESH against the live repo, and the
> orchestrator independently verified every load-bearing claim below against the code on disk
> (`merge-dao.ts`, `recency-dao.ts`, `ai-context-read.ts`, `tombstones-dao.ts`, `purge-dao.ts`,
> `ContactPicker.tsx`, `MergeImpactSummary.tsx`, `TouchpointRefineForm.tsx`,
> `touchpoint-refine-logic.ts`, `restore-apply.ts`, `database.ts`, migration 025, and the 7 plans)
> rather than trusting reviewer summaries — per the repo "review the code, not the diff" mandate.
>
> The `--codex` lane ran directly (`codex exec`, read-only sandbox, source-grounded). The `--claude`
> lane ran as a read-only Opus agent (the `claude -p` reviewer fails on a Write-permission gap on
> this host; owner-approved substitution); it independently re-verified findings against disk.

## Consensus Summary

**All FIVE cycle-4 findings are genuinely RESOLVED in the current plans (f2504d2)** — both lanes
agree and the orchestrator verified each against source, not prose:

1. **HIGH-1 — atomic participant Save — RESOLVED.** Plan 03 Task 4 adds `saveParticipantEdits`: one
   `inWriteTransaction`, one trailing `bumpDataRevisionCore`, composing `editTouchpointFullCore`
   ONCE + one explicit scoped `UPDATE … SET ge_follow_<field>` per follow-field at the CORE level
   — never the mutexed per-field ops (avoids the `inWriteTransaction` non-reentrancy hang;
   transaction.ts:12). Membership-scoped (`AND group_event_id=?`, `changes===1`); mid-save
   injected-failure rollback test (value + flag + direct field all revert, revision delta 0).
   Plan 06's editor Save invokes ONLY this op; prohibition against chaining added. Threat T-33-29.
2. **HIGH-2 — merge collision under migration 026's partial UNIQUE — RESOLVED (data-safety half).**
   Plan 01 adds a blocking `checkpoint:decision` (outcome = owner) + Task 5 that reads
   `merge-dao.ts`. Every cited line is accurate: the blanket reparent `UPDATE interactions SET
   contact_id=?` (merge-dao.ts:89) via the table loop (:180) inside the sole `inWriteTransaction`
   (:98), the trailing `recomputeLastContactCore(survivor)` (:215), and the real
   `current_state_entries` partial-UNIQUE pre-handling precedent (:153-165) the task mirrors. The
   collision-detection query is correct; the typed throw rolls the whole merge back with no row
   loss and no destructive survivor. Threat T-33-28. **Caveat below (actionable #1): the
   *remediation* half of the outcome is not actually delivered by the merge screen.**
3. **MED-1 — convert DAO-level `group_event_id IS NULL` guard — RESOLVED.** Plan 05 Task 3 adds a
   txn-local source read asserting `group_event_id IS NULL` BEFORE the parent INSERT, plus the
   in-place `UPDATE … WHERE id=? AND contact_id=? AND group_event_id IS NULL` with `changes===1`.
   Genuinely below the UI; rollback leaves no orphan parent. Threat T-33-31.
4. **MED-2 — distinct child-uid minting — RESOLVED.** Plan 06 Task 2 mints ONE parent uid + a
   DISTINCT child uid per selected contact via a pure unit-tested builder
   (`src/logic/group-log-participant-inputs.ts`), grounded in `interactions.uid NOT NULL UNIQUE`.
5. **MED-3 — `excludeContactIds` on ContactPicker — RESOLVED.** Plan 02 Task 1 adds
   `excludeContactIds?: number[]` to the shared base props + a pure `applyPickerExclusions` helper,
   replacing the confirmed inline filter `rows.filter((row) => row.id !== excludeContactId)`
   (ContactPicker.tsx:88-97). Plan 06 Task 4 passes the event's current participant set.

The data-correctness spine remains sound and **reverses no recorded ADR/HANDOFF/dossier decision**:
migration 026 = head+1 (TARGET_VERSION 25 on disk, INTERACTION_HISTORY_SCHEMA_VERSION); the
single-writer fan-out composes the `*Core` primitives (the NON-mutexed CORE export block exists at
recency-dao.ts:446); the non-reentrant-mutex deadlock is designed out via `editTouchpointFullCore`;
and the Group-Note AI-egress ban is structurally preserved (`ai-context-read.ts:116-122` selects
only `channel, quality, connected`, never joins `group_events`, reads no note column).

**Residual this cycle: 0 HIGH + 5 actionable (3 MEDIUM + 2 LOW) — all NEW, none in any PLAN.md
yet.** Codex ran a deeper source-grounded pass than cycle 4 and surfaced these; the Opus lane
independently corroborated actionable #1 against disk. None is a regression from the cycle-4 fixes;
all are pre-existing cross-subsystem/plan-text gaps the plans never closed. The convergence loop has
NOT fully converged on zero actionable — the remaining items are non-HIGH and non-data-corrupting,
so termination-vs-one-more-cycle is a planner/owner call.

### Agreed Strengths (maintainer-verified)
- `saveParticipantEdits` composes the non-mutexed core correctly; the mutexed per-field ops are
  explicitly forbidden inside it (transaction.ts non-reentrancy). Mid-save rollback encodes D-08.
- `mergeContacts` data-safety under the new partial UNIQUE is genuinely correct: atomic rollback,
  no row loss, no destructive survivor; mirrors the existing `current_state_entries` precedent.
- Convert guard is at the DAO/SQL level, not just UI; distinct child-uid minting is well-founded;
  `excludeContactIds` cleanly extends the shared picker without forking it.
- AI egress boundary is a structural non-action; `PURGE_CHILDREN` is an exhaustive Record with
  `group_event: null` the correct disposition; `insertTombstoneCore` already accepts `bumpRevision`.

### Agreed Concerns (raised by 2+ reviewers)
- **Merge-remediation UX is not delivered (actionable #1).** BOTH the codex and Opus lanes
  independently found that `MergeImpactSummary.tsx:19,21` discards the thrown error and shows a
  fixed generic "…Try again." — so Plan 01's repeated "the merge screen's existing catch renders
  remediation guidance" claim, and its "no merge-UI file is edited" consequence, are false against
  the code. Orchestrator-verified.

### Divergent Views
- Codex went broader (5 findings across Plans 01/05/06 + wording/FK-hardening); Opus focused on the
  five fixes and converged on the one substantive UX gap. No contradiction between the lanes.

### Owner escalation (surface, do not auto-resolve — NOT counted as unresolved actionable)
- **Merge-collision resolution OUTCOME (reject-with-remediation vs reconcile).** Correctly encoded
  as a blocking `checkpoint:decision` in Plan 01 (default: Option A, reject-with-remediation;
  Option B reconcile requires explicit owner authorization). Handling is structurally sound — but
  note actionable #1: the checkpoint is framed on a partly-false premise (that remediation copy
  reaches the user), so the owner should decide A-vs-B on corrected information.
- **A3 restore orphan-repair outcome (D-10).** Unchanged: Plan 05 holds this `owner_pending` with a
  recommended default (detach-to-standalone) + Phase-36 handoff. Handling is clean; not counted.

---

## Current HIGH Concerns (0)

None. Both cycle-4 HIGHs (participant-Save atomicity; merge-collision data safety) are fully
resolved and orchestrator-verified against code.

## Current Actionable Non-HIGH Concerns (5 — all NEW, none in any PLAN.md)

1. **[MEDIUM — codex + Opus, disk-verified] Merge-collision "remediation" is not user-surfaceable;
   Plan 01 asserts a UI mechanism that does not exist.**
   `MergeImpactSummary.tsx:19` catches with `.catch(() => setFailed(true))` — the typed error
   object is discarded — and `:21` renders a fixed `"Couldn't merge these contacts. Nothing was
   changed. Try again."`. Plan 01 (must-have truths, Task 5 action/acceptance, and the checkpoint's
   Option A) repeatedly claims "the merge screen's existing catch renders remediation guidance …
   so no merge-UI file is edited." That is false: the message is thrown away, and "Try again" is
   actively misleading for this case (retry fails identically until the user removes one contact
   from the shared group event). Data safety is unaffected (atomic rollback), so MEDIUM not HIGH,
   but the *handling* of the owner-approved "reject-with-**remediation**" outcome is structurally
   wrong. **Plan change:** either (a) add `MergeImpactSummary.tsx` to Plan 01 Task 5's
   `files_modified` and have the catch surface the typed collision error's message (drop the "no
   merge-UI file is edited" claim); or (b) correct the plan text to state the outcome is "reject
   with a generic failure message (no specific remediation shown)" and reframe the checkpoint so
   the owner decides A-vs-B on accurate information. Consider a machine-readable error `code` on the
   typed error rather than string-matching.

2. **[MEDIUM — codex, disk-verified] The Phase-36 `33-BACKUP-HANDOFF.md` (Plan 05 Task 3) is
   incomplete for the restore architecture actually on disk.** It specifies durable `groupEventUid`,
   parent-before-child upsert, and an orphan outcome, but does not hand off the exhaustive places
   an entity must be registered to participate in restore: `MergeableEntityType`/policies
   (reconciliation.ts:8,46); restore's `entities`, `tableOf`, and tombstone mappings
   (restore-apply.ts:50); schema validation + tombstone allowlist (backup-schema.ts:197,322); and
   replace-all reset order (restore-apply.ts:254,267). **Plan change:** expand the handoff's
   required-content list in Plan 05 to enumerate these files/registries plus explicit Phase-36
   tests (merge restore, replace-all restore, deleted-parent tombstones, approved orphan
   disposition). (Not asking to decide A3 now.)

3. **[MEDIUM — codex, disk-verified] Plan 06 promises future-date copy a reused component cannot
   produce.** Plan 06 requires the locked copy "Group events can't be in the future." (33-06:43,165),
   but `TouchpointRefineForm` exposes only `value/onChange/now/testID` (TouchpointRefineForm.tsx:90)
   and renders the fixed `FUTURE_DATETIME_MESSAGE` = "That time is in the future. Pick now or
   earlier." (touchpoint-refine-logic.ts:92-93) via its own inline validation, which fires before
   Save (so the DAO `rejectFutureOccurredAt` copy the plan points to never shows for an
   inline-picked future date). **Plan change:** add a narrow optional `futureDateMessage` prop to
   `TouchpointRefineForm` (defaulting to the existing message) — or give Group Log / Edit Group
   Event their own date control — and test BOTH the existing interaction copy and the Group Event
   copy.

4. **[LOW — codex, disk-verified] Correct the restore source-grounding statement in Plans 01 and
   05.** Both describe restore's direct interaction upsert as one that "does NOT recompute
   last_contact" (33-01:285; 33-05:128). That is false at the operation level: restore's later
   transaction-local loop collects every affected contact UID (old parents + new `contactUid`) and
   calls `recomputeLastContactCore` for each surviving contact in the SAME outer transaction
   (restore-apply.ts:299-316). **Plan change:** state that restore is a separate writer with a
   deferred, transaction-contained recompute, rather than an exception that leaves recency stale.
   (The audit's conclusion — "not altered by this phase" — is unchanged; only the reasoning is
   inaccurate.)

5. **[LOW — codex] Make the FK follow-flag safety-net invariant explicit (migration 026 / Plan 05).**
   Migration 026's proposed `ON DELETE SET NULL` on `interactions.group_event_id` clears only the
   link, not the three `ge_follow_*` flags; an FK-driven parent removal would leave a standalone
   child marked as following an absent event. The normal dissolve path clears both, and the plans
   forbid relying on FK cascade for deletes — but the safety net can still fire. **Plan change:**
   add a migration/DAO invariant test (and a Phase-36 restore/reset rule) requiring linkage and all
   follow flags to be cleared together. Aligns with the proposed orphan repair, does not change it.

---

## Codex Review (gpt-5.6, codex exec, read-only)

### Verdict
Request changes — MEDIUM risk. Strong transaction/recency design (composes non-mutexed cores under
one `inWriteTransaction`, preserves parent-never-counts, addresses the merge/index collision).
Correct three MEDIUM findings (Plans 01, 05, 06) before execution; two LOW hardening/wording items.
The two owner-bucket items are correctly represented as a blocking merge decision and an
owner-pending restore assumption; neither counted.

### Source audit (all production `interactions` writers, not the plans' inventory)
- recency DAO insert/update/delete + correlated recompute (recency-dao.ts:159,215,304,359).
- restore upserts interactions then recomputes each survivor's recency in the same outer
  transaction (restore-apply.ts:201,303,316).
- contact purge is an intentional whole-contact deletion fan-out (purge-dao.ts:318); migration 025
  migrates existing literals only (025:45); benchmark seeding is throwaway setup (benchmark.ts:101).
- `mergeContacts` is the important non-core writer: generic reparent updates interactions in its
  table loop, then recomputes the survivor once (merge-dao.ts:88,180,215). Plan 01 correctly brings
  it into scope.

### Findings (see the aggregated actionable list above for the resolution each needs)
- MEDIUM — merge remediation not user-surfaceable (MergeImpactSummary.tsx:19,21). *(Actionable #1.)*
- MEDIUM — Phase-36 backup handoff incomplete for the on-disk restore architecture
  (reconciliation.ts:8,46; restore-apply.ts:50,254,267; backup-schema.ts:197,322). *(Actionable #2.)*
- MEDIUM — Plan 06 future-date copy mismatch vs `TouchpointRefineForm` fixed message
  (TouchpointRefineForm.tsx:90,153; touchpoint-refine-logic.ts:92). *(Actionable #3.)*
- LOW — restore-recompute wording false in Plans 01/05 (restore-apply.ts:299,316). *(Actionable #4.)*
- LOW — FK `ON DELETE SET NULL` cannot clear the `ge_follow_*` flags. *(Actionable #5.)*

### Per-plan risk
Plan 01 MEDIUM (until merge-UI + FK/reset land), Plan 02 LOW, Plan 03 LOW, Plan 04 LOW, Plan 05
MEDIUM (until handoff exhaustive), Plan 06 MEDIUM (until future-date copy fixed), Plan 07 LOW.
Overall: revise Plans 01, 05, 06 for the three MEDIUMs, retain the owner checkpoints exactly as
encoded, then proceed.

## Claude Review (read-only Opus verification agent)

### Summary
Independently opened every referenced file and did a grep-based writer audit of `interactions`. All
five cycle-4 fixes land correctly and match the code they build on — `saveParticipantEdits`
atomicity, the merge data-safety half (every file:line accurate, mirrors the current_state_entries
precedent), the DAO-level convert guard, distinct child-uid minting, and `excludeContactIds`. One
substantive discrepancy: fix #2's UX half. The plans repeatedly assert "the merge screen's existing
catch renders remediation guidance," but `MergeImpactSummary.tsx:19` discards the error and `:21`
shows a fixed generic "…Try again." — so the "remediation" half of the owner-approved
"reject-with-remediation" outcome is not delivered, and the copy misdirects (retry fails
identically). MEDIUM: data correctness holds (atomic rollback, no loss), but the plan claims a UI
mechanism that does not exist and frames the owner checkpoint on that false premise.

### Verified strengths
- `editTouchpointFull` (recency-dao.ts:281-337) is mutexed and `inWriteTransaction` is non-reentrant
  (documented hang hazard at :159-173) — composing the *core* is the only safe path (fix #1 correct).
- Merge reparent + recompute lines all accurate (merge-dao.ts:89,98,180,215); mirrors the
  current_state_entries partial-UNIQUE pre-handling at :153-165 (fix #2 data-safety correct).
- Convert guard is two-layer and below the UI (fix #3); `interactions.uid` NOT NULL UNIQUE confirmed
  (fix #4); the inline single-id filter at ContactPicker.tsx:88-97 is exactly what fix #5 replaces.
- D-04 egress ban preserved by omission (ai-context-read.ts:116-122); `PURGE_CHILDREN` exhaustive
  Record (purge-dao.ts:80); migration head 025/TARGET 25 → 026 is head+1 (database.ts:63,91).

### Risk Assessment — LOW–MEDIUM
All five fixes are correct on the axis that carries irreversible, on-device, no-recovery
consequences (schema shape, transaction atomicity, single-writer recency spine, AI egress ban,
merge data-safety under the new partial UNIQUE) — verified against code, not plan text. The one
substantive concern (fix #2 remediation UX) is a false code-behavior claim with a real but
non-corrupting user-facing consequence and a small, well-scoped remedy. Owner-bucket items are
correctly encoded.

---

*Review method: codex lane via `codex exec` (gpt-5.6, read-only repo access, source-grounded);
Claude lane via a read-only Opus verification agent (owner-approved; `claude -p` lane unavailable on
this host). The orchestrator verified every load-bearing claim against code on disk and git, per the
repo "review the code, not the diff" mandate — no subagent summary was reported as fact without
independent verification (`MergeImpactSummary.tsx`, `TouchpointRefineForm.tsx`,
`touchpoint-refine-logic.ts`, `restore-apply.ts`, `merge-dao.ts` all re-read directly).*
