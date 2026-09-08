# ADR-027: Derived Profile-Only Gravity and Intensity

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 06-interaction-log-status-impact
**Source decisions:** dossier `04-log` Cluster G
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-106 (partial — Orrery Gravity display scope and companion context)

## Context

Relationship history has both an accumulated familiarity buffer and a current contact rate; one blended score hides when those signals diverge. Persisting either derived quantity would let it rot as time passes, while raw scores or judgemental rate labels would invite gamification or misread a contact frequency that is a floor rather than a ceiling.

## Decision

The system derives gravity and intensity at read time from interaction history and shows them together only on the contact profile. Gravity decays toward a floor and renders as named tiers with a bar; intensity is a neutral outbound/mutual rate with a trailing cadence view, never a judgement or stored score.

## Alternatives Considered

- **One blended score, stock only, or flow only** — rejected because each conceals one of the owner's distinct relationship signals.
- **Lifetime gravity or a rolling window** — rejected because one never becomes informative and the other erases history at an arbitrary cutoff.
- **A raw gravity number or separate cadence statistic** — rejected to avoid gamification and contradictory metrics.
- **Dashboard or orrery encodings** — rejected to preserve the contact-card surface and avoid overloading it.

## Consequences

### Positive

- Profile reads explain long-term familiarity and current contact rate without stale database columns.
- The connection filter keeps impact aligned with the Rarely-responds recency policy.

### Negative

- The calculation runs on reads and its owner-approved tunables require deliberate retuning.
- Intensity deliberately excludes inbound-only volume, so it is not a measure of all communication.

### Risks

- Cadence must sort qualifying rows ascending before differencing, otherwise the newest-first DAO input produces invalid negative gaps.

## Implementation

**Key files:**
- `src/db/impact-read.ts` — reads the shared, parameter-bound input snapshot for both quantities.
- `src/services/impact.ts` — owns the profile-level orchestration and tunable policy.
- `src/services/gravity-logic.ts` — computes floor-bounded, tiered gravity without storage.
- `src/services/intensity-logic.ts` — computes direction-aware neutral rate and trailing cadence.
- `src/components/GravityBar.tsx` — renders a named gravity tier without exposing a raw score.
- `src/components/IntensityLine.tsx` — renders the neutral intensity and cadence line.

**Depends on:** ADR-023 (Structured Touchpoints and One-Tap Defaults); ADR-026 (Rogue Status for Unresponsive or Far-Overdue Contacts)
**Required by:** ADR-106 (Derived Orrery Gravity Visual Mass and Accessible Context)
