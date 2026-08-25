# Phase 17: Backup, Export & Restore - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a complete local backup and restore system: readable manual exports, timestamped automatic snapshots in a user-selected SAF folder, optional passphrase encryption, safe previewed restore, and a UID-keyed reconciliation core that future sync can reuse. The phase owns the tombstone migration needed for correct Merge behavior against Phase 16's normalized custom-field-value rows.

This remains wholly local. It does not add network sync, Turso/libSQL, accounts, cloud storage, sync ordering/revisions, device enrollment, or sync E2EE. It also does **not** build the future bottom navigation bar. Backup & Restore is intended to become the fourth top-level destination, but until the next UI milestone supplies that navigation, the Dashboard must provide a temporary link beside its existing Orrery and Settings links.

</domain>

<decisions>
## Implementation Decisions

### Reconciliation, deletion, and custom fields

- **D-01:** Add generic tombstones in migration 007 before export/restore work. A tombstone records `entity_type`, `entity_uid`, and `deleted_at`, with a unique logical key; retain them indefinitely in v1. Apply it in the same SQLite transaction as every hard deletion of a mergeable logical entity: contact purge, interactions, events, fuel, links, permanently deleted custom-field definitions and their values, and any equivalent hard-delete writer discovered during planning. Quarantine is not deletion. `field_history` is transient: never export or tombstone it. — **Reversibility:** one-way — migration 007 and published backup files depend on the deletion evidence.
- **D-02:** Reconcile through one standalone, thoroughly tested module. Match records by stable `uid`, resolve children through parent UIDs before mapping to local integer IDs, and let callers provide the participating row sets/policy so a future sync apply path reuses it rather than duplicating backup-private logic. — **Reversibility:** costly — backup restore and future sync will both depend on this contract.
- **D-03:** Scalar and mutable row conflicts use newer `modified_at`; missing rows insert; same-second ties favor deletion. A newer tombstone prevents resurrection, while a genuinely newer incoming row may restore the logical entity. `contacts.last_contact` is derived, never merged directly, and must be recomputed via the existing DAO after a successful apply.
- **D-04:** A Phase 16 normalized custom-field value row with `value = NULL` is an explicit clear, not absence. Export it and reconcile it just like any other mutable row: a newer clear overwrites an older populated value. A newer field-definition row may restore a logically deleted field.
- **D-05:** Validate the entire selected backup, including normalized custom-field invariants such as one value per contact/field pair and valid parents/definitions, before any restore write. A malformed, duplicate, or orphaned relationship rejects the whole restore with local data unchanged; never best-effort skip or invent data.

### Backup contents, format, and automatic retention

- **D-06:** Backup/export covers full non-secret app state: relationship data, categories, profile, photos, and non-secret SQLite settings. Exclude API keys, encryption/key material, and `field_history`. Serialize photo bytes and restore them as fresh local files; never trust serialized local file paths. Rebuild derived OS schedules and recompute derived recency instead of serializing either.
- **D-07:** Ship both manual full export via the share sheet and automatic backup to a user-selected Android SAF folder. They use the same versioned file format and encryption machinery, but manual exports never participate in automatic rotation or backup-health success.
- **D-08:** Automatic backups are distinct timestamped snapshots, never an in-place rewritten file. Write and verify a new automatic snapshot before pruning. Retention must never delete the newest verified automatic snapshot, even if it is older than the retention window.
- **D-09:** Expose two user-set positive integer settings: **back up every N days** (default `1`) and **keep backups for N days** (default `7`). The previous fixed 1/3/7/14 retention presets are superseded. Validate safely while preserving support for arbitrary integer day values rather than prescribed presets.
- **D-10:** v1 automatic backup is foreground-only: on an eligible app launch, run one snapshot if the interval elapsed *and* exportable data changed since the last successful automatic snapshot. No launch means no promised run; a later launch catches up with one snapshot, not a series. Use the existing launch sweep and isolate reusable due-backup/storage/rotation logic so future inexact background work can call it without reworking the format or reconciliation. Exact scheduled background backups are out of scope.

### Encryption and restore safety

- **D-11:** Readable plaintext JSON is the default anti-lock-in path. Encryption is optional AES-256-GCM using a user passphrase; encrypted automatic backups reuse the cached passphrase in SecureStore while enabled. The envelope may expose only technical decryptability metadata (format version, encryption flag, cipher/KDF parameters, salt, IV); export time, counts, and all app/user content remain encrypted. Backup encryption stays entirely separate from any future sync E2EE. — **Reversibility:** costly — the published encrypted-file envelope is a compatibility contract.
- **D-12:** Passphrase setup requires confirmation entry, a plain irrecoverability warning, gentle strength guidance, and no stored hint. Disabling encryption deletes the cached SecureStore passphrase but leaves old encrypted files intact. A normal change verifies the old passphrase and defaults to verified re-encryption of accessible automatic files, with a future-files-only alternative; manually shared files retain their old passphrase. A forgotten passphrase cannot recover or re-encrypt old files, but may establish a new one for future files.
- **D-13:** When encryption is enabled, a manual export defaults to encrypted. Offer a deliberate readable-JSON override for an explicit portability need; do not force plaintext or silently lower protection.
- **D-14:** Restore always decrypts/parses/validates and previews first: exported date, format version, encryption state, row/photo counts, and mode. Merge is default and follows the reconciliation rules above. Replace-all remains available for clean migration, with an impact-summary confirmation (no typed phrase). Before Replace-all, write and verify a fresh automatic snapshot when a destination is configured; otherwise clearly state that current local data will be lost without blocking the restore. Older files migrate forward; a newer-app file is rejected with an update-first message.
- **D-15:** Success uses concise totals, not a sensitive per-record audit: added, updated from backup, newer local retained, and tombstone deletions applied. Replace-all adds that local data was replaced and whether a verified pre-restore backup was created or no automatic destination existed. Failure is calm and specific (wrong passphrase, damaged/incomplete file, newer app, or invalid structure), explicitly says local data is unchanged, and returns to selection or preview.

### Product surface and backup health

- **D-16:** Create the Backup & Restore landing page as the permanent health/action surface: health status, last successful automatic backup, Export now, Restore a backup, and encryption status. Automatic-folder, cadence/retention, and encryption configuration live on a separate Backup settings page. Restore is a dedicated preview-and-confirm flow entered only from the landing page and returns there afterward.
- **D-17:** This phase creates no navigation bar. Add a temporary Dashboard link alongside Orrery and Settings that opens Backup & Restore. The next UI milestone will implement the nav bar and make this the fourth top-level destination; when sync actually ships, this destination can be renamed/extended to Data Management rather than shipping an empty Sync page now.
- **D-18:** Dashboard backup nudges are rare, calm, and dismissible—not a permanent card. Show one only after meaningful data exists and either no successful automatic backup exists, or data changed since the last success and at least 14 days have elapsed. Successful automatic-folder writes define backup health; opening a manual share sheet does not.

### the agent's Discretion

- Define a sensible, code-grounded threshold for “meaningful data,” exact safe bounds/error copy for positive-integer settings, and the internal backup-file schema/KDF implementation details while preserving the locked compatibility and privacy properties.
- Choose exact components and route names consistent with the existing React Navigation and theme-token conventions. The landing-page mockup is visual direction, not a pixel-for-pixel implementation.
- Design SAF provider error handling, lost-folder states, and restore progress mechanics consistent with Android platform constraints and the locked “local data unchanged on failure” guarantee.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and durable product decisions
- `.planning/ROADMAP.md` — Phase 17 goal and milestone sequencing.
- `.planning/REQUIREMENTS.md` — requirement inventory and phase coverage.
- `docs/dossier/15-backup.md` — backup product scope, file-content exclusions, restore safety, and future-sync partition direction.
- `docs/dossier/workpapers/15-backup/platform-encryption.md` — platform encryption constraints and passphrase lifecycle research.
- `docs/decisions/ADR-001-normalized-custom-field-values.md` — Phase 16 normalized-value semantics and migration rationale.

### Phase 16 schema and sync-readiness constraints
- `.planning/phases/16-custom-field-value-normalization/16-CONTEXT.md` — completed predecessor decisions, including durable `custom_field_values` rows and clear semantics.
- `.planning/sync-milestone/PHASE-17-SYNC-READINESS.md` — exact readiness work Phase 17 must establish without implementing sync.
- `.planning/sync-milestone/SYNC-MILESTONE-INVESTIGATION.md` — future-sync questions intentionally deferred from this phase.

### Visual direction
- `docs/mockups/phase-17-backup-restore-landing-v1.png` — approved visual direction for the Backup & Restore landing page; consume in the Phase 17 UI-spec session before planning.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/launch-sweep.ts`: established foreground-launch registry for due work; automatic-backup eligibility should integrate here rather than create an unrelated lifecycle listener.
- `src/services/photos/photo-storage.ts`: existing crash-safe relative photo storage pattern; restore must write fresh files through this layer.
- `src/db/app-settings-dao.ts`: non-secret settings persistence pattern for backup configuration and health metadata.
- `src/db/recency-dao.ts`: single writer for recomputing derived `contacts.last_contact` after reconciliation.
- `src/db/transaction.ts`: shared non-reentrant write-transaction pattern to compose deletion, restore, and migration writes safely.

### Established Patterns
- `src/db/migrations/006-normalize-custom-field-values.ts`: current schema creates `custom_field_values` with stable UID, `contact_id`, `field_def_id`, nullable TEXT `value`, `created_at`, `modified_at`, uniqueness on `(contact_id, field_def_id)`, and cascading foreign keys.
- `src/db/field-values-dao.ts`: clearing retains the durable row with `NULL` and advances `modified_at`; it must be treated as a first-class changed record by export and Merge.
- `src/db/field-ddl.ts` and `src/db/purge-dao.ts`: established hard-delete paths that migration 007/tombstone coverage must audit and update.
- `src/services/ai-key-store.ts`: SecureStore pattern for secrets, which backup must exclude.

### Integration Points
- Migration 007 follows completed migration 006 and must update all mergeable deletion writers atomically with tombstone creation.
- Backup settings and health integrate with the Dashboard/Settings routing already present; only a temporary Dashboard link is in scope until the next milestone’s navigation work.
- Restore must apply normalized field definitions before values, write photos through photo storage, recompute recency, and re-register OS notification/digest schedules instead of restoring derived schedules.

</code_context>

<specifics>
## Specific Ideas

- The landing page should feel like a calm dark, space-themed “Backup & Restore” health/action page: a clear status hero, source/destination status, and concise cards for Export now, Restore a backup, and encryption. Avoid charts and a noisy dashboard. Use existing theme tokens.
- The future information architecture is one Data Management-like destination that can later encompass backup, restore, import, and sync. v1 names it Backup & Restore and ships no empty future-facing Sync page.
- Before planning, run the Phase 17 UI-spec workflow using the approved mockup and the required states (not configured, healthy, stale/no recent automatic backup, lost folder, encryption enabled, and restore outcome/failure).

</specifics>

<deferred>
## Deferred Ideas

- Bottom navigation-bar implementation and final fourth-destination placement belong to the next UI milestone; Phase 17 supplies only the temporary Dashboard link.
- Network sync, Turso/libSQL, accounts, global ordering/revisions, device enrollment, synced/device-local partition ratification, and sync E2EE belong to the future sync milestone.
- Background scheduling may later call the reusable due-backup service with inexact platform work. Exact scheduled backups require separate platform-permission/product decisions and are not part of v1.
- Import beyond restore-from-Orbit-backup and a final Data Management rename are future product work.

</deferred>

---

*Phase: 17-backup-export-restore*
*Context gathered: 2026-08-25*
