# AUDIT FINDINGS — Session B (reconciliation / restore atomicity / photos / encryption)

Audit scope: Phase 17 plans were checked against the source tree as it exists today. This is a plan audit, not an implementation review. The findings below identify cases where the planned behavior cannot meet the locked decisions or where it can lose/corrupt the user's only local copy.

## Reconciliation core

### 1. A valid restored entity is rejected as a “duplicate UID” on the next export/restore

**SEVERITY: HIGH**

**LOCATION:** plan [17-04](17-04-PLAN.md:72) and [17-05](17-05-PLAN.md:68), [17-08](17-08-PLAN.md:72); real schema [001-initial.ts](../../../../src/db/migrations/001-initial.ts:61).

**FAILURE SCENARIO:** Contact `C` is deleted at `10:00:00`, leaving the indefinitely retained D-01 tombstone. A genuinely newer incoming contact row for `C` at `10:00:01` restores it, as D-03 expressly permits. The resulting database legitimately has both `contacts.uid = C` and `tombstones(entity_type='contact', entity_uid=C)`. Export includes both. The plans repeatedly require “duplicate UID rejection” without scoping it, so the next parser can reject this valid state or discard one side before the D-03 comparison. Either behavior reverses D-03.

**FIX:** Define independent uniqueness domains: live-row `uid` is unique within each entity array; tombstones are unique by `(entity_type, entity_uid)`. Permit one live row plus one tombstone for the same logical entity and always feed both to the one timestamp/tie-break helper. Reject duplicates only within the same live-row domain or tombstone domain. Add export → parse → Merge tests for older tombstone/newer row, equal timestamps, and newer tombstone.

### 2. Required children can be inserted under a parent that reconciliation deleted

**SEVERITY: HIGH**

**LOCATION:** plan [17-04](17-04-PLAN.md:75), [17-08](17-08-PLAN.md:89); real FK schema [001-initial.ts](../../../../src/db/migrations/001-initial.ts:84) and [006-normalize-custom-field-values.ts](../../../../src/db/migrations/006-normalize-custom-field-values.ts:41).

**FAILURE SCENARIO:** A syntactically valid backup contains contact `C` and interaction `I(contactUid=C)`. Locally, `C` has a newer tombstone. The plan only supplies a fallback for *nullable* UID references, but interaction/link/fuel/event parents and both custom-value parents are mandatory. A UID-only child decision can return `insert I` even though `C` does not survive. Apply then fails on the FK, or an implementer invents/revives the parent—both violate D-02, D-03, and D-05. The same failure occurs when the incoming parent loses to a tombstone in the same file.

**FIX:** Make mandatory-parent survival a first-class reconciliation result. Reconcile parents first, compute final surviving parent UIDs, then mark required children as `blockedByDeletedParent`/non-applicable. Whole-file validation must reject a live child whose parent loses within the file; Merge must never emit an insert/update for a child whose local or incoming parent lost. Cover all contact children and the two-parent normalized value row.

### 3. UID-only reconciliation cannot satisfy `custom_field_values`’ pair uniqueness

**SEVERITY: HIGH**

**LOCATION:** plan [17-04](17-04-PLAN.md:72), [17-08](17-08-PLAN.md:89); real constraint [006-normalize-custom-field-values.ts](../../../../src/db/migrations/006-normalize-custom-field-values.ts:41) and current pair-upsert behavior [field-values-dao.ts](../../../../src/db/field-values-dao.ts:62).

**FAILURE SCENARIO:** Two independently migrated/copy-derived databases have the same contact UID `C` and field-definition UID `F`, but each generated a distinct durable value-row UID: local `L(C,F)`, incoming `R(C,F)`. Each backup is internally valid: exactly one value per pair. UID reconciliation calls `R` missing; after UID-to-ID mapping, its insert violates `UNIQUE(contact_id, field_def_id)`. Calling the existing `upsertValueCore` masks the constraint failure by retaining UID `L` while applying `R`’s scalar data; that breaks the planned stable-UID identity and makes later tombstone decisions incoherent.

**FIX:** Add a pre-write, pair-keyed collision branch after parent UID resolution. Index both sides by value UID and by `(contactUid, fieldDefUid)`; never silently use the current pair UPSERT as UID reconciliation. A deterministic representation rule is required before implementation (for example, pair-level LWW plus a durable treatment of the losing UID). This is an owner escalation if strict D-02 means no pair-level collision rule is allowed. Test distinct value UIDs for one remapped pair, including `NULL` clears and later re-import/tombstone behavior.

### 4. The seeded singleton profile cannot be reconciled by UID as planned

**SEVERITY: HIGH**

**LOCATION:** plan [17-04](17-04-PLAN.md:77); real profile invariant [001-initial.ts](../../../../src/db/migrations/001-initial.ts:51) and seed [001-initial.ts](../../../../src/db/migrations/001-initial.ts:226).

**FAILURE SCENARIO:** A fresh destination has mandatory `profile(id=1, uid=destinationUid)`. A backup has source `profile(uid=sourceUid)`. Under the planned UID-only registry, the source row is missing and would be inserted, but `id=1` is the only legal profile row. Treating it as ordinary LWW instead lets the fresh bootstrap row win and silently discards the backup’s name/photo. This is not an exotic case: migration 001 creates a random UID on every installation.

**FIX:** Resolve profile identity before implementing the reusable registry. Preferred compatible approach: migrate the singleton to a fixed, exported reserved UID on all installations. The alternative is an explicitly documented singleton-by-`id=1` adoption rule for first import; that is a D-02 exception and needs owner approval. Add fresh-install Merge and Replace-all tests that preserve `id=1` and restore the source profile.

### 5. A separately created field with the same `col_name` can abort or mis-associate Merge

**SEVERITY: MEDIUM**

**LOCATION:** plan [17-04](17-04-PLAN.md:72), [17-08](17-08-PLAN.md:89); real uniqueness constraint [001-initial.ts](../../../../src/db/migrations/001-initial.ts:127) and creation path [field-ddl.ts](../../../../src/db/field-ddl.ts:53).

**FAILURE SCENARIO:** Incoming definition UID `D1` has `col_name='allergies'`; the destination independently created `D2` with the same `col_name`. UID reconciliation declares `D1` missing, then insert fails due to `custom_field_defs.col_name UNIQUE`. Alias-matching by `col_name` would be worse: it merges distinct stable definitions and attaches value pairs to the wrong field. A delete/recreate using the same column name has the same collision.

**FIX:** Add a pre-write scan for every non-UID unique constraint, especially `custom_field_defs.col_name`. Specify the safe result—normally an incompatible-destination rejection with zero writes—unless an owner approves a deterministic rename/migration protocol. Do not treat `col_name` as D-02 identity.

### 6. Recomputing recency as planned mutates conflict timestamps and is outside the transaction

**SEVERITY: HIGH**

**LOCATION:** plan [17-08](17-08-PLAN.md:32) and [17-08](17-08-PLAN.md:108); real core contract [recency-dao.ts](../../../../src/db/recency-dao.ts:149) and SQL [recency-dao.ts](../../../../src/db/recency-dao.ts:163).

**FAILURE SCENARIO:** The plan calls `recomputeLastContactCore` after the restore apply. The real core is expressly transaction-only and writes both `last_contact` **and `contacts.modified_at = now`**. Calling it after commit violates the core’s mutex/transaction contract; a failure leaves committed data with stale derived recency. Calling it inside the transaction with restore-time `now` makes every touched restored contact appear newer than its real scalar version, so a later Merge retains stale scalar values and reverses D-03.

**FIX:** Recency is a derived database invariant and belongs inside the one restore transaction, after interaction mutations. Add a restore-specific recency core that recomputes only `last_contact` while preserving the reconciled contact `modified_at` (or restore that final timestamp after recomputation). Schedules, unlike recency, remain an independently failable post-commit rebuild. Test the next Merge after restore to prove the timestamp was not inflated.

### 7. Replace-all does not prescribe a FK-safe complete reset

**SEVERITY: MEDIUM**

**LOCATION:** plan [17-08](17-08-PLAN.md:89) and [17-08](17-08-PLAN.md:108); real foreign-key topology [001-initial.ts](../../../../src/db/migrations/001-initial.ts:84) and non-cascading history [001-initial.ts](../../../../src/db/migrations/001-initial.ts:155).

**FAILURE SCENARIO:** A naïve Replace-all deletes parents first under `foreign_keys=ON`, fails, or retains prior `field_history` because it is not exportable and has no FK. It must also deal with `app_settings.sun_contact_id` before replacing contacts. Retaining old `field_history` after an advertised Replace-all leaves private values from the old local dataset behind.

**FIX:** Specify and test one reset sequence inside the outer transaction: null/reset the singleton reference as necessary; delete dependents before parents, including explicit `field_history`; then insert parents before children and apply settings only after final contact mapping. Seed every FK edge plus old history and a sun contact in the regression.

### 8. Restore writes are absent from the `data_revision` change contract

**SEVERITY: HIGH**

**LOCATION:** plan [17-06](17-06-PLAN.md:18) and [17-06](17-06-PLAN.md:60), [17-08](17-08-PLAN.md:100); real transaction primitive [transaction.ts](../../../../src/db/transaction.ts:42).

**FAILURE SCENARIO:** Plan 06 requires every exportable mutation to advance `app_settings.data_revision`, but its enumerated DAO chokepoints omit restore and 17-08 does not mention it. In Replace-all, the required pre-restore snapshot records `last_backup_data_revision = N`; the raw restore transaction changes the dataset but leaves the counter at `N`. Backup health and automatic eligibility then conclude that nothing changed, so the restored state may never receive the next automatic snapshot.

**FIX:** Require restore-apply to advance the data revision once within the successful outer transaction for every non-no-op Merge and every Replace-all. Define how tombstone-core increments compose so the final revision is captured only after all mutations. Add a pre-restore-snapshot → Replace-all regression proving health becomes changed/stale until a subsequent verified automatic backup.

## Restore atomicity and photos

### 9. The proposed pending directory is rejected by the existing path safety boundary

**SEVERITY: HIGH**

**LOCATION:** plan [17-08](17-08-PLAN.md:96), [17-08](17-08-PLAN.md:102), and [17-08](17-08-PLAN.md:119); real guard [photo-relative-path.ts](../../../../src/db/photo-relative-path.ts:22) and its use by photo storage [photo-storage.ts](../../../../src/services/photos/photo-storage.ts:141).

**FAILURE SCENARIO:** The first restore with a photo calls `stageRestorePending` with `avatars/_restore_pending/contact-<uid>.jpg`. `SAFE_RELATIVE` only permits exactly `avatars/<name>.<image-ext>`; it forbids a subdirectory. Any helper that reuses `assertSafeRelative` therefore throws before staging. `photo-relative-path.ts` is also missing from 17-08’s `files_modified` list.

**FIX:** Either use a flat, generated pending filename that already matches the existing grammar (for example `avatars/restore-pending-contact-<validated-uid>.jpg`, with controlled sidecars), or add a *separate*, narrowly scoped restore-pending grammar/guard covering only the reserved generated directory and its stage sidecar. Do not broaden the generic stored-DB photo grammar. Add `photo-relative-path.ts` and direct safety tests to the plan.

### 10. Pre-commit pending photos can be finalized after a rolled-back or never-started restore

**SEVERITY: HIGH**

**LOCATION:** plan [17-08](17-08-PLAN.md:96), [17-08](17-08-PLAN.md:102), and [17-08](17-08-PLAN.md:119); real launch-sweep behavior [launch-sweep.ts](../../../../src/services/launch-sweep.ts:82) and existing photo sweep scope [photo-storage.ts](../../../../src/services/photos/photo-storage.ts:253).

**FAILURE SCENARIO:** A candidate Merge stages a ready photo for existing contact `U`, then the SQL transaction fails/rolls back—or Android kills the process before `BEGIN`. Task 3’s planned sweep sees that `U` currently exists and finalizes the staged bytes into its canonical avatar. Thus a restore that never committed overwrites a live photo. Profile is worse because the planned sweep finalizes the fixed profile name without any UID check. Cleanup in a normal catch block cannot fix the process-kill window.

**FIX:** The “no marker table” premise is unsafe. Use a unique restore-session namespace plus a pending-photo journal whose rows are committed in the *same* restore transaction and identify the intended target/version; only files with committed journal entries may be finalized. The sweep must garbage-collect staged files without a committed journal, retain retryable committed entries on finalization failure, and delete the journal only after successful finalization. Names must be collision-proof across attempts. This is required for D-05’s unchanged-on-failure guarantee.

### 11. The plan finalizes stale or losing incoming photos even when reconciliation retained local state

**SEVERITY: HIGH**

**LOCATION:** plan [17-08](17-08-PLAN.md:96) through [17-08](17-08-PLAN.md:102); real canonical overwrite primitive [photo-storage.ts](../../../../src/services/photos/photo-storage.ts:141).

**FAILURE SCENARIO:** Local contact `U` has a newer photo/scalar row. An older backup still serializes `U`’s photo bytes. The plan stages every referenced incoming photo and post-commit calls `persistMaster` for each staged file, independent of whether reconciliation returned retain, update, deletion, or a blocked child. The stale backup photo overwrites the newer local canonical file even though Merge retained the local DB row. The same issue affects profile, custom-photo values, and a row deleted by a winning tombstone.

**FIX:** Determine final reconciliation actions before staging. Stage/journal/finalize only photos whose owning row is live and whose incoming action inserts or wins an update. A winning explicit photo clear requires durable post-commit deletion/GC, never a finalization. Replace-all needs equivalent cleanup for omitted photos. Test a newer local photo plus an older backup photo and prove canonical bytes do not change.

### 12. Existing sweep code cannot itself find a pending subdirectory, and the proposed new sweep lacks safe target proof

**SEVERITY: MEDIUM**

**LOCATION:** plan [17-08](17-08-PLAN.md:115) through [17-08](17-08-PLAN.md:125); real root-only listing [photo-storage.ts](../../../../src/services/photos/photo-storage.ts:258) and current registration [App.tsx](../../../../App.tsx:140).

**FAILURE SCENARIO:** `reconcilePhotoWrites` lists only `avatars/` and recognizes only root `*.tmp`/`*.bak`; it neither descends into `_restore_pending` nor knows restore targets. The planned Task 3 can add the missing sweep and App registration pattern is feasible, but as written it parses an ambiguous `cv-<uid>-<colName>` filename and only checks a UID. A deleted/retyped custom value or stale target can therefore be written as an orphan canonical master. It also does not serialize a retry sweep against a live user photo write.

**FIX:** Add dedicated listing/finalization rather than claim the existing sweep covers this. With the committed journal from finding 10, store target kind and enough immutable identity to prove the target is still live (for a custom photo value, value UID plus live definition/type and contact mapping) before `persistMaster`; otherwise GC. Serialize sweep finalization with live photo writes or perform a final current-target/version check. Test process kill after DB commit, mid-finalization, unresolved target, stage-temp orphan, and live-write race.

### 13. Photo clears and Replace-all omissions leave sensitive old masters on disk

**SEVERITY: MEDIUM**

**LOCATION:** plan [17-08](17-08-PLAN.md:89) through [17-08](17-08-PLAN.md:108); real canonical file naming [photo-storage.ts](../../../../src/services/photos/photo-storage.ts:73) and root reconciler limits [photo-storage.ts](../../../../src/services/photos/photo-storage.ts:228).

**FAILURE SCENARIO:** A winning incoming clear, or a Replace-all backup without a photo, updates/removes the DB reference but does not remove the prior `avatars/contact-<id>.jpg`, profile master, or custom-field master. SQLite `INTEGER PRIMARY KEY` does not use `AUTOINCREMENT`, so a later row can reuse an ID and surface the previous person’s photo; even without reuse, the sensitive bytes remain on device. The existing sweep only repairs `.tmp`/`.bak`, not unreferenced masters.

**FIX:** Add final-DB-derived post-commit photo removal/GC for winning clears, deleted targets, and Replace-all reset. Never derive a deletion path from serialized input. Define recovery/reporting when deletion fails and a sweep that safely identifies unreferenced canonical masters.

### 14. A configured pre-restore backup can be skipped by normal cadence/change eligibility

**SEVERITY: HIGH**

**LOCATION:** plan [17-08](17-08-PLAN.md:108); automatic policy is conditional in [17-06](17-06-PLAN.md:80) through [17-06](17-06-PLAN.md:87).

**FAILURE SCENARIO:** A destination is configured, but cadence has not elapsed or `data_revision` has not changed. Reusing the ordinary automatic path returns “not due/no change” without writing a snapshot; Replace-all then destroys the only current state. This contradicts D-14’s requirement to write and verify a fresh snapshot when a destination is configured. A configured-but-unwritable destination is also not the permitted “no destination” warning case.

**FIX:** Specify a forced `createVerifiedPreRestoreSnapshot` path that always writes a distinct snapshot, locally and in SAF verifies it, and blocks Replace-all on any configured-destination failure. Only an actually absent destination may continue after the explicit loss warning. Add tests for not-due, unchanged, failed write, failed verification, and successful snapshot-before-delete ordering.

### 15. One failed schedule hook can prevent later schedule recovery on that foreground launch

**SEVERITY: MEDIUM**

**LOCATION:** plan [17-08](17-08-PLAN.md:98) and [17-08](17-08-PLAN.md:104); real sequential sweep [launch-sweep.ts](../../../../src/services/launch-sweep.ts:82), notification registration [notification-schedule.ts](../../../../src/services/notifications/notification-schedule.ts:520), and digest registration [digest-schedule.ts](../../../../src/services/notifications/digest-schedule.ts:196).

**FAILURE SCENARIO:** The restore reports that schedule reconciliation will self-heal on next launch. But `runLaunchSweep` aborts its hook loop when a hook throws. The notification and digest registration hooks do not independently catch at registration. A thrown notification reconciliation prevents the digest hook (and later hooks) from running that launch, while the fire-and-forget cold-start call is rejected.

**FIX:** Isolate each registered schedule hook with its own Logger-guarded catch, or make the launch-sweep runner continue after individual hook failures. Inject failures independently in UAT/tests and prove both schedule reconcilers run on a subsequent foreground launch.

## Encryption envelope and migration

### 16. SecureStore failure can be interpreted as encryption disabled and produce a plaintext backup

**SEVERITY: HIGH**

**LOCATION:** plan [17-07](17-07-PLAN.md:91) through [17-07](17-07-PLAN.md:101); real copied-pattern semantics [ai-key-store.ts](../../../../src/services/ai-key-store.ts:61) and [ai-key-store.ts](../../../../src/services/ai-key-store.ts:86).

**FAILURE SCENARIO:** Encryption is durably enabled, but Android SecureStore/Keystore has a transient failure or reset. The existing secret-store pattern catches any read failure and returns `null`, indistinguishable from intentionally disabled/absent. The plan does not state the invariant for `encryptionEnabled && passphrase unavailable`; a manual or automatic writer may select plaintext/future-files behavior and expose the user’s only current backup.

**FIX:** Make the passphrase store return distinct typed states: present, intentionally absent, and backend-unavailable. Backup service must read the durable enabled setting separately and fail closed: when enabled but passphrase is absent/unavailable, reject automatic and default-manual writes with a recovery result—never silently fall back to plaintext or implicitly flip the setting. Only explicitly confirmed disable may clear the durable flag after successful cache deletion. Fault-inject get/delete failures.

### 17. Per-file write-new/verify/delete-old is not a crash-consistent passphrase-change protocol

**SEVERITY: HIGH**

**LOCATION:** plan [17-07](17-07-PLAN.md:93) through [17-07](17-07-PLAN.md:101); automatic writer plan [17-06](17-06-PLAN.md:76); encryption configuration plan [17-12](17-12-PLAN.md:60).

**FAILURE SCENARIO:** Several automatic files have been re-encrypted with new passphrase `P2`; the process dies before the SecureStore cache changes from `P1`, or changes it before the remaining files finish. The folder is mixed with no durable operation identity, and the plan claims the work is “resumable/retryable” without a way to identify which artifacts are verified `P2` replacements. A concurrent automatic sweep can write a new `P1` snapshot after the re-encryption scan and before cache switch. Rotation may then prune an only-readable copy.

**FIX:** Define one backup-service serialization lock covering automatic exports, passphrase change, disable, and re-encryption. Persist non-secret migration-operation state/correlation and artifact identifiers before work, or define an equivalent recoverable filename/header scanner. Specify recovery at write-new, verify, old-delete, SecureStore update, and operation-finalization boundaries; block automatic writes during an in-progress change and do not prune either verified copy prematurely. Do not report success until cache/configuration and artifact set are coherent.

### 18. Compatibility improperly uses SQLite `user_version` instead of an independent backup format version

**SEVERITY: HIGH**

**LOCATION:** plan [17-05](17-05-PLAN.md:65) and [17-05](17-05-PLAN.md:73); plan [17-08](17-08-PLAN.md:72); real database version role [database.ts](../../../../src/db/database.ts:40) and migration runner [runner.ts](../../../../src/db/migrations/runner.ts:32).

**FAILURE SCENARIO:** A future app adds SQLite migration 008 but does not change the portable backup wire format. A v8 producer serializes `user_version=8`; a v7 app treats it as a newer unsupported file and rejects an otherwise compatible only-backup. Conversely, a wire-format change unconnected to a DB migration has no dependable migration discriminator. This violates D-14’s “newer-app-version file” (meaning file format) update-first rule and older-file forward migration.

**FIX:** Create an independent `backupFormatVersion` (and separate envelope version) with a closed `fromVersion → current` forward-migration registry. Reject only `backupFormatVersion > maxSupported` before preview with the update-first result. Keep SQLite `user_version` diagnostic-only, if serialized at all. Test compatible files across a changed DB user version and incompatible wire versions without a DB migration.

### 19. The envelope has no exact public-header allowlist

**SEVERITY: MEDIUM**

**LOCATION:** plan [17-07](17-07-PLAN.md:57) through [17-07](17-07-PLAN.md:61) and [17-07](17-07-PLAN.md:99); D-11 in [17-CONTEXT](17-CONTEXT.md:36).

**FAILURE SCENARIO:** The plan says “technical metadata” and asks tests to compare serialized metadata to the physical-Pixel approval record, which includes benchmark duration and release-build identity. Without an exact reject-unknown header schema, implementation can serialize that record—or exported date, counts, filename, device data—beside ciphertext. That reverses D-11’s strict rule that only decryptability metadata is public.

**FIX:** Define one exact envelope wire schema and reject unknown top-level/header keys. Its public fields may be only format/encrypted flag, selected cipher/KDF identifiers and parameters, salt/IV, and opaque authenticated ciphertext/tag representation. Put date/count/content inside ciphertext; do not serialize benchmark/build evidence. Define byte-canonical AAD and add parsed-key-set regressions proving no manifest/content/benchmark/device metadata escapes.

### 20. Untrusted envelope KDF parameters are not bounded before native work

**SEVERITY: MEDIUM**

**LOCATION:** plan [17-07](17-07-PLAN.md:56) through [17-07](17-07-PLAN.md:63); supporting research [17-RESEARCH](17-RESEARCH.md:268).

**FAILURE SCENARIO:** A selected hostile file declares a familiar envelope version but `2^31` PBKDF2 iterations or huge salt/IV/ciphertext lengths. The plan says decrypt through a caller-supplied parameter object, so preview can consume unbounded native CPU/memory before authentication returns a typed error.

**FIX:** Parse the header with strict type/size limits before any KDF/allocation. Map each supported envelope version to an exact approved profile (algorithm, iterations, key/salt/IV lengths) and cap total ciphertext/file size; reject mismatches before PBKDF2. Test malicious values cause zero native KDF calls.

### 21. SecureStore and `encryption_enabled` lack a defined failure-ordering state machine

**SEVERITY: MEDIUM**

**LOCATION:** plan [17-07](17-07-PLAN.md:93), [17-09](17-09-PLAN.md:73), and [17-12](17-12-PLAN.md:60); SQLite transaction behavior [runner.ts](../../../../src/db/migrations/runner.ts:56).

**FAILURE SCENARIO:** Setting a new secret succeeds but setting the SQLite enabled flag fails, or deletion succeeds but the SQLite update fails. The next launch sees contradictory stores. If it infers disabled from a missing secret, this becomes the fail-open in finding 16; if it infers enabled without a recovery state, automatic protection is stranded.

**FIX:** Specify enable/disable/forgotten flows as an explicit non-transactional saga with ordering, compensation, and fail-closed launch reconciliation. Never infer disabled solely from a missing cache item. Add fault-injection tests at every SecureStore/SQLite boundary. This may share the same implementation state machine as findings 16–17.

## Finding counts

- HIGH: 13
- MEDIUM: 8
- LOW: 0
