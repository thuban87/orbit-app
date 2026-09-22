# ADR-151: Visual-Only Relationship Overview Orphan Packing

**Status:** Accepted
**Date:** 2026-09-19
**Phase:** 38.1-profile-presentation-polish
**Source decisions:** dossier §I; D-05 from phase CONTEXT.md
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Forward-packed compact Relationship Overview modules could leave a blank half-row. The existing compact/wide layout control is a persisted user choice and must not be silently replaced by a visual repair.

## Decision

Relationship Overview preserves configured order and semantic module sizes, then derives a row-local visual span that fills any lone compact module's computed row. It never pulls a later module across an intervening full-width module or rewrites `module.size`; all tile content is centered at compact, wide, and stretched widths.

## Alternatives Considered

- **Remove the compact/wide toggle** — Rejected because it removes an already-shipped user choice.
- **Persist the stretched size** — Rejected because orphan repair is visual-only, not a semantic layout change.
- **Pull later compact modules upward** — Rejected because it violates configured sequence.

## Consequences

### Positive

- Blank rows disappear while saved layout semantics and responsive packing remain intact.

### Negative

- Renderers must use computed visual spans rather than treating them as persisted module metadata.

### Risks

- Centered content needs large-font device verification to avoid clipping.

## Implementation

**Key files:**
- `src/profile/pack-overview.ts` — derives visual spans after normal forward packing.
- `src/components/profile/RelationshipOverview.tsx` — renders centered tile content at computed widths.

**Depends on:** ADR-109 (Fixed-Hero Semantic Profile Composition and Focused Accessible Editors)
**Required by:** None
