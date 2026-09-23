# Privacy, Data Lifecycle, and Data Integrity Audit

## Audit Metadata

- **Audit date:** 2026-09-22 (workspace date).
- **Repository:** `orbit-app`.
- **Audited HEAD:** `0e04c27e1d82bc3b5069bbf5adfc72281155df69` — `docs(kb): record phase 38.1 extraction`.
- **Worktree:** clean at initialization and at the final evidence check before writing this report. This report is the only audit-authored change; no application, test, dependency, configuration, migration, or generated files were edited.
- **Concurrent work:** the final status check also showed an untracked `docs/audits/2026-09-pre-release/security/DOMAIN-AUDIT.md`. It was not created, read, or modified by this audit. HEAD and tracked application files remained unchanged.
- **Mode / domain code:** deep domain audit / `DPI`.
- **Requested output:** `docs/audits/2026-09-pre-release/data-privacy/DOMAIN-AUDIT.md`.
- **Protocol:** global `repo-audit` skill; repository instructions and current decisions govern intended behavior.
- **Execution:** read-only investigation, existing tests, and disposable in-memory reproductions. No device interaction, provider requests, commits, pushes, or worktrees.

## Executive Summary

**13 OPEN findings: five S1 Major and eight S2 Moderate.** No S0 finding is asserted.

The core SQLite mutation architecture is substantially protective: serialized write transactions, foreign keys, stable UIDs, deletion evidence, guarded purge, and loss-preserving custom-field type changes are implemented. The important failures occur where otherwise sound subsystems meet:

- Exported custom photos are not recognized by restore; merging independent contact/field populations can create a database whose next export cannot be restored.
- Restore chooses winners before acquiring its write transaction, allowing a newer committed local edit to be overwritten.
- Contact merge preserves photo paths without transferring their ownership, allowing a subsequently reused contact ID to overwrite or delete the survivor's photo.
- Imported notes inherit a general AI default despite the specific decision that imported notes begin AI-off.
- Permanent deletion does not cover all workflow snapshots, canonical image files, generated caches, and already-presented notifications.

Several failures were reproduced against current migrations and real in-memory SQLite. The broad existing persistence/import/photo test selection still passed **156 files / 1,469 tests**. Passing existing tests therefore does not establish the missing cross-subsystem invariants.

There is no implemented cloud synchronization system to assess. UID reconciliation is used for local backup restoration; optional backup encryption is implemented, but is not a cloud-sync/E2EE protocol. The audit does not treat hypothetical sync code as present.

## Scope

Included:

- Contact creation/editing, interactions and derived recency, group events, normalized contact methods, custom fields and retained history, Memories and relationships, archive/purge, and foreground retention sweeps.
- Android contact acquisition, durable import sessions, retry, source reconciliation, and contact consolidation.
- Versioned export, Merge and Replace-all restoration, tombstones, automatic SAF snapshots, optional encryption, secrets, and image/background recovery.
- AI consent and prompt projection, provider/native transport boundaries, OAuth and credentials, logs, local caches, notification/widget copies, and explicit clipboard/handoff paths.
- Migration bootstrap and integrity-sensitive data moves, supporting tests, current specifications, and repository analysis tooling.

Excluded: implementation of fixes; exhaustive visual/accessibility review; performance benchmarking; penetration testing of external services; actual user data; forensic recovery from flash/SQLite free pages; and speculative future sync/E2EE behavior. User-created external backups and receiving applications are outside Orbit's deletion control; findings about caches concern copies Orbit itself creates and owns.

## Repository Context Reviewed

`HANDOFF.md` was read first. Later decisions were used where they supersede its original design: normalized values (ADR-001), deliberate full-state backup and encryption (ADR-056–058), expanded contact knowledge, and current AI configuration/permissions.

Material authority included:

- ADR-009/010/015/016/018/021: migration atomicity, canonical recency, lossless field changes, atomic contact creation, archive-gated purge, and owned photo lifecycle.
- ADR-056–060/063/138/145: tombstone reconciliation, full-state portable backups, restore/encryption, normalized method and lifecycle portability, current v5/v6 format evolution.
- ADR-064–069/089–091: Android import, durable review/retry, source-only reconciliation, merge, knowledge lifecycle, retained values, and AI-off imported notes.
- ADR-049–052/078–081/107/117/135–139: credentials, restricted AI egress, current invocation/permission policy, Off Limits exclusion, and OAuth.
- ADR-124–129 and ADR-142/143: group parent/child identity and category deletion fallout.
- Relevant system docs: persistence core, contacts, custom fields, contact knowledge, photos, contact import/reconciliation, backup/restore, AI suggestions, notifications, and widget; relevant milestone-2 knowledge/AI dossiers and the source-reconciliation dossier.

The installed native Expo implementations were inspected where JavaScript API names alone could not establish notification dismissal or generated-file behavior.

## Methodology and Coverage

Four investigative tracks covered core persistence/lifecycle, backup/media, import/reconciliation/merge, and privacy/egress. Investigators read actual subsystem code, callers, shared-table writers, cleanup, tests, and current authority rather than limiting review to a diff. Candidate findings were checked against the working tree and governing decisions before admission; investigator severity suggestions were not treated as authority.

Sanctioned `npm run graph:ask -- governs …` queries included purge, migration runner, group events, backup service, reconciliation apply, and AI service. Returned governance was **INFERRED** from ADR Key-files lists, not claimed as code-authored citations. Supersession warnings guided document reading. No graph was rebuilt or edited. SQL writer discovery used repository searches because Graphify cannot enumerate writers embedded in SQL strings.

Validation:

- `npx vitest run src/db src/backup src/services/import src/services/photos src/services/field-sweep.test.ts src/services/memory-trash-sweep.test.ts --no-cache --reporter=dot`: **156 test files, 1,469 tests passed**, exit 0.
- Targeted investigators also exercised credential/transport/OAuth/AI projection checks. These supplement, rather than expand, the independently captured count above.
- No-file inline reproductions used the registered migration sequence through version 030, real in-memory `node:sqlite`, foreign keys enabled, and native adapters replaced at their filesystem/notification boundary. They confirmed custom-photo restore loss, missing global pairs, lost tombstone-only merges and later resurrection, missing restore-photo cleanup, merge ID reuse, multi-source birthday clearing, and the restore/staging write race.
- Native notification and image-cache findings are source-confirmed; physical-device behavior remains a verification requirement. Mocked photo bytes establish orchestration/data loss, not JPEG decoding or power-loss durability.

### Implemented lifecycle map

| Data / copy | Creation and persistence | Update / deletion / external boundary |
|---|---|---|
| Contacts, methods, knowledge, interactions | Private `orbit.db`; DAO-owned writes and composed transaction cores | Metadata/history edits; archive is reversible; purge removes canonical children and writes tombstones. Findings below identify missed noncanonical copies and merge seams. |
| Custom fields | Definition rows and durable raw-TEXT current pairs; optional retained-value history | Type changes preserve bytes; populated definitions quarantine; foreground expiry snapshots and deletes transactionally. |
| Import/reconcile work | Selected provider data copied into local durable session payloads and staging; reviewed-source snapshots | User-driven apply; no background provider sync. Photo retry and post-purge payload retention are defective. |
| Photos / backgrounds | App-private document masters and derivatives, plus temporary native cache outputs | Avatar paths derive from local contact identity; background templates have shared ownership. Restore journals recover committed file work. Several ownership/cleanup gaps are admitted below. |
| Portable backups | Versioned UID-keyed JSON with photo bytes, preferences, and tombstones | Explicit sharing or configured foreground SAF snapshots; optional authenticated encryption; previewed Merge / confirmed Replace-all. No cloud-sync transport. |
| Secrets | API keys and optional cached backup passphrase in SecureStore | Not included in ordinary exported SQLite settings; enabled encryption fails closed when its secret is unavailable. |
| AI requests | Explicitly invoked Compose generation, fresh restricted context, configured connection | Allowed data sent to chosen provider; imported-note creation incorrectly widens one permission gate. |
| Notifications / widgets | OS-owned scheduled/presented payloads and local photo-derived widget images | Private notification defaults; scheduled cancellation and widget refresh exist. Presented notification and generated-cache cleanup are incomplete. |
| In-memory / miscellaneous storage | Compose drafts and navigation state; small AsyncStorage preferences; public model catalog files | These are distinct from relationship backups. No active content-bearing telemetry/crash-reporting path was identified. |

## Findings Summary

| Severity | OPEN | INVESTIGATE |
|---|---:|---:|
| S0 Critical | 0 | 0 |
| S1 Major | 5 | 0 |
| S2 Moderate | 8 | 0 |
| S3 Minor | 0 | 0 |
| S4 Advisory | 0 | 0 |

All primary findings are C3 Confirmed at the repository level. Device verification requirements do not imply that source-proven control-flow omissions are speculative.

| ID | Severity | Finding |
|---|---|---|
| AUD-DPI-001 | S1 | Successful restore silently loses exported custom-field photos |
| AUD-DPI-002 | S1 | Merge omits required global custom-field pairs and creates unrestorable exports |
| AUD-DPI-003 | S1 | Restore applies stale winners over newer committed local writes |
| AUD-DPI-004 | S1 | Contact merge transfers photo references without safe asset ownership |
| AUD-DPI-005 | S1 | Imported notes inherit AI permission contrary to their mandatory off default |
| AUD-DPI-006 | S2 | Tombstone-only Merge discards deletion evidence |
| AUD-DPI-007 | S2 | Permanent contact purge retains sensitive import-session payloads |
| AUD-DPI-008 | S2 | Photo-only import failures cannot retry and lose their staged input |
| AUD-DPI-009 | S2 | Multi-source birthday selection writes NULL instead of the selected value |
| AUD-DPI-010 | S2 | Canonical photos survive deletion paths that omit ownership cleanup |
| AUD-DPI-011 | S2 | Generated image-cache copies survive successful photo removal |
| AUD-DPI-012 | S2 | Already-presented notifications survive permanent contact purge |
| AUD-DPI-013 | S2 | Manual export leaves unbounded app-owned snapshot copies in cache |

## Findings

### AUD-DPI-001 — Successful restore silently loses exported custom-field photos

**Severity:** S1 — Major  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DATA, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary
Ordinary exported custom-photo rows contain image bytes, but restore does not recognize them as photo targets. Both restore modes can report success while writing a NULL current value and restoring no image.

#### Expected Behavior / Invariant
ADR-057 requires full-state portability including photos; ADR-058 requires transactional restore and recoverable committed photo finalization. A successful export-to-restore roundtrip must preserve the custom photo.

#### Observed Behavior
Export removes metadata that restore requires to identify a custom-photo target. The bytes pass wire validation but are never staged or journaled.

#### Evidence
- `src/backup/export-manifest.ts:202–215`, `readManifest()`: destructures `fieldType`, `colName`, and local `contactId` away; a photo row becomes `value: null, photoBase64: <bytes>` plus its UID/parent UIDs.
- `src/backup/backup-schema.ts:973`: returns custom values without adding the missing target metadata.
- `src/backup/restore-apply.ts:996–1013`, `targetFor()`: requires `row.fieldType === 'photo'` and a string `row.colName`; `stageCandidates()` at 1063–1098 consequently skips ordinary exported custom photos.
- `src/backup/restore-apply.ts:862–870`: current-value upsert writes `r.value ?? null`.
- In-memory export/parse/restore reproduction: a row with `photoBase64` restored in both Merge and Replace-all with `status: applied`, zero photo staging calls, and stored `value: null`.
- Existing export coverage checks photo bytes in `src/backup/phase-17-integration.test.ts`; its roundtrip assertions do not establish restored custom-photo bytes/references.

#### Impact
The backup contains the image, yet recovery silently omits it. Replace-all can replace a usable current photo reference with NULL while presenting a successful restore.

#### Trigger / Preconditions
A nonempty custom field whose current type is `photo`, exported by the normal builder, then restored as a winning incoming row.

#### Remediation Direction
Resolve incoming photo targets from validated contact/definition identities and preserve bytes plus references, with truthful recoverable failure reporting.

#### Verification
Roundtrip actual exported manifests through parse and both restore modes; assert custom-photo content and references, including changed destination integer IDs and quarantined photo definitions.

#### Related Findings
AUD-DPI-002, AUD-DPI-010.

#### Planning Notes
Preserve portable UID identity and the journal's commit-before-finalization boundary. Adding tests only for hand-authored rows carrying the missing metadata would not verify the actual exporter contract.

### AUD-DPI-002 — Merge omits required global custom-field pairs and creates unrestorable exports

**Severity:** S1 — Major  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DATA, BUG, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary
Combining separately valid local and incoming graphs does not seed their new global contact-by-definition pairs. The next export succeeds, but restoring that export fails the pair-completeness guard.

#### Expected Behavior / Invariant
ADR-001 and normal field/contact creation preserve durable current pairs, including NULL values. Restore explicitly requires the complete global pair matrix.

#### Observed Behavior
Restore inserts incoming contacts and definitions directly, then applies only explicitly supplied value actions. It never fills the missing cross-product introduced by Merge.

#### Evidence
- `src/db/contacts-dao.ts:createContactFullCore()` seeds global pairs; `src/db/field-ddl.ts:createField()` seeds every existing contact. These establish the ordinary runtime invariant.
- `src/backup/restore-apply.ts:486–505`, `assertCompleteIncomingPairs()`, rejects missing global pairs in an incoming manifest.
- The same file's `upsertParents()`, `upsertContacts()` at 647–674, and `upsertChildren()` at 862–870 insert only planned rows; the committed union receives no equivalent pair completion.
- `src/backup/backup-schema.ts:672–680` validates supplied pair identities/parents, not completeness. `buildExportManifest()` therefore accepts the incomplete database.
- Reproduction: local database has one global definition and zero contacts; valid incoming backup has one contact and zero definitions. Merge returns applied, leaving `contacts=1, defs=1, values=0`. Export succeeds; its subsequent restore throws `restore manifest is missing a normalized custom-field value pair`.

#### Impact
A normal Merge can break the sole portable recovery path without warning. Missing NULL pairs also violate the explicit-clear/identity model.

#### Trigger / Preconditions
Merge introduces contacts absent locally while local global definitions exist, or introduces global definitions while local-only contacts exist.

#### Remediation Direction
Every committed merge must leave the required global pairs complete and the resulting export restorable, preserving existing pair UIDs and explicit NULL clears.

#### Verification
Test both graph-union directions, archived contacts and quarantined global definitions, then export and restore the merged result. Contact-scoped definitions must remain outside global fan-out.

#### Related Findings
AUD-DPI-001, AUD-DPI-006.

#### Planning Notes
Do not repair this by weakening the completeness guard or discarding stable pair identities. Existing affected databases may need a deliberate forward repair path.

### AUD-DPI-003 — Restore applies stale winners over newer committed local writes

**Severity:** S1 — Major  
**Confidence:** C3 — Confirmed  
**Scope:** Cross-cutting  
**Type:** DATA, RELIABILITY, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary
Restore calculates conflict winners before taking the shared write lock. A normal writer can commit during asynchronous staging, after which restore unconditionally applies its obsolete plan.

#### Expected Behavior / Invariant
ADR-056's newer-edit policy and Merge's promise to keep newer local data must apply to the authoritative state at commit, not an earlier unprotected scan.

#### Observed Behavior
The final transaction makes applying the old plan atomic, but does not make its earlier reads current.

#### Evidence
- `src/backup/restore-apply.ts:1350–1436`: settings, local rows and tombstones are read and reconciled outside the write mutex.
- `src/backup/restore-apply.ts:1455–1472`: photo/background staging is awaited before `inWriteTransaction()` begins; no revision/baseline revalidation follows.
- `upsertContacts()` at 647–674 unconditionally updates incoming metadata and `modified_at` on UID conflict.
- `src/screens/RestorePreviewScreen.tsx` uses a local `applying` state/navigation guard; `src/screens/backup-restore-logic.ts:createRestoreApplySingleFlight()` prevents duplicate restore calls, not ordinary writers.
- `src/services/notifications/notification-actions.ts:handleNotificationAction()` can call `snoozeContact()` independently; `src/db/snooze-dao.ts` uses the ordinary shared transaction.
- Reproduction injected the real snooze DAO into photo staging. A September 22 snooze committed over a September 20 local row before applying a September 21 backup. Restore then reset `snooze_until` to NULL and moved `modified_at` backward to September 21, while the September 22 immutable snooze event survived.

#### Impact
Newer successfully saved state is silently lost; history and current state can disagree. The problem is broader than the reproduced snooze field because the stale plan covers entities, tombstones, and settings.

#### Trigger / Preconditions
A local writer commits after restore's planning reads and before its transaction. Photo staging creates an explicit asynchronous window; notification/headless actions are a concrete independent writer.

#### Remediation Direction
Restore must use a consistent authoritative state through conflict resolution and commit, or detect intervening changes and replan/refuse coherently.

#### Verification
Interleave real DAO edits, deletions, and settings changes during staging and lock acquisition. Newer commits must survive or produce a truthful retry/refusal. Device-test the notification entry path separately.

#### Related Findings
AUD-DPI-006; other restore findings share the apply boundary but have distinct causes.

#### Planning Notes
Preserve the non-reentrant mutex rule and durable file journal. Do not acquire a lock around callbacks that reacquire the same lock.

### AUD-DPI-004 — Contact merge transfers photo references without safe asset ownership

**Severity:** S1 — Major  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DATA, PRIVACY, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary
An absorbed contact's photo can remain referenced under its retired integer ID. SQLite can reuse that ID, allowing a later unrelated contact's photo operation to overwrite or delete the survivor's image. A sole absorbed main photo is also omitted when no explicit conflict choice is emitted.

#### Expected Behavior / Invariant
ADR-021 ties media ownership/cleanup to target identity. ADR-069 and `docs/dossier/20-contact-reconciliation-merge.md:408–419` (Cluster W) require merge to combine non-conflicting fixed-field data, including photos, without losing retained information.

#### Observed Behavior
Merge transfers relative strings without transferring files into the survivor's ownership model; main-photo adoption occurs only when an explicit absorbed choice is supplied.

#### Evidence
- `src/db/merge-dao.ts:307–352,405–418`: custom values are copied/reparented verbatim, including photo paths.
- `src/db/merge-dao.ts:483–489`: selected main-photo `relative` is passed unchanged to `setContactPhotoCore()`; at 533–535 the absorbed contact is deleted.
- `src/db/contacts-dao.ts:968–983` checks relative-path safety, not ownership identity.
- `src/services/photos/photo-storage.ts:86–116` derives `avatars/contact-<id>.jpg` and custom `cv-<id>-<field>.jpg`; `photo-pipeline.ts:103` persists to the derived target.
- `src/screens/MergeConflictsScreen.tsx:137,152–157` treats photos as a conflict only when both exist and forwards an absorbed photo only for that explicit choice. The DAO's scalar auto-combine list excludes photo.
- Real SQLite reproduction: merge contact 2 into contact 1 choosing contact 2's photo; contact 1 retains `avatars/contact-2.jpg`. Creating another contact reuses ID 2. Its derived save/purge target is the survivor's currently referenced file.

#### Impact
Later unrelated photo writes can silently corrupt the survivor's image; later purge can delete it. Conversely, purging the survivor misses the absorbed-ID file. Sole-absorbed main photos can become inaccessible immediately after merge.

#### Trigger / Preconditions
Merge retains an absorbed main/custom photo path; ID reuse exposes the subsequent corruption. A survivor with no main photo and an absorbed contact with one triggers the separate omission immediately.

#### Remediation Direction
Merging must preserve selected/non-conflicting photo content with ownership that remains safe under future creation, replacement, and deletion of either identity.

#### Verification
Test main and custom photos, sole-absorbed photos, ID reuse, replacement/purge of the new contact, and purge of the survivor. Confirm actual bytes, not only relative strings.

#### Related Findings
AUD-DPI-010, AUD-DPI-011.

#### Planning Notes
This crosses the database/filesystem boundary. Retain crash safety and reference protection; changing the documented filename strategy is an owner decision if proposed.

### AUD-DPI-005 — Imported notes inherit AI permission contrary to their mandatory off default

**Severity:** S1 — Major  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** PRIVACY, DATA, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary
Enabling the general default for new Memories also enables AI use of subsequently imported Android notes, without the import-specific opt-in required by ADR-091.

#### Expected Behavior / Invariant
`docs/decisions/ADR-091-imported-contact-notes-as-ai-off-typed-memories.md:18–23` requires stored imported-note `allow_ai=0` and rejects automatic enabling. ADR-136 adds general defaults but does not explicitly supersede this exception. The AI dossier, `docs/dossier/milestone-2/phase-16-ai-configuration-prompting-dossier.md:687`, makes defaults subject to owning Contact Knowledge metadata; `docs/dossier/milestone-2/phase-03-contact-knowledge-foundation-dossier.md:147,171,201` retains imported-data AI-off rules.

#### Observed Behavior
Imported Memories use the same general default resolver as ordinary new Memories, regardless of imported type/provenance.

#### Evidence
- `src/db/imported-contact-dao.ts:142–150` calls `addMemoryCore()` with `type: 'imported'`, `provenance: 'import'`, and raw note text, without an off override.
- `src/services/import/source-consolidation.ts:combineCluster()` uses the same Memory core for consolidated imports.
- `src/db/memories-dao.ts:106–130` resolves `resolveNewItemAiDefault(exec, 'memory')` and inserts that value as `allow_ai`.
- `src/db/ai-permissions-dao.ts:121–134` returns `ai_default_memory_allow`.
- `src/db/memories-read.ts:31,68–80` admits live `allow_ai=1` rows; `src/db/ai-context-read.ts:239–255` places their values in shared AI context with no imported-type exclusion.
- Counter-evidence considered: general defaults deliberately affect new items. That broad rule does not explicitly reverse the narrower imported-note decision; no such owner reversal was found.

#### Impact
Sensitive notes imported from another application can enter a later AI request without the per-item permission state promised for imported data.

#### Trigger / Preconditions
Set ordinary Memory defaults ON, import a new contact containing a note, then explicitly invoke AI generation for that contact through a configured/enabled connection. This is not a claim of automatic generation or transmission during import.

#### Remediation Direction
Imported notes must begin AI-off independently of ordinary Memory defaults; preserve deliberate later per-item enabling.

#### Verification
Exercise single, bulk, and consolidated imports with the general default ON. Assert stored permission is zero and context excludes the imported note until explicitly enabled.

#### Related Findings
AUD-DPI-007 concerns another retained copy of the same imported note, not the same defect.

#### Planning Notes
Existing imported rows may already have enabled flags. Distinguishing unintended defaults from deliberate later opt-ins is an owner privacy-posture decision; do not silently blanket-reset existing permissions or reinterpret ADR-091.

### AUD-DPI-006 — Tombstone-only Merge discards deletion evidence

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DATA, PRIVACY, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary
A Merge with new deletion evidence but no live-row/settings changes returns success before importing the tombstones. A later older backup can resurrect the deleted entity.

#### Expected Behavior / Invariant
ADR-056 explicitly rejects omitting deletion evidence because it permits resurrection. New/newer tombstones are durable changes even when no current visible row exists.

#### Observed Behavior
The no-op calculation counts live entity mutations and settings only.

#### Evidence
- `src/backup/reconciliation.ts:510–513`: a tombstone with no local live row becomes a `retain` action without a row.
- `src/backup/restore-apply.ts:1437–1454`: zero insert/update/delete counts and non-newer settings return `status: applied` immediately.
- `importTombstones()` is reached only at `src/backup/restore-apply.ts:1537`.
- Reproduction merged an unseen contact tombstone with equal settings: success, but local tombstones remained empty. A subsequent older snapshot containing that UID inserted the contact again.

#### Impact
Deletion intent is silently lost across manual backup reconciliation; old sensitive content can return.

#### Trigger / Preconditions
Incoming new/newer tombstones require no current live-row deletion and no other planned mutation forces the apply transaction.

#### Remediation Direction
Successful Merge must durably incorporate relevant deletion evidence independently of visible-row changes.

#### Verification
Merge tombstone-only and newer-tombstone-only inputs, inspect persisted evidence, then try older live snapshots. Include child and parent entity types and timestamp ties.

#### Related Findings
AUD-DPI-003, AUD-DPI-010.

#### Planning Notes
Preserve indefinite typed tombstones and the accepted comparison policy. There is no need to introduce synchronization to fix the existing restore path.

### AUD-DPI-007 — Permanent contact purge retains sensitive import-session payloads

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** PRIVACY, DATA  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary
Deleting the canonical contact and imported Memory does not delete the original durable Android import payload, including its freeform note.

#### Expected Behavior / Invariant
Permanent whole-contact deletion must cover app-owned copies of that contact's sensitive data. ADR-065's pending-review/retry durability does not authorize indefinite survival after contact purge; no explicit exception was found.

#### Observed Behavior
Import rows lose their contact references through SET NULL while retaining their content. Completed sessions have no purge/retention path that removes these now-detached payloads.

#### Evidence
- `src/services/import/import-acquire.ts` persists selected display name, methods, birthday, and note in `source_payload` through the session DAO.
- `src/db/migrations/012-import-sessions.ts:41–43`: contact and matched-contact references use `ON DELETE SET NULL`.
- `src/db/purge-dao.ts:PURGE_CHILDREN` and `purgeContact()` remove canonical children and `field_history`, but do not remove or redact import-session payloads.
- `src/db/import-session-read.ts:getResumableSession()` scans pending sessions only.
- `src/db/import-session-dao.ts:discardSession()` deletes NULL-linked rows only when that particular session is discarded; normal completed sessions are not swept. `completeSessionCore()` only changes status.

#### Impact
Original third-party information remains readable in the private database after a successful permanent deletion, even when its user-visible imported Memory has been purged.

#### Trigger / Preconditions
Import a contact with sensitive source data, complete the session, archive and permanently purge that contact.

#### Remediation Direction
Purge must remove/redact the contact's sensitive workflow copies while preserving unrelated unresolved work and any narrowly justified non-content deletion evidence.

#### Verification
Use a unique marker in imported notes/methods; complete import and purge, then inspect all workflow tables. Cover already-linked snapshots and consolidation/merge origins, not just directly linked successful imports.

#### Related Findings
AUD-DPI-005, AUD-DPI-008, AUD-DPI-013.

#### Planning Notes
This finding does not prescribe a general completed-session retention duration. Coordinate with retry and review requirements before changing session lifetimes.

### AUD-DPI-008 — Photo-only import failures cannot retry and lose their staged input

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DATA, RELIABILITY, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary
When contact creation succeeds but photo mastering fails, the record remains `imported`, so neither retry nor staging retention recognizes the remaining work.

#### Expected Behavior / Invariant
ADR-065 and `docs/systems/photos.md:98` require failure-isolated photo import that retains staged input for Retry without rolling back or duplicating the contact.

#### Observed Behavior
`photo_failed` is separate from row status, but the retry UI, driver, session completion, and orphan sweep classify liveness by row status/contact existence alone.

#### Evidence
- `src/services/import/import-driver.ts:89–119`: commits the contact/row before attempting the photo and marking photo failure.
- `src/services/import/import-photo.ts:persistImportedPhotoPostCommit()` catches photo errors and retains staging on failure.
- `src/db/import-session-dao.ts:markRowPhotoFailedCore()` sets only `photo_failed`; `finalizeSessionIfTerminal()` regards `imported` as terminal.
- `src/screens/ImportCompleteScreen.tsx:64,89–92`: Retry appears for `rawCounts.failed`, then processes pending/failed statuses only. `runImportBatch()` skips rows whose `contactId` is already non-null.
- `src/services/import/contact-import-resume-sweep.ts:93–108`: only pending/needs_review/failed rows protect staged paths; imported photo failures are deleted as orphans.
- Existing completed-staging cleanup coverage does not establish survival of a completed contact with unfinished photo work.

#### Impact
The user gets a successful contact import without a working photo retry; the retained source needed for recovery is deleted on a later foreground sweep.

#### Trigger / Preconditions
Post-contact image decoding, persistence, or photo-column update fails. Single and consolidated paths share the same state mismatch.

#### Remediation Direction
Represent unfinished photo work consistently across completion, retry, and cleanup; preserve its source until success or deliberate discard.

#### Verification
Inject each post-contact failure, foreground/restart, retry, and confirm exactly one contact plus a restored photo. Successful/discarded staging must still be cleaned.

#### Related Findings
AUD-DPI-007, AUD-DPI-011.

#### Planning Notes
Keep the deliberate separation between successful contact creation and failure-prone image work. A batch-wide rollback would reverse the intended failure isolation.

### AUD-DPI-009 — Multi-source birthday selection writes NULL instead of the selected value

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DATA, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary
When linked source contacts contain different birthdays, choosing either displayed source option clears the saved birthday instead of applying that option.

#### Expected Behavior / Invariant
ADR-068's deliberate source-only reconciliation and the multi-source review contract require an explicit choice to preserve the selected source identity/value through application.

#### Observed Behavior
Every displayed source option has the same ID. Apply sends the classifier's aggregate scalar, which is NULL when there are several distinct options.

#### Evidence
- `src/logic/reconcile-diff.ts:172`, `classifyScalar()`: `sourceValue` is populated only when `sourceOptions.length === 1`.
- `src/screens/ReconcileDetailScreen.tsx:148`, `ChoiceRow()`: every source option is assigned `id: 'source'`.
- The same screen at 117–120 constructs selections using `field.sourceValue`, not a selected option's value; at 130–136 it resolves the card/reports success.
- `src/db/reconcile-apply.ts:159–165`: a selected NULL birthday maps to NULL storage; the old birthday is snapshotted before the update.
- Real classifier/apply reproduction: local `1990-01-01`, sources `1991-01-01` and `1992-01-01`; selecting the source branch yields `contacts.birthday = null`. The old value remains only in bounded `field_history`.

#### Impact
Explicit review silently removes valid live data and can suppress birthday behavior. Distinct name options also cannot be selected accurately, though the confirmed birthday loss is the primary consequence.

#### Trigger / Preconditions
One Orbit contact has multiple external source links with different birthdays, as supported after source consolidation/contact merge.

#### Remediation Direction
Retain distinct option identity and the selected value through UI, apply, and reviewed-source snapshot writes; do not equate ambiguity with an explicit clear.

#### Verification
Select each different source birthday independently, keep Orbit, and exercise blank-local and conflicting-local cases. Inspect stored birthday and reviewed snapshots after each choice.

#### Related Findings
AUD-DPI-004 shares the contact-merge entry path but has a separate cause.

#### Planning Notes
The bounded destructive-operation history is not a user-facing recovery mechanism. Preserve scalar stale-baseline checks while correcting selection transport.

### AUD-DPI-010 — Canonical photos survive deletion paths that omit ownership cleanup

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Cross-cutting  
**Type:** PRIVACY, DATA  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary
Restore tombstone deletes and custom-field lifecycle changes can remove the information needed to discover a photo without scheduling deletion of its canonical file.

#### Expected Behavior / Invariant
ADR-021 requires best-effort replace/remove/purge cleanup; ADR-058 provides durable restore cleanup. A structural omission of cleanup is different from an attempted filesystem operation failing.

#### Observed Behavior
Restore's intended photo-delete branch is unreachable for ordinary row-less delete actions. Normal contact purge discovers custom files only from definitions that still exist and still have photo type.

#### Evidence
- `src/backup/reconciliation.ts:510–513` emits delete actions without a `row`.
- `src/backup/restore-apply.ts:1073` skips actions without a row before the deletion branch at 1085; SQL `deleteActions()` still runs at 1532–1534, without normal purge extensions.
- Real restore reproduction: contact tombstone applied, contact removed, but native delete calls and `restore_photo_journal` both remained empty.
- `src/services/photos/purge-photo-cleanup.ts:67–107` derives main paths from ID and custom paths only from surviving definitions with `type === 'photo'`.
- `src/db/field-type-change.ts:applyTypeChange()` correctly preserves raw values; changing photo to text before purge therefore leaves a file that the purge enumerator skips.
- `src/db/field-ddl.ts:dropFieldValues()` deletes definitions/values but has no file cleanup; its trailing comment explicitly acknowledges remaining custom-photo orphans. That implementation comment is not an owner-approved exception.
- `src/services/photos/photo-storage.ts:484–531` reconciles swap sidecars, not unreferenced canonical avatar files.

#### Impact
App-owned sensitive images persist after their canonical data has been permanently deleted; later normal purge cannot reliably rediscover them.

#### Trigger / Preconditions
Merge restoration applies a photo-bearing contact/value/definition tombstone; or a populated custom-photo field changes type/is permanently deleted before contact purge.

#### Remediation Direction
Discover actual affected ownership before deleting references and retain recoverable cleanup work. Delete only files proven no longer owned.

#### Verification
Cover direct and cascaded restore deletes, photo-to-text then purge, definition expiry, interrupted cleanup, and shared/merged references. Assert files and journals, not just SQL absence.

#### Related Findings
AUD-DPI-004 causes another canonical ownership mismatch; AUD-DPI-011 concerns additional cache copies.

#### Planning Notes
Keep raw-text preservation and accepted cancel-path safety. Do not erase a file merely because its field's current type no longer says photo.

### AUD-DPI-011 — Generated image-cache copies survive successful photo removal

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** PRIVACY, DATA  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary
The photo pipeline and widget renderer create native cache JPEGs that are never retired. Removing/purging the document master leaves these recognizable copies until discretionary OS eviction.

#### Expected Behavior / Invariant
ADR-021 rejects retaining original/thumbnail pairs in favor of one bounded master. `src/components/PhotoSourcePicker.tsx:87` promises that Remove deletes the photo from the device. Temporary processing must not create unmanaged durable-by-default copies outside that lifecycle.

#### Observed Behavior
The cache URI produced during encoding is copied or ignored, not deleted, including successful operations. A widget request for base64 also creates a file.

#### Evidence
- `src/services/photos/photo-pipeline.ts:85–104`: `saveAsync()` returns `out.uri`; it is copied into the document master and then forgotten.
- `src/services/widget/widget-photo.ts:65–78`: `saveAsync({base64:true})` returns the thumbnail but the renderer uses only base64.
- Installed `node_modules/expo-image-manipulator/android/src/main/java/expo/modules/imagemanipulator/ImageManipulatorModule.kt:113–137` opens `FileOutputStream(path)` regardless of `base64`; `FileUtils.kt:9–12` generates `cache/ImageManipulator/<UUID>.jpg`.
- Remove/purge calls delete document masters; `src/services/photos/photo-storage.ts:450–453,515–531` deletes/reconciles under the document directory. No production cleanup of these ImageManipulator cache files was found.
- `docs/systems/photos.md:78` claims widget encoding writes no additional file; the installed native implementation disproves that assumption.

#### Impact
Photo copies survive successful deletion, and repeated widget rendering accumulates additional sensitive thumbnails. This is private-sandbox retention, not evidence of network disclosure.

#### Trigger / Preconditions
Crop/save or render a widget image, then remove/purge the photo/contact. Ordinary successful operations suffice.

#### Remediation Direction
Give app-generated temporary derivatives explicit bounded lifetimes and failure/restart cleanup consistent with photo deletion promises.

#### Verification
On Android, enumerate cache files before/after crop, import, widget refresh, remove, and purge. Test unsuccessful encoding/copy as well as success and restart. Do not rely on OS cache pressure as the cleanup policy.

#### Related Findings
AUD-DPI-010, AUD-DPI-013.

#### Planning Notes
This is logical file lifecycle cleanup, not a forensic secure-erasure requirement. Preserve the accepted crash-recovery sidecars and files still needed by active operations.

### AUD-DPI-012 — Already-presented notifications survive permanent contact purge

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** PRIVACY, DATA  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary
Purge cancels future alarms but does not dismiss reminders already shown by Android. Deleted contact information can remain in the notification shade.

#### Expected Behavior / Invariant
Permanent deletion should retire contact-specific app-owned OS presentation copies as well as future schedules. Private notification defaults limit exposure but do not satisfy deletion.

#### Observed Behavior
The cleanup adapter calls only scheduled-cancellation APIs. Presentation is a separate native lifecycle.

#### Evidence
- `src/screens/ArchivedContactsScreen.tsx:149–173` installs the post-commit notification cleanup.
- `src/services/notifications/purge-notification-cleanup.ts:40–60` invokes `cancelScheduledNotificationAsync` for the contact's decay/birthday identifiers.
- Installed `node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoSchedulingDelegate.kt:92–96` removes the alarm and stored request only.
- `ExpoPresentationDelegate.kt:143–154` separately dismisses shown notifications through NotificationManager cancellation.
- `src/services/notifications/notification-schedule.ts:376–381` also reconciles schedules only. No production dismissal path was found; dismissal calls in developer probes are not production cleanup.
- `autoDismiss` handles notification interaction, not opening the application separately and purging through its UI.

#### Impact
A deleted contact's name/reminder or birthday information can remain visible in the notification shade, and potentially on a public lock screen when previously opted in.

#### Trigger / Preconditions
A reminder has already been delivered; the user opens Orbit through another entry point, then archives and purges the contact without tapping/dismissing that reminder.

#### Remediation Direction
Retire both scheduled and presented notifications belonging to the deleted contact while preserving unrelated notifications.

#### Verification
Deliver a reminder, enter via app icon, purge, and inspect Android's presented-notification list and shade. Include restart/failure handling and private/public channel settings.

#### Related Findings
AUD-DPI-007, AUD-DPI-010, AUD-DPI-011 concern other copies outside the canonical row graph.

#### Planning Notes
Keep OS cleanup post-commit and idempotent. This does not propose changing the owner's lock-screen privacy policy.

### AUD-DPI-013 — Manual export leaves unbounded app-owned snapshot copies in cache

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** PRIVACY, DATA  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary
Every manual export creates a timestamped internal cache file with the full snapshot. Neither completion nor failure retires it, and no app cleanup policy covers the directory.

#### Expected Behavior / Invariant
Explicit export authorizes a user-controlled backup and share operation. Its temporary app-owned staging copy needs a bounded lifecycle; permanently deleted source content should not survive indefinitely in forgotten internal exports. This is separate from intentionally retained external backups.

#### Observed Behavior
The local-file abstraction exposes create/write/read only. Readable exports remain plaintext in cache even when sharing is unavailable, fails, or is dismissed, and after subsequent source-data deletion.

#### Evidence
- `src/services/backup/share-export.ts:12–30` creates `Paths.cache/backup-exports/orbit-backup-<timestamp>.json` with no removal operation.
- `src/services/backup/backup-service.ts:335–343` defines the file interface without cleanup.
- `createManualExportService()` at 392–457 writes and verifies the entire snapshot before checking share availability; its `finally` resets only `inFlight`.
- Repository search found no other production consumer/sweep for `backup-exports`. Automatic SAF retention operates on a different namespace and does not cover these files.
- Enabled encryption protects exports unless a readable override is explicitly chosen; this finding does not claim an encryption bypass. Default/readable manual exports are the concrete plaintext case.

#### Impact
Old complete relationship datasets, notes, and photo bytes accumulate inside Orbit's cache and outlive later deletion or replacement of the canonical database, until the OS happens to evict them.

#### Trigger / Preconditions
Create a readable manual export. Successful sharing is not required; the file already exists before share availability is checked.

#### Remediation Direction
Define and enforce a bounded lifecycle for app-owned export staging on success, failure, cancellation, and restart, allowing a receiving application the time it legitimately needs to read the shared file.

#### Verification
Exercise successful, unavailable, failed, and dismissed sharing; inspect `backup-exports` after the appropriate lifecycle boundary and after restart. Verify no stale readable snapshot remains beyond the chosen policy and encrypted export behavior remains intact.

#### Related Findings
AUD-DPI-011 shares unmanaged temporary-file retention; AUD-DPI-007 concerns independent SQLite copies.

#### Planning Notes
Do not delete user-selected external backup files as part of contact purge. The exact safe sharing grace period belongs in implementation/platform verification, not an arbitrary audit prescription.

## Cross-Finding Patterns

1. **Local correctness does not establish roundtrip correctness.** Export, parser, reconciliation, and restore each have tests, but disagree about custom-photo metadata and the merged global pair matrix. Actual exporter-to-restorer fixtures are essential.
2. **A write transaction cannot validate reads taken before it.** The stale restore plan is atomic when applied, yet violates its conflict policy because a newer writer can commit first.
3. **Identity crosses more than foreign keys.** Photo filenames encode local integer identity, while merge operates on logical contact identity. References can remain syntactically valid but point at another identity's future storage.
4. **Deletion must inventory all copies.** Canonical rows, import payloads, photo masters, cache derivatives, internal export files, and OS notifications have different owners and cleanup APIs. Current purge mostly inventories the first category.
5. **Generic defaults can erase narrower consent rules.** The central Memory writer obeys the general default but fails to preserve the imported-note exception. Privacy specifications need to be exercised at creation as well as at prompt selection.
6. **Workflow liveness is multidimensional.** A successfully imported contact can still have unfinished photo work; a Merge with no visible row mutations can still contain new deletion evidence.

## Reviewed Areas With No Material Findings

These statements describe the reviewed contracts, not a guarantee that every possible path is defect-free:

- **Core transactions and migration control:** connection PRAGMAs precede migration transactions; schema changes and version increments commit together; failure rolls back. Integrity-sensitive normalized-value copying and contact-table rebuilds include preservation checks. The current registered migration/test sequence passed.
- **Canonical recency:** ordinary interaction create/edit/delete and group-event fan-outs use shared recency cores; modifying or deleting older interactions does not use a naive last-write-wins recency assignment.
- **Ordinary create/edit composition:** contact metadata, initial interaction, normalized values, and supplied knowledge/method work share one outer transaction. Bulk import intentionally isolates each contact rather than pretending the whole batch is atomic.
- **Guarded deletion and loss-preserving types:** canonical contact purge requires archived state under its transaction; type changes leave raw values intact; populated-field quarantine and trash expiry recheck staleness under the write lock; destructive current-value snapshots and relevant canonical tombstones are written transactionally.
- **Group events:** canonical per-contact children, membership uniqueness, explicit dissolve/delete behavior, parent-only group notes, and same-group contact-merge refusal are implemented. Empty surviving group parents are intentional rather than automatically treated as orphan corruption.
- **Contact reconciliation:** source updates are user-triggered, missing sources are distinguished from empty values, scalar baseline checks protect reviewed values, and relinking checks active-link collisions. The admitted multi-source selection defect is distinct from those protections.
- **Backup boundaries:** non-secret export uses explicit projections and a mutex-held read snapshot; secrets and device-local SAF health are excluded; optional encryption authenticates payloads and fails closed when enabled credentials are absent. Committed photo/background recovery uses durable evidence rather than treating every staged file as authorized to finalize.
- **AI transport and prompts:** restricted context projection excludes Off Limits and Group Notes; Memory/custom-field/interaction-note permissions gate eligible context; Compose rechecks current permissions for Message Focus. The imported-note defect is at creation of permission state, not an absence of the downstream gate.
- **Credentials and native transport:** SecureStore credential boundaries, endpoint-bound custom credentials, public-HTTPS custom transport checks, disabled redirects/proxies, sanitized provider errors, and OpenRouter PKCE/state/loopback callback handling were reviewed without another admitted finding.
- **Logging and ordinary reads:** Logger defaults off with no runtime enable call found; no active contact-content telemetry/crash-reporting path was identified. Dashboard and local image reads do not acquire a network dependency. Public model catalogs are not contact data.

## Accepted / Deferred / Rejected Candidates

- **ACCEPTED — readable backups and optional encryption.** ADR-058 explicitly rejects mandatory encryption. Plaintext in a user-selected external backup is not itself a defect; AUD-DPI-013 concerns forgotten internal staging copies.
- **ACCEPTED — permanent tombstones and bounded destructive history.** ADR-056 retains typed deletion evidence indefinitely. `field_history` is a bounded local audit trace, not a backup/recovery UI. These are not generic over-retention findings.
- **ACCEPTED — custom-photo cancel tradeoff.** `docs/systems/photos.md:146` explicitly records that cancelling an edit can leave changed bytes beneath the previous stable reference, favoring retention over deleting a potentially committed image. This was not promoted into a new OPEN finding. It does not authorize omitted cleanup after permanent deletion.
- **ACCEPTED — foreground-only automatic backup/sweeps.** They run on real foreground launches, not through a background scheduler. This is deliberate, not an offline reliability defect.
- **ACCEPTED — Android backup opt-out.** ADR-012 and release configuration disable Android-managed backup. This audit does not propose reversing that privacy posture or treating the lack of cloud backup as a defect.
- **ACCEPTED — deliberate explicit egress.** Configured AI invocation, user-requested image URL acquisition, explicit handoff/clipboard actions, and user-controlled export are implemented exceptions to an oversimplified reading of the original local-only handoff. They were assessed against current decisions rather than classified categorically as leaks.
- **DEFERRED — contact-scoped custom-field creation.** ADR-090 and runtime guards defer the complete ownership/lifecycle/UI package; its absence is not a current bug. Global pair findings preserve that distinction.
- **DEFERRED / NOT IMPLEMENTED — cloud sync and sync E2EE.** Future-sync comments in UID reconciliation do not create an implemented service. Backup encryption was audited on its own terms.
- **FALSE-POSITIVE — widget base64 necessarily means no file.** Installed native code disproves this assumption; the resulting retention is admitted as AUD-DPI-011.
- **FALSE-POSITIVE — successful existing tests prove end-to-end backup fidelity.** Existing tests exercise many valid local contracts but omit the reproduced exported-photo and graph-union cases.

## Coverage Limitations / Follow-up Investigation

- No physical Android device, native build, OEM transfer experiment, real SAF provider, external AI provider, or power-loss test was used. Native source establishes specific omissions; downstream device checks should validate cache cleanup, notification dismissal, share-file lifetime, photo byte ownership, and filesystem recovery.
- Encryption review inspected implementation, envelope validation, key storage, and lifecycle contracts; it is not an independent cryptographic certification. Optional encrypted backup is not E2EE synchronization.
- The audit covers logical deletion of application-owned records/files. It does not establish forensic erasure of old SQLite pages, WAL contents, flash blocks, system notification history, clipboard history, or copies a user deliberately exported to another application.
- Migration evidence covers the current registered code, tests, and major preservation-sensitive transitions. It does not certify every historical APK database or recoverability of arbitrary externally corrupted files. No shipped migration was changed.
- Additional bounded lead: the API-37 picked-contact native reader appears to accept Event MIME values without the legacy reader's birthday subtype check. The provider/picker's exact returned event population needs device/API-contract verification before admitting a birthday-import finding.
- Additional bounded lead: reconciliation emits `unchanged-since-review` fields and the UI does not obviously suppress them. Repeated review behavior needs a focused workflow check against ADR-068; no separate primary finding is asserted here.
- Stale-state behavior across every mounted screen/store after Replace-all was not exhaustively exercised. The confirmed restore write race is covered by AUD-DPI-003; it should not be mistaken for a complete UI-cache invalidation certification.
- This report records defects and desired invariants. It does not select fixes, reverse recorded decisions, assign implementation phases, or estimate effort.
