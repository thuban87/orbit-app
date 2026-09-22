# ADR-147: Derived Digest Composition and Canonical Contacts Drill-Through

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 38-your-week
**Source decisions:** D-02, D-04, D-10 from phase CONTEXT.md; dossier §§C–G, O
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-054 (partial); ADR-062 (partial)
**Superseded by:** None

## Context

The prior Digest was a retrospective with a gentle quality signal, not the settled act–awareness–reflection home. The new surface must use canonical relationship state and Contacts filters without a Digest cache, while its Never Contacted count, preview, and drill must agree about an opted-in Unbound person.

## Decision

Digest is a live, read/derive-only surface in fixed Up Next, Horizon, and Your Week order. Up Next claims at most three canonically ranked contacts; Horizon separately presents next-seven-day birthdays, deduplicated overlooked people, and conditional Never Contacted previews, with every scalable drill persisting the canonical Contacts query axes atomically. The opted-in Unbound exception applies only to the `not-contacted` population.

## Alternatives Considered

- **Retain the retrospective as the primary Digest model** — Rejected because the owner-set information architecture is act, awareness, then reflection.
- **Create Digest-specific urgency, lists, or persistence** — Rejected because canonical status and Contacts reads already own those semantics.
- **Keep Never Contacted Bound-only everywhere** — Rejected because its count, preview, and canonical drill must honor the existing opt-in consistently.

## Consequences

### Positive

- Digest remains local, current, and free of a duplicate relationship domain.
- Profile returns and Contacts drill-through preserve one authoritative query model.

### Negative

- Composition must coordinate claims and durable Contacts query state before navigation.

### Risks

- Reimplementing status, birthday, or lifecycle predicates would create conflicting relationship semantics.

## Implementation

**Key files:**
- `src/db/up-next-read.ts` — reads canonical status/progress-ranked Up Next candidates.
- `src/db/digest-read.ts` — supplies Horizon birthday, overlooked, and Never Contacted inputs.
- `src/logic/digest-composition.ts` — caps and deduplicates the fixed Digest modules.
- `src/logic/dashboard-query-logic.ts` — defines the scoped `not-contacted` population exception.
- `src/screens/DigestScreen.tsx` — composes live sections and atomically persists Contacts drill state.
- `src/components/digest/UpNextSection.tsx` — renders capped Profile-opening outreach rows.
- `src/components/digest/HorizonSection.tsx` — renders separate conditional Horizon groups.

**Depends on:** ADR-062 (Bound/Unbound Lifecycle and One-Way Cadence Assignment); ADR-076 (Population-Reached Birthdays Without a Dashboard Banner)
**Required by:** None.
