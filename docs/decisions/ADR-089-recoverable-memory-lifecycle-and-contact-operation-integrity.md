# ADR-089: Recoverable Memory Lifecycle and Contact-Operation Integrity

**Status:** Accepted
**Date:** 2026-09-03
**Phase:** 24.1-contact-knowledge-foundation
**Source decisions:** milestone-2 dossier `phase-03-contact-knowledge-foundation` §§C–F, I; 24.1 CONTEXT D-10a–11; plans 03–05
**Reversibility:** one-way
**Migration:** 016
**Supersedes:** None
**Superseded by:** None

## Context

New contact-knowledge rows must remain recoverable when a user removes them and must not be lost or orphaned when an owning contact is merged or permanently purged. SQLite has no elapsed-time scheduler, so retention cannot rely on a timer.

## Decision

The system soft-deletes Memories into Recently Deleted and permits permanent removal only from that state; relationships use the same bounded soft-delete retention for Undo. A 30-day foreground launch sweep rechecks staleness under the write lock before expiry. Contact merge explicitly reparents knowledge rows and resolves self-link/current-state collisions, while contact purge explicitly counts, tombstones where applicable, and deletes the knowledge fan-out inside its transaction.

## Alternatives Considered

- **Immediately delete live Memory and relationship rows** — rejected because removals need a bounded recovery path.
- **Use a background timer or SQLite trigger for retention** — rejected because timestamps are swept at launch through the existing maintenance-hook model.
- **Rely on foreign-key cascade during merge or purge** — rejected because merge must preserve compatible child identity and purge requires truthful impact accounting and tombstones.

## Consequences

### Positive

- A user can restore a deleted Memory before expiry, and automation cannot race a restore or fresh re-delete into data loss.
- Merge and purge preserve the contact-knowledge graph's identity and reporting invariants inside their existing atomic operations.

### Negative

- Relationship restoration is Undo-only, and permanent cleanup waits for a foreground launch.

### Risks

- Calling a mutexed lifecycle wrapper from the sweep would deadlock the non-reentrant transaction boundary; expiry uses transaction-composable cores after its under-lock check.
- A permanent Memory purge intentionally becomes tombstoned deletion evidence and cannot be recovered.

## Implementation

**Key files:**
- `src/db/memories-dao.ts` — owns Memory soft-delete, restore, guarded permanent purge, and stale-expiry writers.
- `src/db/memories-read.ts` — supplies the Recently Deleted projection.
- `src/db/relationships-dao.ts` — owns relationship Undo lifecycle, guarded purge, and stale expiry.
- `src/db/merge-dao.ts` — reparents knowledge rows and resolves merge-time link and current-state collisions.
- `src/db/purge-dao.ts` — explicitly counts, tombstones, and deletes contact-knowledge children during purge.
- `src/services/memory-trash-sweep.ts` — performs the strict 30-day foreground retention sweep.
- `App.tsx` — registers the ready-gated sweep hook once at launch.
- `src/screens/RecentlyDeletedScreen.tsx` — exposes restore and confirmed permanent Memory deletion.

**Depends on:** ADR-015 (Lossless Field Changes with Quarantine and Launch-Time Retention Sweep); ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out); ADR-069 (Atomic Tombstone-Backed Orbit Contact Merge)
**Required by:** _None._
