# ADR-021: Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 05-photos
**Source decisions:** dossier `07-photos` Cluster B; cross-domain constraints `[photos → data]`, `[photos → crud / self]`, and `[photos → fields]`
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Picker and image-manipulator outputs live in evictable cache storage, while absolute sandbox paths cannot survive restore. A purge extension runs after its contact and value rows are gone, so it cannot discover arbitrary image filenames from the database.

## Decision

The system persists one 512×512 JPEG master per target under the document directory, stores only a validated relative filename, and derives filenames from the target identity. Replacements use a recoverable temporary-and-backup swap, launch reconciliation handles interrupted swaps, and replace, remove, and purge clean up files best-effort; custom photo fields use the same pipeline and derivable `cv-` path.

## Alternatives Considered

- **Keep cache URIs** — rejected because Android can evict cache files.
- **Store absolute paths** — rejected because device-specific paths break restore.
- **Keep original or thumbnail pairs** — rejected because one bounded master serves every v1 render surface.
- **Random per-file names** — rejected because post-commit purge cannot recover deleted-row paths.

## Consequences

### Positive

- Storage, render, cleanup, and future restore share one durable, bounded file contract.
- Purge can delete contact and custom-field photo files after database fan-out completes.

### Negative

- File lifecycle is non-transactional and needs recovery, allowlist validation, and best-effort cleanup.

### Risks

- A failed file operation can leave a recoverable temporary or backup file until the next launch sweep.

## Implementation

**Key files:**
- `src/services/photos/photo-storage.ts` — owns relative-path validation, filename derivation, persistence, cleanup, and reconciliation.
- `src/services/photos/photo-reconcile-sweep.ts` — registers interrupted-write reconciliation at launch.
- `src/services/photos/photo-pipeline.ts` — produces the bounded JPEG master before persistence.
- `src/services/photos/purge-photo-cleanup.ts` — derives and deletes contact and custom-field files post-commit.
- `src/db/contacts-dao.ts` — writes and clears a contact's relative photo path.
- `src/db/profile-dao.ts` — owns the self-record photo path.
- `src/components/field-widgets/PhotoFieldWidget.tsx` — stores a custom photo field's derivable relative path through the existing value flow.

**Depends on:** ADR-015 (Lossless Field Changes with Quarantine and Launch-Time Retention Sweep); ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out)
**Required by:** ADR-065 (Durable Resumable Contact-Import Sessions with Failure-Isolated Photos).
