---
phase: 19
reviewers: [codex, cursor, claude]
reviewed_at: "2026-08-29T05:47:22Z"
plans_reviewed:
  - 19-01-PLAN.md
  - 19-02-PLAN.md
  - 19-03-PLAN.md
  - 19-04-PLAN.md
  - 19-05-PLAN.md
  - 19-06-PLAN.md
  - 19-07-PLAN.md
  - 19-08-PLAN.md
  - 19-09-PLAN.md
  - 19-10-PLAN.md
  - 19-11-PLAN.md
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  cursor: "unknown"
  claude: "claude-sonnet-5"
model_sources:
  codex: "banner"
  cursor: "unknown"
  claude: "self-reported"
---

# Cross-AI Plan Review — Phase 19: System Contact Import

## Consensus Summary

All three reviewers (Codex, Cursor, and Claude/Sonnet-5, each independently source-grounded against the actual repository at v11) converge on the same overall picture: the 11-plan architecture — additive migration first, tracer-first single-contact vertical slice, deterministic-bypass-before-advisory duplicate scoring, per-row transactional bulk import, post-commit photo persistence — is directionally correct and honors every locked product decision (Android-only, no `READ_CONTACTS`, no per-person bulk checkbox list, no silent linking/merging, no generic Orbit-to-Orbit merge, no reversal of any `[DECIDED]`/ADR/HANDOFF item). No reviewer found a decision reversal. All three independently rate overall phase risk **HIGH**, not because the product intent is wrong, but because the plan-level mechanics for durability and status accounting have concrete, verifiable defects that would make IMP-04's "durable, honest report" promise false as currently specified.

### Agreed Strengths (2+ reviewers)

- Correct respect for the single non-reentrant write mutex (`inWriteTransaction` in `src/db/transaction.ts`); plans 03/04 correctly avoid nesting `createContactFull`.
- Deterministic external-link bypass (`idx_external_contact_links_active` partial unique index) correctly precedes and short-circuits the advisory duplicate scorer.
- Native module approach mirrors the existing `orbit-backup-document-picker` pattern; no `READ_CONTACTS` anywhere.
- Tracer-first sequencing (19-04 before bulk/photo/duplicate expansion) is the right risk-reduction order for a 2026 Android API.
- Reuse map (`buildBirthdayForStorage`, `setContactPhoto`, `registerSweepHook`, the active-link unique index) is accurate against the real source.

### Agreed Concerns (2+ reviewers — highest priority)

- **HIGH — Contact creation and durable session-row state are not written atomically.** Multiple plans (04, 06, 07, 11) create a real contact via `importContactRecord`/`commitSingleImport` and only *afterward*, in a separate call, update the session row's status/`contact_id`. A crash between the two leaves a committed contact with a row that still reads as unresolved (or, per Claude's isolated tracing of plan 04, `commitSingleImport` never calls `setRowContact` at all, so even the non-crash path leaves the session's own row permanently unresolved while the session itself is marked complete). This directly undermines IMP-04's resumable/no-duplicate-on-resume guarantee.
- **HIGH — Photo staging is not actually durable as planned.** Plan 02 copies picker photo bytes to Android `cacheDir` (OS-evictable); plans 01/04 then treat that cache path as the durable session snapshot. The repo already has a document-dir staging idiom for exactly this purpose (`restorePendingRelPath` in `src/services/photos/photo-storage.ts`), but no plan routes the picker photo through it before the session row is inserted. A process death or cache eviction between acceptance and photo persistence produces a session that references a photo file which no longer exists.
- **HIGH — Row-status/count semantics are inconsistent across plans 01/06/07/08, producing a completion summary that cannot be computed as specified.** `19-UI-SPEC.md` requires `Already in Orbit (n)` as a row distinct from `Failed / skipped (n)`, but the bulk driver (19-06) marks deterministic already-linked rows `row_status='skipped'` — the identical status a user-initiated Skip (19-07) also writes — and `sessionRowCounts` (19-01) groups only by `row_status`. Claude's independent trace additionally shows neither skip path ever populates `match_outcome` either, so even a smarter query (grouping by `match_outcome`) cannot recover the distinction from data no plan writes — this requires a driver-level fix (19-06), not only a query-level fix (19-08).
- **HIGH — Retry (19-08) is specified against a driver (19-06) that cannot serve it.** 19-08 says Retry re-runs failed/pending rows; 19-06's `runImportBatch` as specified loads only `pending` rows. Failed rows would be silently ignored by a literal Retry implementation.
- **HIGH — Bulk import has no wired entry point from the Add flow.** 19-04's own `key_links` states the FAB routes single vs. bulk by picker-result length, but Task 2's action text hardcodes `pickContacts({multiple:false})`, and no other plan's `files_modified` touches `AddSpeedDialFab.tsx`/`HomeScreen.tsx` to add the missing branch. IMP-02's bulk-selection requirement has no planned glue code.
- **HIGH — Cluster K multi-source consolidation (19-11) cannot fire on its intended scenario given the current wiring/sequencing.** Wired into `DuplicateReviewScreen` after `runImportBatch` has already processed rows individually, at least one of any two same-person source records is gone from the session's queryable row set by the time consolidation-detection runs (either already imported as its own contact, per Cursor/Codex's ordering framing, or — per Claude's mechanism-level trace — already re-scored by the live duplicate-evidence engine as a match against its own just-imported sibling and filtered out of the loadable set, making `detectSourceClusters` structurally unable to see both rows together for the two-selected-sources case it was built to serve).

### Divergent / Additional Findings (single-reviewer, still worth tracking)

- **Cursor, MEDIUM:** Phone-region context (`resolveEffectivePhoneRegion`) used by `CreateContactScreen` is never threaded into `mapPickedContact`/`importContactRecord`'s `methodNormalization`. **Claude independently confirmed and sharpened this** by tracing `normalizeContactMethod`'s region-fallback code (`src/logic/contact-method-normalization.ts:74-75`): a national-format imported number without an explicit country code likely stores with `canonical_value: null` ("non-canonical"), which silently degrades the canonical-method matching that both the duplicate-evidence engine (19-05) and consolidation (19-11) depend on as their primary strong signal — not merely an inconsistency with manual create, but a functional degradation of IMP-03's core mechanism.
- **Cursor, MEDIUM / Claude, MEDIUM:** 19-07 requires a `linkExternalContact`-shaped DAO write with no named DAO function; Claude additionally found the plan text names a nonexistent function (`setRowStatus`) where 19-01's actual DAO surface only exports `setRowContact`/`markRowStatus`.
- **Codex, MEDIUM / Claude, LOW (confirmed):** `imported-contact-dao.importContactRecord` is specified to hand-duplicate `createContactFull`'s composition body rather than share a common core. Claude additionally flagged that this body seeds the full custom-field-definition matrix (`listDefs` + `upsertValueCore` per definition) — a step that, if dropped during manual duplication, would violate the Phase 3 custom-fields invariant that every contact has a complete def-pair matrix, not just create drift risk.
- **Codex, MEDIUM:** Backup/restore has no stated policy for import-session tables (local-only runtime state vs. exportable); current export/restore code enumerates explicit table sets that don't mention `import_sessions`/`import_session_rows`.
- **Codex, MEDIUM:** `buildBirthdayForStorage` (as cited) only formats; the strict validity parser lives privately in `birthday-logic.ts`, so the plan's "reuse" claim needs an exported validator, not just the formatter.
- **Cursor, LOW:** Research's Pattern-2 pseudocode example nests `inWriteTransaction` around `createContactFull`, contradicting the very non-reentrancy rule stated beside it — Plan 03 itself avoids the mistake, but an executor skimming RESEARCH.md could copy the bad example.

No reviewer identified a reversal of a `[DECIDED]`/ADR/HANDOFF item. The Android-only deferral of the iOS picker (owner ruling 2026-08-28) is consistently and correctly honored across all 11 plans.

---

## Codex Review

# Phase 19 Plan Review

## Summary

The plan has a strong architecture direction: Android-only, no `READ_CONTACTS`, snapshot-before-review, conservative duplicate handling, and reuse of Phase 18’s normalized methods/link tables all align with the repository. However, it is not execution-ready yet. Several plans split a contact write from its durable import-row transition, which permits duplicate contacts after a crash/resume. The staged-photo path is also not actually durable as planned, and Retry/review completion state is internally inconsistent.

## Strengths

- The plans correctly respect the non-reentrant write contract. `createContactFull()` already owns one `inWriteTransaction` ([src/db/contacts-dao.ts:112](src/db/contacts-dao.ts:112)); nesting is documented as a permanent hang ([src/db/transaction.ts:12](src/db/transaction.ts:12)). Plans 03/10 explicitly call this out.

- The existing model supports deterministic external identity exactly as proposed: active links are unique by `(provider, external_contact_id)` ([src/db/migrations/011-contact-lifecycle-schema.ts:175](src/db/migrations/011-contact-lifecycle-schema.ts:175)), and method canonical values are durable fields ([src/db/migrations/011-contact-lifecycle-schema.ts:106](src/db/migrations/011-contact-lifecycle-schema.ts:106)).

- Unbound imports fit the current schema: `tracking_enabled=0` permits `interval_days=NULL`, while Bound contacts require cadence ([src/db/migrations/011-contact-lifecycle-schema.ts:20](src/db/migrations/011-contact-lifecycle-schema.ts:20)).

- The native-module approach is consistent with existing in-repo Expo modules. The document picker already copies provider data into app-private cache and returns a `file://` URI, not the provider URI ([modules/orbit-backup-document-picker/android/src/main/java/expo/modules/orbitbackupdocumentpicker/OrbitBackupDocumentPickerModule.kt:152](modules/orbit-backup-document-picker/android/src/main/java/expo/modules/orbitbackupdocumentpicker/OrbitBackupDocumentPickerModule.kt:152)).

- The plans preserve the locked product boundaries: no broad contact permission, no iOS implementation, no generic Orbit-to-Orbit merge, and no silent advisory linking.

## Cross-plan concerns

- **HIGH — contact creation and session-row state are not atomic.** Plans 04, 06, 07, and 11 create a contact through `importContactRecord()` and only afterward update `import_session_rows` with `setRowContact()`. A process death between those calls leaves a real contact with a pending source row; resuming can import it again. This defeats IMP-04’s resumable/partial-commit guarantee. The existing writer is transaction-contained ([src/db/contacts-dao.ts:148](src/db/contacts-dao.ts:148)), so a later DAO call cannot repair atomicity.

  - Add a single import core that, in one `inWriteTransaction`, creates the contact/methods/links/provenance and updates the session row to `imported`/`linked` with `contact_id`. Use that core for single, batch, link, and consolidation paths.

- **HIGH — staged photos are only cached, not durable.** Plan 02 copies photo bytes to `cacheDir`; Plans 01/04 then propose storing that path as the durable snapshot. Cache is explicitly evictable in the project’s photo architecture ([src/services/photos/photo-pipeline.ts:6](src/services/photos/photo-pipeline.ts:6)), while durable masters are stored under the document directory ([src/services/photos/photo-storage.ts:227](src/services/photos/photo-storage.ts:227)). A process-death resume can therefore retain a DB row whose photo no longer exists.

  - At picker acceptance, copy each photo from cache into a session-specific, app-private document-dir staging location before inserting the session row. Store only a validated relative staging path.

- **HIGH — batch status semantics conflict across plans.** Plan 06 says ambiguous rows “stay pending,” yet Plan 07 loads `needs_review` rows and Plan 08 counts `needReview`. Plan 01’s `setRowMatchOutcome()` does not state that it changes `row_status`. As written, ambiguous rows will remain pending, not appear in the review grid or summary.

  - Define a transition table and enforce it in one DAO: `pending → needs_review`, `pending → skipped`, `pending → imported`, `pending → linked`, `pending → failed`. Keep `match_outcome` separate from status.

- **HIGH — Retry cannot work with the planned driver.** Plan 08 says Retry reruns failed/pending rows, but Plan 06 specifies loading only pending rows. Failed rows will be ignored. Also, retrying after a partial crash must not recreate a contact, so it depends on the atomic session-row write above.

  - Give `runImportBatch()` an explicit eligible-status set, e.g. `["pending"]` normally and `["pending", "failed"]` for Retry, with idempotency guards.

- **HIGH — untouched single-review back-out leaves an orphaned resumable session.** Plan 04 says acceptance immediately creates a durable session, but also says untouched Back “writes/discards nothing.” That leaves a pending session, so Plan 09 will prompt on every launch. This is inconsistent with “cancel before Orbit owns selection writes nothing”: after acceptance, Orbit does own a selection, but abandoning it must still resolve the session.

  - Treat picker acceptance as ownership; on untouched Back explicitly discard the session and staged files without confirmation. Edited Back should confirm, then discard if confirmed.

- **MEDIUM — backup/restore needs an explicit import-session policy.** Current backup code enumerates portable tables explicitly and does not include import-session tables ([src/backup/export-manifest.ts:45](src/backup/export-manifest.ts:45)); replace restore likewise has explicit entity/table sets. This may be correct if sessions are intentionally local-only, but the plan does not say how Replace-all or restore handles pending sessions and staged photos.

  - Explicitly classify import sessions as local-only runtime state, exclude them from export, and clear/discard sessions plus staging after a successful restore/replace. Add tests for restoring on a v12 database.

## Plan-by-plan review

### 19-01 — Migration and session DAO

**Strengths**

- Additive migration 012 and a migration-chain test fit the existing forward-only runner ([src/db/migrations/runner.ts:47](src/db/migrations/runner.ts:47)).
- The schema correctly models external IDs as opaque text and uses foreign keys.

**Concerns**

- **HIGH:** `createImportSession()` plus repeated `insertSessionRow()` transactions cannot atomically snapshot one picker result. A crash after row 20 of 50 creates a valid-looking but incomplete session.
- **MEDIUM:** The discard requirement conflicts with the task implementation. The stated truth says only pending/needs-review rows are cleared, but `DELETE ... WHERE contact_id IS NULL` also deletes failed and skipped rows.
- **MEDIUM:** `total_rows` is mutable metadata with no consistency verification; partial acceptance can make UI progress/counts misleading.

**Suggestions**

- Replace individual acceptance writes with `acceptImportSessionWithRows()` in one transaction.
- Define and test exact discard behavior for every row status.
- Add a session completeness marker or atomically set `total_rows` with all rows.

**Risk:** HIGH.

### 19-02 — Native Android picker

**Strengths**

- Mirrors an established Expo module pattern, including a distinct activity-result request code ([modules/orbit-backup-document-picker/android/src/main/java/expo/modules/orbitbackupdocumentpicker/OrbitBackupDocumentPickerModule.kt:97](modules/orbit-backup-document-picker/android/src/main/java/expo/modules/orbitbackupdocumentpicker/OrbitBackupDocumentPickerModule.kt:97)).
- The no-permission constraint is correctly explicit.

**Concerns**

- **MEDIUM:** Plan 02 says `app.config.ts` registers the local module “the same way” as the backup module, but the existing local backup module is not registered in `app.config.ts`; it is Expo-autolinked from `modules/`. Adding arbitrary config registration is likely unnecessary and risks an incorrect integration.
- **MEDIUM:** Checking only the module manifest is insufficient. A dependency or generated manifest could still introduce `READ_CONTACTS`.
- **MEDIUM:** Birthday/photo and raw API-37 extras remain device assumptions, correctly acknowledged but not safely isolated from the rest of the implementation.

**Suggestions**

- Verify autolinking with `npx expo-modules-autolinking search --platform android`, then verify the generated merged manifest after prebuild.
- Make unsupported/empty-field behavior first-class in the native return contract and tracer record.

**Risk:** MEDIUM.

### 19-03 — Mapper and importer DAO

**Strengths**

- Correctly reuses method normalization rather than introducing a second equality model.
- Correctly recognizes that a simple call to `createContactFull()` cannot be wrapped in another write transaction.

**Concerns**

- **HIGH:** `buildBirthdayForStorage()` only formats a string; it does not validate dates ([src/screens/edit-contact-logic.ts:121](src/screens/edit-contact-logic.ts:121)). The strict parser is private to `birthday-logic.ts` ([src/logic/birthday-logic.ts:79](src/logic/birthday-logic.ts:79)). The plan cannot “reuse” it as written, so `02-30` can be stored.
- **HIGH:** The planned provenance design lacks a source-method identity. `contact_method_provenance` has both link and `source_method_id` fields ([src/db/migrations/011-contact-lifecycle-schema.ts:228](src/db/migrations/011-contact-lifecycle-schema.ts:228)), but `PickedMethod` has only type/value. Plan 11 then cannot accurately attribute merged methods to a particular source record.
- **MEDIUM:** Mirroring `createContactFull` duplicates a large private composition body: contact insert, custom-value matrix seeding, method save, and revision logic ([src/db/contacts-dao.ts:148](src/db/contacts-dao.ts:148)). That is drift-prone.

**Suggestions**

- Export a `parseStoredBirthday`/`validateBirthdayForStorage` helper and test it directly.
- Add `sourceMethodId` to acquired methods, preserving enough data for provenance.
- Extract an internal `createContactFullCore()` from the existing DAO; have both create and import writers call it under one outer transaction.

**Risk:** HIGH.

### 19-04 — Single-contact tracer

**Strengths**

- Leading with a device-verified vertical slice is the right sequencing for a new API.
- Replacing the existing direct-create FAB is narrowly scoped; the current FAB is indeed a direct `navigate("Create")` action ([src/screens/HomeScreen.tsx:652](src/screens/HomeScreen.tsx:652)).

**Concerns**

- **HIGH:** `commitSingleImport()` is described as `importContactRecord + completeSession`, but it does not set the session row’s `contact_id`/status. The session is then complete with a pending row, breaking resume and durable summary data.
- **HIGH:** See the shared orphan-session concern on untouched Back.
- **MEDIUM:** The import review screen needs a defined route target after resume for a single session whose row is already imported or linked.

**Suggestions**

- Make the atomic import operation return a coherent row state before navigating.
- Define resume routing from persisted session state, not just session `mode`.

**Risk:** HIGH.

### 19-05 — Duplicate evidence

**Strengths**

- Strong negative invariants—no name-only link, birthday supporting-only, deterministic links bypass scoring—are appropriate.
- Reading stored `canonical_value` avoids reinterpreting existing Orbit data.

**Concerns**

- **MEDIUM:** The input side still needs canonicalization before it can query `contact_methods.canonical_value`; `ContactMethodDraft` contains raw values, while canonical values are generated by `applyContactMethodDiffCore()` on writes ([src/db/contact-methods-dao.ts:99](src/db/contact-methods-dao.ts:99)).
- **MEDIUM:** “phone + email from the same source record” cannot be distinguished with the planned `PickedMethod` shape, which has no source-record/method provenance beyond a single contact.
- **LOW:** The five-outcome model conflates a candidate-level classification with a row-level action state; this contributes to the Plan 06 status mismatch.

**Suggestions**

- Normalize incoming methods through the existing normalization function before candidate lookup.
- Return candidate evidence structurally and keep row status transitions outside the scorer.

**Risk:** MEDIUM.

### 19-06 — Bulk driver

**Strengths**

- Per-row transactions and UI yielding match the app’s serialized write model.
- The UI correctly avoids a per-person exclusion list.

**Concerns**

- **HIGH:** Ambiguous rows are described as remaining pending but expected to be reviewable/countable as `needs_review`.
- **HIGH:** The contact/session-row crash window permits duplicate imports on resume.
- **MEDIUM:** The driver has no defined cancellation/abort policy once a batch starts; navigation away could leave a concurrently running loop updating an unmounted progress screen.

**Suggestions**

- Use explicit durable state transitions and an abort token/UI-safe progress subscription.
- Persist a `batch_running`/lease-like state only if needed; otherwise make resume recognize pending work safely and idempotently.

**Risk:** HIGH.

### 19-07 — Duplicate review UI

**Strengths**

- A reusable, neutral card grid is appropriate for Phase 20 reuse.
- The no-auto-link/no-name-overwrite rules are well scoped.

**Concerns**

- **HIGH:** It relies on `needs_review` rows that Plan 06 does not actually produce.
- **HIGH:** Link-to-existing is described as separate external-link and session-status writes; a crash can leave a link but no resolved row.
- **MEDIUM:** “Apply recommendation” needs a precise policy for `probable` versus `possible`; both are advisory and neither should be silently linked.

**Suggestions**

- Route every review action through the same atomic row-resolution writer.
- Make “Apply recommendation” only import `new` and skip `already_linked`; require an explicit individual confirmation for every link recommendation unless the dossier explicitly authorizes bulk linking.

**Risk:** HIGH.

### 19-08 — Completion summary

**Strengths**

- Durable count reads are better than transient progress counters.
- The Unbound route already exists ([src/navigation/types.ts:50](src/navigation/types.ts:50)).

**Concerns**

- **HIGH:** Retry is incompatible with Plan 06’s pending-only driver.
- **MEDIUM:** Marking a session `complete` while it still contains unresolved review rows removes it from Plan 09’s “pending session” resume flow.
- **MEDIUM:** The plan says photo-only failures count as imported, but requires a precise count query that does not accidentally count `photo_failed` as failed.

**Suggestions**

- Keep a session resumable until all nonterminal review rows resolve, or introduce `complete_with_review`.
- Write one tested SQL/query contract for all four summary rows.

**Risk:** HIGH.

### 19-09 — Resume/discard sweep

**Strengths**

- Correctly uses the launch-sweep mechanism rather than a timer. The app installs the trigger only after migration readiness ([App.tsx:135](App.tsx:135)), which is the right insertion point.
- Correctly avoids module-scope launch work.

**Concerns**

- **HIGH:** After `discardSession()` deletes unresolved rows, cleanup can no longer discover their `photo_rel_path` values. The plan must gather paths before delete or have discard return them.
- **HIGH:** Cleaning staged photos for all “failed” rows can erase photos needed by Retry unless “failed” means terminally discarded.
- **MEDIUM:** `getResumableSession()` selecting one most-recent pending session leaves an older pending session unspecified.

**Suggestions**

- Implement `discardSessionAndListStagedFiles()` atomically; delete files only after commit.
- Define whether failed rows remain retryable, then scope cleanup accordingly.
- Decide whether multiple pending sessions are prohibited, queued, or listed.

**Risk:** HIGH.

### 19-10 — Photos and birthdays

**Strengths**

- Post-commit photo persistence is correct. `setContactPhoto()` itself opens a separate transaction ([src/db/contacts-dao.ts:605](src/db/contacts-dao.ts:605)), so it must not be called inside the contact transaction.
- The contact-ID-derived path is safe and stable ([src/services/photos/photo-storage.ts:82](src/services/photos/photo-storage.ts:82)).

**Concerns**

- **HIGH:** It inherits the non-durable cache staging defect from Plans 02/04.
- **HIGH:** It assumes the mapper’s birthday validation, which is not available as currently described.
- **MEDIUM:** It does not say when successful/failed staged files are deleted; this leaks sensitive local photos.

**Suggestions**

- Require document-dir session staging before this plan.
- Add a public strict birthday validator.
- Delete the staging file after success, retain it only for an explicitly retryable photo failure, and sweep terminal leftovers.

**Risk:** HIGH.

### 19-11 — Source consolidation

**Strengths**

- Explicit Combine/Keep separate correctly preserves the Phase 19 boundary.
- Multiple external links per contact are supported by the schema; uniqueness is per external source, not per contact ([src/db/migrations/011-contact-lifecycle-schema.ts:117](src/db/migrations/011-contact-lifecycle-schema.ts:117)).

**Concerns**

- **HIGH:** Consolidation inherits the missing source-method identity/provenance model from Plan 03.
- **HIGH:** `combineCluster()` needs the same atomic contact-plus-session-row transition as bulk import.
- **MEDIUM:** Detecting shared canonical method values requires normalizing session payload methods first; raw-value comparison is not sufficient.

**Suggestions**

- Require provenance-capable staged payloads before consolidation.
- Reuse the atomic import-resolution core, passing multiple links and row IDs.

**Risk:** HIGH.

## Risk Assessment

**Overall: HIGH.** The product decisions and most architectural choices are sound, but the current plan set does not yet guarantee durable, idempotent resume—the central promise of IMP-04. Resolve the atomic import/session transition, durable photo staging, status state machine, and Retry/complete semantics before execution.

---

## Cursor Review

# Phase 19: System Contact Import — Cross-AI Plan Review

Review verified against the repository at `/home/bwales/projects/orbit-app`. Current schema is **v11** (`TARGET_VERSION = 11` in `src/db/database.ts:46–61`). Phase 18.2 primitives (`external_contact_links`, `contact_methods.canonical_value`, `createContactFull`, launch-sweep registry) exist and align with the plans' assumptions. No import code ships yet — this review is of plan quality and feasibility, not implementation.

---

## Phase Overview

**Summary:** The 11-plan wave structure is sound: migration + native picker + composed DAO in Wave 1, a device-verified single-contact tracer in Wave 2, bulk/duplicate/resume layers after. Plans correctly honor local-first constraints, mutex non-reentrancy, post-commit photos, and Android-only scope. Several cross-plan gaps would block IMP-02/IMP-03/IMP-04 if executed literally: bulk entry-point wiring is missing, photo staging to durable document storage is underspecified, `row_status='skipped'` overload breaks completion counts, source consolidation is sequenced too late, and duplicate-review row filtering is ambiguous.

**Phase strengths**
- Tracer-first sequencing (19-04 before bulk/photo/duplicate expansion) matches owner intent and de-risks the 2026 API.
- Plan 03's explicit `createContactFull` non-nesting rule matches `src/db/transaction.ts:11–23` and `src/db/contacts-dao.ts:5–15`.
- Checkpoint gate on irreversible migration 012 (19-01) is appropriate for owner-bucket risk.
- Wave 4 collision avoidance (19-10 enriches `commitSingleImport` body only; 19-07 owns `ImportReviewScreen.tsx`) is well coordinated.
- Reuse map is accurate: `buildBirthdayForStorage` (`src/screens/edit-contact-logic.ts:121–129`), `setContactPhoto` (`src/db/contacts-dao.ts:605–628`), `registerSweepHook` (`src/services/launch-sweep.ts:45–47`), partial-unique external link index (`src/db/migrations/011-contact-lifecycle-schema.ts:180`).

**Phase-level concerns**
- **HIGH — Bulk import entry path not tasked:** Research architecture routes N>1 to bulk setup, but 19-04 Task 2 hardcodes `pickContacts({multiple:false})` (`gsd-review-plan-03.md` action), and 19-06 builds `BulkImportSetupScreen` without wiring FAB/Settings to multi-pick or `acceptPickedContacts` in bulk mode. IMP-02 requires bulk from Add flow; no plan owns the glue.
- **HIGH — `skipped` row_status semantic collision:** 19-06 marks deterministic `already_linked` as `skipped`; 19-07 marks user Skip as `skipped`. 19-01 `sessionRowCounts` groups only by `row_status`; 19-08 expects separate "Already in Orbit" vs "Failed / skipped" rows from that API — counts will be wrong without `match_outcome` filtering.
- **HIGH — Source consolidation (19-11) runs too late:** Cluster K is pre-import ("multiple **selected** source records → one contact"). Wiring `detectSourceClusters` into `DuplicateReviewScreen` (after `runImportBatch`) lets two same-phone sources both score `new` and import as separate contacts before consolidation is offered.
- **HIGH — Durable photo staging gap:** Research Pattern 1 and runtime inventory require session-scoped **document-dir** staging (`restore-pending/` idiom in `src/services/photos/photo-storage.ts:120–151`). 19-02 copies to **cache**; 19-04 stores `photoTempUri` in the session row but no task copies cache → durable `photo_rel_path` before grant expiry/process death.
- **MEDIUM — Ambiguous bulk rows: `pending` vs `needs_review`:** 19-06 says ambiguous rows "stay pending"; 19-07 loads "needs_review/probable/possible rows." Without setting `row_status='needs_review'` or a documented filter on `match_outcome`, the duplicate grid may be empty while rows sit in `pending`.
- **MEDIUM — Phone region for normalization:** Create flow resolves region via `resolveEffectivePhoneRegion` + settings (`src/screens/CreateContactScreen.tsx:124–128`). Plans 03/04 never pass `methodNormalization` into `importContactRecord`; extensionless imports may normalize incorrectly vs manual create.
- **MEDIUM — Link-to-existing write surface unspecified:** 19-07 requires INSERT into `external_contact_links` without naming a DAO (only `importContactRecord` / `findActiveExternalLink` in 19-03). Risk of ad-hoc SQL in the screen layer, violating the service/DAO convention.
- **MEDIUM — `contact_method_provenance.source_method_id`:** Picker snapshot has no stable Android Data `_ID`; plan 03 says "thread provenance" but not what populates `source_method_id` (nullable per `011-contact-lifecycle-schema.ts:232`).
- **LOW — Plan 02 `app.config.ts` registration:** `orbit-backup-document-picker` autolinks via `modules/*/expo-module.config.json` with no `app.config.ts` entry; 19-02 Task 2 may be redundant except optional `expo-build-properties` SDK pin (research confirms no compileSdk pin today).
- **LOW — Research Pattern 2 pseudocode nests `inWriteTransaction` around `createContactFull` — contradicts the non-reentrancy note immediately below it. Plan 03 correctly avoids this; executor should treat research example as anti-pattern.

**Phase risk:** **HIGH** — architecture is right, but four HIGH gaps (bulk wiring, count semantics, consolidation timing, photo durability) would produce incorrect behavior or incomplete IMP coverage if not fixed before execution.

---

## Plan 19-01 — Migration 012 + Session DAO

**Summary:** Solid durability foundation with appropriate owner checkpoint, additive DDL, and read/write separation. Schema aligns with Phase 18 linkage model.

**Strengths**
- Irreversible migration gate matches `CLAUDE.md` forward-only rule; no `ALTER TABLE contacts` / categories seed prohibition is correct (`NULL` category = Uncategorized, matching `CreateContactScreen.tsx:310`).
- `discardSession` rule (preserve rows with `contact_id`) matches IMP-04 partial-commit semantics.
- `foreign_key_check` + UNIQUE `(session_id, external_contact_id)` tests are the right irreversibility guards.

**Concerns**
- **MEDIUM:** `sessionRowCounts` grouped only by `row_status` is insufficient for 19-08's four-bucket summary once `skipped` carries multiple meanings (see phase-level).
- **LOW:** `batch_tracking_enabled` on `import_sessions` duplicates contact-level `tracking_enabled`; may be dead column unless bulk setup writes it.

**Suggestions**
- Extend `sessionRowCounts` (or add `sessionRowCountsForSummary`) that splits `skipped` by `match_outcome='already_linked'` vs user skip vs other.
- Document whether ambiguous rows should use `row_status='needs_review'` at scoring time (feeds 19-06/07).

**Risk:** **LOW** (schema/DAO plan is strong; count API needs extension)

---

## Plan 19-02 — Native Android 17 Contact Picker

**Summary:** Well-scoped acquisition module mirroring the proven backup picker pattern; string-literal intents avoid compileSdk 37 dependency.

**Strengths**
- `copyToCache` idiom verified in `OrbitBackupDocumentPickerModule.kt:152–164`; same grant-expiry problem, same solution shape.
- No `READ_CONTACTS` prohibition is load-bearing and testable via grep.
- Web no-op + `isContactPickerAvailable()` gate matches IMP-01 unsupported path.

**Concerns**
- **MEDIUM:** Cache temp files (`context.cacheDir`) are not the durable document-dir staging research requires (`19-RESEARCH.md` Runtime State Inventory). Downstream 19-04 must copy out — not tasked.
- **LOW:** `app.config.ts` registration may be unnecessary; autolinking via `expo-module.config.json` suffices for `orbit-backup-document-picker`.

**Suggestions**
- Add explicit acceptance criterion in 19-04 (or 19-02 Task 2): copy photo bytes to `import-staging/` under document dir using `stageRestorePending`-style atomic rename before `insertSessionRow`.
- Record A1/A2 device outcomes in 19-04 SUMMARY as plan requires.

**Risk:** **MEDIUM** (native module is the highest unknown; plan mitigates with tracer + string literals)

---

## Plan 19-03 — Mapper + Composed Importer DAO

**Summary:** Correct central primitive; mutex-aware composition matches existing DAO contracts.

**Strengths**
- Explicit rejection of nested `createContactFull` matches `transaction.ts:15–17`.
- `externalLinks[]` array anticipates 19-11 multi-link consolidation.
- Birthday via `buildBirthdayForStorage` + strict parser aligns with `birthday-logic.ts` and project date rules.
- Field allowlist matches dossier Cluster C.

**Concerns**
- **HIGH:** Composition complexity — must duplicate `createContactFull` body (`contacts-dao.ts:148–230`) plus link/provenance INSERTs; one missed core (e.g. custom-field pair seeding at lines 184–194) corrupts new imports.
- **MEDIUM:** No `methodNormalization` / `resolveEffectivePhoneRegion` — create path always passes region in `CreateContactScreen.tsx:124–128`.
- **MEDIUM:** `source_method_id` provenance mapping undefined for picker methods.

**Suggestions**
- Extract a shared `createContactFullCore(exec, input)` used by both `createContactFull` and `importContactRecord` to avoid drift (planner call, not scope creep if minimal).
- Specify `source_method_id` = null or opaque index; document in plan if Android ID unavailable.
- Add test: import with national-format phone + GB override settings → expected `canonical_value`.

**Risk:** **MEDIUM-HIGH** (correct design, high implementation fidelity requirement)

---

## Plan 19-04 — TRACER: Single-Contact E2E

**Summary:** Excellent vertical-slice strategy; reuses real UI idioms and fixes the create seam (`commitSingleImport`) for downstream enrichment.

**Strengths**
- `commitSingleImport` as single write seam (`import-acquire.ts`) lets 19-10 add post-commit photo without touching 19-07 interrupt paths — verified coordination in 19-07 Task 3.
- Reanimated-only FAB rule matches `CLAUDE.md`; current direct FAB at `HomeScreen.tsx:652–663` is a clear replacement target.
- Create field stack order matches `CreateContactScreen.tsx:243–349` (minus Last spoke — correct for never-contacted imports).
- Node test of acquire + commit spine before device UAT is the right harness.

**Concerns**
- **HIGH:** Key link claims FAB routes single vs bulk by result length, but Task 2 only implements `multiple:false` — internal contradiction; bulk unreachable until another plan wires it.
- **HIGH:** No task copies picker photo from cache to durable staging before session insert (Pattern 1 gap).
- **MEDIUM:** `ImportReviewScreen` omits phone-region loading pattern from create screen.
- **LOW:** Leave-guard discard semantics vs `discardSession` on untouched back-out need explicit spec (discard session row vs navigate away).

**Suggestions**
- Add Task 2b (or extend 19-06): after pick, if `picked.length === 1` → `ImportReview`; if `> 1` → `BulkImportSetup`; if `0` → no-op.
- Task acceptPickedContacts: stage photos to document dir; store relative path in `photo_rel_path`, not cache URI.

**Risk:** **MEDIUM** (tracer path is good; missing bulk branch and photo staging weaken IMP-04)

---

## Plan 19-05 — Duplicate Evidence Engine

**Summary:** Strong pure classifier with conservative invariants; correct deterministic-first design over existing schema.

**Strengths**
- Deterministic bypass via `idx_external_contact_links_active` (`011-contact-lifecycle-schema.ts:180`) before fuzzy scoring — matches IMP-03 Cluster G.
- Negative invariant tests (name-only ceiling, correlated-evidence dampening, birthday supporting-only) are the right safety net.
- Uses `contact_methods.canonical_value` as match key — consistent with Phase 18.1.

**Concerns**
- **MEDIUM:** Name token overlap gathering may be expensive on large contact DBs; no index on name — acceptable for personal CRM scale but worth chunking/yield if scan is O(contacts).
- **LOW:** Weights marked `[OPEN]` in dossier — tunable constants at file top is fine; device UAT may need iteration.

**Suggestions**
- Export strong-evidence helpers for reuse by 19-11 `detectSourceClusters` (avoid duplicating canonical-match logic).
- Document outcome → recommended action mapping in one enum consumed by 19-07 UI.

**Risk:** **LOW-MEDIUM**

---

## Plan 19-06 — Bulk Import Driver + Setup + Progress

**Summary:** Chunked per-row driver and partial-failure model are correct; UI contracts match IMP-02 Cluster E/S.

**Strengths**
- Per-row transaction + try/catch continue matches Cluster P; never one batch transaction.
- Defer ambiguous, import `new`, skip deterministic `already_linked` — safe imports not blocked (Cluster L/N).
- Determinate progress copy avoids bare spinner (Cluster S).
- `CHUNK_SIZE` + yield between chunks addresses JS-thread responsiveness.

**Concerns**
- **HIGH:** No entry-point wiring from FAB/Settings (see 19-04).
- **HIGH:** `already_linked` → `row_status='skipped'` collides with user Skip (19-07) for summary counts.
- **MEDIUM:** Ambiguous rows "stay pending" vs 19-07 expecting review rows — set `row_status='needs_review'` explicitly in driver.
- **LOW:** Temporary landing on dashboard until 19-08 is documented — acceptable.

**Suggestions**
- Driver: on ambiguous → `setRowMatchOutcome` + `markRowStatus(row, 'needs_review')`.
- Driver: on deterministic already_linked → `markRowStatus(row, 'skipped')` + `match_outcome='already_linked'` (already implied) so summary can filter.
- Add task: wire `AddSpeedDialFab` / Settings to `pickContacts({multiple:true})` → `acceptPickedContacts(mode:'bulk')` → `BulkImportSetup`.

**Risk:** **HIGH** (driver logic good; wiring and status semantics gaps)

---

## Plan 19-07 — Duplicate Review UI + Single Interrupt

**Summary:** Reusable grid for Phase 20 is the right abstraction; colourless chip rule matches owner UI-SPEC.

**Strengths**
- `CandidateCardGrid` generic contract + `ContactCard.tsx` ellipsis precedent (`numberOfLines` pattern at lines 51–72 area).
- No name overwrite on Link (Cluster M) — critical for IMP-03.
- Single interrupt calls `commitSingleImport` for Import-as-New so 19-10 photo path applies — good cross-plan coupling.
- Bulk Apply excludes `needs_review` — conservative.

**Concerns**
- **MEDIUM:** No DAO for Link-to-existing (`external_contact_links` INSERT + provenance optional); risk of screen-inline SQL violating conventions.
- **MEDIUM:** Row query criteria undefined given 19-06 pending/needs_review ambiguity.
- **LOW:** Same-wave edit of `ImportReviewScreen.tsx` alongside 19-10's explicit non-touch rule — 19-07 owns it; OK if wave executes sequentially.

**Suggestions**
- Add `linkExternalContact(exec, { contactId, provider, externalContactId, now })` to `imported-contact-dao.ts` in 19-03 or 19-07.
- Query: `WHERE row_status IN ('needs_review') OR (row_status='pending' AND match_outcome IN ('probable','possible','needs_review'))` until driver always sets status.

**Risk:** **MEDIUM**

---

## Plan 19-08 — Import Completion Summary

**Summary:** Correct bridge to existing `UnboundContacts` route (`RootNavigator.tsx:73`, `HomeScreen.tsx:392`); durable counts intent is right.

**Strengths**
- `navigation.replace` from progress prevents back-stack confusion.
- Photo-failed rows under Imported (Cluster F) matches post-commit photo model.
- Retry re-runs failed/pending without touching committed rows — aligns with per-row driver.

**Concerns**
- **HIGH:** Depends on `sessionRowCounts` that cannot split `skipped` semantics (see 19-01/06).
- **MEDIUM:** `completeSession` on summary mount while `needs_review > 0` prevents resume prompt (19-09) — probably intentional (summary offers Review), but mid-review kill after complete loses resume path.

**Suggestions**
- Use extended counts API: `{ imported, alreadyInOrbit, needReview, failed, userSkipped }`.
- Clarify whether `completeSession` runs before or after optional DuplicateReview navigation.

**Risk:** **MEDIUM**

---

## Plan 19-09 — Resume Sweep + Discard

**Summary:** Correct launch-sweep integration pattern; matches `App.tsx:135–183` ready-gated registration idiom.

**Strengths**
- `registerSweepHook` only — no timers (`launch-sweep.ts:45–47`, `CLAUDE.md`).
- `discardSession` preserving committed rows reuses 19-01 DAO contract.
- Corrupt session → discard-only backstop prevents grant-expiry crash loop.
- `deleteRestorePending` idiom exists for staged photo cleanup (`photo-storage.ts:181–188`).

**Concerns**
- **MEDIUM:** Resume routing (single → `ImportReview`, bulk → `BulkImportSetup` vs `DuplicateReview` vs in-progress batch) needs explicit state machine; plan lists options without decision tree.
- **LOW:** Non-dismissable modal spec is good; must not block headless path (sweep only on foreground — satisfied).

**Suggestions**
- Resume logic keyed on `import_sessions.mode` + `sessionRowCounts`: pending review vs mid-batch (some imported, some pending).
- Register sweep in `App.tsx` with same one-shot guard pattern as `fieldSweepRegistered` (lines 81–103).

**Risk:** **MEDIUM**

---

## Plan 19-10 — Photo Post-Commit + Birthday

**Summary:** Correct Cluster F sequencing after tracer; enriches `commitSingleImport` without signature churn.

**Strengths**
- Post-commit photo via `persistCroppedMaster` / `contactPhotoRelPath` (`photo-storage.ts:83–86`) + `setContactPhoto` (`contacts-dao.ts:605–628`) — photo failure isolated in separate mutex transaction.
- Explicit non-edit of `ImportReviewScreen.tsx` avoids wave-4 merge race with 19-07.
- Birthday in `importContactRecord` transaction, not mapper-only — correct write boundary.
- `grep -rn toISOString src/services/import/` acceptance criterion enforces date rules.

**Concerns**
- **MEDIUM:** `setContactPhoto` opens its own `inWriteTransaction` after contact commit — fine, but rapid bulk photo pass holds mutex serially; acceptable at ≤100 rows.
- **LOW:** Depends on durable `photo_rel_path` populated upstream — blocked by staging gap.

**Suggestions**
- Add node test: contact committed + bad staged bytes → row `photo_failed=1`, contact row still present.
- Document A1/A2 null birthday/photo as skipped no-op in SUMMARY.

**Risk:** **LOW-MEDIUM** (plan is sound once staging exists)

---

## Plan 19-11 — Multi-Source Consolidation (Cluster K)

**Summary:** Right product intent (never silent, strong-evidence only, multi-link via `externalLinks[]`), but **wrong insertion point** in the flow.

**Strengths**
- Assumption-delta documents multi-link as provenance breadth, not identity model change — consistent with `idx_external_contact_links_active` uniqueness on `(provider, external_contact_id)` not `(contact_id)`.
- Reuses plan-05 strong signals; name-only exclusion tested.
- `combineCluster` → one `importContactRecord` with N links matches 19-03 array parameter.

**Concerns**
- **HIGH:** Wired into `DuplicateReviewScreen` after bulk import — too late; duplicate "new" contacts already created (see phase-level).
- **MEDIUM:** Overlap with 19-07 duplicate review UX — user may see consolidation prompt and Orbit-match cards in confusing order.
- **LOW:** "High-confidence only" assumption leaves edge clusters separate — acceptable conservative-first.

**Suggestions**
- Move consolidation offer to **BulkImportSetupScreen** (before `runImportBatch`) or first step of `runImportBatch` on pending rows only.
- After combine, remove/consume clustered rows from batch driver input so they aren't imported twice.
- Keep 19-11 detector shared; change wiring target only.

**Risk:** **HIGH** (logic misplaced; would ship silent duplicate contacts for same-person multi-pick)

---

## Requirement Traceability

| Requirement | Plans | Verdict |
|-------------|-------|---------|
| IMP-01 Picker + SDK gate + unsupported state | 19-02, 19-04 | Achievable; device UAT required |
| IMP-02 Single review + bulk defaults + incremental batch | 19-03, 19-04, 19-06, 19-10 | **Gap:** bulk entry wiring missing |
| IMP-03 Deterministic + advisory duplicate handling | 19-05, 19-06, 19-07, 19-11 | **Gap:** consolidation timing; skipped status collision |
| IMP-04 Durable/resumable sessions | 19-01, 19-04, 19-09 | **Gap:** photo staging to document dir |

---

## Recommended Pre-Execution Fixes (Planner Bucket)

1. Add explicit bulk routing task (FAB + Settings): multi-pick → `acceptPickedContacts(bulk)` → `BulkImportSetup`.
2. Add photo staging task in `acceptPickedContacts`: cache URI → document-dir relative path before session row insert.
3. Fix row lifecycle: ambiguous → `needs_review`; summary counts filter `skipped` by `match_outcome`.
4. Move Cluster K consolidation to pre-batch (BulkImportSetup or driver preamble), not DuplicateReview.
5. Add `linkExternalContact` DAO + pass `methodNormalization` through import acquire/commit paths.
6. Consider shared `createContactFullCore` to reduce 19-03 composition drift risk.

No `[DECIDED]` / ADR / HANDOFF reversals detected. Android-only deferral of iOS picker is consistently honored across plans.

---

## Claude (Sonnet 5) Review

Reviewed against the repository at `/home/bwales/projects/orbit-app` on the `main` branch. Current schema is v11 (`src/db/database.ts:46` `TARGET_VERSION = 11`; MIGRATIONS array runs through `migration011` at line 61). No Phase 19 code exists yet — this is a plan-quality review grounded in the actual Phase 18 primitives the plans claim to reuse, not a diff review.

### Summary

The 11-plan structure is architecturally sound — additive migration first, tracer-first sequencing, deterministic-bypass-before-advisory-scoring, per-row transactions for bulk, post-commit photo — and it correctly respects the non-reentrant mutex (`src/db/transaction.ts:11-23`), the local-first/no-`READ_CONTACTS` boundary, and the Android-only scope decision. It also correctly avoids reversing any `[DECIDED]`/ADR/HANDOFF item I could find. However, independent verification against the actual DAO surfaces the plans cite turns up a set of concrete, reproducible defects in the row-status/count state machine and the atomic-write boundary that would make IMP-04's "durable, honest report" promise false as specified — not merely risky. These agree with, and in one case sharpen, findings from the Codex and Cursor lanes.

### Verified Strengths

- `createContactFull` truly opens exactly one `inWriteTransaction` around its entire body (`src/db/contacts-dao.ts:112-231`), and `transaction.ts:11-23` documents the non-reentrancy hazard in the exact terms plans 03/04 describe. Plan 03's refusal to nest is correctly grounded.
- `external_contact_links` has a **partial unique index** `idx_external_contact_links_active ON external_contact_links (provider, external_contact_id) WHERE is_active = 1` (`src/db/migrations/011-contact-lifecycle-schema.ts:180`), which is exactly what makes plan 11's "one contact, multiple links" model schema-legal without a new uniqueness rule.
- `restorePendingRelPath` (`src/services/photos/photo-storage.ts:121-131`) is a real, already-shipped document-dir staging idiom (session-token-scoped relative path, distinct from a canonical DB path) — confirming there IS a correct pattern to reuse for durable photo staging; the plans simply don't route to it (see Concerns).
- The dashboard FAB really is a direct `navigate("Create")` Pressable (`src/screens/HomeScreen.tsx:652-663`) with no speed-dial today, so plan 04's replacement target is accurately scoped.
- `registerSweepHook` / launch-sweep (`src/services/launch-sweep.ts:38-46`) is a plain-array push with an explicit "no module-scope side effect" contract; plan 09's use of it (register inside a migration-resolved effect, no timer) matches the documented contract.

### Concerns

- **HIGH — the "Already in Orbit" count can never be populated as specified; this is a data-write bug, not just a query gap.** `19-UI-SPEC.md:193/215` requires the completion summary to show `Already in Orbit (n)` as a row **distinct** from `Failed / skipped (n)`. Tracing the actual write path: 19-06's driver, on a deterministic `already_linked` outcome, calls only `markRowStatus(row, 'skipped')` (19-06-PLAN.md action, Task 1) — it does **not** call `setRowMatchOutcome`. `setRowMatchOutcome` is only invoked for the ambiguous branch (`probable`/`possible`/`needs_review`). Meanwhile 19-07's user-initiated Skip also calls `markRowStatus(row, 'skipped')`. Both paths land on identical state: `row_status='skipped'`, `match_outcome=NULL`. `sessionRowCounts` (19-01-PLAN.md Task 3) groups only by `row_status` into six buckets (`pending, imported, linked, needs_review, failed, skipped`) — there is no bucket, and no populated column, that can separate "deterministic already-linked" from "user chose Skip." Codex's suggested fix ("filter `skipped` by `match_outcome`") does not work here, because no plan ever writes `match_outcome='already_linked'` for this row. The fix must change the driver (19-06) to call `setRowMatchOutcome(row, 'already_linked', matchedContactId)` in addition to `markRowStatus`, not just the summary query (19-08).
- **HIGH — `commitSingleImport` leaves a durable session in an inconsistent completed state, confirmed at the text level.** 19-04-PLAN.md defines `commitSingleImport` as "`importContactRecord + completeSession`" and nowhere calls `setRowContact` on the session row. 19-01's own DAO (`createImportSession`/`insertSessionRow`/`setRowContact`/`completeSession` — 19-01-PLAN.md Task 2) makes row-resolution (`setRowContact`) and session-completion (`completeSession`) two independently-callable ops; `commitSingleImport` as specified calls only the latter. Concretely: after a single import, the session is `status='complete'` while its one row is still `row_status='pending'`, `contact_id=NULL`. This breaks two things independently verified: (1) `getResumableSession` (19-01 Task 3) selects on `status='pending'`, so this specific inconsistency won't trigger a bad resume prompt (the session itself IS complete) — but (2) 19-08's "Already in Orbit"/count logic and any future consumer of `import_session_rows` (including Phase 20) would see a "complete" session whose row never resolved, which is a durable data-integrity gap in the audit trail the session tables exist to provide. This is the same root defect Codex raised for the bulk paths (04/06/07/11); I confirm it also independently applies to the tracer plan 04 in isolation from bulk, by tracing 19-04's text against 19-01's DAO surface directly.
- **HIGH — Plan 19-04 contradicts itself on bulk routing, and no other plan supplies the missing glue.** The plan's own `key_links` states "the FAB routes single vs bulk by `pickContacts({multiple})` result length; the tracer path is the N==1 branch" — but Task 2's action text hardcodes `pickContacts({multiple:false})` with no branching logic at all. I checked every other plan's `files_modified` list for the missing branch: 19-06 (bulk) never touches `AddSpeedDialFab.tsx` or `HomeScreen.tsx`, and no plan after 19-04 returns to those files. IMP-02's "bulk selection" requirement therefore has no wired entry point from the Add flow as currently planned — the same gap Cursor flagged; I confirm it by exhaustively checking `files_modified` across all 11 plans rather than inferring it.
- **HIGH — the Cluster K consolidation mechanism (19-11) is structurally dead code for its own target scenario, by a mechanism more specific than "sequenced too late."** Both external reviews call this a timing/ordering problem; tracing the actual data flow shows it is worse — a *structural* impossibility as written, not merely late. 19-06's driver processes session rows one at a time in the same batch loop; for a `new` outcome it immediately calls `importContactRecord` (commits a contact) before moving to the next row. `scoreImportCandidate` (19-05) queries live DB state, so a second same-person row processed later in the same batch WILL see the first row's just-committed contact as a candidate (via canonical phone/email match) and score as `probable`/`needs_review` rather than `new`. That means by the time `DuplicateReviewScreen` loads for consolidation (19-11 Task 2: "run `detectSourceClusters` on load" against `listSessionRows`), the first of any two same-person rows is **already gone from the queryable row set** (`row_status='imported'`, filtered out per 19-07's "needs_review/probable/possible rows" load). `detectSourceClusters` clusters among *currently-loaded session rows* — it can only see the second row, alone, with no sibling to cluster against. The two-selected-sources "Combine into one" flow that Cluster K exists to serve therefore never fires for the exact case it was built for; the second row surfaces merely as an ordinary "Link to Existing" candidate against the first row's contact — functionally recoverable, but via generic linking, not the multi-link `combineCluster` path 19-11 implements and tests. Fix: either detect clusters over the RAW picker snapshot before any row is individually imported (move detection into `acceptPickedContacts`/`BulkImportSetupScreen`, as Cursor suggests), or make the driver check "does this new row cluster with an already-imported row from the SAME batch" and route to `combineCluster` instead of a fresh `importContactRecord`.
- **MEDIUM — phone region context is silently dropped for every imported number, verified against the normalization code path.** `CreateContactScreen.tsx:40,125` explicitly resolves and threads `resolveEffectivePhoneRegion(...)` into method normalization. `createContactFull` accepts this via `input.methodNormalization?.effectivePhoneRegion` (`src/db/contacts-dao.ts:184-190`, `ContactMethodNormalizationContext` in `src/db/contact-methods-dao.ts:42-44`, doc'd "omitted values fail closed"). Neither `mapPickedContact` (19-03) nor `importContactRecord` (19-03) nor `commitSingleImport`/`acceptPickedContacts` (19-04) populate `methodNormalization` anywhere in their specified signatures. Tracing `normalizeContactMethod` (`src/logic/contact-method-normalization.ts:74-75`): `canonicalRegion` falls back to `input.defaultPhoneRegion ?? null` only when the number isn't already E.164/has no explicit country code — a plain national-format number from the Android picker (very common; most contacts don't store "+1") will fail to resolve a region and likely stores with `canonical_value: null` (non-canonical, per the doc comment at `contact-method-normalization.ts:19`, "null means raw/non-canonical"). A null canonical value breaks exactly the deterministic/canonical-method matching that 19-05's duplicate-evidence engine and 19-11's consolidation clustering both depend on as their primary strong signal — this isn't just an inconsistency with manual create, it silently degrades IMP-03's core mechanism for a large fraction of imported numbers.
- **MEDIUM — cross-plan function-name mismatch on the "Link to Existing" write.** 19-07-PLAN.md Task 2 (DuplicateReviewScreen) says Link-to-Existing should "write an external_contact_links row ... + `setRowStatus 'linked'`". No such function is defined anywhere: 19-01's DAO surface exports `setRowContact(rowId, contactId, status, now)` (status one of `'imported'|'linked'`) and `markRowStatus(rowId, status, failureReason, now)` — there is no `setRowStatus`. The correct call is almost certainly `setRowContact(row, matchedContactId, 'linked', now)`, since a linked row must carry the existing contact's id, but as written an executor has to reverse-engineer this from the 19-01 DAO rather than the plan naming it. Small, but it is exactly the kind of drift the "review the code, not the diff" discipline exists to catch before execution burns a wave on it.
- **LOW (confirms Codex) — `imported-contact-dao.importContactRecord` is specified to duplicate, not reuse, `createContactFull`'s transaction body** (19-03-PLAN.md Task 2: "mirror createContactFull's transaction body by composing its underlying cores plus the INSERTs"). I confirm this against `contacts-dao.ts:112-231`: the body seeds the full custom-value-def matrix (`listDefs` + `upsertValueCore` per definition, lines ~184-201) before applying submitted values — a step easy to omit when hand-copied, and Phase 3's custom-fields invariant (`CLAUDE.md` custom-fields section) requires every contact to have the full def-pair matrix seeded. A drift here would violate that invariant for every imported contact, not just create a maintenance nuisance. Recommend extracting a `createContactFullCore(exec, input)` (non-mutexed, assumes open transaction) that both `createContactFull` and `importContactRecord` call inside their own single `inWriteTransaction` — this is a within-planner-bucket refactor, not scope creep, since it's a pure extraction of already-existing logic.

### Suggestions

- Add an explicit state-transition table as a single source of truth (referenced by 19-01, 19-06, 19-07, 19-08) mapping every `(driver event) → (row_status, match_outcome)` pair, especially covering the three "skip" cases (deterministic already-linked, user Skip, consolidation Keep-separate) so `sessionRowCounts`/the four-row summary can be computed by one query instead of ad hoc filtering invented per plan.
- Fold the atomic contact+session-row transition into one DAO function (e.g. `resolveImportRow(exec, { rowId, outcome, contactId, sessionCompleteIfLast })`) used by every write path (single, bulk-new, link-to-existing, consolidation-combine) so the "contact created but row still pending" class of bug in plan 04 cannot recur per-caller.
- Move `detectSourceClusters` ahead of individual per-row commit (into `BulkImportSetupScreen` or a driver pre-pass over the still-untouched picker snapshot) rather than after `runImportBatch`, per the structural argument above.
- Thread `resolveEffectivePhoneRegion()`'s result through `mapPickedContact`/`importContactRecord` as `methodNormalization`, matching `CreateContactScreen`'s existing call.

### Risk Assessment

**HIGH.** The product decisions (Android-only, deterministic-bypass, no silent linking, no per-person bulk checkbox, conservative consolidation) are all honored in spirit and none reverse a locked decision. But the concrete state machine wiring — row status semantics, the single-import atomic commit, and the consolidation detection order — has verifiable defects that would ship an inaccurate completion summary and a Cluster-K feature that cannot fire on its target case. These should be resolved in the plan text (not discovered mid-execution) before Wave 1 starts, since 19-01's session-row schema and DAO surface is exactly where the state-transition table needs to live and it is the first (irreversible-migration) plan in the sequence.

### Verification coverage (advisory — not counted toward HIGH/actionable totals)

| Symbol / claim | Status | Evidence |
|---|---|---|
| `createContactFull` single `inWriteTransaction` | VERIFIED | `src/db/contacts-dao.ts:112-231` |
| `transaction.ts` non-reentrancy contract | VERIFIED | `src/db/transaction.ts:11-23` |
| `idx_external_contact_links_active` partial unique index | VERIFIED | `src/db/migrations/011-contact-lifecycle-schema.ts:180` |
| `restorePendingRelPath` document-dir staging idiom | VERIFIED | `src/services/photos/photo-storage.ts:121-131` |
| Dashboard FAB direct `navigate("Create")` | VERIFIED | `src/screens/HomeScreen.tsx:652-663` |
| `registerSweepHook` / launch-sweep no-module-scope-effect contract | VERIFIED | `src/services/launch-sweep.ts:23-46` |
| `resolveEffectivePhoneRegion` threaded in CreateContactScreen | VERIFIED | `src/screens/CreateContactScreen.tsx:40,125` |
| `ContactMethodNormalizationContext.effectivePhoneRegion` "fail closed" | VERIFIED | `src/db/contact-methods-dao.ts:42-44` |
| `normalizeContactMethod` region fallback behavior | VERIFIED | `src/logic/contact-method-normalization.ts:19,74-75` |
| `TARGET_VERSION = 11`, migrations 001-011 registered | VERIFIED | `src/db/database.ts:46,49-61` |
| `setRowStatus` (cited by 19-07) exists in 19-01's DAO | MISSING | No such export specified in 19-01-PLAN.md's DAO surface (`setRowContact`/`markRowStatus` only) |
| `modules/orbit-backup-document-picker` Kotlin `copyToCache` pattern (cited by 19-02/codex/cursor) | UNCHECKABLE this session | Plan cites specific line ranges in a file I did not re-open; both external lanes independently cite matching line numbers, giving reasonable confidence, but I did not verify it myself |
| `ArchivedContactsScreen.tsx` `footerEntry` idiom (cited by 19-08) | UNCHECKABLE this session | Not opened; plan-only claim |

Note: Phase-status drift verdict for phase 19 is `lag` per orchestrator instruction — this is expected (no Phase 19 code exists yet, consistent with "Plans Complete: 0" in ROADMAP.md) and is not itself a finding.
