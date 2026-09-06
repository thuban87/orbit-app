# ADR-023: Structured Touchpoints and One-Tap Defaults

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 06-interaction-log-status-impact
**Source decisions:** dossier `04-log` Clusters A, F, and G
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Orbit's one-tap routes must create useful interaction history without claiming details the user did not provide. The log also needs enough structure for connected-only recency policies, a later correction flow, and direction-aware impact calculations while preserving the Phase-2 single-writer recency contract.

## Decision

The system uses structured interaction rows with an explicit `unspecified` channel, nullable direction and quality, connection state, local-wall-clock occurrence and recording times, and a source. One-tap logging writes an outbound, connected touchpoint with an unspecified channel; users can correct that record later.

## Alternatives Considered

- **A richer or user-editable channel vocabulary** — rejected because it lengthens the fast path or makes downstream consumers depend on deletable rows.
- **No connection or direction model** — rejected because unresponsive relationships and who initiated contact become unrepresentable.
- **Null direction treated as outbound only during impact calculation** — rejected because the one-tap assumption should be explicit and correctable in history.
- **Dropping interaction source after the importer cut** — rejected because the timeline still needs to distinguish considered entries from one-tap and AI-originated entries.

## Consequences

### Positive

- Fast routes remain one tap while preserving enough context for later refinement and derived reads.
- The application records unknown channel honestly instead of silently asserting a call.

### Negative

- One-tap outbound direction is a documented, correctable assumption rather than a fact collected at tap time.
- Consumers must preserve the independent channel, direction, connection, quality, and source axes.

### Risks

- A malformed or future local timestamp could corrupt recency, so write paths reject future `occurred_at` before their transaction.

## Implementation

**Key files:**
- `src/db/recency-dao.ts` — records structured one-tap touchpoints through the sole recency writer.
- `src/db/log-guards.ts` — rejects future local-wall-clock occurrence times before writes.
- `src/screens/ContactProfileScreen.tsx` — supplies the one-tap defaults and refreshes the unified profile read.
- `src/components/TouchpointRefineForm.tsx` — exposes the later correction path for optional touchpoint detail.

**Depends on:** ADR-010 (Single-Writer Interaction Recency Spine)
**Required by:** ADR-027 (Derived Profile-Only Gravity and Intensity); ADR-040 (Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing); ADR-044 (Headless Widget Actions and Dashboard-Rooted Deep Links); ADR-082 (Universal Capture FAB, Canonical Picker, and Truthful Quick Log)
