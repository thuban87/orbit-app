# Phase 18: Contact Data Normalization - Context

**Gathered:** 2026-08-26
**Status:** Product discussion completed externally/pre-roadmap; ready for research and planning.

<domain>
## Phase Boundary

Phase 18 establishes normalized phone/email contact methods and the Bound/Unbound lifecycle on the existing Orbit model. It also creates the local system-contact provenance/linkage foundation that Phase 19 needs. It does not implement a system contact picker, import/reconciliation UI, generic sync, or Interaction Assist.

</domain>

<decisions>
## Locked Invariants

- Read the canonical dossier in full. Its `[DECIDED]`, `[REJECTED]`, `[SUPERSEDES]`, phase-boundary, invariant, and explicit-deferral statements are locked product decisions, not prompts to reopen.
- Normalized phone/email methods are the sole source of truth: support zero-to-many ordered methods, per-type primaries, canonical matching separate from presentation, and storable-but-not-actionable incomplete values. Shared canonical methods are evidence, never global identity proof.
- Bound/Unbound is independent of cadence and does not erase or restart relationship history. `interval_days = NULL` means only never assigned; Bound requires a positive cadence; once assigned, cadence is never cleared.
- Orbit identity stays independent of system-contact identity. Source links can be stale/missing without deleting Orbit data, and source refresh is never destructive or silently authoritative.
- Preserve all explicit deferrals in the dossier, including picker/import/reconciliation work, endpoint/provider interaction history, rich merge management, passive notification-listener detection, and reorder UI polish.

Leave exact schema, migration mechanics, parsing/actionability rules, Favourite dormant-state handling, and cross-surface query implementation to research/planning within those constraints.

</decisions>

<canonical_refs>
## Canonical References

**Researcher and planner MUST read this authoritative product-decision source in full before research or planning:**

- `docs/dossier/18-contact-data-normalization.md`

</canonical_refs>

---

*Phase: 18-contact-data-normalization*
*Context gathered: 2026-08-26*
