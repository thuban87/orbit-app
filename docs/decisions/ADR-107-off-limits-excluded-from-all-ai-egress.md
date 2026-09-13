# ADR-107: Off Limits Excluded from All AI Egress

**Status:** Accepted
**Date:** 2026-09-13
**Phase:** 35-messaging-ai-compose
**Source decisions:** D-14 (35-CONTEXT.md); owner ratification 2026-09-13 (during Phase 35 plan-review convergence)
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-078 (partial — Off Limits AI egress only; ADR-078's gated recent-interaction-note carry and absolute Group Notes ban remain in force)
**Superseded by:** None

## Context

ADR-078 (ratified 2026-09-01) widened AI egress so that AI-enabled Off Limits items were transmitted to the provider as negative "avoid this topic" constraints, on the reasoning that a model which cannot see the avoid-topics cannot avoid them. During Phase 35 plan-review convergence, a cross-AI review found the gate unbuildable as specified: Off Limits items live in the `fuel` table, which carries no per-item AI-permission column and none is added, so an "AI-enabled vs AI-disabled off-limits" distinction has no data source. On being shown the conflict, the owner ratified a narrower posture: Off Limits is intentionally kept out of AI entirely.

## Decision

Off Limits items are **never transmitted to the AI provider in any form** — not as positive context (already excluded) and not as negative avoidance constraints (this reverses ADR-078's widening). No `PromptContext` avoidance-constraint shape is populated from off-limits, and `fuel-read.ts`'s exclusion of off-limits from every AI-facing read stands unrelaxed. Off Limits remains fully visible to the human on the Compose Research side as the differentiated "Avoid" group and can never be selected as Message Focus (unchanged). ADR-078's other provisions are untouched and remain in force: the recent-interaction-note projection gated on each interaction's `allow_ai` flag, and the absolute ban on transmitting Group Notes.

## Alternatives Considered

- **Keep ADR-078 (send AI-enabled off-limits as avoidance constraints)** — Rejected by the owner: off-limits was intentionally excluded from AI, and no per-item permission substrate exists for the gate ADR-078 assumed.
- **Add a `fuel.allow_ai` column in migration 028 to build ADR-078's gate** — Rejected: expands this phase's irreversible schema scope and requires a per-item toggle UI to be meaningful, to support egress the owner does not want.
- **Ship a carry-only empty avoidance shape and defer the gate to Phase 36** — Rejected: defers rather than settles, and Phase 36 would inherit the same substrate gap for egress the owner has now excluded.

## Consequences

### Positive

- Off Limits content never leaves the device, tightening the local-first egress boundary and removing an un-sourced permission gate.
- Phase 35's egress work simplifies: no off-limits avoidance-constraint carry, no new `fuel` permission column.

### Negative

- The AI model is not told which topics to avoid, so a draft may surface an off-limits topic the model had no way to know about; mitigated by the human reviewing every suggestion before it enters the editor (nothing is sent on the user's behalf).

### Risks

- A future phase re-widening off-limits egress would reverse this ADR and re-encounter the missing-permission-substrate problem; any such change is an owner decision requiring a new ADR.

## Implementation

**Key files:**
- `src/db/ai-context-read.ts` — must not project Off Limits into any AI-facing shape, positive or negative.
- `src/db/fuel-read.ts` — Off Limits rows stay excluded from every AI-facing read; the ranked-fuel exclusion is not relaxed.
- `src/ai/prompt-types.ts` — `PromptContext` carries no off-limits avoidance-constraint shape; the recent-interaction-note shape from ADR-078 remains.
- `src/ai/prompt-template.ts` — renders no off-limits avoidance section.
- `src/screens/ComposeScreen.tsx` — still shows Off Limits as the Research-side "Avoid" group and withholds "Add to AI" from those rows.

**Depends on:** ADR-050 (Closed AI Prompt Egress Allowlist and Opt-In Field Sharing); ADR-078 (Negative-Constraint Off Limits and Gated Recent-Interaction AI Context)
**Required by:** _None._
