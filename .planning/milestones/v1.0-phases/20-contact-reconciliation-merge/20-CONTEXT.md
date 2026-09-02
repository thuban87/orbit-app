# Phase 20: Contact Reconciliation & Merge - Context

**Gathered:** 2026-08-26
**Status:** Product discussion completed externally/pre-roadmap; ready for research and planning.

<domain>
## Phase Boundary

Phase 20 adds user-triggered, one-way reconciliation for the system-contact links established in Phase 19 and an explicit local Orbit-to-Orbit merge lifecycle. It owns durable reconciliation review, stale-link handling, source-change memory, multi-source review, and atomic merge. It does not implement polling, source write-back, or generic multi-device synchronization/conflict resolution.

</domain>

<decisions>
## Locked Invariants

- Read the canonical dossier in full. Its `[DECIDED]`, `[REJECTED]`, `[SUPERSEDES]`, phase-boundary, invariant, and explicit-deferral statements are locked product decisions, not prompts to reopen.
- Reconciliation is only user-triggered and System Contacts remains source-only. Additions may be recommended, but conflicting, removed, or missing source data never silently overwrites or destroys Orbit data.
- Reuse the Phase 19 card-grid review-workspace foundation. Narrowly remember unchanged reviewed discrepancies, keep unresolved work durable/resumable, and reconcile multiple source links into one Orbit-person review card without source authority guessing.
- Merge is explicit, serious, atomic, and has no simple undo: the user chooses the survivor, scalar conflicts are reviewed, compatible child data/methods consolidate, and derived values are recomputed through their existing authoritative paths.
- An absorbed identity is retired/tombstoned—not archived—and must not be resurrected. Preserve all deferrals, notably background monitoring, generic sync/versioning, source write-back, visual-similarity matching, and Interaction Assist.

Exact snapshot/session representations, source-photo fingerprinting, survivor recommendation, merge ordering, tombstone/redirect shape, and UI mechanics remain research/planning choices within these decisions.

</decisions>

<canonical_refs>
## Canonical References

**Researcher and planner MUST read this authoritative product-decision source in full before research or planning:**

- `docs/dossier/20-contact-reconciliation-merge.md`

</canonical_refs>

---

*Phase: 20-contact-reconciliation-merge*
*Context gathered: 2026-08-26*
