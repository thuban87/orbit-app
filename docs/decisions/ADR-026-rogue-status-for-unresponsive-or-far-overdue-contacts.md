# ADR-026: Rogue Status for Unresponsive or Far-Overdue Contacts

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 06-interaction-log-status-impact
**Source decisions:** dossier `04-log` Clusters A and B
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Some contacts decay because the user has not reached out, while others decay despite repeated unanswered attempts. These cases need an explainable relationship state without collapsing the fact of connection into the per-contact policy that controls whether a non-connecting touchpoint advances recency.

## Decision

The system uses one query-time `rogue` state with an `overdue` or `unresponsive` reason. A visible "Rarely responds" contact setting makes recency consider connected rows only; rogue remains an in-app explanatory label rather than a nagging notification state.

## Alternatives Considered

- **One state for never-responds only or overdue only** — rejected because each leaves the other no-longer-working orbit unrepresented.
- **Two separate concepts** — rejected because they can co-occur and require precedence and more vocabulary.
- **A hidden reciprocity toggle or automatic suggestion** — rejected because unexplained or guessed relationship policy is misleading.
- **Continue notifying decaying unresponsive contacts** — rejected because it nags users about people they are already contacting.

## Consequences

### Positive

- Profile status explains why an orbit behaves differently without storing a clock-stale result.
- The same filtered connection rule is available to derived read surfaces.

### Negative

- Status and reason SQL must retain identical precedence so their labels cannot disagree.
- Rogue visibility is limited to the profile until a future notification system implements its suppression contract.

### Risks

- A never-contacted contact must not be misclassified as stable when its `last_contact` is null.

## Implementation

**Key files:**
- `src/db/recency-dao.ts` — recomputes qualifying recency with the Rarely-responds connection filter.
- `src/db/status.ts` — derives rogue status and a precedence-matched reason at query time.
- `src/db/contact-status-read.ts` — supplies guarded profile status reads for an individual contact.
- `src/screens/ContactProfileScreen.tsx` — shows the profile-only rogue and Rarely-responds explanation.
- `src/theme/theme-types.ts` — defines the dedicated rogue and gravity-tier palette tokens.

**Depends on:** ADR-011 (Query-Time Status and Never-Contacted Segregation)
**Required by:** ADR-027 (Derived Profile-Only Gravity and Intensity); ADR-046 (Query-Time Orrery Placement and Transactional Ring Ordering); ADR-054 (Live Weekly Digest Retrospective and Overlooked Relationship Read)
