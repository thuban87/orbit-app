# ADR-102: Frozen-Universe Dashboard Multi-Select

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 28-dashboard-card-view
**Source decisions:** dossier `phase-07-dashboard-card-view-dossier-v0.2` §§N–AC; Group Interaction Logging amendment; 28-CONTEXT D-09–D-13
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Dashboard needed one discoverable bulk-management surface without allowing a changing query result to change an active selection. The surface also needed to preserve binary favourite semantics, avoid destructive bulk deletion, and hand off multi-contact detailed logging without taking ownership of Group Events.

## Decision

Dashboard Card View uses in-memory multi-select with an entry-time frozen eligible universe. Selection replaces the normal control area, Select All operates only on that snapshot, card taps toggle membership, and Back exits selection before navigation. The surface exposes explicit favourite and snooze operations, Archive, category, frequency-only Sensitive Operations, and count-aware detailed-log routing: one contact opens the individual flow and two or more pass serializable participant IDs to Group Log.

## Alternatives Considered

- **A separate bulk-management screen or bottom action bar** — move bulk work outside the Dashboard controls. Rejected because multi-select itself is the Dashboard management surface.
- **A live result universe during selection** — permit query controls and selection to change together. Rejected because selection would become ambiguous after refresh, search, or filtering.
- **Ambiguous favourite or snooze toggles** — infer a mixed-state operation. Rejected because actions must say Add/Remove or Snooze/Unsnooze.
- **Bulk Delete or contact quarantine** — remove contacts permanently or add a retention state. Rejected because Archive is recoverable and permanent purge stays archive-gated and manual.
- **Group Event persistence in Card View** — implement multi-contact detailed logging here. Rejected because this phase owns routing only; the Group Interaction Logging phase owns the domain.

## Consequences

### Positive

- A frozen, ephemeral session prevents a refresh from smuggling new contacts into an active batch.
- The additive Group Log route contract preserves a typed handoff without serializing contact content or callbacks.

### Negative

- Query controls and search are intentionally inert until selection exits.
- Host orchestration must preserve selection after ordinary committed operations and remove only archived IDs.

### Risks

- Re-seeding the frozen universe after a write or allowing a live row through the renderer fence would violate selection safety.

## Implementation

**Key files:**
- `src/stores/dashboard-selection-store.ts` — owns the ephemeral frozen universe, membership, session, and archive removal state.
- `src/components/BulkActionSurface.tsx` — renders the explicit action set and frequency-only Sensitive Operations subsurface.
- `src/screens/HomeScreen.tsx` — replaces Dashboard controls, fences renderer rows, coordinates actions, and routes detailed logging.
- `src/screens/dashboard-overflow-actions.ts` — exposes Select Contacts from the fixed Dashboard overflow menu.
- `src/navigation/types.ts` — defines the additive serializable `GroupLog.participantIds` route contract.

**Depends on:** ADR-075 (Binary Favourite Membership Without a User-Facing Order); ADR-092 (Durable Shared Dashboard Query State); ADR-093 (Scoped Composable Dashboard Population and Filter Model); ADR-096 (Dashboard Header and Overflow Discovery Paths)
**Required by:** None
