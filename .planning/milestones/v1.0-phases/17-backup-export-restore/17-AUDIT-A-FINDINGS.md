## AUDIT FINDINGS — Session A (writer census / data_revision / tombstone / export allowlist)

Scope and method: audited the actual TypeScript source under `src/`, not the plan's claimed writer list. I searched every non-test `INSERT`, `UPDATE`, `DELETE`, `DROP`, `runAsync`, and `execAsync` hit, then read the owning DAOs/services and their compositional callers. The census distinguishes the current code from planned coverage; all 17-xx coverage below is prospective.

Counts: **HIGH 7, MEDIUM 4, LOW 0**.

### Finding A-01

- **SEVERITY: HIGH**
- **TABLE/WRITER:** `src/db/favourites-dao.ts:37` — `setFavouriteRank`; `:63` — `clearFavouriteRank`; `:131` — `rewriteFavouriteRanks`.
- **FAILURE SCENARIO:** User changes a favourite's rank, clears a favourite, or reorders favourites after the latest automatic snapshot. These are direct `contacts` updates and `favourites-dao.ts` is absent from both 17-06's `files_modified` list and Task 1's writer list. `data_revision` remains equal to `last_backup_data_revision`; on the next eligible foreground launch automatic backup decides that nothing changed and skips the reorder forever, until some unrelated covered writer happens to run.
- **PLAN + FIX:** Amend **17-06 Task 1** to include `src/db/favourites-dao.ts` and tests. After each successful logical mutation in its existing `inWriteTransaction`, call `bumpDataRevisionCore(exec)`. For `rewriteFavouriteRanks`, define the no-op behavior explicitly (do not bump on a valid empty order; bump once after a nonempty successful batch), and test it.

### Finding A-02

- **SEVERITY: HIGH**
- **TABLE/WRITER:** `src/db/ring-seq-dao.ts:91` — `rewriteRingSeq`.
- **FAILURE SCENARIO:** User drags the orrery order after the latest snapshot. The DAO performs one or more direct `UPDATE contacts SET ring_seq = ?, modified_at = ?`; it is not in 17-06. The changed data is exportable but does not advance `data_revision`, so automatic backup can skip it indefinitely.
- **PLAN + FIX:** Amend **17-06 Task 1** to add `ring-seq-dao.ts` and its test to `files_modified`, and bump once in the already-open transaction after a successful nonempty rewrite. Add a regression that a ring reorder makes the automatic policy see changed data.

### Finding A-03

- **SEVERITY: HIGH**
- **TABLE/WRITER:** `src/db/profile-dao.ts:50` — `setProfilePhoto`; `:71` — `clearProfilePhoto`.
- **FAILURE SCENARIO:** User sets or clears the self/profile photo after the latest automatic snapshot. `profile` is a mergeable/exported singleton (`migration001` defines its UID and `modified_at`), but this DAO is absent from 17-06. The profile state and associated exported photo bytes may never reach an automatic snapshot.
- **PLAN + FIX:** Amend **17-06 Task 1** to include `src/db/profile-dao.ts` and tests. Import and call `bumpDataRevisionCore(exec)` after the guarded profile `UPDATE` in each existing transaction. Test set and clear independently.

### Finding A-04

- **SEVERITY: HIGH**
- **TABLE/WRITER:** `src/db/field-type-change.ts:173` — `applyTypeChange`.
- **FAILURE SCENARIO:** User changes a custom field from (for example) `text` to `date`. This is the real `UPDATE custom_field_defs SET type = ?` path; it bypasses both `field-ddl.ts` and `field-defs-dao.ts`, which are the only custom-field files listed by 17-06. A subsequent automatic backup may skip the changed field definition, and restoring the older snapshot retains the wrong widget semantics.
- **PLAN + FIX:** Amend **17-06 Task 1** to include `field-type-change.ts` and its tests. Call `bumpDataRevisionCore(exec)` after the successful definition update, inside the same existing transaction. The history insert is transient and does not itself require a bump.

### Finding A-05

- **SEVERITY: HIGH**
- **TABLE/WRITER:** Planned `src/backup/restore-apply.ts` — 17-08 Task 2's Merge/Replace-all transaction, including its call to `updateAppSettingsCore`.
- **FAILURE SCENARIO:** A Merge imports a newer profile, custom value, field definition, settings value, or another mutable row; or Replace-all writes the validated backup into the local database. 17-08 expressly uses non-mutexed cores/raw composition in one outer transaction, while 17-06 only wires existing runtime DAO entry points and does not name a restore revision rule. Because `data_revision` must not be imported from the file, it can remain equal to `last_backup_data_revision`. The next due automatic backup then treats the newly restored state as unchanged and skips it.
- **PLAN + FIX:** Amend **17-08 Task 2** with an explicit transaction-local revision policy: after a successful state-changing Merge or Replace-all, call `bumpDataRevisionCore(exec)` once before commit (or provide an equivalent, documented coalescing helper). Do not use backup-bookkeeping updates for this. Add tests for Merge no-op (no bump), Merge with a change (bump), and Replace-all (bump).

### Finding A-06

- **SEVERITY: HIGH**
- **TABLE/WRITER:** Planned Replace-all deletion path in `src/backup/restore-apply.ts` — 17-08 Task 2.
- **FAILURE SCENARIO:** Replace-all necessarily removes local mergeable rows that are absent from the selected backup. The task says only that it will perform “Replace-all replacement”; it contains no requirement to capture every displaced local contact/interaction/event/fuel/link/custom-field-definition/custom-field-value UID or insert tombstones before deleting. A user restores an older clean-migration file, then later Merge-restores another older file containing an item that Replace-all removed. Without a tombstone, the later Merge sees an absent row rather than deletion evidence and resurrects it.
- **PLAN + FIX:** Amend **17-08 Task 2** to make Replace-all a tombstone-aware delete operation. Before every hard delete of a current mergeable row, capture its UID and use the 17-02 tombstone core in the same outer transaction; retain/import incoming tombstones too. State and test the complete entity set, including dependent values and contact fan-out. A raw table clear or FK cascade is not deletion evidence.

### Finding A-07

- **SEVERITY: HIGH**
- **TABLE/WRITER:** `src/db/app-settings-dao.ts` planned backup snapshot/core — 17-12 Task 2; `src/backup/export-manifest.ts` — 17-05 Task 1; restore use in 17-08 Task 2.
- **FAILURE SCENARIO:** The plans explicitly make the “backup-facing non-secret snapshot” include “new backup-configuration columns” (17-12:75-80), and tell the implementer to extend `COLUMN_OF` for those new fields (17-12:80). 17-05 serializes that snapshot and 17-08 writes it through `updateAppSettingsCore`. Therefore a backup can export and restore `data_revision`, `last_backup_data_revision`, the SAF folder URI/diagnostic/backup-health fields, and automatic-success metadata. Restoring an old marker can make changed-state detection lie; restoring a foreign/revoked SAF URI can overwrite the current device's destination and health; serializing a provider URI leaks device-local configuration. This contradicts the required exclusion boundary even though these fields are not cryptographic secrets.
- **PLAN + FIX:** Amend **17-12** to define two disjoint explicit allowlists, not “all non-secret fields”: (1) a portable settings-wire projection and restore patch; (2) local-only backup bookkeeping/configuration. The portable set must exclude at least `data_revision`, `last_backup_data_revision`, every SAF-folder URI/permission/diagnostic/health/last-automatic-success field, and any encryption-key/passphrase/KDF material. Do not put excluded fields in the backup wire type or the restore-facing `COLUMN_OF`/core. Amend **17-05** schema/export tests to assert their absence from serialized JSON, and **17-08** restore tests to reject/ignore them. `field_history` is likewise absent from the manifest/table readers (17-05 says so), but add a concrete negative schema assertion rather than relying on prose.

### Finding A-08

- **SEVERITY: MEDIUM**
- **TABLE/WRITER:** 17-06 Task 1's required bump placements versus `src/db/contacts-dao.ts:123-186`, `:301-359`, `:421-477`, `src/db/field-ddl.ts:53-90`, and `src/db/contact-links-dao.ts:198-252`.
- **FAILURE SCENARIO:** 17-06 promises `data_revision` advances “exactly one per call” (17-06:65-68), but also directs a bump inside both outer and composed writers. `archiveContact`/`restoreContact` would bump directly and then unconditionally call the newly bumping `recordEventCore`; each becomes +2. `createContactFull`/`updateContactFull` call the newly bumping `upsertValueCore` zero or many times, as does `createField` for every contact. `applyLinkDiff` can invoke multiple newly bumping insert/update cores. A literal implementation cannot meet the stated exact-one tests; a shallow fixture can hide the contradiction and yield false coverage.
- **PLAN + FIX:** Amend **17-06 Task 1** before implementation. Choose one invariant: either “at least one committed bump per logical mutation” (sufficient for automatic eligibility), or one coalesced bump per outer transaction. If exact one is desired, make leaf SQL cores non-bumping and have every public/outer operation own one final bump, with a clearly documented restore composition seam. Add populated tests for archive/restore, `createField`, `createContactFull` with seeded and submitted values, `updateContactFull` with values, and multi-row link diff.

### Finding A-09

- **SEVERITY: MEDIUM**
- **TABLE/WRITER:** 17-06 Task 1's planned `updateAppSettingsCore`, plus 17-12/17-08 restore composition.
- **FAILURE SCENARIO:** The current public `updateAppSettings` owns the transaction at `src/db/app-settings-dao.ts:313-394`. 17-12 splits out a non-mutexed `updateAppSettingsCore`, and 17-08 calls that core inside its outer restore transaction. 17-06 says to bump `updateAppSettings` and `acknowledgeProvider`, but not the new core. If the wrapper owns the bump, Restore's settings-only Merge can change exported state without a revision bump; if the core owns it, the planned automatic-backup bookkeeping call must never use that core or it self-inflates. The plans do not allocate this ownership.
- **PLAN + FIX:** Reconcile **17-06 Task 1**, **17-08 Task 2**, and **17-12 Task 2** around a named `updateAppSettingsCore` policy. Prefer the A-05 one-bump-at-end restore rule and a public-wrapper bump after a successful core call. Create a separate, narrow, non-bumping backup-bookkeeping SQL core that cannot accept portable settings fields. Test all three paths.

### Finding A-10

- **SEVERITY: MEDIUM**
- **TABLE/WRITER:** `src/db/snooze-dao.ts:92` — `snoozeContact`; `:126` — `clearSnooze`.
- **FAILURE SCENARIO:** Both functions update the exportable `contacts.snooze_until` column, including through the killed-app notification action. They happen also to insert an event in the same transaction (`:102`, `:134`), so 17-06's planned `recordEventCore` bump should make the change detectable. But neither snooze writer is in 17-06's stated exhaustive list or test plan. A future refactor that removes, conditionally suppresses, or changes the audit event can silently remove backup detection without a regression catching it.
- **PLAN + FIX:** Amend **17-06 Task 1** and its dedicated revision regression to include both snooze paths and the notification/headless route. Under the A-08 coalescing decision, rely on the one event-core/outer-operation bump rather than adding a second contact bump.

### Finding A-11

- **SEVERITY: MEDIUM**
- **TABLE/WRITER:** Migration registration: `src/db/database.ts:25-31, 41, 113-126`; planned `src/db/migrations/007-tombstones.ts` in 17-02/17-12.
- **FAILURE SCENARIO:** The live runner can correctly apply ordered pending migrations, but 17-02 only specifies a v6→v7 proof. A real user can update directly from v1 (or v0) to v7. If 007 registration/order or its additive app-settings alterations are wrong in that full chain, no remote repair exists; a v6-shaped unit fixture will not prove the shipped entry point's complete sequence.
- **PLAN + FIX:** Amend **17-02** (or 17-11's integration gate) with a direct v0/v1→v7 migration regression through the real migration list/runner. Assert exactly one migration 007 after 006, its tombstone table/unique key, `data_revision`, and all defaulted 007 singleton columns. Do not add `IF NOT EXISTS` or catch-and-ignore ALTER errors: the runner's atomic `BEGIN`/`user_version`/`COMMIT` mechanism is the intended retry/idempotence boundary.

## Secondary-check results

### Export allowlist / exclusion

The current live `app_settings` schema contains no API key: credentials are SecureStore-only (`src/services/ai-key-store.ts` and comments at `src/db/app-settings-dao.ts:70-72`). The existing generic `COLUMN_OF` is a positive allowlist for normal user settings (`app-settings-dao.ts:166-182`), and it excludes acknowledgement columns from generic UI patches. That is not a sufficient backup/restore boundary: Phase 17 adds local-only bookkeeping to the same table and 17-12 currently asks to add it to the backup snapshot and `COLUMN_OF`.

Required plan correction: make portable wire fields an explicit independent type/array and restore through an independent portable allowlist. Prove JSON never contains `data_revision`, `last_backup_data_revision`, folder/SAF/permission/health/automatic-success columns, API keys, passphrases, raw encryption keys, KDF key material, local paths, or `field_history`. `sun_contact_id` remains local-only and must only become `sunContactUid` at the wire boundary, as 17-05 already requires.

### Migration 007 forward-only

The live migration runner (`src/db/migrations/runner.ts:32-68`) sorts and runs each pending version in a transaction; `src/db/database.ts:25-31, 113-126` currently registers only 001–006 and sets `TARGET_VERSION = 6` at :41. 17-02 correctly plans a new 007 and registration after 006, not an edit of a shipped migration. The runner supports a direct v1→v7 jump because it applies every pending version in order. The planned 007 additions are additive `CREATE TABLE`/`ALTER TABLE` operations inside the runner's one 007 transaction; ordinary repeated invocation is prevented by `PRAGMA user_version`.

No independent migration correctness finding: add a v1→v7 and a v6→v7 regression (17-11 already requests one v6→v7 integration test) and assert the new migration is registered exactly once after 006. Do **not** use `IF NOT EXISTS`/catch-and-ignore to mask a partial 007: the runner's atomic transaction/user-version discipline is the idempotence mechanism.

### Transaction / self-inflation

`inWriteTransaction` at `src/db/transaction.ts:42-56` owns a single non-reentrant `withMutex` boundary. 17-05's proposed `inReadSnapshot` correctly shares it, and 17-06 explicitly says a bookkeeping-only write must not bump the counter. The self-inflation direction is sound, but its safe execution depends on correcting A-09: neither automatic success metadata nor its health write may invoke a bumping public or restore core. All data bumps must run under the already-open transaction; never wrap `bumpDataRevisionCore` in another `inWriteTransaction`.

## WRITER CENSUS TABLE

Legend: `—` means the operation is not a hard delete or not a runtime-v7 revision concern. “Indirect” means a guaranteed mutation in the same transaction reaches a planned bumping core; it is sufficient for changed-state detection but should not be mistaken for independent writer coverage. Bootstrap/migration/benchmark rows are included for exhaustiveness and are not user-runtime Phase-17 gaps.

| file:line | function | table | op(create/update/delete) | covered-for-tombstone? | covered-for-data_revision? | which plan covers it or GAP |
|---|---|---|---|---|---|---|
| `src/db/contacts-dao.ts:127` | `createContactFull` | contacts | create | — | Nominal 17-06; see A-08 | 17-06 |
| `src/db/contacts-dao.ts:249` | `updateContactMetadataCore` / `updateContactFull` | contacts | update | — | Nominal 17-06; see A-08 | 17-06 |
| `src/db/contacts-dao.ts:423` | `archiveContact` | contacts | update | — | Nominal 17-06; event composition duplicates | 17-06, A-08 |
| `src/db/contacts-dao.ts:459` | `restoreContact` | contacts | update | — | Nominal 17-06; event composition duplicates | 17-06, A-08 |
| `src/db/contacts-dao.ts:528` | `setContactPhoto` | contacts | update | — | 17-06 | 17-06 |
| `src/db/contacts-dao.ts:550` | `clearContactPhoto` | contacts | update | — | 17-06 | 17-06 |
| `src/db/recency-dao.ts:163` | `recomputeLastContactCore` | contacts | update | — | Indirect via only production callers | 17-06 callers |
| `src/db/recency-dao.ts:193` | `insertInteractionCore` / `recordTouchpoint` | interactions | create | — | 17-06 outer callers | 17-06 |
| `src/db/recency-dao.ts:278` | `editTouchpointFull` | interactions | update | — | 17-06 | 17-06 |
| `src/db/recency-dao.ts:318` | `deleteTouchpoint` | interactions | delete | Yes, same transaction | Tombstone core | 17-03 + 17-02 |
| `src/db/recency-dao.ts:364` | `createContactWithInteraction` | contacts | create | — | 17-06 | 17-06 |
| `src/db/events-dao.ts:67` | `recordEventCore` / `recordEvent` | events | create | — | 17-06 | 17-06 |
| `src/db/snooze-dao.ts:92` | `snoozeContact` | contacts | update | — | Indirect: same transaction always records event | 17-06 event core |
| `src/db/snooze-dao.ts:126` | `clearSnooze` | contacts | update | — | Indirect: same transaction always records event | 17-06 event core |
| `src/db/favourites-dao.ts:37` | `setFavouriteRank` | contacts | update | — | **No** | **GAP A-01 / 17-06** |
| `src/db/favourites-dao.ts:63` | `clearFavouriteRank` | contacts | update | — | **No** | **GAP A-01 / 17-06** |
| `src/db/favourites-dao.ts:131` | `rewriteFavouriteRanks` | contacts | update | — | **No** | **GAP A-01 / 17-06** |
| `src/db/ring-seq-dao.ts:91` | `rewriteRingSeq` | contacts | update | — | **No** | **GAP A-02 / 17-06** |
| `src/db/fuel-dao.ts:134` | `addFuelCore` / `addFuel` / capture composition | fuel | create | — | 17-06 core | 17-06 |
| `src/db/fuel-dao.ts:189` | `editFuelCore` / `editFuel` / capture composition | fuel | update | — | 17-06 core | 17-06 |
| `src/db/fuel-dao.ts:217` | `confirmFuelCore` | fuel | update | — | 17-06 | 17-06 |
| `src/db/fuel-dao.ts:231` | `deleteFuelCore` / `deleteFuel` | fuel | delete | Yes, UID capture then tombstone | Tombstone core | 17-03 + 17-02 |
| `src/db/contact-links-dao.ts:100` | `addLinkCore` / `addLink` / `applyLinkDiff` | contact_links | create | — | Nominal 17-06; multi-op issue A-08 | 17-06 |
| `src/db/contact-links-dao.ts:128` | `updateLinkCore` / `updateLink` / `applyLinkDiff` | contact_links | update | — | Nominal 17-06; multi-op issue A-08 | 17-06 |
| `src/db/contact-links-dao.ts:142` | `removeLinkCore` / `removeLink` / `applyLinkDiff` | contact_links | delete | Yes, planned UID capture | Tombstone core | 17-03 + 17-02 |
| `src/db/field-ddl.ts:59` | `createField` | custom_field_defs | create | — | Nominal 17-06; calls value core N times | 17-06, A-08 |
| `src/db/field-values-dao.ts:72` | `upsertValueCore` / `upsertValue` | custom_field_values | create/update | — | 17-06; core composition issue | 17-06, A-08 |
| `src/db/field-ddl.ts:81` via `field-values-dao.ts:72` | `createField` pair fan-out | custom_field_values | create | — | 17-06; core composition issue | 17-06, A-08 |
| `src/db/field-ddl.ts:120` | `dropFieldValues` through `dropField`, empty delete, expiry | custom_field_values | delete | Yes, planned capture before delete | Tombstone core | 17-04 + 17-02 |
| `src/db/field-ddl.ts:124` | `dropFieldValues` | custom_field_defs | delete | Yes, planned capture before delete | Tombstone core | 17-04 + 17-02 |
| `src/db/field-ddl.ts:177` | `deleteOrQuarantineField` populated branch | custom_field_defs | update | — | 17-06 explicitly includes quarantine | 17-06 |
| `src/db/field-defs-dao.ts:61` | `renameField` | custom_field_defs | update | — | 17-06 | 17-06 |
| `src/db/field-defs-dao.ts:82` | `reorderFields` | custom_field_defs | update | — | 17-06 | 17-06 |
| `src/db/field-defs-dao.ts:102` | `changeFieldOptions` | custom_field_defs | update | — | 17-06 | 17-06 |
| `src/db/field-defs-dao.ts:123` | `updateFieldCuration` | custom_field_defs | update | — | 17-06 | 17-06 |
| `src/db/field-defs-dao.ts:147` | `updateFieldShareWithAi` | custom_field_defs | update | — | 17-06 | 17-06 |
| `src/db/field-defs-dao.ts:165` | `quarantineField` | custom_field_defs | update | — | 17-06 | 17-06 |
| `src/db/field-defs-dao.ts:185` | `restoreField` | custom_field_defs | update | — | 17-06 | 17-06 |
| `src/db/field-type-change.ts:173` | `applyTypeChange` | custom_field_defs | update | — | **No** | **GAP A-04 / 17-06** |
| `src/db/profile-dao.ts:50` | `setProfilePhoto` | profile | update | — | **No** | **GAP A-03 / 17-06** |
| `src/db/profile-dao.ts:71` | `clearProfilePhoto` | profile | update | — | **No** | **GAP A-03 / 17-06** |
| `src/db/app-settings-dao.ts:386` | `updateAppSettings` | app_settings | update | — | Public wrapper: 17-06; core ambiguity | 17-06, A-09 |
| `src/db/app-settings-dao.ts:447` | `acknowledgeProvider` | app_settings | update | — | 17-06 | 17-06 |
| `src/db/purge-dao.ts:188` | `purgeContact` fan-out | interactions | delete | Yes, capture before delete | Tombstone core | 17-02 |
| `src/db/purge-dao.ts:191` | `purgeContact` fan-out | events | delete | Yes, capture before delete | Tombstone core | 17-02 |
| `src/db/purge-dao.ts:192` | `purgeContact` fan-out | fuel | delete | Yes, capture before delete | Tombstone core | 17-02 |
| `src/db/purge-dao.ts:194` | `purgeContact` fan-out | custom_field_values | delete | Yes, capture before delete | Tombstone core | 17-02 |
| `src/db/purge-dao.ts:197` | `purgeContact` fan-out | contact_links | delete | Yes, capture before delete | Tombstone core | 17-02 |
| `src/db/purge-dao.ts:205` | `purgeContact` | contacts | delete | Yes, capture before delete | Tombstone core | 17-02 |
| `src/db/purge-dao.ts:200` | `purgeContact` | field_history | delete | Excluded/transient | — | Not exportable |
| `src/db/purge-dao.ts` planned | `purgeContact` sun-reference clear | app_settings | update | — | Indirect: same transaction contains contact tombstone | 17-02 |
| `src/services/field-sweep.ts:128` | history retention sweep | field_history | delete | Excluded/transient | — | Not exportable |
| `src/db/migrations/001-initial.ts:220` | `migration001.apply` | categories | create | Bootstrap | Pre-007 counter | Expected bootstrap exception; no runtime category writer exists |
| `src/db/migrations/001-initial.ts:228` | `migration001.apply` | profile | create | Bootstrap | Pre-007 counter | Expected bootstrap exception |
| `src/db/migrations/002-app-settings.ts:65` | `migration002.apply` | app_settings | create | Bootstrap | Pre-007 counter | Expected bootstrap exception |
| `src/db/migrations/006-normalize-custom-field-values.ts:236` | `migration006.apply` | custom_field_values | create | Historical migration | Pre-007 counter | Expected migration exception |
| `src/db/migrations/006-normalize-custom-field-values.ts:245` | `migration006.apply` | retired `contact_custom_values` | delete/drop | Retired, not exported v7 | Pre-007 counter | Expected migration exception |
| `src/db/benchmark.ts:111` | benchmark fixture loop | contacts | create | Throwaway benchmark DB | Not production | Expected non-runtime exception |
| `src/db/benchmark.ts:120` | benchmark fixture loop | interactions | create | Throwaway benchmark DB | Not production | Expected non-runtime exception |

Routing-only writers inspected: `src/db/capture-dao.ts` has no SQL and composes the covered fuel cores; `src/services/notifications/notification-actions.ts` routes to covered recency/snooze DAOs; `src/services/notifications/headless-task.ts` only calls that action handler; `src/services/widget/widget-mark.ts` routes to `recordTouchpoint`. No additional live runtime category writer exists. These do not need independent tombstone/revision code if the named core coverage is implemented.
