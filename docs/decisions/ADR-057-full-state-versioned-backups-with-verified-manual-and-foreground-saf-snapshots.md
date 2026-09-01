# ADR-057: Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots

**Status:** Accepted
**Date:** 2026-08-24
**Phase:** 17-backup-export-restore
**Source decisions:** dossier `15-backup` clusters A/D; D-06–D-10 from phase CONTEXT.md
**Reversibility:** costly
**Migration:** 007
**Supersedes:** None
**Superseded by:** None

## Context

With Android Auto Backup disabled for third-party PII, Orbit needs a user-controlled loss barrier that restores more than contact rows. A snapshot also needs stable compatibility rules, a coherent read boundary, and automatic copies that are truthful about their health rather than treating a share-sheet handoff as protection.

## Decision

The system exports a versioned, full non-secret local-state manifest containing relationship data, settings, tombstones, and photo bytes while excluding secrets, transient history, local paths, and OS schedules. It offers verified manual sharing and foreground-only SAF snapshots from the same format; automatic snapshots use revision-based due/change checks, new timestamped files, and retention that never prunes the newest verified copy.

## Alternatives Considered

- **Android-managed or cloud-integrated backup** — rejected because it would be opaque or require an Orbit cloud/OAuth integration.
- **Manual export only** — rejected because a user must remember to create the sole loss barrier.
- **One rewritten automatic file** — rejected because it provides no recovery depth after a bad state.
- **Data-only or CSV export** — rejected for v1 because it cannot round-trip the full model, including photos and settings.

## Consequences

### Positive

- A user can inspect readable JSON by default and restore a complete portable snapshot.
- The export format is decoupled from SQLite's internal `user_version` while remaining forward-migratable.

### Negative

- Automatic backup runs only when the app next foregrounds; it makes no background-scheduling promise.

### Risks

- SAF folder permissions can be lost, so health must surface that condition rather than claim success.

## Implementation

**Key files:**
- `src/backup/backup-schema.ts` — validates and forward-migrates the versioned backup wire format.
- `src/backup/export-manifest.ts` — builds the full UID-keyed, non-secret export manifest.
- `src/backup/auto-backup-policy.ts` — decides revision-based eligibility, owned filenames, and pruning.
- `src/services/backup/backup-service.ts` — verifies manual and automatic writes before reporting success.
- `src/services/backup/share-export.ts` — isolates local-file and Android share-sheet operations.
- `src/services/backup/saf-storage.ts` — isolates persisted SAF-folder read, write, verification, and rotation access.
- `src/services/backup-sweep.ts` — runs eligible automatic work through the foreground launch sweep.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-012 (Opt-Out Android Backup for Third-Party PII); ADR-056 (Tombstone-Backed UID Reconciliation for Portable Restores).
**Required by:** ADR-058 (Optional Encrypted Backups and Previewed Local Restoration); ADR-060 (Versioned Portable Method Graph and Collision-Normalized Restoration); ADR-063 (Versioned Lifecycle Backup and Dormant-Cadence Restore).
