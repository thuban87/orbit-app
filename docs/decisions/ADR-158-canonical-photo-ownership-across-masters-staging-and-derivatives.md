# ADR-158: Canonical Photo Ownership Across Masters, Staging, and Derivatives

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.2-audit-remediation-data-security-lifecycle
**Source decisions:** dossier Workstreams B–C; 38.2-CONTEXT D-09 and D-16; RG-010 and RG-013
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Restore, merge, crop, purge, import, and generated derivatives can touch the same identity-derived photo path across separate SQLite and filesystem lifecycles. Without one ownership boundary, stale recovery can overwrite a newer image, deletion can remove live bytes, and cache copies can retain third-party data after their consumer finishes.

## Decision

The system uses ADR-021 identity-derived canonical filenames under per-path ownership locks. A writer settles older journal work before replacing bytes and keeps publication inside the lock; restore, merge, purge, and definition deletion commit idempotent finalize or reference-safe delete intents before filesystem work. Generated derivatives and Contact Picker raw copies are discarded after consumption, with a namespace-guarded cold-start sweep for prior-process orphans.

## Alternatives Considered

- **Change to random photo filenames** — rejected by D-09 because it reverses ADR-021 and breaks derivable post-delete cleanup.
- **Perform best-effort file work without durable intent** — rejected because a crash between database and filesystem operations would lose recovery ownership.
- **Run a generic cache or document-directory sweep** — rejected because only narrowly owned namespaces and exact live-reference predicates are safe to delete.

## Consequences

### Positive

- Newer canonical writes win over stale recovery, and cleanup deletes only bytes no committed reference still owns.
- Merge re-homes absorbed photos to survivor-derived paths without changing the filename policy.

### Negative

- Every canonical writer and destructive lifecycle path must compose the lock and journal protocol.

### Risks

- Failed cleanup can leave bounded journal or cache work until the next foreground pass.

## Implementation

**Key files:**
- `src/services/photos/owned-master.ts` — owns canonical path locks, settle-before-write, finalization, and safe deletion.
- `src/db/restore-photo-journal-dao.ts` — stores idempotent finalize/delete intents and the live-reference predicate.
- `src/services/photos/merge-photo-rehome.ts` — stages and publishes absorbed bytes under survivor-owned paths.
- `src/services/photos/photo-storage.ts` — provides validated identity-derived canonical paths and file primitives.
- `src/services/photos/derivative-cache.ts` — guards discard namespaces and sweeps prior-process transient copies.
- `src/services/photos/restore-photo-finalize-sweep.ts` — retries committed photo work at foreground maintenance.

**Depends on:** ADR-021 (Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup); ADR-058 (Optional Encrypted Backups and Previewed Local Restoration)
**Required by:** ADR-159 (Commit-Current Restore with Deterministic Pair Completion and No Legacy Repair); ADR-161 (Durable Post-Commit Import Recovery and AI-Off Provenance)
