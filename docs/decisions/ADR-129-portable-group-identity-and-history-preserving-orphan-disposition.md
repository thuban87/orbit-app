# ADR-129: Portable Group Identity and History-Preserving Orphan Disposition

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 33-group-interaction-logging
**Source decisions:** dossier §AC; 33-BACKUP-HANDOFF owner decision (2026-09-12); 33-08-PLAN/SUMMARY
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Group Event identity, links, resolved values, and overrides must survive portable restore. Phase 33 creates the local entities before the coordinated backup wire implementation owned by Phase 36.

## Decision

The system defines a deferred UID-based groupEvents entity and groupEventUid child relationship, never exporting device-local parent IDs. The handoff requires parent-before-child upsert and mapping, validation/reconciliation/tombstone registration, replace-all ordering, and round-trip tests. The owner-locked missing-parent outcome is detach-to-standalone: preserve valid child history and clear its link plus all three follow flags together. Phase 33 keeps group_event tombstones durable locally and temporarily omits only that unsupported type from format-4 serialization so dissolve/delete cannot invalidate all exports. It does not ship the Group Event wire entity or restore implementation; the coordinated later implementation must replace the guard and carry deletion evidence.

## Alternatives Considered

- **Portable local integer parent IDs** — rejected because destination IDs differ and would corrupt links.
- **Drop valid orphan child history** — rejected by the owner’s detach-to-standalone resolution.
- **Remove local tombstones to make export pass** — rejected because it weakens durable deletion evidence.
- **Implement the complete wire bump in Phase 33** — deferred to the coordinated Phase-36 boundary.

## Consequences

### Positive

- The later restore path has a decided, history-preserving orphan outcome, while current export remains usable.

### Negative

- Phase-33 format-4 backups do not preserve the new Group Event graph or its parent tombstones; the handoff is not completed restore support.

### Risks

- The handoff originally prohibits exporter edits, but approved gap-closure Plan 08 ships a narrow temporary serialization guard. That implementation exception must not be confused with the deferred coordinated wire work.

## Implementation

**Key files:**
- `src/db/group-events-dao.ts` — local lifecycle tombstones and detach semantics.
- `src/db/tombstones-dao.ts` — group_event evidence type.
- `src/backup/export-manifest.ts` — Phase-33 temporary format-4 compatibility boundary.
- `.planning/phases/33-group-interaction-logging/33-BACKUP-HANDOFF.md` — deferred wire shape, registries, ordering, and locked orphan outcome.

**Depends on:** ADR-056 (Tombstone-Backed UID Reconciliation for Portable Restores); ADR-057 (Full-State Versioned Backups); ADR-126 (Explicit Group Lifecycle and Identity-Preserving Conversion)
**Required by:** None
