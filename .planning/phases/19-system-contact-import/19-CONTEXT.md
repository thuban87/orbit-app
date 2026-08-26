# Phase 19: System Contact Import - Context

**Gathered:** 2026-08-26
**Status:** Product discussion completed externally/pre-roadmap; ready for research and planning.

<domain>
## Phase Boundary

Phase 19 acquires selected system contacts through native picker paths, then performs single/bulk review, initial linking or creation, conservative duplicate assessment, durable import sessions, and completion reporting. It builds on Phase 18's normalized methods and linkage foundation. Ongoing refresh/reconciliation and generic Orbit-to-Orbit merge belong to Phase 20.

</domain>

<decisions>
## Locked Invariants

- Read the canonical dossier in full. Its `[DECIDED]`, `[REJECTED]`, `[SUPERSEDES]`, phase-boundary, invariant, and explicit-deferral statements are locked product decisions, not prompts to reopen.
- Import is deliberate rather than address-book dumping: single import is reviewed before a write; bulk import uses shared defaults of Unbound + Uncategorized and does not add a per-person checkbox list after picker selection.
- System Contacts is source-only. Exact external linkage is deterministic; every other duplicate signal is advisory evidence, and ambiguity never silently links, merges, or blocks safe imports.
- Imported review/session state is durable once Orbit accepts the picker result. Safe partial commits stand, photo failures do not invalidate otherwise valid records, and cancellation/back behavior must preserve the locked no-write/confirmation boundaries.
- Preserve all explicit Phase 20 and post-Phase-20 deferrals: ongoing refresh, remembered reconciliation state, refresh-all, generic Orbit merge, source monitoring, provider-specific interaction tracking, and notification-listener work.

The exact native API wrappers, Android unsupported-state detection, session schema, batch concurrency, score tuning, transaction boundaries, and review design remain research/planning choices. Before planning, keep the recorded Dossier 19 iOS-picker decision versus the existing v1 iOS deferral visible; this context does not resolve that conflict.

</decisions>

<canonical_refs>
## Canonical References

**Researcher and planner MUST read this authoritative product-decision source in full before research or planning:**

- `docs/dossier/19-system-contact-import.md`

</canonical_refs>

---

*Phase: 19-system-contact-import*
*Context gathered: 2026-08-26*
