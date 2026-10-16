# ADR-222: Add Contact Opens Bound, Monthly and Not Yet, with Relationship Basics Open

**Status:** Accepted
**Date:** 2026-10-16
**Phase:** 38.11-everyday-screens-ux
**Source decisions:** D-01, D-02, D-03, D-04, D-22, D-25, D-44, D-85 (38.11-CONTEXT.md; ledger Q-01, convergence cycle 1 O-4; owner rulings 39 D-50, D-51, D-87, D-94); carried D-06, D-09, D-10, D-12
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-016 (partial — "a normal create defaults last-spoke to today" dies; "Not yet" creating no interaction and the one-transaction create survive); ADR-131 (partial — Unbound as the default create outcome and Identity as the only open section die; Name as the only required field, Show More and the cadence/Bound coordination survive)
**Superseded by:** None

## Context

A manual Add Contact seeded no frequency, Unbound and Last spoke "Today", so every new person was untracked and got a fabricated first interaction unless the user changed two controls. Only Identity opened, the header comment claimed a Monthly default that did not exist, and "Not yet" stayed muted even when selected. Phase 39 recorded the owner's new defaults (39 D-50, D-51, D-87, D-94) for this phase to build (39 D-102).

## Decision

The system seeds Add Contact through `createFormSeedState()` with Bound, `NEW_CONTACT_DEFAULT_INTERVAL_DAYS` (Monthly, 30) and Last spoke "Not yet", and opens the Relationship Basics section beside Identity (D-01–D-03, D-22). Today or a picked date still writes the first interaction in the same create transaction; Not yet writes none (D-01, D-06). Name stays the only required field, Unbound and every other frequency stay choosable, and turning Bound on with no cadence still needs a valid frequency (D-12). The seeded values are the dirty baseline, so an untouched form is never unsaved work (D-09). "Not yet" looks selected when chosen on Add and on Edit, one shared control (D-04, D-44, D-25). The Bound/Unbound chips on Add and Edit use the shared primary (solid) chip tier; the frequency chips stay the sub (outline) tier (D-85, ADR-203). Import keeps its own Unbound default (D-07).

## Alternatives Considered

- **Keep today's defaults (Unbound, Today)** — rejected by the owner in Phase 39 (39 D-50, D-51).
- **Apply the selected Not-yet look on Add only** — rejected; one control, one meaning (Q-01).
- **Outline (sub-tier) Bound/Unbound chips** — D-32 (derived), replaced by the owner's "Solid (primary tier)" (D-85).

## Consequences

### Positive

- A new person is tracked from the first save, and no interaction is invented.
- Bound → Unbound → Bound shows Monthly with no red text (the E-05 path is gone).

### Negative

- Unbound on Add hides Frequency but still saves 30 days as the dormant cadence; the Profile then shows "Every 30 days · Inactive while Unbound" (device finding F-04, confirmed unchanged by the owner).

### Risks

- Phase 39 onboarding copy and tests that name the old defaults must follow (recorded in `39-AMENDMENTS-PENDING.md`).

## Implementation

**Key files:**
- `src/screens/create-contact-logic.ts` — `createFormSeedState()` seed and `coordinateBoundToggle` no-cadence rule.
- `src/screens/CreateContactScreen.tsx` — Relationship Basics open; chip tiers; FrequencyPicker fallback to the default interval.
- `src/constants/new-contact-defaults.ts` — `NEW_CONTACT_DEFAULT_INTERVAL_DAYS`.
- `src/components/TriStateLastSpoke.tsx` — the shared Today / Pick date / Not yet control.
- `src/components/tri-state-last-spoke-logic.ts` — `lastSpokeSegmentTone`, `lastSpokeMaxDate`.
- `src/screens/EditContactScreen.tsx` — the same chip tier on Edit.
- `src/components/ui/chip-tone.ts` — the primary and sub chip tiers.

**Depends on:** ADR-016 (Fixed-First Contact Forms and Atomic Contact Creation); ADR-131 (Progressive Contact Creation and Complete-Record Editing); ADR-203 (One Orbit Switch, the Disabled Look, Chip Tiers and Visible Swatch Selection)
**Required by:** None
