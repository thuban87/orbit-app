# Backup & Restore

**Last updated:** 2026-09-14
**Updated by phase:** 36-ai-configuration-prompting
**Owners:** `src/backup/`, `src/services/backup/`, `src/services/backup-sweep.ts`, `src/db/restore-photo-journal-dao.ts`, `src/screens/BackupScreen.tsx`

## Purpose

Backup & Restore gives Orbit a user-controlled, local loss barrier while Android Auto Backup remains disabled for third-party PII. It creates complete portable snapshots, optionally protects them with a passphrase, and restores a validated snapshot without a server, account, or cloud integration.

## Architecture

### Data Model

The backup manifest is a versioned wire model separate from SQLite's schema version. Format 5 carries the complete non-secret preference inventory, typed knowledge, Systems, Group Events, Profile presentation/templates, AI connection metadata, personalization, tombstones, and embedded photo/background bytes; it excludes API keys, OAuth credentials, passphrases, destructive-operation `field_history`, local source paths, and derived OS schedules.

**Tables:**
- `tombstones` — indefinitely retained type-and-UID deletion evidence for mergeable rows.
- `app_settings` — stores portable preferences plus device-local automatic-backup configuration, revision, health, and encryption-flag state. Format v5 emits the complete portable allowlist; transient `interaction_assists` rows remain device-local and excluded.
- `restore_photo_journal` — committed-only finalize/delete work for restored photo files.
- `contact_methods`, external links, and method provenance — first-class UID-bearing portable children with labels and canonicalization regions where present.
- `memories`, `relationships`, `current_state_entries`, and `custom_field_value_history` — portable typed knowledge rows, including soft deletion, explicit AI permission, and retained prior field values.
- `systems`, `system_rules`, `system_overrides`, `system_prefs`, `group_events`, profile template/presentation tables, `ai_connections`, and `personalization_sections` — v5 portable entities whose integer relationships are rebuilt from UIDs on restore. AI connection rows never contain credentials.

**Types** (`src/backup/types.ts`):
- `BackupManifest` — complete portable snapshot with UID-shaped relationships.
- `EncryptedBackupEnvelope` — minimal public AES-GCM envelope; user content remains ciphertext.
- `BackupEncryptionProfile` — fixed cipher/KDF compatibility profile.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Wire validation | `src/backup/backup-schema.ts` | Parses and forward-migrates older manifests before strict v5 whole-graph validation. |
| Export | `src/backup/export-manifest.ts` | Builds one full non-secret manifest inside a read snapshot. |
| Reconciliation | `src/backup/reconciliation.ts` | Resolves UID, tombstone, parent, and natural-key outcomes. |
| Restore | `src/backup/restore-apply.ts` | Applies a validated Merge or Replace-all under one write transaction. |
| Backup service | `src/services/backup/backup-service.ts` | Verifies manual/automatic writes and prepares restore candidates. |
| Encryption | `src/services/backup/encryption.ts` | Implements authenticated PBKDF2/AES-256-GCM envelopes. |
| Secret boundary | `src/services/backup/passphrase-store.ts` | Stores a passphrase and re-encryption journal only in SecureStore. |
| SAF boundary | `src/services/backup/saf-storage.ts` | Owns selected-folder reads, writes, verification, and replacement. |
| Launch work | `src/services/backup-sweep.ts` | Runs due automatic snapshots on a foreground launch. |

### Key Files

| File | Role |
|---|---|
| `src/backup/types.ts` | Defines manifest and encrypted-envelope contracts. |
| `src/backup/backup-schema.ts` | Enforces version and whole-file structural validation. |
| `src/backup/export-manifest.ts` | Projects full local state into portable UID records. |
| `src/backup/restore-apply.ts` | Coordinates transactional restore and post-commit recovery. |
| `src/services/backup/backup-service.ts` | Provides verified write, encryption, and preview orchestration. |
| `src/services/backup/saf-storage.ts` | Isolates persisted-folder storage, verification, and replacement access. |
| `src/services/backup-sweep.ts` | Registers foreground-only automatic backups. |
| `src/db/tombstones-dao.ts` | Records merge-safe hard deletions. |
| `src/db/restore-photo-journal-dao.ts` | Persists committed photo recovery work. |
| `src/screens/BackupScreen.tsx` | Provides the health/action landing and restore entry. |
| `docs/systems/orrery-systems-backup-contract.md` | Records the Phase-30 stable-UID entity, validation, and orphan-repair contract consumed by the coordinated Systems wire implementation. |

## How It Works

### Exporting a snapshot

1. `BackupScreen` invokes the manual export service; it does not alter automatic-backup health.
2. `buildExportManifest()` reads every portable table and photo/background bytes under `inReadSnapshot()` so the manifest is coherent with serialized writers. Format 5 includes Memory/interaction permission, custom-field scope/history/group metadata, Systems, Group Events, AI configuration metadata, personalization, and Profile presentation.
3. The service writes the local file, reads it back, parses it again, and only then opens Android's share sheet.
4. The normalized method graph retains nullable labels and canonical regions; v1 scalar endpoint data forward-migrates to deterministic legacy method UIDs rather than reintroducing a scalar authority.
4. When automatic backup is configured, `registerBackupSweep()` checks cadence and `data_revision` at a foreground launch, writes and verifies a new SAF file, records success, then prunes eligible owned copies.

### Encrypting a backup

1. The normal default is readable JSON. Turning encryption on validates confirmation input, caches the passphrase in SecureStore, then sets the device-local SQLite flag.
2. An enabled automatic write reads the SecureStore value and blocks before export if it is absent or unavailable; it never silently writes plaintext.
3. The encryption service emits only technical envelope metadata outside AES-256-GCM ciphertext. A passphrase change keeps predecessor files until replacement bytes verify.

### Previewing and restoring

1. The landing screen reads a picker cache copy immediately, decrypts if necessary, parses, validates the complete graph, and stores the valid candidate in a process-local cache.
2. `RestorePreviewScreen` shows aggregate metadata only. Merge is the default; Replace-all requires an impact confirmation and, with a configured destination, a fresh verified pre-restore snapshot.
3. `applyRestore()` reconciles UID rows and tombstones, remaps portable parent UIDs to destination row IDs, normalizes method/link natural-key collisions before writing, remaps any legacy interaction Tone/channel vocabulary on ingest through the shared map, forces `allow_ai=0` on the interactions merge/update arm, recomputes contact recency, and registers committed photo-finalization work in one transaction.
4. Post-commit photo, background, and schedule work is retryable. Avatar work uses committed journal rows; background work uses retained UID-keyed restore-pending bytes and a launch re-drive after sidecar recovery.
5. Import sessions are local-only transient recovery state: exports omit them, and Replace-all clears their rows so a portable snapshot cannot revive a stale system-picker selection.
6. A format-4 backup that predates retained custom-field value history normalizes its missing array to `[]`; restored older rows default to AI off and global, non-history field definitions.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `BACKUP_FORMAT_VERSION` | `5` | `src/backup/types.ts` | Portable manifest compatibility version. |
| `BACKUP_ENVELOPE_VERSION` | `1` | `src/backup/types.ts` | Encrypted-container compatibility version. |
| PBKDF2 iterations | `600000` | `src/services/backup/encryption.ts` | Approved passphrase derivation cost. |
| Backup days | `1..3650`, defaults `1` / `7` | `src/db/app-settings-dao.ts` | Automatic cadence and retention bounds. |

## Decisions

- **ADR-108:** Durable Independent-Axis Profile Presentation and Inheritance — Phase 31 allowlisted global preference UIDs but deliberately left the complete presentation graph and image bytes out of format 4.

- **ADR-012:** Opt-Out Android Backup for Third-Party PII — makes the explicit backup path load-bearing.
- **ADR-056:** Tombstone-Backed UID Reconciliation for Portable Restores — defines merge identity and deletion evidence.
- **ADR-057:** Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots — defines the portable snapshot and automatic policy.
- **ADR-058:** Optional Encrypted Backups and Previewed Local Restoration — defines encryption and safe restoration.
- **ADR-060:** Versioned Portable Method Graph and Collision-Normalized Restoration — carries normalized endpoint children and resolves their safe natural-key collisions before writes.
- **ADR-063:** Versioned Lifecycle Backup and Dormant-Cadence Restore — advances the portable graph to v3 and preserves lifecycle invariants before writes.
- **ADR-065:** Durable Resumable Contact-Import Sessions with Failure-Isolated Photos — keeps accepted picker snapshots local-only and clears them on Replace-all restore.
- **ADR-070:** Durable Pending Interaction-Assist Lifecycle and Portable Opt-Out — adds the `interactionAssistEnabled` setting to the portable manifest while excluding the transient assist rows.
- **ADR-083:** Durable Multi-Package Theme Configuration and Restore-Before-Paint — allowlists seven future-portable theme keys without changing the current format-3 wire shape.
- **ADR-090:** Additive Custom-Field Value History and Deferred Contact Scope — makes retained prior values a mergeable, tombstoned portable entity.
- **ADR-116:** Value-Remapped Interaction Vocabulary and Optional Descriptive Duration — restore-apply remaps legacy `quality`/`channel` values on ingest through the single shared map, so a pre-Phase-32 backup cannot re-open the vocabulary miscount.
- **ADR-117:** Per-Interaction Allow-AI Consent Gate — restore is fail-closed for `allow_ai` on both paths (fresh insert via `DEFAULT 0`, merge/update via an explicit `allow_ai=0`), so no restored backup leaves an interaction more AI-permissive.
- **ADR-092:** Durable Shared Dashboard Query State — allowlists future-portable Dashboard preferences without changing the current wire format.
- **ADR-099:** Durable Global Dashboard Right-Swipe Action — allowlists the future-portable action key without an in-phase format change.

## Gotchas

1. **A manual share is not health.** Only a verified automatic SAF write records protection state.
2. **Never export local mechanisms or secrets.** SAF URIs, health metadata, encryption state, passphrases, and API keys stay device-local.
3. **Validate before writes.** A damaged, duplicate, orphaned, or newer-format backup must never be partially applied.
4. **Do not merge `last_contact`.** It is derived from interactions and is recomputed after restore.
5. **Do not trust serialized photo paths.** Restore stages embedded bytes, then writes fresh local masters through the committed journal path.
6. **Foreground-only means catch-up on launch.** It is not a background scheduler or a cloud-sync promise.
7. **Normalize method actions before publishing survivors.** A collapsed duplicate must re-parent its provenance and leave the survivor set consistent with the writes.
8. **Demote before promoting a primary or active link.** SQLite partial unique indexes are statement-immediate, so a promotion-first write can fail mid-restore.
9. **Plan lifecycle conflicts before the transaction.** A valid newer Unbound row with NULL cadence retains a local assigned cadence as dormant; malformed lifecycle cells fail validation before mutation.
10. **Do not export import sessions.** Their picker-derived snapshots are local recovery state, not portable relationship authority.
11. **v5 is the coordinated preference boundary.** Theme, Dashboard, Orrery, Profile, History, capture, compose, and non-secret AI preferences are emitted and restored together; credentials remain SecureStore-only.
12. **Older v4 files upgrade before strict v5 validation.** The 4→5 forward migration injects empty arrays for every new entity, and a native v5 file must carry the complete array inventory.
13. **Integer relationships travel as UIDs.** Systems, contacts, Group Events, and presentation parents are looked up in the destination database; source row IDs never cross the wire.
14. **Group Event deletion remains durable.** v5 carries parent tombstones, while an interaction whose Group Event no longer survives is retained as ordinary contact history with a NULL parent.
15. **Profile presentation and background bytes are v5 entities.** `profile_contact_presentation` and `profile_category_presentation` are keyed by parent UID, preserve template assignments/freeform/collapse state, and restore background bytes through staged, UID-derived `profile-backgrounds/<uid>.jpg` files.
16. **Restore is a separate interaction writer.** `restore-apply` writes `interactions` without going through migration 025, so it must consume the same `interaction-vocabulary.ts` remap and force `allow_ai=0` on its merge arm; otherwise the restore backdoor re-opens the vocabulary miscount or a stale AI-permissive row (SQLite's column `DEFAULT` fires only on fresh INSERT, not `ON CONFLICT` update).

## Related Systems

- **Persistence core** — supplies schema migration, serialized transactions, revisions, and launch hooks.
- **Contacts** — supplies UID-bearing relationship rows and derived recency.
- **Custom fields** — supplies normalized nullable values and photo-field references.
- **Contact Knowledge** — supplies typed Memories and explicit per-item permission; **Custom fields** supplies retained value history and scope metadata.
- **Photos** — owns durable master paths and restore-file finalization.
- **Notifications** and **Digest** — rebuild derived OS schedules after a committed restore.
- **Dashboard** — offers the temporary Backup entry and rare health nudge.
- **Contact Import** — retains local-only recovery sessions that Replace-all intentionally clears.
- **Interaction Assist & Reach Out** — its `interactionAssistEnabled` preference rides in the portable manifest; its assist rows do not.
- **Orrery** — owns live System definitions and membership; its backup contract distinguishes portable authored rules and overrides from derived resolved membership.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-24 | 17 | Created full-state backup, encryption, automatic SAF snapshot, and validated restoration documentation. |
| 2026-08-27 | 18.1 | Added the normalized method/link/provenance graph and collision-normalized restoration. |
| 2026-08-27 | 18.2 | Bumped the portable graph to v3 for Bound/Unbound state and pre-transaction dormant-cadence resolution. |
| 2026-08-26 | 19 | Excluded local-only contact-import sessions and cleared them on Replace-all restore. |
| 2026-08-31 | 21 | Added the `interactionAssistEnabled` preference to the portable manifest (transient assist rows excluded). |
| 2026-09-02 | 23 | Allowlisted durable theme preferences while preserving the format-3 export projection. |
| 2026-09-03 | 24.2 | Added Memory permission, retained custom-field history, scope metadata, and compatible format-4 restoration. |
| 2026-09-02 | 25 | Allowlisted durable Dashboard preferences for a future wire without changing the current backup format. |
| 2026-09-02 | 27 | Allowlisted the durable Dashboard right-swipe action for a future wire without changing the current backup format. |
| 2026-09-02 | 30 | Declared the stable-UID Systems entity, validation, and orphan-repair boundary while intentionally leaving the format-4 wire unchanged. |
| 2026-09-09 | 31 | Documented Profile presentation's format-4 boundary: global preference keys are accepted, while Profile entities and background bytes remain device-local pending the coordinated backup format decision. |
| 2026-09-02 | 32 | Closed the restore backdoors for the interaction Tone/channel vocabulary (remap-on-ingest through the shared map) and the per-interaction `allow_ai` gate (fail-closed on both the fresh-insert and merge/update paths); declared the `history_lens`/`history_cycle_count` preferences restore-accept only, with emission deferred to Phase 36. |
| 2026-09-14 | 36 | Profile presentation + background bytes added to v5 backup — deferral discharged per D-14. |
| 2026-09-17 | 37.1 | Bumped to format 6 for category tombstones; merge nulls only proven deleted-category dependents, while Replace-all restores the exact taxonomy including zero and never reseeds defaults. |
Category relationships are portable by UID, never local integer ID. Format 6 adds category tombstones with a minimal v5→v6 version relabel. Merge maps a winning deleted category only to Uncategorized and suppresses only dependents proven to reference that UID. Replace-all removes destination-only categories through the canonical fallout transaction, restores the exact incoming order—including an empty taxonomy—clears tombstones for live restored categories, and never replays migration-001 seeds.
