# Backup & Restore

**Last updated:** 2026-08-27
**Updated by phase:** 18.2-bound-unbound-lifecycle
**Owners:** `src/backup/`, `src/services/backup/`, `src/services/backup-sweep.ts`, `src/db/restore-photo-journal-dao.ts`, `src/screens/BackupScreen.tsx`

## Purpose

Backup & Restore gives Orbit a user-controlled, local loss barrier while Android Auto Backup remains disabled for third-party PII. It creates complete portable snapshots, optionally protects them with a passphrase, and restores a validated snapshot without a server, account, or cloud integration.

## Architecture

### Data Model

The backup manifest is a versioned wire model separate from SQLite's schema version. Its normalized-method representation carries non-secret app settings, relationship rows, method/link/provenance children, tombstones, and embedded photo bytes; it excludes API keys, passphrases, `field_history`, local photo paths, and derived OS schedules.

**Tables:**
- `tombstones` — indefinitely retained type-and-UID deletion evidence for mergeable rows.
- `app_settings` — stores portable preferences plus device-local automatic-backup configuration, revision, health, and encryption-flag state.
- `restore_photo_journal` — committed-only finalize/delete work for restored photo files.
- `contact_methods`, external links, and method provenance — first-class UID-bearing portable children with labels and canonicalization regions where present.

**Types** (`src/backup/types.ts`):
- `BackupManifest` — complete portable snapshot with UID-shaped relationships.
- `EncryptedBackupEnvelope` — minimal public AES-GCM envelope; user content remains ciphertext.
- `BackupEncryptionProfile` — fixed cipher/KDF compatibility profile.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Wire validation | `src/backup/backup-schema.ts` | Parses and forward-migrates the manifest before preview or apply. |
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

## How It Works

### Exporting a snapshot

1. `BackupScreen` invokes the manual export service; it does not alter automatic-backup health.
2. `buildExportManifest()` reads tables and photo bytes under `inReadSnapshot()` so the manifest is coherent with serialized writers.
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
3. `applyRestore()` reconciles UID rows and tombstones, normalizes method/link natural-key collisions before writing, recomputes contact recency, and registers committed photo-finalization work in one transaction.
4. Post-commit photo and schedule work is retryable. The launch sweep resumes only journal rows proven to belong to a committed restore.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `BACKUP_FORMAT_VERSION` | `3` | `src/backup/types.ts` | Portable manifest compatibility version. |
| `BACKUP_ENVELOPE_VERSION` | `1` | `src/backup/types.ts` | Encrypted-container compatibility version. |
| PBKDF2 iterations | `600000` | `src/services/backup/encryption.ts` | Approved passphrase derivation cost. |
| Backup days | `1..3650`, defaults `1` / `7` | `src/db/app-settings-dao.ts` | Automatic cadence and retention bounds. |

## Decisions

- **ADR-012:** Opt-Out Android Backup for Third-Party PII — makes the explicit backup path load-bearing.
- **ADR-056:** Tombstone-Backed UID Reconciliation for Portable Restores — defines merge identity and deletion evidence.
- **ADR-057:** Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots — defines the portable snapshot and automatic policy.
- **ADR-058:** Optional Encrypted Backups and Previewed Local Restoration — defines encryption and safe restoration.
- **ADR-060:** Versioned Portable Method Graph and Collision-Normalized Restoration — carries normalized endpoint children and resolves their safe natural-key collisions before writes.
- **ADR-063:** Versioned Lifecycle Backup and Dormant-Cadence Restore — advances the portable graph to v3 and preserves lifecycle invariants before writes.

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

## Related Systems

- **Persistence core** — supplies schema migration, serialized transactions, revisions, and launch hooks.
- **Contacts** — supplies UID-bearing relationship rows and derived recency.
- **Custom fields** — supplies normalized nullable values and photo-field references.
- **Photos** — owns durable master paths and restore-file finalization.
- **Notifications** and **Digest** — rebuild derived OS schedules after a committed restore.
- **Dashboard** — offers the temporary Backup entry and rare health nudge.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-24 | 17 | Created full-state backup, encryption, automatic SAF snapshot, and validated restoration documentation. |
| 2026-08-27 | 18.1 | Added the normalized method/link/provenance graph and collision-normalized restoration. |
| 2026-08-27 | 18.2 | Bumped the portable graph to v3 for Bound/Unbound state and pre-transaction dormant-cadence resolution. |
