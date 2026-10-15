# ADR-212: One Delete Pattern for Things to Remember — At Once with Undo, Then Permanent

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-47, D-69, D-88, D-104, D-122; D-20 revision (38.10-CONTEXT.md; ledger Q-18, Q-19; plan-check C4; convergence c12 Q-P13)
**Reversibility:** one-way
**Migration:** 033
**Supersedes:** ADR-089 (partial — memories' 30-day Recently Deleted, "permanent removal only from that state" and the launch sweep die; the explicit merge reparent and purge fan-out integrity survive); ADR-199 (partial — the D-31 holding zones for memories, key people and Off Limits die; the destructive, feedback, validation and empty-state rules survive)
**Superseded by:** None

## Context

Memories went to a per-contact Recently Deleted for 30 days, key people were soft-deleted for Undo only, Off Limits deleted permanently behind a confirm, and Last Talked About could not be deleted at all. The owner wanted one pattern and found Recently Deleted right for whole contacts but annoying for small Profile entries (Q-18).

## Decision

We will delete every Things to Remember item — memories (including Gift Ideas, Thought of Them, Imported), key people, Off Limits, Last Talked About and Current Location entries — the same way: at once, with an Undo snackbar, then permanently with a tombstone (D-69). Deleting a section entry linked to an interaction removes only the entry (D-47). Undo re-inserts the row live with the same uid and its links resolved by uid. The Recently Deleted screen, the 30-day trash sweep and every soft-delete and restore path are removed; migration 033 purges existing soft-deleted rows (D-88). On Add/Edit Contact a delete is held until Save and Cancel brings it back (D-104). Accepted residual: an edit in the same wall-clock second as its Undo can let an older backup's tombstone win a later Merge (D-122).

## Alternatives Considered

- **Delete at once behind a confirm, no Undo** — the owner's first proposal; not chosen after the reasoning (confirmation fatigue versus one-tap Undo) (Q-18).
- **Keep Recently Deleted for every item** — rejected: "info in the contact profiles should be less durable" (Q-18).
- **Keep 38.9 D-31's holding zones** — superseded by this ruling (D-20 revision).
- **Delete at once on the contact forms too** — rejected; the 38.9 form commit rule holds (C4).

ADR-089 had rejected "Immediately delete live Memory and relationship rows" because removals need a bounded recovery path; the owner was told this before choosing, and the Undo window is kept as that bounded path.

## Consequences

### Positive

- One rule across sections; no per-contact trash to manage.

### Negative

- Once the snackbar closes, recovery is only from a backup.

### Risks

- The Undo window is short (snackbar duration); a mis-tap noticed later is permanent.

## Implementation

**Key files:**
- `src/db/memories-dao.ts` — `deleteMemoryNow(Core)`, `undoMemoryDelete(Core)`.
- `src/db/relationships-dao.ts` — `deleteRelationshipNow(Core)`, `undoRelationshipDelete(Core)`.
- `src/db/off-limits-dao.ts` — Off Limits delete and Undo.
- `src/db/current-state-history-dao.ts` — current-state delete and Undo.
- `src/db/undo-restore.ts` — `undoModifiedAt`, `deleteStampAt`, `resolveUndoLinkCore`.
- `src/db/migrations/033-knowledge-homes.ts` — the D-88 purge.
- `src/screens/edit-contact-save-coordinator.ts` — held deletes written at Save.
- `src/services/memory-trash-sweep.ts` — deleted.
- `src/screens/RecentlyDeletedScreen.tsx` — deleted.

**Depends on:** ADR-089 (Recoverable Memory Lifecycle and Contact-Operation Integrity); ADR-199 (App-Wide Destructive-Action, Feedback and Validation Standards)
**Required by:** None
