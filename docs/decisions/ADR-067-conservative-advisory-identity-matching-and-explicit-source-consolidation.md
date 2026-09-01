# ADR-067: Conservative Advisory Identity Matching and Explicit Source Consolidation

**Status:** Accepted
**Date:** 2026-08-26
**Phase:** 19-system-contact-import
**Source decisions:** dossier `19-system-contact-import` clusters G–M; 19-CONTEXT.md; 19-05, 19-07, and 19-11 summaries
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Imported records can describe an existing Orbit person or multiple selected source records can describe one person. System-contact identity is not Orbit identity: an inferred match can be wrong, while a generic Orbit-to-Orbit merge has consequences beyond initial import and remains outside this phase.

## Decision

The system treats an active external source link as deterministic identity and treats canonical phone, email, name, and birthday evidence as a score-private advisory ladder. Name-only or birthday-only evidence never authorizes an automatic link; multiple credible candidates require explicit resolution. Selected source records may be consolidated only on shared canonical phone or email evidence and only after the user chooses Combine into one rather than Keep separate.

## Alternatives Considered

- **Automatically link or merge from a high score** — Rejected because all non-link evidence is advisory and ambiguous identity must not silently mutate Orbit data.
- **Double-count every correlated phone/email signal** — Rejected because correlated fields can overstate confidence.
- **Cluster selected records by names or birthdays** — Rejected because those signals are insufficiently reliable for initial consolidation.

## Consequences

### Positive

- Exact source identity is fast and deterministic, while uncertain data remains visible for a user decision.
- Conservative consolidation creates one contact with multiple source links without introducing generic Orbit merge behavior.

### Negative

- Ambiguous rows can remain unresolved and require a separate review workspace.

### Risks

- Candidate scoring and canonicalization must stay advisory; exposing a score or adding an automatic path would reverse the identity boundary.

## Implementation

**Key files:**
- `src/services/import/duplicate-evidence.ts` — finds active source links and produces ordered advisory candidate outcomes.
- `src/db/imported-contact-dao.ts` — composes explicit link and provenance writes with import-row resolution.
- `src/services/import/source-consolidation.ts` — detects canonical-method clusters and atomically combines approved source rows.
- `src/components/CandidateCardGrid.tsx` — provides the reusable explicit multi-select review surface.
- `src/screens/DuplicateReviewScreen.tsx` — performs Link to Existing, Import as New, or Skip actions.
- `src/components/ConsolidationPrompt.tsx` — asks the user to combine matched source records or keep them separate.

**Depends on:** ADR-059 (Normalized Contact Methods, Canonical Actionability, and Local Provenance); ADR-066 (Deliberate Reviewed Import with Unbound Bulk Defaults)
**Required by:** None.
