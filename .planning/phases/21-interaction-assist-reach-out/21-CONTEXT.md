# Phase 21: Interaction Assist & Reach Out - Context

**Gathered:** 2026-08-26
**Status:** Product discussion completed externally/pre-roadmap; ready for research and planning.

<domain>
## Phase Boundary

Phase 21 delivers the shared Call/Text/Email Reach Out router, optional durable Interaction Assist lifecycle, post-native-handoff confirmation, and the bounded larger-widget Contact integration. It depends on the normalized methods from Phase 18 and Phase 20's merge retirement lifecycle. It is user-initiated assist, not passive activity detection.

</domain>

<decisions>
## Locked Invariants

- Read the canonical dossier in full. Its `[DECIDED]`, `[REJECTED]`, `[SUPERSEDES]`, phase-boundary, invariant, and explicit-deferral statements are locked product decisions, not prompts to reopen.
- Reach Out is one reusable router for actionable Call/Text/Email methods, with primary emphasis and a maximum three-tap path when endpoint choice is necessary. Endpoint choice is handoff context only; interaction history stays coarse.
- When Interaction Assist is enabled, write a pending assist immediately before native handoff. Failed handoffs cannot become pending prompts; return confirmation is app-global, persistent, non-modal, capped at five unresolved items, and expires after 24 hours.
- Confirmation creates outbound interaction rows at the assist handoff time only through the existing authoritative interaction/recency writer. Handle Unbound, archived, merged, and purged targets exactly as locked, never resurrecting an absorbed or purged identity.
- Dossier 12's large-widget Message action is superseded by Contact, which deep-links to this shared router; the widget never writes assist rows and its other architecture is unchanged. Preserve all deferrals, especially passive monitoring, delivery/read verification, endpoint history, email compose, new widget actions, and background monitoring.

Exact assist schema, router/banner components, deep-link payload, lifecycle timing/pruning, handoff APIs, notes UI, and target-resolution implementation remain research/planning choices within the locked behavior.

</decisions>

<canonical_refs>
## Canonical References

**Researcher and planner MUST read this authoritative product-decision source in full before research or planning:**

- `docs/dossier/21-interaction-assist-reach-out.md`

</canonical_refs>

---

*Phase: 21-interaction-assist-reach-out*
*Context gathered: 2026-08-26*
