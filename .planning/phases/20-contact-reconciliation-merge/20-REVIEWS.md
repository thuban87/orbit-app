---
phase: 20
convergence_cycle: 4
reviewers: [codex, claude, cursor]
reviewed_at: 2026-08-30T22:10:44Z
plans_reviewed: [20-01-PLAN.md, 20-02-PLAN.md, 20-03-PLAN.md, 20-04-PLAN.md, 20-05-PLAN.md, 20-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "sonnet (reasoning=low)"
  cursor: "unknown"
model_sources:
  codex: "banner"
  claude: "pinned"
  cursor: "unknown"
cycle_summary:
  current_high: 2
  current_actionable: 8
---

# Cross-AI Plan Review — Phase 20 (Convergence CYCLE 4)

> Cycle 4 re-review of the six Phase-20 plans AFTER three prior revision rounds. All three
> explicitly-requested lanes (codex, claude, cursor) ran and returned substantive reviews. The
> `--claude` self-skip guard (`$CLAUDE_CODE_ENTRYPOINT=cli` would normally skip claude) was
> overridden for this run at owner instruction, so the Claude/Sonnet lane ran as a context-isolated
> reviewer. **This cycle Codex was the strongest source-grounded lane (21 `file:line` citations);
> Cursor also verified extensively on disk (mechanisms confirmed at exact lines). The headless Claude
> lane explicitly stated it did NOT re-open the repo this pass ("findings below are graded by
> internal-consistency analysis against the plan text ... not fresh source reads"), so — although it
> carried no `[reviewed-without-source-citations]` marker — its verdict is treated as plan-text-only
> and NOT counted at full source-grounded weight per the workflow rule.** An orchestrator
> source-grounding pass independently verified every finding below against the code on disk (the two
> divergent Codex HIGHs were adjudicated by reading `CandidateCardGrid.tsx`, `contacts-dao.ts`,
> `backup-sweep.ts`, and the 20-03/20-04/20-06 plan apply designs directly); a cross-artifact
> fact-drift pass was also run. Both blocks follow the Consensus Summary.
>
> **Cycle-3, Cycle-2 and Cycle-1 findings are preserved as AUDIT HISTORY below. Do not re-action
> resolved items from there.** This cycle reports only what REMAINS unresolved in the CURRENT plan
> state.

## Consensus Summary (Cycle 4)

The three cycle-3 HIGHs are confirmed **resolved** in the current plans and verified on disk:
(1) the reconcile scalar apply now calls `bumpDataRevisionCore` on a scalar change so it cannot escape
the backup sweep (20-03 must_have + prohibition + HIGH #1 test); (2) the reconcile photo apply is
restructured POST-COMMIT mirroring the shipped `persistImportedPhotoPostCommit`, so a rolled-back
apply leaves both the on-disk master and the DB reference intact (HIGH #2 rollback test); and (3) the
merge writer's step (1a) consults `resolutions.primaryMethod` before demoting a competing primary, so
the 20-02 control is honoured not decorative (HIGH #3 chosen-absorbed-primary-wins test). All three
lanes agree the data-layer core (merge writer modelled on purge-dao in reverse, `field_history`
reparent without `modified_at`, method whole-list apply, photo staging, durable-session pattern) is
strong and correctly grounded in shipped code.

What this cycle surfaces is a **shift of the remaining risk onto the durable/resume seam and one new
write path that the earlier cycles never exercised**. Codex — the deepest source-grounded lane —
raises two data-loss HIGHs the other lanes missed (Cursor praised the mechanisms without tracing the
two specific seams; Claude did not read source): a **stale-diff / no-freshness-revalidation gap** on
the resumed reconcile Apply path (a persisted `diff_json` applied days later can silently overwrite a
post-scan Orbit edit through the whole-row `updateContactMetadataCore`), and a **grid-API gap** — the
additive-only `Use Contact Values` safety seam as specified cannot be gated from the parent because
`CandidateCardGrid` owns selection internally and exposes no selection to the caller. Beyond those,
Cursor independently found the **20-06 Fix path omits `bumpDataRevisionCore`** — the exact HIGH #1
mechanism, reappearing on the bulk-review write path — plus a `MergeResolutions.primaryMethod`
per-type cardinality gap. None of the findings reverse a locked dossier decision or reintroduce a
resolved HIGH.

### Agreed Strengths (2+ lanes)
- Cycle-3 HIGHs incorporated as concrete mechanisms with named acceptance tests, not prose promises:
  `bumpDataRevisionCore` scalar bump (HIGH #1), post-commit photo apply mirroring import (HIGH #2),
  `resolutions.primaryMethod` consult in merge step 1a (HIGH #3) — codex, cursor, claude.
- Merge writer inverts `purge-dao` fan-out correctly; `field_history` treated as a non-`modified_at`,
  non-FK child with a table-specific reparent (columns verified `001-initial.ts:156-163`) — codex,
  cursor, claude.
- Reconcile apply routes only through the shipped authoritative writers and reuses one shared
  `applyReconcileSelections` helper across detail (20-03) and bulk (20-04), preventing writer drift —
  codex, cursor, claude.
- Photo staging chokepoints correct: evictable `photoTempUri` staged to durable `reconcile-staging/`
  and never handed to `setContactPhotoCore`/`assertSafeRelative` — codex, cursor.
- Durable-session pattern mirrors the shipped `import_sessions` model; non-mutexed
  `createReconcileSessionCore` composed inside one outer `inWriteTransaction` avoids the non-reentrant
  deadlock — cursor, claude.

### Agreed Concerns (2+ lanes)
- **`MergeResolutions.primaryMethod` shape vs dual contention (20-01/20-02)** — cursor (per-type
  cardinality: both phone and email contended is unspecified/untested) and claude (the type's field
  shape is prose-specified, not schema-pinned or contract-tested). Actionable MEDIUM.
- The `contact_redirects` backup-portability gap and the UI-SPEC #5-vs-#12 preselection contradiction
  are named by all three lanes but are **the known, correctly-flagged owner deferrals** — not
  re-raised here (recorded under fact-drift / owner-gate, not counted).

### Divergent Views (resolved by orchestrator source read)
- **Stale-diff on the resumed Apply path (Codex HIGH vs Cursor/Claude silent).** Codex traced that
  `updateContactMetadataCore` is a whole-row overwrite with no `modified_at`/revision predicate
  (verified `contacts-dao.ts:308-335`) and that no plan step (20-03/04/05) captures a scan-time
  freshness token or revalidates a persisted `diff_json` before Apply. Cursor praised the one-way
  safety but did not trace the resume-window staleness; Claude did not read source. **Orchestrator
  adjudication: Codex is correct — counted as a current HIGH.**
- **Additive-only `Use Contact Values` gating (Codex HIGH vs Cursor "explicit and testable").** Cursor
  called the `isAdditiveOnlySelection` helper + whole-selection failure "the right pairing," but did
  not check that the parent can obtain the live selection. Codex traced that `CandidateCardGrid` keeps
  `selectedIds` internal (`CandidateCardGrid.tsx:70`), computes `selectedItems` internally (`:81`),
  exposes no `onSelectionChange`, and takes a static `bulkActions` array (`:44`) — and that
  `runBulkAction` has no additive-only guard for `use-contact-values` (unlike `apply-recommendation`
  at `:99-102`). **Orchestrator adjudication: verified on disk — the safety seam is not realizable
  through the plan's enumerated additive extensions; counted as a current HIGH.**
- **Photo apply "all-or-nothing across process death" (Codex MEDIUM).** True that the
  persistMaster→setContactPhoto window is not crash-atomic, but this is identical to the shipped,
  owner-accepted import path (`import-photo.ts:110`) that the plan deliberately mirrors, and the plan
  already documents post-commit best-effort degradation to "photo unchanged." Recorded as advisory,
  **not counted** (the "all-or-nothing" headline slightly overstates crash-atomicity but the
  mechanism matches accepted precedent).

## Verification Coverage (source-grounding pass — Cycle 4)

Every pre-existing symbol the six PLANs cite was checked against the code on disk. Net-new
phase-20 symbols (merge-dao/`MergeResolutions`, `applyReconcileSelections`, reconcile-photo helpers,
`listMergeCandidates`, `createReconcileSessionCore`, `markCardStatusCore`, `staged_photo_rel_path`,
migration-013 tables, bulk-review DAOs, `ResumeReconcilePrompt`, the extended `CandidateCardGrid`
members) are excluded per the phase manifest.

| Symbol / claim | Status | Evidence |
|---|---|---|
| `listSunCandidates` filters `tracking_enabled = 1` (excludes Unbound → must use net-new `listMergeCandidates`) | VERIFIED | `src/db/sun-picker-read.ts:44` |
| `updateContactMetadataCore` is a bare whole-row `UPDATE contacts` (sets `modified_at`, does NOT bump `data_revision`, no concurrency predicate) | VERIFIED | `src/db/contacts-dao.ts:308-335` |
| Backup sweep gates on `readDataRevision`→`shouldRunAutomaticBackup` | VERIFIED | `src/services/backup-sweep.ts:29-31` |
| `field_history` columns = (id, contact_id, field_col_name, old_value, operation, created_at); NO `modified_at`, NO FK | VERIFIED | `src/db/migrations/001-initial.ts:156-163` |
| `persistMaster` overwrites the canonical master in place / `.bak` swap | VERIFIED | `src/services/photos/photo-storage.ts:325` |
| `persistImportedPhotoPostCommit` (post-commit photo ordering to mirror) | VERIFIED | `src/services/import/import-photo.ts:96` |
| `applyContactMethodDiffCore` whole-list diff (tombstones methods absent from desired list) | VERIFIED | `src/db/contact-methods-dao.ts:99` (tombstone body ~191-215) |
| Partial unique indexes `idx_contact_methods_primary_type`, `idx_external_contact_links_active`; `contacts_prevent_cadence_clear` trigger | VERIFIED | `src/db/migrations/011-contact-lifecycle-schema.ts:178,180,181` |
| `inWriteTransaction` — ONE shared non-reentrant mutex (never nest) | VERIFIED | `src/db/transaction.ts:4` |
| import-session-dao `assertOneChange` / `createImportSession` core+wrapper | VERIFIED | `src/db/import-session-dao.ts:109,121` |
| import-session-read `getResumableSession` (resume-newest/sweep-older) | VERIFIED | `src/db/import-session-read.ts:109` |
| `photoTempUri` is an evictable cache `file://` | VERIFIED | `modules/orbit-contact-picker/index.ts:24` |
| `DuplicateReviewScreen` `onInspect` is a no-op (UI-SPEC #10 merge entry still absent there) | VERIFIED | `src/screens/DuplicateReviewScreen.tsx:239` |
| `normalizeContactMethod` / canonical value semantics | VERIFIED | `src/db/contact-methods-dao.ts:7` |
| `export-manifest` has NO redirect entity (contact_redirects would not survive backup/restore) | VERIFIED | `src/backup/export-manifest.ts` (no `redirect` token) |
| migration 012 `import_session_rows` (source_payload immutable; contact_id nullable ON DELETE SET NULL) | VERIFIED | `src/db/migrations/012-import-sessions.ts:30` |
| `compareRowAndTombstone` (tombstone-beats-older-row restore proofing) | VERIFIED | `src/backup/reconciliation.ts:151` |
| SettingsScreen Contacts Integration section (entry-point home) | VERIFIED | `src/screens/SettingsScreen.tsx:743` |
| `assertSafeRelative` allowlist (rejects temp/staging URIs) | VERIFIED | `src/db/photo-relative-path.ts:47` |
| `bumpDataRevisionCore(exec)` exists | VERIFIED | `src/db/data-revision-dao.ts:5` |
| `setContactPhoto` wrapper (self-bumps data_revision) | VERIFIED | `src/db/contacts-dao.ts:621` |
| `readAllContacts` overloaded (no-arg AND arg forms) + `readContactsByLookupKeys` exist | VERIFIED | `modules/orbit-contact-picker/index.ts:69,76-85` |
| `contact-import-resume-sweep` registers via `registerSweepHook` (launch-sweep, foreground-only) | VERIFIED | `src/services/import/contact-import-resume-sweep.ts:11` |

**Coverage result: 0 MISSING, 0 AMBIGUOUS, 0 UNCHECKABLE among pre-existing cited symbols.** Every
symbol a task depends on resolves on disk. The two load-bearing invariants behind this cycle's HIGH
and the actionable backup-visibility finding — `updateContactMetadataCore` does not bump
`data_revision`, and the backup sweep gates on it — are both VERIFIED, so those findings rest on
confirmed code, not plan assertions.

## Fact-Drift Pass (ADVISORY — not counted toward HIGH/actionable)

Genuine same-fact contradictions across STATE/ROADMAP/PLAN/CONTEXT/UI-SPEC:

- **UI-SPEC #5 vs #12 merge-conflict preselection (KNOWN, owner-gated).** `20-UI-SPEC.md:238-239`
  mandates conflicting-mode with NO preselection; `20-UI-SPEC.md:350-352` says the survivor value is
  preselected-but-overridable. The plans defer to the owner and implement the safer #5 no-preselection
  rule. This is the previously-flagged owner deferral — recorded here as advisory only, **not counted**
  (per the run instructions).
- No other cross-artifact fact contradictions found: `TARGET_VERSION 13` / migration 013 is consistent
  across all six plan manifests; the `contact_redirects` "ONLY if the 20-01 owner checkpoint selects
  add-redirect" conditional is stated identically in every plan; RCN-01/02/03 requirement IDs map
  consistently to plans 20-03/20-04/20-01 respectively; ROADMAP success criteria and PLAN
  must_haves.truths do not disagree on any shared fact.


## Codex Review (Cycle 4)

_Model: gpt-5.6-terra (reasoning=low). Source-grounded (21 file:line citations). Deepest lane this cycle; raised both data-loss HIGHs._

# Phase 20 plan review — convergence cycle 4

## 20-01 — Merge tracer

**Summary:** Strong data-layer groundwork, with the existing schema hazards correctly identified and mostly covered. The remaining gap is how merge interacts with Phase 20’s own durable reconciliation cards.

**Strengths**

- The plan correctly avoids `listSunCandidates` for merge selection: the existing query filters `tracking_enabled = 1`, which would exclude Unbound contacts. [sun-picker-read.ts](/home/bwales/projects/orbit-app/src/db/sun-picker-read.ts:40)
- It correctly treats primary-method and active-source-link uniqueness as pre-reparent hazards; both are partial unique indexes. [011-contact-lifecycle-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/011-contact-lifecycle-schema.ts:175)
- The explicit `field_history` handling is warranted: it has neither an FK nor `modified_at`. [001-initial.ts](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:155)
- Recomputing recency through the existing core preserves the single-writer invariant; `updateContactMetadataCore` deliberately excludes `last_contact`. [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:302)

**Concerns**

- **MEDIUM — merge has no defined reconciliation-session-card lifecycle.** Migration 013 introduces reconciliation cards with a `contact_id` FK, while `mergeContacts` deletes the absorbed contact. The established session pattern uses `ON DELETE CASCADE` for its card/row relationship. [012-import-sessions.ts](/home/bwales/projects/orbit-app/src/db/migrations/012-import-sessions.ts:30) A merge launched from `ReconcileDetailScreen` can therefore silently remove that card, leave its session pending/counts stale, and orphan its staged-photo bookkeeping. The plan needs an explicit rule: reparent, resolve-with-a-merge outcome, or intentionally discard/update the card and finalize the session.
- **LOW — canonical-method dedupe ordering is under-specified when the absorbed primary was explicitly selected.** The plan first honors `primaryMethod`, then collapses canonical duplicates. If the dedupe implementation always keeps the survivor row, it can erase the selected absorbed representation after apparently honoring the choice. Existing method writes treat primary selection as identity-sensitive (`id` comparison). [contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:171) Add a test where the explicitly chosen absorbed primary is canonical-equal to the survivor’s method.

**Suggestions**

- Add a merge/session integration test covering a merge initiated from a pending reconciliation card, including card status, completion counts, and staged-photo cleanup.
- Specify “selected primary wins canonical dedupe” (or explicitly document a different deterministic rule) and test it.

**Risk assessment:** **MEDIUM.** The core merge transaction is carefully planned; the remaining risk is durable-review-state corruption around the newly introduced session tables.

---

## 20-02 — Conflict-resolution UX

**Summary:** The plan sensibly separates selection UI from writing and reuses the typed merge contract. Its only unresolved product issue is the contradictory locked preselection contract, which the plan appropriately flags rather than silently deciding.

**Strengths**

- Importing `MergeResolutions` instead of duplicating its shape prevents the conflict screen and writer from drifting.
- Keeping the choice components DB-free is the right separation given that the existing metadata writer performs a complete mutable-column update. [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:308)
- The plan correctly recognizes that a primary swap needs special ordering because the existing writer clears an old primary before assigning the desired one. [contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:171)

**Concerns**

- **LOW — the UI-SPEC preselection contradiction remains a release blocker for the final UX, even if it is not an implementation blocker.** The plan correctly preserves the safer no-preselection behavior, but should record a single owner decision before device-UAT sign-off so tests have one expected behavior.

**Suggestions**

- Add an explicit “owner decision required before Phase 20 completion” item to the phase verification checklist, not only a backstop note in Plan 02.

**Risk assessment:** **LOW.** The implementation approach is coherent; the outstanding issue is a documented product-contract ambiguity.

---

## 20-03 — Per-contact reconciliation

**Summary:** The plan fixes the previously raised revision and temporary-photo issues in the normal rollback path, but it still lacks stale-review protection and overstates photo atomicity across a crash boundary.

**Strengths**

- The plan correctly detects that the existing metadata core does not bump backup revision. [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:308) The proposed explicit revision bump closes a real backup-sweep visibility gap.
- It correctly stages source photo data before diffing rather than persisting picker-cache paths. The current import pipeline also stages before using a durable relative path. [photo-storage.ts](/home/bwales/projects/orbit-app/src/services/photos/photo-storage.ts:186)
- Using the full current method list is necessary: the existing method diff deletes every seeded method omitted from `current`. [contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:191)

**Concerns**

- **HIGH — no stale-diff / optimistic-concurrency guard protects Orbit edits made after scan.** The plan stores a diff, lets the user deliberate or resume later, then applies it through a whole-row metadata write with no `modified_at` predicate. [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:312) A user edit made after scanning can be overwritten by a previously selected reconciliation value, violating the “never silently overwrite Orbit data” invariant. This also affects Plan 04’s durable bulk cards and Plan 05 resume.
- **MEDIUM — “all-or-nothing across DB and canonical file” is not true across process death.** The proposed post-commit flow persists to the fixed `avatars/contact-<id>.jpg` path, then separately calls `setContactPhoto`. The current storage implementation replaces that canonical file before the later DB write. [photo-storage.ts](/home/bwales/projects/orbit-app/src/services/photos/photo-storage.ts:325) The existing import flow has the same best-effort ordering. [import-photo.ts](/home/bwales/projects/orbit-app/src/services/import/import-photo.ts:110) A crash or failing DB write between these operations can leave the existing DB reference pointing at new bytes, despite reporting that the photo remained unchanged.

**Suggestions**

- Capture the contact’s `modified_at` at scan time and, at Apply, either re-diff/reload or require `UPDATE ... WHERE id=? AND modified_at=?`; on mismatch, refresh the field and require a new explicit choice.
- For photo durability, use a versioned destination path plus a small durable post-commit/journal record, or preserve and recover the prior pointer/file until `setContactPhoto` commits. Add a process-death—not merely rollback—test.

**Risk assessment:** **HIGH.** A durable review without freshness validation can overwrite legitimate local edits; the photo flow is consistent in normal error handling but not crash-atomic as claimed.

---

## 20-04 — Bulk reconciliation workspace

**Summary:** Reusing the card grid and session model is correct, but the proposed additive-only safety seam cannot be implemented with the current `CandidateCardGrid` API.

**Strengths**

- The plan correctly extends rather than forks the grid; the current grid already has a recommendation exclusion mechanism. [CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:96)
- It correctly notes that the grid’s catch path marks every target failed when the caller throws, so per-card handling belongs in the caller. [CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:106)
- A one-transaction session/card build follows the existing accepted-import pattern. [import-session-dao.ts](/home/bwales/projects/orbit-app/src/db/import-session-dao.ts:147)

**Concerns**

- **HIGH — `Use Contact Values` cannot be dynamically gated from the parent with the current grid contract.** `CandidateCardGrid` owns `selectedIds` internally, computes `selectedItems` internally, and accepts only a static `bulkActions` array. [CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:41) [CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:70) `ReconcileGridScreen` therefore cannot “include Use Contact Values only when the current selection is additive-only” as written. Static inclusion would expose the unsafe action; omitting it would prevent the feature.
- **HIGH — bulk cards inherit the stale-diff overwrite risk from Plan 03, amplified by process-death resume.** No plan step stores a scan revision or revalidates current Orbit/source data before applying persisted `diff_json`.

**Suggestions**

- Extend the grid API explicitly, for example with `getBulkActions(selectedItems)` or a controlled `selectedIds`/`onSelectionChange` contract. Enforce the additive-only condition in both rendering and `runBulkAction`, not only UI visibility.
- Persist a scan-time contact revision/source snapshot, then re-diff or reject stale cards at per-card and bulk-apply time.

**Risk assessment:** **HIGH.** The bulk safety invariant is not realizable through the stated component API, and stale persisted cards can violate the core non-overwrite requirement.

---

## 20-05 — Resume and missing-source lifecycle

**Summary:** The launch-sweep approach matches the app’s lifecycle model and the missing-source rules are appropriately non-destructive. It needs a policy preventing a fresh scan from silently replacing unresolved prior work.

**Strengths**

- The plan correctly mirrors the existing foreground-only registration pattern; the current import sweep registers through the launch-sweep hook and performs no work on import. [contact-import-resume-sweep.ts](/home/bwales/projects/orbit-app/src/services/import/contact-import-resume-sweep.ts:112)
- The import implementation demonstrates direct-column staged-photo cleanup rather than parsing payloads. [contact-import-resume-sweep.ts](/home/bwales/projects/orbit-app/src/services/import/contact-import-resume-sweep.ts:89)
- The relink preflight correctly follows the actual global unique index shape. [011-contact-lifecycle-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/011-contact-lifecycle-schema.ts:180)

**Concerns**

- **MEDIUM — “resume newest / discard older” can silently abandon unresolved reconciliation work.** The established import read does discard older pending sessions while choosing the newest. [import-session-read.ts](/home/bwales/projects/orbit-app/src/db/import-session-read.ts:109) Plan 04 allows creating a new bulk check, but no plan step blocks that action when a pending reconciliation session exists or asks the user to resume/discard it first. That undermines the durable-resumable promise.
- **MEDIUM — Plan 05 resumes stale cards without addressing Plan 03’s missing revision/source freshness validation.** A long absence is specifically in scope here, making stale stored reconciliation data more likely.

**Suggestions**

- Before a new “Check linked contacts,” detect a pending reconciliation session and require Resume or explicit Discard.
- On resume, revalidate each card before enabling Apply; stale cards should refresh into a new diff rather than reuse old selections.

**Risk assessment:** **MEDIUM.** The lifecycle mechanism is aligned with existing code, but prior unresolved work and stale source/orbit state need explicit handling.

---

## 20-06 — Bulk-review resolver and phase gate

**Summary:** This is a narrowly scoped, well-grounded carry-forward surface. The planned durable-resolution model matches the current immutable import-row design.

**Strengths**

- The plan correctly avoids mutating immutable import payload history: `source_payload` is stored on the import row and has no resolution field. [012-import-sessions.ts](/home/bwales/projects/orbit-app/src/db/migrations/012-import-sessions.ts:30)
- It correctly uses a complete metadata update for a birthday change, since the existing core overwrites all metadata fields. [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:308)
- The proposed `bulk_review_resolutions` table is appropriately local/session-derived rather than portable relationship data; current exports intentionally exclude local-only history-like state. [export-manifest.ts](/home/bwales/projects/orbit-app/src/backup/export-manifest.ts:12)

**Concerns**

- **LOW — Task 1’s automated command omits `bulk-review-dao.test.ts`, despite the acceptance criteria requiring it.** The end-of-phase full suite catches it later, but the task-level verify should run both files.

**Suggestions**

- Change Task 1 verification to run both `bulk-review-read.test.ts` and `bulk-review-dao.test.ts`.

**Risk assessment:** **LOW.** The design is appropriately contained; the issue is only test-command completeness.

---

## Overall risk assessment: HIGH

The merge mechanics and durable-session foundations are thoughtfully grounded in the repository. Two unresolved issues are material:

1. Plan 04’s additive-only bulk action cannot be safely exposed through the current grid API.
2. Plans 03–05 lack stale-diff protection, allowing resumed or delayed reconciliation selections to overwrite Orbit edits made after the scan.

Resolve those before execution; the rest of the plan is substantially stronger and aligns well with the existing transaction, migration, recency, and import-session patterns.

---

## Claude Review (Cycle 4)

_Model: sonnet (reasoning=low). PLAN-TEXT-ONLY this pass — the lane explicitly did not re-open the repo, so its verdict is NOT counted at full source-grounded weight (workflow rule)._

# Cross-AI Review: Phase 20 Plans (20-01 through 20-06) — Convergence Cycle 4

## Summary

This is a data-layer-heavy phase whose plans have already absorbed three rounds of review. The remaining plan text is unusually dense with mitigations for previously-raised findings (HIGH #1 data_revision bump, HIGH #2 photo atomicity, HIGH #3 primary-method consultation), and each is now explicitly wired into acceptance criteria and grep-checks. I could not execute the referenced greps/tests myself against the live repo in this pass (no tool calls were made to re-open files beyond what's already quoted in context), so findings below are graded by internal-consistency analysis against the plan text and the RESEARCH/PATTERNS/UI-SPEC documents provided, not fresh source reads. Overall the plans are coherent and the three prior HIGHs read as resolved on paper. What remains is a handful of MEDIUM-severity gaps around test-enforcement rigor, one real ordering ambiguity in 20-01, and scope-creep risk in 20-03's photo pipeline.

## Strengths

- **Integrity-hazard sequencing is now explicit and testable** (20-01 Task 1): primary-demotion, duplicate-active-link retirement, and canonical-dedupe-with-provenance-remap are all ordered *before* reparent, with dedicated tests named per hazard. This directly answers Pitfall 1/RCN-03 from RESEARCH.
- **The primary-method resolution consultation (HIGH #3)** is now bidirectionally wired: `mergeContacts` step (1a) branches on `resolutions.primaryMethod` (20-01), and `MergeConflictsScreen`'s Continue-enabled predicate is required to block on an unresolved contention (20-02 Task 3 acceptance criteria). This closes the "decorative control" failure mode a shallower review would miss.
- **field_history reparent column mismatch is caught precisely** — the plan correctly notes field_history has no `modified_at` column (traceable to `001-initial.ts:156-162` per RESEARCH) and mandates a distinct UPDATE statement. This is a real, easy-to-miss SQLite footgun (a generic reparent template across 8 tables would silently break on the 9th).
- **Post-commit-vs-in-transaction photo ordering (HIGH #2)** is grounded in a real precedent (`persistImportedPhotoPostCommit`, import-photo.ts:96-135) rather than invented from scratch — reusing an already-proven pattern for exactly the same crash-safety hazard (persistMaster overwrites-in-place + deletes `.bak`).
- **20-04's `createReconcileSessionCore` vs `createReconcileSession` distinction** correctly identifies a nested-mutex deadlock hazard (`inWriteTransaction` is non-reentrant per `transaction.ts`) that a less careful plan would miss when composing an atomic multi-row session-build inside a single txn.
- **Wave sequencing is sound**: 20-01 (data layer + minimal UI) → 20-02 (merge UI depth) → 20-03 (per-contact reconcile) → 20-04 (bulk reconcile, reuses 20-03's shared apply helper) → 20-05 (durability/relink) → 20-06 (bulk-review + gate). Each wave's `depends_on` matches its actual code dependencies (e.g., 20-04 needs `applyReconcileSelections` from 20-03, not vice versa).

## Concerns

**HIGH**
- None identified that survive the plans' own stated mitigations. The three cycle-3 HIGHs appear addressed in text; I flag below where the *enforcement* of that text (test/grep) is weaker than the claim.

**MEDIUM**
- **20-01's `MergeResolutions` type is defined but its `customFields`/`primaryMethod` shape is only prose-specified, not schema-pinned in the acceptance criteria.** The plan says "Export a NAMED `MergeResolutions` type... (fields: scalar choices..., `customFields` keyed by field_def_id, an optional `primaryMethod` choice, and an optional `photo` choice)" but the acceptance criteria only grep for the type's *existence*, not its field names. If 20-01's actual implementation names fields differently than what 20-02 assumes when importing (e.g., `primaryMethod` vs `primaryMethodChoice`), TypeScript will catch it at `tsc --noEmit` time in 20-02 — which is a reasonable backstop — but there's no cross-plan contract test proving the shape matches 20-02's consumption pattern before that point. Low risk given tsc will catch it, but worth flagging since this is exactly the kind of implicit-shape-matching failure mode reviewer finding 1 (cited in the plan) was meant to close, and the closure is only partial (named-type import, not a shape-conformance test).
- **20-03's reconcile photo-staging pipeline is a substantial net-new subsystem** (`SAFE_RECONCILE_STAGING_RELATIVE`, `stageReconcilePhoto`, `resolveReconcileStagingUri`, `listReconcileStagingPhotos`, `deleteReconcileStaging`, `stageReconcileSourcePhoto`, `promoteReconcilePhoto`, plus a content-hash computation) introduced to solve a real problem (RESEARCH Pitfall 5: `photoTempUri` is evictable). This is the single largest scope item added across the whole convergence history and it's justified, but it's worth naming explicitly as a place where "no new mechanism" (RESEARCH's stated design principle) is not quite true — it's a new mechanism mirrored tightly from an existing one, which is a reasonable compromise but should be watched for further growth in 20-04/20-05 rather than re-derived per plan.
- **20-01's checkpoint (`add-redirect` vs `tombstone-only`) leaves migration 013's final shape genuinely undetermined at review time.** Every downstream plan (20-02 through 20-06) carries the same conditional "`contact_redirects` ONLY if..." language in its manifest. This is correctly flagged as an owner-gated one-way-door decision, but it means the plans as written cannot be fully executed without a human decision landing first — which the plan does correctly gate via `<task type="checkpoint:decision" gate="blocking-human">`. Not a defect, just worth noting as the one true blocking dependency in the whole set.
- **20-04's bulk `Apply Recommendations` action interacts with the additive-only safety seam in a way that's only partially specified.** The plan says `Apply Recommendations` "leaves `needs_review` conflicts unresolved (card → partial with a remaining count)" — correct per Cluster J — but does not specify what happens to the *photo* family recommendation state under bulk apply, given 20-03 established that photo requires a manual side-by-side choice with no reliable auto-recommendation (Pitfall 5 / Cluster Q). If `classifyReconciliation` never emits an "additive" outcome for photo (since there's no fingerprint-based auto-recommendation), this is moot — but the plan doesn't explicitly state that photo is excluded from bulk auto-apply, which is worth a one-line confirmation in 20-04 to avoid an implementer accidentally wiring photo into `Apply Recommendations`.

**LOW**
- 20-06's `bulk_review_resolutions.flag_type CHECK IN ('birthday')` single-valued-for-v1 constraint is well-flagged as a deliberate scope limit (reviewer finding 6 addressed), but the phase-wide artifact manifest repeats this table across all six plans' "Artifacts this phase produces" sections — mostly harmless duplication for context-window purposes but worth noting these manifests are large and repeated near-verbatim six times; if the actual project uses this doc as a diff-tracking source, keeping it perfectly in sync across all six files is a maintenance burden with no automated check identified in the plan.
- The `20-05` precedence helper `resolveActiveResumePrompt` is well-specified and tested, but App.tsx wiring is verified only by `grep`, not by a rendered-output test (e.g., no RNTL/snapshot test asserting only one Modal is visible when both are pending). Given this is a UI-only regression class (two overlapping non-dismissable modals would be a real but discoverable-in-QA bug), grep + device-UAT is a proportionate bar — flagging as LOW rather than MEDIUM.

## Suggestions

- Consider adding one explicit line to 20-01 confirming `MergeResolutions`'s field names verbatim (e.g., `{ scalars: {...}, customFields: Record<number, string>, primaryMethod?: {...}, photo?: {...} }`) so 20-02's Task 3 isn't inferring the shape from prose across a plan-file boundary — cheap insurance against a naming mismatch that would otherwise only surface as a tsc error mid-execution of a later wave.
- In 20-04, add one sentence to the `Apply Recommendations` bullet confirming photo-family cards are never included in a bulk auto-apply pass (since `classifyReconciliation` treats photo as manual-only per Cluster Q) — removes any ambiguity for whoever implements the bulk-action reducer.
- Nothing else rises to actionable; the plan set is unusually well-instrumented with acceptance-criteria greps for its own stated invariants, which is the right way to make a fourth convergence cycle converge.

## Risk Assessment

**LOW-MEDIUM.** The three substantive HIGHs from cycle 3 are addressed with concrete mechanisms (not just prose promises) and each has a corresponding grep/test acceptance criterion. Remaining concerns are about tightening cross-plan contract enforcement (type-shape, photo-in-bulk-apply) rather than missing mitigations. The one true blocking item — the redirect-table owner checkpoint in 20-01 — is correctly modeled as a human gate rather than silently defaulted. Execution risk is concentrated in 20-01 (the irreversible migration + the highest-complexity atomic writer) and 20-03 (the largest net-new subsystem, photo staging), both of which have the most thorough test coverage in the set.

---

## Cursor Review (Cycle 4)

_Model: unknown. Source-grounded (verified mechanisms at exact file:line on disk)._

# Phase 20 Plan Review — Convergence Cycle 4

## Summary

After three revision rounds, these six plans are strongly grounded in the shipped codebase. Verified on disk: `listSunCandidates` excludes Unbound contacts (`src/db/sun-picker-read.ts:44`), `updateContactMetadataCore` does not bump `data_revision` (`src/db/contacts-dao.ts:308-335`), the backup sweep gates on `readDataRevision` (`src/services/backup-sweep.ts:29-31`), `field_history` has no `modified_at` column (`src/db/migrations/001-initial.ts:156-162`), `photoTempUri` is evictable cache (`modules/orbit-contact-picker/index.ts:19-24`), `persistMaster` overwrites in place (`src/services/photos/photo-storage.ts:325-378`), import photo apply is post-commit (`src/services/import/import-photo.ts:96-115`), `applyContactMethodDiffCore` tombstones methods absent from the desired list (`src/db/contact-methods-dao.ts:191-215`), and the write mutex is non-reentrant (`src/db/transaction.ts:12-17`). Cycle 3 HIGHs (scalar backup visibility, photo all-or-nothing apply, primary-method resolution consumption) are addressed in the current plan text. What remains are owner-bucket decisions, one UI-spec contract gap, a deferred duplicate-review entry point, and a few secondary integration edges not yet spelled out.

## Strengths

- **Tracer-first wave ordering is sound.** Migration 013 + `mergeContacts` in 20-01 de-risks the hardest layer (multi-table atomic write, partial unique indexes, `field_history` reparent without `modified_at`) before UI expansion.
- **Merge writer design matches purge in reverse.** Pre-resolution of competing primaries, duplicate active source links, custom-field collisions, and provenance remap-before-delete directly addresses verified hazards in `011-contact-lifecycle-schema.ts:178-180` and `contact-methods-dao.ts:191-215`.
- **Reconcile apply mirrors the shipped import photo pipeline.** Staging at scan, scalar/method writes in-txn, `bumpDataRevisionCore` for scalar-only applies, and post-commit `promoteReconcilePhoto` → `setContactPhoto` correctly follow `import-photo.ts:96-115` and `photo-storage.ts:325-378`.
- **Shared `applyReconcileSelections` (20-03) reused by bulk (20-04)** prevents detail/bulk writer drift — the main integration failure mode from prior cycles.
- **Durable-session pattern is correctly adapted.** `createReconcileSessionCore` (non-mutexed) composed inside one outer `inWriteTransaction` avoids the proven deadlock in `transaction.ts:12-17`; atomic scan-then-persist avoids half-built resumable sessions.
- **Additive-only bulk safety is explicit and testable.** `isAdditiveOnlySelection` + `CandidateCardGrid`’s whole-selection failure on thrown `onBulkAction` (`CandidateCardGrid.tsx:106-121`) are the right pairing.
- **Prior reviewer findings are incorporated, not re-litigated.** `listMergeCandidates` (not `listSunCandidates`), exported `MergeResolutions`, reconcile chip labels, nav params `{ contactId, sessionId?, cardId? }`, `getNewestPendingReconcileSessionId`, and ReconcileDetail merge entry are all present in the current plans.

## Concerns

### HIGH

None remaining among implementation-spec gaps. Cycle 3 HIGHs are addressed in plan text and have concrete acceptance tests specified.

### MEDIUM

- **20-01 owner checkpoint blocks Wave 1 (`contact_redirects`).** The blocking decision is correctly in the owner bucket, but execution cannot proceed until it is resolved. If `add-redirect` is chosen, the plans correctly flag that `src/backup/export-manifest.ts` has no redirect entity (verified: no matches) — a redirect row would not survive backup/restore without a portable-schema follow-up in the same phase.
- **Locked UI-spec inconsistency on merge-conflict preselection (20-02).** `20-UI-SPEC.md:238-239` mandates conflicting-mode with **no** preselection; `20-UI-SPEC.md:350-352` says survivor value **preselected but overridable**. The plan defers to owner and implements the safer #5 rule. This is honest, but the locked doc still contradicts itself until the owner reconciles it.
- **`DuplicateReviewScreen` merge entry still deferred (20-03).** UI-SPEC #10 (`20-UI-SPEC.md:334-336`) requires merge from “reconciliation/**duplicate** detail.” ReconcileDetail is covered; `DuplicateReviewScreen` still has `onInspect={() => undefined}` (`src/screens/DuplicateReviewScreen.tsx:239`). Profile + reconcile detail may satisfy RCN-03 reachability, but the duplicate-review path remains a product-surface gap vs the locked UI contract.
- **Bulk-review Fix path omits `bumpDataRevisionCore` (20-06).** Fix stores birthday via `updateContactMetadataCore` in one txn, but that writer does not bump revision (`contacts-dao.ts:308-335`). The reconcile path explicitly closes this gap (20-03); bulk-review Fix does not. A fixed birthday could be omitted from the next automatic backup — the same class of bug as resolved HIGH #1, applied to a different write path.
- **`MergeResolutions.primaryMethod` shape is ambiguous for dual contention (20-01/20-02).** Step (1a) branches “for that method_type,” but the exported type describes “an optional `primaryMethod` choice” (singular). If both phone and email have competing primaries, the type/UI/writer contract for holding two independent choices is unspecified; tests only cover one method type.

### LOW

- **Bounded 20-01 tracer gap (acknowledged).** SurvivorSelect → MergeImpactSummary without MergeConflictsScreen means genuinely conflicting merges silently survivor-win until 20-02. Correctly flagged; not data-loss, but a one-wave UX hazard if 20-01 ships alone to device.
- **Cadence / Bound–Unbound conflicts not surfaced in MergeConflictsScreen (20-02).** Conflicts listed are name, birthday, category, photo, custom fields only. Bound/Unbound or interval disagreements survivor-win silently. That avoids `contacts_prevent_cadence_clear` ABORT (`011:181-186`), but two Bound contacts with different cadences would merge without explicit user choice.
- **Bulk scan holds all contacts in memory before persisting (20-04).** Acceptable for personal-scale use, but no incremental session creation or progress beyond the grid `scoring` state; very large linked sets could mean a long blocking scan.
- **Bulk-apply integration test deferred to 20-06 gate.** 20-04 acceptance criteria reference it, but Task 3 automated verify runs only `reconcile-bulk-eligibility.test.ts`. Coverage depends on 20-06 Task 2 executing the full matrix — acceptable if that gate is enforced, brittle if skipped.

## Suggestions

1. **Resolve the 20-01 checkpoint before execution.** Default `tombstone-only` is consistent with RCN-04 and `compareRowAndTombstone` (`src/backup/reconciliation.ts:151-155`). If the owner wants `contact_redirects`, bundle portable export/restore in the same wave — the plan already flags this; make it a hard dependency, not a footnote.
2. **Owner: pick one merge-conflict preselection rule** and update `20-UI-SPEC.md` #12 or #5 so 20-02’s implementation rule matches the locked contract.
3. **Add a small follow-up task (or 20-06 scope) for `DuplicateReviewScreen` inspect → merge**, routing into `SurvivorSelectScreen` with both candidate ids — or explicitly amend UI-SPEC #10 to exclude duplicate review if that is intentional.
4. **20-06: call `bumpDataRevisionCore(exec)` in the Fix txn** alongside `updateContactMetadataCore`, mirroring `applyReconcileSelections`; add a read-before/after `data_revision` test parallel to 20-03 HIGH #1.
5. **Define `primaryMethod` as per-type** (e.g. `Record<ContactMethodType, methodUid>` or separate phone/email fields) in `MergeResolutions`, `normalizeMergeResolutions`, MergeConflictsScreen, and merge-dao step (1a); add a test with simultaneous phone + email contention.
6. **Optionally add cadence/tracking to merge conflict detection** when both contacts are Bound with different `interval_days`, or document survivor-wins as the explicit product rule in the dossier/UI spec.
7. **Keep 20-06 verification gate non-skippable** — it is the only plan that explicitly runs the bulk-apply integration test and consolidated device UAT covering all seven human-check scenarios.

## Risk Assessment

**Overall: MEDIUM**

The data-layer design is the strongest part of these plans: merge atomicity, reconcile one-way safety, method whole-list apply, photo staging/post-commit ordering, and session durability all trace to verified mechanisms in the current codebase. Residual risk concentrates in (a) the unresolved owner checkpoint and UI-spec contradictions, (b) the duplicate-review merge entry still missing, (c) the bulk-review backup-visibility gap, and (d) the one-wave tracer/conflict UI gap between 20-01 and 20-02. None of these appear to be silent data-corruption paths if waves execute in order and the specified tests land; they are primarily product-surface completeness, backup consistency, and execution-gating issues. With the owner checkpoint resolved and the four MEDIUM items above addressed, these plans are ready to execute.

---

# CYCLE 3 AND EARLIER — AUDIT HISTORY (preserved below)

> The sections below are the cycle-3, cycle-2 and cycle-1 reviews, preserved as historical
> record. They were addressed (or their unresolved items carried forward) by the intervening
> revisions; do NOT re-action from here — see Cycle 4 above for the current unresolved set.

---

# Cross-AI Plan Review — Phase 20 (Convergence CYCLE 3)

> Cycle 3 re-review of the six Phase-20 plans AFTER two prior revision rounds. All three
> explicitly-requested lanes (codex, claude, cursor) ran and returned substantive reviews. The
> `--claude` self-skip guard (`$CLAUDE_CODE_ENTRYPOINT=cli` would normally skip claude) was
> overridden for this run at owner instruction, so the Claude/Sonnet lane ran as a context-isolated
> reviewer. **The headless claude lane carried the `[reviewed-without-source-citations]` marker**
> (it declared source-grounded evidence but cited no `file:line`), so it effectively reviewed the
> plan text only — its verdict is noted but NOT counted at full source-grounded weight per the
> workflow rule. Codex and Cursor both reviewed against the repo on disk with `file:line` evidence.
> An orchestrator source-grounding pass independently verified every HIGH below against the code on
> disk; a cross-artifact fact-drift pass was also run. Both blocks follow the Consensus Summary.
>
> **Cycle-1 and Cycle-2 findings are preserved as AUDIT HISTORY at the bottom of this file. Do not
> re-action resolved items from there.** This cycle reports only what REMAINS unresolved in the
> CURRENT plan state.

## Consensus Summary (Cycle 3)

The plan set remains mature and well grounded in the shipped SQLite/lifecycle code — all three lanes
agree the prior-cycle HIGHs (field_history reparent ABORT, reconcile photo-staging durability, typed
`MergeResolutions`, additive-only bulk gate, resume precedence) are incorporated, and the data-layer
merge writer (20-01) is correctly modeled on `purge-dao` with verified integrity ordering. What this
cycle surfaces is a shift in the risk surface from the data-layer core to **cross-plan seams**: two
grounded data-integrity HIGHs concentrated in the 20-03 reconcile APPLY path (backup-revision and
photo-file atomicity), one cross-plan contract HIGH (a merge UI control whose choice the writer never
consumes), and a cluster of 20-04 bulk-UX integration gaps (chip rendering, per-action bulk-apply
semantics, grid↔detail navigation contract). None reverse a locked dossier decision or reintroduce a
resolved finding.

### Agreed Strengths (2+ lanes)
- Merge writer (20-01) correctly inverts `purge-dao` fan-out; `field_history` treated as a
  non-`modified_at`, non-FK child with a table-specific reparent (codex, cursor, claude).
- Photo staging chokepoints are right: evictable `photoTempUri` is staged to durable
  `reconcile-staging/` and never handed to `setContactPhotoCore`/`assertSafeRelative` (codex, cursor).
- Reconcile apply routes only through existing authoritative writers; the whole-list
  `applyContactMethodDiffCore` data-loss path is guarded by a dedicated current∪accepted helper test
  (codex, cursor, claude).
- Owner gates (migration-013 redirect checkpoint, accent-vs-danger merge confirm) are explicit, and
  the bounded 20-01→20-02 conflict-UI gap is disclosed rather than dropped (codex, cursor, claude).

### Agreed Concerns (2+ lanes)
- **20-03 reconcile APPLY is the highest-risk residual surface** — codex raises two grounded HIGHs
  there (backup-revision, photo atomicity); cursor independently flags 20-03 Task 3 as overloaded,
  which compresses testing of exactly that photo-apply boundary.
- **20-04 bulk layer is thinner than the DAO layer** — cursor raises three MEDIUMs (chip labels,
  bulk-apply semantics, grid↔detail contract); claude echoes bulk/scan interaction risk.

### Divergent Views
- **Merge-conflict preselection.** Codex (grounded) flags that 20-02's *no-preselection* rule
  contradicts UI-SPEC **#12** ("survivor value preselected but overridable"). This is the mirror of
  cycle-2's note (which flagged the opposite direction); the root cause is that the **UI-SPEC is
  internally inconsistent** between widget contract #5 and merge screen #12. Needs an owner/spec
  reconciliation, not a plan-only fix.
- **Primary-method resolution.** Only the down-weighted claude lane raised the primary-method
  contract HIGH — but the orchestrator source-grounding pass independently verified it against the
  plan text (20-01:151 step 1a vs 20-02:138/148), so it is carried as a real HIGH, not dismissed
  with the lane.

---

## Verification Coverage (source-grounding pass — Cycle 3)

Every HIGH below was verified against the code on disk (not the plan's assertion). Pre-existing
symbols cited by the six plans (excluding this-phase artifacts per the manifest) were spot-resolved;
the cycle-2 coverage table already VERIFIED the bulk of the pre-existing symbol set and nothing in
the current plans removed or renamed those citations. New/changed verifications this cycle:

| Claim / symbol | Plan | Verdict | Evidence |
|---|---|---|---|
| `updateContactMetadataCore` does NOT bump `data_revision` (bare `UPDATE contacts`) | 20-03,04 | VERIFIED | `src/db/contacts-dao.ts:308-335` |
| `applyContactMethodDiffCore` bumps only `if (changed)` | 20-03 | VERIFIED | `src/db/contact-methods-dao.ts:277` |
| `setContactPhotoCore`/`setContactPhoto` DO bump `data_revision` | 20-01,03 | VERIFIED | `src/db/contacts-dao.ts:643` |
| `backup-sweep` keys on `data_revision` (`readDataRevision` → `shouldRunAutomaticBackup`) | 20-03 (impact) | VERIFIED | `src/services/backup-sweep.ts:29-31,63` |
| `contactPhotoRelPath` is deterministic per-contact (`avatars/contact-<id>.jpg`) | 20-03 | VERIFIED | `src/services/photos/photo-storage.ts:85-88` |
| `persistMaster` overwrites the canonical master in place and deletes the `.bak` at step 4 | 20-03 | VERIFIED | `src/services/photos/photo-storage.ts:325-378` |
| `listSunCandidates` filters `tracking_enabled = 1` (excludes Unbound) | 20-01 | VERIFIED | `src/db/sun-picker-read.ts:40-46` |
| UI-SPEC internal preselection conflict (#5 "no preselection" vs #12 "survivor preselected") | 20-02 | VERIFIED | `20-UI-SPEC.md:238-239` vs `:350` |
| `export-manifest`/`restore-apply` have NO `contact_redirects` entity; no 20-plan adds it | 20-01 | VERIFIED | `src/backup/export-manifest.ts` (absent); no PLAN references backup schema |
| `MergeResolutions` carries `primaryMethod` but merge writer step (1a) never consumes it | 20-01,02 | VERIFIED | `20-01-PLAN.md:151` (unconditional demote) vs type at `:151`; `20-02-PLAN.md:138,148` |
| 20-03 `ReconcileDetailScreen` route param = contactId only (no session/card) | 20-03,04 | VERIFIED | `20-03-PLAN.md:163` vs `20-04-PLAN.md:144` inspect/return |

**UNCHECKABLE / deferred:** device/UI-observable claims (Pixel UAT, Skia render) are correctly
deferred to end-of-phase device UAT — not counted as MISSING. No MISSING symbols found: every cited
pre-existing symbol resolved. The HIGH findings are **semantic-contract** gaps (a cited primitive
does what its signature says, but the plan's composition of primitives leaves a durability/atomicity/
contract hole), which is the substantive review output — not symbol-absence.

## Fact-Drift Pass (ADVISORY — not counted toward HIGH/actionable)

One genuine same-fact contradiction, plus one benign status difference:

- **UI-SPEC internal contradiction (real).** Surface **#5** (reusable widget contract) mandates
  "conflicting → **no** preselection; user must choose explicitly" (`20-UI-SPEC.md:238-239`), while
  surface **#12** (Merge field-conflict resolution) says each scalar conflict renders "survivor value
  **preselected** but overridable" (`20-UI-SPEC.md:350`). 20-02 follows #5. A locked design contract
  cannot mandate both for the same merge-conflict widget — owner/spec reconciliation needed. (This is
  the root of the actionable M3 below and reverses the direction of cycle-2's preselection note, which
  the plan revision addressed by switching to no-preselection.)
- **Phase status (benign).** STATE.md `ready_to_execute` / "Phase 20 planned (6 plans)" vs ROADMAP
  progress "Not started" (`[ ]`, 0 plans). Not a contradiction — neither claims *complete*; authority
  STATE.md; wording differs only.
- Requirement IDs (RCN-01..04), ROADMAP success criteria ↔ PLAN `must_haves.truths`, and CONTEXT.md
  decisions (tombstone-not-archive, one-way source→Orbit, additive-only bulk) are used consistently
  across all six plans — no drift.

---

## Codex Review (Cycle 3)

_Model: gpt-5.6-terra (reasoning=low) · source-grounded with `file:line` evidence._

## Summary

The plans are unusually well grounded in the existing SQLite and lifecycle code. The main remaining risks are concentrated in three cross-plan seams: reconcile writes that do not reliably trigger automatic backup, canonical photo-file mutation outside SQL atomicity, and a few contract mismatches in merge/session flows.

## Plan 20-01 — Migration & merge tracer

**Strengths**

- Correctly accounts for `field_history` as a non-FK child; it really has no `modified_at` column or contact FK ([001-initial.ts](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:156)).
- Correctly pre-resolves the two actual partial-index hazards before reparenting ([011-contact-lifecycle-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/011-contact-lifecycle-schema.ts:178)).
- The tombstone path advances `data_revision`, so the merge itself is backup-visible ([tombstones-dao.ts](/home/bwales/projects/orbit-app/src/db/tombstones-dao.ts:52)).

**Concerns**

- **MEDIUM — Unbound contacts cannot be selected for a profile-initiated merge.** The mandated reuse target, `listSunCandidates`, filters to `tracking_enabled = 1` ([sun-picker-read.ts](/home/bwales/projects/orbit-app/src/db/sun-picker-read.ts:40)). RCN-03 covers existing Orbit contacts generally, and imported duplicates are initially Unbound. The “always available” profile action could therefore fail to offer the most relevant merge candidates.
- **MEDIUM, conditional on `add-redirect` — `contact_redirects` would not survive backup/restore.** The export manifest enumerates all portable entity reads and has no redirect table ([export-manifest.ts](/home/bwales/projects/orbit-app/src/backup/export-manifest.ts:45)); restore similarly has a closed entity list ([restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:49)). A future-sync redirect hook that disappears on restore is not durable.

**Suggestions**

- Add a merge-candidate read that includes both Bound and Unbound live contacts; do not reuse the sun picker unchanged.
- If the checkpoint selects redirects, include them in the portable backup schema, export, restore, and backup-format migration—or explicitly choose tombstone-only.

**Risk:** MEDIUM.

## Plan 20-02 — Merge conflicts

**Strengths**

- Uses the existing pure primary-method selector ([contact-methods-editor-model.ts](/home/bwales/projects/orbit-app/src/components/contact-methods-editor-model.ts:112)).
- Correctly avoids treating `impactSummaryLines` as a complete source for the required method/link counts; it omits those rows ([purge-dao.ts](/home/bwales/projects/orbit-app/src/db/purge-dao.ts:176)).

**Concerns**

- **MEDIUM — The plan contradicts the approved UI contract on merge-conflict preselection.** The plan requires no preselection and disables Continue; the approved spec explicitly says merge conflicts preselect the survivor value, overridable ([20-UI-SPEC.md](/home/bwales/projects/orbit-app/.planning/phases/20-contact-reconciliation-merge/20-UI-SPEC.md:347)). The generic field widget’s “no preselection” rule is specifically for reconciliation source conflicts ([20-UI-SPEC.md](/home/bwales/projects/orbit-app/.planning/phases/20-contact-reconciliation-merge/20-UI-SPEC.md:238)).

**Suggestions**

- Resolve this before implementation: preserve the plan’s explicit-choice behavior by updating the UI contract, or make merge conflicts survivor-preselected while keeping reconciliation conflicts unselected.

**Risk:** MEDIUM.

## Plan 20-03 — Per-contact reconciliation

**Strengths**

- The plan correctly identifies that `photoTempUri` is evictable ([orbit-contact-picker/index.ts](/home/bwales/projects/orbit-app/modules/orbit-contact-picker/index.ts:19)) and that photo DB writes accept only `avatars/...` paths ([photo-relative-path.ts](/home/bwales/projects/orbit-app/src/db/photo-relative-path.ts:47)).
- It correctly avoids a partial method list: `applyContactMethodDiffCore` deletes seeded methods absent from the desired list ([contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:180)).

**Concerns**

- **HIGH — Reconcile scalar-only applies can be omitted from automatic backups.** `updateContactMetadataCore` updates contact fields but does not bump `data_revision` ([contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:308)). The method writer only bumps when methods change ([contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:277)). The plan’s accepted name/birthday-only path therefore changes durable relationship data without changing the revision that the automatic-backup sweep uses to decide whether to write ([backup-sweep.ts](/home/bwales/projects/orbit-app/src/services/backup-sweep.ts:27)).
- **HIGH — The proposed photo apply is not all-or-nothing across DB and canonical file state.** The plan persists the new photo master before opening the DB transaction, to the deterministic current-contact path. `persistMaster` replaces that canonical file ([photo-storage.ts](/home/bwales/projects/orbit-app/src/services/photos/photo-storage.ts:325)), while `setContactPhotoCore` may subsequently fail/roll back. The SQL row would still point to the old path—now containing the new bytes—so a failed reconciliation visibly changes the photo despite “nothing changed.”

**Suggestions**

- Make reconciliation’s aggregate writer advance `data_revision` inside its successful transaction, with a test for name/birthday-only acceptance.
- Stage the promoted photo under a transaction-specific durable path, switch the DB reference only after successful preparation, and delete the prior master post-commit. Add a forced-transaction-failure test proving both DB reference and displayed old photo remain unchanged.

**Risk:** HIGH.

## Plan 20-04 — Bulk reconciliation

**Strengths**

- Correctly extends rather than forks `CandidateCardGrid`; the existing grid has exactly the documented recommendation exclusion seam ([CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:95)).
- The atomic “scan first, then create session and cards” intent is sound for avoiding a misleading half-built resumable session.

**Concerns**

- **MEDIUM — The transaction composition contract is ambiguous enough to deadlock.** The project’s `inWriteTransaction` is explicitly non-reentrant ([transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:12)). Plan 04 asks the screen to call `createReconcileSession` and `insertReconcileCardCore` inside one transaction, while the analogous existing `createImportSession` is itself a transaction wrapper ([import-session-dao.ts](/home/bwales/projects/orbit-app/src/db/import-session-dao.ts:121)). Unless the implementation exposes and uses an explicitly named `createReconcileSessionCore`, this hangs permanently rather than atomically creating the session.

**Suggestions**

- Require `createReconcileSessionCore` in the DAO API and make the screen use only that core inside the one outer transaction; alternatively expose one `createReconcileSessionWithCards` wrapper. Add a test that exercises the exact bulk creation composition, not only individual DAO operations.

**Risk:** MEDIUM.

## Plan 20-05 — Resume and relink

**Strengths**

- Properly uses the foreground sweep model already used by import resume ([contact-import-resume-sweep.ts](/home/bwales/projects/orbit-app/src/services/import/contact-import-resume-sweep.ts:116)).
- Correctly recognizes the global active-link uniqueness constraint ([011-contact-lifecycle-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/011-contact-lifecycle-schema.ts:180)).

**Concerns**

- No additional unresolved issue found beyond the Plan 03 photo-atomicity and Plan 04 session-core requirements, which this plan consumes.

**Suggestions**

- Ensure the resume implementation retains only durable staged paths and uses the corrected photo promotion protocol from Plan 03.

**Risk:** MEDIUM, dependency-driven.

## Plan 20-06 — Bulk review & verification

**Strengths**

- Correctly treats import source payload as immutable and puts resolution state in a separate table; existing unreadable-birthday counting is derived from payload only ([import-session-read.ts](/home/bwales/projects/orbit-app/src/db/import-session-read.ts:269)).
- Correctly uses complete contact metadata writes, since the metadata core is not a patch API ([contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:308)).

**Concerns**

- No new plan-local issue found.

**Suggestions**

- Add the missing reconciliation revision-bump and forced-photo-rollback cases to the phase gate, not merely the per-plan tests.

**Risk:** LOW locally; MEDIUM as phase verification depends on earlier fixes.

## Overall risk assessment

**HIGH until the Plan 03 backup-revision and photo-atomicity issues are resolved.** After those fixes, the remaining work is primarily contract clarification and transaction API hardening rather than architectural rework.

---

## Claude Review (Cycle 3)

_Model: sonnet (reasoning=low) · **`[reviewed-without-source-citations]` — plan-text-only, verdict
down-weighted**; the primary-method HIGH it raised was independently source-grounded by the
orchestrator pass above and is carried as a real HIGH._

> [reviewed-without-source-citations] This reviewer declared source-grounded evidence but cited no file:line source evidence, so it reviewed the pasted plan text only — down-weight its verdict in the Consensus Summary.

## Cross-AI Plan Review — Phase 20 (Convergence Cycle 3)

### Summary

The plan set is mature — two prior convergence cycles already closed the major SQLite-integrity risks (partial-unique-index ABORTs, the `field_history` reparent bug, photo-staging durability). This cycle I focused on cross-plan *consistency*, since each plan reads well in isolation but the phase only works if 20-01's writer contract actually matches what 20-02/20-03 promise to feed it. I found one concrete, citable inconsistency in how primary-method conflicts are resolved across 20-01 and 20-02, plus a few lower-severity gaps. Everything else — migration ordering, tombstone/redirect gating, additive-only bulk safety, field_history handling, photo staging — is internally consistent across all six plans.

### Strengths

- **Consistent conditional gating on the owner checkpoint.** Every later plan (20-02 through 20-06) correctly guards `contact_redirects` behind "ONLY if the 20-01 owner checkpoint selects add-redirect" — no plan assumes a schema element that depends on an unresolved decision.
- **Custom-field collision handling is explicit about resolution-consumption.** 20-01's Task 1 action text says the collision path keeps "the survivor's value (survivor-wins default this tracer) **or apply the resolution via `upsertValueCore`**" — i.e., it explicitly branches on whether `resolutions.customFields` supplied a choice. This is the correct pattern (see Concern 1 below for where it's *not* followed).
- **`MergeResolutions` is a single named, exported type** threaded by import (not by convention) from `merge-dao.ts` through `MergeConflictsScreen`/`MergeImpactSummary` (20-02) — this closes what was reviewer finding 1 in an earlier cycle and is verified by an explicit `grep` acceptance criterion in 20-02 Task 3.
- **The bounded-gap disclosure in 20-01** ("if 20-01 ships before 20-02, a scalar conflict resolves as silent survivor-wins — non-destructive, bounded, closed by 20-02") is honest and specifically scoped, which is the right way to sequence a tracer ahead of full conflict UI.

### Concerns

- **HIGH — `mergeContacts`'s primary-method pre-resolution is hardcoded, but 20-02 promises a user-driven choice, and no plan reconciles the two.**
  20-01's Task 1 action (merge-dao.ts) describes step (1a) as: *"if both contribute is_primary=1 for a method_type, demote the absorbed's"* — this is unconditional, with no branch on `resolutions.primaryMethod`. Contrast this with the custom-field collision step (1d) in the same task, which explicitly says "keep the survivor's value... **or apply the resolution**" — i.e., it does consult the resolutions object. The primary-method step has no equivalent "or apply the resolution" clause.
  Yet `MergeResolutions` (defined in this same 20-01 task) is specified to carry "an optional `primaryMethod` choice," and 20-02 Task 3 builds a whole UI step — *"Add primary-method contention ONLY when both contacts contribute a competing is_primary=1 method... using the ContactMethodsEditor `choosePrimary` model... a primary-method choice (applied by mergeContacts via ...)"* — implying the writer *does* honor the user's pick.
  As written, if a user in 20-02's conflict screen explicitly chooses to keep the *absorbed* contact's phone as primary (e.g., because the survivor's number is stale), `mergeContacts` will silently demote it anyway per the unconditional step (1a), and the UI's choice becomes a no-op. Neither plan states that (1a) must check `resolutions.primaryMethod` before defaulting to demote-absorbed. This should be called out as a required change to 20-01's merge-dao action text (and its acceptance criteria/tests), mirroring the custom-field collision pattern, before execution — otherwise 20-02's primary-contention UI ships decorative.
  *Severity note:* this is not data-destructive (the absorbed method still survives as a non-primary, deduped/reparented method), so it's a silent-UX-defeat bug rather than a data-loss bug — hence HIGH rather than CRITICAL.

- **MEDIUM — 20-02's "Continue disabled until every conflict has a selection" acceptance criteria don't explicitly cover the primary-method contention case.**
  20-02 Task 3's acceptance criteria grep for `choosePrimary|primary` to confirm gating exists, but the "Continue disabled until explicit choice" truth is phrased around `FieldChoiceGroup` scalar fields; there's no acceptance criterion proving Continue also stays disabled when a competing-primary case is unresolved. Given the finding above, this makes it easier for the primary-method omission to slip through unnoticed at execution/verification time.

- **LOW — Reconcile photo staging can accumulate cache-adjacent files between launches.**
  20-03's `ReconcileDetailScreen` stages (and content-hashes) every linked source's photo on every mount, and 20-04's bulk scan does the same for every linked contact on every `Check linked contacts` run. Cleanup of `reconcile-staging/` only happens via the 20-05 launch sweep for *abandoned* (session-orphaned) files — a photo staged but not chosen (user picks "keep Orbit photo") during a normal, completed review isn't explicitly swept post-commit in 20-03/20-04's action text (only the *promoted* file gets a post-commit best-effort delete). This is a storage-hygiene nit, not correctness-breaking, but worth a one-line disposal step in 20-03/20-04 for staged-but-unchosen photos.

- **LOW — Large-`address-book` transaction risk is acknowledged but not bounded.**
  20-04's bulk scan builds the entire session + all cards in one `inWriteTransaction` after a full scan+classify pass (correct, for atomicity), but for "hundreds" of linked contacts this could hold the shared non-reentrant write mutex for a long time, and the UI-SPEC itself flags the paging/virtualization strategy as an explicitly unresolved planner assumption (E3). This is consistent with the UI-SPEC's own disclosure, so it's not a new gap, but it's worth flagging again since it interacts with the atomicity requirement (whole-scan-in-one-txn) more than the UI-SPEC anticipated.

### Suggestions

1. Amend 20-01 Task 1's merge-dao action text for step (1a) to read: *"if `resolutions.primaryMethod` specifies a choice, promote that method and demote the other; otherwise demote the absorbed's is_primary=1 method for that type (default)"* — mirroring the phrasing already used for the custom-field collision step. Add a `merge-dao.test.ts` case: "resolutions.primaryMethod selects the absorbed's method → it becomes primary, survivor's is demoted."
2. Add an explicit acceptance criterion to 20-02 Task 3: "Continue is disabled while a competing-primary case exists with no selection" (not just "primary handling exists").
3. Add a one-line disposal step to 20-03/20-04: after a review card resolves without a photo being chosen, best-effort `deleteReconcileStaging` the staged-but-unchosen file (outside the txn), rather than relying solely on the launch sweep for hygiene.

### Risk Assessment

**MEDIUM.** The primary-method inconsistency (Concern 1) is a real cross-plan contract mismatch that would ship a UI control whose choice is silently discarded — worth fixing before execution, since it's cheap to fix now (one clause + one test) and expensive to notice later (it would only surface via manual device UAT with two contacts that both have a primary phone/email, which is a specific scenario easy to miss in the consolidated end-of-phase UAT script). Everything else in the phase — atomicity, tombstone/redirect gating, additive-only bulk safety, durable resume, missing-source/relink, and the previously-fixed field_history/photo-staging issues — is sound and internally consistent across all six plans.

---

## Cursor Review (Cycle 3)

_Model: unknown · source-grounded with `file:line` evidence._

# Phase 20 Plan Review — Convergence Cycle 3

## Summary

After two revision cycles, these six plans are substantially grounded in the shipped codebase: migration head (`TARGET_VERSION = 12` in `src/db/database.ts:47`), `field_history` shape without `modified_at` (`src/db/migrations/001-initial.ts:156-162`), partial-unique-index hazards (`src/db/migrations/011-contact-lifecycle-schema.ts:178-180`), the `applyContactMethodDiffCore` whole-list delete semantics (`src/db/contact-methods-dao.ts:191-215`), evictable `photoTempUri` (`modules/orbit-contact-picker/index.ts:19-24`), and the import photo-staging pattern to mirror. Wave ordering is coherent, prior HIGH findings (field_history reparent, reconcile photo durability, typed `MergeResolutions`, additive-only bulk gate, resume precedence) are incorporated, and acknowledged bounded gaps (20-01 conflict UI deferral to 20-02, DuplicateReview `onInspect` deferral) are documented rather than dropped. What remains are mostly **integration-contract gaps** in the bulk grid layer (chip labels, bulk-apply semantics, grid↔detail navigation) and **execution-risk concentration** in 20-03 Task 3—not fundamental architectural misses.

---

## Strengths

- **Merge writer is correctly modeled on purge, with verified hazards called out.** 20-01 inverts `purge-dao`’s fan-out (`src/db/purge-dao.ts:76-87`) rather than inventing a parallel pattern; it explicitly separates the `modified_at`-bearing child reparent template from `field_history` (`001-initial.ts:156-162`), pre-resolves `UNIQUE(contact_id, field_def_id)` collisions via `upsertValueCore` (`src/db/field-values-dao.ts:64+`), and remaps `contact_method_provenance` before method dedupe (`011-contact-lifecycle-schema.ts:228-232` ON DELETE CASCADE). The integrity ordering matches real ABORT surfaces.

- **Photo durability is specified with the correct chokepoints.** Plans require staging before classify/persist, mirroring `stageImportPhoto` / `persistMaster` (`src/services/import/import-photo.ts:60+`, `src/db/photo-relative-path.ts:22-38`), and never passing cache URIs to `setContactPhoto`/`assertSafeRelative` (`src/db/contacts-dao.ts:621-645`). This directly addresses the evictable `photoTempUri` contract in the native module.

- **Reconciliation apply routes through existing authoritative writers only.** 20-03 prohibits partial method lists (`applyContactMethodDiffCore` tombstones absent seeded methods at `contact-methods-dao.ts:191-215`), requires complete `UpdateContactFullInput` (`contacts-dao.ts:308-335`), and separates photo apply to `setContactPhotoCore`. The method desired-list helper with a dedicated test is the right guard for the highest-risk data-loss path.

- **Durable-session design mirrors proven import infrastructure.** 20-04/20-05 follow `import-session-dao`/`import-session-read` idioms (`assertOneChange`, resume-newest/sweep-older, launch-sweep registration in `App.tsx:123-124`), add corruption-tolerant `getNewestPendingReconcileSessionId`, and unit-test import-vs-reconcile prompt precedence—appropriate for RCN-02 durability.

- **Safety invariants are test-backed, not grep-only.** Named pure helpers (`isAdditiveOnlySelection`, `resolveActiveResumePrompt`, `normalizeMergeResolutions`) with dedicated tests, plus the 20-06 verification gate tied to `20-VALIDATION.md`, give executors concrete proof obligations.

- **Owner gates are correctly placed.** Migration 013 redirect-table decision (`20-01` checkpoint), accent-vs-danger merge confirm (`20-UI-SPEC.md:212-214`, reflected in 20-01 Task 2), and the one-wave MergeConflictsScreen gap are explicit rather than silent.

---

## Concerns

### MEDIUM — Reconcile grid chip labels don’t fit `ConfidenceOutcome` (20-04)

`CandidateCardGrid` always renders `ConfidenceChip` from `item.outcome` (`src/components/CandidateCardGrid.tsx:187`). `ConfidenceOutcome` carries import-specific labels only (`src/components/ConfidenceChip.tsx:4-16`: “Probable match”, “Needs review”, etc.). UI-SPEC requires reconcile-specific advisory chips—“Add”, “Keep Orbit”, “Manual review”, “Source missing” (`20-UI-SPEC.md:216-218`)—that are colourless and semantically distinct from import matching.

20-04 extends `BulkAction` and `scoringLabel` additively but does not extend chip rendering. Without an additive prop (e.g. optional chip label / reconcile outcome type), grid cards will show misleading import copy or force a lossy mapping onto `needs_review`/`probable`.

### MEDIUM — Bulk reconcile apply semantics underspecified (20-04)

The plan rigorously gates **when** `Use Contact Values` appears (`isAdditiveOnlySelection`) but not **how** the three reconcile bulk actions execute:

- `Apply Recommendations` — which preselected fields, snapshot writes per link, partial vs resolved card transitions
- `Keep Orbit Values` — whether this writes reviewed snapshots without applying source values, and how “Kept Orbit values” completion counts increment
- `Use Contact Values` — which field families are applied atomically per card

`DuplicateReviewScreen.resolveAction` (`src/screens/DuplicateReviewScreen.tsx:148-189`) shows the per-card try/catch idiom, but reconcile bulk apply must also compose `updateContactMetadataCore`, `applyContactMethodDiffCore`, `setContactPhotoCore`, and `upsertReviewedSnapshotCore`—the same path as `ReconcileDetailScreen`. Leaving this to executor discretion risks bulk/detail behavioral drift and incorrect completion-bucket accounting (`20-UI-SPEC.md:322-324`).

### MEDIUM — Grid ↔ detail session/card contract missing (20-04)

20-04 wires `onInspect` → `ReconcileDetailScreen` and says “on return, mark the card status,” but neither route params nor a return contract is specified (session id, card id, partial unresolved count). UI-SPEC expects cards to return resolved/partial with remaining-count hints (`20-UI-SPEC.md:285-286, 302-303`). Without an explicit navigation contract (params + focus/blur refresh or callback), partial resolution from detail may not persist to `reconciliation_session_cards` or the grid hint.

### MEDIUM — 20-03 Task 3 is overloaded (20-03)

Task 3 bundles: reconcile photo-staging namespace + storage helpers + `reconcile-photo.ts` + tests; full `ReconcileDetailScreen` with apply-through-writers; profile overflow entry; merge affordance; and a pure method desired-list helper with test. Each piece is individually well-specified, but combining them in one task increases the chance of under-tested apply paths (especially photo promote-inside/outside txn ordering) and makes review harder mid-wave.

### LOW — Reconcile staging cleanup lacks import’s dedicated `photo_rel_path` column (20-04/20-05)

Import rows store staging paths in a first-class column (`src/db/migrations/012-import-sessions.ts:36`; discard queries it at `import-session-dao.ts:437-440`). Migration 013 plans only `diff_json` on `reconciliation_session_cards`. Orphan `reconcile-staging/` cleanup (`20-05`, mirroring `contact-import-resume-sweep.ts:89-109`) therefore depends on parsing every live card’s JSON. That works if `diff_json` is stable, but is more fragile than the import pattern and couples FS hygiene to serializer correctness.

### LOW — No shared “apply reconciliation selections” helper across entry points (20-03/20-04)

Per-contact `Update from Contacts` and bulk `onBulkAction` must share identical writer composition (complete metadata input, method seed∪accepted, photo promote→`setContactPhotoCore`, multi-link snapshot upserts). The plans require the behavior in both places but don’t mandate a single extracted apply function—raising drift risk between the two highest-traffic reconciliation paths.

### LOW — `diff_json` schema is implicit and unversioned (20-04/20-05)

Corrupt/unparseable sessions get a discard-only descriptor via `getNewestPendingReconcileSessionId` (good), but there is no version field or typed schema contract for persisted diffs. Resume, partial cards, and staging orphan reconciliation all depend on JSON shape stability across app versions.

---

## Suggestions

1. **20-04 — Extend `CandidateCardGrid` additively for reconcile chips.** Add an optional `chipLabel?: string` (or `reconcileRecommendation?: …`) prop used instead of `ConfidenceChip` when supplied; keep import call sites unchanged. Map `classifyReconciliation` summary → UI-SPEC copy (“Add”, “Manual review”, “Source missing”) in `ReconcileGridScreen`, and map card-level `outcome` to `needs_review` only for `apply-recommendation` filtering.

2. **20-04 — Specify bulk apply in one place.** Add a short “Bulk apply contract” subsection (or a named pure helper + integration test) defining, per action, which diff outcomes are applied, which snapshots are written, and how `markCardStatusCore`/`unresolved_count` update. Reuse the same helper from `ReconcileDetailScreen` apply to prevent divergence.

3. **20-04 — Define navigation params for grid inspect.** e.g. `ReconcileDetail: { contactId, sessionId, cardId }` with a focus listener that refreshes card state from DB on return; acceptance criterion: partial resolve updates grid hint (“1 of 3 left”) without rescanning all contacts.

4. **20-03 — Split Task 3.** Separate “reconcile photo-staging pipeline + tests” (can land before UI) from “ReconcileDetailScreen + entries.” Keeps the HIGH-risk FS/DB boundary reviewable in isolation.

5. **20-04/20-05 — Consider a `staged_photo_rel_path` column on `reconciliation_session_cards`** (nullable, like import) *or* document a typed `diff_json` v1 schema in `reconcile-diff.ts` exports so orphan cleanup and resume don’t rely on ad hoc JSON parsing. Either reduces FS hygiene fragility.

6. **20-01 — Resolve the owner checkpoint before Wave 1 execution.** The redirect-table decision is correctly owner-gated; note it as a hard prerequisite so migration 013 isn’t authored twice.

---

## Risk Assessment

**Overall: MEDIUM**

The data-layer plans (20-01 merge, 20-03 classify/apply/snapshot, migration 013) are the highest-risk surfaces and are now well-specified against verified schema and writer invariants. Residual risk concentrates in **20-04 bulk UX integration**—where product semantics (chips, bulk apply, grid↔detail lifecycle) are thinner than the DAO layer—and in **20-03 task sizing**, which could compress testing of the photo apply boundary. None of the remaining gaps appear to reverse dossier locked decisions or reintroduce resolved HIGH findings; they are integration and execution-clarity issues addressable with targeted plan amendments rather than replanning the phase.

---

# CYCLE 2 + CYCLE 1 — AUDIT HISTORY (preserved below)

> The sections below are the cycle-2 and cycle-1 reviews, preserved as historical record. They were
> addressed by the intervening revisions; do NOT re-action from here — see Cycle 3 above for the
> current unresolved set.


---
phase: 20
convergence_cycle: 2
reviewers: [codex, claude, cursor]
reviewed_at: 2026-08-30T20:55:52Z
plans_reviewed: [20-01-PLAN.md, 20-02-PLAN.md, 20-03-PLAN.md, 20-04-PLAN.md, 20-05-PLAN.md, 20-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "sonnet (reasoning=low)"
  cursor: "unknown"
model_sources:
  codex: "banner"
  claude: "pinned"
  cursor: "unknown"
cycle_summary:
  current_high: 2
  current_actionable: 10
---

# Cross-AI Plan Review — Phase 20 (Convergence CYCLE 2)

> Cycle 2 re-review of the six Phase-20 plans AFTER they were revised to incorporate cycle-1
> feedback. All three explicitly-requested lanes (codex, claude, cursor) ran and returned
> substantive reviews. The `--claude` self-skip guard ($CLAUDE_CODE_ENTRYPOINT=cli would normally
> skip claude) was overridden for this run at owner instruction, so the Claude/Sonnet lane ran as a
> context-isolated reviewer. **The headless claude lane declared it had no live repo-read access**
> (plan-text-only review) — its verdict is noted but not counted at full source-grounded weight,
> per the workflow's `[reviewed-without-repo-access]` rule. Codex and Cursor both reviewed against
> the repo on disk. An orchestrator source-grounding pass and a cross-artifact fact-drift pass were
> then run; results are in the two blocks after the Consensus Summary.
>
> **Cycle-1 findings are preserved verbatim as AUDIT HISTORY at the bottom of this file.**

## Consensus Summary (Cycle 2)

All three reviewers independently agree the revision is a large improvement and that **every cycle-1
HIGH is resolved in the current plan text**: the custom-field `UNIQUE(contact_id, field_def_id)`
collision pre-resolution, the `contact_method_provenance` capture-then-remap-before-delete ordering,
the net-new `setContactPhotoCore` writer, full-method-list seeding on reconcile apply, the additive
`CandidateCardGrid` extension (with a `scoringLabel` default that keeps import call sites unchanged),
the net-new `ResumeReconcilePrompt`, and the durable `bulk_review_resolutions` table in migration
013. Cursor and Claude found NO remaining HIGH. **Codex — the strongest source-grounded lane —
surfaced two NEW, source-confirmable HIGH issues that the revision's own additions introduced**, both
of which the orchestrator re-verified against `src/` and CONFIRMS.

### Agreed Strengths (2+ reviewers, orchestrator-verified)
- Cycle-1 integrity hazards concretely mitigated with test obligations: custom-field collision pre-resolution, provenance remap before delete (`011-contact-lifecycle-schema.ts:228-233` ON DELETE CASCADE), partial-unique-index pre-resolution (`011:178-180`) — codex, cursor, claude.
- `mergeContacts` correctly inverts the shipped `purge-dao` transaction shape and routes recency only through `recomputeLastContactCore` (never a direct `last_contact` write) — cursor, codex.
- `setContactPhotoCore` extraction correctly motivated: `updateContactMetadataCore` omits `photo` (`contacts-dao.ts:308-335`) and `setContactPhoto` self-wraps the mutex (`contacts-dao.ts:621-644`) — codex, cursor, claude.
- The whole-list method-diff data-loss guard (`desired = current ∪ accepted`, pure node-testable helper) correctly defends `applyContactMethodDiffCore`'s tombstone-on-absence path (`contact-methods-dao.ts:191-215`) — claude, cursor.
- `ResumeImportPrompt` correctly identified as import-coupled → net-new `ResumeReconcilePrompt` mandated and mechanically checked (grep-absence of `import-session-dao`) — all three.
- Durable session commits atomically AFTER the full scan (no half-scanned resumable session); per-card try/catch correctly reads the grid's whole-batch failure contract (`CandidateCardGrid.tsx:106-121`) — codex, claude, cursor.

### Agreed / Confirmed Concerns (highest priority — orchestrator-verified)
- **NEW HIGH (codex, orchestrator-CONFIRMED) — 20-01 field_history reparent SQL will ABORT.** The action text (20-01 line 145) reparents every child, INCLUDING `field_history`, with the single generic template `UPDATE <child> SET contact_id = ?, modified_at = ? WHERE contact_id = ?`. But `field_history` has NO `modified_at` column — its schema is `(id, contact_id, field_col_name, old_value, operation, created_at)` (VERIFIED `src/db/migrations/001-initial.ts:156-163`). Any merge of a contact that has field_history rows hits `no such column: modified_at` and the whole transaction aborts. Fix: split `field_history` out to `UPDATE field_history SET contact_id = ? WHERE contact_id = ?` and add a merge test with a NON-empty field_history fixture (the current test asserts reparent "incl. field_history" but would only pass once the SQL is corrected).
- **NEW HIGH (codex, orchestrator-CONFIRMED) — photo apply/durability is unimplementable as scoped across 20-03 / 20-04 / 20-05.** Picker photos arrive only as `PickedContact.photoTempUri`, an "intentionally evictable" app-private cache `file://` path that "must be moved to durable staging ... before it is persisted" (VERIFIED `modules/orbit-contact-picker/index.ts:14-24`). `setContactPhotoCore`/`setContactPhoto` call `assertSafeRelative` and accept ONLY a durable `avatars/<name>.<ext>` relative filename, rejecting any `file://`/cache URI (VERIFIED `contacts-dao.ts:610-645`). The existing import path solves this with a staging step — `stageImportPhoto(photoTempUri, relative)` then `persistPhotoMaster` (VERIFIED `src/services/import/import-acquire.ts:78-83`, `import-photo.ts:60-90`). **NO Phase-20 plan includes any photo-staging step** (grep across all six plans for `stageImportPhoto|staging|persistPhotoMaster|photoTempUri` returns nothing): 20-03 calls `setContactPhotoCore` on Apply with no staging (throws), 20-04 persists the evictable temp URI inside durable `diff_json`, and 20-05 resumes cards whose photo option points at a possibly-evicted file. Photo is one of the five required reconciled families. Fix: add an explicit reconcile photo-staging pipeline (copy/hash the selected source bytes to durable `avatars/...`, use a content hash as the reviewed/comparison value, promote post-commit, launch-sweep cleanup for abandoned staged files) — reuse the import staging service.

### Divergent Views (resolved by orchestrator source read)
- **Are there any HIGHs left?** Cursor + Claude say none; **Codex says two.** Orchestrator verdict: **codex is correct on both** — the `field_history.modified_at` column mismatch and the photo-staging gap are both verified against `src/` above. Cursor cited `field_history` reparenting as a strength without checking the generic template's `modified_at` clause against the actual column list; Claude had no repo access. Two source-confirmed HIGHs remain.

---

## Verification Coverage (source-grounding pass — cycle 2)

Pre-existing symbols cited by the six plans were resolved against `src/` on disk. NEW artifacts this
phase produces (`mergeContacts`, `setContactPhotoCore`, migration 013 tables incl.
`bulk_review_resolutions`, `reconcile-*` DAOs, `ResumeReconcilePrompt`, extended CandidateCardGrid
members, bulk-review DAOs) are EXCLUDED from missing-symbol checks — they are created by this phase.

**VERIFIED (existing symbols, quoted):**
- `field_history` schema = `(id, contact_id, field_col_name, old_value, operation, created_at)` — NO `modified_at` — `src/db/migrations/001-initial.ts:156-163`. (Drives HIGH #1.)
- `PickedContact.photoTempUri` is evictable cache `file://`, "must be moved to durable staging ... before it is persisted" — `modules/orbit-contact-picker/index.ts:14-24`. (Drives HIGH #2.)
- `setContactPhoto` calls `assertSafeRelative(relative)`; stores RELATIVE `avatars/<name>.<ext>` only, rejects `file://`/cache — `src/db/contacts-dao.ts:610-645`.
- Import photo staging exists to reuse: `stageImportPhoto` — `src/services/import/import-acquire.ts:78-83`; `persistPhotoMaster` — `src/services/import/import-photo.ts:60-90`.
- `updateContactMetadataCore` OMITS `photo` — `src/db/contacts-dao.ts:308-335`.
- Partial unique indexes `idx_contact_methods_primary_type`, `idx_external_contact_links_active` — `src/db/migrations/011-contact-lifecycle-schema.ts:178-180`.
- `contact_method_provenance` keyed by `method_id`, ON DELETE CASCADE — `011-contact-lifecycle-schema.ts:228-233`.
- `custom_field_values UNIQUE(contact_id, field_def_id)` — migration 006 / `011:79-85`.
- `applyContactMethodDiffCore` tombstones+DELETEs seeded methods absent from `current` — `src/db/contact-methods-dao.ts:191-215`.
- `contacts` columns `favourite_rank`, `ring_seq`, `snooze_until` exist on the contact ROW — `001-initial.ts:74-77`, `011:28-31`. (Absorbed-only values dropped on the absorbed-row DELETE; drives MEDIUM.)
- `DuplicateReviewScreen` `onInspect={() => undefined}` (no merge/inspect entry wired) — `src/screens/DuplicateReviewScreen.tsx:239`. (Drives Cluster-U MEDIUM.)
- Migration head = 12 (`TARGET_VERSION`), `MIGRATIONS` ends at `migration012` — `src/db/database.ts`; 20-01 correctly re-verifies before bumping to 13.
- `import_session_rows.source_payload` immutable; `bulk_review_resolutions` is the new durable store — `012-import-sessions.ts:30-49`.

**UNCHECKABLE / not counted:** the headless Claude lane's internal-consistency findings (no repo
access) are recorded but excluded from source-grounded weight. TypeScript→SQL edges are literal
strings (graph cannot enumerate table writers) — the writer reads above were done by grep, not the
graph. Device-UAT-only acceptance items (App.tsx modal precedence rendering) cannot be verified
statically and are left to execution.

**No hallucinated symbols:** every pre-existing symbol the plans cite resolves to real code. The two
HIGHs are semantic/contract mismatches (a cited symbol exists but its contract does not match what
the plan's prescribed SQL/write needs), which symbol-existence grounding alone would not catch.

---

## Fact-Drift Pass (ADVISORY — not counted toward HIGH/actionable)

- **UI-SPEC internal contradiction (same fact, two values).** `20-UI-SPEC.md` surface #12 says merge
  conflicts are shown with the "survivor value preselected" (`:350-351`), while the FieldChoiceGroup
  contract in the same doc requires conflicting mode with **no** preselection (`:238-239`). The plans
  (20-02) correctly follow the no-preselection rule; the UI-SPEC summary line should be synced. Doc
  drift, not a plan defect.
- **STATE.md vs ROADMAP.md** — no contradiction: STATE says phase 20 PLANNED/ready_to_execute;
  ROADMAP progress table shows "20 | 0 | Not started" (0 plans EXECUTED). Planning-done +
  execution-not-started are consistent, not contradictory. Authority STATE.md.
- **ROADMAP Success Criteria vs PLAN must_haves** — no contradiction found; the five reconciled
  families, one-way direction, additive-only bulk seam, tombstone-not-archive, and atomic merge all
  map cleanly to plan must_haves.

---

## Codex Review (Cycle 2)

_Model: gpt-5.6-terra (reasoning=low) — source-grounded, repo access._

## Plan 20-01 — Migration and merge tracer

### Summary

The merge plan is substantially stronger after cycle 1: it correctly targets the real v12 head, accounts for the two partial unique indexes, and adds the missing custom-value/provenance pre-resolution. One new transaction-breaking detail remains.

### Strengths

- It correctly builds on the single non-reentrant transaction primitive, whose contract explicitly prohibits nested transactions. [transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:50)
- The plan’s primary-method and external-link pre-resolution matches the actual partial unique indexes. [011-contact-lifecycle-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/011-contact-lifecycle-schema.ts:178)
- Reparenting `field_history` is necessary: it has no FK, while purge currently handles it explicitly for that reason. [001-initial.ts](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:156), [purge-dao.ts](/home/bwales/projects/orbit-app/src/db/purge-dao.ts:242)
- Extracting `setContactPhotoCore` is necessary; the current public writer self-wraps a transaction. [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:621)

### Concerns

- **HIGH — the prescribed generic reparent statement will fail on `field_history`.** The action says to reparent every child using `SET contact_id=?, modified_at=?`, explicitly including `field_history`. But `field_history` has no `modified_at` column—only `contact_id`, `field_col_name`, `old_value`, `operation`, and `created_at`. [001-initial.ts](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:156) This would abort every merge that has history rows, despite the plan’s test intent.

### Suggestions

- Split reparent SQL by table. Use `UPDATE field_history SET contact_id=? WHERE contact_id=?`; retain `modified_at` only for tables that actually own it. Add a test with a nonempty `field_history` fixture, not merely an assertion after a no-history merge.

### Risk Assessment

**MEDIUM.** The architecture is sound, but the remaining SQL-shape error is a deterministic runtime failure on an ordinary populated profile.

---

## Plan 20-02 — Conflict-resolution UI

### Summary

The plan correctly keeps the conflict UI separate from the atomic writer and uses explicit selection for true scalar conflicts. Its dependency on the tracer’s resolution contract needs to be made concrete before implementation.

### Strengths

- A full metadata input is the correct safety requirement: `updateContactMetadataCore` writes all mutable metadata fields and defaults omitted `trackingEnabled` to enabled. [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:308)
- The plan correctly recognizes that primary selection needs ordering because the unique primary index is immediate. The existing method writer explicitly clears the old primary before changing it. [contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:171)
- Real counts must not rely only on `impactSummaryLines`, which currently omits methods and external links. [purge-dao.ts](/home/bwales/projects/orbit-app/src/db/purge-dao.ts:176)

### Concerns

- **MEDIUM — the cross-plan `resolutions` contract is not specified as a typed artifact.** Plan 20-02 is prohibited from changing `merge-dao.ts`, but Plan 20-01 only describes resolutions narratively. This leaves custom-field choices, “keep survivor” semantics, primary choices, and photo/no-photo choices vulnerable to incompatible UI/writer shapes. The relevant existing APIs have materially different input forms: metadata is a full object, while methods are a seeded/current whole-list diff. [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:271), [contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:99)

### Suggestions

- Make Plan 20-01 export a `MergeResolutions` type plus a unit-tested normalization/validation function. Plan 20-02 should consume that type rather than re-declaring an implied object shape.

### Risk Assessment

**MEDIUM.** The user flow is appropriate, but the wave boundary is too loose for an irreversible conflict-resolution operation.

---

## Plan 20-03 — Per-contact reconciliation

### Summary

The one-way and whole-method-list protections are well targeted. Photo reconciliation remains unimplementable as described because the plan neither creates a stable comparison signal nor persists the selected source photo safely.

### Strengths

- The plan correctly treats `applyContactMethodDiffCore` as destructive for absent seeded methods: the current implementation tombstones and deletes any seeded method not included in `current`. [contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:191)
- The proposed current-union-accepted desired list directly addresses that behavior.
- Missing sources are distinguishable from provider failures/empty results: selected reads return `omittedCount`, and the provider result differentiates omitted contacts from an empty input. [orbit-contact-picker/index.ts](/home/bwales/projects/orbit-app/modules/orbit-contact-picker/index.ts:33), [orbit-contact-picker/index.ts](/home/bwales/projects/orbit-app/modules/orbit-contact-picker/index.ts:118)

### Concerns

- **HIGH — accepted source photos cannot be written through `setContactPhotoCore` without a photo-import/staging step.** Picker photos are explicitly evictable cache `file://` paths that must be moved to durable staging before persistence. [orbit-contact-picker/index.ts](/home/bwales/projects/orbit-app/modules/orbit-contact-picker/index.ts:19) The current contact writer accepts only a validated relative avatar filename. [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:610) Plan 20-03 calls `setContactPhotoCore` but adds neither a durable-copy service nor a post-commit cleanup/recovery path.
- **HIGH — “available signal” does not support the required no-re-nag behavior for photos.** The only source-photo value is the evictable temp URI, not a stable fingerprint. [orbit-contact-picker/index.ts](/home/bwales/projects/orbit-app/modules/orbit-contact-picker/index.ts:19) Persisting/comparing that URI in `reconcile_source_snapshot` will re-surface a photo discrepancy whenever the cache path changes, or may point at a vanished file.

### Suggestions

- Add an explicit reconciliation-photo pipeline: copy/hash the selected source bytes to a durable staged location, use a content hash as the reviewed value, atomically promote the chosen file after the DB transaction, and add launch-sweep cleanup for abandoned staged files.
- If hashing is intentionally deferred, explicitly exclude photo from narrow-memory suppression and state that the photo row is always manual-review; that would not fully meet the no-re-nag goal, so it needs an owner decision.

### Risk Assessment

**HIGH.** Photo is one of the five required reconciled families, and the current plan would either reject the write or retain invalid/evictable paths.

---

## Plan 20-04 — Bulk review workspace and durable sessions

### Summary

The plan correctly reuses the established grid and avoids creating a committed half-scan. Its durability model still does not make photo review durable, and bulk action semantics need an explicit durable apply contract.

### Strengths

- The additive extension is grounded in the actual grid API: `BulkAction` is a closed union and the scoring text is hardcoded today, so both changes are genuinely needed. [CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:18), [CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:124)
- The plan correctly accounts for the grid’s batch-level failure behavior. A thrown callback marks all target cards failed. [CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:106)
- Building the session only after scan/classification is a sound way to avoid ambiguous partial pending sessions.

### Concerns

- **HIGH — durable session cards will persist invalid source-photo references.** `diff_json` is proposed as the durable card payload, but a source photo is only an evictable temp URI. [orbit-contact-picker/index.ts](/home/bwales/projects/orbit-app/modules/orbit-contact-picker/index.ts:19) On process death, resume cannot reliably render or apply the persisted photo option. This repeats the unresolved Plan 20-03 photo-persistence issue at the bulk boundary.
- **MEDIUM — “Keep Orbit Values” and bulk recommendation application lack a specified snapshot/status transaction.** The grid can invoke callbacks, but it does not persist reconciliation state itself. [CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:45) The plan must explicitly say that each bulk resolution calls the same apply/snapshot core as detail review, then updates card status/count atomically; otherwise “keep” will reappear on the next scan.

### Suggestions

- Make session-card construction reference staged photo records/content hashes, not raw `photoTempUri`.
- Extract a shared `applyReconciliationCardCore` used by detail and all bulk actions. It should apply selected values, write every applicable reviewed snapshot, update card status/unresolved count, and finalize the session in one caller-owned transaction.

### Risk Assessment

**HIGH.** Process-death durability is a core RCN-02 promise; photo cards currently cannot honor it.

---

## Plan 20-05 — Resume and missing-source lifecycle

### Summary

The plan correctly avoids reusing the import-specific prompt component and correctly preflights the globally unique active-link identity. It inherits the unresolved durable-photo issue and needs clearer behavior for corrupt session discovery.

### Strengths

- A separate reconciliation prompt is justified: the existing prompt is specifically typed around import modes and import routes. [ResumeImportPrompt.tsx](/home/bwales/projects/orbit-app/src/components/ResumeImportPrompt.tsx:21)
- The launch-sweep design is appropriate: hooks run only after registration and a real foreground launch; importing the module does not run them. [launch-sweep.ts](/home/bwales/projects/orbit-app/src/services/launch-sweep.ts:44), [launch-sweep.ts](/home/bwales/projects/orbit-app/src/services/launch-sweep.ts:102)
- The global active-link preflight matches the real unique index on provider/external ID, not a per-contact constraint. [011-contact-lifecycle-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/011-contact-lifecycle-schema.ts:180)

### Concerns

- **MEDIUM — corrupt-session recovery is underspecified when parsing fails before a resumable descriptor can be built.** The import sweep only logs lookup/description errors and returns `null`; it does not synthesize a discard-only session. [contact-import-resume-sweep.ts](/home/bwales/projects/orbit-app/src/services/import/contact-import-resume-sweep.ts:124) The new plan promises a discard-only descriptor, but needs a concrete fallback query that identifies the pending session ID without parsing its card payload.
- **MEDIUM — resuming a session that includes photo diffs remains unsafe until Plans 20-03/04 persist staged durable photo data.** The source module explicitly permits cache cleanup/eviction. [orbit-contact-picker/index.ts](/home/bwales/projects/orbit-app/modules/orbit-contact-picker/index.ts:20)

### Suggestions

- Define `getNewestPendingReconcileSessionId` as a corruption-tolerant read used solely to construct a discard-only prompt.
- Block resume of photo-bearing cards until the staged-photo record exists, or ensure the resume sweep marks those individual cards retryable rather than presenting broken choices.

### Risk Assessment

**MEDIUM.** The lifecycle design is sound, but corrupted-state recovery and photo-session durability need implementation-level contracts.

---

## Plan 20-06 — Bulk flagged-item resolver and phase gate

### Summary

The unreadable-birthday resolution flow is appropriately conservative and uses the existing full metadata writer. The claimed generic future-flag model conflicts with the migration schema.

### Strengths

- The plan correctly avoids mutating immutable import payloads; current import completion only derives the unreadable-birthday count from `source_payload`. [import-session-read.ts](/home/bwales/projects/orbit-app/src/db/import-session-read.ts:269)
- It correctly recognizes that rows may have no contact: the import schema permits `contact_id` to be null. [012-import-sessions.ts](/home/bwales/projects/orbit-app/src/db/migrations/012-import-sessions.ts:42)
- Using a complete metadata input is necessary because the existing core updates all mutable contact metadata. [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:312)

### Concerns

- **MEDIUM — “generic over future flag types” is false with the proposed schema.** Migration 013 constrains `bulk_review_resolutions.flag_type` to `CHECK IN ('birthday')` in Plan 20-01. A future flag cannot reuse the table without another migration. This is not harmful if intentional, but the plan’s genericity claim and acceptance language should not imply otherwise.

### Suggestions

- Either describe the DAO/read abstraction as “generic in code, birthday-only in schema for v1,” or make the owner-approved migration choice to remove the enum check and validate supported flag types in TypeScript. Given the migration is irreversible, make this explicit before Plan 20-01 ships.

### Risk Assessment

**MEDIUM.** The birthday workflow is coherent; the concern is a misleading future-extension contract on an irreversible schema.

---

## Overall assessment

The revised plans address the cycle-1 issues around custom-field collisions, provenance remapping, method-list seeding, grid extension, dedicated resume UI, and durable birthday-flag resolutions. The remaining blocker is source-photo handling: the current picker exposes only evictable temporary paths, while both per-contact and resumable bulk reconciliation require stable comparison and durable selected-photo storage. Resolve that design, plus the `field_history.modified_at` SQL error, before executing migration 013 and the tracer.

---

## Claude Review (Cycle 2)

_Model: sonnet (reasoning=low) — context-isolated; NO live repo access (plan-text only), verdict not counted at full source-grounded weight._

# Cross-AI Plan Review — Phase 20: Contact Reconciliation & Merge (Cycle 2)

**Note on verification:** I do not have live file-read access to this repo's actual source in this session (only the plan/research/pattern/UI-spec/dossier text provided above). All findings below are therefore evaluated against internal consistency of the plans and the cited research/pattern documents, not fresh reads of `purge-dao.ts`, `contact-methods-dao.ts`, etc. Any claim that would normally require a `file:line` citation against live source is flagged as an **open question** rather than asserted as confirmed/refuted.

---

## Plan 20-01 (Migration 013 + atomic merge tracer)

### Strengths
- The custom-field collision pre-resolution (must_have #3) and provenance-remap-before-delete ordering (must_have #7, task text step 1c) are now spelled out with explicit ordering — this matches the cycle-1 asks and is internally consistent with the described `ON DELETE CASCADE` hazard.
- `setContactPhotoCore` extraction is well-motivated (updateContactMetadataCore omits photo; setContactPhoto self-wraps the mutex) — a real gap if true, and the plan requires a regression test path (refactor `setContactPhoto` to call the new core, "existing contacts-dao tests stay green").
- Full-input (never sparse patch) requirement for scalar resolution is a legitimate defense against the classic "PATCH overwrites unrelated columns" bug class, and is explicitly test-required.
- Checkpoint task for the `contact_redirects` decision is properly gated as `blocking-human` before the irreversible migration — correct treatment of a one-way-door schema decision.

### Concerns

**MEDIUM — custom-field collision resolution is asserted "survivor-wins default" but the acceptance criteria don't verify the *absorbed's unique* fields (non-colliding field_def_ids) actually reparent.** The plan says "only field_def_ids the survivor lacks are reparented" but the must-have/acceptance-criteria list only tests the *collision* case (both hold same field_def_id) and doesn't explicitly list a test for "absorbed has a custom field the survivor doesn't → it moves to survivor." This is Cluster W/Z's core additive-merge promise and is a plausible gap in the test list, not just the code — worth requiring explicitly in acceptance criteria for 20-01, not left implicit.

**MEDIUM — the `assumption_delta_decision` block declares `survivor-wins default` as the tracer's conflict policy, but 20-02's must_haves state MergeConflictsScreen conflicts get "NO preselection — explicit manual choice."** These are not contradictory (20-01 is a tracer with empty resolutions; 20-02 adds the real UI), but the phase-wide "ACCEPTED BOUNDED GAP" note only mentions a *device-build* gap window, not that any 20-01 unit test asserting "empty resolutions = survivor-wins" could mask 20-02 not actually threading resolutions correctly later. This is a soft risk, not a defect — flagging as low actionable.

**LOW — `field_history` reparent vs. new-row-on-scalar-overwrite are two different write patterns to the same table inside one transaction**, and the plan doesn't distinguish which happens first (reparent absorbed's field_history rows, then separately INSERT new field_history rows for survivor overwrites) or whether a reparented field_history row referencing the absorbed's old `contact_id` needs its `contact_id` updated to the survivor (it does, since field_history has no FK and is presumably read by contact_id in the field-history UI). The must-have says "reparents... field_history" via UPDATE — acceptable, but this ordering interacts with step 3's *new* INSERT and isn't sequenced in the action text beyond bullet order. Worth an explicit note that reparent (step 2) happens before the scalar-overwrite snapshot INSERT (step 3) so the reparented history isn't confused with the new snapshot.

**LOW — `bulk_review_resolutions` table lives in migration 013 but is functionally owned by 20-06 (a different plan, three waves later).** This is fine as "cheapest moment to add the table" reasoning, but it does mean 20-01's migration test (`013-reconciliation-and-merge.test.ts`) is now responsible for FK-integrity-testing a table whose write/read DAOs don't exist until wave 6. The plan does say "proving a v12→v13 forward migration creates the tables (incl. bulk_review_resolutions) and FK integrity holds" — acceptable, just a minor cross-wave coupling to note for the executor.

### Suggestions
- Add an explicit acceptance criterion/test case for "absorbed's non-colliding custom_field_values row reparents onto survivor" (distinct from the collision case) to close the additive-merge gap noted above.
- Clarify field_history write ordering (reparent-then-append) in the action text, not just implied by list order.

### Risk Assessment: **MEDIUM** (down from likely HIGH pre-revision) — the two hardest SQLite integrity hazards (partial-unique-index ABORT, provenance orphan) are now explicitly sequenced and test-required; residual risk is in test-coverage completeness (additive custom-field reparent) rather than architecture.

---

## Plan 20-02 (Merge conflicts UI + survivor recommendation)

### Strengths
- Explicit prohibition against modifying `merge-dao.ts` in this plan, verified via a `git diff --name-only` acceptance criterion — a good mechanical guardrail against write-path duplication (Cluster H/Z "don't fork a second writer").
- `Continue` disabled until every conflict field has an explicit selection is correctly required to match the dossier's Cluster C "explicit manual choice" for conflicts (no defaulting).
- Recommended-survivor badge required to be colourless (ConfidenceChip idiom) matches the UI-SPEC's locked "no caution hue" rule and is checked via grep for accent/status token misuse.

### Concerns

**MEDIUM — resolutions "shape" contract between 20-02 and 20-01 is described only in prose, not in a shared type.** Both plans repeatedly say "the exact shape mergeContacts already consumes" but neither plan's action text pins down a concrete TypeScript interface (e.g., `MergeResolutions { scalars: {...}, customFields: Record<fieldDefId, value>, photo?: ... }`). Since 20-01 ships the writer first and 20-02 must match it without touching merge-dao.ts, a mismatch in the resolutions shape (e.g., field naming) would only surface as a runtime/type error during 20-02's execution — acceptable given `npx tsc --noEmit` gates it, but the plans would be stronger if 20-01's artifact list defined the resolutions type explicitly as a named exported type for 20-02 to import.

**LOW — primary-method contention UI reuses "ContactMethodsEditor's `choosePrimary` model,"** but it's unclear whether `choosePrimary` is a pure function/hook that can be called standalone in MergeConflictsScreen versus tightly coupled to the full ContactMethodsEditor component tree. If it's UI-coupled, "primary-method contention" might end up half-forking a new picker rather than truly reusing the model. This is flagged in RESEARCH only at the signature level ("Cluster X"), not verified as a decoupled function — worth the executor double-checking `contact-methods-editor-model.ts:112,133` actually exports a headless `choosePrimary(a, b)` rather than a hook tied to editor state.

### Suggestions
- Have 20-01 export a named `MergeResolutions` type from `merge-dao.ts` (or a sibling types file) that 20-02 imports, removing the "matches by convention" risk.

### Risk Assessment: **LOW-MEDIUM** — mostly well-scoped; the main residual risk is an implicit (not type-enforced) contract between plans 1 and 2.

---

## Plan 20-03 (Per-contact reconciliation)

### Strengths
- The "whole-list diff data-loss" guard (must_have #7 — desired list must be current∪accepted, never just additions) is the single most important fix in this plan and is well-instrumented: both a prohibition, an acceptance criterion requiring a **pure, node-testable helper** with a dedicated test, and a grep-verifiable line in the read_first pointing at `applyContactMethodDiffCore`'s tombstone-on-absence behavior. This is exactly the kind of "trace whether the guard actually works" fix cycle 1 should have produced.
- Multi-source snapshot writing "once per CONTRIBUTING external_contact_link_id, not just the selected source's" (must_have #9) closes a real aggregate-memory bug that a naive single-snapshot-write implementation would hit.
- Correctly forbids photo through `updateContactMetadataCore` (which "omits photo") — consistent with 20-01's photo-writer design.

### Concerns

**MEDIUM — the "missing-source" detection precondition is asserted at the reconcile-diff layer, but this plan's Task 3 (ReconcileDetailScreen) is a *per-contact* entry point, and it's unclear how the screen's initial load distinguishes "zero active links" from "one active link whose source is missing" before calling `readAllContacts`.** The profile-level gating ("shown only when the contact has ≥1 active external_contact_link") only prevents the *menu item* from appearing when there are no links at all — it doesn't describe what happens if the single link's source later disappears (that's exactly the missing-source case this screen must handle per Cluster G). The action text does cover it ("On mount... `readAllContacts`... an absent contact is a MISSING source"), so this is plausibly fine, but the interplay between "OverflowMenu visibility gated on active links existing" and "detail screen handling a link whose target is gone" is worth an explicit must-have/test case in this plan (it currently reads as implied by reconcile-diff's classifier tests from Task 1, not this screen's own tests).

**LOW — Task 3's acceptance criteria check for presence of four writer function names via grep, but not their *call order*** (photo via setContactPhotoCore must not be routed through updateContactMetadataCore — this is checked — but there's no check that the method-apply's desired-list construction actually runs *before* `applyContactMethodDiffCore` is invoked, i.e., that the seed-then-union helper from must_have #8 is actually wired into this screen's Apply handler rather than just existing as a standalone tested helper). A helper can exist and be unit-tested correctly while the screen still calls the DAO with a wrong list. Consider adding a grep/acceptance check that ReconcileDetailScreen's Apply path calls the specific desired-list-builder helper by name before `applyContactMethodDiffCore`.

### Suggestions
- Add an explicit test/acceptance criterion for "single active link, source becomes unresolvable mid-review" surfaced distinctly by ReconcileDetailScreen (not just reconcile-diff).
- Verify (grep or test) that the screen calls the seed∪accepted helper, not just that the helper exists and is tested in isolation.

### Risk Assessment: **LOW-MEDIUM** — the headline data-loss risk (partial method list) is well-mitigated; residual risk is wiring-level (helper exists vs. helper is actually called correctly at the one call site that matters).

---

## Plan 20-04 (Bulk reconciliation grid + durable session)

### Strengths
- `CandidateCardGrid` extension is now correctly additive: new `BulkAction` members plus a `scoringLabel` prop with a **default value that preserves existing import call sites** — this directly answers the cycle-1 concern about breaking Phase 19's import flow, and it's enforced via an acceptance criterion ("the import call sites still typecheck unchanged").
- Explicit requirement that session+cards commit in ONE transaction *after* the full scan completes (must_have #5) is a good fix for the "half-scanned resumable session" ambiguity — a crash mid-scan now leaves nothing, rather than a misleading partial session.
- Per-card try/catch requirement for `onBulkAction` (backstop item + acceptance criterion) correctly reads the grid's actual failure-isolation contract (a thrown `onBulkAction` fails the *whole* batch per `CandidateCardGrid.tsx:106-121` as cited) — this is a subtle, correctly-diagnosed integration hazard between caller and shipped component.

### Concerns

**MEDIUM — "additive-only eligibility" computation for `Use Contact Values` is described as "a pure helper," but its actual data source (card diff_json contents) isn't tied back to reconcile-diff's outcome types from 20-03 in a checked way.** The acceptance criteria grep only for the string `use-contact-values` being "gated on additive-only eligibility (a computed condition, not unconditional)" — this is a weak, string-shaped check; a superficial `selectedCards.length > 0 && someTrivialCondition` could pass the grep while not actually excluding conflict/removal cards. Given this is explicitly called out in the dossier (Cluster J) as a **safety invariant**, I'd expect a dedicated unit test on the eligibility helper itself (e.g., `additive-only-eligibility.test.ts`) rather than relying solely on a grep+manual device-UAT to catch a wrong implementation. This isn't listed among the plan's `files_modified` test files.

**LOW — Task 3 folds three fairly distinct responsibilities (extend CandidateCardGrid, build ReconcileGridScreen's atomic scan-then-commit, build the additive-only eligibility + bulk apply wiring) into one task with only one verify block.** Given the safety-invariant weight of the additive-only gate, splitting eligibility-computation out with its own pure-function test (as suggested above) would also make Task 3 more auditable.

### Suggestions
- Extract the additive-only-eligibility computation into a named, separately unit-tested pure function (e.g., in `reconcile-diff.ts` or a sibling), with a test proving it excludes selections containing any conflict/removal/missing-source card — don't rely on grep + device-UAT alone for a dossier-locked safety invariant.

### Risk Assessment: **MEDIUM** — the atomicity and grid-extension fixes are solid; the one dossier-locked safety invariant in this plan (Cluster J additive-only gate) is under-tested relative to its importance.

---

## Plan 20-05 (Resume sweep + missing-source/relink)

### Strengths
- Correctly identifies that `ResumeImportPrompt` is import-coupled (imports `import-session-dao`, navigates only to import routes) and mandates a **net-new** `ResumeReconcilePrompt` rather than force-fitting reuse — this is exactly the kind of "verify the mechanism, don't take the plan's claim at face value" correction cycle 1 should have produced, and it's mechanically checked (`grep` for absence of `import-session-dao` import).
- Precedence rule for import-vs-reconcile resume prompts (import shown first, reconcile only after dismissal) closes a plausible UX/state bug (two overlapping non-dismissable modals) that wasn't explicit before.
- The `duplicate-active-link` preflight (must_have #6) correctly identifies that the active-link uniqueness index is **global**, not per-contact — a relink that blindly inserts could ABORT or (worse, if not caught) silently attach a source that's already claimed by another Orbit contact. This is a well-reasoned, non-obvious catch.

### Concerns

**MEDIUM — the "precedence" mechanism between import-resume and reconcile-resume prompts is described only as an App.tsx state-ordering rule ("reconcile prompt not shown while an import resume is pending"), verified via grep, not via a test.** Given App.tsx wiring is typically hard to unit test and this plan has no App.tsx test file listed, this precedence guard's correctness rests entirely on a device-UAT pass and a grep for co-occurring identifiers — which can't actually prove the *conditional rendering logic* is correct (e.g., a grep can't distinguish `{!resumableImport && resumableReconcile && <ResumeReconcilePrompt/>}` from a broken variant that also compiles and greps the same). This is a reasonable thing to leave to human-check given App.tsx's nature, but worth flagging as a real (if low-severity) gap rather than fully resolved.

**LOW — `relinkExternalSource`'s duplicate-active-link outcome says the caller should "route to merge/reconcile, or require an explicit unlink from the other contact,"** but this plan doesn't actually build that routing UI beyond "show a non-destructive explanation" — it's not clear whether landing the user on a dead-end message (with no actual path to resolve the conflict) satisfies RCN-01's "never silently overwrite" bar in a *useful* way, or just avoids the crash. This is likely acceptable for phase scope (routing to full merge flow from this specific dead-end isn't required), but worth confirming the copy genuinely explains what to do next rather than just "can't do this."

### Suggestions
- Add a lightweight App.tsx-level test (even a simple render/state test) for the import-vs-reconcile precedence rule, rather than relying solely on grep + device-UAT for a two-modal-race condition.

### Risk Assessment: **LOW-MEDIUM** — the two headline fixes (net-new prompt component, duplicate-link preflight) are well-reasoned and correctly scoped; residual risk is test-depth on the App.tsx precedence wiring.

---

## Plan 20-06 (Bulk-review birthday resolver + phase gate)

### Strengths
- Correctly identifies that `import_session_rows.source_payload` is immutable, so a durable resolution *cannot* live by mutating import history — the `bulk_review_resolutions` table (added in 20-01's migration, consumed here) is the right fix and is now durability-tested ("durable-across-restart" cases required in both `bulk-review-read.test.ts` and `bulk-review-dao.test.ts`).
- NULL `contact_id` handling (`ON DELETE SET NULL`) is explicitly called out as a must-have, closing a plausible crash/orphan-write path that a naive read/apply implementation would hit.
- Consolidated device-UAT in Task 2 is a sensible phase-closing gate that harvests all five prior plans' human-check items into one pass rather than duplicating them.

### Concerns

**LOW — the generic-over-future-flag-types design (`flag_type CHECK IN ('birthday')` with only one value today) is fine as forward-compatible schema, but the read/write functions in this plan are typed and described specifically around birthdays** ("resolveBulkReviewFlagCore(exec, { importSessionRowId, contactId, birthday, now })" — birthday-specific parameter, not a generic `value`). This means the "generic over flag_type" claim is really only true at the schema layer; the DAO layer would need a rewrite for a second flag type. Not a defect for this phase's scope (only birthday exists), just worth not over-claiming genericity in the artifact manifest language ("generic over future flag types") when the DAO signature is birthday-specific.

**LOW — Task 2 (verification gate) has no independent code changes and is essentially "run the suite and confirm," which is reasonable, but its acceptance criteria ("every 20-VALIDATION.md Wave 0 test file exists and is green") depend on a `20-VALIDATION.md` file that isn't shown in the reviewed materials** — I can't confirm that document's Wave-0 list matches the test files actually enumerated across the six plans' `files_modified`. This is a soft dependency worth double-checking at execution time (it's referenced but not included in this review bundle).

### Suggestions
- Soften "generic over future flag types" framing in the artifact manifest to acknowledge the DAO signature is birthday-specific today (schema-generic, not yet function-generic).

### Risk Assessment: **LOW** — this plan is narrow, well-scoped, and correctly closes out the phase; residual risk is administrative (unverified cross-reference to `20-VALIDATION.md`).

---

## Cross-Plan / Phase-Wide Observations

1. **Migration 013 ownership is spread across all six plans** (tables introduced in 20-01, consumed in 20-03/04/05/06). This is architecturally sound (forward-only migration authored once) but means a schema mistake discovered in wave 3+ requires either a *second* irreversible migration or reopening 20-01's already-"done" plan. Given migrations are explicitly irreversible in production, it would be worth the owner/planner double-checking that all six plans' schema needs were fully enumerated in 20-01's migration *before* execution starts, since 20-01 is the only wave that gets to write DDL.

2. **The `MergeResolutions` type contract between 20-01 and 20-02** (noted above) is the one remaining "implicit interface" in the plan set that isn't mechanically enforced beyond `tsc --noEmit` at execution time — low risk given TypeScript will catch a real mismatch, but worth naming explicitly as a shared artifact.

3. **The additive-only eligibility gate (Cluster J, 20-04)** is the one dossier-locked *safety* invariant in the whole phase whose verification leans most heavily on grep-pattern-matching and device-UAT rather than a dedicated unit test — given cycle 1's own theme (verify guards actually work, don't take the plan's word for it), this is the strongest candidate for a follow-up fix before execution.

## Overall Risk Assessment: **LOW-MEDIUM**

The cycle-1 HIGH findings (custom-field UNIQUE collision, provenance orphaning, missing photo writer, partial method-list data loss, CandidateCardGrid forking, ResumeImportPrompt reuse mismatch, missing durable bulk-review persistence) all have concrete, mechanically-checked fixes in the current plan text — this is a substantially stronger plan set than cycle 1. Remaining concerns are secondary: a few under-tested safety-critical helpers (additive-only eligibility, additive custom-field reparent), one implicit cross-plan type contract, and one App.tsx precedence rule that leans on device-UAT rather than a unit test. None of these rise to HIGH; they're the kind of gaps worth a targeted follow-up (specifically: add a unit test for the Cluster J additive-only-eligibility helper) rather than another full replan cycle.

---

## Cursor Review (Cycle 2)

_Model: unknown — source-grounded, repo access._

# Cross-AI Plan Review — Phase 20: Contact Reconciliation & Merge (Cycle 2)

## Summary

The six-wave plan set is substantially improved since cycle 1: the highest-risk data-layer hazards are now grounded in verified source (`purge-dao.ts`, `contact-methods-dao.ts`, `field-values-dao.ts`, `contacts-dao.ts`, migration 011 partial unique indexes) with explicit pre-resolution steps, node tests, and no new write paths for reconciliation apply. Cycle-1 blockers (custom-field `UNIQUE(contact_id, field_def_id)` collision, provenance remap ordering, `setContactPhotoCore`, full-method-list reconcile apply, additive `CandidateCardGrid` extension, `ResumeReconcilePrompt`, and `bulk_review_resolutions`) are fully addressed in the current plans. What remains is mostly product-scope alignment (dossier/UI-SPEC merge entry points), undefined merge policy for a few survivor-only contact columns (`favourite_rank`, `ring_seq`, `snooze_until`), an owner-blocking migration checkpoint, and the deliberately bounded 20-01→20-02 conflict UI gap.

---

## Strengths

- **Merge writer design matches shipped purge/recency patterns.** `20-01-PLAN.md` correctly inverts `purge-dao.ts:204–268` (single `inWriteTransaction`, assert-one-row delete, post-commit extensions) and mandates `recomputeLastContactCore` instead of direct `last_contact` writes — consistent with `recency-dao.ts:150–176` and the project's DATA-04 invariant.

- **Cycle-1 integrity hazards are concretely mitigated with test obligations.**
  - Custom-field collision: pre-delete absorbed rows + `field_history` snapshot before reparent, using `upsertValueCore`'s `ON CONFLICT(contact_id, field_def_id)` path (`field-values-dao.ts:64–78`).
  - Method provenance: remap `contact_method_provenance.method_id` before deleting losing methods — matches `011-contact-lifecycle-schema.ts:228–233` `ON DELETE CASCADE`.
  - Partial unique indexes: demote competing primaries and retire duplicate active external links before reparent (`011-contact-lifecycle-schema.ts:178–180`).

- **`setContactPhotoCore` extraction is correctly specified.** Plans cite the actual gap: `updateContactMetadataCore` omits `photo` (`contacts-dao.ts:308–335`) and `setContactPhoto` self-wraps `inWriteTransaction` (`contacts-dao.ts:621–644`), so an in-merge photo apply requires a non-mutexed core — exactly what 20-01 tasks describe.

- **Reconcile apply reuses authoritative writers; the whole-list method trap is explicit.** `20-03-PLAN.md` requires seeding every current Orbit method and building `desired = current ∪ accepted`, with a pure helper test — directly guarding `applyContactMethodDiffCore`'s tombstone+DELETE path for seeded methods absent from `current` (`contact-methods-dao.ts:191–215`).

- **Bulk reconciliation safety seam is source-accurate.** `20-04-PLAN.md` extends `CandidateCardGrid.tsx:18–22, 106–121` additively (`keep-orbit` / `use-contact-values`, caller-supplied `scoringLabel`), gates `Use Contact Values` on additive-only eligibility, and documents that per-card try/catch is the caller's job because `runBulkAction` marks the whole selection failed on throw.

- **Durable bulk-review persistence is architecturally sound.** Immutable `import_session_rows.source_payload` (`012-import-sessions.ts:30–49`) plus `bulk_review_resolutions` in migration 013 gives 20-06 a correct durable Fix/Ignore store; the read path reuses `isBirthdayUnreadable` / `sourceBirthday` from `import-session-read.ts:79, 277` and `picked-contact-map.ts:67`.

- **Resume/durability mirrors proven import patterns.** `20-05-PLAN.md` correctly treats `ResumeImportPrompt.tsx:4, 16–19` as import-coupled and specifies a net-new `ResumeReconcilePrompt` + `registerReconcileResumeSweep` wired into `App.tsx:123–124` with import-first precedence — matching existing sweep registration idioms.

- **Wave ordering and tracer-first strategy are sound.** Migration 013 + atomic `mergeContacts` before reconciliation UI expansion de-risks the irreversible schema step and the hardest transaction before bulk/session work.

---

## Concerns

### HIGH

*None remaining from cycle 1 that are unfixed in the current plan text.* The prior HIGH items (custom-field collision, provenance ordering, photo core, method-list seeding, grid extension, reconcile resume prompt, bulk-review durability) all have explicit plan language and acceptance criteria now.

### MEDIUM

- **Cluster U / UI-SPEC merge entry from duplicate/reconciliation detail is missing from all six plans.** Dossier Cluster U (`docs/dossier/20-contact-reconciliation-merge.md:375–380`) and UI-SPEC surface #10 (`20-UI-SPEC.md:334–336`) require a `Merge with another contact` affordance from reconciliation/duplicate detail, not only profile overflow. Plans wire profile overflow only (`20-01-PLAN.md:174–180`; no merge affordance in `20-03`, `20-04`, or `DuplicateReviewScreen.tsx:239` which still has `onInspect={() => undefined}`). RCN-03 is satisfiable via profile alone, but this is a decided product surface gap vs the locked UI contract.

- **Merge policy for `favourite_rank`, `ring_seq`, and `snooze_until` is undefined — silent survivor-wins may drop absorbed-only state.** Merge conflict UI covers name/birthday/category/photo/scalar custom fields (`20-02-PLAN.md`) and resolutions flow through `UpdateContactFullInput` (`contacts-dao.ts:272–289`), which does not include favourite/snooze/ring columns. `mergeContacts` deletes the absorbed row without a documented rule for: absorbed-only favourite (widget/dashboard ordering via `favourites-dao.ts`, `dashboard-read.ts:244–245`), absorbed-only `ring_seq` (orrery), or absorbed-only `snooze_until`. Survivor metadata is retained by default; absorbed-only values are discarded without review or `field_history` snapshot — inconsistent with the "serious consolidation" framing for user-visible lifecycle state.

- **Owner checkpoint blocks Wave 1 execution.** `20-01-PLAN.md:101–118` correctly gates migration 013 on tombstone-only vs `contact_redirects`. This is appropriate (owner bucket), but it is still an unresolved execution blocker — the plan cannot proceed until the owner selects an option.

### LOW

- **Bounded 20-01→20-02 conflict gap is acknowledged but still a real interim UX hazard.** The plan explicitly accepts that tracer merge runs with empty resolutions = survivor-wins for scalar conflicts until `MergeConflictsScreen` lands (`20-01-PLAN.md:42–43`). Not data-loss (writer is conflict-correct), but a device build stopped after Wave 1 would expose silent scalar overwrites — acceptable only if waves are not shipped independently.

- **20-01 second-candidate picker is underspecified.** Task 2 says "thin contact-list select; keep it minimal here" without naming a reuse target (e.g. existing sun-picker / contact search patterns in `sun-picker-read.ts`). Executor discretion risk for the tracer's only merge entry besides pre-seeded pairs.

- **UI-SPEC surface #12 vs widget contract line 239 — plans follow the stricter rule.** Surface #12 says merge conflicts are "survivor value preselected" (`20-UI-SPEC.md:350–351`), but the FieldChoiceGroup contract requires conflicting mode with **no** preselection (`20-UI-SPEC.md:238–239`). Plans (`20-02-PLAN.md`) correctly follow line 239. The UI-SPEC summary section should be synced to avoid executor confusion — not a plan defect, but a doc inconsistency.

- **Post-merge survivor notification reconcile is unspecified.** Plans specify post-commit cancel for absorbed `decay:<id>` / `birthday:<id>` via `purge-notification-cleanup` pattern (`20-01-PLAN.md:145`), but do not mention whether survivor schedules need refresh after child reparent changes recency. Likely covered by the existing launch-sweep notification reconcile (`App.tsx:174–181` registers `registerNotificationScheduleSweep`), but no explicit merge hook or test — minor verification gap.

- **`bulk_review_resolutions` CASCADE on `import_session_row_id` means resolutions vanish if import rows are purged.** Schema is intentional (`ON DELETE CASCADE`), and 20-06 excludes NULL `contact_id` rows, but there is no lifecycle note for what happens to flags when import history is eventually trimmed — acceptable for v1, worth documenting in execution notes.

---

## Suggestions

1. **Add a small plan task (20-02 or 20-03) for Cluster U detail entry points:** wire `Merge with another contact` from `ReconcileDetailScreen` (when duplicate Orbit identities are evident) and from `DuplicateReviewScreen` candidate inspect flow, routing into `SurvivorSelectScreen` with both contact ids pre-filled — as UI-SPEC #10 requires.

2. **Document merge policy for lifecycle columns in `merge-dao` must_haves:** e.g. "if survivor lacks `favourite_rank` and absorbed has one, promote absorbed rank via `favourites-dao` (or survivor-wins explicitly with no promotion)"; same for `ring_seq` and `snooze_until`. Add one node test per rule so widget/orrery regressions are caught.

3. **Resolve the owner checkpoint before Task 1 DDL is authored** — default recommendation in research (redirect table in 013) is flagged, but the checkpoint correctly leaves the decision to the owner; do not let an executor pick `tombstone-only` silently.

4. **Add an acceptance grep/test that 20-01 SurvivorSelect can reach merge with a user-picked second contact** — even minimal — so the tracer entry is not profile-only in practice when the user discovers duplicates outside profile-initiated merge.

5. **Sync UI-SPEC surface #12** to match line 239 (conflict = no preselection) so merge and reconcile share one rule.

6. **Optional: note in 20-06 verification** that notification schedule for the survivor is eventually consistent via launch sweep, or add a post-commit `registerNotificationScheduleSweep`-style hook if immediate correctness matters after merge.

---

## Risk Assessment

**Overall: MEDIUM**

**Justification:** The data-layer plans are the strongest part of the phase — they trace real schema constraints, reuse proven DAO patterns, and encode cycle-1 fixes with concrete tests. Execution risk is concentrated in (a) the irreversible migration 013 owner decision, (b) the large atomic merge transaction (mitigated by extensive pre-resolution and node tests), and (c) product-scope gaps (Cluster U entry points, lifecycle-column merge policy) that will not corrupt SQLite but may ship incomplete vs decided dossier/UI-SPEC behavior. Reconciliation safety (one-way apply, additive-only bulk seam, missing-source distinctness, durable sessions) is well specified. No network exposure; SQL injection risk appropriately constrained to literal table names and `?`-binding per existing purge/DAO conventions.

---

### Cycle 1 Resolution Status (for traceability)

| Cycle 1 concern | Status in current plans |
|-----------------|-------------------------|
| Custom-field UNIQUE collision on blind reparent | **Resolved** — pre-resolution + tests in 20-01 |
| Provenance capture-then-remap ordering | **Resolved** — step 1c before delete in 20-01 |
| Net-new `setContactPhotoCore` | **Resolved** — 20-01 with correct `contacts-dao` citations |
| Full-method-list seeding on reconcile apply | **Resolved** — 20-03 + pure helper test requirement |
| `CandidateCardGrid` additive bulk actions | **Resolved** — 20-04 in `files_modified` |
| Net-new `ResumeReconcilePrompt` | **Resolved** — 20-05 |
| `bulk_review_resolutions` in migration 013 | **Resolved** — 20-01 DDL + 20-06 consumer |

---

<!-- ============================================================ -->
# CYCLE 1 — AUDIT HISTORY (preserved verbatim)

> The following is the complete cycle-1 review, retained for the convergence audit trail.
> It was addressed by the revision; do not re-action from here — see Cycle 2 above.


# Cross-AI Plan Review — Phase 20

> All three explicitly-requested lanes (codex, claude, cursor) ran and returned substantive,
> source-grounded reviews (none stubbed). The `--claude` self-skip guard was overridden for this
> run at owner instruction, so the Claude/Sonnet lane ran as a context-isolated reviewer.
> An orchestrator-side source-grounding pass (symbol verification against real `src/`) and a
> cross-artifact fact-drift pass were then run; their results are in the two blocks appended after
> the Consensus Summary.

## Consensus Summary

Six wave-ordered plans (tracer-first) building an atomic Orbit-to-Orbit merge writer, one-way
System-Contacts→Orbit reconciliation, durable/resumable bulk-review sessions, resume+missing-source/relink,
and a carried-forward unreadable-birthday resolver. All three reviewers independently verified the plans
against the repo on disk and agree the plans are unusually well-grounded (accurate file:line anchors,
correct migration-head discipline, correct partial-unique-index and single-writer-recency awareness,
tombstone-not-archive tested). All three also converge on the same core problem: **several plan claims
assert that a cited primitive or shipped component can do something it currently cannot** — these are
implementation blockers concentrated in the data layer, not polish.

The orchestrator source-grounding pass separately confirms that **every cited existing symbol actually
exists** (no hallucinated symbols); the reviewers' HIGH findings are semantic-contract mismatches (the
symbol exists but its contract does not match what the plan needs), which symbol-existence grounding alone
would not catch. Each reviewer HIGH was re-verified against the actual source (see Verification Coverage).

### Agreed Strengths
- Migration-head discipline: `TARGET_VERSION` is 12 and `MIGRATIONS` ends at `migration012` (verified `src/db/database.ts:47`); 20-01 re-verifies head before bumping to 13 (codex, claude, cursor).
- Partial-unique-index hazards correctly identified and sequenced (`idx_contact_methods_primary_type`, `idx_external_contact_links_active`, verified `011-contact-lifecycle-schema.ts:178,180`) (all three).
- `recomputeLastContactCore` used as the sole `last_contact` writer, enforced by a grep-negative acceptance check rather than prose (claude, codex).
- Tombstone-not-archive is tested, not assumed, via `compareRowAndTombstone` (verified `backup/reconciliation.ts:151`) (all three).
- `recommendationExcludes:'needs_review'` bulk safety seam is treated as logic, not styling (claude, codex, cursor).

### Agreed Concerns (highest priority — 2+ reviewers, orchestrator-verified)
- **CandidateCardGrid "reuse unchanged" is false (HIGH — codex + cursor).** `BulkAction` is only `link|import-new|skip|apply-recommendation` and `actionLabels` is a fixed import-copy record (verified `CandidateCardGrid.tsx:18-22,54-58`). The additive-only `Use Contact Values` and `Keep Orbit Values` actions do not exist; 20-04 must extend the grid and add it to `files_modified` — the safety seam it claims cannot be passed to the current component.
- **20-06 bulk-review flags have no durable persistence (HIGH — codex + cursor).** The unreadable-birthday flag is derived at read time from the immutable `source_payload` (verified `import-session-read.ts:269-278`); `import_session_rows` has no resolution field (verified `012-import-sessions.ts:30-48`) and 20-06 adds no migration/table/column (only a read DAO). "Fix/Ignore clears the flag" and "flags durable until resolved" are unimplementable as scoped.
- **contact_method_provenance / canonical-method dedupe underspecified in the irreversible tracer (HIGH — codex; MEDIUM — claude).** The explicit provenance reparent `method_id IN (SELECT id FROM contact_methods WHERE contact_id=absorbed)` is a no-op after methods reparent, and a canonical-duplicate method that is collapsed/deleted orphans its provenance children (provenance is keyed by `method_id`, verified `011:228-236`). Needs an explicit capture-then-remap procedure + a test.

### Divergent Views (resolved by orchestrator source read)
- **Per-card bulk-action failure isolation.** codex: the grid marks the WHOLE batch failed on a thrown `onBulkAction`; cursor: "failedIds isolation exists." **Orchestrator verdict: codex is correct** — `runBulkAction`'s catch adds ALL `targets` to `failedIds` (verified `CandidateCardGrid.tsx:113-118`); there is no partial-outcome channel, so the plan's E3 per-card-isolation backstop is not satisfiable via the shipped grid.
- **ResumeImportPrompt reusability.** codex: import-coupled, not reusable; cursor: "contract is reusable." **Orchestrator verdict: codex is correct** — props require `ResumableImport`, `resumeImport` routes only to import screens, and `discard` calls the import-session-dao `discardSession` (verified `ResumeImportPrompt.tsx:4,16-51,64`). 20-05 cannot "render the reused ResumeImportPrompt" for a reconcile session without generalizing it; it is not in `files_modified`.
- **Custom-field UNIQUE ABORT** was caught only by **cursor** (HIGH) and independently verified: `custom_field_values UNIQUE(contact_id, field_def_id)` (verified `006:50` / `011:79-85`) makes 20-01's blind `UPDATE custom_field_values SET contact_id=?` ABORT whenever both contacts hold the same `field_def_id`; 20-01 has no custom-field collision pre-resolution.

---

## Codex Review

# Phase 20 Plan Review

## Overall summary

The plans are well sequenced around the risky merge transaction first, then conflict resolution, single-contact reconciliation, durable bulk review, resume/relink, and the carried-forward birthday review. They correctly reuse several established primitives. However, there are multiple implementation-blocking gaps where the proposed calls either cannot achieve the stated behavior or would corrupt/lose durable data. Resolve the HIGH items before executing Plan 20-01, because migration 013 and `mergeContacts` establish the phase’s irreversible foundation.

## 20-01 — Migration and atomic merge tracer

### Strengths

- Correctly derives migration head 12: `TARGET_VERSION` is 12 and `MIGRATIONS` ends with migration 012 in [src/db/database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:47).
- Correctly identifies the two partial-unique hazards before method/link reparenting: primary methods and active external links are constrained in [011-contact-lifecycle-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/011-contact-lifecycle-schema.ts:178).
- Correctly uses `recomputeLastContactCore` rather than directly writing `last_contact`; the only direct writer is explicitly documented and encodes the `rarely_responds` filter in [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:145).
- Correctly treats the absorbed contact as a tombstone rather than an archive. Tombstone precedence on equal timestamps is already implemented in [backup/reconciliation.ts](/home/bwales/projects/orbit-app/src/backup/reconciliation.ts:150).

### Concerns

- **HIGH — The stated provenance reparent operation is ordered incorrectly and will not move anything.** The plan says to reparent `contact_methods`, then update provenance with `method_id IN (SELECT ... WHERE contact_id = absorbedId)`. After methods move, that subquery is empty, leaving provenance unchanged. `contact_method_provenance` only points to `contact_methods.method_id`, not directly to contacts ([011-contact-lifecycle-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/011-contact-lifecycle-schema.ts:228)). Capture absorbed method IDs before moving them, or update provenance first.

- **HIGH — `field_history` is omitted from merge ownership, leaving orphaned audit data attached to the deleted absorbed ID.** It has no FK ([001-initial.ts](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:155)), and purge explicitly deletes it for that reason ([purge-dao.ts](/home/bwales/projects/orbit-app/src/db/purge-dao.ts:242)). A merge must explicitly reparent its rows to the survivor, or deliberately snapshot/retire them under a documented policy.

- **HIGH — Canonical-method deduplication is underspecified and risks deleting durable method/provenance identities without tombstone evidence or provenance remapping.** The established method writer tombstones a removed method before deletion ([contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:191)). The plan’s “collapse canonical-duplicate methods” needs an exact procedure: choose survivor method, reparent provenance rows to it, tombstone/delete the discarded method, then preserve primary/order invariants.

- **MEDIUM — Scalar resolution through `updateContactMetadataCore` needs a complete `UpdateContactFullInput`, not a sparse patch.** It unconditionally writes name, category, cadence, tracking state, social battery, birthday, and toggles ([contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:308)). The plan should require reading the survivor’s full metadata and constructing a complete input; otherwise a scalar-only resolution can reset unrelated fields.

- **MEDIUM — The tracer’s photo cleanup is correct post-commit in principle, but the plan does not specify how it determines whether the absorbed photo is still selected as the surviving value.** Blind unlink is destructive if the survivor resolution chooses that same stored relative photo path.

### Suggestions

- Amend the merge order to: capture absorbed method IDs → resolve/dedupe methods and provenance → reparent remaining provenance/methods → other children → reparent `field_history` → scalar writes → tombstone/delete contact → recency recompute.
- Specify a tested `MergeMethodResolution` contract that maps every losing canonical duplicate to its surviving method and preserves provenance.
- Add test assertions for `field_history` reparenting and provenance retention, not merely child-row counts.
- Make photo-file deletion conditional on the final survivor photo reference.

### Risk assessment

**HIGH.** The merge’s core transaction is sound in intent, but the current proposed provenance order and missing `field_history` handling create data-loss/orphaning risks in the irreversible path.

---

## 20-02 — Merge conflicts and reusable choice UI

### Strengths

- Advisory survivor recommendation is appropriately overridable and deterministic.
- Reusing one `FieldChoiceGroup` and one `PhotoChoice` is consistent with the phase’s reuse requirement.
- The plan correctly avoids using a danger-filled final merge CTA and retains a native confirmation guard.

### Concerns

- **HIGH — Photo conflict application is not implemented by the writer named in the plans.** `updateContactMetadataCore` deliberately omits `photo` ([contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:303)); the dedicated photo writer is `setContactPhoto` ([contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:621)). The plan must define a non-mutexed/core photo update usable inside `mergeContacts`, or the merge cannot atomically apply photo choices.

- **MEDIUM — “Survivor value preselected” conflicts with the reusable component’s stated conflict rule of no preselection.** Plan 20-02 says preselect survivor values, while its `FieldChoiceGroup` task specifies `conflict` preselects nothing. Choose one policy explicitly; it affects whether the user has made an affirmative conflict choice.

- **MEDIUM — The plan asks for a “primary-choose model” but no reusable `choosePrimary` function exists in the cited DAO.** The actual primary behavior is implemented inside `applyContactMethodDiffCore`, including clearing the current primary before changing it ([contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:171)). Define the merge-specific input/model instead of relying on a non-existent export.

### Suggestions

- Add `setContactPhotoCore` or a merge-local, bound, asserted photo update primitive that runs in the outer merge transaction.
- Align the conflict-selection rule across UI spec, component props, and merge safety contract.
- Make Plan 20-02 depend on the corrected method/provenance merge contract from Plan 20-01.

### Risk assessment

**MEDIUM-HIGH.** The UI structure is good, but it currently cannot atomically apply a chosen photo and has an unresolved conflict-selection contract.

---

## 20-03 — Per-contact reconciliation

### Strengths

- Correctly keeps reconciliation one-way and limits field families to the intended scope.
- Correctly calls out the missing-source distinction. `readAllContacts(keys)` already returns `omittedCount`, supporting that model ([modules/orbit-contact-picker/index.ts](/home/bwales/projects/orbit-app/modules/orbit-contact-picker/index.ts:76)).
- Correctly keeps classifier logic pure and makes canonical method comparison a testable unit.

### Concerns

- **HIGH — The proposed Apply path cannot update photos through its declared authoritative writers.** As above, `updateContactMetadataCore` does not update `photo` ([contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:303)). The plan promises `PhotoChoice` and photo reconciliation but supplies no atomic photo persistence/staging design.

- **HIGH — Method reconciliation cannot safely use `applyContactMethodDiffCore` without a full seeded/current editor model.** The function is a whole-list diff: omitted seeded methods are tombstoned and deleted ([contact-methods-dao.ts](/home/bwales/projects/orbit-app/src/db/contact-methods-dao.ts:191)). The plan must require it to seed every existing method and construct a complete desired list, otherwise accepting one addition could remove unrelated Orbit methods.

- **MEDIUM — The snapshot key is per external link plus field family, but the plan reconciles multiple links into one aggregate field choice.** A single user decision over a multi-source aggregate needs snapshot writes for every contributing link and needs a defined canonical aggregate representation. Writing just the selected source’s snapshot will re-surface unchanged disagreement from the other source.

- **MEDIUM — Photo comparison is not presently stable.** The only source photo value is an evictable cache URI ([modules/orbit-contact-picker/index.ts](/home/bwales/projects/orbit-app/modules/orbit-contact-picker/index.ts:19)). “Differs by available signal” must either define a content hash/staging step or always offer manual review without claiming suppression correctness.

### Suggestions

- Define a reconciliation application service/DAO that owns one transaction and composes complete metadata, complete method diff, photo core update, and snapshots.
- Specify aggregate snapshot semantics for multi-source values.
- Explicitly choose whether source photo bytes are staged and hashed, or whether photo differences are always manual and not suppressible.

### Risk assessment

**HIGH.** The plan captures product rules well but is missing the writer contracts needed to apply photos and methods without destructive side effects.

---

## 20-04 — Bulk reconciliation workspace

### Strengths

- Correctly reuses `CandidateCardGrid`; it already offers `onInspect`, selection, and `recommendationExcludes` behavior ([CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:41)).
- Correctly recognizes that “apply recommendation” excludes `needs_review` items ([CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:96)).
- The durable session design is appropriately modeled after import sessions.

### Concerns

- **HIGH — “Use Contact Values” and “Keep Orbit Values” cannot be passed to the existing grid unchanged.** `BulkAction` only supports `link`, `import-new`, `skip`, and `apply-recommendation` ([CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:18)); its labels are a fixed record ([CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:54)). The plan must either extend the shared component’s generic action contract or use supported action identifiers with caller labels. “Reuse unchanged” is false as written.

- **HIGH — The grid does not isolate failures per card as claimed.** One failed `onBulkAction` rejects the whole batch, and the component marks every target failed ([CandidateCardGrid.tsx](/home/bwales/projects/orbit-app/src/components/CandidateCardGrid.tsx:106)). Per-card isolation must be implemented by the caller returning partial outcomes, or by changing the component contract.

- **MEDIUM — The scan/session lifecycle lacks a durable “scanning complete” state.** If the app dies after creating a pending session but before all cards are inserted, resume cannot distinguish an incomplete scan from a complete review. Add scan status/checkpointing or build all scan results atomically before making the session resumable.

### Suggestions

- Make `CandidateCardGrid` accept typed action descriptors (`id`, `label`) and a per-card result map; update its reuse claim accordingly.
- Add a session `scan_status`/completion marker and test process death during scanning, not only after card persistence.
- Define exact mapping from reconciliation card state to the grid’s existing `ConfidenceOutcome` values.

### Risk assessment

**HIGH.** The bulk safety UI depends on component behavior that does not currently exist, and scan interruption can produce misleading durable sessions.

---

## 20-05 — Resume and missing-source lifecycle

### Strengths

- Correctly uses the foreground launch-sweep pattern rather than polling. The existing hook is registered only after migration readiness in [App.tsx](/home/bwales/projects/orbit-app/App.tsx:202).
- Correctly preserves the “retire stale link before attaching new active link” ordering required by the active-link unique index.

### Concerns

- **HIGH — The existing `ResumeImportPrompt` is import-specific, not a reusable generic prompt.** Its props require `ResumableImport` ([ResumeImportPrompt.tsx](/home/bwales/projects/orbit-app/src/components/ResumeImportPrompt.tsx:16)), its resume routing only targets import routes ([ResumeImportPrompt.tsx](/home/bwales/projects/orbit-app/src/components/ResumeImportPrompt.tsx:21)), and discard calls `discardSession` from the import DAO ([ResumeImportPrompt.tsx](/home/bwales/projects/orbit-app/src/components/ResumeImportPrompt.tsx:62)). Plan 20-05 must refactor/generalize it or create a reconciliation-specific prompt; it cannot merely render the existing component.

- **MEDIUM — “Unreadable session offers Discard” is not supported by the proposed sweep behavior.** The import sweep catches read errors and calls `onResumable(null)` ([contact-import-resume-sweep.ts](/home/bwales/projects/orbit-app/src/services/import/contact-import-resume-sweep.ts:124)), which displays no prompt. Define how a corrupt reconciliation session is identified and surfaced as discard-only.

- **MEDIUM — Relinking can violate the globally active `(provider, external_contact_id)` unique index if the newly selected source is already linked to another Orbit contact.** The index is global, not per contact ([011-contact-lifecycle-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/011-contact-lifecycle-schema.ts:180)). The plan needs an explicit duplicate-link outcome: reject and route to merge/reconciliation, or require an explicit unlink from the other contact.

### Suggestions

- Extract a generic `ResumeWorkPrompt` with callbacks/route destination and keep `ResumeImportPrompt` as a thin import adapter.
- Add a `discardOnly` reconciliation descriptor and a read strategy that can safely identify corrupt JSON/schema rows.
- Preflight the new external identity during relink and give a non-destructive outcome when it belongs elsewhere.

### Risk assessment

**MEDIUM-HIGH.** The lifecycle goals are correct, but prompt reuse and duplicate-link handling are not executable as specified.

---

## 20-06 — Bulk unreadable-birthday review

### Strengths

- Correctly requires reuse of the birthday normalizer and local-date formatter.
- The planned Fix/Ignore semantics are appropriately non-destructive in product intent.

### Concerns

- **HIGH — There is no durable per-item “resolved flag” to clear.** Current code only derives an unreadable-birthday count by scanning `source_payload` for imported rows ([import-session-read.ts](/home/bwales/projects/orbit-app/src/db/import-session-read.ts:269)). `import_session_rows` has no resolution field beyond its import status ([012-import-sessions.ts](/home/bwales/projects/orbit-app/src/db/migrations/012-import-sessions.ts:30)). Therefore Fix or Ignore cannot both “clear the flag” and retain the raw payload without a new table/column or an explicit source-payload mutation policy.

- **MEDIUM — The plan says flags are generic for future types but only proposes a read DAO, not generic persistence or mutation APIs.** This will produce a birthday-only special case unless migration 013 adds a durable review-case representation.

- **LOW — The plan should verify the contact linkage is present before applying a birthday.** `import_session_rows.contact_id` is nullable ([012-import-sessions.ts](/home/bwales/projects/orbit-app/src/db/migrations/012-import-sessions.ts:41)); a retained imported row normally has one, but the read must exclude or safely handle rows without it.

### Suggestions

- Add a `bulk_review_cases` table in migration 013, or add a durable resolution field keyed by import-session row and flag type. Store `resolved_at`/resolution choice while retaining raw source payload.
- Make the generic flag DAO own read, resolve-Fix, and resolve-Ignore mutations transactionally.
- Test persistence across app restart and ensure a resolved case does not return after future bulk-review reads.

### Risk assessment

**HIGH.** The feature’s core requirement—durable flags that clear on Fix/Ignore—cannot be achieved with the stated files/schema.

## Cross-plan risk assessment

**Overall: HIGH.** The phase has excellent intent and sensible ordering, but several core paths depend on mechanisms the repository does not currently provide: atomic photo writes, safe partial method reconciliation, generic grid actions/per-card outcomes, generic resume UI, and durable bulk-review resolution state. The merge-specific provenance and `field_history` omissions are especially important to correct before migration 013 and the tracer ship.

---

## Claude Review

# Cross-AI Plan Review: Phase 20 — Contact Reconciliation & Merge

## Summary

Six plans building an atomic Orbit-to-Orbit merge writer, one-way source reconciliation, durable bulk-review sessions, resume/relink lifecycle, and a carried-forward bulk-review surface. The plans are unusually well-grounded — nearly every claim cites a real file/line from RESEARCH/PATTERNS that I could cross-check against the excerpts provided, and the wave sequencing (tracer → conflicts → per-contact → bulk → durability → carry-forward) is sound. The most material gap is in 20-01: the `contact_method_provenance` reparent step is described only in prose ("via method_id") with no concrete SQL, and no plan verifies that reparenting `contact_methods` before `contact_method_provenance` (or vice versa) doesn't orphan provenance rows keyed to the *old* method_id when methods are deduped/collapsed. There's also a real ordering hazard between merge Step 1 (pre-resolve primaries/duplicate links) and Step 2 (reparent) that the plan text asserts is handled but never shows the actual SQL predicate that prevents a false-positive ABORT when the absorbed and survivor already share a canonical duplicate method.

## Strengths

- **Migration numbering discipline**: every plan explicitly instructs re-verifying `TARGET_VERSION` before bumping to 13, not assuming head+1 (20-01 task 1, RESEARCH.md:291,372). This guards against drift if another phase's migration lands first.
- **Partial-unique-index hazard is surfaced and sequenced correctly**: 20-01's task 1 action explicitly orders "PRE-RESOLVE... BEFORE reparent" and the acceptance criteria include a grep-based negative check (`grep -n "UPDATE contacts SET last_contact" src/db/merge-dao.ts` returns nothing) — a cheap, real regression guard against the DATA-04 violation called out in RESEARCH Pitfall 2.
- **`recomputeLastContactCore` ordering is enforced structurally, not just described**: acceptance criteria in 20-01 grep for the call and grep-negative for a direct write, which is a genuinely verifiable gate rather than a prose promise.
- **`Use Contact Values` safety invariant is treated as logic, not styling**, consistently across 20-04's must_haves, prohibitions, and Task 3 action ("computed condition, not unconditional") — this correctly encodes dossier Cluster J and the UI-SPEC's explicit warning against "surfac[ing] it disabled-but-present."
- **Tombstone-vs-archive separation is tested, not assumed**: 20-01's must_haves include "absorbed identity... never appears in listArchived" as a truth with a corresponding merge-dao.test.ts case, directly guarding against Anti-Pattern "Archiving the absorbed contact" in RESEARCH.md:265.
- **The owner checkpoint in 20-01 for the redirect-table decision is correctly scoped** as a blocking, pre-code gate (not embedded silently in the migration), matching PROJECT.md's constraint that migrations are irreversible and forward-only.
- **Reuse discipline is enforced with a specific anti-fork check**: 20-04 Task 3's acceptance criteria assert `CandidateCardGrid` is "imported, not re-implemented," which is a testable proxy for the dossier's "no parallel grid" invariant (Cluster H).

## Concerns

- **[MEDIUM] `contact_method_provenance` reparent ordering vs. method dedupe is underspecified.** 20-01 Task 1's action says to reparent `contact_method_provenance` "via `method_id IN (SELECT id FROM contact_methods WHERE contact_id = ?)`" as one of the 8 UPDATE statements in step (2), but step (1) already runs "collapse canonical-duplicate methods" *before* any reparent — meaning some absorbed `contact_methods` rows may be deleted/merged into survivor rows during pre-resolution, at which point their `id` no longer exists for a later provenance `UPDATE ... WHERE contact_id = <absorbed>` keyed off `method_id`. If provenance rows are keyed to the deleted `contact_methods.id`, the later reparent step (2) can silently orphan or fail to move that provenance data. Neither 20-01 nor the RESEARCH pattern (`RESEARCH.md:196-199`, "Pattern 1") shows the literal SQL, so this can't be confirmed without reading `contact-methods-dao.ts:99-287` (`applyContactMethodDiffCore`/`collapseCanonicalDuplicate`) directly — flagging as an open question for the plan, not a confirmed bug.
- **[MEDIUM] `merge-dao.test.ts` in 20-01 lacks an explicit case for provenance-row survival after canonical dedupe.** The must_haves list "reparents interactions, events, fuel, custom_field_values, contact_links, contact_methods, external_contact_links, and contact_method_provenance (via method_id)" as one bullet, but there's no distinct must_have or acceptance criterion asserting provenance rows for a *deduped* method are still attributable to a source after merge. Given RESEARCH explicitly calls out provenance as a secondary FK path (`RESEARCH.md:198` "+ contact_method_provenance via method_id → contact_methods.contact_id"), this deserves its own test line, not folded into the general reparent bullet.
- **[LOW-MEDIUM] 20-01's `resolutions` shape is declared "empty/survivor-wins (conflict-free path)" for the tracer, but the acceptance criteria never assert what happens when the tracer *does* encounter a scalar conflict** (e.g., two contacts both have a name). The task says this is deferred to 20-02, but nothing in 20-01's UI flow (Task 2, SurvivorSelect → MergeImpactSummary directly, no MergeConflictsScreen in the route chain yet) blocks a user from picking two genuinely conflicting contacts and hitting `mergeContacts` with empty resolutions before 20-02 ships MergeConflictsScreen. If 20-01 ships to any real device build before 20-02, a name/birthday conflict would silently take whichever `updateContactMetadataCore` default resolves (likely survivor-untouched, since resolutions is empty) — this should either be explicitly gated (disable Continue when a conflict is detected, even without full FieldChoiceGroup) or the plan should state the tracer intentionally accepts this UX gap for one wave. Currently it's ambiguous rather than an explicit accepted risk.
- **[LOW] The competing-primary-demotion algorithm is unspecified in 20-01 beyond "demote the absorbed's."** This is directionally fine (survivor wins primaries by default) but interacts oddly with 20-02's later `FieldChoiceGroup`/primary-contention UI, which implies primary conflicts *should* be user-reviewable ("primary-method contention... routes through ContactMethodsEditor's primary-choose model," 20-02 objective). In 20-01 the primary is silently demoted with no user visibility, and 20-02 adds the review UI on top — worth confirming 20-01's tracer default (survivor-wins) matches what 20-02's `resolutions` parameter is expected to override, since `mergeContacts` signature doesn't obviously show how a user's primary choice from 20-02 gets threaded past step (1)'s pre-resolution logic.
- **[LOW] Migration 013's `reconcile_source_snapshot` stores `reviewed_value` as bare TEXT with no explicit canonicalization contract enforced at the schema layer** (RESEARCH Pattern 3, 20-03 Task 2) — correctness depends entirely on `reconcile-snapshot-dao.ts` always writing canonical form before persisting, per PATTERNS.md:174. This is a normal DAO-layer responsibility, not a schema bug, but there's no CHECK constraint or test asserting the *raw* (non-canonical) value can never leak into the table, only that "the canonical-equality suppression round-trip" is tested (20-03 Task 2 verify). Acceptable given TEXT-forever custom-field precedent elsewhere in the app, but worth a one-line test asserting non-canonical input gets normalized before storage, not just that stored-canonical values suppress correctly.
- **[LOW] `field_history` write during merge has no FK to the merge operation itself** — CLAUDE.md requires destructive ops snapshot to `field_history` "in the same transaction," which 20-01 does correctly (Task 1 action step 3), but nothing ties that field_history row back to *which* merge it came from (no `merge_uid` column mentioned). Given `field_history` already has no FK per RESEARCH.md:75 ("field_history has NO FK and does not reparent by cascade"), this is consistent with existing behavior elsewhere in the app, not a new gap — noting only because a future audit trying to answer "what changed on this contact due to a merge" won't be able to distinguish merge-caused field_history rows from ordinary edits.

## Suggestions

- Add an explicit `merge-dao.test.ts` case in 20-01 asserting `contact_method_provenance` rows survive attribution correctly when the merge's step-1 dedupe collapses a canonical-duplicate method (not just when methods pass through untouched).
- In 20-01, either (a) have `MergeImpactSummary`/`SurvivorSelect` detect and block/warn on a genuine scalar conflict until 20-02 ships, or (b) add one line to the plan's objective/must_haves explicitly accepting "conflicting scalar fields silently keep survivor's value in this tracer wave" as a known, bounded gap closed by 20-02 — right now it's neither blocked nor documented.
- Clarify in 20-02 (or as a code comment requirement) exactly how `MergeConflictsScreen`'s primary-method resolution value is threaded through `mergeContacts`'s `resolutions` param past the pre-resolution demotion step in `merge-dao.ts` — i.e., does `resolutions.primaryMethodChoice` override step (1)'s "demote absorbed's" default, or does step (1) need to become conditional on `resolutions` being present? This should be nailed down before 20-02 execution starts, since it's a genuine coupling between the two plans' DAOs.
- Consider a one-line assertion test for `reconcile-snapshot-dao.ts` (20-03 Task 2) confirming that writing a non-canonical raw phone string still results in the canonical form being stored (i.e., the DAO itself normalizes, not just the caller) — cheap insurance against a future caller bypassing normalization.

## Risk Assessment

**LOW-MEDIUM.** The plans are exceptionally well-sourced against real code (file:line citations checked against the RESEARCH/PATTERNS/UI-SPEC content actually verify what they claim), the SQLite integrity hazards (partial unique indexes, single-writer `last_contact`, tombstone-not-archive) are correctly identified and structurally tested rather than just asserted in prose, and the wave sequencing is dependency-correct. The concerns raised are concentrated in one under-specified interaction (provenance reparent ordering vs. method dedupe) and one temporal UX gap in the tracer wave (conflict-free assumption not enforced at the UI layer) — both are addressable with small test/plan additions rather than a redesign. No HIGH-severity findings; nothing here blocks proceeding to execution, but I'd resolve the provenance-reparent question and the tracer's conflict-blocking behavior before or during 20-01 execution rather than discovering them at 20-02 integration.

---

## Cursor Review

# Phase 20: Contact Reconciliation & Merge — Cross-AI Plan Review

Verified against `/home/bwales/projects/orbit-app` on disk. Migration head is **12** (`src/db/database.ts:47`); partial-unique indexes, purge fan-out, recency single-writer, and grid contracts were traced in source, not taken from plan text alone.

---

## Phase-Level Assessment

These six wave-ordered plans are unusually well grounded in shipped mechanisms: `purge-dao` fan-out, `recomputeLastContactCore`, import-session durability, `CandidateCardGrid` safety seams, and dossier clusters are referenced with accurate file anchors. Tracer-first ordering (atomic merge before reconciliation UI expansion) correctly front-loads the highest integrity risk.

However, several plan claims contradict the current component/schema contracts. The most serious gaps are **custom-field merge collisions** (`UNIQUE(contact_id, field_def_id)`), **`CandidateCardGrid` bulk-action labels/types**, and **bulk-review flag dismissal** with no persistence model. Those are implementation blockers, not polish items.

**Overall phase risk: MEDIUM-HIGH** — the architecture is sound, but three concrete mismatches between plan assertions and repo reality need resolution before execution.

---

## Plan 20-01 — Tracer: Migration 013 + `mergeContacts` + Minimal Merge UI

### Summary

Strong tracer design: one irreversible migration, one atomic writer modeled on proven purge structure, owner-gated redirect-table decision, and node tests before UI. Correctly identifies partial-unique-index ordering and the non-reentrant recency path as the primary failure modes.

### Strengths

- **Purge model is accurate.** `PURGE_CHILDREN` in `src/db/purge-dao.ts:76-86` lists the same eight child families the plan reparents (interactions, events, fuel, custom_field_values, contact_links, contact_methods, external_contact_links, contact_method_provenance via join).
- **Recency invariant is correctly specified.** `recomputeLastContactCore` must run inside an open transaction and never nest `inWriteTransaction` (`src/db/recency-dao.ts:151-157`, `src/db/transaction.ts:11-23`).
- **Partial unique indexes verified.** `idx_contact_methods_primary_type` and `idx_external_contact_links_active` exist at `src/db/migrations/011-contact-lifecycle-schema.ts:178-180`.
- **Tombstone resurrection-proofing is real.** `compareRowAndTombstone` at `src/backup/reconciliation.ts:151-155` implements the RCN-04 mechanism the plan cites.
- **Owner checkpoint on `contact_redirects`** correctly treats migration 013 as a one-way door.

### Concerns

- **HIGH — Custom-field reparent will ABORT on collision.** `custom_field_values` has `UNIQUE(contact_id, field_def_id)` (`src/db/migrations/011-contact-lifecycle-schema.ts:79-85`). Task 1 reparents with a blind `UPDATE … SET contact_id = ?` but does not pre-resolve duplicate `field_def_id` rows. Plan 20-02 adds custom-field conflict UI, but 20-01’s writer has no step to delete/losers-merge absorbed rows before reparent.
- **MEDIUM — `sun_contact_id` handling differs from purge.** Purge NULLs the sun (`src/db/purge-dao.ts:253-258`); the plan redirects to the survivor. That is correct for merge, but the plan should explicitly say **not** to reuse purge’s NULL semantics — redirect-to-survivor is merge-specific.
- **MEDIUM — Post-commit notification cleanup is underspecified.** `purge-notification-cleanup.ts` already cancels `decay:<id>` / `birthday:<id>` post-commit (`src/services/notifications/purge-notification-cleanup.ts:11-35`). The plan mentions canceling `decay:<absorbedId>` but does not name this adapter; executors may reimplement it.
- **LOW — Second-candidate picker is thin.** Profile overflow opens SurvivorSelect with one id; picking the second contact is unspecified beyond “minimal contact-list select.”

### Suggestions

- Add an explicit merge pre-step for **custom-field collisions**: for each shared `field_def_id`, apply 20-02 resolution (or survivor-wins default in the tracer), **delete** the losing row, then reparent survivors.
- Wire post-commit cleanup through the existing `onPurgeExtensions` pattern, reusing `purge-notification-cleanup` (and photo cleanup) rather than ad-hoc cancels.
- In `merge-dao.test.ts`, include a case where both contacts have different values for the same `field_def_id` — this would fail today and validates the fix.

### Risk Assessment

**MEDIUM-HIGH** — Core transaction design is excellent, but the custom-field unique constraint is a guaranteed ABORT on realistic merges unless addressed in this plan or gated until 20-02 extends the writer.

---

## Plan 20-02 — Merge with Conflicts + Reusable Choice Widgets

### Summary

Correctly builds the reusable `FieldChoiceGroup` / `PhotoChoice` layer consumed by reconciliation, and threads resolutions into `mergeContacts`. Survivor recommendation as pure logic matches the `duplicate-evidence.ts` idiom. Several must-haves contradict the locked UI-SPEC preselection rules.

### Strengths

- **Reuse contract is right.** UI-SPEC mandates one widget for merge and reconcile (`20-UI-SPEC.md:245-247`); plan routes both through the same components.
- **Primary contention correctly deferred to existing model.** `applyContactMethodDiffCore` + editor primary-choose logic is the right path (`src/db/contact-methods-dao.ts:99+`).
- **Photo path guidance matches Avatar contract.** Avatar expects stored relative paths and resolves via `resolvePhotoUri` (`src/components/Avatar.tsx:33-34`, `73`); plan correctly requires pre-resolved `file://` URIs in `PhotoChoice`.
- **Non-destructive unselected scalars** align with UI-SPEC: writes only selected values; `field_history` on overwrite is specified for merge.

### Concerns

- **HIGH — Custom-field merge resolutions not wired in 20-01 writer.** Must-haves require scalar custom-field conflicts in `MergeConflictsScreen`, but Task 1’s `mergeContacts` only calls `updateContactMetadataCore` for fixed columns (`src/db/contacts-dao.ts:308-335`). Custom values need `upsertValueCore` / delete-loser paths (`src/db/field-values-dao.ts:64-79`) inside the same transaction.
- **MEDIUM — Preselection contradicts UI-SPEC.** Must-haves say “survivor value preselected, overridable” for conflicts; UI-SPEC locks **conflicting → no preselection** (`20-UI-SPEC.md:239`, `293`). Executors following the plan text will violate the spec.
- **MEDIUM — `impactSummaryLines` omits methods/external links.** `computeImpact` counts them (`src/db/purge-dao.ts:145-147`) but `impactSummaryLines` only renders interactions/events/fuel/links (`src/db/purge-dao.ts:182-194`). Plan correctly says to use count SQL directly for MergeImpactSummary — make that explicit so executors don’t call `impactSummaryLines` and miss rows.

### Suggestions

- Fix must-haves and Task 3 action text: **conflict mode = no preselection**; only additive/removed modes preselect.
- Extend `mergeContacts` resolutions shape to include custom-field entries and document the collision algorithm (delete absorbed row vs upsert survivor value before reparent).
- Add `survivor-recommendation.test.ts` tie-break cases (equal interactions, equal linkage) since heuristic is advisory-only.

### Risk Assessment

**MEDIUM** — UI layer is well scoped; data-layer gap on custom fields and preselection drift are the main risks.

---

## Plan 20-03 — Per-Contact Reconciliation End-to-End

### Summary

Best-aligned plan with dossier RCN-01: pure `reconcile-diff`, narrow snapshot memory, apply-through-existing-writers, missing-source as distinct state. Correctly limits reconciled families to five and reuses the 20-02 widgets.

### Strengths

- **Source re-read API matches implementation.** `readAllContacts(lookupKeys)` returns `{ contacts, omittedCount }` for missing-source detection (`modules/orbit-contact-picker/index.ts:76-122`).
- **Canonical method equality path exists.** `normalizeContactMethod` / `canonical_value` in `src/db/contact-methods-dao.ts:5-8`.
- **Apply path specifies Core writers.** Plan requires `updateContactMetadataCore` and `applyContactMethodDiffCore`, avoiding nested `inWriteTransaction` (`applyContactMethodDiff` wraps mutex at `:300-302`).
- **Unreadable birthday idiom verified.** `isBirthdayUnreadable` + `source_payload` counting exists (`src/db/import-session-read.ts:269-278`, `src/logic/picked-contact-map.ts:67`).

### Concerns

- **MEDIUM — Reconciliation overwrite may skip `field_history`.** CLAUDE.md requires destructive ops to snapshot in-transaction. Plan mandates `field_history` for merge overwrites (20-01) but 20-03 Apply does not require snapshots when a reconciliation choice overwrites an existing Orbit name/birthday. That is the same class of data loss audit gap.
- **MEDIUM — Photo fingerprint assumption correctly flagged in research, but Apply path still vague.** No stable source photo token exists (`PickedContact.photoTempUri` is cache); plan relies on manual `PhotoChoice` — ensure `reconcile-diff` never auto-applies photo changes.
- **LOW — Profile gate is correct but depends on migration 011 links.** `external_contact_links` with `is_active=1` partial unique index (`011:180`) matches relink ordering concerns deferred to 20-05.

### Suggestions

- Add acceptance criterion: when Apply overwrites an existing Orbit scalar, INSERT prior value into `field_history` in the same txn (mirror merge rule).
- Explicitly forbid calling `applyContactMethodDiff` (wrapper) from `ReconcileDetailScreen`; grep gate for `Core` suffix only.
- Test `unchanged-since-review` with snapshot canonical form for phones (formatting variants).

### Risk Assessment

**LOW-MEDIUM** — Strong one-way reconciliation design; `field_history` omission is the main invariant gap.

---

## Plan 20-04 — Bulk Check Linked Contacts + Durable Sessions

### Summary

Correctly mirrors the proven `import_sessions` pattern and reuses the grid’s `recommendationExcludes: "needs_review"` safety seam. Session DAO/read split matches Phase 19 idioms. **“Reuse CandidateCardGrid unchanged” is not true given current types.**

### Strengths

- **Grid safety seam verified.** `apply-recommendation` filters `recommendationExcludes` (`src/components/CandidateCardGrid.tsx:96-102`).
- **failedIds isolation exists** for per-card bulk failures (`src/components/CandidateCardGrid.tsx:76-78`, `115-120`).
- **Settings anchor point verified.** Contacts Integration section at `src/screens/SettingsScreen.tsx:735-761` — plan’s insertion point is accurate.
- **DuplicateReviewScreen confirms onInspect was no-op** (`src/screens/DuplicateReviewScreen.tsx:257`) — wiring to `ReconcileDetailScreen` is the expected Phase 20 fix.

### Concerns

- **HIGH — Bulk actions cannot be “unchanged reuse”.** `BulkAction` is only `"link" | "import-new" | "skip" | "apply-recommendation"` (`src/components/CandidateCardGrid.tsx:18-22`). Labels are hardcoded to import copy (`54-58`, rendered at `247-256`). UI-SPEC bulk labels are `Apply Recommendations` / `Keep Orbit Values` / `Use Contact Values` (`20-UI-SPEC.md:402`). Plan 20-04 and UI-SPEC say “unchanged” while requiring different labels and at least one new semantic action (`Keep Orbit Values`, conditional `Use Contact Values`).
- **MEDIUM — Mapping ambiguity.** UI-SPEC maps `Apply Recommendations` → `apply-recommendation`, but `Keep Orbit Values` / `Use Contact Values` have no enum values. Executors must either extend `BulkAction` + `actionLabels` or pass caller-supplied labels — neither is scoped.
- **LOW — `scoring` copy mismatch.** Grid scoring text is `"Checking for matches…"` (`CandidateCardGrid.tsx:127-129`); UI-SPEC wants `"Checking linked contacts…"`. Minor but contradicts “unchanged.”

### Suggestions

- Revise plan language: **“reuse grid layout/behavior; extend BulkAction + labels for reconciliation.”** Add `src/components/CandidateCardGrid.tsx` to 20-04 `files_modified`.
- Document explicit mapping: `apply-recommendation` → Apply Recommendations; add `keep-orbit` / `use-contact-values` actions with reconciliation handlers in `ReconcileGridScreen`.
- Add integration test: selection mixing additive + conflict cards must omit `Use Contact Values` from `bulkActions` array entirely (not just disable).

### Risk Assessment

**MEDIUM-HIGH** — Session layer is low risk; grid extension is a hidden scope item that will block 20-04 if not planned.

---

## Plan 20-05 — Durable Resume + Missing-Source/Relink

### Summary

Correctly uses launch-sweep (no timers) and mirrors `registerImportResumeSweep`. Missing-source as distinct state and retire-then-attach relink ordering match partial-unique-index constraints.

### Strengths

- **Launch-sweep registration pattern exists.** `registerImportResumeSweep` + `registerSweepHook` (`src/services/import/contact-import-resume-sweep.ts:11`, `App.tsx:205-207`).
- **Relink ordering requirement matches schema.** `idx_external_contact_links_active` requires retire-before-attach (`011:180`).
- **ResumeImportPrompt contract is reusable** (`App.tsx:291+`).

### Concerns

- **MEDIUM — Dual resume prompts not specified.** App holds one `resumableImport` state (`App.tsx:123-124`). If both import and reconcile sessions are pending, plan does not define precedence, queuing, or combined prompt behavior.
- **MEDIUM — Discard semantics vs applied work.** Plan says discard clears unresolved review state while applied resolutions persist — needs explicit test that `discardSession` does not roll back contact writes already committed via `ReconcileDetailScreen`.
- **LOW — Corrupt session handling** (E9 backstop) is listed but no DAO validation shape is specified.

### Suggestions

- Add App-level policy: e.g. show import resume first, then reconcile; or single prompt with two rows. Document in 20-05 Task 1.
- Test: apply one card, kill app, resume, discard — contact changes remain, unresolved cards gone.
- Name `purge-notification-cleanup` if relink/merge retires links that had scheduled notifications.

### Risk Assessment

**MEDIUM** — Mechanisms exist; multi-session UX edge is the main gap.

---

## Plan 20-06 — Bulk Review Surface + Phase Verification

### Summary

Appropriately carries forward Phase 19.1’s counted-but-unresolved unreadable birthdays. Fix/Ignore UX and `formatLocalDate` guardrails match project conventions. **Flag persistence/clearing is not implementable as written.**

### Strengths

- **Flag detection logic already exists for counts.** `isBirthdayUnreadable(sourceBirthday(source_payload))` (`import-session-read.ts:274-278`).
- **Birthday edit idiom has a template.** ImportReview + `normalizeEditedBirthday` path is referenced correctly.
- **Consolidated device UAT in Task 2** is thorough and matches phase success criteria.
- **Local-first preserved** — reads import rows only, no network.

### Concerns

- **HIGH — No schema for “clear the flag”.** `import_session_rows.source_payload` is immutable import history (`src/db/migrations/012-import-sessions.ts:35-36`). Re-reading `isBirthdayUnreadable(source_payload)` will always flag the same row after Fix (birthday now on contact) or Ignore unless:
  - a new `bulk_review_flags` / dismissal table is added (not in migration 013), or
  - read logic excludes contacts with resolved birthdays **and** tracks Ignore dismissals somewhere.
  Plan says “clear the flag” and “flags persist until resolved” but specifies neither storage nor migration.
- **MEDIUM — Fix path uses `updateContactMetadataCore` bare.** That function is non-mutexed Core (`contacts-dao.ts:308`) — OK inside a wrapper txn, but plan should require a thin `inWriteTransaction` + flag dismissal in one txn.
- **LOW — Entry point competes with 20-04 Settings rows.** Three Contacts Integration rows (Import / Check linked / Review flagged) — acceptable, but plan should note ordering.

### Suggestions

- Add to migration 013 (or a 20-06 sub-task): `bulk_review_dismissals(contact_id, flag_type, dismissed_at)` or a column on contacts — owner decision needed.
- Define read rule: show flag iff `contact.birthday IS NULL` AND unreadable payload AND not dismissed.
- Until schema exists, downgrade “durable until resolved” to an open question in 20-06 acceptance criteria.

### Risk Assessment

**MEDIUM-HIGH** — UI is straightforward; persistence model is missing.

---

## Cross-Cutting Invariants Check

| Invariant | Status |
|-----------|--------|
| Local-first, no network on read paths | ✅ All plans comply |
| Forward-only migrations, head 12→13 | ✅ 20-01 verifies head before bump |
| Normalized `custom_field_values` (not retired dynamic columns) | ⚠️ Merge reparent must handle `UNIQUE(contact_id, field_def_id)` |
| `field_history` on destructive overwrite | ⚠️ Merge yes; reconciliation apply not specified in 20-03 |
| Theme tokens / no hex | ✅ Verification gates present |
| `formatLocalDate`, not `toISOString().split` | ✅ 20-06 explicitly gated |
| No nested `inWriteTransaction` | ✅ Plans cite Core variants; executor discipline required |

---

## Dependency Ordering

Wave sequence **20-01 → 02 → 03 → 04 → 05 → 06** is logical. One adjustment worth making explicit:

- **Custom-field collision handling** must land before or with 20-02’s first conflicting merge, not after — either extend 20-01’s writer with a stub “survivor wins” collision resolver or block 20-02 until 20-01 Task 1 handles it.

20-04 correctly depends on 20-03 (classifier + detail). 20-05 correctly depends on session store from 20-04.

---

## Priority Fixes Before Execution

1. **Resolve `CandidateCardGrid` extension** — update 20-04 scope/files; stop claiming “unchanged.”
2. **Design custom-field merge collision algorithm** — pre-delete/resolve before reparent; test against `011:84`.
3. **Design bulk-review flag dismissal storage** — migration 013 or 014; update 20-06 Task 1.
4. **Align conflict preselection** — plan text must match UI-SPEC (no preselect on conflict).
5. **Add `field_history` to reconciliation Apply** — same rule as merge overwrites.
6. **Define dual resume prompt behavior** when import + reconcile sessions coexist.

---

## Final Risk Assessment

| Plan | Risk | Primary driver |
|------|------|----------------|
| 20-01 | MEDIUM-HIGH | Custom-field UNIQUE + large tracer scope |
| 20-02 | MEDIUM | Preselection drift + custom-field writer gap |
| 20-03 | LOW-MEDIUM | Missing `field_history` on apply |
| 20-04 | MEDIUM-HIGH | Grid bulk-action type/label mismatch |
| 20-05 | MEDIUM | Dual resume UX |
| 20-06 | MEDIUM-HIGH | Flag dismissal persistence unspecified |
| **Phase overall** | **MEDIUM-HIGH** | Three schema/component contract gaps |

The plans demonstrate strong research discipline and correctly treat Phase 20 as composition of shipped parts rather than new infrastructure. They will execute safely once the grid extension, custom-field merge collision path, and bulk-review dismissal model are written into the plans with acceptance tests.

---

## Verification Coverage (source-grounding pass)

Every symbol the six PLAN.md files cite as an EXISTING reference (excluding the net-new symbols each
plan declares under "Artifacts this phase produces") was resolved against the real source on disk with
ripgrep/Read. All checked symbols VERIFIED — no hallucinated symbols. For shared tables, every writer was
read, not just the one a plan named. Verdicts:

| Cited symbol | Plan(s) | Verdict | Evidence |
|---|---|---|---|
| `TARGET_VERSION = 12`, `MIGRATIONS` ends at `migration012` (head=12 → 013=13) | 20-01 | VERIFIED | `src/db/database.ts:47,50,61-62` |
| `migration011`, `migration012` registered | 20-01 | VERIFIED | `src/db/database.ts:35-36` |
| `recomputeLastContactCore` (sole `last_contact` writer, exported alias) | 20-01,03 | VERIFIED | `src/db/recency-dao.ts:427` (alias of `recomputeLastContact:150`) |
| `insertTombstoneCore`, `TombstoneEntityType` incl. `'contact'` | 20-01 | VERIFIED | `src/db/tombstones-dao.ts:53,8-9` |
| `updateContactMetadataCore` (asserts 1 row; full-row UPDATE) | 20-01,02,03,06 | VERIFIED | `src/db/contacts-dao.ts:308-334` |
| `archiveContact`/`restoreContact`/`listArchived` (do-not-route-merge) | 20-01 | VERIFIED | `src/db/contacts-dao.ts:521,558,591` |
| `applyContactMethodDiffCore`, `normalizeContactMethod`, `canonical_value` | 20-01,02,03 | VERIFIED | `src/db/contact-methods-dao.ts:99,7,17` |
| `inWriteTransaction` (non-reentrant mutex) | all | VERIFIED | `src/db/transaction.ts:49` |
| `purgeContact`/`computeImpact`/`impactSummaryLines`/`PURGE_CHILDREN`/`onPurgeExtensions` | 20-01,02 | VERIFIED | `src/db/purge-dao.ts:204,121,176,76,97` |
| `sun_contact_id` redirect column (app_settings) | 20-01 | VERIFIED | `009:91`, `011:50` |
| `field_history` schema (contact_id, field_col_name, old_value, operation, created_at) | 20-01 | VERIFIED | `src/db/migrations/001-initial.ts:156-162` |
| 8 reparent child tables (interactions/events/fuel/custom_field_values/contact_links/contact_methods/external_contact_links/contact_method_provenance) | 20-01 | VERIFIED | `011:73-124,228`; `006:42`; provenance keyed by `method_id` `011:234` |
| `compareRowAndTombstone` | 20-01 | VERIFIED | `src/backup/reconciliation.ts:151` |
| partial-unique indexes + `contacts_prevent_cadence_clear` | 20-01,05 | VERIFIED | `011:178,180,181` |
| `setContactPhoto` (self-wraps `inWriteTransaction`; no `*Core` variant) | 20-02,03 | VERIFIED | `src/db/contacts-dao.ts:621-645` |
| `custom_field_values UNIQUE(contact_id, field_def_id)` | 20-01,02 | VERIFIED | `006:50`, `011:79-85` |
| `CandidateCardGrid` props (`bulkActions`,`onInspect`,`onBulkAction`,`recommendationExcludes`,`scoring`,`failedIds`) | 20-04 | VERIFIED | `src/components/CandidateCardGrid.tsx:43-51,76,195` |
| `BulkAction` union + `actionLabels` record | 20-04 | VERIFIED | `CandidateCardGrid.tsx:18-22,54-58` |
| `registerSweepHook`, `registerImportResumeSweep` | 20-05 | VERIFIED | `launch-sweep.ts:45`; `contact-import-resume-sweep.ts:116,124` |
| `ResumeImportPrompt`/`ResumeImportPromptProps` (import-coupled) | 20-05 | VERIFIED | `src/components/ResumeImportPrompt.tsx:16,54` |
| `readAllContacts`/`readContactsByLookupKeys`/`PickedContact`/`omittedCount` | 20-03,04 | VERIFIED | `modules/orbit-contact-picker/index.ts:76,69,14,36` |
| `choosePrimary` (editor model) | 20-02 | VERIFIED | `src/components/contact-methods-editor-model.ts:112` |
| `duplicate-evidence` pure classify idiom | 20-02,03 | VERIFIED | `src/services/import/duplicate-evidence.ts:5-18` |
| `ConfidenceChip`, `OverflowMenu`/`OverflowAction`, `footerEntry` idiom | 20-01,02,04 | VERIFIED | `ConfidenceChip.tsx`; `OverflowMenu.tsx:20,29`; `ImportCompleteScreen.tsx:144` |
| `normalizeEditedBirthday`, `formatLocalDate`, `isBirthdayUnreadable`, `source_payload` | 20-06 | VERIFIED | `birthday-logic.ts:121`; `ImportReviewScreen.tsx:36`; `import-session-read.ts:274`; `012:34` |
| `import_session_rows` schema (no per-flag resolution field) | 20-06 | VERIFIED | `012-import-sessions.ts:30-48` |

**UNCHECKABLE / skipped:** none. Every cited existing symbol was resolvable in-repo. The one initial
false-negative (`normalizeEditedBirthday` appeared absent because ripgrep matched an aliased import `n`
in the test file) was resolved to VERIFIED at `birthday-logic.ts:121`. Device/UI-observable claims
(Skia render, Pixel UAT flows) are not statically checkable and are correctly deferred to end-of-phase
device UAT (20-06 Task 2) — not counted as MISSING.

**Grounding conclusion:** symbol existence is clean; the HIGH findings below are semantic-contract
mismatches (cited-primitive-cannot-do-what-plan-needs), which are the substantive review output.

## Fact-Drift Pass (ADVISORY — not counted toward HIGH/actionable)

No genuine same-fact contradictions found.

- **Phase status:** STATE.md `status: ready_to_execute` / "Phase 20 planned (6 plans) — ready to execute" vs ROADMAP progress "Not started" (`[ ]`, 0 plans). Not a contradiction — neither side claims *complete*; authority STATE.md. (Wording differs: "planned/ready" vs "not started".)
- **Requirement IDs:** ROADMAP Phase 20 = RCN-01..04; REQUIREMENTS.md defines RCN-01..04 → Phase 20; plans collectively reference RCN-01/02/03/04. Consistent (authority ROADMAP).
- **Success criteria:** ROADMAP's 4 success criteria map 1:1 to RCN-01..04; PLAN `must_haves.truths` add finer-grained truths beyond the roadmap (sanctioned addition, not drift).
- **Glossary/domain terms:** 20-CONTEXT.md decisions (tombstone-not-archive, one-way source→Orbit, no source write-back, additive-only bulk) are used consistently across all six plans; no contradictory usage.

> Note (not fact-drift, but a plan-vs-locked-contract issue counted as actionable below): 20-02
> must_have truth #2 says conflicting scalar fields render "with the survivor value preselected" while
> the LOCKED 20-UI-SPEC.md:239 mandates "conflicting → no preselection" (and 20-02 Task 2 itself agrees
> with the spec). That contradicts the authoritative UI design contract and needs a must_have wording fix.
