# ADR-111: Cadence-Guarded Profile Metrics and Composed Relationship Actions

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 31-profile-experience
**Source decisions:** dossier `phase-10-profile-experience-dossier.md` §§O–T; 31-CONTEXT.md D-05, D-06; 31-03 and 31-05 summaries; 31-REVIEWS.md immutable-event resolution
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Profile needs useful relationship context without inventing another stored score or treating every reachable contact as cadence-bound. Under ADR-062, Unbound contacts may have dormant or null cadence and remain valid Profile targets. Frequency and Snooze changes also have established transactional, event, notification, and widget effects that Profile must not bypass.

## Decision

Relationship Overview presents existing Orbit Status, derived Gravity, cadence-aware Intensity, Last Interaction, Contact Frequency, and Snooze as truthful local projections. Status uses only its established inputs and no new Health metric. Gravity and Intensity remain derived and never stored. Bound Intensity uses the contact interval; an Unbound or null-cadence contact has no fabricated status and uses the current local calendar month for activity, labeled `This month`. The same fallback is the contract for Phase 32.

Profile frequency and Snooze controls call public composed writers. Frequency preserves the established positive scalar and lifecycle effects without implicitly binding a contact. Snooze and Unsnooze retain unconditional immutable audit events for each invocation; UI pending state prevents accidental double submission without suppressing legitimate repeated events. Visible state publishes only after committed readback.

## Alternatives Considered

- **Treat null cadence as a default interval** — Rejected because it fabricates a policy and violates ADR-062.
- **Use dormant cadence for Unbound Intensity** — Rejected because dormant configuration is not active cadence.
- **Add a new editable Health score** — Rejected because Status, Gravity, and Intensity already have distinct established meanings.
- **Store Gravity or Intensity on the contact** — Rejected because both are derived from current relationship history.
- **Suppress repeated Snooze or Unsnooze events by value state** — Rejected because the immutable event log records invocations, not only state transitions.
- **Write cadence or Snooze directly from the component** — Rejected because it would bypass established side effects and transaction boundaries.

## Consequences

### Positive

- Bound and Unbound Profiles remain truthful while sharing one explicit no-cadence fallback.
- Relationship actions preserve the same audit and side-effect contracts as their existing owners.
- Visual encodings are reinforced by named textual state and time-window context.

### Negative

- Every future cadence consumer must continue to branch before cadence arithmetic.
- A repeated explicit Unsnooze creates another event by design.

### Risks

- UTC date conversion can move calendar-month boundaries; all windows and labels use local-date utilities.
- A component-local optimistic update can display state that never committed.
- A wrapper that nests the non-reentrant transaction mutex can deadlock.

## Implementation

**Key files:**
- `src/services/profile-metrics.ts` — derives Profile lifecycle, status, Gravity, Intensity, and local-month presentation models.
- `src/db/profile-relationship-actions.ts` — composes public frequency and Snooze actions with established effects.
- `src/db/impact-read.ts` — supplies relationship history and cadence inputs without storing scores.
- `src/db/contacts-dao.ts` — retains the guarded positive frequency core.
- `src/db/snooze-dao.ts` — preserves atomic state plus unconditional immutable Snooze events.
- `src/components/profile/RelationshipOverview.tsx` — renders named, accessible relationship facts.
- `src/components/profile/ProfileRelationshipSheets.tsx` — hosts explanations and commit-truthful selectors.
- `src/profile/relationship-sheet-model.ts` — models pending, failure, retry, and dismissal behavior.

**Depends on:** ADR-025 (Immutable Lifecycle Events in a Unified Timeline); ADR-027 (Derived Profile-Only Gravity and Intensity); ADR-062 (Bound/Unbound Lifecycle and One-Way Cadence Assignment)
**Required by:** None
