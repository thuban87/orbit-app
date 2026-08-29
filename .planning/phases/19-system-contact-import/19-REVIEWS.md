---
phase: 19
reviewers: [codex, cursor, claude]
reviewed_at: "2026-08-29T07:48:16Z"
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

---

# Cross-AI Plan Review — Phase 19: System Contact Import — CYCLE 2

Revision under review: commit `97f5bce` ("replan phase from cross-AI review — atomic writes, durable staging, count semantics, pre-batch consolidation"), reviewed against the six Cycle-1 HIGH themes plus a fresh look for new defects. All three lanes (Codex, Cursor, Claude/Sonnet-5) were independently source-grounded against the repository at v11 (`TARGET_VERSION = 11` in `src/db/database.ts:46`, migrations `001`–`011` shipped on disk, so migration `012` in plan 01 is correctly the next number and is additive-only).

## Cycle 2 Consensus Summary

All three reviewers agree the six Cycle-1 HIGH themes are **substantially fixed in plan text**: the canonical `(event → row_status, match_outcome)` transition table (19-01-PLAN.md:64-80) is now the documented single source of truth; contact-creation paths (single import, bulk "new", link-to-existing) genuinely compose `createContactFullCore`/DAO cores inside one `inWriteTransaction` (verified against `src/db/transaction.ts` and `src/db/contacts-dao.ts`); photo staging is correctly moved to document-dir before acceptance; Retry's `eligibleStatuses` mechanism concretely reaches failed rows with an idempotency guard; the FAB→BulkImportSetup entry is wired and device-verified in plan 06; and Cluster-K consolidation was moved to fire pre-batch in `BulkImportSetupScreen` (plan 11), before `runImportBatch` can consume/re-score the sibling rows.

However, the revision's own new machinery introduced **four new/still-open HIGH-severity gaps**, all confirmed against actual plan task text and real source files, not just plan claims:

1. **Bulk driver dual-field row transitions are not atomic** — the classification paths for `already_linked` and ambiguous/`needs_review` rows (19-06-PLAN.md:95,102-104) call two separately-mutexed writers (`markRowStatus` + `setRowMatchOutcome`) sequentially instead of composing plan 01's non-mutexed `*Core` writers in one transaction, reopening exactly the crash-window count-miscount cycle 1's HIGH-3 was meant to close — just narrowed to two of three classification branches instead of all writes.
2. **Multi-candidate review is unrenderable after persistence** — plan 05 scores and returns an ordered `candidates[]` for ambiguous rows, but migration 012's schema (19-01-PLAN.md:61) stores only a single `matched_contact_id` column, and plan 06's driver collapses to one ID before writing (19-06-PLAN.md:104). A resumed or bulk-reviewed `needs_review` row with 2+ credible candidates cannot show the user more than one.
3. **Several successful contact-creation paths bypass post-commit photo (and, for consolidation, birthday) persistence** — plan 10's hook is wired only into `commitSingleImport` and the bulk driver's per-row loop (19-10-PLAN.md:100), but plan 07's bulk "Import as New" calls `importContactRecord` directly (19-07-PLAN.md:108) and plan 11's `combineCluster` calls `createContactFullCore` directly (19-11-PLAN.md:99) — neither path ever reaches the photo hook, and `combineCluster` additionally never writes a birthday at all (only `importContactRecord` does that).
4. **No plan completes a session after duplicate-review resolution** — neither bulk `DuplicateReviewScreen` (19-07-PLAN.md Task 2) nor the single-import Link-to-Existing/deterministic branches (19-07-PLAN.md Task 3) ever call `completeSession`; `completeSession` is only invoked at `ImportCompleteScreen` mount (19-08-PLAN.md:81,89), which nothing re-triggers after a review action. A session resolved entirely through duplicate review stays `status='pending'` and keeps offering Resume indefinitely — undermining IMP-04's own resumability contract for what is, for an ambiguous-heavy import, the *primary* completion path, not an edge case.

### Agreed Strengths (2+ reviewers)

- The shared `(row_status, match_outcome)` transition table (19-01-PLAN.md:64-80) and `sessionSummaryCounts`'s `alreadyInOrbit` discriminator keyed on `match_outcome` (not `row_status`) genuinely close cycle-1's count-semantics collision at the schema/query level.
- Contact + row atomicity for the *creation* paths (single import, bulk "new", link-to-existing) is real: `importContactRecord`/`linkExistingContactToRow` (plan 03) compose `createContactFullCore` with plan 01's non-mutexed cores inside one `inWriteTransaction`, matching the non-reentrant mutex contract in `src/db/transaction.ts`.
- Durable staging is end-to-end: plan 02 returns a cache-only URI, plan 04 stages to document-dir before `acceptImportSessionWithRows`, plan 10 reads only the document-dir path, plan 09 preserves a live session's failed-row staged photos for Retry.
- Cluster-K consolidation's re-sequencing to pre-batch (`BulkImportSetupScreen`, before `runImportBatch`) is structurally sound and correctly reasoned: the driver only loads `pending` rows, so resolved cluster rows are naturally excluded from re-import.
- Migration 012 is correctly positioned as the very next version after the on-disk v11 chain; no shipped migration is edited.

### Agreed Concerns (2+ reviewers — highest priority)

See the four numbered HIGH items in the Consensus Summary above — items 1, 3, and 4 were independently raised by at least two of the three lanes; item 2 (multi-candidate storage) was raised by Codex and independently corroborated by Claude's source-grounded sub-review.

### Divergent Views

- Cursor rated the single-import Link-to-Existing session-completion gap MEDIUM in isolation, while Codex rated the broader duplicate-review completion gap (which also covers the bulk `DuplicateReviewScreen` path) HIGH. Both are the same root cause — no plan calls `completeSession` outside the `ImportCompleteScreen`-mount check — so this cycle's consensus treats it as one HIGH concern (item 4 above), taking the more severe rating since the bulk path is the common case, not an edge case.
- Cursor additionally flagged `combineCluster` writing `row_status='linked'` for newly-created rows (should be `'imported'` per plan 01's own table) as a MEDIUM row-semantics drift; Codex and Claude did not independently surface this exact framing but agree it is real once pointed to `19-11-PLAN.md:99`.

No reviewer found a reversal of a `[DECIDED]`/ADR/HANDOFF item. The Android-only iOS-picker deferral remains correctly honored throughout the revision.

---

## Cycle 2 — Codex Review

## Summary

The six Cycle-1 HIGH themes are mostly addressed in the revised plans: contact+row writes are explicitly composed through non-mutexed cores, cache photos are staged into the document directory before acceptance, summary semantics distinguish `already_linked`, retry accepts failed rows, the FAB routes multi-picks to bulk setup, and Cluster K is now pre-batch. Migration 012 is correctly positioned after the on-disk v11 chain ([database.ts](src/db/database.ts:46)). Remaining issues are concentrated in durable duplicate review, completion, and paths that bypass the shared photo workflow.

## Strengths

- Atomicity is now designed around the repository's non-reentrant mutex contract: extracting `createContactFullCore` is the correct response to the existing single-transaction implementation ([contacts-dao.ts](src/db/contacts-dao.ts:148), [transaction.ts](src/db/transaction.ts:49)).
- The revised session contract makes `already_linked` a discriminator independent of `row_status`, enabling correct four-bucket reporting ([19-01-PLAN.md:68](.planning/phases/19-system-contact-import/19-01-PLAN.md:68)).
- Document-dir staging is correctly made acceptance-time work, not a property of the native module.
- Bulk routing and pre-batch consolidation are now structurally in the right place.
- Phone-region threading correctly aligns imports with the existing method normalization boundary ([contacts-dao.ts](src/db/contacts-dao.ts:210)).

## Concerns

- **HIGH — NEW: Durable bulk duplicate review lacks the candidate set it needs after resume.** Plan 05 produces an ordered `candidates[]` set for multi-candidate outcomes ([19-05-PLAN.md:105](.planning/phases/19-system-contact-import/19-05-PLAN.md:105)), but migration 012 persists only one `matched_contact_id` plus `match_outcome` ([19-01-PLAN.md:61](.planning/phases/19-system-contact-import/19-01-PLAN.md:61)). Plan 01 additionally says outcomes are stored rather than recomputed on read ([19-01-PLAN.md:32](.planning/phases/19-system-contact-import/19-01-PLAN.md:32)), while Plan 07 expects cards/evidence/matched contacts from those durable row fields ([19-07-PLAN.md:108](.planning/phases/19-system-contact-import/19-07-PLAN.md:108)). A resumed `needs_review` row therefore cannot render or choose among multiple candidates.

- **HIGH — NEW: Several successful import paths bypass post-commit photo persistence.** Plan 10 wires the photo hook only into `commitSingleImport` and the bulk driver ([19-10-PLAN.md:97](.planning/phases/19-system-contact-import/19-10-PLAN.md:97)). But Plan 07's bulk "Import as New" calls `importContactRecord` directly ([19-07-PLAN.md:108](.planning/phases/19-system-contact-import/19-07-PLAN.md:108)), and Plan 11's `combineCluster` calls `createContactFullCore` directly ([19-11-PLAN.md:99](.planning/phases/19-system-contact-import/19-11-PLAN.md:99)). Photos from ambiguous-review imports and consolidation will remain staged and never become contact masters. Consolidation also has no stated birthday-selection/storage rule.

- **HIGH — PARTIALLY RESOLVED: Resolving duplicate-review rows never completes the session.** Plan 08 correctly keeps a session pending while review remains ([19-08-PLAN.md:81](.planning/phases/19-system-contact-import/19-08-PLAN.md:81)). However, Plan 07 resolves rows via import/link/skip and contains no final "if no pending/needs-review rows, complete session" step or return to the summary ([19-07-PLAN.md:108](.planning/phases/19-system-contact-import/19-07-PLAN.md:108)). Once all review rows are handled, the session remains `pending`, causing the launch sweep to keep offering Resume.

- **MEDIUM — NEW: Single-contact deterministic/link/skip outcomes also lack terminal session handling.** `commitSingleImport` completes only the Import-as-New route. Plan 07's Link-to-Existing is an atomic row/link operation but does not complete the single session; deterministic `already_linked` merely displays a state ([19-07-PLAN.md:127](.planning/phases/19-system-contact-import/19-07-PLAN.md:127)). Skip has the same gap. These choices can leave a one-row session resumable indefinitely.

- **MEDIUM — NEW: The claimed export-manifest "table set" does not exist in the source.** Plan 01 asks a test to import and inspect an explicit exported-table set, but [export-manifest.ts:45](src/backup/export-manifest.ts:45) uses direct SQL queries and exports no table-set constant. The intended test needs to build a manifest and assert no session fields, or the production code needs a declared manifest-table registry.

- **MEDIUM — NEW: Replace-all restore needs an explicit runtime-session policy.** The plans say import sessions are local-only and that Replace-all "neither reads nor writes" them ([19-01-PLAN.md:34](.planning/phases/19-system-contact-import/19-01-PLAN.md:34)). Existing replace-all explicitly deletes portable contact data but would not delete the new session tables ([restore-apply.ts:230](src/backup/restore-apply.ts:230)). Old pending sessions can therefore survive a replacement restore with their `contact_id` / `matched_contact_id` FKs nulled by contact deletion, then reappear as Resume prompts against restored data. Runtime sessions and their staged files should be discarded as part of Replace-all.

## Suggestions

- Persist a durable candidate snapshot/evidence JSON per session row, or explicitly re-score from the durable picker payload on every review read and update the plan's "not recomputed" contract.
- Create one post-commit finalizer used by every contact-producing route: normal batch, single import, duplicate-review Import-as-New, and consolidation. Define deterministic birthday/photo selection for a combined source cluster.
- Add a `finalizeSessionIfTerminal` DAO/service and call it after every review action; route the user back to `ImportComplete`.
- Add terminal handling for single deterministic, Link-to-Existing, and Skip decisions.
- Replace the nonexistent export-table-set assertion with a behavioral manifest test; explicitly purge local import sessions and staged photos during Replace-all restore.

## Risk Assessment

**HIGH.** The major Cycle-1 transaction, staging, retry, entry-point, count, and pre-batch-consolidation defects are fixed in plan text. However, durable review/resume is incomplete, and two legitimate contact-creation paths bypass photo handling. Those defects affect normal user flows and undermine IMP-04's resumability guarantee.

---

## Cycle 2 — Cursor Review

# Cross-AI Plan Review — Phase 19 System Contact Import (Cycle 2)

## Summary

The cycle-1 replan materially closes the six HIGH themes in plan text: migration 012 is correctly sequenced after v11 (`src/db/database.ts:46`), non-mutexed session-row cores mirror the established mutexed-writer pattern (`src/db/transaction.ts:19-23`, `src/db/contacts-dao.ts:5-11`), document-dir photo staging is assigned to plan 04 (mirroring `src/services/photos/photo-storage.ts:120-188`), `sessionSummaryCounts` + the canonical transition table live in plan 01, Retry via `eligibleStatuses` is wired through plans 06/08, the FAB multi-pick → `BulkImportSetup` route is specified in plans 04/06, and Cluster-K consolidation is moved pre-batch in plan 11. Remaining gaps are narrower: the bulk driver still splits some two-field row transitions across separate mutexed writers (reintroducing a count/resume inconsistency window the transition table was meant to eliminate), the single-import Link path never completes the session, import-staging path allowlisting is underspecified relative to the restore-pending model, and auto-discard of stale pending sessions does not chain staged-photo cleanup.

## Strengths

- **Shared data contract is now explicit.** Plan 01 publishes the `(event → row_status, match_outcome)` transition table and derives the four completion buckets from it; plans 06/07/08/11 all reference the same vocabulary.
- **Contact + row atomicity is solved for the import/write paths that matter most.** Plan 03 composes `createContactFullCore` + `setRowContactCore`/`setRowMatchOutcomeCore` inside one `inWriteTransaction`, matching the non-reentrant mutex contract documented in `src/db/transaction.ts:13-17` and the composition idiom in `src/db/contacts-dao.ts:148-149`.
- **Durable staging pipeline is end-to-end.** Plan 02 returns cache-only URIs; plan 04 stages to document-dir before `acceptImportSessionWithRows`; plan 10 reads `photo_rel_path` post-commit; plan 09 preserves failed-row staging for Retry.
- **Tracer-first wave ordering is sound.** Plan 04 device-verifies single import before bulk/photo/duplicate expansion; dependencies avoid circularity (05 parallel in wave 1; 11 correctly depends on 06 and runs pre-batch).
- **Duplicate engine ownership is clean.** Plan 05 owns `findActiveExternalLink` against the partial-unique index defined in `src/db/migrations/011-contact-lifecycle-schema.ts:180`; plan 03 writes links only.
- **Backup/local-only boundary is verified against real export code.** `src/backup/export-manifest.ts:45-58` enumerates exported tables explicitly and omits any import-session tables; plan 01 tasks a manifest-omission test against this file.
- **Phone region threading is grounded.** `resolveEffectivePhoneRegion` exists in `src/db/app-settings-dao.ts:296` and is already used on create (`src/screens/CreateContactScreen.tsx:125`); plans 03/04/06 thread the same value through `import_sessions.phone_region`.

## Concerns

### HIGH

- **PARTIALLY RESOLVED — Bulk driver dual-field writes are not atomic (theme 3 / count semantics).** Plan 06 instructs separate calls to `markRowStatus` and `setRowMatchOutcome` for `already_linked` and ambiguous rows (`19-06-PLAN.md` Task 1 action). Plan 01 defines each mutexed writer as its own `inWriteTransaction` (`19-01-PLAN.md` Task 2). A kill between the two calls leaves e.g. `row_status='skipped'` with `match_outcome IS NULL`, which `sessionSummaryCounts` counts under `failedOrSkipped` instead of `alreadyInOrbit` — exactly the collision cycle 1 flagged. Plan 01 already exports `markRowStatusCore` + `setRowMatchOutcomeCore` for composition; the driver should wrap both updates in one transaction (or add a dedicated `resolveAlreadyLinkedCore` / `deferForReviewCore` helper).

### MEDIUM

- **NEW — Single-import Link path never completes the session.** Plan 04's `commitSingleImport` calls `completeSession` after Import-as-New (`19-04-PLAN.md` must_haves). Plan 07's Link-to-Existing path calls only `linkExistingContactToRow` with no `completeSession` (`19-07-PLAN.md` Task 3 action). After a successful link the session stays `status='pending'`, so plan 09's `getResumableSession` will offer Resume/Discard on next launch even though the row is resolved — inconsistent with IMP-04's terminal-session expectation for single pick.

- **NEW — Auto-discard of stale pending sessions may orphan staged photos.** Plan 01's `getResumableSession` discards older pending sessions via `discardSession`, which returns `photo_rel_path` values (`19-01-PLAN.md` Task 2-3). Nothing in plan 01 or 09 requires calling `cleanupDiscardedStagedPhotos` after that auto-sweep; only the explicit Discard path in plan 09 Task 2 chains cleanup. Staged files under the new `import-staging/` namespace could accumulate until orphan reconciliation runs.

- **NEW — Import-staging path allowlist not placed alongside restore-pending guards.** Plan 04 mirrors restore-pending in `photo-storage.ts` and references `assertSafe*` guards, but `src/db/photo-relative-path.ts` only defines `SAFE_RELATIVE` and `SAFE_RESTORE_PENDING_RELATIVE` (`src/db/photo-relative-path.ts:22-29`) — no `import-staging/` regex. Restore-pending deliberately lives under `avatars/_restore_pending/` with a dedicated assert function (`src/db/photo-relative-path.ts:25-56`). Plan 04 puts staging at top-level `import-staging/` and does not list `photo-relative-path.ts` in `files_modified`; executors may inline ad-hoc checks and drift from the single chokepoint pattern.

- **NEW — Consolidation marks new-contact rows as `linked`.** Plan 11's `combineCluster` calls `setRowContactCore(..., 'linked')` for rows attached to a newly created contact (`19-11-PLAN.md` Task 1 action). Plan 01's transition table assigns `linked` to "link to existing" and `imported` to "import as new." Summary counts still work (`imported` bucket includes both statuses), but row semantics diverge from the canonical table and may confuse Phase 20 consumers reading `row_status`.

### LOW

- **NEW — Plan 07 single-import `already_linked` deterministic branch leaves row resolution unspecified.** Task 3 says "do not offer as new (surface 'Already in Orbit')" but does not mandate writing `skipped` + `match_outcome='already_linked'` + `matched_contact_id`, nor `completeSession`. The row may stay `pending`, breaking summary counts and resume routing.

- **NEW — Photo staging precedes DB accept without rollback coupling.** Plan 04 stages photos before `acceptImportSessionWithRows`; a DB failure after staging leaves document-dir files until plan 09's orphan sweep. Acceptable if orphan reconciliation is tested, but not explicitly acceptance-criteria'd in plan 04.

- **PARTIALLY RESOLVED — Android 17 picker birthday/photo remain device-unverified.** Plans 02/04/10 correctly treat A1/A2 as tracer assumptions; this is residual product risk, not a plan-text hole.

## Suggestions

1. **Add composed row-transition writers in plan 01 (or plan 06):** e.g. `markAlreadyLinkedCore(exec, rowId, matchedContactId, now)` and `deferNeedsReviewCore(exec, rowId, outcome, matchedContactId, now)` that apply both column updates in one transaction; have plan 06's driver call these instead of paired mutexed writers.

2. **Extract `commitSingleLink` (or extend `commitSingleImport`) in plan 04/07:** wrap `linkExistingContactToRow` + `completeSession` for single-mode sessions so Link and Import-as-New both terminate the session consistently.

3. **Add `SAFE_IMPORT_STAGING_RELATIVE` + `assertSafeImportStagingRelative` to `src/db/photo-relative-path.ts`** in plan 04's `files_modified`, mirroring `SAFE_RESTORE_PENDING_RELATIVE` (`src/db/photo-relative-path.ts:29-56`).

4. **Chain photo cleanup in `getResumableSession`'s auto-sweep:** when older pending sessions are discarded, pass returned paths to `cleanupDiscardedStagedPhotos` (plan 09) in the same launch pass.

5. **Use `row_status='imported'` in plan 11 `combineCluster`** for newly created consolidated contacts, reserving `linked` for link-to-existing paths only.

6. **Specify deterministic `already_linked` row writes in plan 07 Task 3** (mirror plan 06 driver semantics) plus session completion or explicit "leave pending for Discard" rationale.

## Risk Assessment

**MEDIUM**

The architectural skeleton is substantially stronger than cycle 1: migration numbering, mutex composition, staging durability, retry semantics, FAB routing, and pre-batch consolidation are all specified with verifiable anchors in the repo. The remaining issues are localized transaction-boundary gaps in the bulk driver's non-import classification paths and a missing session-completion step on single-import Link — both are fixable without replanning waves, but either could produce wrong completion counts or spurious resume prompts in production if executed literally as written. Android 17 picker field support remains the largest external unknown; it is acknowledged and appropriately deferred to the tracer/device UAT path.

---

## Cycle 2 — Claude (Sonnet 5) Reviewer

## Summary

The revision genuinely closes the mechanics of the six cycle-1 HIGH themes: I independently confirmed `TARGET_VERSION = 11` and migrations `001`-`011` on disk (`src/db/database.ts:46-58`), so migration 012 (19-01-PLAN.md:8, Task 1) is correctly the next number and additive-only. Plan 03's composition of `createContactFullCore` with plan 01's non-mutexed `*Core` writers inside one `inWriteTransaction` is real and matches `src/db/transaction.ts`'s non-reentrant mutex contract. Plan 01's canonical `(row_status, match_outcome)` transition table (19-01-PLAN.md:64-80) and `sessionSummaryCounts`'s `alreadyInOrbit` discriminator are a correct fix at the schema/query level. Retry's `eligibleStatuses` (19-06-PLAN.md:26,97) and the FAB→BulkImportSetup entry (19-06-PLAN.md Task 2, human-check) are concretely wired and tested. Cluster-K consolidation is correctly re-sequenced pre-batch into `BulkImportSetupScreen` (19-11-PLAN.md, Task 2). However, reading plan 06, 07, 08, 09, 10, and 11's actual task/action text line-by-line (not just their "Review Feedback Incorporated" claims) surfaces four HIGH-severity gaps the revision's new machinery introduces or leaves open, plus several MEDIUM/LOW items. I ran three parallel source-grounded sub-reviews (each independently verifying against the actual DAO/service files) and cross-checked their findings myself against the cited plan text and source; the findings below reflect that verification, not the plans' own claims.

## Strengths

- The transition table (19-01-PLAN.md:64-80) is genuinely a single documented source of truth that plans 06/07/08/11 reference by the same vocabulary — a real fix, not just a restated claim.
- `importContactRecord`/`linkExistingContactToRow` (plan 03) really do compose `createContactFullCore` + plan 01's non-mutexed cores inside one `inWriteTransaction` — I confirmed this against `src/db/transaction.ts`'s documented non-reentrancy contract and `src/db/contacts-dao.ts`'s existing `createContactFull`/`updateContactMetadataCore` idiom that plan 03 is asked to mirror.
- `discardSession`'s contract (19-01-PLAN.md:155) — collect `photo_rel_path` for contact_id-IS-NULL rows before deleting, return them for post-commit cleanup — correctly avoids the "paths become unrecoverable after DELETE" trap, and plan 09 correctly scopes cleanup to discarded sessions only, preserving a live session's failed-row staged photos for Retry.
- Migration 012's schema is purely additive with `ON DELETE SET NULL`/`ON DELETE CASCADE` used appropriately; no `ALTER TABLE contacts` anywhere in the plan set.

## Concerns

- **HIGH — PARTIALLY RESOLVED: The bulk driver's `already_linked`/`needs_review` classification writes are two separate mutexed transactions, not one.** Reading `19-06-PLAN.md:95,102-104` directly: "'already_linked' → markRowStatus(row,'skipped', null) AND setRowMatchOutcome(row,'already_linked', deterministicContactId)" and "else (probable/possible/needs_review) → setRowMatchOutcome(row, outcome, matchedContactId) AND markRowStatus(row,'needs_review', null)". Both `markRowStatus` and `setRowMatchOutcome` are declared as separately-mutexed standalone writers in plan 01 (19-01-PLAN.md:154, "each opens exactly one `inWriteTransaction`"). Plan 01 exports non-mutexed `setRowMatchOutcomeCore`/`markRowStatusCore` (19-01-PLAN.md:158) precisely so a caller can compose two column updates atomically — but plan 06's driver text never calls the `*Core` variants for these two paths (only the `new`→`importContactRecord` path is genuinely atomic). A process death between the two calls leaves `row_status='skipped'` with `match_outcome IS NULL`, which per 19-01-PLAN.md:80's own formula (`failedOrSkipped = row_status='failed' OR (row_status='skipped' AND (match_outcome IS NULL OR match_outcome <> 'already_linked'))`) miscounts the row as `failedOrSkipped` instead of `alreadyInOrbit` — reopening cycle-1's exact count-semantics collision, just narrowed from "every write" to these two specific classification branches.

- **HIGH — NEW: Migration 012's schema cannot store more than one review candidate, but plan 05 produces a candidate list.** `19-01-PLAN.md:61`'s `import_session_rows` schema has exactly one `matched_contact_id` column. Plan 06's driver (19-06-PLAN.md:104) writes `setRowMatchOutcome(row, outcome, matchedContactId)` — a single ID — for ambiguous rows, and 19-01-PLAN.md:32 states outcomes are "stored on the row ... rather than recomputed on read." Yet plan 07's bulk grid (19-07-PLAN.md Task 2) and its single-import interrupt (Task 3, "multiple credible candidates → list candidate cards with Choose this one") both expect a durable multi-candidate view for the review UI. For a bulk `needs_review` row with 2+ credible candidates, only one survives to disk — a resumed session or the bulk grid can never show "choose among 3 candidates," only "choose this one candidate or import as new," silently narrowing the user's actual choice set from what plan 07's own single-import interrupt promises.

- **HIGH — NEW: `combineCluster` and bulk "Import as New" from the review grid never reach plan 10's photo/birthday hook.** Plan 10 wires `persistImportedPhotoPostCommit` into exactly two call sites: `commitSingleImport` (19-10-PLAN.md:100, "enrich its BODY only") and the bulk driver's per-row loop (19-10-PLAN.md:100). But 19-07-PLAN.md:108 (DuplicateReviewScreen Task 2) has bulk "Import as New" call `importContactRecord` directly — not `commitSingleImport` — so a photo staged for an ambiguous-review row that the user chooses to import as new is never promoted from staging; it stays orphaned. Separately, 19-11-PLAN.md:99's `combineCluster` calls `createContactFullCore` directly (never `importContactRecord`, whose own transaction step writes the validated birthday — see 19-10-PLAN.md:68's note that plan 03 owns the birthday write inside `importContactRecord`). Since `createContactFullCore` is the birthday-less contact/methods/def-matrix extraction (per plan 03's stated extraction scope), a consolidated contact silently gets neither its birthday nor any of its source photos, despite the picker having returned that data for at least one of the clustered source records.

- **HIGH — NEW (same root cause surfaced by two independent code paths; consensus treats as one item): No plan calls `completeSession` after a duplicate-review resolution finishes a session.** `completeSession` is invoked exactly once across all 11 plans, at `ImportCompleteScreen` mount (19-08-PLAN.md:81,89), gated on `needReview==0 && no pending rows`. Reading 19-07-PLAN.md Task 2 (bulk `DuplicateReviewScreen`) and Task 3 (single-import interrupt) in full: neither task's action text calls `completeSession`, and nothing routes the user back through `ImportCompleteScreen`'s mount check after the grid's last `needs_review` row or a single-import Link-to-Existing action resolves. `getResumableSession` (19-01-PLAN.md:179) selects purely on `status='pending'`, so a session resolved entirely through duplicate review — which is the *expected* completion path whenever ambiguous rows exist, not a rare edge case — remains resumable forever, contradicting IMP-04's own "at most one resumable session, resolved sessions are terminal" intent.

- **MEDIUM — STILL UNRESOLVED: Replace-all restore does not purge import-session tables, and their FKs go stale.** I confirmed directly: `src/backup/restore-apply.ts:232`'s `replaceAllReset` table-delete list (`contact_method_provenance, interactions, events, fuel, custom_field_values, contact_links, external_contact_links, contact_methods, ...contacts, custom_field_defs`) does not include `import_sessions` or `import_session_rows`. Both `contact_id` and `matched_contact_id` in migration 012's schema are `ON DELETE SET NULL` (19-01-PLAN.md:61), so a Replace-all restore nulls out those FKs on any surviving pending session rather than removing the session, and it can resurface as an incorrect Resume prompt against a freshly-restored database. No plan (01 or 09) states an explicit "purge import sessions on Replace-all" step — 19-01-PLAN.md:34 only says Replace-all "neither reads nor writes" the tables, which is true of the *current* restore code but does not address the FK-null survival consequence.

- **MEDIUM — STILL UNRESOLVED: The export-manifest "table set" test as specified cannot be written against the actual code shape.** I read `src/backup/export-manifest.ts:40-53` directly: `readManifest` builds the `BackupManifest` via 13 inline `Promise.all`-batched `SELECT` statements against named tables — there is no exported table-name array or constant. 19-01-PLAN.md:191's acceptance criterion ("an assertion that the backup export manifest's exported-table set (imported from export-manifest.ts) contains neither 'import_sessions' nor 'import_session_rows'") describes a test fixture that does not exist in the source as written; the test needs to call `readManifest`/`buildBackupManifest` and assert the resulting object has no session-shaped keys, not import a table-set constant.

- **MEDIUM — STILL UNRESOLVED: `getResumableSession`'s auto-sweep of older pending sessions has no firm staged-photo cleanup guarantee.** 19-01-PLAN.md Task 3 has `getResumableSession` call `discardSession` on older pending sessions (in their own transactions) and states this "may open transactions for the sweep," but plan 01 (wave 1) cannot call plan 09's `cleanupDiscardedStagedPhotos` (wave 5) — and plan 09's own Task 1 only makes reconciliation of "truly-orphaned import-staging files" **optional** ("Optionally reconcile ... via listImportStagingPhotos"), never required. A user who accumulates several abandoned pending sessions across launches (each auto-swept by the next launch's `getResumableSession` call) can leak staged photo files under `import-staging/` indefinitely unless the optional reconciliation happens to be implemented.

- **MEDIUM — STILL UNRESOLVED: `combineCluster` writes `row_status='linked'` for rows attached to a brand-new contact.** I confirmed 19-11-PLAN.md:99 directly: `setRowContactCore(exec, row.id, contactId, 'linked', now)` for every clustered row, where `contactId` came from `createContactFullCore` in the *same* action (a genuinely new contact, not a link to a pre-existing one). Plan 01's own canonical table (19-01-PLAN.md:69-70) maps "import as new" → `imported` and reserves `linked` for "link to existing." `sessionSummaryCounts`'s `imported` bucket happens to include both statuses (19-01-PLAN.md:77), so this does not break the completion count this cycle, but it is a documented drift from the single source of truth this very revision established, and plan 11's own text (line 26) explicitly flags Phase 20 as a future consumer of `row_status` — exactly the kind of consumer this drift would mislead.

- **LOW — STILL UNRESOLVED: The import-staging safe-path guard was not added to the canonical chokepoint file.** `src/db/photo-relative-path.ts` is the single place `SAFE_RELATIVE`/`SAFE_RESTORE_PENDING_RELATIVE` and their `assertSafe*` functions live (confirmed via source read); 19-04-PLAN.md's `files_modified` does not list this file even though its task text asks for an `import-staging/` namespace "mirroring restore-pending... with the same token-safety guards." An executor following `files_modified` literally will not touch the actual chokepoint and may inline an ad-hoc regex in `photo-storage.ts` instead.

- **LOW — STILL UNRESOLVED: Plan 07 Task 3's single-import deterministic `already_linked` branch leaves the row's terminal write unspecified.** The action text says "do not offer as new (surface 'Already in Orbit')" but does not mandate the row write (`skipped` + `match_outcome='already_linked'` + `matched_contact_id`, mirroring plan 06's driver semantics for the same outcome) nor a session-completion call. As written, this branch can leave a single-mode session's only row permanently `pending`.

## Suggestions

- Add `resolveAlreadyLinkedCore`/`deferNeedsReviewCore` composed writers to plan 01 (or inline the composition in plan 06 using the already-exported `*Core` functions) so the two classification paths get the same one-transaction guarantee the `new`/import path already has.
- Either persist the full candidate list (a JSON column or a child table) or make plan 07 explicitly re-score from the durable `source_payload` + `phone_region` on every review render, and correct 19-01-PLAN.md:32's "not recomputed on read" claim to match whichever is chosen.
- Route bulk "Import as New" (plan 07) and `combineCluster` (plan 11) through the same post-commit finalizer plan 10 defines, or extend `persistImportedPhotoPostCommit`'s call sites to cover both; give `combineCluster` an explicit birthday-selection rule (e.g., first non-null birthday among clustered source rows) before calling `createContactFullCore`.
- Add a `finalizeSessionIfTerminal(exec, sessionId, now)` helper (checking `needReview==0 && pending==0` via `sessionSummaryCounts`) and call it after every row-resolving action in plan 07, not only at `ImportCompleteScreen` mount.
- State an explicit Replace-all policy: delete `import_sessions`/`import_session_rows` (and sweep their staged photos) as part of `replaceAllReset`, or as a dedicated post-restore step.
- Rewrite 19-01-PLAN.md's export-manifest acceptance criterion as a behavioral assertion against `readManifest`'s output shape rather than an "imported table-set" fixture.
- Make plan 09's orphan-staging reconciliation a required (not optional) task, or require plan 01's auto-sweep to call it directly.
- Change `combineCluster`'s row write to `row_status='imported'`.

## Risk Assessment

**HIGH.** The revision fixes the transaction/staging/retry/entry-point mechanics that made cycle-1's findings HIGH, but the new machinery it introduced to close those themes (the bulk driver's split classification writes, the pre-batch consolidation writer, and the duplicate-review resolution paths) has its own atomicity and completion gaps that would produce wrong "Already in Orbit" counts, orphaned photos/birthdays, and sessions that resume forever in real, common usage — not edge cases. None of these four HIGH items requires a wave reshuffle to fix; each is a scoped change to an existing plan's task text (mostly plan 06, 07, and 11).

---

## Cycle 2 — Verification Coverage (advisory, not counted toward totals)

| Symbol / claim | Status | Note |
|---|---|---|
| `TARGET_VERSION = 11`, `MIGRATIONS` array ending at `migration011` | VERIFIED `src/db/database.ts:46-58` | Confirms migration 012 (plan 01) is the correct next version |
| Migrations `001`-`011` shipped on disk, nothing beyond | VERIFIED via `ls src/db/migrations/` | No plan edits a shipped migration |
| `inWriteTransaction` non-reentrant mutex contract | VERIFIED `src/db/transaction.ts` (read by two sub-reviews) | Matches plans' stated "never nest" rule |
| `createContactFull`/`createContactFullCore` extraction source body | VERIFIED `src/db/contacts-dao.ts:112-231` (per sub-review) | Plan 03's extraction target is the real existing function |
| `src/backup/export-manifest.ts` builds via inline SQL, no table-set constant | VERIFIED directly, lines 40-53 read in full | Contradicts plan 01's "imported from export-manifest.ts" test framing |
| `src/backup/restore-apply.ts:232` `replaceAllReset` table list omits `import_sessions`/`import_session_rows` | VERIFIED directly via grep + read | Confirms the Replace-all gap |
| `src/db/photo-relative-path.ts` defines only `SAFE_RELATIVE`/`SAFE_RESTORE_PENDING_RELATIVE` | VERIFIED by sub-review read of lines 22-56 | No `import-staging/` guard exists yet |
| `createContactFullCore`, `setRowContactCore`, `markRowStatusCore`, `setRowMatchOutcomeCore`, `linkExistingContactToRow`, `combineCluster`, `detectSourceClusters`, `persistImportedPhotoPostCommit`, `sessionSummaryCounts`, `acceptImportSessionWithRows` | NOT YET ON DISK — declared under "Artifacts this phase produces" | Correctly not flagged as missing; these are this phase's own deliverables |
| `resolveEffectivePhoneRegion` in `src/db/app-settings-dao.ts:296` | UNCHECKABLE this session | Cited by Cursor; not re-opened this cycle, but independently verified in cycle 1's review and unchanged by this revision |
| `src/db/migrations/011-contact-lifecycle-schema.ts` partial-unique index on `external_contact_links` | VERIFIED file exists; exact line number for the index not re-confirmed this cycle (cited as ~163 vs plans' ~175/180) | Cosmetic line-number drift only, not a correctness issue |

---

# Cross-AI Plan Review — Phase 19: System Contact Import — CYCLE 3

## Cycle 3 Consensus Summary

All three reviewers (Codex, Cursor, Claude/Sonnet-5, each source-grounded against the actual repository) agree the 11-plan set is close to execution-ready after two prior review cycles plus the internal checker's nav route-param-inversion + failed-row-Retry fixes (commit 90f097d) — all previously-fixed items were independently re-verified as intact. Two concrete, unresolved HIGH defects remain, both confirmed against real source rather than restated plan text, and both scoped, narrow plan-text fixes rather than architectural rework:

1. **Plan 04's `ImportReviewScreen` photo preview crashes on render.** Its own text instructs previewing the staged `import-staging/...` path through `Avatar`, but `Avatar` → `resolvePhotoUri` → `assertSafeRelative` (`src/db/photo-relative-path.ts:20,33-41`) only accepts the canonical `avatars/<name>.<ext>` shape and throws synchronously for anything else — a hazard the plan set's own doc comments explicitly warn about for exactly this reason (`photo-relative-path.ts:33-36`). Codex and Claude both independently found and confirmed this against source; Cursor did not flag it this cycle.
2. **The bulk category override chosen in `BulkImportSetupScreen` is never durably persisted to `import_sessions.batch_category_id`** — it only flows as a navigation parameter to `ImportProgress`. Retry (`ImportComplete`, plan 08) and duplicate-review "Import as New" (plan 07) both need `batchCategoryId` on screens whose route param is `{sessionId}` only, with no DAO read of the session's `batch_category_id` specified anywhere — so the user's category choice silently reverts to Uncategorized outside the single uninterrupted setup→progress pass. Cursor and Claude both independently traced and confirmed this against cross-plan text; Codex did not flag it this cycle.

Neither finding was present, in this form, before this cycle's plan text — both are newly surfaced this cycle, not restatements of a prior finding. No reviewer found a `[DECIDED]`/ADR/HANDOFF reversal.

### Agreed Strengths (2+ reviewers)

- The non-reentrant mutex composition (`src/db/transaction.ts:12-23`) and the composed single-transaction "Core" writer pattern are correctly used throughout plans 01/03/04/06/11.
- `candidates_json` durable multi-candidate persistence, `finalizeSessionIfTerminal`'s `failed==0` requirement, and `combineCluster`'s atomic birthday+photo+row-resolution write are all confirmed intact from cycle 2's fixes.
- Plan 04 remains the sole writer of `src/navigation/types.ts`, closing the checker's nav route-param-inversion finding across every consuming plan (06/07/08/09).
- Deterministic external-link bypass (`idx_external_contact_links_active` partial unique index, `src/db/migrations/011-contact-lifecycle-schema.ts`) correctly precedes and short-circuits advisory scoring.

### Agreed Concerns (2+ reviewers)

- None of the two HIGH findings above were flagged by all three reviewers simultaneously (each was independently found by two of three), but both are treated as consensus HIGH on the strength of independent source-grounded confirmation, per this cycle's instructions to weight `path:line`-cited findings heavily.
- Plan 09's bulk resume routing treating any `pending > 0` as "batch not started" (Cursor, Claude) is an agreed MEDIUM: it misroutes a mid-batch interrupt back through setup instead of progress, compounding the category-override loss.

### Divergent Views

- Codex flagged plan 09's `src/App.tsx` vs. `App.tsx` file-reference inconsistency as its second HIGH ("risking an unwired resume feature"); Claude independently confirmed the inconsistency is real but downgraded it to MEDIUM because the plan's own operative `<action>` prose (not just the `<files>` tag) correctly names `App.tsx` in four of seven occurrences — an attentive executor following the action text lands on the right file, though the mechanical `<files>`/artifact-list entries should still be fixed.
- Cursor additionally flagged a wave-5 dependency gap (plan 07 missing `depends_on: [19-10]` for the shared `importRowAsNew` photo enrichment) as MEDIUM; Claude independently confirmed this via the plan headers and a dedicated sub-review of plans 02/03/05/10/11, which found no equivalent gap elsewhere (plan 11 correctly lists `19-10` in its own `depends_on`).
- Cursor's LOW "Merge restore leaves runtime import sessions in place" is not a live finding — Claude confirmed it is already explicitly documented as an accepted assumption in `19-01-PLAN.md:40` ("a Merge restore neither reads nor writes them"), so it is resolved/deferred, not outstanding.

## Cycle 3 — Codex Review


## Summary

The plan set is substantially coherent after the prior revisions: transaction composition, durable-session state, retry semantics, route placeholders, and photo post-commit handling align with the existing codebase. Two execution-blocking gaps remain.

## Strengths

- Plans 01/03 correctly respect the repository’s non-reentrant transaction rule: nested `inWriteTransaction` calls would deadlock, as documented in [src/db/transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:12). Extracting cores is the right approach.
- The planned atomic importer preserves the existing full custom-field pair-matrix behavior currently inside `createContactFull` at [src/db/contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:181).
- The planned photo staging pattern appropriately mirrors the existing durable restore staging implementation, which copies into `Paths.document` before later processing at [photo-storage.ts](/home/bwales/projects/orbit-app/src/services/photos/photo-storage.ts:143).
- Plan 01’s Replace-all purge is necessary and correctly targets the existing reset loop in [restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:232).

## Concerns

- **HIGH — Plan 04’s staged-photo preview will crash if it uses `Avatar` as specified.** The plan says `ImportReviewScreen` previews the staged `import-staging/...` path through `Avatar`. But `Avatar` unconditionally calls `resolvePhotoUri(photo)` ([Avatar.tsx](/home/bwales/projects/orbit-app/src/components/Avatar.tsx:67)), and that resolver accepts only canonical `avatars/<name>.<ext>` paths ([photo-relative-path.ts](/home/bwales/projects/orbit-app/src/db/photo-relative-path.ts:27), [photo-storage.ts](/home/bwales/projects/orbit-app/src/services/photos/photo-storage.ts:195)). Plan 04 introduces `import-staging/...`, which is intentionally outside that allowlist. The result is a synchronous throw during render, before the image component’s `onError` fallback can help.

  Fix: add an explicitly guarded `resolveImportStagingUri()` helper alongside the proposed import-staging helpers, and have the review preview use an import-specific image path/component rather than `Avatar`’s canonical-photo contract. Keep `Avatar` restricted to persisted masters.

- **HIGH — Plan 09 names the wrong app-root file, risking an unwired resume feature.** Its `files_modified`, task ownership, and artifact list specify `src/App.tsx`, but the actual bootstrap file is [App.tsx](/home/bwales/projects/orbit-app/App.tsx:135); no `src/App.tsx` exists. This is where sweeps are registered before `installSweepTrigger(AppState)` ([App.tsx](/home/bwales/projects/orbit-app/App.tsx:142), [App.tsx](/home/bwales/projects/orbit-app/App.tsx:214)). Following the plan literally leaves resume registration and prompt rendering unwired.

  Fix: replace every `src/App.tsx` reference in Plan 09 with `App.tsx`, and explicitly insert the import-resume registration before `installSweepTrigger` is invoked.

## Per-plan status

| Plan | Status |
|---|---|
| 19-01 | Ready |
| 19-02 | Ready, subject to required Android 17 device tracer |
| 19-03 | Ready |
| 19-04 | Blocked by staged-photo preview path mismatch |
| 19-05 | Ready |
| 19-06 | Ready |
| 19-07 | Ready |
| 19-08 | Ready |
| 19-09 | Blocked by incorrect app-root target |
| 19-10 | Ready |
| 19-11 | Ready |

## Risk Assessment

**HIGH** until the two blockers are corrected: one crashes the single-review photo-preview path; the other can omit the launch-resume integration required by IMP-04.

## Cycle 3 — Cursor Review

# Cross-AI Plan Review — Phase 19: System Contact Import (Cycle 3)

Reviewed all 11 on-disk plans against the repository at v11 (`TARGET_VERSION = 11` in `src/db/database.ts:46`; migrations `001`–`011` on disk; no Phase 19 implementation yet). Cycle 1 and Cycle 2 HIGH themes are substantively closed in the current plan text (atomic contact+row composition, document-dir staging, `match_outcome`/`candidates_json` contract, `finalizeSessionIfTerminal`, pre-batch consolidation, FAB multi-pick routing, Retry via `eligibleStatuses`, placeholder-first nav params in plan 04). The checker fixes called out for Cycle 3 (nav route-param inversion, failed-row Retry resumability) are reflected in plans 04, 07, 08, and 09. **Two durability gaps remain.**

---

## Summary

The phase is architecturally sound and close to execution-ready: wave ordering is coherent, the transition table in plan 01 is the load-bearing contract, and every major write path composes against the non-reentrant mutex documented in `src/db/transaction.ts:12-23` and the single-transaction `createContactFull` body at `src/db/contacts-dao.ts:148-230`. Cycle 3 should not reopen resolved cycle-1/2 findings (photo bypass, dual-field writes, session never completing, Cluster K timing, cache staging, etc.) — those are fixed in the current plans.

What remains is narrower but user-visible: **the bulk category override chosen in setup is not durably stored on the session**, so Retry, duplicate-review Import-as-New, and post-death resume can silently revert to Uncategorized even after the user picked Work/Friends. Secondarily, bulk resume routing treats any `pending > 0` as “batch not started,” which misroutes mid-batch interrupts back through setup instead of progress.

---

## Strengths

- **Mutex composition matches the repo.** Plan 03’s `createContactFullCore` extraction aligns with the actual non-reentrant contract in `src/db/transaction.ts:12-23` and the existing `inWriteTransaction` wrapper in `src/db/contacts-dao.ts:148`.
- **Deterministic identity is schema-backed.** Plan 05’s `findActiveExternalLink` targets the partial unique index defined at `src/db/migrations/011-contact-lifecycle-schema.ts:180` — not hand-waved.
- **Durable staging mirrors a shipped idiom.** Plan 04’s document-dir staging follows the restore-pending pattern in `src/services/photos/photo-storage.ts:120-188`; plan 02 correctly limits itself to cache copies out of the grant.
- **Count semantics are schema-level, not UI-level.** Plan 01’s transition table plus `sessionSummaryCounts` keyed on `match_outcome='already_linked'` closes the Already-in-Orbit vs user-Skip collision cycle 1 flagged.
- **Canonicalization before match is grounded.** Plan 05 threads `effectivePhoneRegion` through `normalizeContactMethod`; without it, national-format phones store `canonical_value: null` per `src/logic/contact-method-normalization.ts:59-60`, degrading IMP-03’s primary signal.
- **Pre-batch consolidation is structurally correct.** Plan 11 runs over still-pending rows before `runImportBatch` loads pending-only rows — the fix for the cycle-1 “structurally dead” DuplicateReview wiring.
- **Local-only session policy is verified against export code.** `src/backup/export-manifest.ts:45-58` enumerates portable tables and omits import sessions; plan 01 adds Replace-all purge to `replaceAllReset` (currently deleting contact tables at `src/backup/restore-apply.ts:232` only).
- **Android-only / no `READ_CONTACTS` boundaries are consistent** with the existing autolinked module pattern (`modules/orbit-backup-document-picker/`; empty manifest at `modules/orbit-backup-document-picker/android/src/main/AndroidManifest.xml`).

---

## Concerns

### HIGH

- **Bulk category override is not durable — Retry and review paths lose the user’s choice.**  
  - **Mechanism:** `import_sessions.batch_category_id` is the durable batch category column (plan 01, migration 012). `acceptPickedContacts` writes it at acceptance; bulk acceptance happens before setup, so it stays `NULL` (Uncategorized).  
  - **Gap:** Plan 06 Task 2 passes the setup override only as a **navigation param** to `ImportProgress` (`19-06-PLAN.md` Task 2 action: “navigates to ImportProgress with the chosen batchCategoryId”) — it never UPDATEs `import_sessions.batch_category_id`.  
  - **Downstream impact:**  
    - Plan 08 `ImportComplete` route is `{ sessionId: number }` only; Retry calls `runImportBatch` with `batchCategoryId` but does not specify a source (`19-08-PLAN.md` Task 1). An executor reading `session.batch_category_id` gets `NULL`.  
    - Plan 07 Task 2 read_first explicitly references “session's … `batch_category_id`” for `importRowAsNew` — same stale value for DuplicateReview **Import as New** in the same live session, not only after process death.  
  - **Evidence:** Session column exists for durability (`19-01-PLAN.md:68`); phone_region is correctly persisted at acceptance (`19-04-PLAN.md:38`); category is not treated the same way.

### MEDIUM

- **Bulk resume routing conflates “batch never started” with “batch interrupted mid-run.”**  
  - Plan 09 routes `mode='bulk'` + `pending > 0` → `BulkImportSetup` with the comment “the batch has not run yet” (`19-09-PLAN.md` Task 2), but the condition is only `pending > 0`. After a mid-batch kill, some rows may already be `imported`/`skipped`/`needs_review`/`failed` while others remain `pending`. Resume sends the user back through setup instead of `ImportProgress` (or a direct “continue import” path). Data is not corrupted — `runImportBatch` re-processes pending rows — but UX is wrong and forces an extra setup step; combined with the category issue above, the user may unknowingly change category on re-entry.

- **Wave 5 parallel ordering: plan 07 does not depend on plan 10.**  
  - Plan 07 must_haves require bulk Import-as-New to reach plan 10’s post-commit photo via `importRowAsNew` (`19-07-PLAN.md:27`), but `depends_on` is `[19-04, 19-05, 19-06]` only — not `19-10`. Plan 10 enriches `importRowAsNew` in the same wave. Parallel execution can pass plan 07 acceptance before the photo hook exists. Final phase state is fine if all wave-5 plans complete, but wave-internal ordering is underspecified for verification.

### LOW

- **Merge restore leaves runtime import sessions in place (accepted, but worth noting).** Plan 01 declares sessions local-only and purges on Replace-all; Merge restore neither reads nor writes them. A pending session can survive a Merge restore with nulled FKs (`ON DELETE SET NULL`), surfacing a Resume prompt against merged data. Replace-all is covered; Merge is an explicit non-policy.

- **BulkImportSetup selection count does not account for pre-batch consolidation.** After plan 11 `Combine`, resolved rows are no longer pending but the setup screen may still show “N contacts selected” from `total_rows`. Cosmetic only.

- **Single-import deterministic `already_linked` branch lacks a navigation terminus.** Plan 07 Task 3 writes `resolveAlreadyLinked` + `finalizeSessionIfTerminal` but does not specify where the user lands after “Already in Orbit” (summary vs dashboard). Session state is correct; UX is incomplete.

---

## Suggestions

1. **Persist batch category at setup confirm (primary fix).** In plan 06 Task 2 (or a small DAO helper in plan 01), UPDATE `import_sessions.batch_category_id` when the user taps `Import N contacts`, inside the same transaction or immediately before navigating to `ImportProgress`. Then:
   - `runImportBatch` may default `batchCategoryId` from the session row when the caller omits it.
   - Plan 08 Retry reads `session.batch_category_id` — no route param needed.
   - Plan 07 DuplicateReview `importRowAsNew` reads the same durable value.
   - Add a test: setup override → process death → Retry → imported contacts carry the chosen `category_id`.

2. **Refine plan 09 resume routing.** Split bulk `pending > 0`:
   - If **all** rows are still `pending` (no imported/linked/skipped/failed/needs_review) → `BulkImportSetup`.
   - If **any** non-pending row exists → `ImportProgress` (or `ImportComplete` when only failed/needs_review remain), reading `batch_category_id` from the session.

3. **Add `19-10` to plan 07 `depends_on`** (or document wave-5 execution order: 10 before 07) so bulk Import-as-New device UAT never runs without the photo seam.

4. **Optional: Merge-restore session purge.** If stale Resume after Merge is unacceptable, add a one-line policy to plan 01/backup docs: Merge restore discards non-complete import sessions (same as Replace-all), or document it as owner-accepted local-only drift.

---

## Risk Assessment

**MEDIUM**

The phase’s structural risks (atomicity, staging durability, count semantics, consolidation timing, Retry eligibility, nav param inversion) are addressed in plan text and grounded in real source. The remaining **batch category durability** gap is a concrete IMP-02/IMP-04 defect in normal bulk flows (Retry and duplicate-review Import-as-New), not an edge case — it will ship if plans execute literally. Resume routing and wave-5 ordering are friction/verification issues, not architectural reversals. No `[DECIDED]`/ADR/HANDOFF reversal found; Android-only iOS deferral remains consistent.

**Verdict:** One targeted plan edit (persist `batch_category_id` at setup + read it everywhere `batchCategoryId` is needed) away from execution-ready. Without that fix, do not treat Cycle 3 as zero-findings.

## Cycle 3 — Claude (Sonnet 5) Reviewer

## Summary

The 11 plans, revised across two prior review cycles plus an internal checker pass (nav route-param inversion + failed-row Retry resumability, commit 90f097d), are close to execution-ready. The architecture (additive migration 012, composed single-transaction cores, durable staging, count semantics, pre-batch consolidation) is sound and every previously-fixed HIGH from cycles 1-2 remains correctly reflected in the current plan text — I re-verified all five call-out items from the task brief against the actual plan files and, where the code already exists, against source. Two concrete, unresolved HIGH defects remain, both confirmed against real source or real cross-plan text rather than plan-text restatement, plus several actionable non-HIGH gaps.

## Strengths

- `finalizeSessionIfTerminal` correctly requires `pending==0 AND needs_review==0 AND failed==0` (`19-01-PLAN.md:35,177,195-196`) and every row-resolving path in plans 06/07/08/11 calls it — the cycle-2 HIGH 4 fix and the checker's failed-row WARNING fix are both intact.
- `candidates_json` durable multi-candidate persistence (`19-01-PLAN.md:34,72`, produced by `19-05-PLAN.md:27`) is correctly wired through to plan 07's grid without re-scoring.
- `combineCluster` (`19-11-PLAN.md:22-26,108`) is genuinely atomic (one `inWriteTransaction`, birthday + N links + N provenance + N row resolutions), writes `row_status='imported'` (not `'linked'`), and persists photo/birthday post-commit — the cycle-2 HIGH 3 fix is intact, and plan 11 is correctly sequenced at wave 6 (`depends_on: [19-01, 19-03, 19-05, 19-06, 19-10]`) so it never races plan 10.
- Plan 04 is confirmed the sole writer of `src/navigation/types.ts` (`19-04-PLAN.md:200`); plans 06/07/08 all explicitly mark it read-only and register no new param key — the checker's nav route-param-inversion fix holds up across every consuming plan, not just the one the checker touched.
- The non-reentrant mutex contract plans 01/03/04/11 build on is real: `src/db/transaction.ts:12-23` documents exactly the "extract a non-mutexed core, wrap once at the outermost caller" pattern the plans require.

## Concerns

- **HIGH — Plan 04's single-import photo preview will crash on render.** `19-04-PLAN.md:119` instructs: "...birthday, photo preview via Avatar reading the staged path)". `Avatar` (`src/components/Avatar.tsx:67`) unconditionally calls `resolvePhotoUri(photo)` (`src/services/photos/photo-storage.ts:209`), which calls `assertSafeRelative()` (`src/db/photo-relative-path.ts:33-41`). `assertSafeRelative` only accepts `SAFE_RELATIVE` (`photo-relative-path.ts:20`: `^avatars\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$`). The staged photo path this same plan introduces is `import-staging/<sessionToken>/<rowToken>.<ext>` (`19-04-PLAN.md:36,49`), validated by a *different*, additive regex (`SAFE_IMPORT_STAGING_RELATIVE`). `import-staging/...` does not match `avatars/...`, so `assertSafeRelative` throws synchronously inside `Image`'s `source.uri` resolution, before `onError` can catch it (the throw happens in `resolvePhotoUri`, called eagerly to build the `source` prop, not inside the native image load). No alternate resolver or preview component is specified anywhere in the plan text — I checked for one (`grep` across all phase docs for `resolveImportStagingUri`/similar) and found none. This crashes `ImportReviewScreen` for any single import whose picked contact has a photo, i.e., the plan's own leading tracer slice.
  - Fix: add a guarded `resolveImportStagingUri()` (mirroring `resolveRestorePendingUri`, `photo-storage.ts:214-218`, which already exists for exactly this "non-canonical staging path" case) and have the review preview build its own `source.uri` through that, not through `Avatar`.

- **HIGH — The bulk category override the user picks in `BulkImportSetupScreen` is never durably persisted, so Retry and duplicate-review "Import as New" silently revert it to Uncategorized.** Traced end-to-end:
  - `import_sessions.batch_category_id` (`19-01-PLAN.md:68`) is written once, at acceptance, by `acceptImportSessionWithRows` (`19-04-PLAN.md:140`'s `routePickedImport` calls `acceptPickedContacts(bulk)` for N>1 *before* the user ever sees `BulkImportSetup` — there is no `batchCategoryId` to pass at that point).
  - `BulkImportSetupScreen` (`19-06-PLAN.md:132`) lets the user choose a category override, but its CTA "navigates to ImportProgress with the chosen batchCategoryId" — a navigation param only, never a DB write back to `import_sessions.batch_category_id`.
  - `ImportComplete`'s route param is `{ sessionId: number }` only (declared once, by plan 04, `19-04-PLAN.md:129`; plans 06/07/08 all explicitly may not add a param key). Yet `19-08-PLAN.md:84` has the Retry affordance call `runImportBatch(exec, { sessionId, batchCategoryId, ... })` — `batchCategoryId` is not in scope on that screen and is not read from the session row anywhere in the plan (no DAO read of `batch_category_id` is specified).
  - `DuplicateReview`'s route param is likewise `{ sessionId: number }` only, yet `19-07-PLAN.md:123` has bulk "Import as New" call `importRowAsNew(exec, { row, batchCategoryId, ... })` — same missing source.
  - Net effect: any bulk import that isn't resolved in one uninterrupted setup→progress pass (a Retry after partial failure, or any duplicate-review "Import as New") silently drops the user's chosen category and imports to Uncategorized instead — a real, common-path IMP-02/IMP-04 defect, not an edge case.
  - Fix: persist `batch_category_id` to the session row when the user confirms setup (a small DAO write in plan 01 or 06, inside/immediately before the `ImportProgress` navigation), and have `runImportBatch`/`importRowAsNew` default `batchCategoryId` from the session row when the caller doesn't have a fresher in-memory value.

- **MEDIUM — Plan 09's bulk resume routing conflates "batch never started" with "batch interrupted mid-run."** `19-09-PLAN.md:116`: "mode='bulk' with pending>0 → navigate BulkImportSetup(sessionId)". This fires identically whether zero rows have been processed or the batch died after importing most of them (some `imported`/`skipped`/`needs_review`/`failed`, only a few still `pending`). Routing back through setup instead of `ImportProgress`/a "continue" path isn't data-corrupting (`runImportBatch`'s default `eligibleStatuses=['pending']` only reprocesses pending rows), but it's a real UX gap that compounds the category-override bug above — the user re-picks a category on every resume, unaware it silently only applies to the remaining rows.
  - Needed: split the condition — "batch never started" (all rows still `pending`) → `BulkImportSetup`; "batch interrupted" (any non-pending row exists) → `ImportProgress` or `ImportComplete`.

- **MEDIUM — Plan 07 is missing a `depends_on` edge on plan 10 despite requiring its output in the same wave.** Both are wave 5 (`19-07-PLAN.md` header: `wave: 5, depends_on: [19-04, 19-05, 19-06]`; `19-10-PLAN.md` header: `wave: 5, depends_on: [19-03, 19-04, 19-06]`). Plan 07's bulk "Import as New" (`19-07-PLAN.md:123`) calls the shared `importRowAsNew` seam whose signature plan 06 fixes but whose *body* — the post-commit photo step — plan 10 adds (`19-10-PLAN.md`'s stated purpose). Without an explicit `07→10` dependency edge, wave-parallel execution can verify/device-check plan 07's bulk Import-as-New before plan 10 has enriched the function body it calls, silently running that human-check against a photo-less `importRowAsNew`. Contrast with plan 11 (wave 6), which correctly lists `19-10` in `depends_on` for the identical reason.
  - Fix: add `19-10` to plan 07's `depends_on`, or state explicit intra-wave-5 ordering (10 before 07) in both plans.

- **MEDIUM (plan hygiene) — Plan 09 names the wrong app-root file in its mechanical `<files>`/artifact-list entries.** `19-09-PLAN.md` lines 11 (`files_modified`), 114 (`<files>`), and 152 (artifact list) all say `src/App.tsx` — this file does not exist (`ls src/App.tsx` → no such file; the real bootstrap file is `/App.tsx` at repo root, confirmed on disk). The plan's own operative `<action>` prose (lines 33, 95, 116, 124) correctly says `App.tsx` with no `src/` prefix, so an executor reading the action text carefully would land on the right file — but a tool or executor that treats the `<files>` tag as the literal edit target (a reasonable interpretation of that tag's purpose elsewhere in these plans) would look for a nonexistent `src/App.tsx`, risking either a failed read or a stray new file that never gets wired into the real app bootstrap. Given the resume-sweep registration this plan is responsible for is exactly the sort of thing that fails silently (the app still launches fine; it just never re-registers the sweep hook), this is worth a mechanical fix even though the prose is correct.
  - Fix: replace all three `src/App.tsx` occurrences with `App.tsx`.

- **LOW — Plan 07's single-import deterministic `already_linked` branch doesn't say where the user lands afterward.** `19-07-PLAN.md:145` specifies the terminal row write (`resolveAlreadyLinked` + `finalizeSessionIfTerminal`) correctly, but unlike the other two branches on the same screen (Link → implicitly stays; Import as New → `commitSingleImport` "navigates to the new contact / Unbound list" per `19-04-PLAN.md:119`), no navigation destination is stated for the "Already in Orbit" resolution. Session state is correct either way; this is a UX-completeness gap only.

- **LOW (cosmetic) — `BulkImportSetupScreen`'s selection count can go stale after plan 11's pre-batch consolidation.** After a `Combine` action resolves 2+ rows out of `pending` (`19-11-PLAN.md:23`), the setup screen's `N contacts selected` count (`19-06-PLAN.md:132`, "from sessionRowCounts or the row list") may still reflect the original `total_rows` rather than the post-consolidation pending count, depending on which source it reads. Not specified either way in the plan text.

## Suggestions

1. Add an `resolveImportStagingUri()` helper mirroring the existing `resolveRestorePendingUri` pattern, and route `ImportReviewScreen`'s photo preview through it instead of `Avatar`.
2. Persist `batch_category_id` at `BulkImportSetup` confirm (a DAO write, not just a nav param); have `runImportBatch`/`importRowAsNew` fall back to reading it from the session row.
3. Split plan 09's bulk resume condition into "never started" vs. "interrupted mid-run."
4. Add `19-10` to plan 07's `depends_on`.
5. Fix the three `src/App.tsx` → `App.tsx` references in plan 09.
6. State a navigation destination for plan 07's single-import `already_linked` branch.

## Risk Assessment

**MEDIUM.** The two HIGH findings are concrete and will ship broken behavior if plans execute literally (a render-time crash on the leading tracer slice, and a silent category-override data loss on common bulk paths), but both are narrow, well-scoped plan-text edits — no architectural rework, wave reshuffle, or ADR/HANDOFF reversal is implicated. The MEDIUM/LOW items are real but do not corrupt data or violate a locked decision.

## Cycle 3 — Verification Coverage (advisory, not counted toward totals)

| Symbol / claim | Status | Note |
|---|---|---|
| `Avatar` → `resolvePhotoUri` → `assertSafeRelative` throw chain | VERIFIED `src/components/Avatar.tsx:67`, `src/services/photos/photo-storage.ts:209`, `src/db/photo-relative-path.ts:20,33-41` | Confirms the plan-04 photo-preview HIGH |
| `SAFE_RELATIVE` regex scope (`avatars/<name>.<ext>` only) | VERIFIED `src/db/photo-relative-path.ts:20` | `import-staging/...` does not match |
| `resolveRestorePendingUri` existing precedent for a non-canonical staging resolver | VERIFIED `src/services/photos/photo-storage.ts:214-218` | Basis for the suggested fix |
| `import_sessions.batch_category_id` write sites across plans 01/04/06/07/08 | VERIFIED via grep across all 11 `*-PLAN.md` files | Confirms the durability gap: written once at accept-time only, never updated at setup-confirm |
| `App.tsx` (repo root) vs. `src/App.tsx` (does not exist) | VERIFIED `ls App.tsx` succeeds, `ls src/App.tsx` fails; `19-09-PLAN.md` lines 11/114/152 vs. 33/95/116/124 | Confirms the plan-hygiene MEDIUM |
| Plan 07/10 wave-5 `depends_on` headers | VERIFIED via direct read of both plan frontmatter blocks | Confirms the dependency-graph MEDIUM |
| Plan 11 `depends_on` includes `19-10` | VERIFIED `19-11-PLAN.md` frontmatter | No equivalent gap in plan 11 |
| `19-01-PLAN.md:40` Merge-restore assumption | VERIFIED directly | Cursor's LOW is already explicitly deferred/accepted, not outstanding |
| `src/db/transaction.ts` non-reentrant mutex contract | VERIFIED lines 12-23 | Matches all plans' stated composition pattern |
| `finalizeSessionIfTerminal` `failed==0` requirement | VERIFIED `19-01-PLAN.md:35,177,195-196` | Cycle-2/checker fix intact |
| `candidates_json` persistence | VERIFIED `19-01-PLAN.md:34,72`, `19-05-PLAN.md:27` | Cycle-2 HIGH 2 fix intact |
| `combineCluster` atomicity + `row_status='imported'` + birthday/photo | VERIFIED `19-11-PLAN.md:22-26,108` | Cycle-2 HIGH 3 fix intact |
| Plan 04 sole writer of `src/navigation/types.ts` | VERIFIED `19-04-PLAN.md:200` + grep across all plans | Checker nav fix intact |
| No import-flow code exists on disk yet (`src/services/import/*`, `import-session-dao.ts`, etc.) | VERIFIED via `find src -iname '*import*'` (no results) | Phase not yet executed; DAO/service claims verified for internal plan consistency only, not against implementation |
| `idx_external_contact_links_active` partial unique index | VERIFIED `src/db/migrations/011-contact-lifecycle-schema.ts:180` (Cursor's cited "line 180" matches) | |
| `normalizeContactMethod` fallback to `canonicalValue: null` without a default region | VERIFIED `src/logic/contact-method-normalization.ts:59` (Cursor cited 59-60, line 59 is the exact branch) | |
