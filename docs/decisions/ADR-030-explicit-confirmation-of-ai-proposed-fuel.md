# ADR-030: Explicit Confirmation of AI-Proposed Fuel

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 07-conversational-fuel
**Source decisions:** dossier `03-fuel` Cluster E; Phase 07 Plan 03
**Reversibility:** one-way
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

An AI-suggested fuel item can read as a user-authored fact and reinforce itself if later prompt reads consume it. The Phase 7 UI and DAO establish the state before a later phase produces suggestions, so the dangerous feedback path is unavailable by default.

## Decision

The system stores an unconfirmed AI proposal as `source='ai'`, renders it distinctly, and excludes it from ranked, search, and prompt-facing reads until the user confirms it. Confirmation performs one scoped source flip to `manual`; it intentionally erases the row's prior AI provenance and adds no confirmation timestamp.

## Alternatives Considered

- **Never allow AI to propose fuel** — rejected because an explicit user review can safely make the existing prompt context useful.
- **Allow AI to write ordinary fuel freely** — rejected because hallucinated content could be presented or re-sent as user truth.
- **Keep an `ai_confirmed_at` timestamp** — rejected by the owner in favor of a source flip with no schema change.

## Consequences

### Positive

- An unconfirmed suggestion remains profile-visible for review but cannot become a glanceable or prompt input.
- Confirm and dismiss map to explicit, testable state transitions.

### Negative

- Confirming deliberately loses information about the row's original source.

### Risks

- The confirm write must be scoped by both id and contact id so a stale or mismatched action cannot alter another contact's row.

## Implementation

**Key files:**
- `src/db/fuel-dao.ts` — scopes the confirmation flip and wraps it in the single-writer transaction.
- `src/db/fuel-read.ts` — excludes `source='ai'` from ranked and search projections.
- `src/components/FuelEditor.tsx` — gives unconfirmed rows a distinct badge, helper, Confirm, and Dismiss controls.
- `src/screens/ContactProfileScreen.tsx` — reloads fuel after confirmation or dismissal.

**Depends on:** ADR-028 (Per-Item Conversational Fuel with Fixed Kinds); ADR-029 (In-Query Fuel Eligibility and a Shared Ranked Projection)
**Required by:** _None._
