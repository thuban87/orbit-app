# ADR-153: Two-Row Normal Contacts Grid

**Status:** Accepted
**Date:** 2026-09-19
**Phase:** 38.1-profile-presentation-polish
**Source decisions:** dossier §L
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-101 (partial — normal Grid card context row)
**Superseded by:** None

## Context

ADR-101 established a three-row Dashboard card hierarchy. In normal Grid use, the routine third-line Profile excerpt reduced scan density; however, List excerpts and a search explanation remain useful, distinct contexts.

## Decision

Normal Contacts Grid cards render only name and recency. `GridCard` keeps its search-match explanation path, while List keeps its existing third-line excerpt path; Home computes routine line three only for List mode and retains the shared CardGrid prop chain without treating it as a normal-Grid contract.

## Alternatives Considered

- **Keep the routine Grid excerpt** — Rejected because normal cards need a denser scan-first presentation.
- **Remove all third-line text** — Rejected because List context and search explanations serve distinct useful purposes.
- **Redesign Cards and List together** — Rejected because the phase is bounded to normal Grid density.

## Consequences

### Positive

- Grid is denser without weakening search explanations or List context.

### Negative

- Callers must not assume the retained CardGrid prop is rendered in ordinary Grid mode.

### Risks

- Pixel verification must confirm Grid, List, and search remain distinguishable and readable.

## Implementation

**Key files:**
- `src/components/GridCard.tsx` — omits routine line three while preserving search context.
- `src/screens/HomeScreen.tsx` — computes routine line three only for List mode.

**Depends on:** ADR-101 (Avatar-First Accessible Dashboard Card Renderer)
**Required by:** None
