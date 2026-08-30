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
