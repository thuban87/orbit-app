# ADR-081: Retire AI-Proposed Fuel for Explicit Per-Item Permission

**Status:** Accepted
**Date:** 2026-09-04
**Phase:** 24.2-contact-knowledge-egress-search-types
**Source decisions:** Phase 24.2 D-08 and D-10b; dossier R-01 resolution
**Reversibility:** one-way
**Migration:** 017-knowledge-egress-datamove
**Supersedes:** ADR-030
**Superseded by:** None

## Context

ADR-030 introduced `source='ai'` fuel together with `confirmFuelCore` and the
FuelEditor confirmation UI, preventing an unconfirmed suggestion from entering
ranked or prompt-facing fuel reads. No shipped producer inserts that source:
the remaining confirm path is therefore dormant. Knowledge now has a direct,
per-item permission instead: `memories.allow_ai`, defaulting to off.

## Decision

Retire the AI-proposed-fuel model. Migration 017 copies every historical
`source='ai'` fuel row to a general, AI-off Memory before removing the fuel row.
The same migration copies share-capture topic fuel to share-provenance Memories
before removal. Each source row is re-read after insertion and verified before
the source is deleted, so the retirement is non-destructive.

## Consequences

### Positive

- AI egress permission is explicit on each Memory and defaults to off, instead
  of being inferred from a fuel provenance value.
- Retired rows cannot double-surface as both fuel and Memories.
- Historical AI-proposed content is retained locally as AI-off knowledge.

### Negative

- The copied `source='ai' AND kind='off_limits'` safety-net case becomes a
  general Memory because Memories have no off-limits kind. Its never-egress
  outcome remains protected by `allow_ai=0`.

### Deferred removal

Phase 24.2 delivers the data and ADR half only. The existing `confirmFuel` /
`confirmFuelCore` path, ContactProfileScreen handler, and FuelEditor
Confirm/Dismiss controls remain present but inert: no producer writes
`source='ai'`, and migration 017 removes any existing rows. Their removal is
deferred to Phase 36 (AI Configuration & Prompting), which owns the permission
manager consolidation. Until then this dormant UI is a latent revival surface;
Phase 36 must delete it rather than leave it in place.

## Implementation

**Key files:**
- `src/db/migrations/017-knowledge-egress-datamove.ts` — verified copy-then-remove data move.
- `src/db/memories-read.ts` — later per-item SQL egress projection.

**Depends on:** ADR-030, ADR-078
