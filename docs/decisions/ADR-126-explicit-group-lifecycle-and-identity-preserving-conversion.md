# ADR-126: Explicit Group Lifecycle and Identity-Preserving Conversion

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 33-group-interaction-logging
**Source decisions:** dossier §§N–P, X–Z; 33-CONTEXT D-11; 33-05-SUMMARY
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Removing a participant and removing a grouping express different intents from deleting contact history. Expanding an existing interaction must preserve its durable identity.

## Decision

The system asks Delete interaction / Keep as individual interaction / Cancel for saved participant removal. Detach clears the parent reference and all three follow flags together, retaining resolved structured values and the participant note without copying Group Note. Dissolve confirms removal of the parent and shared note while keeping all children standalone; Delete Group Event & Interactions confirms irreversible removal of parent and linked children. Each parent removal records a fetched-UID group_event tombstone in its transaction. Direct child deletion affects only that child and may leave a valid empty parent. Conversion creates a parent around a transaction-locally verified standalone interaction, preserving the original child ID/UID and seeding shared fields from it.

## Alternatives Considered

- **Implicitly delete history when removing a participant** — rejected because saved removal requires explicit intent.
- **Copy Group Note on detachment or offer an include-note option** — rejected because shared context is not participant-owned prose.
- **Delete/recreate the converted interaction** — rejected because identity must remain stable.
- **Group Favorite/Pin/Archive/Trash states** — deferred; the initial lifecycle is dissolve or confirmed hard-delete.

## Consequences

### Positive

- Users can remove grouping without sacrificing participant history or interaction identity.

### Negative

- Confirmed hard-deletion is irreversible; dissolving permanently removes shared context.

### Risks

- Lifecycle writes require rollback-safe core composition and durable tombstones. ON DELETE SET NULL alone does not clear follow flags and is not the lifecycle implementation.

## Implementation

**Key files:**
- `src/db/group-events-dao.ts` — scoped child deletion, detach, dissolve/delete, and guarded conversion.
- `src/db/tombstones-dao.ts` — durable group_event deletion evidence.
- `src/components/group/RemoveParticipantSheet.tsx` — explicit three-way removal intent.
- `src/components/group/GroupTitlePromptSheet.tsx` — nonblank conversion title prompt.
- `src/components/history/HistorySection.tsx` — conversion and removal navigation.

**Depends on:** ADR-124 (Group Event Parents with Canonical Per-Contact Children); ADR-125 (Three-Field Live Inheritance with Separate Local-Only Group Notes); ADR-056 (Tombstone-Backed UID Reconciliation for Portable Restores)
**Required by:** ADR-129
