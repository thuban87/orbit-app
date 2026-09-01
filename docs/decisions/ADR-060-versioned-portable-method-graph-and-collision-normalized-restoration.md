# ADR-060: Versioned Portable Method Graph and Collision-Normalized Restoration

**Status:** Accepted
**Date:** 2026-08-27
**Phase:** 18.1-contact-method-normalization
**Source decisions:** dossier `18-contact-data-normalization` clusters P, Q, and R (method half); 18.1-04 summary and review resolutions
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-056 (partial)
**Superseded by:** ADR-063 (partial)

## Context

The lossless backup model needed to round-trip methods, links, provenance, labels, canonicalization regions, and deletion evidence after scalar endpoints were retired. A strict restore rejection for every method-level natural-key collision could reject a whole otherwise valid restore and violate the intended conservative information-preservation policy.

## Decision

The system uses backup format v2 to carry the normalized method graph as first-class UID-bearing records. Restore normalizes same-contact canonical duplicates, primary conflicts, and active-link conflicts in its reconciliation plan before writing, preserving the survivor set and provenance while retaining explicit tombstone-only deletion semantics.

## Alternatives Considered

- **Keep scalar phone/email fields in the portable wire** — Rejected because it creates a second authority and loses ordered secondary methods and provenance.
- **Reject a whole restore for every natural-key conflict** — Rejected because safe demotion, collapse, and stale-link retention preserve more valid data.
- **Implicitly delete rows missing from a snapshot** — Rejected because absence is not durable deletion evidence.

## Consequences

### Positive

- A full backup remains lossless for the normalized contact model and stays forward-migratable from v1.
- Partial unique indexes are satisfied by ordered demotion before promotion rather than by a transient write failure.

### Negative

- Reconciliation must recompute survivors after it normalizes actions and re-parent collapsed-method provenance.

### Risks

- Collision normalization is constrained to method/link natural keys; UID, parent-survival, malformed-manifest, and tombstone invariants remain strict.

## Implementation

**Key files:**
- `src/backup/types.ts` — defines v2 method, external-link, and provenance wire records.
- `src/backup/backup-schema.ts` — validates and forward-migrates the versioned portable format.
- `src/backup/export-manifest.ts` — projects normalized rows into the full export manifest.
- `src/backup/reconciliation.ts` — normalizes method/link collisions and derives surviving entities.
- `src/backup/restore-apply.ts` — applies ordered reconciliation writes transactionally.
- `src/db/tombstones-dao.ts` — records explicit normalized-child deletion evidence.
- `src/db/purge-dao.ts` — removes normalized children in an exhaustive FK-safe purge.

**Depends on:** ADR-056 (Tombstone-Backed UID Reconciliation for Portable Restores); ADR-057 (Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots)
**Required by:** None.
