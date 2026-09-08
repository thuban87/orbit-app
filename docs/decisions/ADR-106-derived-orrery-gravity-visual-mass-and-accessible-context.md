# ADR-106: Derived Orrery Gravity Visual Mass and Accessible Context

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 29-orrery-camera-scale-exploration
**Source decisions:** dossier `phase-08-orrery-camera-scale-exploration` §§E, Z; plans 29-04 and 29-12
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-027 (partial — profile-only presentation and rejected Orrery encoding clauses)
**Superseded by:** None

## Context

ADR-027 deliberately confined derived Gravity and Intensity to Profile and rejected Dashboard or Orrery encodings. The Phase 29 dossier authorizes a narrow Orrery display exception: modest visual mass and named Gravity context let the spatial view and its accessible companion communicate closeness without creating a new stored score or profile substitute.

## Decision

The system reuses ADR-027's full-history, floor-bounded derived Gravity to modestly influence Orrery body mass and present named Gravity context in the exact-System companion list. It does not store, expose as a raw number, edit, or extend Intensity; all remaining ADR-027 derivation, connected-scope, cadence, and non-judgement rules continue unchanged.

## Alternatives Considered

- **Keep Gravity profile-only** — Rejected because the canonical Orrery and accessible companion need restrained closeness context.
- **Persist an Orrery-specific size or score** — Rejected because derived values would become stale and create an editable visual-state model.
- **Show a raw Gravity value or human-worth label** — Rejected because the existing non-gamifying presentation boundary remains in force.

## Consequences

### Positive

- Body mass remains a subtle secondary cue beneath zoom and perspective.
- Screen-reader, switch-control, and precision-navigation users receive the same named context as the canvas.

### Negative

- Scene snapshots batch complete interaction history before computing world geometry.

### Risks

- A future renderer must not treat Gravity as a contact field, replace current recency/status semantics, or let optional context displace a fitting identity label.

## Implementation

**Key files:**
- `src/db/orrery-impact-read.ts` — reads complete, chunked impact inputs inside the coherent scene snapshot.
- `src/services/orrery-scene.ts` — computes derived Gravity after the snapshot releases.
- `src/logic/orrery-world-logic.ts` — applies bounded Gravity mass to canonical world bodies.
- `src/components/orrery/OrreryWorld.tsx` — consumes the derived body mass in the canvas projection.
- `src/components/orrery/orrery-companion-logic.ts` — exposes named Gravity in exact-System companion rows.

**Depends on:** ADR-027 (Derived Profile-Only Gravity and Intensity); ADR-104 (Durable Orrery Preferences and Live System Scope)
**Required by:** _None._
