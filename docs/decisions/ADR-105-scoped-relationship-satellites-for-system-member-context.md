# ADR-105: Scoped Relationship Satellites for System-Member Context

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 29-orrery-camera-scale-exploration
**Source decisions:** dossier `phase-08-orrery-camera-scale-exploration` §§W–Y; CONTEXT D-09/D-11
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Structured Relationships can supply useful identity context around a contact, but turning them into independent Orrery bodies would invent a social graph and duplicate contact behavior. The owner also resolved the previously unspecified case where the saved contact sun is visible outside the selected System.

## Decision

The Orrery renders only visible, unlinked structured relationships of current System-member parents as subordinate, semantic-visibility satellites when the user enables them. Satellites expose name and relation context without health, Gravity, membership, logging, Profile, or children; an excluded global contact sun remains actionable but has no satellite or relationship context until it is again a System member.

## Alternatives Considered

- **Render linked relationships as moons** — Rejected because linked people are already full Orbit contacts with ordinary placement.
- **Create graph-specific contacts, fields, or ownership schema** — Rejected because satellites are lightweight context, not a social-graph model.
- **Keep satellites for a nonmember contact sun** — Rejected by the owner because the sun must not acquire System context while excluded.

## Consequences

### Positive

- Existing local relationship records provide optional context without changing their data model.
- A relationship automatically stops appearing as a satellite when it is linked, hidden, deleted, or its parent no longer qualifies.

### Negative

- Satellite reads and interaction remain conditional on both the selected System and semantic visibility.

### Risks

- Satellite UI must never imply a Profile or relationship-health data for an unlinked person.

## Implementation

**Key files:**
- `src/db/orrery-satellites-read.ts` — reads eligible current System-member relationship rows.
- `src/logic/orrery-satellite-logic.ts` — derives subordinate positions and context-only satellite actions.
- `src/components/orrery/OrreryWorld.tsx` — renders satellite bodies within the canonical world.
- `src/components/orrery/OrreryFocusContext.tsx` — presents optional parent relationship context without replacing contact identity.

**Depends on:** ADR-088 (Additive Contact-Knowledge Schema and Application-Owned Memory Registry); ADR-104 (Durable Orrery Preferences and Live System Scope)
**Required by:** _None._
