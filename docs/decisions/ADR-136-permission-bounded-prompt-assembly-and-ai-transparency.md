# ADR-136: Permission-Bounded Prompt Assembly and AI Transparency

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 36-ai-configuration-prompting
**Source decisions:** milestone-2 dossier `phase-16-ai-configuration-prompting` §§O, W–AB; 36-CONTEXT D-06–08; ADR-107
**Reversibility:** costly
**Migration:** 029
**Supersedes:** None
**Superseded by:** None

## Context

AI drafting needs useful contact context without making a visibility setting or a broad type default into implicit permission. The user also needs truthful review and failure surfaces that do not expose prompts, private relationship data, credentials, or raw provider responses.

## Decision

The system assembles one immutable resolved prompt from only individually permitted memories, custom fields, and the three most recent interactions whose notes opt in; each value is bounded and DATA-fenced. Off Limits and Group Notes never egress. Permission defaults apply only when new items are created, while a central manager can review and change stored permission. First use discloses the active connection path, and Settings and Compose review the same resolved prompt object used for egress.

## Alternatives Considered

- **Transmit Off Limits as avoidance constraints** — rejected by the owner in ADR-107 because the required per-item permission substrate does not exist.
- **Treat visibility or type as AI permission** — rejected because durable, reviewable consent must be explicit.
- **Require exact-prompt acknowledgement at first generation** — rejected by ADR-079 in favor of lightweight disclosure and on-demand review.
- **Send Group Notes when a participant allows AI** — rejected because shared event text may describe other people.

## Consequences

### Positive

- Every displayed transparency surface can be checked against the exact egress payload.
- Diagnostic events retain only an explicit safe metadata allowlist.

### Negative

- Writers for memories, interaction notes, and field definitions must resolve defaults at creation time.

### Risks

- Any new prompt context shape requires a deliberate permission and inspector review before it can egress.

## Implementation

**Key files:**
- `src/db/ai-context-read.ts` — reads the closed, permission-bounded context projection.
- `src/ai/prompt-template.ts` — produces the immutable bounded prompt string.
- `src/db/ai-permissions-dao.ts` — owns defaults, review rows, and bulk permission changes.
- `src/logic/ai-suggestion-logic.ts` — retains the resolved prompt and sanitized generation failures.
- `src/components/AIComposeContextReview.tsx` — displays Compose contact context from the resolved prompt.

**Depends on:** ADR-079 (On-Demand AI Transparency and Compose-Only Three-Suggestion Invocation); ADR-107 (Off Limits Excluded from All AI Egress)
**Required by:** None
