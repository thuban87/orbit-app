# ADR-058: Optional Encrypted Backups and Previewed Local Restoration

**Status:** Accepted
**Date:** 2026-08-24
**Phase:** 17-backup-export-restore
**Source decisions:** dossier `15-backup` clusters B/C/D; D-11–D-15 from phase CONTEXT.md
**Reversibility:** costly
**Migration:** 008
**Supersedes:** None
**Superseded by:** None

## Context

Backup files contain third-party contact data and may sit outside Orbit's app sandbox, but mandatory encryption would make the anti-lock-in export opaque and a forgotten passphrase unrecoverable. Restore also needs to prevent malformed input, accidental replacement, and incomplete photo recovery from leaving misleading success states.

## Decision

The system defaults to readable JSON and offers opt-in AES-256-GCM backups encrypted from a passphrase-derived key. It caches an enabled passphrase only in SecureStore for unattended automatic backups, fails closed when that secret is unavailable, and requires decrypt/parse/validation plus an aggregate preview before a Merge-default or explicitly confirmed Replace-all restore. Restore writes database changes transactionally and recovers committed photo finalization through a durable journal.

## Alternatives Considered

- **Always-encrypted exports** — rejected because a forgotten passphrase would make the only loss barrier unrecoverable and unreadable.
- **Plaintext only** — rejected because user-selected SAF folders are outside the app sandbox.
- **Encrypt manual exports only** — rejected because the unattended copies would remain unprotected.
- **Replace-all only or best-effort restore** — rejected because either loses current work or permits incomplete local state.

## Consequences

### Positive

- Users choose portable plaintext or protected files without Orbit storing a recoverable secret.
- Restore failures before commit leave local data unchanged and describe the reason without exposing record details.

### Negative

- A forgotten passphrase cannot open or re-encrypt existing encrypted files.

### Risks

- A passphrase lifecycle or SAF replacement interruption must retain verified predecessor files and surface recovery work.

## Implementation

**Key files:**
- `src/services/backup/encryption.ts` — enforces the versioned PBKDF2/AES-GCM envelope and hostile-header limits.
- `src/services/backup/passphrase-store.ts` — keeps the passphrase and re-encryption recovery material in SecureStore only.
- `src/services/backup/backup-service.ts` — applies fail-closed encryption, verified replacement, and restore preparation.
- `src/backup/restore-apply.ts` — validates and applies Merge or Replace-all through one restore boundary.
- `src/db/migrations/008-restore-photo-journal.ts` — adds durable evidence for committed restore-photo work.
- `src/services/photos/restore-photo-finalize-sweep.ts` — resumes committed photo finalization or cleanup after launch.
- `src/screens/RestorePreviewScreen.tsx` — presents the aggregate preview and explicit destructive confirmation.

**Depends on:** ADR-057 (Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots).
**Required by:** _None._
