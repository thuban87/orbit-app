# ADR-137: Structured Personalization and Explicit Context Capacity

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 36-ai-configuration-prompting
**Source decisions:** milestone-2 dossier `phase-16-ai-configuration-prompting` §§P–V; 36-CONTEXT D-11
**Reversibility:** costly
**Migration:** 029
**Supersedes:** None
**Superseded by:** None

## Context

Users need understandable writing preferences and durable global context without replacing Orbit's prompt contract. A fixed total-prompt ceiling silently removes permitted material and cannot truthfully represent different selected model capacities or current OpenRouter pricing.

## Decision

The system uses constrained Writing Style settings plus ordered, enableable global Personalization Context sections. Enabled is the sole section egress gate and display order is organizational only. Prompt assembly preserves all permitted bounded values, estimates capacity from the selected model's available catalog metadata, reports known overflow before egress, and never silently truncates context or fabricates capacity or cost for an unknown model.

## Alternatives Considered

- **A user-replaceable raw system prompt** — rejected because user text must not override Orbit privacy or output rules.
- **A fixed total-prompt governor** — rejected because it silently drops permitted context instead of reporting a model-specific limit.
- **A hardcoded model price or capacity list** — rejected because runtime catalog metadata changes.
- **Section order as hidden semantic weighting** — rejected because ordering is predictable organization, not an undeclared prompt priority.

## Consequences

### Positive

- Personalization remains editable, portable, and independently disableable.
- The user receives deliberate overflow and pricing guidance without a network call on every edit.

### Negative

- Direct and Custom models with unknown metadata cannot show invented cost or capacity estimates.

### Risks

- Prompt and catalog changes must preserve the original egress bytes when calculating estimates.

## Implementation

**Key files:**
- `src/db/personalization-dao.ts` — stores Writing Style and ordered personalization sections.
- `src/ai/prompt-types.ts` — defines structured prompt inputs and overflow notices.
- `src/ai/prompt-template.ts` — renders immutable instructions and enabled sections.
- `src/ai/context-estimate.ts` — calculates local capacity and input-cost estimates without truncation.
- `src/ai/openrouter-catalog.ts` — provides cached OpenRouter model capacity and pricing.

**Depends on:** ADR-135 (Multi-Connection AI Configuration and Fail-Closed Readiness)
**Required by:** None
