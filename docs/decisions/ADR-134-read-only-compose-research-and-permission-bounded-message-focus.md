# ADR-134: Read-Only Compose Research and Permission-Bounded Message Focus

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 35-messaging-ai-compose
**Source decisions:** dossier `phase-14-messaging-ai-compose` §§J–O; CONTEXT D-08, D-10, D-13
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Compose needed useful contact context without restoring the former fuel-first editor or duplicating Profile's editing surface. It also needed a temporary way to emphasize already-authorized knowledge for an AI request while preserving the existing local-visibility and AI-egress boundaries.

## Decision

Compose Research is a sibling, read-only projection over populated conversation-relevant knowledge. Its normalized items carry source-owned display and AI-eligibility facts; only an eligible, non-Off-Limits item can enter the capped, session-only Message Focus selection. Off Limits stays visible to the human as Avoid context and remains outside AI egress under ADR-107.

## Alternatives Considered

- **Embed editable knowledge cards above the Compose editor** — Rejected because reference material must not bury the primary drafting workflow or recreate Profile administration.
- **Infer AI eligibility in the screen or session store** — Rejected because permission semantics differ by source and must be resolved once at the read boundary.
- **Make Add to AI grant permission** — Rejected because it is temporary emphasis over data that was already authorized.
- **Allow Off Limits in Message Focus or AI context** — Rejected because the item is human Avoid context and ADR-107 excludes it from every outbound AI shape.

## Consequences

### Positive

- Research stays useful when AI is off and exposes only populated, conversation-relevant groups.
- Message Focus cannot widen egress permission, persist across relaunch, or transmit stale selected data without current-read intersection.

### Negative

- The projection must deliberately maintain source-specific visibility and eligibility rules rather than reuse Profile's broad aggregate unchanged.
- Gated recent interaction notes are carried but intentionally not rendered into provider prompts until the owning Phase 36 work.

### Risks

- Treating local visibility as AI permission could disclose information; normalized `ResearchItem` eligibility and store guards must remain the only selection route.
- A future prompt-template change must preserve ADR-107's total Off Limits exclusion and the Group Notes ban.

## Implementation

**Key files:**
- `src/db/compose-research-read.ts` — produces populated, ordered `ResearchItem` records with structural eligibility and Off Limits marking.
- `src/db/profile-knowledge-read.ts` — supplies the narrow populated custom-field projection used by Compose Research.
- `src/screens/ComposeResearchScreen.tsx` — renders the compact read-only Research side and its guarded Add to AI control.
- `src/stores/compose-session-store.ts` — holds the capped, non-durable Message Focus selection and rejects ineligible items.
- `src/db/ai-context-read.ts` — carries only allow-AI-gated recent interaction notes through the closed context boundary.
- `src/ai/prompt-types.ts` — defines the carry-only gated-note context shape without an Off Limits shape.
- `src/screens/ComposeScreen.tsx` — enters Research, displays focus count, and intersects selected items with fresh data before a request.

**Depends on:** ADR-078 (Negative-Constraint Off Limits and Gated Recent-Interaction AI Context); ADR-107 (Off Limits Excluded from All AI Egress)
**Required by:** _None._
