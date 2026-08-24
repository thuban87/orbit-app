# Phase 17 — Backup, Export & Restore: Context Draft

**Status:** staging draft, written before the roadmap phase insertion. It is not an active
phase artifact yet.

**Intended destination after the roadmap change:**
`.planning/phases/17-backup-export-restore/17-CONTEXT.md`.

**Mandatory refresh:** a new Phase 17 discussion must replace this draft after the planned
Phase 16 custom-field value normalization has executed. This draft preserves owner decisions;
it must not be used to plan implementation against the pre-normalization schema.

## Why Phase 17 exists

Orbit is local-first and `android:allowBackup="false"`, so export is the user's only loss
backstop and the anti-lock-in feature. Phase 17 remains fully local: it adds manual export,
automatic rotating SAF-folder backup, optional backup encryption, and restore. It does **not**
implement network sync, Turso, accounts, sync E2EE, or a sync ordering clock.

The future multi-device-sync milestone is likely, not speculative enough to ignore. Phase 17
therefore builds a correct, reusable local reconciliation core rather than backup-private merge
logic. The later sync milestone will re-evaluate global ordering, E2EE, device enrollment, and
the eventual synced/device-local partition after its Turso spikes.

## Planned prerequisite and numbering

Before this phase can be planned or executed, insert a new **Phase 16: Custom Field Value
Normalization**. It will replace the current dynamic-column custom-value store with a row model
and use migration 006. The current backup phase becomes Phase 17, so its tombstone migration
becomes **migration 007**.

This is deliberate, not scope creep: dynamic custom-field columns are a serious multi-device
sync risk because concurrent field creation/deletion would require replicated DDL. The row-model
migration is safer now, before public users and before a UI/UX milestone build on the current
shape. Do not preserve the old dynamic-column design merely to avoid this rewrite.

Phase 16 must establish stable, sync-safe field-value identity and preserve the existing user
behavior: TEXT-forever values, type parsing at the UI/read boundary, quarantine/restore/history,
custom-field photos, sorting/filtering, and all existing data. Phase 17 must be discussed again
against that finished model.

## Locked reconciliation decisions

### Tombstones

- Tombstones are Phase 17 wave 0, before export/restore UX work. They are needed for v1 Merge
  correctness as well as future sync.
- Every hard-deleted, mergeable **logical entity** receives a tombstone in the same SQLite
  transaction as its deletion. This includes contact purge and user-data child entities that
  have hard-delete paths (interactions, events, fuel, links, and permanently deleted custom
  field definitions; apply the rule to any other mergeable entity with a hard-delete writer).
  `field_history` is transient and excluded from merge/export; it is never tombstoned.
- A quarantined custom field is not deleted and receives no tombstone. When quarantine expiry
  permanently removes the definition and its values, that permanent deletion does.
- Photos and clearing a custom-field value are mutable value changes, not standalone entity
  deletions: their winning row state is merged rather than independently tombstoned.
- Tombstones are retained indefinitely in v1. Safe future compaction requires evidence that all
  sync devices have acknowledged the deletion, which v1 does not have.
- The initial additive-safe shape is a generic table such as `tombstones` / `deleted_entities`:
  `entity_type`, `entity_uid`, `deleted_at`, with a unique logical key. `revision` and
  `device_id` are intentionally deferred additive columns for v2 sync.
- Deletion is last-write-wins against a row using the local timestamp rule. If timestamps are
  identical at v1's second resolution, **the tombstone wins**. The comparison must be a single
  reconciliation helper so v2 can later prefer a server revision without a broad refactor.
- Export includes tombstones. An older, tombstone-less backup remains restorable; it simply
  carries no deletion evidence of its own.

### Reconciliation core

Build and document a standalone, thoroughly tested reconciliation module. Backup/restore uses
it; a future sync apply path reuses it rather than implementing a second merge system.

1. Match records by stable `uid`, never a device-local integer `id`.
2. Resolve child-parent relationships by parent `uid`, then map to the local integer id while
   applying rows.
3. For scalar/mutable records, the newer `modified_at` wins. This applies to contact metadata
   and to child-row collisions: a missing child is inserted; a matching child uid is reconciled
   by newest edit; a tombstone governs its deletion. "Additive" must not mean that edits or
   deletions are ignored.
4. `contacts.last_contact` is derived state: never merge it as a scalar. Recompute it through
   the existing single-writer DAO from the merged interactions after a successful apply.
5. A newer tombstone prevents resurrection; a genuinely newer incoming row may restore the
   logical entity. A same-second tie favours deletion.
6. The core must not assume every exported row will be synced in v2. Its caller supplies the
   participating row sets and policy.

## Backup scope and future partition

- v1 backup/export restores the full non-secret app state: relationship data, categories,
  profile, photos, and non-secret SQLite settings. API keys, encrypted-key material, and
  `field_history` remain excluded. Derived OS schedules are rebuilt, never serialized.
- Merge applies newest-edit-wins to the exportable singleton/settings state as well as user
  data. A new-device restore should bring the app back configured, not just repopulate contacts.
- Phase 17 must label, but not yet enforce, the likely future device-local partition. Candidate
  device-local state includes OS notification schedules, widget state/configuration, dashboard
  view preferences, `ring_seq`, favourites layout/order, and snooze state. The later sync
  milestone ratifies the exact per-field partition after its spikes.
- Backup encryption and future sync E2EE are separate systems with separate keys and lifecycles.
  Phase 17 must not derive one from, or couple it to, the other.

## Export, encryption, and backup health

- Ship both: manual full export through the share sheet and automatic rotating backup to a
  user-selected SAF folder. Auto backup runs only from the existing foreground launch sweep,
  at most once per day and only after data changes; retain roughly seven copies.
- A successfully written automatic-folder file is what counts for backup health. Opening a
  manual share sheet does not prove that the destination saved a backup and must not clear the
  health state.
- After the user has meaningful data, show a calm in-app backup-health card with **Set up
  automatic backups**, **Export now**, and **Not now**. Do not require folder selection during
  empty-app onboarding and do not add a backup notification channel.
- Nudge when the user has meaningful data and either no successful automatic backup exists, or
  data changed since the last successful automatic backup and it is at least 14 days old.
- Plaintext, readable JSON remains the default and the anti-lock-in guarantee. Encryption is
  optional and uses AES-256-GCM with a user passphrase; encrypted automatic backups reuse the
  passphrase held in SecureStore while encryption is enabled.
- An encrypted file exposes only technical decryptability metadata outside ciphertext: format
  version, encrypted flag, cipher/KDF parameters, salt, and IV. Export time, row/photo counts,
  and all user/app content are encrypted.
- Passphrase setup requires entry twice, an explicit irrecoverability warning, gentle strength
  guidance rather than mandatory complexity rules, and no stored hint.
- Disabling encryption immediately deletes the SecureStore-cached passphrase. Existing encrypted
  files remain intact and require their old passphrase when restored.
- On a normal passphrase change, verify the old passphrase and default to re-encrypting every
  automatic backup Orbit can access. Verify replacements before removing old copies. Offer
  **new passphrase for future backups only** as an alternative. Manually shared files cannot be
  changed by Orbit and retain their old passphrase.
- A forgotten passphrase cannot be reset or used to re-encrypt old files. The UI must say this
  plainly and may let the user establish a new passphrase for future backups without deleting
  unreadable old files.

## Restore experience and safety

- Restore always parses/decrypts and previews the file first: exported date, version,
  encryption state, row/photo counts, and the selected restore mode.
- **Merge** is the default. It is a uid-keyed reconciliation apply and preserves newer local
  changes according to the core rules above.
- **Replace-all** remains available for clean device migration. It receives an explicit,
  impact-summary confirmation after the preview; a typed phrase is unnecessary.
- Before Replace-all, if automatic backups are configured, write and verify a fresh
  pre-restore automatic backup. If no automatic destination is configured, make the loss of
  current local data clear but do not block the restore.
- Older backups migrate forward; a backup made by a newer app version is rejected with an
  update-first message. Restore must recreate the custom-field structure/model before loading
  values, write fresh local photo files from embedded bytes rather than trust source paths,
  recompute derived recency, and re-register derived notification/digest schedules.

## Explicit non-goals

- No Turso/libSQL adapter, network request, cloud project, Supabase account, entitlement, or
  real-time sync work in Phase 17.
- No sync ordering/server revision introduced before the sync milestone's viability and conflict
  spikes.
- No backup/sync key unification.
- No premature assumptions that the v2 partition or custom-field conflict policy has been fully
  decided. The row-model Phase 16 removes the DDL problem; the later milestone still determines
  global conflict ordering and transport behavior.

## Required next steps

1. Restore the local GSD runtime/tooling before structural phase changes.
2. Insert Phase 16 and renumber this backup work to Phase 17; update roadmap, requirements,
   state, and sync handoffs atomically, including migration references.
3. Move this draft to the Phase 17 directory as a **parked, provisional** context.
4. Discuss, plan, execute, and verify Phase 16 custom-field normalization.
5. Re-run Phase 17 discussion and replace this context using the actual post-migration codebase.
