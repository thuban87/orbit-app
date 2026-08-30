---
phase: 20
reviewers: [codex, claude, cursor]
reviewed_at: 2026-08-30T20:13:09Z
plans_reviewed: [20-01-PLAN.md, 20-02-PLAN.md, 20-03-PLAN.md, 20-04-PLAN.md, 20-05-PLAN.md, 20-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "sonnet (reasoning=low)"
  cursor: "unknown"
model_sources:
  codex: "banner"
  claude: "pinned"
  cursor: "unknown"
---

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
